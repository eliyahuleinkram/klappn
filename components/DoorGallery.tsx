"use client";

import { useEffect, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";
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
  stop,
} from "@/lib/strudel-client";
import {
  destroyDoorVisual,
  looksFor,
  pieceFor,
  pulseDoorVisual,
  reseedDoorVisual,
  seedFrom,
  setDoorEnergy,
  setDoorRush,
  showDoorVisual,
} from "@/lib/door-visuals";
import { layerAppendPos, stripDuckFamily } from "@/lib/reverb-orbits";
import { beatsPerBar, transposePitched } from "@/lib/playback";
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
 * THE LIGHT IS OURS: the door runs its own visual engine (lib/door-visuals) —
 * hand-authored pieces on a private hydra instance with its own guarded render
 * loop and a rebuild-on-freeze watchdog. The music engine never touches a
 * canvas here (setExplicitVisualsDrive strips @hydra from every evaluate).
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
  // The LIGHT the current piece wears — an index into its own three looks.
  const [lookIdx, setLookIdx] = useState(0);
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

  // THE ROOM IS LIT BEFORE THE TAP — the door's own visual engine paints the
  // first song's piece the moment the page exists (no audio boot in the way;
  // the engine self-heals if anything kills its frames). The first song's
  // AUDIO is prefetched alongside — and its PADS go up idle, so the page
  // reads as an instrument before a single note: touch any pad, it starts.
  useEffect(() => {
    const first = songs[0];
    if (!first) return;
    void showDoorVisual(pieceFor(first), { bpm: first.plan?.bpm });
    onVisual?.(true);
    void entryFor(first)
      .then((e) => {
        if (!e || nowPlaying()) return;
        layersRef.current = e.layersBySection[e.sections[0].id] ?? [];
        setLayersUi(layersRef.current);
      })
      .catch(() => {});
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

  useEffect(() => {
    // A new song brings its own default light and a fresh launchpad.
    setLookIdx(0);
    offRef.current = new Set();
    setOffNames(new Set());
  }, [playingId]);

  // The LIGHT moves with the music: full tilt while sounding, a slow, visibly
  // alive drift while idle or held.
  useEffect(() => {
    setDoorEnergy(sounding);
  }, [sounding]);

  // Leaving the door (signing in!): the music rides along — the dock carries
  // it into the signed-in home. Only a silent page tears the engine down. The
  // room chips reset either way: the app inside must open clean.
  useEffect(() => {
    // The door has its OWN visual engine (lib/door-visuals) — keep the songs'
    // @hydra blocks OUT of the evaluated programs entirely, so the music
    // engine never touches a canvas here.
    setExplicitVisualsDrive(true);
    return () => {
      setExplicitVisualsDrive(false);
      destroyDoorVisual();
      const np = nowPlaying();
      if (np) {
        if (np.surfaceMounted) updateNowPlaying({ surfaceMounted: false });
      } else {
        stop();
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
      // The room changes LIGHT at the tap — the new song's piece, first look.
      if (!sameSession)
        void showDoorVisual(pieceFor(s), { bpm: s.plan?.bpm, look: 0 });
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
          // Every boundary RESHAPES the piece — new cell counts, new spin,
          // same soul. The room keeps moving with the music.
          reseedDoorVisual(seedFrom(id));
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
      onVisual?.(true);
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
    pulseDoorVisual(); // the light answers every touch
    setOffNames(next);
  }

  function toggleFx(k: FxKey) {
    const out = { ...fxRef.current, [k]: !fxRef.current[k] };
    if (k === "dark" && out.dark) out.bright = false;
    if (k === "bright" && out.bright) out.dark = false;
    fxRef.current = out;
    ensurePerfFx();
    setLivePerf(perfValues(out));
    pulseDoorVisual(); // the light answers every touch
    setFx(out);
  }

  /** The momentary CUT: down = every layer bus to zero, up = everything back
   *  mid-note. While held, the LIGHT RUSHES — silence with the visuals
   *  screaming, then the drop. The 200ms tick re-asserts whichever is held. */
  function holdCut(on: boolean) {
    if (cutRef.current === on) return;
    cutRef.current = on; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(gainFor);
    setDoorRush(on);
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

  /** Switch the LIGHT — the piece re-runs instantly under the chosen look. */
  function applyLook(i: number) {
    if (!current) return;
    setLookIdx(i);
    void showDoorVisual(pieceFor(current), {
      bpm: current.plan?.bpm,
      look: i,
      seed: curSectionIdRef.current ? seedFrom(curSectionIdRef.current) : 0,
    });
  }

  if (!songs.length || !current) return null;

  const looks = isPlaying ? looksFor(pieceFor(current)) : [];

  const pill =
    "rounded-full px-4 py-2 text-[13px] font-medium backdrop-blur-xl transition active:scale-[.96]";
  // Over a full-bright picture, floating text needs its own shadow to hold.
  const shade = "[text-shadow:0_1px_14px_rgba(0,0,0,.9)]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {/* No name, no listing, no track to skip — the room is not a record.
          The music flows on its own; everything on screen is PLAYED. */}

      {/* THE ORB — one tap, the room fills. It burns while the music sounds. */}
      <div className="relative flex w-full items-center justify-center">
      <button
        onClick={() => void onPlay(current)}
        disabled={loadingPlay}
        aria-label={isPlaying ? (paused ? "Resume" : "Pause") : "Play"}
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
              ? "orb-throb"
              : "shadow-[0_22px_60px_-14px_rgba(224,49,156,.85),inset_0_2px_0_rgba(255,255,255,.35)]"
          }`}
          style={
            {
              "--beat": `${60 / ((current.plan?.bpm || 120) * tempo)}s`,
            } as React.CSSProperties
          }
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
      </div>

      {/* Fixed-height stage below the orb: idle and playing share the SAME
          reserved space, so the orb never moves. */}
      <div className="mt-7 flex min-h-[17rem] w-full flex-col items-center justify-start">
        {!isPlaying && (
          <p className={`mb-3 text-[15px] text-foreground/85 ${shade}`}>
            It sounds like this. Touch it.
          </p>
        )}
        {/* THE LAUNCHPAD — a hardware grid, up BEFORE the first note (an idle
            tap starts the song). While it sounds, every lit pad THROBS at the
            song's own tempo; tap = that layer gone, instantly, tails and all;
            tap again = back mid-note. Re-keyed per song so a fresh wall rises
            in with every hand-off. */}
        {layersUi.length > 0 && (
          <div
            key={`pads:${playingId ?? "idle"}`}
            className="grid w-full max-w-md grid-cols-3 gap-2.5 sm:grid-cols-4"
          >
            {layersUi.map((l, i) => (
              <button
                key={l.name}
                onClick={() =>
                  isPlaying ? toggleLayer(l.name) : void onPlay(current)
                }
                aria-pressed={isPlaying ? !offNames.has(l.name) : undefined}
                className={`animate-rise flex h-16 select-none items-center justify-center rounded-xl px-2 text-center text-[12.5px] font-semibold leading-tight tracking-tight backdrop-blur-xl transition-all duration-150 active:scale-[.88] ${
                  !isPlaying
                    ? "border border-white/[0.14] bg-white/[0.05] text-white/75 hover:border-accent/50 hover:text-white"
                    : offNames.has(l.name)
                      ? "border border-white/[0.09] bg-black/45 text-white/40"
                      : `${sounding ? "pad-pulse" : "pad-lit"} border border-accent/40 bg-gradient-to-br from-[#ff63c1]/30 via-accent/20 to-[#b3126f]/30 text-white`
                }`}
                style={
                  {
                    "--i": i,
                    "--beat": `${60 / ((current.plan?.bpm || 120) * tempo)}s`,
                  } as React.CSSProperties
                }
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
        {isPlaying && (
          <>
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
            {/* THE LIGHT — three lights per piece, glossy drops of colour; the
                lit one is what the room is wearing right now. */}
            {looks.length > 0 && (
              <div className="mt-3.5 flex items-center justify-center gap-3.5">
                {looks.map((l, i) => (
                  <button
                    key={l.name}
                    title={l.name}
                    aria-label={`Look: ${l.name}`}
                    aria-pressed={lookIdx === i}
                    onClick={() => applyLook(i)}
                    className={`h-6 w-6 rounded-full shadow-[inset_0_2px_3px_rgba(255,255,255,.55),inset_0_-2px_4px_rgba(0,0,0,.45),0_2px_10px_rgba(0,0,0,.5)] transition active:scale-90 ${
                      lookIdx === i
                        ? "scale-110 ring-2 ring-accent/80 ring-offset-2 ring-offset-black/60"
                        : "ring-1 ring-white/25 hover:scale-105 hover:ring-white/60"
                    }`}
                    style={{ background: l.tint }}
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
