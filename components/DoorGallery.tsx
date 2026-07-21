"use client";

import { useEffect, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import {
  buildPlayEntry,
  type HomePart,
  type HomePlan,
  type PlayEntry,
} from "@/lib/home-sections";
import {
  applyOrbitGains,
  ensurePerfFx,
  playSong,
  setExplicitVisualsDrive,
  setLiveCps,
  setLivePerf,
  setVisuals,
  startIdleVisual,
  stop,
  teardownVisuals,
  updateVisuals,
} from "@/lib/strudel-client";
import { layerAppendPos, stripDuckFamily } from "@/lib/reverb-orbits";
import { beatsPerBar, transposePitched } from "@/lib/playback";
import { extractHydra } from "@/lib/hydra-embed";
import {
  clearNowPlaying,
  dockPause,
  dockResume,
  dockStop,
  nowPlaying,
  publishNowPlaying,
  updateNowPlaying,
} from "@/lib/now-playing";
import { useNowPlayingValue } from "@/lib/use-now-playing";

/** What /api/door lists — a whisper of identity, no code. */
export interface DoorSong {
  id: string;
  title: string;
  plan: { bpm?: number; key?: string; genre?: string; timeSignature?: string | null };
}

// The room chips — fixed, tasty amounts. One tap in, one tap out;
// setLivePerf ramps on the audio graph, so the change is INSTANT and clickless.
// The one bipolar filter splits into TWO chips (Dark = LP down, Bright = HP up)
// so the wall has more to press — they trade places, never stack.
type FxKey = "dark" | "bright" | "echo" | "punch" | "space";
const FX_KEYS: FxKey[] = ["dark", "bright", "echo", "punch", "space"];
const FX_LABEL: Record<FxKey, string> = {
  dark: "Dark",
  bright: "Bright",
  echo: "Echo",
  punch: "Punch",
  space: "Space",
};
function perfValues(f: Record<FxKey, boolean>) {
  return {
    filter: f.dark ? -55 : f.bright ? 55 : 0,
    echo: f.echo ? 0.45 : 0,
    punch: f.punch ? 0.4 : 0,
    space: f.space ? 0.5 : 0,
  };
}

/** The @vlooks grades a song ships (one-tap recolours of its picture). */
interface Look {
  name: string;
  set: Record<string, number>;
}
function parseLooks(code: string): Look[] {
  const m = code.match(/\/\*\s*@vlooks\n([\s\S]*?)\n\*\//);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]) as { looks?: Look[] };
    return Array.isArray(parsed.looks) ? parsed.looks.slice(0, 4) : [];
  } catch {
    return [];
  }
}
/** Re-grade a loop's sketch: swap the four const lines for the look's values. */
function regrade(code: string, set: Record<string, number>): string {
  let out = code;
  for (const k of ["vSaturation", "vContrast", "vBrightness", "vHue"]) {
    const v = set[k];
    if (typeof v === "number") {
      out = out.replace(new RegExp(`const ${k} = [-\\d.]+`), `const ${k} = ${v}`);
    }
  }
  return out;
}
/** A tiny swatch colour that EVOKES the look (hue-rotated from the house pink). */
function swatch(set: Record<string, number>): string {
  const hue = (((320 + (set.vHue ?? 0) * 360) % 360) + 360) % 360;
  const sat = Math.max(12, Math.min(95, 40 + (set.vSaturation ?? 1) * 32));
  const lum = Math.max(24, Math.min(78, 52 + (set.vBrightness ?? 0) * 90));
  return `hsl(${Math.round(hue)}deg ${Math.round(sat)}% ${Math.round(lum)}%)`;
}

// --- THE LAUNCHPAD ------------------------------------------------------------
// Every `$:` layer of the sounding loop becomes a BUTTON. Each layer rides its
// own orbit bus (10, 11, 12, …), so a tap is an instant Web Audio gain ramp —
// tails included, back mid-note — exactly the Sets kill law, but per layer.
interface DoorLayer {
  orbit: number;
  name: string;
}
type DoorEntry = PlayEntry & { layersBySection: Record<string, DoorLayer[]> };

const LAYER_ORBIT_BASE = 10;

// Button names people feel: classic shorthands spelled out; noise tides named
// for what they do in the room; everything else is the sound's own name.
const SOUND_NAMES: Record<string, string> = {
  bd: "Kick",
  sd: "Snare",
  hh: "Hats",
  ch: "Hats",
  oh: "Open hat",
  cp: "Clap",
  cr: "Crash",
  rd: "Ride",
  rim: "Rim",
  sh: "Shaker",
  lt: "Tom",
  mt: "Tom",
  ht: "Tom",
  cb: "Cowbell",
  white: "Air",
  pink: "Air",
  brown: "Tide",
};
function layerName(code: string): string {
  const m = code.match(/\b(?:s|sound)\(\s*["'`]([^"'`]*)["'`]/);
  const tok = m?.[1]?.toLowerCase().split(/[^a-z0-9_]+/).find(Boolean) ?? "";
  if (!tok) return "Layer";
  if (SOUND_NAMES[tok]) return SOUND_NAMES[tok];
  const pretty = tok.replace(/^gm_/, "").replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Re-bus a section so EVERY layer owns its orbit, and name each one. Meta
 *  comment blocks (@hydra & co) stay untouched — same cap as the Sets re-bus
 *  (an `.orbit()` landing inside visual code kills the whole evaluate). */
function rebusLayers(code: string): { code: string; layers: DoorLayer[] } {
  if (!code) return { code, layers: [] };
  const metaAt = code.search(
    /\/\*\s*@(?:hydra|controls|vcontrols|vlooks|swaps|edits)\b/,
  );
  const musicEnd = metaAt >= 0 ? metaAt : code.length;
  const tail = code.slice(musicEnd);
  const music = code.slice(0, musicEnd);
  const starts: number[] = [];
  for (const m of music.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (!starts.length) return { code, layers: [] };
  const out: string[] = [music.slice(0, starts[0])];
  const layers: DoorLayer[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : music.length;
    const layer = stripDuckFamily(
      music.slice(starts[i], end).replace(/\.orbit\(\s*\d+\s*\)/g, ""),
    );
    const base = layerName(layer);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const at = layerAppendPos(layer);
    out.push(
      `${layer.slice(0, at)}.orbit(${LAYER_ORBIT_BASE + i})${layer.slice(at)}`,
    );
    layers.push({
      orbit: LAYER_ORBIT_BASE + i,
      name: n > 1 ? `${base} ${n}` : base,
    });
  }
  return { code: out.join("") + tail, layers };
}

/**
 * THE DOOR — the signed-out page IS the instrument. One orb starts the run;
 * each song plays through once and hands the room to the next on its wrap
 * downbeat (new picture, new name), or » deals the next one on YOUR downbeat.
 * Hands-on: a LAUNCHPAD of per-layer pads (each layer on its own orbit gate —
 * killed and revived mid-note, remembered by name across sections), the room
 * chips (Dark/Bright/Echo/Punch/Space on the master graph), a momentary CUT
 * (hold = silence, release = the drop), BEND THE TEMPO live (the scheduler
 * itself pivots — no re-evaluate), SHIFT THE KEY (the song re-enters the
 * sounding section in the new key — same-owner crossfade by the engine's
 * takeover law), and re-grade the picture with one tap (the song's @vlooks).
 *
 * VISUALS ARE DRIVEN EXPLICITLY here (updateVisuals on play/hand-off): the
 * combined-program hydra path can die quietly on prod chunk splits, but the
 * direct sketch-run path always paints. The idle boot RETRIES until the canvas
 * has real pixels — the room must never open black.
 */
export default function DoorGallery({
  songs,
  onVisual,
}: {
  songs: DoorSong[];
  /** A picture holds the room (idle or playing) — the page's glow yields. */
  onVisual?: (up: boolean) => void;
}) {
  const [at, setAt] = useState(0);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [error, setError] = useState(false);
  // The journey's odometer — canonical first/last ids survive key-change
  // restarts that rotate the section list.
  const journeyRef = useRef({ sawLast: false, advancing: false });
  const canonRef = useRef<{ first: string | null; last: string | null }>({
    first: null,
    last: null,
  });
  // THE LAUNCHPAD state — `off` is keyed by layer NAME, so a killed "Kick"
  // stays killed through section boundaries and the one-bar breaks between
  // them (their layers wear the same names). Ref-first for anything a gesture
  // must read synchronously (SetClient law). `layersRef` = the SOUNDING
  // section's layers (gating truth, breaks included); `layersUi` = the loop
  // grid on screen (breaks don't flash the grid for one bar).
  const [offNames, setOffNames] = useState<Set<string>>(new Set());
  const offRef = useRef(offNames);
  const [layersUi, setLayersUi] = useState<DoorLayer[]>([]);
  const layersRef = useRef<DoorLayer[]>([]);
  const [fx, setFx] = useState<Record<FxKey, boolean>>({
    dark: false,
    bright: false,
    echo: false,
    punch: false,
    space: false,
  });
  const fxRef = useRef(fx);
  // CUT — hold to pull the whole mix out of the room, release to slam it back.
  // A momentary gate on every layer bus; the tails ring, the drop hits.
  const [cut, setCut] = useState(false);
  const cutRef = useRef(false);
  // Tempo = live multiplier on the scheduler; Key = semitone shift applied by
  // decorate at (re)evaluate. Refs so the engine reads the tap, not the render.
  const [tempo, setTempo] = useState(1);
  const tempoRef = useRef(1);
  const [keyUi, setKeyUi] = useState(0);
  const keyRef = useRef(0);
  const [look, setLook] = useState<string | null>(null);
  const lookRef = useRef<Look | null>(null); // the grade every repaint wears
  const lastHydraRef = useRef<string | null>(null);
  const codeCache = useRef(new Map<string, DoorEntry>());

  const playingId = useNowPlayingValue(
    (s) => (s?.kind === "song" ? s.id : null),
    null,
  );
  const paused = useNowPlayingValue(
    (s) => s?.kind === "song" && !!s.paused,
    false,
  );
  const [curSectionId, setCurSectionId] = useState<string | null>(null);
  const curSectionIdRef = useRef<string | null>(null);

  const current = songs.find((s) => s.id === playingId) ?? songs[at % songs.length];
  const isPlaying = !!current && playingId === current.id;
  const sounding = isPlaying && !paused;

  /** The engine cps for a song under the live tempo multiplier. */
  function cpsFor(s: DoorSong, mult: number): number {
    const bpm = s.plan?.bpm || 120;
    return (bpm * mult) / (beatsPerBar(s.plan?.timeSignature) * 60);
  }

  /** Run a section's sketch directly (the path that always paints), wearing the
   *  active look — so a chosen grade SURVIVES section boundaries and hand-off
   *  re-entries. Skips unchanged sketches (no jump-cuts) unless forced. */
  function paint(code: string | undefined, force = false): void {
    if (!code) return;
    const graded = lookRef.current ? regrade(code, lookRef.current.set) : code;
    const h = extractHydra(graded);
    if (!h || (!force && h === lastHydraRef.current)) return;
    lastHydraRef.current = h;
    void updateVisuals(graded);
  }

  /** Fetch + build (once per song): sealed payload → sections, then RE-BUS
   *  every layer onto its OWN orbit and name it — the launchpad's buttons. */
  async function entryFor(s: DoorSong): Promise<DoorEntry | null> {
    let entry = codeCache.current.get(s.id) ?? null;
    if (entry) return entry;
    const res = await fetch(`/api/door/${s.id}`);
    const d = openDeep(
      (await res.json().catch(() => null)) as {
        song?: { plan?: HomePlan };
        parts?: HomePart[];
      } | null,
    );
    const built = buildPlayEntry(d?.parts ?? [], d?.song?.plan ?? {});
    if (!built) return null;
    const layersBySection: Record<string, DoorLayer[]> = {};
    const sections = built.sections.map((sec) => {
      const { code, layers } = rebusLayers(sec.code);
      layersBySection[sec.id] = layers;
      return { ...sec, code };
    });
    entry = { ...built, sections, layersBySection };
    codeCache.current.set(s.id, entry);
    return entry;
  }

  /** The next stop (the list is already a per-visit shuffle). */
  function nextOf(s: DoorSong): DoorSong | null {
    if (songs.length < 2) return null;
    const from = songs.findIndex((x) => x.id === s.id);
    return songs[(from + 1 + songs.length) % songs.length] ?? null;
  }

  // THE ROOM BREATHES BEFORE THE TAP — prefetch the first song, mount its
  // picture, and RETRY until the canvas holds real pixels (the boot can lose a
  // silent race; the door must never open black).
  useEffect(() => {
    let dead = false;
    let tries = 0;
    const attempt = async () => {
      try {
        const first = songs[0];
        if (!first) return;
        const entry = await entryFor(first);
        if (dead || !entry || !entry.visual) return;
        setVisuals(true);
        await startIdleVisual(entry.sections[0].code);
        if (dead) return;
        lastHydraRef.current = extractHydra(entry.sections[0].code);
        onVisual?.(true);
        setTimeout(() => {
          if (dead || nowPlaying()) return;
          const c =
            document.getElementById("k1-canvas") ??
            document.getElementById("hydra-canvas");
          const painted = c instanceof HTMLCanvasElement && c.width > 0;
          if (!painted && ++tries < 4) void attempt();
        }, 1500);
      } catch {
        /* the door still works without a backdrop */
      }
    };
    void attempt();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section changes build fresh orbit buses at gain 1 — re-assert the kills on
  // a light tick (applyOrbitGains skips buses already at target; Sets' law).
  const gainFor = (orbit: number): number | undefined => {
    const l = layersRef.current.find((x) => x.orbit === orbit);
    if (!l) return undefined;
    if (cutRef.current) return 0; // the hold owns every bus
    return offRef.current.has(l.name) ? 0 : 1;
  };
  useEffect(() => {
    if (!playingId) return;
    const t = setInterval(() => applyOrbitGains(gainFor), 200);
    return () => clearInterval(t);
     
  }, [playingId]);

  // THE PICTURE NEVER DIES DURING PLAY: if the canvas is gone, hidden, or
  // zero-sized while a song with a visual sounds, revive it and re-run the
  // sounding section's sketch (context loss, a lost race, anything).
  useEffect(() => {
    if (!playingId) return;
    const t = setInterval(() => {
      const entry = codeCache.current.get(playingId);
      if (!entry?.visual) return;
      const c = (document.getElementById("k1-canvas") ??
        document.getElementById("hydra-canvas")) as HTMLCanvasElement | null;
      if (c && c.style.display !== "none" && c.width > 0) return;
      setVisuals(true);
      const sec =
        entry.sections.find((x) => x.id === curSectionIdRef.current) ??
        entry.sections[0];
      paint(sec?.code, true);
    }, 4000);
    return () => clearInterval(t);
     
  }, [playingId]);

  useEffect(() => {
    // A new song brings its own default grade and a fresh launchpad.
    lookRef.current = null;
    setLook(null);
    offRef.current = new Set();
    setOffNames(new Set());
  }, [playingId]);

  // Leaving the door (signing in!): the music rides along — the dock carries
  // it into the signed-in home. Only a silent page tears the engine down. The
  // room chips reset either way: the app inside must open clean.
  useEffect(() => {
    // The door paints its own pictures (paint/startIdleVisual) — keep hydra OUT
    // of the evaluated programs, whose prod-only death would kill visuals for
    // the session at the first play. And the picture IS the room here: the
    // door-stage class lifts the canvas from its behind-the-UI dimming to
    // near-full — the reason "the visuals don't show" was mostly 0.45 opacity
    // over black.
    setExplicitVisualsDrive(true);
    document.body.classList.add("door-stage");
    return () => {
      setExplicitVisualsDrive(false);
      document.body.classList.remove("door-stage");
      const np = nowPlaying();
      if (np) {
        if (np.surfaceMounted) updateNowPlaying({ surfaceMounted: false });
      } else {
        stop();
        teardownVisuals();
      }
      setLivePerf({ filter: 0, echo: 0, punch: 0, space: 0 });
    };
  }, []);

  async function onPlay(s: DoorSong, startAtId?: string, force = false) {
    if (!force && playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    setLoadingPlay(true);
    setError(false);
    // CUT at tap time — except a same-song key re-entry, which stays a live
    // session so playSong's same-owner takeover CROSSFADES it.
    const sameSession = force && playingId === s.id;
    if (!sameSession && nowPlaying()) dockStop();
    try {
      const entry = await entryFor(s);
      if (!entry) {
        setError(true);
        return;
      }
      if (!entry.visual) teardownVisuals();
      else setVisuals(true);
      ensurePerfFx();
      setLivePerf(perfValues(fxRef.current));
      const { labels } = entry;
      const cached = entry;
      canonRef.current = {
        first: entry.sections[0].id,
        last: entry.sections[entry.sections.length - 1].id,
      };
      // A key change re-enters the SOUNDING section, not the top of the song.
      const fromAt = startAtId
        ? Math.max(0, entry.sections.findIndex((x) => x.id === startAtId))
        : 0;
      const list = [
        ...entry.sections.slice(fromAt),
        ...entry.sections.slice(0, fromAt),
      ];
      journeyRef.current = { sawLast: false, advancing: false };
      setCurSectionId(list[0].id);
      curSectionIdRef.current = list[0].id;
      layersRef.current = cached.layersBySection[list[0].id] ?? [];
      if (!list[0].id.startsWith("break:")) setLayersUi(layersRef.current);
      await playSong(list, {
        owner: s.id,
        // The KEY, applied at evaluate — drums keep their sample pitch.
        decorate: (code) =>
          keyRef.current ? transposePitched(code, keyRef.current) : code,
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null });
          if (!id) return;
          setCurSectionId(id);
          curSectionIdRef.current = id;
          // The launchpad follows the sounding section; a one-bar break keeps
          // the loop's grid on screen (its gates still apply by name).
          layersRef.current = cached.layersBySection[id] ?? [];
          if (!id.startsWith("break:")) setLayersUi(layersRef.current);
          // FORCED repaint on every boundary — the picture must never be the
          // thing that got stuck.
          paint(cached.sections.find((x) => x.id === id)?.code, true);
          // THE HAND-OFF: wrap detected → this downbeat belongs to the next
          // song. Canonical ids, so key-change rotations don't confuse it.
          const j = journeyRef.current;
          if (id === canonRef.current.first && j.sawLast && !j.advancing) {
            j.advancing = true;
            const upNext = nextOf(s);
            if (upNext) void onPlay(upNext);
            else j.advancing = false;
          } else if (id === canonRef.current.last) {
            j.sawLast = true;
          }
        },
        // THE DOOR NEVER LINGERS: every section — loop, break, unfold — plays
        // exactly once. Repeat latches are a song-page luxury; the room here
        // keeps MOVING (new picture, new layers, new name).
        repeatsFor: () => 1,
        effectsFor: () => cached.effects,
        overlaysFor: () => cached.overlays,
        ending: entry.ending,
        onEnded: () => clearNowPlaying(),
      });
      // The picture is driven HERE — the path that always paints (evaluated
      // programs carry no hydra on the door). FORCED on purpose: play always
      // re-runs the sketch, even when it's the one the idle boot already
      // showed, so a stop/hand-off's soft-hidden canvas always comes back.
      paint(list[0].code, true);
      onVisual?.(entry.visual);
      // The live tempo survives songs and key changes — re-assert on the fresh
      // program (each evaluate re-bakes the song's own setcpm).
      if (tempoRef.current !== 1) setLiveCps(cpsFor(s, tempoRef.current));
      publishNowPlaying({
        kind: "song",
        id: s.id,
        href: "/",
        title: s.title,
        sectionLabel: labels[list[0].id] ?? null,
        paused: false,
        surfaceMounted: true,
      });
      setAt(Math.max(0, songs.findIndex((x) => x.id === s.id)));
      const upNext = nextOf(s);
      if (upNext) void entryFor(upNext).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoadingPlay(false);
    }
  }

  // SPACE is the transport — play, pause, resume, from anywhere on the door.
  // Typing is sacred (the email/code fields); preventDefault keeps a focused
  // pill from stealing the bar back as a button-press.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== "Space" && e.key !== " ") || e.repeat) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (
        t &&
        (t.isContentEditable ||
          t.closest("input, textarea, select, [contenteditable='true']"))
      )
        return;
      e.preventDefault();
      if (current) void onPlay(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, paused, loadingPlay, at, songs]);

  function toggleLayer(name: string) {
    const next = new Set(offRef.current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    offRef.current = next; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(gainFor);
    setOffNames(next);
  }

  /** Deal the next song NOW — the cut lands at the tap, launchpad and grade
   *  reset with the new name (the playingId watcher). */
  function skip() {
    if (loadingPlay || !current) return;
    const n = nextOf(current);
    if (n) void onPlay(n);
  }

  function toggleFx(k: FxKey) {
    const out = { ...fxRef.current, [k]: !fxRef.current[k] };
    if (k === "dark" && out.dark) out.bright = false;
    if (k === "bright" && out.bright) out.dark = false;
    fxRef.current = out;
    ensurePerfFx();
    setLivePerf(perfValues(out));
    setFx(out);
  }

  /** The momentary CUT: down = every layer bus to zero, up = everything back
   *  mid-note. The 200ms tick re-asserts whichever state is held. */
  function holdCut(on: boolean) {
    if (cutRef.current === on) return;
    cutRef.current = on; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(gainFor);
    setCut(on);
  }

  function onTempo(mult: number) {
    tempoRef.current = mult;
    setTempo(mult);
    if (playingId && current) setLiveCps(cpsFor(current, mult));
  }

  /** Commit a key change: the song re-enters the sounding section transposed —
   *  a same-owner start, so the engine crossfades rather than cuts. */
  function commitKey(v: number) {
    if (v === keyRef.current) return;
    keyRef.current = v;
    setKeyUi(v);
    if (isPlaying && current) {
      void onPlay(current, curSectionId ?? undefined, true);
    }
  }

  /** Grade the picture you're WATCHING (the sounding section, not section 0);
   *  re-tapping the lit swatch takes the song back to its own grade. */
  function applyLook(l: Look) {
    const entry = current ? codeCache.current.get(current.id) : null;
    if (!entry) return;
    const sec =
      entry.sections.find((x) => x.id === curSectionId) ?? entry.sections[0];
    const off = look === l.name;
    lookRef.current = off ? null : l;
    setLook(off ? null : l.name);
    paint(sec.code, true);
  }

  if (!songs.length || !current) return null;

  const meta = [
    current.plan?.genre?.trim() ? sentenceLabel(current.plan.genre) : null,
    current.plan?.bpm ? `${current.plan.bpm} BPM` : null,
    current.plan?.key || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const entryNow = isPlaying ? codeCache.current.get(current.id) : null;
  const looks = entryNow ? parseLooks(entryNow.sections[0].code) : [];

  const pill =
    "rounded-full px-4 py-2 text-[13px] font-medium backdrop-blur-xl transition active:scale-[.96]";
  // Over a full-bright picture, floating text needs its own shadow to hold.
  const shade = "[text-shadow:0_1px_14px_rgba(0,0,0,.9)]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {/* the whisper — where the run is right now. Re-keyed per song so every
          hand-off RISES in with its new name. */}
      <p
        key={current.id}
        className={`animate-rise text-[13px] tabular-nums text-foreground/75 ${shade}`}
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <span className="wordmark text-[17px] tracking-tight text-foreground">
          {current.title}
        </span>
        {meta && <span className="mt-0.5 block">{meta}</span>}
      </p>

      {/* THE ORB — one tap, the room fills. It burns while the music sounds.
          The » beside it deals the NEXT song on your downbeat, not the song's. */}
      <div className="relative mt-7 flex w-full items-center justify-center">
      <button
        onClick={() => void onPlay(current)}
        disabled={loadingPlay}
        aria-label={
          isPlaying
            ? paused
              ? `Resume ${current.title}`
              : `Pause ${current.title}`
            : `Play ${current.title}`
        }
        className="group relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:opacity-70"
      >
        <span
          aria-hidden
          className={`absolute -inset-6 rounded-full bg-accent blur-[30px] transition-opacity duration-500 ${
            sounding ? "opacity-45" : "opacity-25 group-hover:opacity-40"
          } ${!isPlaying && !loadingPlay ? "glow-breathe" : ""}`}
        />
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
            sounding
              ? "shadow-[0_0_60px_-6px_rgba(224,49,156,.95),inset_0_2px_0_rgba(255,255,255,.35)]"
              : "shadow-[0_22px_60px_-14px_rgba(224,49,156,.85),inset_0_2px_0_rgba(255,255,255,.35)]"
          }`}
        />
        <span className="relative">
          {loadingPlay ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.6" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          ) : sounding ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
              <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.4v13.2L19 12z" />
            </svg>
          )}
        </span>
      </button>
      {isPlaying && songs.length > 1 && (
        <button
          onClick={skip}
          disabled={loadingPlay}
          aria-label="Next song"
          title="Next"
          className="absolute left-[calc(50%+4.5rem)] top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.14] bg-black/35 text-foreground/85 backdrop-blur-xl transition hover:border-accent/45 hover:text-accent active:scale-90 disabled:opacity-50"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 5l7 7-7 7M13 5l7 7-7 7" />
          </svg>
        </button>
      )}
      </div>

      {/* Fixed-height stage below the orb: the idle line and the whole deck
          share the SAME reserved space, so the orb never moves. */}
      <div className="mt-7 flex min-h-[17rem] w-full flex-col items-center justify-start">
        {!isPlaying ? (
          <p className={`mt-9 text-[15px] text-foreground/80 ${shade}`}>
            It sounds like this.
          </p>
        ) : (
          <>
            {/* THE LAUNCHPAD — every layer of the sounding loop is a PAD.
                Lit pads breathe out of phase; tap = gone, instantly, tails and
                all; tap again = back mid-note. Re-keyed per song so a fresh
                wall of pads RISES in with every hand-off. */}
            <div
              key={`pads:${playingId}`}
              className="flex max-w-lg flex-wrap items-center justify-center gap-2.5"
            >
              {layersUi.map((l, i) => (
                <button
                  key={l.name}
                  onClick={() => toggleLayer(l.name)}
                  aria-pressed={!offNames.has(l.name)}
                  className={`animate-rise select-none rounded-2xl px-5 py-3.5 text-[13.5px] font-semibold tracking-tight backdrop-blur-xl transition-all duration-150 active:scale-[.88] ${
                    offNames.has(l.name)
                      ? "border border-white/[0.09] bg-black/40 text-white/40"
                      : "pad-lit border border-accent/40 bg-gradient-to-br from-[#ff63c1]/30 via-accent/20 to-[#b3126f]/30 text-white"
                  }`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {l.name}
                </button>
              ))}
            </div>
            {/* THE ROOM — colour the sound. And CUT: hold it, the whole mix
                leaves; let go, it slams back on your fingertip. */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {FX_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleFx(k)}
                  aria-pressed={fx[k]}
                  className={`${pill} select-none ${
                    fx[k]
                      ? "border border-accent/45 bg-gradient-to-br from-[#ff63c1]/35 to-[#b3126f]/35 text-white shadow-[0_0_22px_-6px_rgba(224,49,156,.95)]"
                      : "border border-white/[0.09] bg-black/40 text-white/55 hover:text-white"
                  }`}
                >
                  {FX_LABEL[k]}
                </button>
              ))}
              <button
                onPointerDown={() => holdCut(true)}
                onPointerUp={() => holdCut(false)}
                onPointerLeave={() => cut && holdCut(false)}
                onPointerCancel={() => holdCut(false)}
                onContextMenu={(e) => e.preventDefault()}
                aria-pressed={cut}
                title="Hold to cut the music; release to slam it back"
                className={`${pill} select-none ${
                  cut
                    ? "border border-transparent bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] text-white shadow-[0_0_34px_-4px_rgba(224,49,156,1)]"
                    : "border border-white/[0.09] bg-black/40 text-white/55 hover:text-white"
                }`}
              >
                Cut
              </button>
            </div>
            {/* THE LIGHT — the song's own looks, glossy drops of colour; the
                lit one is the grade the picture is wearing right now. */}
            {looks.length > 0 && (
              <div className="mt-3.5 flex items-center justify-center gap-3.5">
                {looks.map((l) => (
                  <button
                    key={l.name}
                    title={l.name}
                    aria-label={`Look: ${l.name}`}
                    aria-pressed={look === l.name}
                    onClick={() => applyLook(l)}
                    className={`h-6 w-6 rounded-full shadow-[inset_0_2px_3px_rgba(255,255,255,.55),inset_0_-2px_4px_rgba(0,0,0,.45),0_2px_10px_rgba(0,0,0,.5)] transition active:scale-90 ${
                      look === l.name
                        ? "scale-110 ring-2 ring-accent/80 ring-offset-2 ring-offset-black/60"
                        : "ring-1 ring-white/25 hover:scale-105 hover:ring-white/60"
                    }`}
                    style={{ background: swatch(l.set) }}
                  />
                ))}
              </div>
            )}
            {/* THE PHYSICS — bend the tempo live; shift the key on release.
                Machined ranges: pink-filled track, burning thumb (globals.css). */}
            <div className="mt-4 flex w-full max-w-sm flex-col gap-3 px-2">
              <div className="flex items-center gap-3">
                <span className={`w-12 shrink-0 text-left text-[11px] uppercase tracking-widest text-foreground/60 ${shade}`}>
                  Tempo
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.01}
                  value={tempo}
                  onChange={(e) => onTempo(Number(e.target.value))}
                  aria-label="Tempo"
                  className="door-range min-w-0 flex-1 cursor-pointer"
                  style={{ "--p": `${((tempo - 0.6) / 0.8) * 100}%` } as React.CSSProperties}
                />
                <button
                  onClick={() => onTempo(1)}
                  title="Back to the song's tempo"
                  className={`w-16 shrink-0 text-right text-[12px] tabular-nums text-foreground/90 transition hover:text-accent ${shade}`}
                >
                  {Math.round((current.plan?.bpm || 120) * tempo)} BPM
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-12 shrink-0 text-left text-[11px] uppercase tracking-widest text-foreground/60 ${shade}`}>
                  Key
                </span>
                <input
                  type="range"
                  min={-7}
                  max={7}
                  step={1}
                  value={keyUi}
                  onChange={(e) => setKeyUi(Number(e.target.value))}
                  onPointerUp={() => commitKey(keyUi)}
                  onKeyUp={() => commitKey(keyUi)}
                  onTouchEnd={() => commitKey(keyUi)}
                  aria-label="Key"
                  className="door-range min-w-0 flex-1 cursor-pointer"
                  style={{ "--p": `${((keyUi + 7) / 14) * 100}%` } as React.CSSProperties}
                />
                <button
                  onClick={() => commitKey(0)}
                  title="Back to the song's key"
                  className={`w-16 shrink-0 text-right text-[12px] tabular-nums text-foreground/90 transition hover:text-accent ${shade}`}
                >
                  {keyUi > 0 ? `+${keyUi}` : keyUi} st
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[13px] text-red-400">
          The run stumbled — tap the orb.
        </p>
      )}
    </div>
  );
}
