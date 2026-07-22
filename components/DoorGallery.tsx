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
  requestSongRebuild,
  setExplicitVisualsDrive,
  setLiveCps,
  setLivePerf,
  stop,
} from "@/lib/strudel-client";
import {
  destroyDoorVisual,
  doorHue,
  pieceFor,
  pulseDoorVisual,
  reseedDoorVisual,
  seedFrom,
  setDoorEnergy,
  setDoorHue,
  setDoorRush,
  showDoorVisual,
} from "@/lib/door-visuals";
import {
  layerAppendPos,
  layerSignature,
  stripDuckFamily,
} from "@/lib/reverb-orbits";
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
// Human words, lit BY DEFAULT where the song wants them — the room opens with
// its echoes, drive and width already in the mix; you take them OUT.
const FX_LABEL: Record<FxKey, string> = {
  dark: "Darker",
  bright: "Brighter",
  echo: "Echoes",
  punch: "Harder",
  space: "Wider",
};
const FX_DEFAULT: Record<FxKey, boolean> = {
  dark: false,
  bright: false,
  echo: true,
  punch: true,
  space: true,
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
type DoorEntry = PlayEntry & {
  layersBySection: Record<string, DoorLayer[]>;
  /** WHOLE-SONG gating truth: every orbit the song can sound on → the layer
   *  name that owns it. A kill by name silences every orbit wearing it, in
   *  every section and every break. */
  orbitNames: [number, string][];
};

const LAYER_ORBIT_BASE = 10;

// Button names people FEEL — the role in the room, not the sample id.
const SOUND_NAMES: Record<string, string> = {
  bd: "Kick",
  sd: "Snare",
  hh: "Hats",
  ch: "Hats",
  oh: "Open hats",
  cp: "Claps",
  cr: "Crash",
  rd: "Ride",
  rim: "Rim",
  sh: "Shaker",
  lt: "Toms",
  mt: "Toms",
  ht: "Toms",
  cb: "Cowbell",
  white: "Riser",
  pink: "Air",
  brown: "Tide",
  sine: "Sub",
  sawtooth: "Saws",
  square: "Stabs",
  triangle: "Arp",
  gm_lead_2_sawtooth: "Anthem",
  gm_synth_bass_1: "Bassline",
  gm_pad_halo: "Pads",
  gm_pad_warm: "Warmth",
  gm_pad_new_age: "Pads",
  gm_fx_crystal: "Sparkle",
  gm_choir_aahs: "Choir",
};
function layerName(code: string): string {
  const m = code.match(/\b(?:s|sound)\(\s*["'`]([^"'`]*)["'`]/);
  const tok = m?.[1]?.toLowerCase().split(/[^a-z0-9_]+/).find(Boolean) ?? "";
  if (!tok) return "Layer";
  if (SOUND_NAMES[tok]) return SOUND_NAMES[tok];
  const pretty = tok.replace(/^gm_/, "").replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Re-bus a WHOLE SONG so every layer is gateable by NAME: one orbit per
 *  distinct (layer name, effect signature) pair across all sections — the
 *  same crackle law as the global re-bus (an orbit never carries two reverb
 *  setups), but grouped so a pad kill can silence exactly its layer wherever
 *  it appears (loops, breaks, unfolds). The arrange build keeps these orbits
 *  (playSong keepOrbits). Meta comment blocks stay untouched. */
function rebusSong(sections: { id: string; code: string }[]): {
  codes: Map<string, string>;
  layersBySection: Record<string, DoorLayer[]>;
  orbitNames: [number, string][];
} {
  const reg = new Map<string, number>(); // name - signature → orbit
  const orbitName = new Map<number, string>();
  const codes = new Map<string, string>();
  const layersBySection: Record<string, DoorLayer[]> = {};
  for (const sec of sections) {
    const code = sec.code ?? "";
    const metaAt = code.search(
      /\/\*\s*@(?:hydra|controls|vcontrols|vlooks|swaps|edits)\b/,
    );
    const musicEnd = metaAt >= 0 ? metaAt : code.length;
    const tail = code.slice(musicEnd);
    const music = code.slice(0, musicEnd);
    const starts: number[] = [];
    for (const m of music.matchAll(/\$:/g)) starts.push(m.index ?? 0);
    if (!starts.length) {
      codes.set(sec.id, code);
      layersBySection[sec.id] = [];
      continue;
    }
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
      const name = n > 1 ? `${base} ${n}` : base;
      const key = `${name}-${layerSignature(layer)}`;
      let orbit = reg.get(key);
      if (orbit === undefined) {
        orbit = LAYER_ORBIT_BASE + reg.size;
        reg.set(key, orbit);
        orbitName.set(orbit, name);
      }
      const at = layerAppendPos(layer);
      out.push(`${layer.slice(0, at)}.orbit(${orbit})${layer.slice(at)}`);
      if (!layers.some((l) => l.name === name)) layers.push({ orbit, name });
    }
    codes.set(sec.id, out.join("") + tail);
    layersBySection[sec.id] = layers;
  }
  return { codes, layersBySection, orbitNames: [...orbitName.entries()] };
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
  // WHOLE-SONG orbit → layer name (the gating truth; sections/breaks share it).
  const orbitNamesRef = useRef<Map<number, string>>(new Map());
  const [fx, setFx] = useState<Record<FxKey, boolean>>({ ...FX_DEFAULT });
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
  const codeCache = useRef(new Map<string, DoorEntry>());
  // SECTION CHANGES REARRANGE THE SKY, never jump-cut it: layers that left the
  // mix fold away (box-leave) while the arriving ones bloom in (box-enter).
  const [shownLayers, setShownLayers] = useState<
    { l: DoorLayer; leaving: boolean }[]
  >([]);
  useEffect(() => {
    setShownLayers((prev) => {
      const cur = new Map(layersUi.map((l) => [l.name, l]));
      const kept = prev
        .filter((x) => cur.has(x.l.name) || !x.leaving)
        .map((x) =>
          cur.has(x.l.name)
            ? { l: cur.get(x.l.name)!, leaving: false }
            : { ...x, leaving: true },
        );
      const seen = new Set(kept.map((x) => x.l.name));
      const added = layersUi
        .filter((l) => !seen.has(l.name))
        .map((l) => ({ l, leaving: false }));
      return [...kept, ...added];
    });
    const t = setTimeout(
      () => setShownLayers((prev) => prev.filter((x) => !x.leaving)),
      460,
    );
    return () => clearTimeout(t);
  }, [layersUi]);

  const playingId = useNowPlayingValue(
    (s) => (s?.kind === "song" ? s.id : null),
    null,
  );
  const paused = useNowPlayingValue(
    (s) => s?.kind === "song" && !!s.paused,
    false,
  );
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
    const { codes, layersBySection, orbitNames } = rebusSong(built.sections);
    const sections = built.sections.map((sec) => ({
      ...sec,
      code: codes.get(sec.id) ?? sec.code,
    }));
    entry = { ...built, sections, layersBySection, orbitNames };
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
        setLayersUi(e.layersBySection[e.sections[0].id] ?? []);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section changes build fresh orbit buses at gain 1 — re-assert the kills on
  // a light tick (applyOrbitGains skips buses already at target; Sets' law).
  const gainFor = (orbit: number): number | undefined => {
    const name = orbitNamesRef.current.get(orbit);
    if (name === undefined) return undefined;
    if (cutRef.current) return 0; // the hold owns every bus
    return offRef.current.has(name) ? 0 : 1;
  };
  useEffect(() => {
    if (!playingId) return;
    const t = setInterval(() => applyOrbitGains(gainFor), 200);
    return () => clearInterval(t);
     
  }, [playingId]);

  useEffect(() => {
    // A new song brings its own default light and a fresh launchpad.
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

  async function onPlay(s: DoorSong) {
    if (playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    setLoadingPlay(true);
    setError(false);
    if (nowPlaying()) dockStop(); // CUT at the touch
    try {
      const entry = await entryFor(s);
      if (!entry) {
        setError(true);
        return;
      }
      // The room changes LIGHT at the touch — the new song's piece.
      void showDoorVisual(pieceFor(s), { bpm: s.plan?.bpm, look: 0 });
      ensurePerfFx();
      setLivePerf(perfValues(fxRef.current));
      const { labels } = entry;
      const cached = entry;
      canonRef.current = {
        first: entry.sections[0].id,
        last: entry.sections[entry.sections.length - 1].id,
      };
      const list = entry.sections;
      journeyRef.current = { sawLast: false, advancing: false };
      curSectionIdRef.current = list[0].id;
      orbitNamesRef.current = new Map(entry.orbitNames);
      if (!list[0].id.startsWith("break:"))
        setLayersUi(cached.layersBySection[list[0].id] ?? []);
      await playSong(list, {
        owner: s.id,
        // The door bussed every layer itself — the arrange build keeps them,
        // so a pad kill gates exactly its layer (see rebusSong).
        keepOrbits: true,
        // The KEY, applied at every (re)build — a live change lands via
        // requestSongRebuild as a seamless in-place swap, never a restart.
        decorate: (code) =>
          keyRef.current ? transposePitched(code, keyRef.current) : code,
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null });
          if (!id) return;
          curSectionIdRef.current = id;
          // The pads follow the sounding section; a one-bar break keeps the
          // loop's pads on screen (its gates share the song-wide orbit map).
          if (!id.startsWith("break:"))
            setLayersUi(cached.layersBySection[id] ?? []);
          // Every boundary RESHAPES the piece — new cell counts, new spin,
          // same soul. The room keeps moving with the music.
          reseedDoorVisual(seedFrom(id));
          // THE HAND-OFF: wrap detected → this downbeat belongs to the next
          // song.
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
        // exactly once. The room keeps MOVING (new picture, new pads).
        repeatsFor: () => 1,
        effectsFor: () => cached.effects,
        overlaysFor: () => cached.overlays,
        // THE DOOR NEVER ENDS — no ending-stop, the arc wraps forever.
        ending: null,
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

  // THE FIRST TOUCH IS THE ON SWITCH — no play button exists. Any gesture on
  // the page ignites the room; the sign-in form and links keep their meaning.
  useEffect(() => {
    const onFirst = (e: PointerEvent) => {
      if (playingId || loadingPlay) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("form, input, textarea, select, a")) return;
      if (current) void onPlay(current);
    };
    window.addEventListener("pointerdown", onFirst);
    return () => window.removeEventListener("pointerdown", onFirst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, loadingPlay, at, songs]);

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
    if (!isPlaying) return; // the touch itself just started the room
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
    if (on && !isPlaying) return; // the touch itself just started the room
    if (cutRef.current === on) return;
    cutRef.current = on; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(gainFor);
    setDoorRush(on);
    setCut(on);
  }


  /** Take the key SOMEWHERE — a destination, not an increment. Decorate
   *  carries the transpose into a seamless in-place rebuild: the transport
   *  never stops, nothing re-enters. Tap the lit square = come home. */
  function keyTo(v: number) {
    if (!isPlaying) return; // the touch itself just started the room
    if (v === keyRef.current) return;
    keyRef.current = v;
    setKeyUi(v);
    pulseDoorVisual();
    requestSongRebuild();
  }

  /** Take the tempo SOMEWHERE — it GLIDES there like a DJ riding the pitch
   *  fader, live on the scheduler the whole way. Tap the lit square = glide
   *  home. */
  const glideRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function glideTempo(target: number) {
    if (!isPlaying || !current) return; // the touch itself just started the room
    if (glideRef.current) clearInterval(glideRef.current);
    pulseDoorVisual();
    const song = current;
    glideRef.current = setInterval(() => {
      const d = target - tempoRef.current;
      const step = Math.sign(d) * Math.min(Math.abs(d), 0.012);
      const v = tempoRef.current + step;
      tempoRef.current = v;
      setTempo(v);
      setLiveCps(cpsFor(song, v));
      if (Math.abs(target - v) < 0.001 && glideRef.current) {
        clearInterval(glideRef.current);
        glideRef.current = null;
      }
    }, 60);
  }

  // HOLD-TO-TURN — the colour keeps turning while your finger is down.
  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function stopSweep() {
    if (sweepRef.current) clearInterval(sweepRef.current);
    sweepRef.current = null;
  }
  function startSweep(fn: () => void) {
    if (!isPlaying) return; // the touch itself just started the room
    stopSweep();
    fn();
    sweepRef.current = setInterval(fn, 80);
  }
  function hueStep() {
    setDoorHue(doorHue() + 0.012); // live uniform — the colour just turns
  }


  if (!songs.length || !current) return null;

  // Over a full-bright picture, floating text needs its own shadow to hold.
  const shade = "[text-shadow:0_1px_14px_rgba(0,0,0,.9)]";
  const beat = `${60 / ((current.plan?.bpm || 120) * tempo)}s`;
  const bpmNow = `${Math.round((current.plan?.bpm || 120) * tempo)} BPM`;

  // THE CONSTELLATION — every control is a SQUARE, scattered across the whole
  // page, each drifting on its own small orbit. One system: sounds, effects,
  // Cut, the inks, Hue, tempo, key — all boxes, all live. A new song deals a
  // fresh sky (deterministic shuffle by song id).
  interface Box {
    key: string;
    label: string;
    sub?: string;
    on: boolean;
    leaving?: boolean;
    onClick?: () => void;
    hold?: { down: () => void; up: () => void };
  }
  const layerBoxes: Box[] = shownLayers.map(({ l, leaving }) => ({
    key: `L:${l.name}`,
    label: l.name,
    leaving,
    on: isPlaying && !leaving && !offNames.has(l.name),
    onClick: () => (isPlaying ? toggleLayer(l.name) : void onPlay(current)),
  }));
  const controlBoxes: Box[] = [
    ...FX_KEYS.map((k) => ({
      key: `F:${k}`,
      label: FX_LABEL[k],
      on: fx[k],
      onClick: () => toggleFx(k),
    })),
    {
      key: "cut",
      label: "Cut",
      sub: "hold me",
      on: cut,
      hold: { down: () => holdCut(true), up: () => holdCut(false) },
    },
    {
      key: "hue",
      label: "Colour",
      sub: "hold me",
      on: false,
      hold: { down: () => startSweep(hueStep), up: stopSweep },
    },
    // DESTINATIONS, not increments: one touch takes you there (the tempo
    // GLIDES like a pitch fader) and the SAME square brings you home.
    {
      key: "t+",
      label: "Faster",
      sub: tempo > 1.05 ? bpmNow : "take us up",
      on: tempo > 1.05,
      onClick: () => glideTempo(tempo > 1.05 ? 1 : 1.18),
    },
    {
      key: "k+",
      label: "Higher",
      sub: keyUi > 0 ? "up two keys" : "lift the key",
      on: keyUi > 0,
      onClick: () => keyTo(keyUi > 0 ? 0 : 2),
    },
    {
      key: "k-",
      label: "Lower",
      sub: keyUi < 0 ? "down two keys" : "sink the key",
      on: keyUi < 0,
      onClick: () => keyTo(keyUi < 0 ? 0 : -2),
    },
  ];
  const box = (b: Box, i: number) => (
    <button
      key={b.key}
      onClick={b.onClick}
      onPointerDown={b.hold ? () => b.hold!.down() : undefined}
      onPointerUp={b.hold ? () => b.hold!.up() : undefined}
      onPointerLeave={b.hold ? () => b.hold!.up() : undefined}
      onPointerCancel={b.hold ? () => b.hold!.up() : undefined}
      onContextMenu={b.hold ? (e) => e.preventDefault() : undefined}
      aria-pressed={b.on}
      aria-label={b.label}
      className={`flex h-[3.75rem] w-[3.75rem] select-none flex-col items-center justify-center rounded-[1.15rem] text-center text-[10.5px] font-semibold leading-tight tracking-tight backdrop-blur-xl transition-all duration-150 active:scale-[.88] sm:h-24 sm:w-24 sm:rounded-[1.35rem] sm:text-[13px] ${
        b.leaving ? "box-leave" : "box-enter"
      } ${
        b.on
          ? `${sounding ? "pad-pulse" : "pad-lit"} border border-accent/40 bg-gradient-to-br from-[#ff63c1]/30 via-accent/20 to-[#b3126f]/30 text-white`
          : "border border-white/[0.12] bg-black/50 text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_10px_28px_-14px_rgba(0,0,0,.9)] hover:border-accent/45 hover:text-white"
      }`}
      style={{ "--i": i, "--beat": beat } as React.CSSProperties}
    >
      <span className="px-1.5">{b.label}</span>
      {b.sub && (
        <span className="mt-0.5 text-[8.5px] font-medium tabular-nums text-white/70 sm:text-[10px]">
          {b.sub}
        </span>
      )}
    </button>
  );

  // ONE calm, centred grid — a home screen, not a storm. The sounds above,
  // the room below, generous air, and motion ONLY when it means something:
  // the beat-throb, the bloom of an arriving layer, the fold of a leaving one.
  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      <div className={`mb-3 flex h-7 select-none items-center sm:mb-5 ${shade}`}>
        {loadingPlay ? (
          <p className="text-[17px] text-foreground/90">
            <span className="shimmer-text">Coming alive…</span>
          </p>
        ) : !isPlaying ? (
          <p className="text-[17px] text-foreground/90">Touch anything.</p>
        ) : null}
      </div>
      {/* THE SOUNDS — every layer of the sounding loop */}
      <div
        key={`sounds:${playingId ?? "idle"}`}
        className="flex w-full flex-wrap justify-center gap-2 sm:gap-3"
      >
        {layerBoxes.map(box)}
      </div>
      {/* THE ROOM — colour, physics, the cut */}
      <div
        key={`room:${playingId ?? "idle"}`}
        className="mt-4 flex w-full flex-wrap justify-center gap-2 sm:mt-6 sm:gap-3"
      >
        {controlBoxes.map((b, i) => box(b, i + layerBoxes.length))}
      </div>
      {error && (
        <p className="mt-4 text-[13px] text-red-400">
          The room stumbled — touch it again.
        </p>
      )}
    </div>
  );
}
