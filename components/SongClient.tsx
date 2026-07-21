"use client";

import Link from "next/link";
import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { PartRow, SongRow } from "@/lib/songs";
import type { SongArrangement, SongFx, SweepControl } from "@/lib/arrange";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import {
  BREAK_KNOBS,
  BREAK_MOVES,
  breakKnobDefault,
  breakMoveOf,
  type BreakKnobField,
  type BreakOverlay,
} from "@/lib/breaks-catalog";
import ArrangeSurface from "@/components/ArrangeSurface";
import {
  clearNowPlaying,
  dockStop,
  nowPlaying,
  publishNowPlaying,
  updateNowPlaying,
} from "@/lib/now-playing";
import { isOwnSession, useNowPlayingValue } from "@/lib/use-now-playing";
import {
  applyOrbitGains,
  currentSectionId,
  isSongPlaying,
  refreshArrangement,
  isMobileDevice,
  liveUpdate,
  rebindSong,
  warmSounds,
  loopCycles,
  pausePlayback,
  playSong,
  startIdleVisual,
  resumePlayback,
  preloadSamples,
  renderMixToVideo,
  renderSongToWav,
  setHydraErrorSink,
  setStrudelErrorSink,
  setVisuals,
  stop,
  teardownVisuals,
  updateVisuals,
  videoExt,
  warmEngine,
} from "@/lib/strudel-client";
import {
  beatsPerBar,
  transformForPlayback,
  type MixSound,
} from "@/lib/playback";
import { extractHydra, hasHydra, stripHydraBlock } from "@/lib/hydra-embed";
import {
  activeSwapSound,
  applySwap,
  bankSupports,
  DRUM_KITS_OFFERED,
  drumKitName,
  getLayerMethodArg,
  setLayerInstrument,
  setLayerMethodArg,
  parseControls,
  parseSwaps,
  parseVControls,
  parseVLooks,
  prettySoundName,
  setControlValue,
  stripMetaBlocks,
  type SoundSwap,
} from "@/lib/controls";
import { computeLoopBars } from "@/lib/loop-length";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { isKnownSound, isKnownBank } from "@/lib/sound-palette";
import type { LoopTrack, TrackControl, TrackPill } from "@/lib/score";

type Song = SongRow;
type Part = PartRow;

const POLL_MS = 2000;

/** Per-`$:`-line orbit numbers of TRANSFORMED code. Orbits are (re)assigned at
 *  transformForPlayback (assignReverbOrbits), so this must read the transformed
 *  string, never the stored one. null = the line names no orbit (default bus). */
function layerOrbitsOf(transformed: string): (number | null)[] {
  return transformed
    .split("\n")
    .filter((l) => l.trim().startsWith("$:"))
    .map((l) => {
      const m = [...l.matchAll(/\.orbit\(\s*(\d+)\s*\)/g)];
      return m.length ? Number(m[m.length - 1][1]) : null;
    });
}

/** SOLO (headphones) on TRANSFORMED code, GATE-AWARE (2026-07-21): the soloed
 *  line plays (any mute `.gain(0)` stripped so it's audible even while muted);
 *  a silenced layer sharing the soloed layer's own orbit (or naming none) is
 *  muted IN CODE — every OTHER orbit dies at the bus gate (applyOrbitGains,
 *  the Sets deck-kill: ~10ms clickless glide that silences ringing tails too),
 *  and because those voices keep rendering under a closed gate, releasing the
 *  solo brings that music back MID-NOTE, instantly. Same structure/transport
 *  as the full loop, so it hot-swaps live (no restart). */
function soloLiveCode(transformed: string, layer: number): string {
  const orbs = layerOrbitsOf(transformed);
  const keep = orbs[layer] ?? null;
  let idx = -1;
  return transformed
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("$:")) return line;
      idx++;
      if (idx === layer) return line.replace(/\.gain\(\s*0(?:\.0+)?\s*\)/g, "");
      const o = orbs[idx];
      return o == null || o === keep ? `${line}.gain(0)` : line;
    })
    .join("\n");
}

// Canned cycling status while a loop builds — the FALLBACK until the live,
// model-narrated line lands (part.status_message). Mirrors what the one-shot
// pipeline actually does: compose → check every layer → wire up the tweaks.
const COMPOSE_STEPS = [
  "Setting the tempo…",
  "Laying the foundation…",
  "Finding the sound…",
  "Stacking the groove…",
  "Composing layer by layer…",
];

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Compact length for the meta line — it sits among four other facts, so the
// word "seconds" is clutter, especially on phones. Repeats can stretch a song
// well past a minute, where "184s" stops being readable → switch to m:ss.
function fmtDuration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  return s < 60 ? `${s}s` : fmtTime(s);
}

// Transpose is the real pitch control; the "key" is just its label. Shift the
// key name by N semitones so one control (transpose) does both.
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E",
};
function transposeKey(key: string, semis: number): string {
  if (!semis) return key;
  const m = key.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return key;
  let tonic = m[1].toUpperCase() + (m[2] || "");
  tonic = FLAT_TO_SHARP[tonic] || tonic;
  const i = SHARP.indexOf(tonic);
  if (i < 0) return key;
  return SHARP[(((i + semis) % 12) + 12) % 12] + m[3];
}

/** The bpm a loop was composed at, read from its setcpm(bpm/4). */
function origBpmOf(parts: Part[], fallback: number, beats = 4): number {
  for (const p of parts) {
    const m = p.strudel?.match(
      /setcpm\(\s*([0-9.]+)\s*(?:\/\s*([0-9.]+))?\s*\)/,
    );
    if (m) {
      const cpm = Number(m[1]) / (m[2] ? Number(m[2]) : 1);
      // setcpm(bpm/beats) → bpm = cpm × beats (beats = 4 for 4/4).
      if (Number.isFinite(cpm) && cpm > 0) return Math.round(cpm * beats);
    }
  }
  return fallback;
}

export default function SongClient({
  songId,
  initialSong,
  initialParts,
}: {
  songId: string;
  initialSong: Song;
  initialParts: Part[];
}) {
  // Code arrives SEALED from the server (lib/seal.ts) — open it once on entry;
  // openDeep is pass-through for anything unsealed, so this is always safe.
  const [song, setSong] = useState<Song>(() => openDeep(initialSong));
  const [parts, setParts] = useState<Part[]>(() => openDeep(initialParts));
  const [playing, setPlaying] = useState<string | null>(null);
  // The loop the bottom command bar edits — you SELECT a loop (tap it) and the field applies to it.
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  // Which blueprint's panel is open — opening it also LIGHTS its loops, so
  // lineage is always one tap away (and selecting a loop lights its blueprint).
  const [openBlueprintId, setOpenBlueprintId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const kbInset = useKeyboardInset(); // lifts the bottom command bar over the phone keyboard
  // PAUSED, not stopped: the transport is frozen in place (audio clock
  // suspended, visuals + playhead held) and play continues the SAME phrase —
  // these are loops; restarting from bar 1 on every tap is pointless.
  //
  // It is NOT this page's opinion. The engine pauses ITSELF when the phone
  // backgrounds (setAutoPauseSink) and the OS lock screen pauses it too — both
  // land in the now-playing store, so a local copy drifted and the loop card
  // sat showing ⏸ over silence. Read the app's answer, every render. A PRIMITIVE
  // selector, so the per-section `sectionLabel` tick can't re-render this tree
  // (it walks the whole song, on the thread the Strudel scheduler ticks on).
  const paused = useNowPlayingValue(
    (s) => isOwnSession(s, "song", songId) && !!s?.paused,
    false,
  );
  /** THIS song's music is the music the app is carrying. */
  const owns = useNowPlayingValue((s) => isOwnSession(s, "song", songId), false);
  // A MIX (multi-section song) plays its sections in sequence; `mixActive` tracks
  // that the whole-mix sequencer is running (vs a single-section preview).
  const [mixActive, setMixActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialSong.title);
  const [exportProg, setExportProg] = useState<{
    elapsed: number;
    total: number;
  } | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const exporting = exportProg !== null;
  // The last loop the user played — so the spacebar can RESUME it after a stop.
  const lastPlayedRef = useRef<string | null>(null);

  // THE TRANSPORT, in one place: hold and release the music AND tell the app, so
  // the dock, the OS lock screen and every card agree. (Never call pausePlayback
  // /resumePlayback bare — that's how the descriptor drifted from the engine.)
  const pausedAtWallRef = useRef<number | null>(null);
  const holdMix = () => {
    pausedAtWallRef.current = performance.now();
    pausePlayback();
    updateNowPlaying({ paused: true });
  };
  const releaseMix = async () => {
    await resumePlayback();
    // keep the playhead's wall-clock phase honest: the pause didn't advance
    // the music, so it must not advance the sweep either
    if (pausedAtWallRef.current != null) {
      const held = performance.now() - pausedAtWallRef.current;
      pausedAtWallRef.current = null;
      setPlayStart((prev) => (prev > 0 ? prev + held : prev));
    }
    updateNowPlaying({ paused: false });
  };

  // Live playhead. The progress bar is a CSS compositor animation (scaleX over the
  // loop length) so it moves at a perfectly constant speed on the GPU — no JS tick,
  // no main-thread jank. `playKey` bumps on every play to RESTART the animation from
  // 0; `sweepDelayRef` holds a negative animation-delay that phase-aligns the sweep
  // to where the audio actually is at play time (matters only on a hot-swap — a
  // fresh play starts the scheduler at cycle 0, so the delay is ~0).
  const [playStart, setPlayStart] = useState(0);
  const sweepDelayRef = useRef(0);

  const plan = song.plan as {
    summary?: string;
    bpm?: number;
    key?: string;
    genre?: string;
    transpose?: number;
    timeSignature?: string;
    /** One-bar AI easings between adjacent loops, keyed by the leading loop's
     *  part id. Options composed once per gap; `chosen` = which one it wears. */
    breaks?: Record<
      string,
      { options: { label: string; strudel: string; strudelMobile?: string | null }[]; chosen: number | null }
    >;
    /** Song-wide SOUND dials — the mix-bus performance layer (lib/playback). */
    sound?: MixSound;
    /** Per-loop repeat latch, keyed by part id. JSON-safe encoding of the live
     *  holdCycles map: -1 = forever (Infinity), 2/4/8 = count, key absent = off. */
    holdCycles?: Record<string, number>;
    /** The model-authored song arrangement (lib/arrange-plan) — per-section
     *  layer moves/sweeps/overlays + the ending, rendered at play time. */
    arrangement?: SongArrangement | null;
  };
  const bpm = plan?.bpm || 120;
  const transpose = plan?.transpose || 0;
  const timeSignature = plan?.timeSignature || "4/4";
  // 1 bar = beats × 60 / bpm — honours the meter (4 beats for 4/4).
  const barSeconds = (beatsPerBar(timeSignature) * 60) / bpm;
  // Mix-bus dials live in a REF too, so the mix sequencer's decorate() always
  // reads the CURRENT values (sections start later than the closure was made).
  const soundRef = useRef<MixSound | undefined>(plan?.sound);
  soundRef.current = plan?.sound;
  // The mix sequencer's decorate()/secondsFor() run LATER than the closure that made
  // them (every loop repeat re-evaluates), so they must read tempo/transpose/meter LIVE
  // from refs — not the values captured at play-start. Otherwise a tempo change is heard
  // for one cycle (the live hot-swap) then REVERTS to the old tempo when the loop repeats.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const transposeRef = useRef(transpose);
  transposeRef.current = transpose;
  const tsRef = useRef(timeSignature);
  tsRef.current = timeSignature;
  // The UNSAVED live-preview tempo/transpose (panel open, dragging) — null when none.
  // decorate()/secondsFor() prefer it so LOOP REPEATS keep the preview too, not just the
  // first cycle; cleared on Cancel (onLive({})) and on Save (the plan then carries it).
  const livePreviewRef = useRef<{ bpm?: number; transpose?: number } | null>(null);
  const sound = plan?.sound;
  // Parts in a ref for the same reason: each mix section re-reads its loop's
  // CURRENT code as it starts, so knob/swap/style changes made mid-mix carry
  // into every later section (not just the one playing when you moved them).
  const partsRef = useRef(parts);
  partsRef.current = parts;
  // Breaks in a ref too: the mix sequencer re-derives its section list LIVE each step (so
  // toggling/re-rolling/removing a break applies mid-play without a restart), and must read
  // the CURRENT chosen breaks, not the value closed over at play-start. chooseBreak writes
  // this synchronously (state is async). Kept in sync on every render + server reconcile.
  const breaksRef = useRef(plan?.breaks);
  breaksRef.current = plan?.breaks;
  // The model-authored song arrangement (plan.arrangement) in a ref for the same
  // reason: an arrange sweep can land mid-play (poll) and the next section
  // boundary should pick it up.
  const arrangementRef = useRef(plan?.arrangement);
  arrangementRef.current = plan?.arrangement;
  // Song-level EFFECTS (chapters era, plan.effects) — ref-read so the engine's
  // rebuilds always see the latest values (a knob ride lands next pass).
  const effectsRef = useRef<SongFx[] | undefined>(
    (plan as { effects?: SongFx[] } | undefined)?.effects,
  );
  effectsRef.current = (plan as { effects?: SongFx[] } | undefined)?.effects;
  // BREAK OVERLAYS (plan.overlays) — same ref-read contract as effects.
  const overlaysRef = useRef<BreakOverlay[] | undefined>(
    (plan as { overlays?: BreakOverlay[] } | undefined)?.overlays,
  );
  overlaysRef.current = (plan as { overlays?: BreakOverlay[] } | undefined)?.overlays;
  // A freshly AUTHORED effect must be HEARD the moment the poll lands it, even
  // mid-loop — the engine's structure watcher fingerprints section code only,
  // and effects live outside it. Structural print (ids · anchors · param) —
  // knob rides keep their own throttled poke in slideFx.
  const fxArrivalPrint =
    (effectsRef.current ?? [])
      .map((e) => `${e.id}|${e.param}|${e.fromId}|${e.toId}|${e.curve}`)
      .join(",") +
    ";" +
    (overlaysRef.current ?? [])
      .map((o) => `${o.id}|${o.tpl}|${o.gain}|${o.fromId}|${o.toId}`)
      .join(",");
  const fxHeardRef = useRef(fxArrivalPrint);
  useEffect(() => {
    if (fxArrivalPrint === fxHeardRef.current) return;
    fxHeardRef.current = fxArrivalPrint;
    // in-place re-eval, cycle position kept — the glide simply starts sounding
    refreshArrangement();
  }, [fxArrivalPrint]);
  // SOLO (headphones): which layer is isolated (everything else muted). A live overlay on
  // normal playback — NOT a separate transport — so toggling it never restarts the loop.
  // The ref lets the mix sequencer's decorate() apply it on every re-eval.
  const [soloed, setSoloed] = useState<{ partId: string; layer: number } | null>(null);
  const soloedRef = useRef(soloed);
  soloedRef.current = soloed;
  // ── LAYER GATES (2026-07-21, the user: solo/mute must be IMMEDIATE) ────────
  // A code rewrite alone silences only FUTURE events — voices already ringing
  // (a pad's 3s release, an 8s room tail) played on for seconds and read as
  // "the button doesn't work". The orbit kills (applyOrbitGains — the Sets
  // deck machinery, engine-side ~10ms clickless glide) close the whole bus NOW,
  // tails included; releasing them brings still-rendering music back mid-note.
  // One gate stands at a time, scoped to ONE part; the mix walking to another
  // section always releases it (orbit numbers repeat across sections).
  const layerGateRef = useRef<{ partId: string; orbits: number[] } | null>(null);
  function releaseLayerGates() {
    const g = layerGateRef.current;
    if (!g) return;
    layerGateRef.current = null;
    applyOrbitGains((o) => (g.orbits.includes(o) ? 1 : undefined));
  }
  /** Close the buses the current solo/mute state wants silent on part `p` —
   *  solo: every orbit except the soloed layer's own; no solo: orbits owned
   *  EXCLUSIVELY by muted layers. Reopens anything previously gated that the
   *  new state keeps. `transformed` saves a re-transform when the caller has it. */
  function syncLayerGates(p: Part, transformed?: string) {
    if (exporting || !p.strudel?.trim()) return;
    const t =
      transformed ??
      transformForPlayback(playbackCode(p), { transpose, bpm, timeSignature, sound });
    const orbs = layerOrbitsOf(t);
    const solo = soloedRef.current;
    let want: number[];
    if (solo?.partId === p.id) {
      const keep = orbs[solo.layer] ?? null;
      want = [...new Set(orbs.filter((o): o is number => o != null && o !== keep))];
    } else {
      const tracks = p.tracks ?? [];
      const kept = new Set(orbs.filter((o, i) => o != null && !tracks[i]?.muted));
      want = [
        ...new Set(
          orbs.filter((o, i): o is number => o != null && !!tracks[i]?.muted && !kept.has(o)),
        ),
      ];
    }
    const prev = layerGateRef.current;
    const reopen = prev ? prev.orbits.filter((o) => !want.includes(o)) : [];
    layerGateRef.current = want.length ? { partId: p.id, orbits: want } : null;
    if (want.length || reopen.length)
      applyOrbitGains((o) =>
        want.includes(o) ? 0 : reopen.includes(o) ? 1 : undefined,
      );
  }
  // A MUTE's gate is a PULSE, not a stand: once the rebuilt pattern owns the
  // mute (gain(0) events, ~300ms), ringing is dead and the gate's only remaining
  // effect would be collateral — orbit numbers repeat across sections and break
  // overlays, so a standing mute-gate could swallow a fill at the turn. 3s
  // covers the longest pre-rebuild voice tails. Solo gates DO stand (isolation
  // is the point); the [playing] watcher below re-applies them on re-entry.
  const muteGateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function muteGatePulse(p: Part) {
    if (soloedRef.current) return; // a standing solo owns the buses
    syncLayerGates(p);
    if (muteGateTimer.current) clearTimeout(muteGateTimer.current);
    muteGateTimer.current = setTimeout(() => {
      if (!soloedRef.current) releaseLayerGates();
    }, 3000);
  }
  // The mix walked to another section (or stopped): a solo on the NOW-CURRENT
  // part re-arms its gates (wrap-around re-entry); anything else releases —
  // orbit numbers repeat across sections, so a stale gate would mute the wrong
  // music the moment another section (or a break overlay) lands on that bus.
  useEffect(() => {
    const solo = soloedRef.current;
    if (solo && playing === solo.partId) {
      const p = partsRef.current.find((x) => x.id === playing);
      if (p) {
        syncLayerGates(p);
        return;
      }
    }
    releaseLayerGates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ── AUTO SELF-HEAL: rectify a loop that threw a runtime error in the player ──────────────────────
  // The player (lib/strudel-client) reports playback errors (sync build errors + async "sound not
  // found"-style console errors) to the sink we register below. We ask the server to repair the loop
  // (ONE AI call), swap in the fix and hot-reload it. Guarded: at most ONE auto-attempt per loop per
  // session (repairAttemptedRef) and one repair in flight at a time (repairingRef), so a still-broken
  // fix can never loop. On failure we surface it and let the user regenerate.
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const repairingRef = useRef<string | null>(null);
  const repairAttemptedRef = useRef<Set<string>>(new Set());
  async function autoRepairLoop(partId: string, errText: string) {
    if (exporting) return; // the render owns the engine — don't touch it
    if (repairingRef.current) return; // one repair at a time
    if (repairAttemptedRef.current.has(partId)) return; // only auto-fix a given loop once per session
    repairAttemptedRef.current.add(partId);
    repairingRef.current = partId;
    setError(null);
    setRepairMsg("Fixing a playback glitch…");
    try {
      const res = await fetch(`/api/songs/${songId}/parts/${partId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "repair", error: errText }),
      });
      const data = openDeep(
        (await res.json().catch(() => null)) as { repaired?: string | null } | null,
      );
      const repaired = data?.repaired;
      if (repaired) {
        setParts((ps) => ps.map((p) => (p.id === partId ? { ...p, strudel: repaired } : p)));
        // Hot-reload the fix if this loop is the one currently playing.
        if (playing === partId && !paused) {
          const solo = soloedRef.current;
          const t = transformForPlayback(repaired, { transpose, bpm, timeSignature, sound });
          void liveUpdate(solo?.partId === partId ? soloLiveCode(t, solo.layer) : t);
        }
        setRepairMsg(null);
      } else {
        setRepairMsg(null);
        setError("Couldn’t auto-fix this loop — try regenerating it.");
      }
    } catch {
      setRepairMsg(null);
    } finally {
      repairingRef.current = null;
    }
  }
  // The SAME self-heal for the loop's VISUAL (@hydra): the player reports a Hydra render error, we ask
  // the server to repair ONLY the visual (op "repair-visual"), swap it in and re-enable + re-eval the
  // visuals. Guarded the same way; a broken visual only means "no visual", never a broken loop.
  const repairingVisualRef = useRef<string | null>(null);
  const repairAttemptedVisualRef = useRef<Set<string>>(new Set());
  async function autoRepairVisual(partId: string, errText: string) {
    if (exporting) return;
    if (repairingVisualRef.current) return;
    if (repairAttemptedVisualRef.current.has(partId)) return; // once per loop per session
    repairAttemptedVisualRef.current.add(partId);
    repairingVisualRef.current = partId;
    try {
      const res = await fetch(`/api/songs/${songId}/parts/${partId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "repair-visual", error: errText }),
      });
      const data = openDeep(
        (await res.json().catch(() => null)) as { repaired?: string | null } | null,
      );
      const repaired = data?.repaired;
      if (repaired) {
        setParts((ps) => ps.map((p) => (p.id === partId ? { ...p, strudel: repaired } : p)));
        if (playing === partId) {
          setVisuals(true); // the failed render disabled visuals — turn them back on for the fix
          void updateVisuals(repaired);
        }
      }
    } catch {
      /* visuals are cosmetic — swallow */
    } finally {
      repairingVisualRef.current = null;
    }
  }
  // Keep live refs to the handlers so the sinks (registered once) always call the latest closure —
  // updated AFTER render (in an effect) so we never read/write a ref during render.
  const repairHandlerRef = useRef(autoRepairLoop);
  const repairVisualHandlerRef = useRef(autoRepairVisual);
  useEffect(() => {
    repairHandlerRef.current = autoRepairLoop;
    repairVisualHandlerRef.current = autoRepairVisual;
  });
  useEffect(() => {
    setStrudelErrorSink((info) => {
      if (info.partId) void repairHandlerRef.current(info.partId, info.error);
    });
    setHydraErrorSink((info) => {
      if (info.partId) void repairVisualHandlerRef.current(info.partId, info.error);
    });
    return () => {
      setStrudelErrorSink(null);
      setHydraErrorSink(null);
    };
  }, []);

  async function saveTitle() {
    setEditingTitle(false);
    const t = titleDraft.trim() || song.title;
    setTitleDraft(t);
    if (t === song.title) return;
    setSong({ ...song, title: t });
    await fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: t }),
    }).catch(() => {});
  }

  const busy =
    song.status === "generating" || parts.some((p) => p.status === "generating");

  // Grow-the-song: add a part in FRONT or BEHIND. Locking is per-DIRECTION (you can
  // grow both ends at once, but not stack two on the same side) — so it keys off the
  // edge part's status, NOT the global `busy`. `addingBefore/After` cover the brief
  // request round-trip before the new pending part shows up in the poll.
  const [addingBefore, setAddingBefore] = useState(false);
  const [addingAfter, setAddingAfter] = useState(false);
  // The inline "add a loop" composer: an edge ("before"/"after") or an in-between
  // gap ("gap:<prevPartId>") — one open at a time, one prompt field shared.
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [addPrompt, setAddPrompt] = useState("");
  // An in-between insert's request round-trip (gap → shimmer) before the new
  // pending loop arrives via refresh; keyed by the LEADING loop's id.
  const [insertingGap, setInsertingGap] = useState<string | null>(null);
  // BREAKS: which gap's picker is open, and which gap is composing its options.
  const [breakOpen, setBreakOpen] = useState<string | null>(null);
  // The seam's "Effect" picker — holds the id of the loop the glide will BEGIN at.
  const [fxPickerAt, setFxPickerAt] = useState<string | null>(null);
  const [brkPickerAt, setBrkPickerAt] = useState<string | null>(null);
  const [openBrkId, setOpenBrkId] = useState<string | null>(null);
  const [shapeOpen, setShapeOpen] = useState(false);
  // The seam's ONE button, opened — holds prev.id of the gap whose choices show.
  const [gapOpen, setGapOpen] = useState<string | null>(null);
  const [breakBusy, setBreakBusy] = useState<string | null>(null);

  // Open a gap's break picker — composing ITS break first if this gap has never had
  // one (once per gap; it auto-applies the moment it lands; ↻ replaces it). A break
  // is a regenerate-only object — it can't be steered with words (removed 2026-07-13).
  async function openBreaks(prevPart: Part, regenerate = false, prompt?: string) {
    setError(null);
    setBreakOpen(prevPart.id);
    // Already composed + not re-rolling → just open. regenerate = re-roll a FRESH break.
    if (!regenerate && plan?.breaks?.[prevPart.id]?.options?.length) return;
    setBreakBusy(prevPart.id);
    try {
      const res = await fetch(`/api/songs/${songId}/breaks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          afterPartId: prevPart.id,
          regenerate,
          ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
        }),
      });
      const d = openDeep(
        (await res.json().catch(() => ({}))) as {
          set?: { options: { label: string; strudel: string; strudelMobile?: string | null }[]; chosen: number | null };
          error?: string;
        },
      );
      if (!res.ok || !d.set) {
        setError(d.error || "Couldn’t compose breaks for this seam.");
        setBreakOpen(null);
        return;
      }
      const set = d.set;
      setSong((s) => ({
        ...s,
        plan: {
          ...(s.plan as Record<string, unknown>),
          breaks: {
            ...((s.plan as { breaks?: Record<string, unknown> }).breaks ?? {}),
            [prevPart.id]: set,
          },
        } as unknown as Song["plan"],
      }));
    } catch {
      setError("Network error.");
      setBreakOpen(null);
    } finally {
      setBreakBusy(null);
    }
  }

  // Pick which break a gap wears (null = none) — instant, persisted quietly.
  // The picker stays open so you can tap between the options and compare.
  function chooseBreak(fromId: string, choice: number | null) {
    const set = plan?.breaks?.[fromId];
    if (!set) return;
    const nextBreaks = {
      ...(breaksRef.current ?? {}),
      [fromId]: { ...set, chosen: choice },
    };
    breaksRef.current = nextBreaks; // LIVE: the mix re-derives its sections from this NOW
    setSong((s) => ({
      ...s,
      plan: {
        ...(s.plan as Record<string, unknown>),
        breaks: nextBreaks,
      } as unknown as Song["plan"],
    }));
    fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakChoice: { afterPartId: fromId, choice } }),
    }).catch(() => {});
  }
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];
  const isEdgeBusy = (p?: Part) =>
    !!p && (p.status === "pending" || p.status === "generating");
  const frontBusy = addingBefore || isEdgeBusy(firstPart);
  const backBusy = addingAfter || isEdgeBusy(lastPart);

  // Add a loop at an EDGE ("before"/"after") or INTO A GAP ({ position, gapId }) —
  // same request, same composer language; only where it lands differs.
  type AddTarget = "before" | "after" | { position: number; gapId: string };
  async function addPart(target: AddTarget, prompt: string, kind?: "break") {
    const gap = typeof target === "object" ? target : null;
    if (gap ? insertingGap !== null : target === "before" ? frontBusy : backBusy) return;
    if (gap) setInsertingGap(gap.gapId);
    else if (target === "before") setAddingBefore(true);
    else setAddingAfter(true);
    setAddOpen(null); // close the composer; the slot now shows "Composing…"
    setAddPrompt("");
    setError(null);
    try {
      const res = await fetch(`/api/songs/${songId}/part`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          gap
            ? { position: gap.position, prompt: prompt.trim() || undefined, kind }
            : { side: target, prompt: prompt.trim() || undefined, kind },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error || "Couldn’t add a loop.");
      else await refresh(); // pull in the new pending part; polling takes over
    } catch {
      setError("Network error.");
    } finally {
      if (gap) setInsertingGap(null);
      else if (target === "before") setAddingBefore(false);
      else setAddingAfter(false);
    }
  }

  // VISUALS — song-wide: one aesthetic for the whole piece, AUTO-painted during
  // generation (the workflow paints in parallel with the first loop; the poll
  // delivers it and the arrival effect above lights it). This handler is the
  // manual path: the "↻ Repaint" re-roll, and the catch-up paint for songs from
  // before auto-visuals or whose auto-paint failed.
  const [painting, setPainting] = useState(false);
  // THE VISUALS PANEL — the one auxiliary surface under the header (the voice
  // studio RETIRED 2026-07-12 — the voice lives in live sets now; saved takes
  // stay on the server, they just don't play here anymore).
  const [visualsOpen, setVisualsOpen] = useState(false);

  async function paintVisuals(force = false) {
    if (painting) return;
    // ONE visual for the WHOLE song — it's the SAME sketch on every loop so it flows seamlessly
    // from section to section (only its H()-synced state advances), never a different look per
    // part. We generate ONCE (from the first loop with music) and the server writes that same
    // visual onto every part. Paint when forcing a re-roll, or when no loop has a visual yet.
    const withMusic = parts.filter((p) => p.strudel?.trim());
    if (withMusic.length === 0) return;
    if (!force && withMusic.every((p) => hasHydra(p.strudel))) return;
    setPainting(true);
    setError(null);
    try {
      const seed = withMusic[0];
      const res = await fetch(`/api/songs/${songId}/visuals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partId: seed.id }),
      });
      const d = openDeep(
        (await res.json().catch(() => ({}))) as {
          strudel?: string;
          error?: string;
        },
      );
      if (!res.ok || !d.strudel) {
        setError(d.error || "Couldn’t paint visuals — try again.");
      } else {
        // Light the shared visual up IMMEDIATELY (it's identical for every part).
        if (playing) void updateVisuals(d.strudel);
        else void startIdleVisual(d.strudel);
      }
    } catch {
      // Network rejection — surface it instead of leaving an unhandled rejection.
      setError("Couldn’t paint visuals — try again.");
    } finally {
      setPainting(false);
      void refresh(); // re-fetch all parts — now sharing the one visual
    }
  }

  // The unfold is PER LOOP now (each card's Unfold section — Length + Feel +
  // ↻ regenerate). There is no song-wide unfold button. The `unfolded` derived
  // state still lives further down (it drives the post-generation grace poll so
  // the auto-shape draws itself in).

  // The ending capsule's tap: stop ⟷ loop, zero AI. Optimistic — the capsule
  // answers the tap NOW; the PATCH is the fact-write (re-sync on failure).
  async function flipEnding(mode: "stop" | "loop") {
    setSong((s) => {
      const pl = s.plan as { arrangement?: SongArrangement | null } & Record<string, unknown>;
      if (!pl?.arrangement) return s;
      return {
        ...s,
        plan: {
          ...pl,
          arrangement: {
            ...pl.arrangement,
            ending: { ...(pl.arrangement.ending ?? {}), mode },
          },
        } as unknown as Song["plan"],
      };
    });
    try {
      refreshArrangement(); // the playing mix adopts the new ending NOW
      const res = await fetch(`/api/songs/${songId}/arrange`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ending: mode }),
      });
      if (!res.ok) void refresh();
    } catch {
      void refresh();
    }
  }

  // The open composer for the add-a-loop affordances (edges AND in-between gaps) —
  // the SAME pill language as the bottom command bar (one object: chip + borderless
  // field + one morphing button), so the whole app speaks one design.
  const renderComposer = (target: AddTarget) => (
    <>
      {/* tap anywhere outside and the composer folds away */}
      <div
        className="fixed inset-0 z-10"
        onClick={() => {
          setAddOpen(null);
          setAddPrompt("");
        }}
        aria-hidden
      />
      <div className="cmdbar cmdbar-in relative z-20 flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] py-2 pl-2.5 pr-2 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl transition-[border-color,box-shadow] duration-300 focus-within:border-accent/35 focus-within:shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),0_0_44px_-12px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.08)]">
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pl-3 pr-3.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
        <span className="text-[12px] font-medium text-foreground/85">
          {target === "before" ? "New · before" : target === "after" ? "New · after" : "New · between"}
        </span>
      </span>
      <input
        autoFocus
        value={addPrompt}
        onChange={(e) => setAddPrompt(e.target.value)}
        onKeyDown={(e) => {
          // Enter only builds when there's a direction — an empty field must
          // NEVER generate by surprise (the wordless one-tap is the labeled
          // "New loop" / "Extend" segment on the capsule).
          if (e.key === "Enter") {
            e.preventDefault();
            if (addPrompt.trim()) addPart(target, addPrompt);
          } else if (e.key === "Escape") {
            setAddOpen(null);
            setAddPrompt("");
          }
        }}
        placeholder={
          target === "before"
            ? "what leads in?…"
            : target === "after"
              ? "what comes next?…"
              : "what plays here?…"
        }
        className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-foreground placeholder:text-muted/40"
      />
      {/* one button that morphs: quiet ✕ while empty (close, clear — it NEVER
          generates) → gradient ↑ once there's a direction */}
      <button
        type="button"
        onClick={() =>
          addPrompt.trim()
            ? addPart(target, addPrompt)
            : (setAddOpen(null), setAddPrompt(""))
        }
        aria-label={addPrompt.trim() ? "Build the new section" : "Close"}
        className="group/act relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-transform duration-200 hover:scale-[1.06] active:scale-95"
      >
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-all duration-300 ${
            addPrompt.trim()
              ? "scale-100 opacity-100 shadow-[0_8px_24px_-6px_rgba(224,49,156,.85),inset_0_1px_0_rgba(255,255,255,.3)]"
              : "scale-50 opacity-0"
          }`}
        />
        <svg
          className={`absolute transition-all duration-200 ${
            addPrompt.trim() ? "scale-50 opacity-0" : "scale-100 opacity-100 text-muted/50 group-hover/act:text-foreground"
          }`}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        <svg
          className={`absolute transition-all duration-200 ${
            addPrompt.trim() ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
      </div>
    </>
  );

  // The add-a-part affordance at the song's edges — an insertion point on the
  // timeline: a hairline that lights, with ONE segmented capsule on it. The body
  // is one-tap EXTEND (the AI chooses what best fits the arc — no thinking
  // required); the quiet ✎ segment opens the composer for a written direction.
  // THE EFFECT PICKER — five words, each a complete move that will BEGIN at
  // `targetId` (reach 1; stretch it from the band). Zero AI, instant.
  const renderFxPicker = (targetId: string) => (
    // ONE glass object that WRAPS — nine words never scroll sideways; on an
    // iPhone they fold into rows, every word a whole tap target.
    <div className="animate-fade-in relative flex w-full items-center justify-center py-2.5">
      <span
        aria-hidden
        className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-accent/[0.18] sm:inset-x-8"
      />
      <div className="relative flex max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl border border-accent/25 bg-white/[0.03] px-2 py-1.5 backdrop-blur-xl">
        {FX_MOVES.map((m) => (
          <button
            key={m.word}
            onClick={() => bornFx(targetId, m)}
            title={m.hint}
            className="whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-medium leading-none text-foreground/75 transition duration-200 hover:bg-white/[0.05] hover:text-accent active:scale-[.97]"
          >
            {m.word}
          </button>
        ))}

        <button
          onClick={() => setFxPickerAt(null)}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full text-muted/45 pointer-coarse:text-muted/80 transition duration-200 hover:text-foreground active:scale-[.97]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderBreakPicker = (targetId: string) => (
    // Same glass object as the effect picker — its own door, its own words.
    <div className="animate-fade-in relative flex w-full items-center justify-center py-2.5">
      <span
        aria-hidden
        className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-accent/[0.18] sm:inset-x-8"
      />
      <div className="relative flex max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl border border-accent/25 bg-white/[0.03] px-2 py-1.5 backdrop-blur-xl">
        {BREAK_MOVES.map((m) => (
          <button
            key={`brk-${m.tpl}`}
            onClick={() => {
              setBrkPickerAt(null);
              bornBreak(targetId, m);
            }}
            title={`${m.hint} — sounds in the closing ${m.bars === 1 ? "bar" : `${m.bars} bars`}`}
            className="whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-medium leading-none text-foreground/75 transition duration-200 hover:bg-white/[0.05] hover:text-accent active:scale-[.97]"
          >
            {m.word}
          </button>
        ))}
        <button
          onClick={() => setBrkPickerAt(null)}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full text-muted/45 pointer-coarse:text-muted/80 transition duration-200 hover:text-foreground active:scale-[.97]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderAddPart = (side: "before" | "after") => {
    const sideBusy = side === "before" ? frontBusy : backBusy;
    if (addOpen === side) return renderComposer(side);
    // an effect can begin at the song's very first bar — the before-edge owns
    // that seam (the first loop has no gap above it)
    const fxTarget = side === "before" ? playableVisible[0] : undefined;
    if (fxTarget && fxPickerAt === fxTarget.id) return renderFxPicker(fxTarget.id);
    return (
      <div className="group relative flex w-full items-center justify-center py-2.5">
        <span
          aria-hidden
          className="absolute inset-x-8 top-1/2 h-px bg-white/[0.05] transition-colors duration-300 group-hover:bg-accent/25"
        />
        <span
          className={`relative flex items-stretch overflow-hidden rounded-full border backdrop-blur-xl transition duration-300 ${
            sideBusy
              ? "border-accent/25 bg-white/[0.03]"
              : "border-white/[0.06] bg-white/[0.02] group-hover:border-accent/35 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_32px_-10px_rgba(224,49,156,.5)]"
          }`}
        >
          {sideBusy ? (
            <span className="flex items-center gap-2 px-4 py-1.5 text-[12.5px] font-medium text-muted">
              <span className="shimmer-text">Composing the new loop…</span>
            </span>
          ) : (
            <>
              <button
                onClick={() => {
                  setError(null);
                  void addPart(side, "");
                }}
                className="flex items-center gap-2 py-1.5 pl-4 pr-3 text-[12.5px] font-medium text-muted/70 pointer-coarse:text-foreground/85 transition duration-200 hover:text-foreground active:scale-95"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] shadow-[0_0_10px_rgba(224,49,156,.85)]" />
                {side === "before" ? "Extend before" : "Extend after"}
              </button>
              <span aria-hidden className="my-1.5 w-px shrink-0 bg-white/[0.08]" />
              <button
                onClick={() => {
                  setError(null);
                  setAddPrompt("");
                  setAddOpen(side);
                }}
                aria-label="Describe the new section instead"
                className="grid place-items-center py-1.5 pl-3 pr-3.5 text-muted/50 transition duration-200 hover:text-foreground active:scale-95"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              {fxTarget && (
                <>
                  <span aria-hidden className="my-1.5 w-px shrink-0 bg-white/[0.08]" />
                  <button
                    onClick={() => {
                      setError(null);
                      setFxPickerAt(fxTarget.id);
                    }}
                    title="An effect from the very first bar — yours to shape, no AI"
                    aria-label="Add an effect beginning at the first loop"
                    className="flex items-center gap-1.5 whitespace-nowrap py-1.5 pl-3 pr-4 text-[12.5px] font-medium text-muted/70 pointer-coarse:text-foreground/85 transition duration-200 hover:text-foreground active:scale-95"
                  >
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent opacity-70 pointer-coarse:opacity-100 shadow-[0_0_8px_var(--accent)] transition group-hover:opacity-100" /> Effect
                  </button>
                </>
              )}
            </>
          )}
        </span>
      </div>
    );
  };

  // The GAP between two loops holds ONE quiet power: the BREAK — a single
  // extra bar of music, written by the AI from both loops, that carries one
  // into the next. You don't edit a break; you HEAR them and pick one (or none).

  // Hear a break IN THE MIX — the same gesture as tapping a loop card: the bar
  // sounds in place and FLOWS into the next loop (honouring its repeat, if one
  // is set), never looping on its own. You still choose by hearing — you just
  // hear the break doing its actual job: easing this loop into the next.
  // Tapping the sounding one pauses; tapping again resumes, same phrase.
  async function playBreak(gapId: string, retap: boolean) {
    if (exporting) return; // the render owns the engine — nothing else plays
    try {
      if (retap) {
        if (!paused) holdMix();
        else await releaseMix();
        return;
      }
      // Start (or JUMP) the mix from this seam — a fresh play is the FULL mix.
      soloedRef.current = null;
      setSoloed(null);
      releaseLayerGates();
      await startMixFrom(`break:${gapId}`);
    } catch (e) {
      setError("Audio engine failed to start.");
      console.error(e);
    }
  }

  // Isolate ONE layer (everything else silenced). It's a LIVE overlay on the running
  // loop: headphones on a layer of the loop that's ALREADY sounding closes every
  // other orbit's bus gate NOW (tails included) and hot-swaps the code overlay for
  // whatever shares the soloed layer's own bus — transport kept, no restart; another
  // layer switches what's heard; the lit one reopens the gates and the full mix
  // returns MID-NOTE. Headphones anywhere else — silence, pause, or a DIFFERENT
  // loop playing — this loop takes over from the top with only that layer audible
  // (the crossfade takeover makes it seamless; gates arm when its section lands).
  const soloedLayerOf = (partId: string): number =>
    soloed?.partId === partId ? soloed.layer : -1;
  async function onSoloLayer(partId: string, layer: number) {
    if (exporting) return; // the render owns the engine — nothing else plays
    const p = parts.find((x) => x.id === partId);
    if (!p?.strudel?.trim()) return;
    const playingNow = !!playing && !paused;
    const opts = { transpose, bpm, timeSignature, sound };
    // Toggle OFF — back to the full mix, live (no restart). Gates open FIRST:
    // still-rendering layers are audible again before the re-eval even lands.
    if (soloed?.partId === partId && soloed.layer === layer) {
      soloedRef.current = null;
      setSoloed(null);
      releaseLayerGates();
      releaseLayerGates();
      if (playingNow) void liveUpdate(transformForPlayback(playbackCode(p), opts));
      return;
    }
    soloedRef.current = { partId, layer };
    setSoloed({ partId, layer });
    if (playingNow && playing === partId) {
      // THIS loop is sounding → gates close every other bus immediately, then
      // the overlay code (same-bus layers muted) swaps in, transport kept.
      const t = transformForPlayback(playbackCode(p), opts);
      syncLayerGates(p, t);
      void liveUpdate(soloLiveCode(t, layer));
    } else {
      // Silence, pause, or another loop playing → this loop takes over from
      // the top; decorate() reads soloedRef and bakes the solo, and the
      // [playing] watcher arms the gates the moment its section lands.
      try {
        await startMixFrom(partId);
      } catch {
        setError("Audio engine failed to start.");
      }
    }
  }

  const renderGap = (prev: Part, next: Part, position: number) => {
    const gapBusy = isEdgeBusy(prev) || isEdgeBusy(next);
    const set = plan?.breaks?.[prev.id];
    const chosen =
      set && set.chosen !== null && set.chosen !== undefined
        ? set.options[set.chosen]
        : null;

    // A NEW LOOP is being composed for this seam: the open composer, then the
    // request round-trip shimmer (the pending loop card takes over via refresh).
    if (addOpen === `gap:${prev.id}`) {
      return (
        <div className="animate-fade-in py-1.5">
          {renderComposer({ position, gapId: prev.id })}
        </div>
      );
    }
    if (insertingGap === prev.id) {
      return (
        <div className="relative flex w-full items-center justify-center py-2.5">
          <span
            aria-hidden
            className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-accent/[0.18] sm:inset-x-8"
          />
          <span className="relative flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/[0.08] px-3.5 py-2 backdrop-blur-md text-[12px] font-medium leading-none">
            <span className="shimmer-text">Composing the new loop…</span>
          </span>
        </div>
      );
    }

    if (fxPickerAt === next.id) return renderFxPicker(next.id);
    if (brkPickerAt === prev.id) return renderBreakPicker(prev.id);

    // OPEN: the bead grows into a SEGMENTED CAPSULE on the same thread — one
    // solid object (the header's icon-cluster material), not loose pills in a
    // void. Tapping a break CHOOSES it and PLAYS it in one gesture — choosing
    // IS hearing — and the sounding segment shimmers. Tap None (or anywhere
    // outside) and the seam folds back to its quiet self.
    if (breakOpen === prev.id) {
      const segment = (
        label: string,
        selected: boolean,
        sounding: boolean,
        onClick: () => void,
      ) => (
        <button
          key={label}
          onClick={onClick}
          title={sounding ? "Tap to pause" : undefined}
          className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-medium leading-none transition active:scale-[.97] ${
            selected
              ? "bg-accent/20 text-accent"
              : "text-muted hover:bg-white/[0.06] hover:text-foreground"
          }`}
        >
          {sounding ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] text-accent">■</span>
              <span className="shimmer-text">{label}</span>
            </span>
          ) : (
            label
          )}
        </button>
      );
      return (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setBreakOpen(null)}
            aria-hidden
          />
          <div className="animate-fade-in relative z-20">
            <div className="relative flex items-center justify-center">
              {/* the thread IS the play state: while a break sounds, a one-bar
                  playhead sweeps along it (and holds still while paused) */}
              <span
                aria-hidden
                className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 overflow-hidden sm:inset-x-8"
              >
                <span className="block h-full w-full bg-accent/[0.18]" />
                {playing === `break:${prev.id}` && (
                  <span
                    className="absolute inset-0 origin-left bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_10px_rgba(224,49,156,.5)]"
                    style={{
                      animation: `playhead-sweep ${barSeconds}s linear infinite`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                )}
              </span>
              <div className="relative max-w-full overflow-x-auto rounded-full border border-white/[0.07] bg-white/[0.03] p-1 backdrop-blur-md">
                {breakBusy === prev.id ? (
                  <span className="block whitespace-nowrap px-3 py-1 text-[12px] leading-none">
                    {/* IDENTICAL copy to the closed bead's composing state — clicking away must
                        re-frame the same object, never appear to change what's happening. */}
                    <span className="shimmer-text">≋ writing the break…</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {(set?.options ?? []).map((_o, oi) =>
                      segment(
                        `≋ ${oi + 1}`,
                        set?.chosen === oi,
                        set?.chosen === oi &&
                          playing === `break:${prev.id}` &&
                          !paused,
                        () => {
                          const retap =
                            set?.chosen === oi && playing === `break:${prev.id}`;
                          chooseBreak(prev.id, oi);
                          void playBreak(prev.id, retap);
                        },
                      ),
                    )}
                    {/* a break can't be steered — you pick a take or regenerate.
                        (The "your words…" field was removed 2026-07-13: a break
                        is a regenerate-only object, like Repaint.) */}
                    <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-white/[0.08]" />
                    {/* repeat — a break holds like a loop; tap cycles Off → 2× → 4× → 8× */}
                    <button
                      onClick={() => {
                        const key = `break:${prev.id}`;
                        const cur = holdCycles[key];
                        const next =
                          cur == null ? 2 : cur === 2 ? 4 : cur === 4 ? 8 : undefined;
                        setHold(key, next);
                      }}
                      title="Repeat this break — tap to cycle"
                      aria-label="Repeat this break"
                      className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2 transition active:scale-95 ${
                        holdCycles[`break:${prev.id}`] != null
                          ? "bg-accent/15 text-accent"
                          : "text-muted/55 hover:bg-white/[0.06] hover:text-foreground"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m17 2 4 4-4 4" />
                        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                        <path d="m7 22-4-4 4-4" />
                        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                      </svg>
                      {holdCycles[`break:${prev.id}`] != null && (
                        <span className="text-[10px] font-medium tabular-nums">
                          {holdCycles[`break:${prev.id}`] === Infinity ? "∞" : `${holdCycles[`break:${prev.id}`]}×`}
                        </span>
                      )}
                    </button>
                    {/* ↻ a fresh take replaces the break; ✕ removes it (no break, seam closes) */}
                    <button
                      onClick={() => void openBreaks(prev, true)}
                      title="A fresh take replaces this break"
                      aria-label="Regenerate the break"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted/55 transition hover:bg-white/[0.06] hover:text-accent active:scale-95"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                        <path d="M21 3v6h-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        chooseBreak(prev.id, null);
                        setHold(`break:${prev.id}`, undefined);
                        setBreakOpen(null);
                      }}
                      title="No break — the loops meet directly"
                      aria-label="Remove the break"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted/55 transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {breakBusy !== prev.id && (
              <p className="mt-1.5 text-center text-[10.5px] text-muted/35">
                one bar easing this loop into the next — tap to hear · ↻ new take · ✕ remove
              </p>
            )}
          </div>
        </>
      );
    }

    // CLOSED while COMPOSING: an outside click may fold the picker away, but the seam
    // must keep saying it's working — the bead itself shimmers until the break lands.
    if (breakBusy === prev.id) {
      return (
        <div className="relative flex w-full items-center justify-center py-2.5">
          <span
            aria-hidden
            className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-accent/[0.18] sm:inset-x-8"
          />
          <span className="relative flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/[0.08] px-3.5 py-2 backdrop-blur-md text-[12px] font-medium leading-none">
            <span className="shimmer-text">≋ writing the break…</span>
          </span>
        </div>
      );
    }

    // The seam thread + its playhead — shared by both densities below.
    const seamThread = (
      <span
        aria-hidden
        className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 overflow-hidden sm:inset-x-8"
      >
        <span
          className={`block h-full w-full transition duration-300 ${
            chosen
              ? "bg-accent/[0.18]"
              : "bg-white/[0.05] group-hover/gap:bg-accent/20"
          }`}
        />
        {playing === `break:${prev.id}` && (
          <span
            className="absolute inset-0 origin-left bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_10px_rgba(224,49,156,.5)]"
            style={{
              animation: `playhead-sweep ${barSeconds}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        )}
      </span>
    );
    const capsuleShell = `relative flex items-stretch overflow-hidden rounded-full border backdrop-blur-xl transition duration-300 ${
      playing === `break:${prev.id}` && !paused
        ? "border-accent/60 bg-accent/15 shadow-[0_0_18px_-4px_rgba(224,49,156,.8)]"
        : chosen
          ? "border-accent/25 bg-white/[0.03] group-hover/gap:border-accent/45"
          : // GLASS — barely there until wanted: the seam whispers, never shouts
            "border-white/[0.05] bg-white/[0.02] group-hover/gap:border-accent/30 group-hover/gap:bg-white/[0.04]"
    } ${gapBusy ? "opacity-35" : ""}`;
    const chosenChip = set?.options?.length ? (
      <>
        <button
          onClick={() => void openBreaks(prev)}
          disabled={gapBusy}
          title={
            chosen
              ? "The one-bar break easing this seam — tap to change it"
              : "The breaks written for this seam"
          }
          aria-label={
            chosen
              ? "Break between these loops — tap to change"
              : "Breaks for this seam"
          }
          className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium leading-none transition duration-200 active:scale-[.97] disabled:cursor-default ${
            chosen
              ? playing === `break:${prev.id}` && !paused
                ? "text-accent"
                : "text-accent/90 hover:bg-white/[0.04] hover:text-accent"
              : "text-muted/55 hover:bg-white/[0.04] hover:text-accent"
          }`}
        >
          {chosen ? (
            <>
              ≋
              {holdCycles[`break:${prev.id}`] != null && (
                <span className="text-[10px] font-medium tabular-nums text-accent/80">
                  {holdCycles[`break:${prev.id}`] === Infinity ? "∞" : `${holdCycles[`break:${prev.id}`]}×`}
                </span>
              )}
            </>
          ) : (
            <>≋ Breaks</>
          )}
        </button>
        <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
      </>
    ) : null;

    // OPEN: the seam's one button has bloomed into its choices. BETWEEN loops
    // nothing generates on a bare tap (2026-07-14, the user) — both roads ask
    // for YOUR input first: ✎ New loop opens the composer, · Effect opens the
    // five-move picker. (The edges keep their one-tap Extend — different seam,
    // different promise.)
    if (gapOpen === prev.id) {
      return (
        <div className="animate-fade-in group/gap relative flex w-full items-center justify-center py-2.5">
          <div
            className="fixed inset-0 z-10"
            onClick={() => setGapOpen(null)}
            aria-hidden
          />
          {seamThread}
          <div className={`z-20 ${capsuleShell}`}>
            {chosenChip}
            <button
              onClick={() => {
                setGapOpen(null);
                setError(null);
                setAddPrompt("");
                setAddOpen(`gap:${prev.id}`);
              }}
              disabled={gapBusy}
              title="Describe the loop you want here — your words, then the AI writes it"
              aria-label="Describe a new loop for this spot"
              className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-medium leading-none text-foreground/75 transition duration-200 hover:bg-white/[0.04] hover:text-accent active:scale-[.97] disabled:cursor-default"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              New loop
            </button>
            <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
            <button
              onClick={() => {
                setGapOpen(null);
                setError(null);
                setFxPickerAt(next.id);
              }}
              disabled={gapBusy}
              title="An effect that begins here — yours to shape, no AI"
              aria-label="Add an effect beginning at the next loop"
              className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-medium leading-none text-foreground/75 transition duration-200 hover:bg-white/[0.04] hover:text-accent active:scale-[.97] disabled:cursor-default"
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" /> Effect
            </button>
            <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
            <button
              onClick={() => {
                setGapOpen(null);
                setError(null);
                setBrkPickerAt(prev.id);
              }}
              disabled={gapBusy}
              title="A drum fill at this turn — the loop above breaks into the next. No AI"
              aria-label="Add a break at this turn"
              className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-medium leading-none text-foreground/75 transition duration-200 hover:bg-white/[0.04] hover:text-accent active:scale-[.97] disabled:cursor-default"
            >
              ≋ Break
            </button>
            <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
            <button
              onClick={() => setGapOpen(null)}
              aria-label="Close"
              className="grid place-items-center pl-2.5 pr-3 text-muted/45 pointer-coarse:text-muted/80 transition duration-200 hover:text-foreground active:scale-[.97]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    // CLOSED: ONE quiet mark on the thread — the seam's whole vocabulary lives
    // behind one +. (A chosen break keeps its chip: that's music playing here,
    // not an affordance.)
    return (
      <div className="group/gap relative flex w-full items-center justify-center py-1.5">
        {seamThread}
        <div className={capsuleShell}>
          {chosenChip}
          <button
            onClick={() => {
              setError(null);
              setGapOpen(prev.id);
            }}
            disabled={gapBusy}
            title="Add here — a new loop, or an effect"
            aria-label="Open this seam's choices"
            className="grid h-7 w-8 place-items-center text-muted/45 pointer-coarse:text-foreground/80 transition duration-200 hover:bg-white/[0.04] hover:text-foreground active:scale-[.95] disabled:cursor-default"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Parts the user JUST tweaked locally (slider/swap), by part id → timestamp.
  // A refetch racing an in-flight delta write must NOT clobber the knob the
  // user is holding — that's the "slider twitches back" bug.
  const recentLocalEdits = useRef<Map<string, number>>(new Map());
  const noteLocalEdit = (partId: string) =>
    recentLocalEdits.current.set(partId, Date.now());

  // ── THE ARRANGE SURFACE — the song as movable objects, zero AI ─────────────
  // Every move is optimistic (the UI settles instantly) with a fire-and-forget
  // write behind it; while writes are in flight a refetch keeps the LOCAL order,
  // breaks and deletions so nothing snaps back mid-gesture.
  const [arrange, setArrange] = useState(false);
  // Arranging needs at least two loops — fold the surface away if deletes take
  // the song below that (the stack returns on its own).
  useEffect(() => {
    if (parts.length <= 1) setArrange(false);
  }, [parts.length]);
  const arrangeHoldUntil = useRef(0);
  const arrangeDeleted = useRef<Map<string, number>>(new Map());
  const noteArrange = () => {
    arrangeHoldUntil.current = Date.now() + 6000;
  };

  function arrangeReorder(partId: string, toIndex: number) {
    noteArrange();
    setParts((ps) => {
      const from = ps.findIndex((p) => p.id === partId);
      if (from < 0 || from === toIndex) return ps;
      const next = [...ps];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    fetch(`/api/songs/${songId}/parts/${partId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "reorder", toPosition: toIndex }),
    }).catch(() => {});
  }

  function arrangeDelete(partId: string) {
    noteArrange();
    arrangeDeleted.current.set(partId, Date.now());
    setParts((ps) => ps.filter((p) => p.id !== partId));
    // The deleted loop's own break is orphaned — drop it locally too (the
    // server does the same), live for the mix sequencer.
    if (breaksRef.current?.[partId]) {
      const nextBreaks = { ...breaksRef.current };
      delete nextBreaks[partId];
      breaksRef.current = nextBreaks;
      setSong((s) => ({
        ...s,
        plan: {
          ...(s.plan as Record<string, unknown>),
          breaks: nextBreaks,
        } as unknown as Song["plan"],
      }));
    }
    fetch(`/api/songs/${songId}/parts/${partId}`, { method: "DELETE" }).catch(() => {});
  }

  function arrangeMoveBreak(fromId: string, toId: string) {
    if (fromId === toId) return;
    const moving = breaksRef.current?.[fromId];
    if (!moving) return;
    noteArrange();
    const nextBreaks = { ...breaksRef.current };
    const displaced = nextBreaks[toId];
    nextBreaks[toId] = moving;
    if (displaced) nextBreaks[fromId] = displaced;
    else delete nextBreaks[fromId];
    breaksRef.current = nextBreaks; // LIVE: the mix re-derives its sections from this
    setSong((s) => ({
      ...s,
      plan: {
        ...(s.plan as Record<string, unknown>),
        breaks: nextBreaks,
      } as unknown as Song["plan"],
    }));
    // The break's repeat latch travels with it (the server's moveBreak swaps the
    // plan keys itself — this is just the matching local move, no extra write).
    setHoldCycles((prev) => {
      const next = { ...prev };
      const a = next[`break:${fromId}`];
      const b = next[`break:${toId}`];
      delete next[`break:${fromId}`];
      delete next[`break:${toId}`];
      if (a != null) next[`break:${toId}`] = a;
      if (displaced && b != null) next[`break:${fromId}`] = b;
      return next;
    });
    holdPendingUntil.current = Date.now() + 6000;
    fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakMove: { fromPartId: fromId, toPartId: toId } }),
    }).catch(() => {});
  }

  async function arrangeInsert(position: number, prompt: string): Promise<boolean> {
    noteArrange();
    setError(null);
    try {
      const res = await fetch(`/api/songs/${songId}/part`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ position, prompt: prompt || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Couldn’t add a loop here.");
        return false;
      }
      await refresh(); // pull in the new pending part; polling takes over
      return true;
    } catch {
      setError("Network error.");
      return false;
    }
  }

  // A tempo/key SAVE (Settings.apply) can be served a STALE read right after the write
  // (replica lag) or raced by the 2s poll — which reverts the bpm/transpose the user just
  // saved, so the loop "plays back the old tempo". Stamp the save + optimistically apply
  // it locally; refresh() then keeps the local plan settings for a window so a racing
  // refetch can't clobber them.
  // After a tempo/key SAVE the server can serve a STALE read for a moment (replica
  // lag) and on a READY song the poll is OFF — so without help the UI sat on the old
  // value until a manual reload. Track the saved values as PENDING and drive a
  // reconcile poll until the server confirms them: optimistic-apply locally (instant),
  // keep the pending value over any stale refetch, and clear once the server returns it.
  const pendingSettings = useRef<{
    bpm?: number;
    transpose?: number;
    key?: string;
  } | null>(null);
  const pendingUntil = useRef(0);
  const [reconciling, setReconciling] = useState(false);
  const onSettingsSaved = useCallback(
    (s: { bpm: number; transpose: number; key: string }) => {
      // The save COMMITS the preview → drop the preview override and point the live
      // playback refs at the saved values NOW, so a loop repeat doesn't briefly use the
      // old tempo before the re-render syncs the refs.
      livePreviewRef.current = null;
      bpmRef.current = s.bpm;
      transposeRef.current = s.transpose;
      pendingSettings.current = { bpm: s.bpm, transpose: s.transpose, key: s.key };
      pendingUntil.current = Date.now() + 30000; // safety: stop forcing after 30s
      setReconciling(true); // turns the poll ON until the server confirms the save
      setSong(
        (prev) =>
          ({
            ...prev,
            plan: {
              ...((prev.plan ?? {}) as Record<string, unknown>),
              bpm: s.bpm,
              transpose: s.transpose,
              key: s.key,
            },
          }) as Song,
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    // Driven by a 2s poll — a network-level rejection here would be an unhandled
    // rejection every tick while offline; swallow it and let the next tick retry.
    let data: { song: Song; parts: Part[] };
    try {
      const res = await fetch(`/api/songs/${songId}`, { cache: "no-store" });
      if (!res.ok) return;
      data = openDeep((await res.json()) as { song: Song; parts: Part[] });
    } catch {
      return;
    }
    setSong(() => {
      // Keep each just-saved field until the server ACTUALLY returns it — a stale read
      // (replica lag) must not flash the old value back; drop the hold per field once
      // the server matches.
      const sp = (data.song.plan ?? {}) as Record<string, unknown>;
      // A holdCycles PATCH still settling? Keep the local (encoded) map over the stale
      // server plan so a just-toggled repeat latch doesn't flash back.
      const holdKeep: Record<string, unknown> =
        Date.now() < holdPendingUntil.current
          ? {
              holdCycles: Object.fromEntries(
                Object.entries(holdCyclesRef.current).map(([k, v]) => [
                  k,
                  v === Infinity ? -1 : v,
                ]),
              ),
            }
          : {};
      const ps = pendingSettings.current;
      const keep: Record<string, unknown> = {};
      if (ps) {
        for (const k of ["bpm", "transpose", "key"] as const) {
          if (ps[k] !== undefined && sp[k] !== ps[k]) keep[k] = ps[k];
        }
      }
      // An arrange move (break re-key / delete) still settling? Keep the LOCAL
      // breaks map over a stale server plan so a just-dragged bead doesn't snap back.
      const breakKeep: Record<string, unknown> =
        Date.now() < arrangeHoldUntil.current && breaksRef.current
          ? { breaks: breaksRef.current }
          : {};
      return Object.keys(keep).length ||
        Object.keys(holdKeep).length ||
        Object.keys(breakKeep).length
        ? ({ ...data.song, plan: { ...sp, ...keep, ...holdKeep, ...breakKeep } } as Song)
        : data.song;
    });
    // Clear the pending hold (and stop the reconcile poll) once the server confirms
    // every saved field — or after the safety window if it somehow never does.
    if (pendingSettings.current) {
      const ps = pendingSettings.current;
      const sp = (data.song.plan ?? {}) as Record<string, unknown>;
      const confirmed =
        (ps.bpm === undefined || sp.bpm === ps.bpm) &&
        (ps.transpose === undefined || sp.transpose === ps.transpose) &&
        (ps.key === undefined || sp.key === ps.key);
      if (confirmed || Date.now() > pendingUntil.current) {
        pendingSettings.current = null;
        setReconciling(false);
      }
    }
    setParts((prev) => {
      let next = data.parts.map((sp) => {
        // Keep the locally-tweaked code for a part edited in the last few
        // seconds (its delta write is en route / just landed) — UNLESS the
        // server has something structurally new (a rework finished).
        const ts = recentLocalEdits.current.get(sp.id);
        // Ready: keep the local strudel a few seconds (the delta write is en route). GENERATING: keep the
        // local tweak (strudel + tracks) briefly so a poll mid-edit doesn't revert it before the PATCH
        // lands + the generator's merge-preserving write reflects it — a shorter window so a freshly
        // composed layer still streams in fast once editing settles.
        const editWindow =
          sp.status === "ready" ? 6000 : sp.status === "generating" ? 2500 : 0;
        if (ts && editWindow && Date.now() - ts < editWindow) {
          const lp = prev.find((p) => p.id === sp.id);
          if (lp?.strudel?.trim())
            return sp.status === "generating"
              ? { ...sp, strudel: lp.strudel, tracks: lp.tracks }
              : { ...sp, strudel: lp.strudel };
        }
        return sp;
      });
      // An arrange move (reorder / delete) still settling? A stale refetch must not
      // snap the stack back: keep the LOCAL order (known ids by their local rank,
      // brand-new ids — a just-inserted loop — slot in by server position) and keep
      // just-deleted loops gone.
      if (Date.now() < arrangeHoldUntil.current) {
        next = next.filter((sp) => {
          const ts = arrangeDeleted.current.get(sp.id);
          return !(ts && Date.now() - ts < 8000);
        });
        const rank = new Map(prev.map((p, i) => [p.id, i]));
        next = [...next].sort(
          (a, b) =>
            (rank.get(a.id) ?? a.position - 0.5) - (rank.get(b.id) ?? b.position - 0.5),
        );
      }
      return next;
    });
  }, [songId]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // Poll while GENERATING (live progress) or while RECONCILING a just-saved
    // setting (so a ready song pulls the confirmed value without a reload).
    // (The old shape-grace window died with birth unfolds — chapters are made
    // at the user's wish, inline, so there's nothing to keep polling for.)
    if (!busy && !reconciling) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (!pollRef.current) {
      void refresh(); // poll IMMEDIATELY so loading/streaming shows at once, not after POLL_MS
      pollRef.current = setInterval(refresh, POLL_MS);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [busy, reconciling, refresh]);

  // Leaving the page: if THIS song's mix is sounding (or holding a pause), the
  // music COMES WITH YOU — the module-level sequencer keeps driving it, the
  // session flips to "surface unmounted" and the dock takes over. Only a page
  // with nothing of its own playing tears the engine + canvas down as before.
  useEffect(
    () => () => {
      const np = nowPlaying();
      if (!np || !isSongPlaying()) {
        // Nothing is sounding — leave the engine and the canvas clean.
        stop();
        teardownVisuals();
        clearNowPlaying();
      } else if (np.kind === "song" && np.id === songId) {
        // OUR music: it comes with you, the dock takes the transport.
        updateNowPlaying({ surfaceMounted: false });
      }
      // else: someone else's music (another song, or a SET) is riding along in the
      // dock. Leave it alone — this page never started it, and stopping it here
      // silently killed a running set every time you passed through a song page.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // FRESHNESS: always refetch on mount — and again when the browser revives
  // this page from its back/forward cache (no mount happens then). A cached
  // render here once made freshly-painted visuals look missing, inviting
  // writes that fought the server's newer state.
  useEffect(() => {
    void refresh();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [refresh]);

  // Warm the audio engine as soon as the page opens, and PRELOAD the actual
  // sample buffers each ready loop uses — so hitting Play never stalls on a
  // download and no sound is missing on the first hit.
  useEffect(() => {
    warmEngine();
  }, []);
  const readyParts = parts.filter((p) => p.strudel && p.strudel.trim());
  const readyKey = readyParts
    .map((p) => p.id + ":" + (p.strudel as string).length)
    .join(",");
  useEffect(() => {
    if (!readyParts.length) return;
    // Chosen one-bar breaks play in the mix too — warm their samples as well.
    const breakCodes = Object.values(plan?.breaks ?? {}).flatMap((s) =>
      s.chosen !== null && s.chosen !== undefined && s.options[s.chosen]
        ? [s.options[s.chosen].strudel]
        : [],
    );
    preloadSamples([...readyParts.map((p) => p.strudel as string), ...breakCodes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey, plan?.breaks]);

  // START the song's visual the moment it's here — on load, AND when the auto-painted
  // visual lands mid-generation (the poll delivers it on the part's ready write): the
  // backdrop just blooms in, no tap, no announcement. One visual for the whole song, so
  // the first loop carrying a @hydra block is THE visual. Keyed by that part's code (not
  // readyKey) so unrelated ready writes don't re-evaluate the same sketch. If music is
  // playing when it arrives, repaint the VISUALS only (never touch the audio scheduler);
  // idle, the idle visual clock drifts it.
  const visualPart = parts.find((p) => hasHydra(p.strudel));
  const visualKey = visualPart
    ? `${visualPart.id}:${(visualPart.strudel as string).length}`
    : "";
  useEffect(() => {
    if (!visualPart?.strudel) return;
    // ANOTHER page's music is riding along (dock session) — its visual owns the
    // canvas; don't clobber it with this song's idle sketch.
    const np = nowPlaying();
    if (np && !(np.kind === "song" && np.id === songId)) return;
    if (playing) void updateVisuals(visualPart.strudel);
    else void startIdleVisual(visualPart.strudel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualKey]);

  // PLAY = THE MIX, FROM HERE. A loop's play button is an ENTRY POINT: the song
  // starts at that loop and flows on through its breaks and the loops after it
  // (wrapping around — the last loop's final bar hands to the first, seamless
  // pattern math). Tap the playing loop to pause/resume; tap a different loop
  // to jump the mix there.
  // HOLD latches now belong to BREAKS only (`break:<id>` keys) — loop repeats
  // are gone (2026-07-13): a loop's span is its unfold's chosen bar length.
  // Legacy loop keys in saved plans decode but are never read by playback.
  // JSON can't hold Infinity → encode a legacy "forever" latch as -1; decode back.
  const FOREVER = -1;
  const encodeHold = (n: number) => (n === Infinity ? FOREVER : n);
  const decodeHolds = (raw?: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const d = Number(v) === FOREVER ? Infinity : Number(v);
      if (d === Infinity || (Number.isFinite(d) && d > 1)) out[k] = d; // drop junk / "off"
    }
    return out;
  };
  // INIT FROM THE PLAN: rehydrate the saved repeat latches on mount (decode -1 → Infinity).
  const [holdCycles, setHoldCycles] = useState<Record<string, number>>(() =>
    decodeHolds(
      (initialSong.plan as { holdCycles?: Record<string, number> })?.holdCycles,
    ),
  );
  const holdCyclesRef = useRef(holdCycles);
  holdCyclesRef.current = holdCycles;
  // A just-saved holdCycles write is in flight — keep the local map over a stale refetch
  // for a short window so the poll can't revert a just-toggled repeat latch.
  const holdPendingUntil = useRef(0);
  const setHold = (id: string, n: number | undefined) =>
    setHoldCycles((prev) => {
      const next = { ...prev };
      if (n == null) delete next[id];
      else next[id] = n;
      // Persist to the song plan (encode Infinity → -1), fire-and-forget, optimistic.
      const encoded: Record<string, number> = {};
      for (const [k, v] of Object.entries(next)) encoded[k] = encodeHold(v);
      holdPendingUntil.current = Date.now() + 6000;
      fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ holdCycles: encoded }),
      }).catch(() => {});
      return next;
    });

  // TIDY STACK: every loop is a slim row; only the ones YOU open (and any still
  // composing) expand — never playback reaching a loop, never a page-open default.
  // A song of many connected loops stays scannable instead of a wall of giant cards.
  const [openLoops, setOpenLoops] = useState<Set<string>>(new Set());
  const toggleLoopOpen = (id: string, isOpen: boolean) =>
    setOpenLoops((s) => {
      if (!isOpen === s.has(id)) return s;
      const n = new Set(s);
      if (isOpen) n.delete(id);
      else n.add(id);
      return n;
    });

  // Every device plays the full original — ZALTZ renders on the audio thread,
  // so the low-CPU mobile twin is gone (retired 2026-07-20).
  const playbackCode = (p: Part): string => p.strudel || "";
  const breakCode = (br: { strudel: string }): string => br.strudel || "";

  // The ordered, rotated section list — rebuilt ON DEMAND from CURRENT parts + breaks, so
  // a break toggled/re-rolled/removed mid-play changes WHICH sections play (not just their
  // code). Anchored on the loop we started from (a stable part id) so rebuilds don't jump.
  const buildRotated = (anchor: string) => {
    const secs = buildSections(partsRef.current, breaksRef.current);
    const at = secs.findIndex((s) => s.id === anchor);
    return at > 0 ? [...secs.slice(at), ...secs.slice(0, at)] : secs;
  };

  // What the dock whispers while this section sounds.
  const sectionLabelOf = (id: string | null): string | null => {
    if (!id) return null;
    if (id.startsWith("break:")) {
      return "≋";
    }
    const p = partsRef.current.find((x) => x.id === id);
    return p?.label?.trim() ? sentenceLabel(p.label) : "Loop";
  };

  // The mix's callback set, built over THIS instance's live refs — used by a fresh
  // play (playSong) AND by adoption (rebindSong) when the page remounts while its
  // music is still sounding from a previous visit.
  const mixOpts = (startId: string, bpm0: number) => ({
      // THIS song owns the program — same-owner replays crossfade, another
      // song's session gets cut at the tap (no spillage under the new play).
      owner: songId,
      // LIVE section list: re-read every step so add/remove/re-roll of a break applies
      // without restarting the transport. Anchored on the loop we started from.
      sectionsFor: () => buildRotated(lastPlayedRef.current ?? startId),
      onSection: (id: string | null) => {
        sweepDelayRef.current = 0;
        // The section-highlight re-render walks the WHOLE (un-memoized) song tree,
        // on the SAME main thread the Strudel scheduler ticks on. Mark it a
        // TRANSITION so React time-slices it and yields between chunks — a boundary
        // no longer blocks the scheduler's ~0.2s lookahead into a glitch. Cosmetic
        // state only (highlight + playhead restart), so deferral is invisible.
        startTransition(() => {
          setPlayStart(performance.now());
          setPlaying(id);
        });
        updateNowPlaying({ sectionLabel: sectionLabelOf(id) });
      },
      // FRESH code + FRESH dials as each section starts: loops re-read from
      // current state (mid-mix tweaks stick), breaks keep their built code.
      decorate: (c: string, id: string) => {
        const p = partsRef.current.find((x) => x.id === id);
        const lp = livePreviewRef.current;
        const solo = soloedRef.current;
        // On a phone this reads the low-CPU TWIN (playbackCode); desktop the original.
        const code = p ? playbackCode(p) : "";
        const t = transformForPlayback(code.trim() ? code : c, {
          transpose: lp?.transpose ?? transposeRef.current,
          bpm: lp?.bpm ?? bpmRef.current,
          timeSignature: tsRef.current,
          sound: soundRef.current,
          isBreak: id.startsWith("break:"),
        });
        // A soloed layer of THIS section keeps its overlay across re-evals —
        // applied POST-transform (orbit numbers live there; the bus gates
        // silence the other orbits, the overlay covers the soloed layer's own).
        return solo?.partId === id && code.trim() ? soloLiveCode(t, solo.layer) : t;
      },
      // HOLD, read live at every loop boundary. Loop repeats are GONE — the
      // unfold's bars are the span; the only holds left are a loop that's
      // STILL COMPOSING (you're listening to it build).
      holdSection: (id: string) => {
        const p = partsRef.current.find((x) => x.id === id);
        return !!p && (p.status === "generating" || p.status === "pending");
      },
      // REPEATS (the 2×/4×/8× latches) bake into the pattern as extra cycles —
      // breaks and (chapters era) plain loops alike. A legacy spec'd section
      // plays its authored span exactly once instead.
      repeatsFor: (id: string) => {
        if (!id.startsWith("break:") && arrOf(id)) return 1;
        const target = holdCyclesRef.current[id] ?? 1;
        return Number.isFinite(target) ? target : 1;
      },
      secondsFor: (id: string) => {
        const playable = partsRef.current.filter(
          (p) => p.strudel?.trim() && !blueprintIdsRef.current.has(p.id),
        );
        // A lone loop that's still GENERATING keeps growing as layers stream — don't let
        // the timer restart it at its short early length (it loops naturally meanwhile).
        if (
          playable.length === 1 &&
          playable[0].id === id &&
          (playable[0].status === "generating" || playable[0].status === "pending")
        )
          return 3600;
        // Scale the baked section length by any LIVE tempo change (seconds ∝ 1/bpm) so the
        // loop re-evaluates on the CURRENT-tempo boundary, not the play-start one. Use the
        // LIVE rotation so a section that only exists after a break-change still has a length.
        const sec = buildRotated(lastPlayedRef.current ?? startId).find(
          (s) => s.id === id,
        )?.seconds;
        if (sec == null) return undefined;
        const curBpm = livePreviewRef.current?.bpm ?? bpmRef.current;
        return curBpm > 0 ? sec * (bpm0 / curBpm) : sec;
      },
      // The song's OWN end (plan.arrangement.ending "stop") — a LIVE getter,
      // so flipping ends-here/loops-forever applies MID-PLAY (2026-07-14; a
      // one-shot snapshot froze the toggle until the next play).
      get ending() {
        return endingOf();
      },
      // Song-level effects, read live — glides across chapters, repeats, seams.
      effectsFor: () => effectsRef.current,
      overlaysFor: () => overlaysRef.current,
      onEnded: () => {
        setMixActive(false);
        clearNowPlaying();
      },
  });

  async function startMixFrom(startId: string) {
    // Per-loop repeat counts PERSIST across plays — they're deliberate settings the user
    // dialled in, not a transient gesture, so pressing play must NEVER silently wipe them
    // (that made toggling repeat look like it did nothing).
    const rotated = buildRotated(startId);
    if (rotated.length === 0) return;
    setMixActive(true);
    lastPlayedRef.current = startId;
    // (no setPaused — publishNowPlaying below carries `paused: false`, and that
    // descriptor IS the paused state now.)
    // The music now belongs to the APP, not this page: publish the session so the
    // dock can carry it anywhere (and this page can adopt it back later).
    publishNowPlaying({
      kind: "song",
      id: songId,
      href: `/song/${songId}`,
      title: song.title,
      sectionLabel: sectionLabelOf(startId),
      paused: false,
      surfaceMounted: true,
    });
    // bpm at play start — to scale baked section lengths if the tempo changes live
    await playSong(rotated, mixOpts(startId, bpm));
  }

  // THE BLUEPRINT, SOLO — the one place the full raw stack sounds together.
  // A one-section playSong takeover: the watcher can't re-scope it away (the
  // blueprint isn't in the live playable list, so structure adoption keeps
  // the running unit), and retap = the usual pause/resume.
  async function playBlueprint(part: Part) {
    if (!part.strudel?.trim() || exporting) return;
    // the user CHOSE this listen — it must never lift off to the song the way
    // an auto-started build-listen does
    autoPlayedRef.current.delete(part.id);
    try {
      if (playing === part.id) {
        if (!paused) holdMix();
        else await releaseMix();
        return;
      }
      soloedRef.current = null;
      setSoloed(null);
      releaseLayerGates();
      setMixActive(false);
      lastPlayedRef.current = part.id;
      publishNowPlaying({
        kind: "song",
        id: songId,
        href: `/song/${songId}`,
        title: song.title,
        sectionLabel: sentenceLabel(part.label || "Blueprint"),
        paused: false,
        surfaceMounted: true,
      });
      // THE SOLO OWNS ITS LIST (2026-07-14): the engine's step() prefers
      // opts.sectionsFor over the passed sections — with the song's list there
      // (and the blueprint missing from its rotation) the "solo" actually
      // played the whole song from the top. sectionsFor must return the solo
      // itself — read live, so a composing blueprint still grows in the ear.
      const soloList = () => {
        const live = partsRef.current.find((x) => x.id === part.id) ?? part;
        return [
          {
            id: part.id,
            code: transformForPlayback(playbackCode(live), {
              transpose: transposeRef.current,
              bpm: bpmRef.current,
              timeSignature: tsRef.current,
              sound: soundRef.current,
            }),
            seconds: barsOf(live) * barSeconds,
          },
        ];
      };
      await playSong(soloList(), {
        ...mixOpts(part.id, bpm),
        sectionsFor: soloList,
        // a solo loops forever — the song's ending never applies to it
        ending: null,
      });
    } catch (e) {
      setError("Audio engine failed to start.");
      console.error(e);
    }
  }

  // THE BLUEPRINT SOUNDS ITSELF INTO BEING — the moment a prompt's material has
  // its first layer, it starts playing on its own (nothing else sounding), and
  // every layer that lands is heard as it arrives. Composing is a performance,
  // not a progress bar. A listen the user chose is never hijacked.
  const buildingBp = parts.find(
    (p) =>
      p.status === "generating" &&
      p.kind !== "break" &&
      p.kind !== "bridge" &&
      p.strudel?.trim(),
  );
  const autoPlayedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!buildingBp || exporting || playing || paused) return;
    // "starts playing on its own (nothing else sounding)" — literally: another
    // song riding the dock is a listen the user chose, and an auto-start must
    // never take the stage from it (it CUT the dock's song mid-listen).
    const other = nowPlaying();
    if (other && !other.paused && other.id !== songId) return;
    if (autoPlayedRef.current.has(buildingBp.id)) return;
    autoPlayedRef.current.add(buildingBp.id);
    void playBlueprint(buildingBp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingBp?.id, buildingBp?.strudel, playing, paused, exporting]);
  // …and it GROWS in the ear: while the building material is the thing playing,
  // each landed layer swaps in live — same transport, no restart.
  useEffect(() => {
    if (!buildingBp || playing !== buildingBp.id || paused) return;
    void liveUpdate(
      transformForPlayback(playbackCode(buildingBp), {
        transpose,
        bpm,
        timeSignature,
        sound,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingBp?.strudel]);
  // THE LIFT-OFF — an auto-started blueprint hands the stage to the SONG the
  // moment its first real loop exists: the material was the overture, the
  // unfold is the show. Only auto-started listens are redirected.
  useEffect(() => {
    if (!playing || paused || !autoPlayedRef.current.has(playing)) return;
    const chapters = ((plan as { chapters?: Record<string, string> })?.chapters ?? {}) as Record<string, string>;
    const firstChild = parts.find(
      (p) => chapters[p.id] === playing && p.status === "ready" && p.strudel?.trim(),
    );
    if (!firstChild) return;
    autoPlayedRef.current.delete(playing);
    void startMixFrom(firstChild.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, playing, paused, plan]);

  // ADOPTION — this page opened while ITS OWN music is still sounding (started
  // here earlier, or from a home card, which plays the same whole-song mix). The
  // running mix is re-owned in place: reflect its state and rebind the sequencer's
  // callbacks to THIS instance's refs — audio never blinks, the phrase carries on.
  // A published session whose engine has since died re-enters cleanly from the
  // first ready loop; a paused one lands cold.
  useEffect(() => {
    const np = nowPlaying();
    if (!np || np.kind !== "song" || np.id !== songId) return;
    if (isSongPlaying()) {
      const cur = currentSectionId();
      const anchor =
        cur && !cur.startsWith("break:")
          ? cur
          : (partsRef.current.find(
              (p) => p.strudel?.trim() && !blueprintIdsRef.current.has(p.id),
            )?.id ?? null);
      setMixActive(true);
      setPlaying(cur);
      if (anchor) lastPlayedRef.current = anchor;
      sweepDelayRef.current = 0;
      setPlayStart(performance.now());
      if (anchor) rebindSong(mixOpts(anchor, bpmRef.current));
      updateNowPlaying({ surfaceMounted: true, title: song.title });
    } else if (!np.paused) {
      updateNowPlaying({ surfaceMounted: true, title: song.title });
      const first = partsRef.current.find(
        (p) => p.strudel?.trim() && !blueprintIdsRef.current.has(p.id),
      );
      if (first) void startMixFrom(first.id);
    } else {
      // A paused single loop from elsewhere — it was silent anyway; land cold.
      dockStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LET GO. The session can end without this page touching it — the OS lock
  // screen's stop, a dock ✕ we don't own, another song or a set taking the
  // engine. When it does, the highlighted loop and its ⏸ must go dark, or the
  // page keeps claiming to play music that isn't there.
  useEffect(() => {
    if (owns || exporting) return;
    setPlaying((p) => (p === null ? p : null));
    setMixActive((m) => (m ? false : m));
  }, [owns, exporting]);

  async function onPlay(part: Part) {
    if (!part.strudel) return;
    if (exporting) return; // the render owns the engine — nothing else plays
    try {
      if (playing === part.id) {
        // Tap on the playing loop = PAUSE; tap again = RESUME, same phrase.
        if (!paused) {
          holdMix();
        } else {
          await releaseMix();
          // Pick up anything edited while paused — the hot-swap lands at the next cycle
          // boundary, keeping the phase. Keep the solo if one is active on this loop.
          const solo = soloedRef.current;
          const code = playbackCode(part); // twin on mobile, original on desktop
          const t = transformForPlayback(code, { transpose, bpm, timeSignature, sound });
          void liveUpdate(
            solo?.partId === part.id ? soloLiveCode(t, solo.layer) : t,
          );
        }
        return;
      }
      // Start (or JUMP) the mix from this loop — a fresh play is the FULL mix, so clear solo.
      soloedRef.current = null;
      setSoloed(null);
      releaseLayerGates();
      await startMixFrom(part.id);
    } catch (e) {
      setError("Audio engine failed to start.");
      console.error(e);
    }
  }

  // Play the whole MIX: its sections in sequence (each ~its loop length), looping
  // the arc. `onSection` lights up + restarts the playhead for the current section.
  async function playMix() {
    if (exporting) return; // the render owns the engine — nothing else plays
    try {
      if (mixActive) {
        // Tap = PAUSE the mix mid-section; tap again = carry on from there.
        if (!paused) holdMix();
        else await releaseMix();
        return;
      }
      const first = playableVisible[0];
      if (first) await startMixFrom(first.id);
    } catch (e) {
      setError("Audio engine failed to start.");
      console.error(e);
      setMixActive(false);
    }
  }

  // SPACEBAR = play / pause. Toggles the playing loop off, or resumes the last
  // one played (falling back to the first playable loop). Ignored while typing in
  // a field so editing a title/description doesn't trigger playback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          t.closest("input, textarea, select, [contenteditable='true']"))
      )
        return;
      // Someone ELSE'S music is riding the dock (another song, or a set). The DOCK
      // owns the spacebar then — its own handler is already listening. Without this,
      // one press paused the set AND started this song, and the page scrolled too.
      const np = nowPlaying();
      if (np && !(np.kind === "song" && np.id === songId)) return;
      e.preventDefault(); // stop the page from scrolling
      if (exporting) return; // the render owns the engine
      // Space = PAUSE / RESUME whatever's active (loops continue mid-phrase).
      if (mixActive) {
        void playMix();
        return;
      }
      if (playing) {
        const cur = parts.find((p) => p.id === playing);
        if (cur) {
          void onPlay(cur);
          return;
        }
        // Non-card playback (a break section): same pause/resume, same key.
        if (!paused) holdMix();
        else void releaseMix();
        return;
      }
      // Nothing active: a multi-section MIX plays as a whole; a single loop
      // plays itself (the last one played, falling back to the first).
      if (playableVisible.length > 1) {
        void playMix();
        return;
      }
      const target =
        parts.find((p) => p.id === lastPlayedRef.current && p.strudel?.trim()) ||
        parts.find((p) => p.strudel?.trim() && !blueprintIds.has(p.id));
      if (target) void onPlay(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mixActive, paused, parts, transpose, bpm, exporting]);

  // Re-evaluate the currently-playing single loop LIVE (hot-swap) — used when a
  // global transpose/tempo change should be heard immediately while it plays.
  const liveReapplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveReapply = useCallback(
    (over: { transpose?: number; bpm?: number }) => {
      // Remember the preview so a LOOP REPEAT (decorate) keeps it, not just this cycle.
      // onLive({}) (Cancel/reset) clears it → playback falls back to the saved plan.
      if (over.bpm === undefined && over.transpose === undefined) {
        livePreviewRef.current = null;
      } else {
        livePreviewRef.current = { ...livePreviewRef.current, ...over };
      }
      if (!playing) return;
      const p = parts.find((x) => x.id === playing);
      if (!p?.strudel) return;
      const strudel = playbackCode(p); // twin on mobile, original on desktop
      const apply = () => {
        const lp = livePreviewRef.current;
        liveUpdate(
          transformForPlayback(strudel, {
            transpose: lp?.transpose ?? transpose,
            bpm: lp?.bpm ?? bpm,
            timeSignature,
            sound,
          }),
        );
      };
      // Mobile on-device: a tempo/transpose SLIDER DRAG fires this per step, each a
      // re-eval on the scheduler's thread. Debounce so a drag commits ONE re-eval on
      // settle (the twin is light, so one re-eval is cheap). Desktop applies live.
      if (isMobileDevice()) {
        if (liveReapplyTimer.current) clearTimeout(liveReapplyTimer.current);
        liveReapplyTimer.current = setTimeout(apply, 200);
        return;
      }
      apply();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playing, parts, transpose, bpm, timeSignature, sound],
  );

  // While a loop is still GENERATING, its layers stream in and the loop GROWS. If
  // it's the one playing, hot-swap it (seamless, at the next cycle boundary) each
  // time its code changes — so the playing loop grows with it instead of looping
  // the short early version. Paired with secondsFor(3600) so the timer never cuts
  // it short while it's still building.
  const playingPart = parts.find((p) => p.id === playing);
  const playingCode = playingPart?.strudel;
  const playingGenerating =
    !!playingPart &&
    (playingPart.status === "generating" || playingPart.status === "pending");
  useEffect(() => {
    if (!playing || paused || exporting || !playingCode || !playingGenerating) return;
    // Keep the solo applied as the loop grows, if one is active on this loop.
    const solo = soloedRef.current;
    // Mobile re-evaluates the whole twin per swap, so debounce it; desktop
    // hot-swaps per layer cheaply.
    const onMobileLoop = isMobileDevice();
    const doSwap = () => {
      const t = transformForPlayback(playingCode, { transpose, bpm, timeSignature, sound });
      void liveUpdate(solo?.partId === playing ? soloLiveCode(t, solo.layer) : t);
    };
    // Desktop hot-swaps cheaply per layer. Mobile re-renders the whole loop per
    // swap, so DEBOUNCE: one re-render when the loop settles, not per layer.
    if (!onMobileLoop) {
      doSwap();
      return;
    }
    const t = setTimeout(doSwap, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingCode, playingGenerating]);

  const visibleParts = parts;
  // BLUEPRINTS — the raw material each unfold drew from (plan.chapters values).
  // They stay on the page forever, inspectable, but NEVER play in the song:
  // every playback-facing list filters them out.
  const chapterRoots = useMemo(
    () =>
      ((plan as { chapters?: Record<string, string> })?.chapters ?? {}) as Record<string, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan],
  );
  const blueprintIds = useMemo(
    () =>
      new Set(
        Object.values(
          (plan as { chapters?: Record<string, string> })?.chapters ?? {},
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan],
  );
  const blueprintIdsRef = useRef(blueprintIds);
  blueprintIdsRef.current = blueprintIds;
  const playableVisible = visibleParts.filter(
    (p) => p.strudel?.trim() && !blueprintIds.has(p.id),
  );
  const anyHydra = parts.some((p) => hasHydra(p.strudel));

  // EXACT loop length per part, in cycles — measured from the real pattern (the
  // engine watches it until it repeats), keyed by code so it re-measures on edit.
  // Until measured, we fall back to the cheap regex estimate (computeLoopBars).
  const [measuredCycles, setMeasuredCycles] = useState<Record<string, number>>(
    {},
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const p of playableVisible) {
        const code = p.strudel as string;
        const key = `${p.id}:${code.length}`;
        if (measuredCycles[key]) continue;
        const n = await loopCycles(code);
        if (!cancelled && n && n > 0)
          setMeasuredCycles((m) => (m[key] ? m : { ...m, [key]: n }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  // The loop length in bars/cycles for a part: exact measurement if we have it,
  // else the regex estimate. (1 cycle = 1 bar at the setcpm(bpm/4) convention.)
  const barsOf = (p: Part): number =>
    measuredCycles[`${p.id}:${(p.strudel || "").length}`] ||
    computeLoopBars(p.strudel || "");


  // Does the shape still hold the song AS IT STANDS? Derived, never stored:
  // a loop absent from plan.arrangement.sections (added or regenerated since
  // the last unfolding), a section authored against a different active-layer
  // count (a mute/edit shifted the indices — the renderer skips those moves
  // wholesale), or a repeat dial turned since the arrangement was authored
  // for it (arrOf drops the section's arr unless arr.bars === dial × natural)
  // means there's material the shape doesn't know. The button's WORD carries
  // the answer: "Unfold" while something new awaits, settling to "Unfolded"
  // when every loop is folded in — and flipping back on its own the moment
  // the song changes.

  // ── SONG-LEVEL EFFECTS (chapters era, plan.effects) ────────────────────────
  // Glides living OUTSIDE the loops, anchored to part ranges. Riding a knob is
  // optimistic + heard live (the engine re-reads effectsRef on rebuild);
  // release persists. All zero AI except the one lazy knob-naming call.
  const mutateEffects = (fn: (list: SongFx[]) => SongFx[]) =>
    setSong((s) => {
      const pl = s.plan as { effects?: SongFx[] } & Record<string, unknown>;
      return {
        ...s,
        plan: { ...pl, effects: fn(pl.effects ?? []) } as unknown as Song["plan"],
      };
    });
  const fxPokeAt = useRef(0);
  function slideFx(fxId: string, values: { from: number; to: number }, commit: boolean) {
    mutateEffects((list) =>
      list.map((e) => (e.id === fxId ? { ...e, from: values.from, to: values.to } : e)),
    );
    const now = Date.now();
    if (commit || now - fxPokeAt.current > 150) {
      fxPokeAt.current = now;
      refreshArrangement();
    }
    if (!commit) return;
    fetch(`/api/songs/${songId}/effects`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: fxId, from: values.from, to: values.to }),
    }).catch(() => void refresh());
  }
  /** Born by hand at a seam (zero AI): the move lands optimistically, the
   *  arrival watcher makes it SOUND, and its band opens for shaping. */
  // ── THE SWEEP PILL (2026-07-21, the user — replaces the Shape menu's
  // Effects/Breaks rows; an at-birth auto-run was reversed the same day):
  // the moment a generation run lands a NEW loop on a song with two or more,
  // the corner offers ONE tap — "Sweep" — that re-hears the entire song
  // (effects across the loops, breaks at the turns, replacing what rides;
  // the pill's own words carry that consequence). ✕ declines; the next loop
  // offers again. Nothing ever runs unasked.
  const [sweep, setSweep] = useState<"idle" | "offer" | "busy">("idle");
  const playableCount = playableVisible.filter((p) => p.status === "ready").length;
  const wasBusy = useRef(busy);
  const readyAtRunStart = useRef(playableCount);
  useEffect(() => {
    if (busy && !wasBusy.current) {
      readyAtRunStart.current = playableCount;
      setSweep((s) => (s === "offer" ? "idle" : s)); // a new run supersedes the offer
    }
    if (!busy && wasBusy.current && playableCount > readyAtRunStart.current && playableCount >= 2)
      setSweep((s) => (s === "busy" ? s : "offer"));
    wasBusy.current = busy;
  }, [busy, playableCount]);
  async function runSweep() {
    setSweep("busy");
    try {
      const res = await fetch(`/api/songs/${songId}/shape`, { method: "POST" });
      if (res.ok) {
        const j = (await res.json()) as { effects?: SongFx[]; overlays?: BreakOverlay[] };
        if (Array.isArray(j.effects)) mutateEffects(() => j.effects as SongFx[]);
        if (Array.isArray(j.overlays)) mutateOverlays(() => j.overlays as BreakOverlay[]);
        refreshArrangement();
        void refresh();
      }
    } catch {
      /* the pill settles back — the loops are untouched */
    } finally {
      setSweep("idle");
    }
  }
  // ── BREAK OVERLAYS (plan.overlays) — deterministic drum rides, zero AI to
  // add. Same optimistic contract.
  const mutateOverlays = (fn: (list: BreakOverlay[]) => BreakOverlay[]) =>
    setSong((s) => {
      const pl = s.plan as { overlays?: BreakOverlay[] } & Record<string, unknown>;
      return {
        ...s,
        plan: { ...pl, overlays: fn(pl.overlays ?? []) } as unknown as Song["plan"],
      };
    });
  function bornBreak(targetId: string, move: (typeof BREAK_MOVES)[number]) {
    const overlay: BreakOverlay = {
      id: crypto.randomUUID(),
      tpl: move.tpl,
      name: move.word,
      gain: move.gain,
      fromId: targetId,
      toId: targetId,
    };
    mutateOverlays((list) => [...list, overlay]);
    setOpenBrkId(overlay.id);
    setFxPickerAt(null);
    refreshArrangement();
    fetch(`/api/songs/${songId}/overlays`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ add: overlay }),
    })
      .then((res) => {
        if (!res.ok) void refresh();
      })
      .catch(() => void refresh());
  }
  const brkPokeAt = useRef(0);
  function tweakBreak(
    oid: string,
    patch: Partial<Pick<BreakOverlay, BreakKnobField>>,
    commit: boolean,
  ) {
    mutateOverlays((list) =>
      list.map((o) => (o.id === oid ? { ...o, ...patch } : o)),
    );
    const now = Date.now();
    if (commit || now - brkPokeAt.current > 150) {
      brkPokeAt.current = now;
      refreshArrangement();
    }
    if (!commit) return;
    fetch(`/api/songs/${songId}/overlays`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: oid, ...patch }),
    }).catch(() => void refresh());
  }
  function revertBreak(oid: string) {
    const o = overlaysRef.current?.find((x) => x.id === oid);
    const move = o ? breakMoveOf(o.tpl) : undefined;
    if (!o || !move) return;
    tweakBreak(
      oid,
      Object.fromEntries(
        BREAK_KNOBS.map((k) => [k.field, breakKnobDefault(move, k.field)]),
      ) as Partial<Pick<BreakOverlay, BreakKnobField>>,
      true,
    );
  }
  function removeBreak(oid: string) {
    mutateOverlays((list) => list.filter((o) => o.id !== oid));
    refreshArrangement();
    fetch(`/api/songs/${songId}/overlays`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: oid, remove: true }),
    })
      .then((res) => {
        if (!res.ok) void refresh();
      })
      .catch(() => void refresh());
  }
  function bornFx(targetId: string, move: (typeof FX_MOVES)[number]) {
    const fx: SongFx = {
      id: crypto.randomUUID(),
      param: move.param,
      from: move.from,
      to: move.to,
      curve: "linear",
      name: move.word,
      home: { from: move.from, to: move.to },
      controls: move.controls,
      fromId: targetId,
      toId: targetId,
    };
    mutateEffects((list) => [...list, fx]);
    setFxPickerAt(null);
    setOpenFxId(fx.id);
    fetch(`/api/songs/${songId}/effects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ add: fx }),
    })
      .then((res) => {
        if (!res.ok) void refresh();
      })
      .catch(() => void refresh());
  }
  function revertFx(fxId: string) {
    const e = effectsRef.current?.find((x) => x.id === fxId);
    if (e?.home) slideFx(fxId, { from: e.home.from, to: e.home.to }, true);
  }
  async function removeFx(fxId: string) {
    mutateEffects((list) => list.filter((e) => e.id !== fxId));
    refreshArrangement();
    try {
      const res = await fetch(`/api/songs/${songId}/effects`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: fxId, remove: true }),
      });
      if (!res.ok) void refresh();
    } catch {
      void refresh();
    }
  }
  // Lazy knob dress — first open with unnamed knobs (mirrors the layer enrich).
  const dressingFxRef = useRef<string | null>(null);
  async function dressFx(fxId: string) {
    if (dressingFxRef.current) return;
    dressingFxRef.current = fxId;
    try {
      const res = await fetch(`/api/songs/${songId}/effects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: fxId }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        controls?: SongFx["controls"];
      };
      if (res.ok && d.controls?.length) {
        const controls = d.controls;
        mutateEffects((list) =>
          list.map((e) => (e.id === fxId ? { ...e, controls } : e)),
        );
      }
    } catch {
      /* quiet — the next open retries */
    } finally {
      dressingFxRef.current = null;
    }
  }
  // Which effect is OPEN in the flow (its loops light up, its knobs show).
  const [openFxId, setOpenFxId] = useState<string | null>(null);
  // Stretch/shrink an effect's reach by one loop (the Reach ± — zero AI).
  function reachFx(fxId: string, delta: 1 | -1) {
    const fx = effectsRef.current?.find((e) => e.id === fxId);
    if (!fx) return;
    const playable = parts.filter(
      (p) => p.strudel?.trim() && !blueprintIds.has(p.id),
    );
    const fromIdx = playable.findIndex((p) => p.id === fx.fromId);
    const toIdx = playable.findIndex((p) => p.id === fx.toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = Math.max(fromIdx, Math.min(playable.length - 1, toIdx + delta));
    if (next === toIdx) return;
    const toId = playable[next].id;
    mutateEffects((list) => list.map((e) => (e.id === fxId ? { ...e, toId } : e)));
    refreshArrangement();
    fetch(`/api/songs/${songId}/effects`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: fxId, toId }),
    }).catch(() => void refresh());
  }


  // Immersive mode: hide the whole UI and let the full-screen visuals play
  // (the canvas scrim lifts to full opacity). Start playback first.
  async function enterImmersive() {
    if (!playing) {
      const p = parts.find((x) => x.strudel?.trim());
      if (p) await onPlay(p);
    }
    setImmersive(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* fullscreen may be blocked — we still hide the UI */
    }
  }
  const exitImmersive = useCallback(() => {
    setImmersive(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.();
    } catch {
      /* ignore */
    }
  }, []);

  // Lift the canvas scrim to full opacity only while immersed (CSS keys off this).
  useEffect(() => {
    document.body.classList.toggle("immersive", immersive);
    return () => document.body.classList.remove("immersive");
  }, [immersive]);

  // While immersed, Esc or leaving browser-fullscreen drops back to the UI.
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitImmersive();
    };
    const onFs = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs); // older Safari
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, [immersive, exitImmersive]);

  // A loop in the mix is EXACTLY the loop played solo — the player adds
  // nothing, ever (no sweeps, no fades). Blending is the loops' own job
  // (edge-overlap composition), with an optional one-bar BREAK between two
  // loops as its own section.
  // A section's model-authored arrangement (plan.arrangement) — read live from
  // the ref. Under a TRANSPOSED mix the one-way overlay lines are dropped: the
  // mix's transpose rides each section's own `$:` lines (transposePitched in
  // decorate), which an arrangement-injected overlay is not — it would play in
  // the ORIGINAL key against the shifted song. Moves/sweeps/bars are pitch-free
  // and stay.
  //
  // (Repeats are gone — the unfold's own bars ARE the loop's span; nothing to
  // reconcile against a dial anymore.)
  function arrOf(id: string) {
    const a = arrangementRef.current?.sections?.[id];
    if (!a) return undefined;
    return (transposeRef.current ?? 0) !== 0 ? { ...a, overlays: undefined } : a;
  }
  function endingOf() {
    const e = arrangementRef.current?.ending;
    if (!e) return null;
    return (transposeRef.current ?? 0) !== 0 && e.code ? { ...e, code: undefined } : e;
  }

  function buildSections(
    list: Part[],
    breaks: typeof plan.breaks = plan?.breaks,
  ) {
    const playable = list.filter(
      (p) => p.strudel?.trim() && !blueprintIdsRef.current.has(p.id),
    );
    const sections: {
      id: string;
      code: string;
      seconds: number;
      arr?: ReturnType<typeof arrOf>;
    }[] = [];
    playable.forEach((p, i) => {
      const code = transformForPlayback(playbackCode(p), {
        transpose,
        bpm,
        timeSignature,
      });
      sections.push({ id: p.id, code, seconds: barsOf(p) * barSeconds, arr: arrOf(p.id) });
      const next = playable[(i + 1) % playable.length];
      const set = breaks?.[p.id];
      const br =
        set && set.chosen !== null && set.chosen !== undefined
          ? set.options[set.chosen]
          : null;
      if (br && next && next.id !== p.id) {
        sections.push({
          id: `break:${p.id}`,
          // sound dials AND transpose are applied LIVE by the mix's decorate() —
          // not baked here. (decorate re-derives loop sections from their part but
          // has no part for a break, so it re-transforms THIS code as the source;
          // baking transpose here made decorate apply it a SECOND time, so breaks
          // played at 2× the transpose — out of key at the seams. bpm is safe to
          // bake because setcpm is idempotent under re-transform; transpose adds.)
          // isBreak pins a short reverb so the break can't inherit an earlier section's
          // long per-orbit reverb tail (the confirmed bleed) — see sanitizeBreakReverb.
          // breakCode = the low-CPU break twin on mobile, the original on desktop.
          code: transformForPlayback(breakCode(br), {
            bpm,
            timeSignature,
            isBreak: true,
          }),
          seconds: barSeconds, // one bar, played once
        });
      }
    });
    return sections;
  }

  // The EXPORT's section list = exactly what the live mix renders. Same code
  // decoration as the mix's decorate(): loops re-derive from the part (never
  // re-transform buildSections' baked code — transpose adds), breaks re-transform
  // their built code, gaining the transpose buildSections deliberately leaves out
  // (bpm re-bakes idempotently), and everyone gets the Sound dials. Same repeats
  // as the arrangement's sectionRepeats(): a finite hold multiplies the section's
  // length (the pattern is cyclic, so longer = more passes), clamped to 64; a
  // legacy ∞ latch plays once — a file can't hold forever.
  function exportSections() {
    return buildSections(parts).map((s) => {
      const isBreak = s.id.startsWith("break:");
      const p = parts.find((x) => x.id === s.id);
      // Repeats bake into seconds for breaks AND (chapters era) plain loops;
      // a legacy spec'd section keeps its authored span instead.
      const h = isBreak || !s.arr ? holdCycles[s.id] : undefined;
      const repeats =
        Number.isFinite(h) && (h as number) >= 1 ? Math.min(64, Math.floor(h as number)) : 1;
      // Same precedence as the live mix: buildSections' arrOf already decided
      // whether a dialled repeat keeps its arrangement (authored-for-the-dial
      // or dropped). With the arrangement in charge, `seconds` reflects its
      // unfolded span so the export progress bar (wall-clock) matches what
      // actually renders.
      const arr = s.arr;
      const arrBars =
        arr && Number.isFinite(arr.bars) ? Math.max(1, Math.floor(arr.bars!)) : null;
      return {
        id: s.id,
        code: transformForPlayback(p ? playbackCode(p) : s.code, {
          transpose,
          bpm,
          timeSignature,
          sound,
          isBreak,
        }),
        seconds: arrBars != null ? arrBars * barSeconds : s.seconds * repeats,
        arr,
      };
    });
  }

  // THE SONG'S LENGTH, as the mix actually plays it: every loop's unfolded
  // span (its chosen bar length), plus each chosen break × its repeat.
  // `repeated` marks that unfolds/repeats shape this length (the readout
  // wears the accent, like a transposed key).
  const mixLength = (() => {
    let seconds = 0;
    let base = 0;
    let infinite = false;
    const mult = (key: string) => {
      const h = holdCycles[key];
      if (h === Infinity) {
        infinite = true;
        return 1;
      }
      return Number.isFinite(h) && h > 1 ? h : 1;
    };
    playableVisible.forEach((p, i) => {
      const loopSec = barsOf(p) * barSeconds;
      base += loopSec;
      // A legacy spec'd section plays its authored span; a chapters-era loop
      // plays its natural length × its repeat latch.
      const a = arrOf(p.id);
      const arrBars = a && Number.isFinite(a.bars) ? Math.max(1, Math.floor(a.bars!)) : null;
      seconds += arrBars != null ? arrBars * barSeconds : loopSec * mult(p.id);
      // Mirrors buildSections: a chosen break plays after this loop when another follows.
      const next = playableVisible[(i + 1) % playableVisible.length];
      const set = plan?.breaks?.[p.id];
      const br = set && set.chosen !== null && set.chosen !== undefined ? set.options[set.chosen] : null;
      if (br && next && next.id !== p.id) {
        base += barSeconds;
        seconds += barSeconds * mult(`break:${p.id}`);
      }
    });
    return { seconds, infinite, repeated: infinite || seconds !== base };
  })();

  const safeName = (ext: string) =>
    `${(song.title || "klappn").replace(/[^\w.-]+/g, "_")}.${ext}`;

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** CODE EXPORT (2026-07-21, the user): the song's Strudel, loop by loop, as
   *  plain text — the code IS the song, and every loop runs on strudel.cc
   *  (Dirt-Samples / gm_ names are the standard palette there). Client-side
   *  only: the page already holds each loop; visuals + meta blocks stripped,
   *  one setcpm header carries the tempo. Instant — no engine, no progress. */
  function exportStrudelCode() {
    const bpm = plan?.bpm ?? 120;
    const beats = Number((timeSignature || "4/4").split("/")[0]) || 4;
    const lines: string[] = [
      `// ${song.title || "Untitled"} — ${bpm} BPM · ${plan?.key ?? "?"} · ${timeSignature}${plan?.genre ? ` · ${plan.genre}` : ""}`,
      "// Made with Klappn. Every «──» section is ONE loop, complete in itself:",
      "// paste one into https://strudel.cc and press play.",
    ];
    playableVisible.forEach((p, i) => {
      let code = stripMetaBlocks(stripHydraBlock(p.strudel || "")).trim();
      if (!code) return;
      // A loop's stored code carries its own setcpm; dress a legacy one that doesn't.
      if (!/\bsetcpm\s*\(/.test(code)) code = `setcpm(${bpm}/${beats})\n${code}`;
      const name = p.label || (p.kind === "break" ? "Break" : `Loop ${i + 1}`);
      lines.push("", `// ── ${i + 1}. ${name} ${"─".repeat(Math.max(2, 40 - name.length))}`, code);
    });
    // THE LOOK RIDES ALONG (2026-07-21, the user): the song's ONE hydra visual
    // (plan.visual canonical; else the block a loop carries) exports too — it
    // runs as-is at hydra.ojack.xyz.
    const hydra =
      (plan as { visual?: { hydra?: string } } | undefined)?.visual?.hydra?.trim() ||
      playableVisible.map((p) => extractHydra(p.strudel)).find(Boolean) ||
      "";
    if (hydra)
      lines.push(
        "",
        `// ── visuals · hydra — runs at https://hydra.ojack.xyz ──`,
        hydra.trim(),
      );
    download(
      new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" }),
      safeName("strudel"),
    );
  }

  async function onExport(format: "wav" | "video") {
    if (exporting) return;
    // The render OWNS the engine — nothing else may sound. Take it from WHOEVER has
    // it, not just from this page: a song or set riding along in the dock never set
    // `playing`/`mixActive` here, so it kept sounding into the render and left a dock
    // insisting it was playing music the exporter had already silenced.
    if (playing || mixActive || nowPlaying()) {
      stop();
      setPlaying(null);
      setMixActive(false);
      clearNowPlaying(); // no session to carry (and `paused` follows it)
    }
    setError(null);

    // VIDEO — the WHOLE mix with its visuals, recorded in real time (the same
    // section sequence as live playback and the WAV export, dials baked in).
    if (format === "video") {
      const sections = exportSections();
      if (sections.length === 0) return;
      const total = sections.reduce((s, x) => s + x.seconds, 0);
      setExportProg({ elapsed: 0, total: Math.max(2, total) });
      try {
        const { blob, mime } = await renderMixToVideo(sections, {
          onProgress: (elapsed, t) => setExportProg({ elapsed, total: t }),
          ending: endingOf(),
          effects: effectsRef.current,
        });
        download(blob, safeName(videoExt(mime)));
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Video export failed.");
      } finally {
        setExportProg(null);
      }
      return;
    }

    // AUDIO (WAV) — the whole track, real time; drive a smooth wall-clock playhead.
    // Sections carry the dials, transpose and dialled repeats (exportSections),
    // so the file matches what the mix plays.
    const sections = exportSections();
    const total = sections.reduce((s, x) => s + x.seconds, 0) || 1;
    setExportProg({ elapsed: 0, total });
    const start = performance.now();
    const id = setInterval(() => {
      setExportProg({
        elapsed: Math.min(total, (performance.now() - start) / 1000),
        total,
      });
    }, 100);
    try {
      download(
        await renderSongToWav(sections, {
          ending: endingOf(),
          effects: effectsRef.current,
        }),
        safeName("wav"),
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      clearInterval(id);
      setExportProg(null);
    }
  }

  const empty = parts.length === 0;

  // The loop the bottom command bar targets: your explicit selection, else the playing loop, else the
  // first loop with music. Selecting a loop (tapping it) just points the shared field at that one.
  // The command bar is OPEN only when you tap a loop's edit (pencil) button — targetLoop is that loop
  // (while it still has music). No auto-default; the bar's ✕ clears the selection and hides it.
  const targetLoop =
    (selectedLoopId && parts.find((p) => p.id === selectedLoopId && p.strudel?.trim())) || null;
  const targetGenerating =
    targetLoop?.status === "generating" || targetLoop?.status === "pending";
  // What the bar shows: submitting (the instant bridge) OR the loop actually reworking.

  // The instant the change is sent, the bar must SAY so — the workflow takes a few seconds to
  // flip the loop to "generating", and that silent gap read as "nothing happened". This local
  // bridge covers it; the poll's targetGenerating takes over (8s outlives any workflow start).
  const [editSubmitting, setEditSubmitting] = useState(false);
  function onEditLoop(text: string) {
    const r = text.trim();
    if (!r || !targetLoop || targetGenerating || editSubmitting) return;
    setEditText("");
    setEditSubmitting(true);
    setTimeout(() => setEditSubmitting(false), 8000);
    fetch(`/api/songs/${songId}/parts/${targetLoop.id}/edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: r }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(d.error || "Couldn’t apply that change.");
          setEditSubmitting(false);
          return;
        }
        void refresh();
      })
      .catch(() => {
        setError("Network error — try again.");
        setEditSubmitting(false);
      });
  }

  return (
    <>
    <main
      className={`mx-auto flex w-full max-w-[34rem] flex-1 flex-col px-5 pb-36 pt-6 transition-opacity duration-700 sm:pt-10 ${
        immersive ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="group -ml-1 flex items-center gap-1 text-[15px] text-muted transition hover:text-foreground"
        >
          <span className="text-lg leading-none transition group-hover:-translate-x-0.5">
            ‹
          </span>
          Loops
        </Link>
        {song.status === "error" && (
          <span className="text-[13px] text-rose-300/75">needs attention</span>
        )}
      </div>

      {/* title + meta */}
      <header className="mt-10">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitleDraft(song.title);
                setEditingTitle(false);
              }
            }}
            maxLength={80}
            className="wordmark -mx-1 w-full rounded-xl bg-white/[0.04] px-1 text-[34px] leading-tight text-foreground outline-none sm:text-[44px]"
          />
        ) : (
          <h1
            onClick={() => {
              setTitleDraft(song.title);
              setEditingTitle(true);
            }}
            title="Rename"
            className="wordmark text-gradient cursor-text text-[34px] leading-tight tracking-tight transition hover:opacity-80 sm:text-[44px]"
          >
            {song.title}
          </h1>
        )}
        {/* ONE header band: the song's identity (meta) with its utilities
            (immerse / export) folded in at the end — no orphan toolbar row. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* While the plan doesn't exist yet (async voice flow: the AI is
              still reading the take), say THAT — never present the fallback
              defaults (120 · A minor · 4/4) as if they were decisions. */}
          {!plan?.bpm ? (
            <span className="shimmer-text text-[12.5px] sm:text-[14px]">
              listening for the key, tempo and feel…
            </span>
          ) : (
          <Settings
            songId={songId}
            bpm={bpm}
            origBpm={origBpmOf(parts, bpm, beatsPerBar(timeSignature))}
            songKey={plan?.key || "A minor"}
            genre={plan?.genre || ""}
            transpose={transpose}
            timeSignature={timeSignature}
            seconds={mixLength.seconds}
            infinite={mixLength.infinite}
            repeated={mixLength.repeated}
            onChanged={refresh}
            onLive={liveReapply}
            onSettingsSaved={onSettingsSaved}
          />
          )}
          {playableVisible.length > 0 && !exporting && (
            // Quiet, borderless utilities — a floating capsule read as clutter
            // (especially on phones, where it wrapped below the meta line).
            // ml-auto keeps them right-aligned even when the row wraps.
            <div className="ml-auto flex items-center gap-1.5">
              {/* ONE word in the corner — "Shape" ⌄ — and it drops the
                  export-menu object: an anchored glass card where EVERY row
                  is a word plus one quiet line saying what the tap does
                  (touch has no hover — the consequence must be ON the card).
                  A menu of one never opens: a single-loop song shows Visuals
                  directly, a composing song shows only Arrange. The sweep
                  pill takes the corner whole when a new loop lands (or the
                  menu row summons it) — its words ARE the consequence, the
                  orb'd word spends, ✕ declines. */}
              {arrange ? (
                <button
                  onClick={() => setArrange(false)}
                  title="Back to the loops"
                  className="flex h-8 items-center rounded-full bg-accent/12 px-3 text-[12.5px] font-medium leading-none text-accent transition duration-200 active:scale-95"
                >
                  Done
                </button>
              ) : sweep === "offer" ? (
                <span className="animate-fade-in flex h-8 items-center gap-0.5 rounded-full bg-accent/12 px-1.5 text-[12.5px] font-medium leading-none">
                  <span className="px-1.5 text-foreground/80">
                    Effects & breaks, the whole song?
                  </span>
                  <button
                    onClick={() => void runSweep()}
                    title="The AI re-hears every loop — effects across the builds, breaks at the turns, replacing every one riding"
                    className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-accent transition duration-200 hover:bg-white/[0.08] active:scale-95"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
                    />
                    Sweep
                  </button>
                  <button
                    onClick={() => setSweep("idle")}
                    aria-label="Not now"
                    className="grid h-6 w-6 place-items-center rounded-full text-muted/60 transition duration-200 hover:text-foreground active:scale-95"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </span>
              ) : sweep === "busy" ? (
                <span className="flex h-8 items-center px-3 text-[12.5px] leading-none">
                  <span className="shimmer-text">Sweeping the song…</span>
                </span>
              ) : busy ? (
                visibleParts.length > 1 ? (
                  <button
                    onClick={() => setArrange(true)}
                    title="Move anything anywhere — no AI, just your hands"
                    className="flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium leading-none text-muted/80 transition duration-200 hover:bg-white/[0.06] hover:text-foreground active:scale-95"
                  >
                    Arrange
                  </button>
                ) : null
              ) : visibleParts.length <= 1 ? (
                <button
                  onClick={() => setVisualsOpen((v) => !v)}
                  title={
                    visualsOpen
                      ? "Close the visuals"
                      : "One living look across the whole piece"
                  }
                  className={`flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium leading-none transition duration-200 active:scale-95 ${
                    visualsOpen
                      ? "bg-accent/12 text-accent"
                      : "text-muted/80 hover:bg-white/[0.06] hover:text-foreground"
                  }`}
                >
                  Visuals
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShapeOpen((v) => !v)}
                    title="Shape the whole song"
                    className={`flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium leading-none transition duration-200 active:scale-95 ${
                      shapeOpen
                        ? "bg-accent/12 text-accent"
                        : "text-muted/80 hover:bg-white/[0.06] hover:text-foreground"
                    }`}
                  >
                    Shape
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className={`transition-transform duration-200 ${shapeOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {shapeOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShapeOpen(false)}
                        aria-hidden
                      />
                      <div className="animate-fade-in absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.05] p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
                        <button
                          onClick={() => {
                            setShapeOpen(false);
                            setVisualsOpen(true);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]"
                        >
                          <span className="block text-[13px] font-medium text-foreground">
                            Visuals
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted/60">
                            One living look across the whole piece
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setShapeOpen(false);
                            setSweep("offer");
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]"
                        >
                          <span className="block text-[13px] font-medium text-foreground">
                            Effects &amp; breaks
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted/60">
                            The AI sweeps the whole song — replacing what rides
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setShapeOpen(false);
                            setArrange(true);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]"
                        >
                          <span className="block text-[13px] font-medium text-foreground">
                            Arrange
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted/60">
                            Move anything anywhere — just your hands
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {anyHydra && (
                <IconBtn
                  onClick={enterImmersive}
                  title="Immerse — full-screen visuals"
                >
                  <ExpandIcon />
                </IconBtn>
              )}
              {/* EVERY song exports as a menu — Audio always, Video when it has
                  visuals, and Code · Strudel always (the code IS the song). */}
              <div className="relative">
                <IconBtn
                  onClick={() => setExportMenu((m) => !m)}
                  title="Export"
                >
                  <DownloadIcon />
                </IconBtn>
                {exportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExportMenu(false)}
                      aria-hidden
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.05] p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
                      <button
                        onClick={() => {
                          setExportMenu(false);
                          onExport("wav");
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
                      >
                        Audio <span className="text-muted/50">· WAV</span>
                      </button>
                      {anyHydra && (
                        <button
                          onClick={() => {
                            setExportMenu(false);
                            onExport("video");
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
                        >
                          Video <span className="text-muted/50">· with visuals</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setExportMenu(false);
                          exportStrudelCode();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
                      >
                        Code <span className="text-muted/50">· Strudel</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </header>

      {/* the visuals panel — the piece's one look, painted and unfolded here.
          The one aux slot under the header; the Visuals pill is its door. */}
      {visualsOpen && playableVisible.length > 0 && !busy && (
        <VisualsPanel
          songId={songId}
          parts={parts}
          playing={playing}
          painting={painting}
          onPaint={(force) => void paintVisuals(force)}
          onLocal={(id, code) => {
            noteLocalEdit(id);
            setParts((ps) =>
              ps.map((p) => (p.id === id ? { ...p, strudel: code } : p)),
            );
          }}
          onClose={() => setVisualsOpen(false)}
        />
      )}

      {/* live render bar — only exists while exporting */}
      {exporting && exportProg && (
        <div className="mt-8">
          <div className="flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 backdrop-blur-md">
            <span className="shimmer-text shrink-0 text-[13px]">Rendering</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
                style={{
                  width: `${Math.min(100, (exportProg.elapsed / exportProg.total) * 100)}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-muted">
              {fmtTime(exportProg.elapsed)} / {fmtTime(exportProg.total)}
            </span>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted/45">
            rendering in real time — keep this tab open
          </p>
        </div>
      )}

      {/* status TOASTS — floating glass pills in the app's own language, never raw text lines.
          Self-heal shows as quiet accent work-in-progress; an error is a rose-tinted pill with ✕. */}
      {(error || repairMsg) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4">
          {repairMsg && (
            <div className="cmdbar-in pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] py-2 pl-3.5 pr-4 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
              <span className="text-[13px]">
                <span className="shimmer-text">{repairMsg}</span>
              </span>
            </div>
          )}
          {error && (
            <div className="cmdbar-in pointer-events-auto flex items-center gap-2.5 rounded-full border border-rose-400/[0.16] bg-rose-400/[0.05] py-2 pl-3.5 pr-2 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/80 shadow-[0_0_8px_rgba(251,113,133,.6)]" />
              <span className="text-[13px] text-rose-100/90">{error}</span>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss"
                className="ml-0.5 grid h-6 w-6 place-items-center rounded-full text-rose-200/50 transition hover:bg-white/[0.06] hover:text-rose-100"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* THE ARRANGE SURFACE — the whole song as movable objects: drag loops,
          slide breaks between seams, delete, drop a new loop into any gap.
          Everything instant, everything deterministic — no AI in a single move. */}
      {!empty && arrange && visibleParts.length > 1 ? (
        <div className="mt-7">
          <ArrangeSurface
            parts={visibleParts}
            breaks={plan?.breaks}
            holds={holdCycles}
            playing={playing}
            paused={paused}
            busy={busy}
            barSeconds={barSeconds}
            barsOf={barsOf}
            onReorder={arrangeReorder}
            onDelete={arrangeDelete}
            onMoveBreak={arrangeMoveBreak}
            onClearBreak={(fromId) => {
              chooseBreak(fromId, null);
              setHold(`break:${fromId}`, undefined);
            }}
            onInsert={arrangeInsert}
            onPlay={(id) => {
              const p = parts.find((x) => x.id === id);
              if (p) void onPlay(p);
            }}
          />
        </div>
      ) : null}

      {/* the loop */}
      {empty || (arrange && visibleParts.length > 1) ? null : (
        <div className="mt-7 space-y-3">
          {/* (No master play button — the loops ARE the transport: tap any one
              and the song flows on from there. Space pauses and resumes.) */}
          {/* Tweaking is PER-TRACK now — each loop's own Tracks section (knobs +
              preset chips per layer). The old merged song-level knob panel is gone. */}
          {/* visuals live at SONG level — one aesthetic for the whole piece —
              but their panel is an AUXILIARY surface now: it opens from the
              header's Visuals pill, in the same slot as the voice studio. */}
          {/* grow the song UPWARD — a new section before the first */}
          {/* (THE MAP removed 2026-07-16, the user: the pinned bar read as
              clutter, worst on mobile. Position lives where the music lives —
              the playing loop's card and its playhead.) */}
          {renderAddPart("before")}
          {visibleParts.map((part, vi) => {
            // Song-level effects living at THIS loop's seams (chapters era):
            // begins-here markers sit above the card, lands-here below it, and
            // while one is open every loop it covers wears the light.
            const songFx = effectsRef.current ?? [];
            const fxStarts = songFx.filter((e) => e.fromId === part.id);
            const fxEnds = songFx.filter(
              (e) => e.toId === part.id && e.toId !== e.fromId,
            );
            const openFx = openFxId
              ? songFx.find((e) => e.id === openFxId)
              : undefined;
            const posOf = (pid: string) =>
              visibleParts.findIndex((p) => p.id === pid);
            const reachOf = (e: { fromId: string; toId: string }) => {
              const a = posOf(e.fromId);
              const b = posOf(e.toId);
              return a >= 0 && b >= a
                ? visibleParts
                    .slice(a, b + 1)
                    .filter((p) => p.strudel?.trim()).length || 1
                : 1;
            };
            const fxLit = (() => {
              const w =
                openFx ??
                (openBrkId
                  ? (overlaysRef.current ?? []).find((o) => o.id === openBrkId)
                  : undefined);
              if (!w) return false;
              const a = posOf(w.fromId);
              const b = posOf(w.toId);
              return a >= 0 && b >= a && vi >= a && vi <= b;
            })();
            // touch the blueprint and its family ANSWERS — by RECESSION, not
            // glow: while a blueprint's panel is open (or its material sounds
            // solo) everything that isn't the blueprint or its own loops fades
            // back. Attention by subtraction — nothing added, nothing "much".
            const litRoot =
              openBlueprintId ??
              (playing && blueprintIds.has(playing) ? playing : null);
            const bpReceded =
              litRoot != null &&
              part.id !== litRoot &&
              chapterRoots[part.id] !== litRoot;
            const seamProps = (e: SongFx, kind: "start" | "end") => ({
              fx: e,
              kind,
              open: openFxId === e.id,
              reach: reachOf(e),
              onToggle: () => {
                const next = openFxId === e.id ? null : e.id;
                setOpenFxId(next);
                if (next && !e.controls?.length) void dressFx(e.id);
              },
              onSlide: (values: { from: number; to: number }, commit: boolean) =>
                slideFx(e.id, values, commit),
              onRevert: () => revertFx(e.id),
              onRemove: () => {
                setOpenFxId(null);
                void removeFx(e.id);
              },
              onReach: (delta: 1 | -1) => reachFx(e.id, delta),
            });
            let playhead: { loopSec: number; delay: number; key: number } | null =
              null;
            if (playing === part.id) {
              const loopBars = barsOf(part);
              const loopSec = loopBars * barSeconds;
              // The bar is a CSS animation (one scaleX sweep per loopSec, looping
              // forever) — buttery-smooth on the compositor. `key` (the play time)
              // restarts it on each play; `delay` phase-aligns it to the audio.
              if (loopBars > 0) {
                // Phase computed LIVE at render (negative animation-delay =
                // elapsed-within-loop): a bar that mounts LATE — the user
                // opens the loop mid-play, the page re-renders — lands at the
                // true position instead of sweeping from 0. Recomputing on
                // re-render is safe: the delay always equals the current
                // phase, so the animation re-anchors onto itself.
                const elapsed =
                  playStart > 0
                    ? ((performance.now() - playStart) / 1000) % loopSec
                    : 0;
                playhead = {
                  loopSec,
                  delay: -elapsed,
                  key: playStart,
                };
              }
            }
            const partGenerating =
              part.status === "generating" || part.status === "pending";
            // Expanded if: it's the only loop, it's still composing, or you've opened
            // it. Expansion is a CLICK, never playback or a page-open default — the
            // slim row already wears its playing state (accent border, glow, pause
            // glyph), so nothing opens on the user's behalf.
            const loopExpanded =
              parts.length <= 1 ||
              partGenerating ||
              openLoops.has(part.id);
            return (
              <Fragment key={part.id}>
              {/* the gap between two loops: the break bead + a slot for a new loop */}
              {vi > 0 && renderGap(visibleParts[vi - 1], part, parts.indexOf(part))}
              {fxStarts.map((e) => (
                <FxSeam key={`fx-start-${e.id}`} {...seamProps(e, "start")} />
              ))}
              {(blueprintIds.has(part.id) ||
                // legacy mid-unfold flag only — NEW loops always wear the
                // plain LoopCard while they grow (v26: no more blueprints)
                (busy &&
                  !partGenerating &&
                  !!(plan as { unfolding?: Record<string, boolean> })
                    ?.unfolding?.[part.id])) ? (
              <BlueprintStrip
                part={part}
                composing={part.status === "generating"}
                unfolding={
                  busy &&
                  !!(plan as { unfolding?: Record<string, boolean> })
                    ?.unfolding?.[part.id]
                }
                playing={playing === part.id}
                paused={paused}
                onPlay={() => void playBlueprint(part)}
                receded={bpReceded}
                fxWalk={
                  (plan as { unfolding?: Record<string, boolean | "fx"> })
                    ?.unfolding?.[part.id] === "fx"
                }
                open={openBlueprintId === part.id}
                onToggle={() =>
                  setOpenBlueprintId((cur) => (cur === part.id ? null : part.id))
                }
                lit={
                  !!selectedLoopId && chapterRoots[selectedLoopId] === part.id
                }
                loopCount={parts.filter((x) => chapterRoots[x.id] === part.id).length}
              />
              ) : (
              <div
                id={`loop-${part.id}`}
                className={`scroll-mt-16 transition-[opacity,box-shadow] duration-300 ${
                  fxLit
                    ? "rounded-3xl shadow-[0_0_0_1px_rgba(224,49,156,.45),0_0_28px_-10px_rgba(224,49,156,.55)]"
                    : bpReceded
                      ? "opacity-40"
                      : ""
                }`}
              >
              <LoopCard
                part={part}
                index={parts.indexOf(part)}
                total={parts.length}
                bpm={bpm}
                transpose={transpose}
                timeSignature={timeSignature}
                sound={sound}
                playing={playing === part.id}
                paused={paused}
                lockPlay={exporting}
                playhead={playhead}
                songId={songId}
                busy={busy}
                onPlay={() => onPlay(part)}
                onChanged={refresh}
                onLocalCode={(code) => {
                  noteLocalEdit(part.id);
                  setParts((ps) =>
                    ps.map((p) =>
                      p.id === part.id ? { ...p, strudel: code } : p,
                    ),
                  );
                }}
                onLocalPart={(patch) => {
                  noteLocalEdit(part.id);
                  setParts((ps) =>
                    ps.map((p) => (p.id === part.id ? { ...p, ...patch } : p)),
                  );
                }}
                onSolo={(layer) => onSoloLayer(part.id, layer)}
                soloedLayer={soloedLayerOf(part.id)}
                onMuteGate={(tracks) => {
                  if (playing === part.id) muteGatePulse({ ...part, tracks });
                }}
                setError={setError}
                expanded={loopExpanded}
                onToggleExpand={() => toggleLoopOpen(part.id, loopExpanded)}
                selected={selectedLoopId === part.id}
                onSelect={() =>
                  setSelectedLoopId((cur) => (cur === part.id ? null : part.id))
                }
                hold={holdCycles[part.id]}
                onHold={(n) => setHold(part.id, n)}
              />
              </div>
              )}
              {fxEnds.map((e) => (
                <FxSeam key={`fx-end-${e.id}`} {...seamProps(e, "end")} />
              ))}
              {(overlaysRef.current ?? [])
                .filter((o) => o.fromId === part.id && breakMoveOf(o.tpl))
                .map((o) => (
                  <BreakSeam
                    key={`brk-${o.id}`}
                    o={o}
                    open={openBrkId === o.id}
                    onToggle={() =>
                      setOpenBrkId((cur) => (cur === o.id ? null : o.id))
                    }
                    onTweak={(patch, commit) => tweakBreak(o.id, patch, commit)}
                    onRevert={() => revertBreak(o.id)}
                    onRemove={() => {
                      setOpenBrkId(null);
                      removeBreak(o.id);
                    }}
                  />
                ))}
              </Fragment>
            );
          })}
          {/* grow the song DOWNWARD — a new section after the last */}
          {renderAddPart("after")}
          {/* how the song ENDS — spatially where the end lives, after the last
              loop. One quiet capsule, tap to flip: ■ it stops and rings out,
              ⟳ it loops forever. Zero AI. Only exists once the song is unfolded. */}
          {playableVisible.length > 0 && !busy && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() =>
                  void flipEnding(
                    plan.arrangement?.ending?.mode === "stop" ? "loop" : "stop",
                  )
                }
                title={
                  plan.arrangement?.ending?.mode === "stop"
                    ? "The song ends here and rings out — tap to loop forever"
                    : "The song loops forever — tap to give it an ending"
                }
                className="flex h-8 items-center gap-2 rounded-full px-4 text-[12.5px] font-medium leading-none text-muted/55 transition duration-200 hover:bg-white/[0.05] hover:text-foreground active:scale-95"
              >
                {plan.arrangement?.ending?.mode === "stop" ? (
                  <>
                    <span className="text-[10px]">■</span> Ends here — rings out
                  </>
                ) : (
                  <>
                    <span className="text-[13px]">⟳</span> Loops forever
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </main>

    {/* COMMAND BAR — one field, floating at the bottom centre, for the WHOLE page. It edits the SELECTED
        loop (tap a loop to point it there; defaults to the playing / first loop). Type a change and the
        router + executor apply it to that loop, song-aware. Hidden while the immersive visual is up. */}
    {!immersive && targetLoop && (
      <>
        {/* a soft scrim so the bar melts into the page instead of cutting across it */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-36 bg-gradient-to-t from-[#060708] via-[#060708]/70 to-transparent"
        />
        <div
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-transform duration-150 sm:bottom-7"
          // ride ABOVE the phone keyboard — fixed-bottom UI is otherwise buried
          // behind it the moment the field focuses (see use-keyboard-inset)
          style={kbInset ? { transform: `translateY(-${kbInset}px)` } : undefined}
        >
          {/* ONE object: chip (which loop) + field + one morphing button. The pill alone carries the
              focus cue — a soft outside glow; nothing inside draws a ring (.cmdbar in globals.css). */}
          <div className="cmdbar cmdbar-in flex w-full max-w-[34rem] items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] py-2 pl-2.5 pr-2 shadow-[0_30px_90px_-26px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl transition-[border-color,box-shadow] duration-300 focus-within:border-accent/35 focus-within:shadow-[0_30px_90px_-26px_rgba(0,0,0,.95),0_0_52px_-12px_rgba(224,49,156,.55),inset_0_1px_0_rgba(255,255,255,.08)]">
            {/* the loop this edits — always visible, even while typing */}
            <span className="flex max-w-[11rem] shrink-0 items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pl-3 pr-3.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)] ${targetGenerating ? "animate-pulse" : ""}`}
              />
              <span className="truncate text-[12px] font-medium text-foreground/85">
                {targetLoop.label?.trim() || "This loop"}
              </span>
            </span>
            <input
              autoFocus
              value={editText}
              maxLength={200}
              disabled={targetGenerating || editSubmitting}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEditLoop(editText);
                } else if (e.key === "Escape") {
                  setSelectedLoopId(null);
                }
              }}
              placeholder={editSubmitting ? "on it…" : targetGenerating ? "reworking…" : "add, remove, reshape anything…"}
              className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-foreground placeholder:text-muted/40 disabled:opacity-50"
            />
            {/* ONE button that morphs: a quiet ✕ while empty, blooming into the gradient send as you
                type — the ✕ fades out as the arrow fades in over the same spot. */}
            <button
              type="button"
              onClick={() =>
                editText.trim() && !targetGenerating && !editSubmitting
                  ? onEditLoop(editText)
                  : setSelectedLoopId(null)
              }
              aria-label={editText.trim() && !targetGenerating && !editSubmitting ? "Apply change" : "Close editor"}
              className="group/act relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-transform duration-200 hover:scale-[1.06] active:scale-95"
            >
              {/* gradient fill — grows in with text (matches the loop play button) */}
              <span
                aria-hidden
                className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-all duration-300 ${
                  editText.trim() && !targetGenerating
                    ? "scale-100 opacity-100 shadow-[0_8px_24px_-6px_rgba(224,49,156,.85),inset_0_1px_0_rgba(255,255,255,.3)] group-hover/act:shadow-[0_0_30px_-2px_rgba(224,49,156,.95),inset_0_1px_0_rgba(255,255,255,.35)]"
                    : "scale-50 opacity-0"
                }`}
              />
              {(editSubmitting || targetGenerating) && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="absolute animate-spin text-accent">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {/* ✕ (empty) ⇄ ↑ (text) — crossfade in place; hidden while working (spinner above) */}
              <svg
                className={`absolute transition-all duration-200 ${
                  editSubmitting || targetGenerating
                    ? "scale-50 opacity-0"
                    : editText.trim()
                      ? "scale-50 opacity-0"
                      : "scale-100 opacity-100 text-muted/50 group-hover/act:text-foreground"
                }`}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <svg
                className={`absolute transition-all duration-200 ${
                  editText.trim() && !targetGenerating && !editSubmitting ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </>
    )}

    {/* immersive overlay — UI is faded out above; the full-screen Hydra canvas
        plays behind. This transparent layer just catches a tap to exit. */}
    {immersive && (
      <div
        onClick={exitImmersive}
        className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center pb-10"
      >
        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[13px] text-white/60 backdrop-blur-md transition pointer-coarse:text-white/90 hover:text-white/90">
          tap or press Esc to exit
        </span>
      </div>
    )}
    </>
  );
}

/* ----------------------------------------------------------------- shared */

/* --------------------------------------------------------------- icon buttons */

function IconBtn({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition duration-200 active:scale-95 disabled:opacity-40 ${
        active
          ? "bg-accent/12 text-accent"
          : "text-muted/80 hover:bg-white/[0.06] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// immerse / full-screen
function ExpandIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

// export to WAV
function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

// settings disclosure caret
function ChevronDown() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// filled, optically-centered play triangle
function PlayGlyph() {
  // Triangle centroid sits exactly at (12,12) — the button center — so no nudge
  // is needed; the rounded stroke just softens the corners.
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M9 6 18 12 9 18 Z" />
    </svg>
  );
}

// two rounded pause bars
function PauseGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4.5" width="4.2" height="15" rx="2.1" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="2.1" />
    </svg>
  );
}

/* ----------------------------------------------------------------- settings */

// The meter chips — just the three everyday feels (straight, waltz, compound).
// A song already in a signature outside this set keeps its own chip, first.
const METERS = ["4/4", "3/4", "6/8"];

function Settings({
  songId,
  bpm,
  origBpm,
  songKey,
  genre,
  transpose,
  timeSignature,
  seconds,
  infinite,
  repeated,
  onChanged,
  onLive,
  onSettingsSaved,
}: {
  songId: string;
  bpm: number;
  origBpm: number;
  songKey: string;
  genre: string;
  transpose: number;
  timeSignature: string;
  seconds: number;
  /** A Forever (∞) repeat is set somewhere — the mix never ends on its own. */
  infinite: boolean;
  /** Repeats shape this length — the readout wears the accent so the change reads. */
  repeated: boolean;
  onChanged: () => Promise<void>;
  onLive: (over: { transpose?: number; bpm?: number }) => void;
  onSettingsSaved: (s: { bpm: number; transpose: number; key: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  // The BPM draft is a STRING so clearing the field shows empty — never a
  // phantom "0" (Number("") is 0; a numeric draft pinned it into the box).
  const [bpmD, setBpmD] = useState(String(bpm));
  const [trD, setTrD] = useState(transpose);
  const [saving, setSaving] = useState(false);
  // METER (restored 2026-07-12; it was locked while the vocal grid needed a
  // fixed signature — the recorded voice is retired, the lock goes with it).
  // Picking a meter fires the server rework (PATCH { timeSignature }): every
  // loop is rewritten in sequence, quota-gated; a meter the song has already
  // worn restores instantly from the plan's meterCache.
  const [meterBusy, setMeterBusy] = useState(false);
  const [meterErr, setMeterErr] = useState<string | null>(null);

  async function changeMeter(ts: string) {
    if (meterBusy || saving || ts === timeSignature) return;
    setMeterBusy(true);
    setMeterErr(null);
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeSignature: ts }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setMeterErr(d.error || "Couldn’t change the meter — try again.");
        return;
      }
      setOpen(false); // the loops are reworking — the page shows it live
      await onChanged();
    } catch {
      setMeterErr("Couldn’t change the meter — try again.");
    } finally {
      setMeterBusy(false);
    }
  }

  const clampBpm = (v: number) => Math.max(40, Math.min(220, Math.round(v)));
  // The draft as a usable number: empty/garbage falls back to the current bpm.
  const draftBpm = () => {
    const v = Number(bpmD);
    return bpmD.trim() !== "" && Number.isFinite(v) && v > 0 ? clampBpm(v) : bpm;
  };

  // Seed the drafts from the live values each time the panel opens (no effect →
  // no prop-sync cascade); when closed the drafts don't matter.
  function toggleOpen() {
    if (open) {
      commitClose(); // re-tapping the trigger to close COMMITS a pending change
      return;
    }
    setBpmD(String(bpm));
    setTrD(transpose);
    setOpen(true);
  }

  async function apply() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: {
            bpm: draftBpm(),
            key: songKey, // metadata stays; transpose is the real re-key
            transpose: Math.max(-12, Math.min(12, Math.round(trD))),
          },
        }),
      });
      if (res.ok) {
        // Optimistically apply the saved tempo/key locally + stamp the save, so a
        // stale refetch can't revert it (the "plays back the old tempo" bug).
        onSettingsSaved({
          bpm: draftBpm(),
          transpose: Math.max(-12, Math.min(12, Math.round(trD))),
          key: songKey,
        });
        await onChanged();
      } else {
        // Save failed on the server — undo the live preview so what plays matches
        // what's actually stored, rather than silently reverting at the next loop.
        onLive({ transpose, bpm });
      }
    } catch {
      // Network rejection — same reconciliation as a non-OK response.
      onLive({ transpose, bpm });
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  function reset() {
    setTrD(0);
    setBpmD(String(origBpm));
    onLive({ transpose: 0, bpm: origBpm });
  }

  const shownKey = transposeKey(songKey, transpose); // for the trigger
  const draftKey = transposeKey(songKey, trD); // live in the panel
  const changed = trD !== 0 || draftBpm() !== origBpm;
  // A pending UNSAVED change (draft differs from what's currently saved). The live
  // preview (onLive) makes a change SOUND applied, so closing the panel without saving
  // silently lost it — the "my tempo change vanished" bug. Clicking away or re-tapping
  // the trigger now COMMITS a pending change; only the explicit Cancel button discards.
  const pending = draftBpm() !== bpm || trD !== transpose;
  function commitClose() {
    if (saving) return;
    if (pending) void apply();
    else setOpen(false);
  }

  // Meta items — a separator only ever sits BETWEEN two of them, never trailing.
  const metaParts: { text: string; cls?: string }[] = [
    ...(genre ? [{ text: sentenceLabel(genre), cls: "text-foreground/80" }] : []),
    { text: `${bpm} BPM`, cls: "tabular-nums" },
    { text: timeSignature, cls: "tabular-nums" },
    { text: shownKey, cls: transpose !== 0 ? "text-accent" : undefined },
    // Duration only once the loop is actually composed — no fake placeholder time.
    // Repeats change it live (2× doubles it, ∞ makes it endless) and light it accent,
    // so what the dial did to the time is always in view.
    ...(seconds > 0
      ? [
          {
            text: infinite ? "∞" : fmtDuration(seconds),
            cls: `tabular-nums${repeated ? " text-accent" : ""}`,
          },
        ]
      : []),
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={toggleOpen}
        // Items NEVER break internally ("126 BPM" must stay one piece); the row
        // wraps BETWEEN items if it must, and runs smaller on phones so it
        // usually fits one quiet line.
        className="group inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted transition hover:text-foreground sm:text-[14px]"
      >
        {metaParts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-muted/30">·</span>}
            <span className={`whitespace-nowrap ${p.cls ?? ""}`}>{p.text}</span>
          </Fragment>
        ))}
        <span className="ml-0.5 text-muted/35 transition group-hover:text-accent">
          <ChevronDown />
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={commitClose}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-white/[0.1] bg-white/[0.05] p-1.5 shadow-[0_40px_100px_-32px_rgba(0,0,0,.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted/45">
                Adjust
              </span>
              {changed && (
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-[12px] text-muted/70 transition hover:text-foreground"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Reset
                </button>
              )}
            </div>
            <div className="space-y-1 px-3 py-1.5">
              <Field label="Tempo">
                <input
                  type="number"
                  min={40}
                  max={220}
                  value={bpmD}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setBpmD(raw); // empty stays EMPTY while typing — never "0"
                    const v = Number(raw);
                    if (raw.trim() !== "" && Number.isFinite(v) && v > 0)
                      onLive({ bpm: clampBpm(v) });
                  }}
                  onBlur={() => {
                    // Leaving the field empty/garbage settles back to the real bpm.
                    if (draftBpm() !== Number(bpmD)) setBpmD(String(draftBpm()));
                  }}
                  className="no-spin w-16 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-right font-mono text-[14px] text-foreground outline-none transition focus:bg-white/[0.08]"
                />
                <span className="ml-1.5 text-[12px] text-muted/70">BPM</span>
              </Field>
              <Field label="Key">
                <span className="font-mono text-[14px] tabular-nums text-foreground/90">
                  {draftKey}
                </span>
              </Field>
              <Field label="Transpose">
                <Stepper
                  value={trD}
                  onChange={(v) => {
                    setTrD(v);
                    onLive({ transpose: v });
                  }}
                  min={-12}
                  max={12}
                  fmt={(v) => (v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`)}
                  unit="st"
                />
              </Field>
              <Field label="Meter">
                <div className="flex items-center gap-1">
                  {(METERS.includes(timeSignature)
                    ? METERS
                    : [timeSignature, ...METERS]
                  ).map((ts) => {
                    const on = ts === timeSignature;
                    return (
                      <button
                        key={ts}
                        onClick={() => void changeMeter(ts)}
                        disabled={meterBusy}
                        aria-pressed={on}
                        className={`rounded-full px-2 py-1 font-mono text-[12px] tabular-nums transition disabled:opacity-50 ${
                          on
                            ? "bg-accent/15 text-accent"
                            : "bg-white/[0.05] text-foreground/80 hover:bg-white/[0.09]"
                        } ${meterBusy && !on ? "animate-pulse" : ""}`}
                      >
                        {ts}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {meterErr && (
                <p className="pt-0.5 text-right text-[12px] text-red-300/90">
                  {meterErr}
                </p>
              )}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 border-t border-white/[0.05] px-2 py-2">
              <button
                onClick={() => {
                  setBpmD(String(bpm));
                  setTrD(transpose);
                  onLive({});
                  setOpen(false);
                }}
                className="rounded-full px-3 py-1.5 text-[13px] text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={saving}
                className="btn-primary rounded-full px-4 py-1.5 text-[14px] font-medium transition active:scale-[.97] disabled:opacity-40"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  fmt,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  fmt: (v: number) => string;
  unit?: string;
}) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted transition hover:bg-white/[0.1] hover:text-foreground active:scale-95 disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={btn}
      >
        −
      </button>
      <span className="w-12 text-center font-mono text-[14px] tabular-nums text-foreground">
        {fmt(value)}
        {unit && <span className="text-[11px] text-muted"> {unit}</span>}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={btn}
      >
        +
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- loop */

// ── per-track cards (layer engine) ────────────────────────────────────────────
// Each generated track gets its own crisp card — label · the model's knobs (live,
// driving its "$:" line directly) · one-tap pills — and they stream in the moment
// each lands, so you can start playing with the loop while it's still building.

// Toggle/remove a track's "$:" line directly on the merged code — for INSTANT,
// optimistic mute + delete (the server re-merges canonically in the background).
function nthLayerLineIndex(lines: string[], layer: number): number {
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\$:/.test(lines[i]) && ++seen === layer) return i;
  }
  return -1;
}
function muteToggleLine(code: string, layer: number, muted: boolean): string {
  const lines = code.split("\n");
  const idx = nthLayerLineIndex(lines, layer);
  if (idx < 0) return code;
  // Strip any silencer first (idempotent), then re-append when muting (last gain wins).
  let line = lines[idx].replace(/\.gain\(\s*0(?:\.0+)?\s*\)/g, "");
  if (muted) line = `${line}.gain(0)`;
  lines[idx] = line;
  return lines.join("\n");
}

function trackKnobStep(c: TrackControl): number {
  const range = Math.abs(c.max - c.min);
  return range <= 2 ? 0.01 : range <= 30 ? 0.1 : 1;
}
function trackKnobFmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
}

function TrackKnob({
  c,
  value,
  disabled,
  onInput,
  onCommit,
}: {
  c: TrackControl;
  value: number;
  disabled: boolean;
  onInput: (v: number) => void;
  onCommit: () => void;
}) {
  const pct = Math.max(
    0,
    Math.min(100, ((value - c.min) / (c.max - c.min || 1)) * 100),
  );
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] text-foreground/80">{c.name}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted/50">
          {trackKnobFmt(value)}
        </span>
      </div>
      <input
        type="range"
        min={c.min}
        max={c.max}
        step={trackKnobStep(c)}
        value={value}
        disabled={disabled}
        onChange={(e) => onInput(Number(e.target.value))}
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onBlur={onCommit}
        className="slider mt-2"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
        }}
      />
    </div>
  );
}

function MuteGlyph({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

// Headphones = "hear this layer alone" (solo/isolate).
function SoloGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M18 13h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1z" />
      <path d="M6 13H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1z" />
    </svg>
  );
}

function TrackCard({
  track,
  layer,
  code,
  interactive,
  busy,
  onKnobInput,
  onKnobCommit,
  onPill,
  onMute,
  onReset,
  onSwapInstrument,
  onSolo,
  soloed,
  readOnly,
  enriching,
  onOpen,
}: {
  track: LoopTrack;
  layer: number;
  code: string;
  interactive: boolean;
  busy: boolean;
  onKnobInput: (layer: number, param: string, v: number) => void;
  onKnobCommit: () => void;
  onPill: (layer: number, pill: TrackPill) => void;
  onMute: (layer: number, muted: boolean) => void;
  onReset: (layer: number) => void;
  onSwapInstrument: (layer: number, via: "sound" | "bank", value: string) => void;
  onSolo: (layer: number) => void;
  soloed: boolean;
  readOnly?: boolean;
  /** The lazy enrich for this layer is in flight (its panel is being written right now). */
  enriching?: boolean;
  /** Fired when the card expands — the parent lazily enriches a panel-less layer. */
  onOpen?: (layer: number) => void;
}) {
  const muted = !!track.muted;
  // Tolerate older parts: controls/pills may be missing, and pre-preset pills were a
  // legacy string[] — only render valid preset chips ({name,set}) so we never call
  // Object.keys on an undefined .set (which crashed the page).
  // Dedupe the panel (defensive, and repairs pre-fix songs in place): drop any `gain` slider —
  // Volume is canonically POSTGAIN, which rides over the layer's patterned gain — and keep only
  // the first control per param, so a layer never shows two "Volume" sliders.
  const seenParam = new Set<string>();
  const controls = (track.controls ?? []).filter(
    (c) => c.param !== "gain" && !seenParam.has(c.param) && (seenParam.add(c.param), true),
  );
  const presets = (track.pills ?? []).filter(
    (p): p is TrackPill =>
      !!p &&
      typeof p === "object" &&
      !!(p as TrackPill).set &&
      typeof (p as TrackPill).set === "object" &&
      // "Original" is its OWN chip (reset) — drop any model preset that duplicates it.
      !/^(original|default|reset|init|initial|neutral|normal|stock|base)$/i.test(
        ((p as TrackPill).name ?? "").trim(),
      ),
  );
  // The chip you tapped stays lit until you move a slider or tap a different chip.
  const [activeChip, setActiveChip] = useState<string | null>(null);
  // Each layer starts COLLAPSED — open the layers section and you get a tidy LIST of voices
  // (names + solo/mute), not a wall of every knob at once. Tap a layer to reveal its knobs.
  const [open, setOpen] = useState(false);
  // Alternative instruments (tap to swap) + the layer's CURRENT sound/kit (highlighted).
  // A DRUM layer (has a .bank()) offers EVERY characterful kit that actually has its
  // drums — detected from the code so it works for every layer, incl. older songs whose
  // stored swap was a narrow kit list (the "only one kit for crash/ride" bug). A MELODIC
  // layer offers the enrich 'sound' alternatives.
  const swap = track.swap;
  const isDrum = /\.bank\(/.test(track.code);
  const swapVia: "sound" | "bank" = isDrum ? "bank" : "sound";
  const curInst = isDrum
    ? track.code.match(/\.bank\(\s*["'`]([^"'`]+)/)?.[1]
    : // leading `s("sine*8")` (no dot) OR chained `.s("gm_pad")`; capture the NAME only (drop a `*8` pulse).
      track.code.match(/\bs(?:ound)?\(\s*["'`]([A-Za-z_][\w:]*)/)?.[1];
  // Drums → all kits that HAVE this layer's drums (bankSupports keeps only compatible
  // ones, so a crash/ride layer gets every kit with that cymbal). Melodic → enrich's list.
  // Drums → a tight, curated handful of kits (filtered to those that HAVE this layer's
  // drums), not all 14 — too many choices overwhelm, same as the melodic side. Melodic →
  // the enrich alternatives.
  const baseOptions = isDrum
    ? DRUM_KITS_OFFERED.filter((k) => bankSupports(k.s, track.code))
    : swap?.via === "sound"
      ? swap.options
      : [];
  const nameFor = (s: string) => (isDrum ? drumKitName(s) : prettySoundName(s));
  // STABLE, deduped, VALIDATED option set. Membership + order do NOT depend on which sound is
  // currently selected — tapping a chip only moves the HIGHLIGHT (curInst === o.s), never the
  // positions (the old prepend-current / append-original logic made the chips jump on each tap).
  // The layer's ORIGINAL sound (origSound once swapped, else the current one before any swap) is
  // always offered first so it stays revertable. Hallucinated alternatives — a name that isn't a
  // real sound/kit, e.g. "gm_pad_polysynth" — are dropped (tapping one throws "sound not found").
  const validSwap = (s: string) => (isDrum ? isKnownBank(s) : isKnownSound(s));
  const original = track.origSound ?? curInst;
  const seenSwap = new Set<string>();
  const displayOptions = [
    ...(original ? [{ name: nameFor(original), s: original }] : []),
    ...baseOptions.filter((o) => o.s && validSwap(o.s)),
  ].filter((o) => o.s && !seenSwap.has(o.s) && (seenSwap.add(o.s), true));

  // READ-ONLY (mobile): no per-layer editing — the loop is fixed audio; tempo/pitch
  // are the only live controls (varispeed). So the Layers section is just a clean
  // GLANCE at what's in the loop: each voice's name + its instrument, no knobs, no
  // expand, no solo/mute/delete. Tells you the ingredients without implying you can
  // re-cook them.
  if (readOnly) {
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5 ${
          muted ? "opacity-45" : ""
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/55" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-foreground/90">
          {track.label ? sentenceLabel(track.label) : `Layer ${layer + 1}`}
        </span>
        {curInst && (
          <span className="shrink-0 truncate text-[11px] font-medium text-muted/45">
            {nameFor(curInst)}
          </span>
        )}
      </div>
    );
  }

  // Has the layer's FEEL drifted from how it was generated (knobs moved off their original
  // values)? Drives the "Signature" Feel chip — lit while at the original feel, so one tap
  // brings the knobs back. The instrument swap is INDEPENDENT now (revert it in the Sound
  // section), so this no longer folds in the sound.
  const atOriginal =
    controls.length > 0 &&
    controls.every((c) => {
      const live = getLayerMethodArg(code, layer, c.param);
      return live == null || Math.abs(live - c.value) < 1e-6;
    });
  const changed = controls.length > 0 && !atOriginal;
  return (
    <div
      className={`animate-rise rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-opacity duration-300 ${
        muted ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            setOpen((o) => {
              // LAZY ENRICH: the panel is composed the FIRST time a layer opens — the parent
              // no-ops when it's already there, so this is free on every later open.
              if (!o) onOpen?.(layer);
              return !o;
            })
          }
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-foreground/95">
            {track.label ? sentenceLabel(track.label) : `Layer ${layer + 1}`}
          </span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-muted/35 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {/* Solo is a pure LOCAL playback overlay (no server write), so it must never be locked by
            `busy` — isolating a layer works even while the loop is still composing (the growth
            hot-swap re-applies the solo as each new layer lands). */}
        <button
          onClick={() => onSolo(layer)}
          aria-label={soloed ? "Stop isolating this layer" : "Hear this layer alone"}
          title={soloed ? "Stop" : "Hear alone"}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/[0.06] active:scale-95 disabled:opacity-40 ${
            soloed ? "text-accent" : "text-muted/55 hover:text-foreground/85"
          }`}
        >
          <SoloGlyph />
        </button>
        <button
          onClick={() => onMute(layer, !muted)}
          disabled={busy}
          aria-label={muted ? "Unmute layer" : "Mute layer"}
          title={muted ? "Unmute" : "Mute"}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/[0.06] active:scale-95 disabled:opacity-40 ${
            muted ? "text-accent" : "text-muted/55 hover:text-foreground/85"
          }`}
        >
          <MuteGlyph muted={muted} />
        </button>
      </div>
      {open && controls.length > 0 && (
        <div className="mt-3.5 grid grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
          {controls.map((c) => {
            const live = getLayerMethodArg(code, layer, c.param);
            return (
              <TrackKnob
                key={c.param}
                c={c}
                value={live ?? c.value}
                disabled={!interactive}
                onInput={(v) => {
                  setActiveChip(null);
                  onKnobInput(layer, c.param, v);
                }}
                onCommit={onKnobCommit}
              />
            );
          })}
        </div>
      )}
      {/* The lazy enrich is writing this layer's knobs/feels/sounds right now — one quiet
          shimmering line, then the panel fades in on the same card (animate-rise above). */}
      {open && enriching && (
        <div className="mt-3.5 text-[12px]">
          <span className="shimmer-text">Dialing in this layer…</span>
        </div>
      )}
      {open && (presets.length > 0 || controls.length > 0) && (
        <div className="mt-3.5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/35">
            Feel
          </div>
          <div className="flex flex-wrap gap-1.5">
            {/* The layer's ORIGINAL feel — lit while it's still at its generated values, so a
                glance shows you're at default and ONE tap brings you back after any change. */}
            {interactive && (
              <button
                disabled={busy}
                onClick={() => {
                  setActiveChip(null);
                  onReset(layer);
                }}
                title={
                  track.signature
                    ? `“${track.signature}” — this layer's original feel`
                    : "Back to the original feel"
                }
                className={`rounded-full px-3 py-1.5 text-[11.5px] transition active:scale-[.97] disabled:opacity-40 ${
                  !changed && !activeChip
                    ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                    : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
                }`}
              >
                {track.signature ? sentenceLabel(track.signature) : "Signature"}
              </button>
            )}
            {presets.map((p) => (
              <button
                key={p.name}
                disabled={busy || !interactive}
                onClick={() => {
                  setActiveChip(p.name);
                  onPill(layer, p);
                }}
                title={`Try the “${p.name}” feel`}
                className={`rounded-full px-3 py-1.5 text-[11.5px] transition active:scale-[.97] disabled:opacity-40 ${
                  activeChip === p.name
                    ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                    : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
                }`}
              >
                {sentenceLabel(p.name)}
              </button>
            ))}
          </div>
        </div>
      )}
      {open && displayOptions.length > 1 && (
        <div className="mt-3.5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/35">
            Sound
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayOptions.map((o) => (
              <button
                key={o.s}
                disabled={busy || !interactive}
                onClick={() => onSwapInstrument(layer, swapVia, o.s)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] transition active:scale-[.97] disabled:opacity-40 ${
                  curInst === o.s
                    ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                    : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// The "live build" loading state — instead of half-guessed names or empty skeletons, the
// loop visibly ASSEMBLES: every layer that lands becomes an animated mixer channel, the
// model narrates what it just placed, and the count climbs. Alive and honest, and the
// loop is playable while it builds.
function BuildingLoop({
  count,
  narration,
}: {
  count: number;
  narration?: string | null;
}) {
  // Deterministic-but-varied widths/speeds per channel so it reads as a real mixer, not a
  // row of identical bars. Keyed off the index, so each new layer's channel is distinct.
  const widths = [70, 55, 64, 48, 60, 52, 67, 45, 62, 58, 50, 66];
  const durs = [1.5, 1.8, 1.4, 2.0, 1.6, 1.9];
  return (
    <div className="animate-fade-in px-5 pb-5 pt-2">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80">
          {narration?.trim() || "Composing your loop…"}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted/45">
          {count > 0 ? `${count} ${count === 1 ? "layer" : "layers"}` : "starting…"}
        </span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`channel-in overflow-hidden rounded-full ${
              i === count - 1 ? "h-2 bg-accent/[0.12]" : "h-[7px] bg-white/[0.06]"
            }`}
            style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}
          >
            <div
              className="channel-level h-full rounded-full bg-accent/80"
              style={{
                width: `${widths[i % widths.length]}%`,
                animationDuration: `${durs[i % durs.length]}s`,
                animationDelay: `${(i % 5) * 0.28}s`,
              }}
            />
          </div>
        ))}
        {count === 0 && (
          <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="channel-level h-full rounded-full bg-accent/60"
              style={{ width: "40%", animationDuration: "1.6s" }}
            />
          </div>
        )}
      </div>
      <div className="mt-3.5 text-[11.5px] text-muted/45">
        building your loop — playable as it goes
      </div>
    </div>
  );
}

function TrackCards({
  tracks,
  code,
  generating,
  narration,
  busy,
  onKnobInput,
  onKnobCommit,
  onPill,
  onMute,
  onReset,
  onSwapInstrument,
  onSolo,
  soloedLayer,
  readOnly,
  enrichingLayers,
  onOpenLayer,
}: {
  tracks: LoopTrack[];
  code: string;
  generating: boolean;
  narration?: string | null;
  busy: boolean;
  onKnobInput: (layer: number, param: string, v: number) => void;
  onKnobCommit: () => void;
  onPill: (layer: number, pill: TrackPill) => void;
  onMute: (layer: number, muted: boolean) => void;
  onReset: (layer: number) => void;
  onSwapInstrument: (layer: number, via: "sound" | "bank", value: string) => void;
  onSolo: (layer: number) => void;
  soloedLayer: number;
  readOnly?: boolean;
  /** Layers whose lazy enrich is in flight (drives the card's shimmer line). */
  enrichingLayers?: ReadonlySet<number>;
  /** Fired on a card's first expand — the parent lazily enriches its panel. */
  onOpenLayer?: (layer: number) => void;
}) {
  // While composing, every layer that has LANDED (it streams in already carrying its Volume
  // knob; the full tweak panel is enriched lazily on the card's first open) shows its real
  // card RIGHT AWAY — inert until the loop is ready (no playback yet, and each new layer
  // still rewrites the loop) — stacked ABOVE a live BUILD indicator for the layers still
  // composing. So the tweak section streams in per-layer instead of one all-or-nothing
  // animation; the cards LIFT into full interactivity the moment the loop is ready.
  if (generating) {
    const landed = tracks.filter((t) => (t.controls?.length ?? 0) > 0).length;
    return (
      <div className="space-y-2.5 px-5 pb-5 pt-2">
        {tracks.map((t, i) =>
          (t.controls?.length ?? 0) > 0 ? (
            <TrackCard
              key={i}
              track={t}
              layer={i}
              code={code}
              interactive
              busy={false}
              onKnobInput={onKnobInput}
              onKnobCommit={onKnobCommit}
              onPill={onPill}
              onMute={onMute}
              onReset={onReset}
              onSwapInstrument={onSwapInstrument}
              onSolo={onSolo}
              soloed={soloedLayer === i}
              readOnly={readOnly}
              enriching={enrichingLayers?.has(i)}
              onOpen={onOpenLayer}
            />
          ) : null,
        )}
        <BuildingLoop count={Math.max(1, tracks.length - landed)} narration={narration} />
      </div>
    );
  }
  return (
    <div className={`px-5 pb-5 pt-2 ${readOnly ? "space-y-1.5" : "space-y-2.5"}`}>
      {tracks.map((t, i) => (
        <TrackCard
          key={i}
          track={t}
          layer={i}
          code={code}
          interactive
          busy={busy}
          onKnobInput={onKnobInput}
          onKnobCommit={onKnobCommit}
          onPill={onPill}
          onMute={onMute}
          onReset={onReset}
          onSwapInstrument={onSwapInstrument}
          onSolo={onSolo}
          soloed={soloedLayer === i}
          readOnly={readOnly}
          enriching={enrichingLayers?.has(i)}
          onOpen={onOpenLayer}
        />
      ))}
    </div>
  );
}

// (Loop repeats are GONE — 2026-07-13. A loop's length is its unfold's bars,
// picked from the AI-authored options; plan.holdCycles now only carries the
// BREAK latches. Old loop latches in saved plans are simply ignored.)

// MEMOISED. A section boundary flips `playing` on exactly TWO cards (old + new)
// and leaves the other 5 with identical data props — but the inline callback props
// (onPlay/onLocalCode/…) get a fresh identity every SongClient render, so without
// this comparator all 7 cards re-render on the scheduler's own main thread at every
// boundary (the song-page-vs-bare-page glitch). We compare DATA props only and
// ignore the callbacks: they are behaviourally stable, and only UNCHANGED, non-
// playing cards skip — a card the user is about to touch (expand/play/pause) always
// re-renders first (its expanded/playing/paused prop changes), refreshing its
// closures before any handler fires. `playhead` is null on non-playing cards, so
// identity compare is correct there.
// ── the UNFOLD, inside the loop card ─────────────────────────────────────────
// The song's structure shown in the loop's own language: one row per layer
// (the same names as the Layers below), each with a lane of bar-cells saying
// exactly WHEN that layer plays across the section's span. Touch paints —
// tap a cell, or press and drag along a row — zero AI, instant. One-way
// material (risers, fills) and sweeps sit under the lanes as chips whose ✕
// removes them. Everything here is the same data playback renders.

// The chips speak in what you HEAR, never parameters. Prefer the model's own
// character (spec.name — written by the arrange call); fall back to a
// deterministic humanization so even a legacy unfold reads cleanly.

/** A sweep's FEEL — the model's own words, sentence-cased at render (the
 *  casing rule holds at generate AND render); deterministic fallback for
 *  legacy unfolds so every chip still reads as a move you hear. */
function sweepCharacter(w: { name?: string; param: string; from: number; to: number }): string {
  if (w.name) return sentenceLabel(w.name);
  const rising = Number(w.to) >= Number(w.from);
  switch (w.param) {
    case "lpf":
      return rising ? "Filter opens" : "Filter closes";
    case "hpf":
      return rising ? "Low-end thins" : "Low-end returns";
    case "gain":
      return rising ? "Swells up" : "Fades down";
    case "room":
    case "roomsize":
      return rising ? "Space widens" : "Space narrows";
    case "shape":
    case "distort":
    case "crush":
      return rising ? "Grit builds" : "Grit eases";
    case "delay":
    case "delayfeedback":
      return rising ? "Echoes bloom" : "Echoes settle";
    default:
      return rising ? `${w.param} rises` : `${w.param} falls`;
  }
}

/** One row of an effect's tweak panel — the SAME visual language as a layer's
 *  knobs (label · value · slider), so effects and layers feel like one system. */
function FxKnob({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onInput,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onInput: (v: number) => void;
  onCommit: () => void;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] text-foreground/75">{label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-muted/50">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onInput(Number(e.target.value))}
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onBlur={onCommit}
        aria-label={label}
        className="slider mt-1.5"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
        }}
      />
    </div>
  );
}

/** THE BLUEPRINT — a song's raw material, kept forever. Not a loop and it
 *  can't be mistaken for one: a slim dashed strip with a HOLLOW orb (matter
 *  not yet materialized — the solid hot orb means the AI is about to act).
 *  Tap → the material opens: what it wanted to be, and every raw layer by
 *  name. It never plays in the song; its loops carry the music. */
function BlueprintStrip({
  part,
  composing,
  unfolding,
  playing,
  paused,
  onPlay,
  open,
  onToggle,
  lit,
  receded,
  fxWalk,
  loopCount,
}: {
  part: Part;
  /** The raw material is still being drawn — layers landing live. */
  composing: boolean;
  /** Panel open (controlled — opening also lights this blueprint's loops). */
  open: boolean;
  onToggle: () => void;
  /** One of its loops is selected — the material answers with its own glow. */
  lit: boolean;
  /** Another blueprint's family holds the floor — this one fades back. */
  receded: boolean;
  /** The loops are done; the effects walk is writing (plan.unfolding = "fx"). */
  fxWalk: boolean;
  /** How many loops this material unfolded into (0 while none yet). */
  loopCount: number;
  unfolding: boolean;
  /** The blueprint is sounding SOLO (its raw layers, all together). */
  playing: boolean;
  paused: boolean;
  onPlay: () => void;
}) {
  const layers = part.tracks ?? [];
  // While the raw material is still being drawn the panel stays open on its
  // own — watching the layers land IS the show; play waits for the material.
  const showPanel = open || composing;
  // SCROLLED INTO THE READER'S BAND → the strip lights on its own, inviting a
  // read (2026-07-14, the user: "light them up as we scroll to them").
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setInView(!!e?.isIntersecting),
      { rootMargin: "-25% 0px -55% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={rootRef}
      id={`loop-${part.id}`}
      className={`scroll-mt-16 transition-opacity duration-300 ${receded ? "opacity-40" : ""}`}
    >
      <div
        className={`group flex w-full items-center gap-2.5 rounded-2xl border border-dashed pr-4 transition duration-500 ${
          open || lit || (playing && !paused)
            ? "border-accent/45 bg-accent/[0.05]"
            : inView
              ? "border-accent/35 bg-accent/[0.03]"
              : "border-white/[0.13] bg-transparent hover:border-accent/40 hover:bg-accent/[0.03]"
        }`}
      >
        {/* the hollow orb IS the play — press the raw material and it sounds
            (all layers together, solo: the one place the full stack lives) */}
        <button
          onClick={onPlay}
          title={
            playing
              ? paused
                ? "Resume the raw material"
                : "Pause"
              : composing
                ? "Hear it take shape — layers land as they're written"
                : "Hear the raw material — every layer at once"
          }
          aria-label={playing ? (paused ? "Resume blueprint" : "Pause blueprint") : "Play the blueprint"}
          className="group/bp grid h-9 w-9 shrink-0 place-items-center self-stretch pl-1.5 transition active:scale-95"
        >
          {playing && !paused ? (
            // sounding: the hollow orb has FILLED with the material
            <span
              aria-hidden
              className="h-3 w-3 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] shadow-[0_0_12px_rgba(224,49,156,.8)]"
            />
          ) : (
            <span
              aria-hidden
              className={`grid h-3 w-3 place-items-center rounded-full border-[1.5px] border-accent/60 transition duration-200 ${
                composing
                  ? "animate-pulse"
                  : "group-hover/bp:border-accent group-hover/bp:shadow-[0_0_10px_rgba(224,49,156,.6)]"
              }`}
            >
              <span className="h-1 w-1 rounded-full bg-accent opacity-0 transition duration-200 group-hover/bp:opacity-100" />
            </span>
          )}
        </button>
      <button
        onClick={onToggle}
        aria-expanded={open}
        title={open ? "Fold the blueprint away" : "See the raw material this song unfolded from"}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left"
      >
        <span className="min-w-0 truncate text-[12.5px] font-medium tracking-tight text-foreground/70">
          {sentenceLabel(part.label || "Blueprint")}
        </span>
        <span className="shrink-0 rounded-full border border-dashed border-accent/30 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-accent/70">
          blueprint
        </span>
        <span className="min-w-0 flex-1" />
        {composing ? (
          <span className="shimmer-text shrink-0 min-w-0 truncate text-[11px]">
            {part.status_message || "composing the raw material…"}
          </span>
        ) : fxWalk ? (
          <span className="shimmer-text shrink-0 text-[11px]">
            writing the effects…
          </span>
        ) : unfolding ? (
          <span className="shimmer-text shrink-0 text-[11px]">
            unfolding into loops…
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-muted/40">
            {layers.length} raw {layers.length === 1 ? "layer" : "layers"}
            {loopCount > 0 && (
              <span className="text-accent/60"> · {loopCount} {loopCount === 1 ? "loop" : "loops"}</span>
            )}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-muted/40 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      </div>
      {showPanel && (
        <div className="animate-fade-in px-4 pb-1 pt-2.5">
          {part.intent && (
            <p className="pb-2.5 text-[12.5px] leading-relaxed text-muted/60">
              {part.intent}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {layers.map((t, i) => (
              <span
                key={i}
                className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] leading-none text-foreground/70"
              >
                {t.label || `Layer ${i + 1}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** THE MOVES a listener can born by hand (zero AI) — each one word, each a
 *  complete glide with its knobs already named. The AI's walk writes freer
 *  shapes; these are the classics a hand reaches for. */
const FX_MOVES: {
  word: string;
  hint: string;
  param: string;
  from: number;
  to: number;
  controls: SweepControl[];
}[] = [
  {
    word: "Darken",
    hint: "the highs close down across it",
    param: "lpf",
    from: 14000,
    to: 400,
    controls: [
      { name: "Starts open", field: "from", min: 400, max: 18000 },
      { name: "Lands dark", field: "to", min: 80, max: 4000 },
    ],
  },
  {
    word: "Brighten",
    hint: "the light comes up across it",
    param: "lpf",
    from: 350,
    to: 12000,
    controls: [
      { name: "Starts dark", field: "from", min: 80, max: 4000 },
      { name: "Lands open", field: "to", min: 1000, max: 18000 },
    ],
  },
  {
    word: "Thin",
    hint: "the low end falls away",
    param: "hpf",
    from: 25,
    to: 900,
    controls: [
      { name: "Starts full", field: "from", min: 20, max: 400 },
      { name: "Lands thin", field: "to", min: 200, max: 3000 },
    ],
  },
  {
    word: "Drown",
    hint: "sinks into space",
    param: "room",
    from: 0,
    to: 0.6,
    controls: [
      { name: "Starts dry", field: "from", min: 0, max: 0.5 },
      { name: "Lands drowned", field: "to", min: 0.2, max: 1 },
    ],
  },
  {
    word: "Fade",
    hint: "falls to silence",
    param: "gain",
    from: 1,
    to: 0,
    controls: [
      { name: "Starts at", field: "from", min: 0, max: 1.2 },
      { name: "Fades to", field: "to", min: 0, max: 1 },
    ],
  },
  {
    word: "Swell",
    hint: "rises from silence",
    param: "gain",
    from: 0,
    to: 1,
    controls: [
      { name: "Starts at", field: "from", min: 0, max: 1 },
      { name: "Rises to", field: "to", min: 0.2, max: 1.2 },
    ],
  },
  {
    word: "Drive",
    hint: "saturation leans in",
    param: "shape",
    from: 0,
    to: 0.45,
    controls: [
      { name: "Starts clean", field: "from", min: 0, max: 0.5 },
      { name: "Lands hot", field: "to", min: 0.1, max: 0.8 },
    ],
  },
  {
    word: "Echo",
    hint: "the room starts answering",
    param: "delay",
    from: 0,
    to: 0.5,
    controls: [
      { name: "Starts dry", field: "from", min: 0, max: 0.5 },
      { name: "Lands wet", field: "to", min: 0.1, max: 0.9 },
    ],
  },
  {
    word: "Squelch",
    hint: "the filter starts to bite",
    param: "resonance",
    from: 0,
    to: 12,
    controls: [
      { name: "Starts soft", field: "from", min: 0, max: 10 },
      { name: "Lands sharp", field: "to", min: 4, max: 25 },
    ],
  },
];

/** AN EFFECT IN THE FLOW — song-level effects (plan.effects) live in the same
 *  linear scroll as the loops. Where one BEGINS, a marker row sits above its
 *  first loop; where it ENDS, a landing row sits below its last. Tap either
 *  and the covered loops light up, the knobs open right there, and Reach ±
 *  stretches or shrinks how many loops it rides — zero AI, heard live. */
function FxSeam({
  fx,
  kind,
  open,
  reach,
  onToggle,
  onSlide,
  onRevert,
  onRemove,
  onReach,
}: {
  fx: SongFx;
  kind: "start" | "end";
  open: boolean;
  /** How many loops the effect covers right now (for the Reach readout). */
  reach: number;
  onToggle: () => void;
  onSlide: (values: { from: number; to: number }, commit: boolean) => void;
  onRevert: () => void;
  onRemove: () => void;
  /** Stretch (+1) / shrink (−1) the effect's reach by one loop. */
  onReach: (delta: 1 | -1) => void;
}) {
  const name = sentenceLabel(fx.name || fx.param);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 py-0.5">
        {kind === "end" && (
          <span
            aria-hidden
            className={`h-px flex-1 bg-gradient-to-l ${
              open
                ? "from-accent/50 to-transparent"
                : "from-accent/[0.22] to-transparent"
            }`}
          />
        )}
        <button
          onClick={onToggle}
          title={
            kind === "start"
              ? `${name} — begins here, riding ${reach} ${reach === 1 ? "loop" : "loops"}`
              : `${name} — lands here`
          }
          className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-2.5 text-[11px] font-medium leading-none backdrop-blur-md transition duration-200 active:scale-95 ${
            open
              ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_18px_-6px_rgba(224,49,156,.8)]"
              : kind === "start"
                ? "border-white/[0.07] bg-white/[0.04] text-accent/80 hover:border-accent/40 hover:text-accent"
                : "border-transparent bg-transparent text-muted/50 pointer-coarse:text-muted/80 hover:border-accent/30 hover:text-accent/80"
          }`}
        >
          {kind === "start" ? (
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full border border-accent/60" />
          )}
          {kind === "start" ? (
            name
          ) : (
            // a WHISPER of the name — enough to know which effect lands here,
            // no chip chrome (2026-07-14: a bare dot was ambiguous with
            // several effects in flight)
            <span className="max-w-[9rem] truncate text-[10px] text-muted/40">
              {name}
            </span>
          )}
        </button>
        {kind === "start" && (
          <span
            aria-hidden
            className={`h-px flex-1 bg-gradient-to-r ${
              open
                ? "from-accent/50 to-transparent"
                : "from-accent/[0.22] to-transparent"
            }`}
          />
        )}
      </div>
      {open && kind === "start" && (
        <div className="animate-fade-in pb-1.5 pt-1">
          <FxPanel
            w={fx}
            caption={`${reach} ${reach === 1 ? "loop" : "loops"}`}
            moved={
              !!fx.home && (fx.from !== fx.home.from || fx.to !== fx.home.to)
            }
            onSlide={onSlide}
            onRevert={onRevert}
            onRemove={onRemove}
            reach={reach}
            onReach={onReach}
          />
        </div>
      )}
    </div>
  );
}

/** An effect's tweak panel — its AI-NAMED knobs (the layer-enrich pattern:
 *  the model names them once, in the music's own language; riding them is
 *  pure math, live, zero AI). Every input writes the spec optimistically
 *  (the mix plays from the same state); release commits to the server.
 *  No knobs yet = the dress call is in flight — a quiet shimmer holds the
 *  space and the next open retries if it failed. */
function FxPanel({
  w,
  caption,
  moved,
  onSlide,
  onRevert,
  onRemove,
  reach,
  onReach,
}: {
  w: {
    name?: string;
    param: string;
    from: number;
    to: number;
    controls?: SongFx["controls"];
  };
  /** WHERE it rides — mirrors the band beside the loops. */
  caption?: string;
  /** True when a knob was ridden away from the AI's home — reveals ↺ Reset. */
  moved: boolean;
  onSlide: (values: { from: number; to: number }, commit: boolean) => void;
  onRevert: () => void;
  onRemove: () => void;
  /** How many loops the effect rides (chapters era) — shows the Reach stepper. */
  reach?: number;
  onReach?: (delta: 1 | -1) => void;
}) {
  const controls = w.controls ?? [];
  const fmtVal = (v: number) =>
    Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  // Two-step remove: ✕ arms (rose "sure?"), a second tap within 3s commits.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const slide = (field: "from" | "to", v: number, commit: boolean) =>
    onSlide(
      { from: field === "from" ? v : w.from, to: field === "to" ? v : w.to },
      commit,
    );
  return (
    <div className="animate-fade-in mt-1.5 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
      {/* header — the feel, where it rides, revert-to-home, and drop */}
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground/85">
          {sweepCharacter(w)}
        </span>
        {caption && (
          <span className="shrink-0 text-[10px] tabular-nums leading-none text-muted/40">
            {caption}
          </span>
        )}
        {moved && (
          <button
            onClick={onRevert}
            title="Back to how the AI set it"
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] leading-none text-muted/55 transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
          >
            ↺ Reset
          </button>
        )}
        <button
          onClick={() => (armed ? onRemove() : setArmed(true))}
          aria-label="Remove this effect"
          title={armed ? "Tap again — it's gone" : "Remove this effect"}
          className={`shrink-0 rounded-full py-1 leading-none transition active:scale-95 ${
            armed
              ? "bg-rose-500/15 px-2.5 text-[10.5px] font-medium text-rose-300"
              : "px-1.5 text-[11px] text-muted/35 hover:text-foreground"
          }`}
        >
          {armed ? "sure?" : "✕"}
        </button>
      </div>
      {controls.length ? (
        <div
          className={`grid gap-x-6 gap-y-3 ${
            controls.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {controls.map((c, i) => (
            <FxKnob
              key={`${c.field}${i}`}
              label={sentenceLabel(c.name)}
              value={c.field === "from" ? w.from : w.to}
              min={c.min}
              max={c.max}
              step={(c.max - c.min) / 100 || 0.01}
              fmt={fmtVal}
              onInput={(v) => slide(c.field, v, false)}
              onCommit={() => onSlide({ from: w.from, to: w.to }, true)}
            />
          ))}
        </div>
      ) : (
        <span className="shimmer-text text-[11px]">naming the knobs…</span>
      )}
      {reach != null && onReach && (
        <div className="flex items-center gap-3 border-t border-white/[0.05] pt-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/45">
            Reach
          </span>
          <span className="h-px flex-1 bg-white/[0.04]" />
          <button
            onClick={() => onReach(-1)}
            disabled={reach <= 1}
            title="One loop fewer"
            aria-label="Shrink the effect by one loop"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-[15px] leading-none text-muted/60 transition hover:border-accent/40 hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            −
          </button>
          <span className="w-14 text-center text-[12px] font-medium tabular-nums text-foreground/85">
            {reach} {reach === 1 ? "loop" : "loops"}
          </span>
          <button
            onClick={() => onReach(1)}
            title="One loop further"
            aria-label="Stretch the effect one loop further"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-[15px] leading-none text-muted/60 transition hover:border-accent/40 hover:text-foreground active:scale-95"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

/** A break lives ON the turn — the seam under the loop it breaks out of.
 *  One ≋ chip centred on the hairline (it is the breaking point, not a span),
 *  tap → BreakPanel. Everything deterministic: the fill only sounds in that
 *  loop's closing bar(s) (lib/breaks-catalog + arrange's mask). Zero AI. */
function BreakSeam({
  o,
  open,
  onToggle,
  onTweak,
  onRevert,
  onRemove,
}: {
  o: BreakOverlay;
  open: boolean;
  onToggle: () => void;
  onTweak: (
    patch: Partial<Pick<BreakOverlay, BreakKnobField>>,
    commit: boolean,
  ) => void;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const move = breakMoveOf(o.tpl);
  const name = sentenceLabel(o.name ?? move?.word ?? o.tpl);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 py-0.5">
        <span
          aria-hidden
          className={`h-px flex-1 bg-gradient-to-l ${
            open
              ? "from-accent/50 to-transparent"
              : "from-accent/[0.22] to-transparent"
          }`}
        />
        <button
          onClick={onToggle}
          title={`${name} — ${move?.hint ?? "a drum fill"}. Breaks this loop into the next`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-2.5 text-[11px] font-medium leading-none backdrop-blur-md transition duration-200 active:scale-95 ${
            open
              ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_18px_-6px_rgba(224,49,156,.8)]"
              : "border-white/[0.07] bg-white/[0.04] text-accent/80 hover:border-accent/40 hover:text-accent"
          }`}
        >
          <span
            aria-hidden
            className="text-[13px] leading-none text-accent [text-shadow:0_0_8px_var(--accent)]"
          >
            ≋
          </span>
          {name}
        </button>
        <span
          aria-hidden
          className={`h-px flex-1 bg-gradient-to-r ${
            open
              ? "from-accent/50 to-transparent"
              : "from-accent/[0.22] to-transparent"
          }`}
        />
      </div>
      {open && (
        <div className="animate-fade-in pb-1.5 pt-1">
          <BreakPanel
            o={o}
            onTweak={onTweak}
            onRevert={onRevert}
            onRemove={onRemove}
          />
        </div>
      )}
    </div>
  );
}

/** The break's tweak panel — FxPanel's body, the break's knobs. Level rides
 *  the fill's own envelope, Heat drives the wave, Tone opens or closes the
 *  top, Space sends it into the room — all four clamped, deterministic,
 *  live. ↺ Reset appears the moment a knob leaves the template's home. */
function BreakPanel({
  o,
  onTweak,
  onRevert,
  onRemove,
}: {
  o: BreakOverlay;
  onTweak: (
    patch: Partial<Pick<BreakOverlay, BreakKnobField>>,
    commit: boolean,
  ) => void;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const move = breakMoveOf(o.tpl);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const val = (f: BreakKnobField) => {
    const v = o[f];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return move ? breakKnobDefault(move, f) : 0;
  };
  const moved =
    !!move &&
    BREAK_KNOBS.some(
      (k) => Math.abs(val(k.field) - breakKnobDefault(move, k.field)) > 0.001,
    );
  const bars = move?.bars ?? 1;
  return (
    <div className="animate-fade-in mt-1.5 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
      {/* header — what it does, where it lands, revert-to-template, and drop */}
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground/85">
          {sentenceLabel(move?.hint ?? "a drum fill")}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums leading-none text-muted/40">
          {bars === 1 ? "last bar" : `last ${bars} bars`}
        </span>
        {moved && (
          <button
            onClick={onRevert}
            title="Back to how the template sets it"
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] leading-none text-muted/55 transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
          >
            ↺ Reset
          </button>
        )}
        <button
          onClick={() => (armed ? onRemove() : setArmed(true))}
          aria-label="Remove this break"
          title={armed ? "Tap again — it's gone" : "Remove this break"}
          className={`shrink-0 rounded-full py-1 leading-none transition active:scale-95 ${
            armed
              ? "bg-rose-500/15 px-2.5 text-[10.5px] font-medium text-rose-300"
              : "px-1.5 text-[11px] text-muted/35 hover:text-foreground"
          }`}
        >
          {armed ? "sure?" : "✕"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {BREAK_KNOBS.map((k) => (
          <FxKnob
            key={k.field}
            label={k.word}
            value={val(k.field)}
            min={k.min}
            max={k.max}
            step={(k.max - k.min) / 100}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onInput={(v) =>
              onTweak(
                { [k.field]: v } as Partial<Pick<BreakOverlay, BreakKnobField>>,
                false,
              )
            }
            onCommit={() =>
              onTweak(
                { [k.field]: val(k.field) } as Partial<
                  Pick<BreakOverlay, BreakKnobField>
                >,
                true,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
function loopCardEqual(
  a: Parameters<typeof LoopCardImpl>[0],
  b: Parameters<typeof LoopCardImpl>[0],
): boolean {
  return (
    a.part === b.part &&
    a.index === b.index &&
    a.total === b.total &&
    a.bpm === b.bpm &&
    a.transpose === b.transpose &&
    a.timeSignature === b.timeSignature &&
    a.sound === b.sound &&
    a.playing === b.playing &&
    a.paused === b.paused &&
    a.lockPlay === b.lockPlay &&
    a.playhead === b.playhead &&
    a.songId === b.songId &&
    a.busy === b.busy &&
    a.soloedLayer === b.soloedLayer &&
    a.expanded === b.expanded &&
    a.selected === b.selected &&
    a.hold === b.hold
  );
}
const LoopCard = memo(LoopCardImpl, loopCardEqual);

function LoopCardImpl({
  part,
  index,
  total,
  bpm,
  transpose,
  timeSignature,
  sound,
  playing,
  paused,
  lockPlay,
  playhead,
  songId,
  busy,
  onPlay,
  onChanged,
  onLocalCode,
  onLocalPart,
  setError,
  onSolo,
  soloedLayer,
  onMuteGate,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
  hold,
  onHold,
}: {
  part: Part;
  index: number;
  total: number;
  bpm: number;
  transpose: number;
  timeSignature: string;
  sound?: MixSound;
  playing: boolean;
  paused: boolean;
  lockPlay: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  playhead: { loopSec: number; delay: number; key: number } | null;
  songId: string;
  busy: boolean;
  onPlay: () => void;
  onChanged: () => Promise<void>;
  onLocalCode: (code: string) => void;
  onLocalPart: (patch: Partial<Part>) => void;
  setError: (s: string | null) => void;
  onSolo: (layer: number) => void;
  soloedLayer: number;
  /** A mute just flipped while this loop sounds — the parent pulses the bus
   *  gates so the layer's ringing voices/tails die NOW, not seconds later. */
  onMuteGate: (tracks: LoopTrack[]) => void;
  selected: boolean;
  onSelect: () => void;
  /** This loop's REPEAT latch (2/4/8, undefined = plays once). */
  hold?: number;
  /** Set/clear the repeat latch — the ⋯ menu's 2×/4×/8× (zero AI). */
  onHold: (n: number | undefined) => void;
}) {
  const [working, setWorking] = useState(false);
  const [compStep, setCompStep] = useState(0);
  // The header's ⋯ menu (edit · repeat · delete — the loop's ONE control). While open, the card
  // lifts above its siblings so the dropdown isn't painted under the next section.
  const [menuOpen, setMenuOpen] = useState(false);

  async function call(method: string, url: string, body?: unknown) {
    setError(null);
    setWorking(true);
    // A network-level rejection must still clear `working`, or the loop card's
    // buttons (busy || working) stay disabled forever until a remount.
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error || `Request failed (${res.status})`);
        return false;
      }
      await onChanged();
      return true;
    } catch {
      setError("Network error — try again.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  const pending = part.status === "pending";
  const generating = part.status === "generating";
  const errored = part.status === "error";
  const hasCode = !!(part.strudel && part.strudel.trim());

  // While composing, cycle through the real pipeline stages so the wait feels
  // alive and reassuring (it's genuinely working — curate → draft → judge →
  // refine → visuals — which takes a while, more so on DeepSeek/MiniMax).
  useEffect(() => {
    if (!generating) {
      setCompStep(0);
      return;
    }
    const id = setInterval(
      () => setCompStep((s) => (s + 1) % COMPOSE_STEPS.length),
      3000,
    );
    return () => clearInterval(id);
  }, [generating]);
  // INSTRUMENTS are this loop's identity — swapped HERE, on the loop itself
  // ("in this loop, play X instead of Y"). The shared knobs + colour dials
  // live up in the song-level Tweak panel.
  const swaps = hasCode ? parseSwaps(part.strudel as string) : [];
  const [instOpen, setInstOpen] = useState(false);
  // Live-apply the loop to the engine, PRESERVING an active solo on THIS loop. Every
  // per-layer edit re-evaluates the WHOLE loop, so without re-applying the solo overlay
  // here, isolating a layer and then touching ANY control (a knob, a preset, a sound
  // swap) would silently drop back to the full mix. soloedLayer is -1 when nothing's
  // soloed, so this is a no-op then.
  const liveLayers = (code: string) => {
    const t = transformForPlayback(code, { transpose, bpm, timeSignature, sound });
    void liveUpdate(soloedLayer >= 0 ? soloLiveCode(t, soloedLayer) : t);
  };
  function swapSound(sw: SoundSwap, to: string) {
    const base = part.strudel || "";
    const from = activeSwapSound(base, sw);
    if (from === to) return;
    const code = applySwap(base, from, to, sw.layer);
    onLocalCode(code);
    if (playing)
      // Warm the incoming sound FIRST — swapping to an unloaded soundfont
      // mid-play makes the layer limp for a couple of beats (heard as the
      // tempo lurching). Usually instant: preload already warmed all options.
      void warmSounds([to]).then(() => liveLayers(code));
    fetch(`/api/songs/${songId}/parts/${part.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "swap", from, to, layer: sw.layer }),
    }).catch(() => {});
  }

  // PER-TRACK tweaks (layer engine): the model's knobs drive each track's "$:" line
  // directly. Mirrors the song-level knob plumbing — optimistic local rewrite + live
  // audio update, with a debounced surgical "track-control" delta write to persist.
  const tracks = part.tracks ?? [];
  // LAZY ENRICH — a layer's knobs/feels/sound alternatives are composed the FIRST time its
  // card is opened, not at generation (tokens were being spent on layers nobody opened).
  // One in-flight call per layer; the server is idempotent (an enriched layer returns with
  // no model call), and the response is the PANEL only — the local code line stays ours.
  // `partRef` gives the async response the LATEST tracks (a mute/knob landed mid-flight
  // must survive the merge), not the ones captured when the tap happened.
  const partRef = useRef(part);
  partRef.current = part;
  const [enrichingLayers, setEnrichingLayers] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  function onOpenLayer(layer: number) {
    const t = (partRef.current.tracks ?? [])[layer];
    if (!t || enrichingLayers.has(layer)) return;
    const hasPanel =
      !!t.enriched ||
      (t.controls ?? []).some((c) => c.param !== "postgain") ||
      (t.pills ?? []).length > 0 ||
      !!t.swap ||
      !!t.signature;
    if (hasPanel) return; // already dressed (or a pre-lazy song) — nothing to fetch
    setEnrichingLayers((s) => new Set(s).add(layer));
    void (async () => {
      try {
        const res = await fetch(`/api/songs/${songId}/parts/${part.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "track-enrich", layer }),
        });
        const d = (await res.json().catch(() => null)) as {
          ok?: boolean;
          panel?: Partial<LoopTrack>;
        } | null;
        if (res.ok && d?.ok && d.panel) {
          const base = partRef.current.tracks ?? [];
          if (base[layer])
            onLocalPart({
              tracks: base.map((x, i) =>
                i === layer
                  ? {
                      ...x,
                      label: d.panel!.label || x.label,
                      signature: d.panel!.signature || x.signature,
                      controls: d.panel!.controls ?? x.controls,
                      pills: d.panel!.pills ?? x.pills,
                      swap: d.panel!.swap,
                      enriched: true,
                    }
                  : x,
              ),
            });
        }
        // Failure is quiet by design: the card keeps its Volume knob and the next open retries.
      } catch {
        /* network hiccup — same quiet fallback */
      } finally {
        setEnrichingLayers((s) => {
          const n = new Set(s);
          n.delete(layer);
          return n;
        });
      }
    })();
  }
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackQueue = useRef<{ layer: number; param: string; value: number }[]>([]);
  function onTrackKnobCommit() {
    if (trackTimer.current) {
      clearTimeout(trackTimer.current);
      trackTimer.current = null;
    }
    const q = trackQueue.current;
    trackQueue.current = [];
    if (!q.length) return;
    // Group queued deltas by layer → ONE atomic PATCH per layer (a preset sets several
    // params at once; per-param PATCHes would race and drop all but one).
    const byLayer = new Map<number, Record<string, number>>();
    for (const { layer, param, value } of q) {
      const m = byLayer.get(layer) ?? {};
      m[param] = value;
      byLayer.set(layer, m);
    }
    for (const [layer, values] of byLayer) {
      fetch(`/api/songs/${songId}/parts/${part.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "track-control", layer, values }),
      }).catch(() => {});
    }
  }
  function onTrackKnobInput(layer: number, param: string, v: number) {
    const base = part.strudel || "";
    const code = setLayerMethodArg(base, layer, param, v);
    if (code !== base) {
      onLocalCode(code);
      if (playing) liveLayers(code);
    }
    trackQueue.current = trackQueue.current.filter(
      (q) => !(q.layer === layer && q.param === param),
    );
    trackQueue.current.push({ layer, param, value: v });
    if (trackTimer.current) clearTimeout(trackTimer.current);
    trackTimer.current = setTimeout(onTrackKnobCommit, 600);
  }
  // Move a track's sliders to a set of {param: value} AT ONCE — shared by preset
  // chips and Reset (both just move sliders, NO AI). Apply all params to the code in
  // one pass (a per-param loop would re-read the same stale base and drop earlier
  // changes), then live-update + persist the deltas.
  function applyTrackSet(layer: number, set: Record<string, number>) {
    const base = part.strudel || "";
    let code = base;
    for (const [param, value] of Object.entries(set)) {
      code = setLayerMethodArg(code, layer, param, value);
    }
    if (code !== base) {
      onLocalCode(code);
      if (playing) liveLayers(code);
    }
    for (const [param, value] of Object.entries(set)) {
      trackQueue.current = trackQueue.current.filter(
        (q) => !(q.layer === layer && q.param === param),
      );
      trackQueue.current.push({ layer, param, value });
    }
    onTrackKnobCommit();
  }
  function onTrackPill(layer: number, pill: TrackPill) {
    applyTrackSet(layer, pill.set);
  }
  // Revert a layer to how it was GENERATED — knobs back to controls[].value AND the
  // instrument back to what it started on (origSound, captured at the first swap). One
  // optimistic write so knobs + sound can't race, one live-update, persisted. This is what
  // the quiet ⟲ in the card header does; it only shows once the layer has actually drifted.
  function onTrackReset(layer: number) {
    const t = (part.tracks ?? [])[layer];
    if (!t) return;
    const base = part.strudel || "";
    let code = base;
    for (const c of t.controls ?? [])
      code = setLayerMethodArg(code, layer, c.param, c.value);
    if (code === base) return; // already at the original feel
    // FEEL only — restore the knobs to their generated defaults WITHOUT touching the
    // instrument. A swapped sound is reverted separately (tap the original in the Sound
    // section), so "back to default feel" never changes what you're playing.
    onLocalCode(code);
    if (playing) liveLayers(code);
    for (const c of t.controls ?? []) {
      trackQueue.current = trackQueue.current.filter(
        (q) => !(q.layer === layer && q.param === c.param),
      );
      trackQueue.current.push({ layer, param: c.param, value: c.value });
    }
    onTrackKnobCommit();
  }
  // Swap a layer's INSTRUMENT (tap an alternative sound/kit) — rewrite the sound on the
  // merged code AND that track's own line optimistically, warm the new sound, live-update,
  // then persist via the track-sound op (the server re-merges canonically).
  function onSwapInstrument(layer: number, via: "sound" | "bank", value: string) {
    const base = part.strudel || "";
    const code = setLayerInstrument(base, layer, via, value);
    if (code === base) return;
    const tracks = (part.tracks ?? []).map((t, i) => {
      if (i !== layer) return t;
      // Capture what it started on (first swap only) so ⟲ can put the instrument back.
      const cur =
        via === "bank"
          ? t.code.match(/\.bank\(\s*["'`]([^"'`]+)/)?.[1]
          : // name only (leading `s(` or chained `.s(`), so ⟲ restores e.g. "sine" and keeps the `*8` pulse.
            t.code.match(/\bs(?:ound)?\(\s*["'`]([A-Za-z_][\w:]*)/)?.[1];
      return {
        ...t,
        code: setLayerInstrument(t.code, 0, via, value),
        ...(t.origSound == null && cur ? { origSound: cur } : {}),
      };
    });
    onLocalPart({ strudel: code, tracks });
    if (playing)
      void warmSounds([value]).then(() => liveLayers(code));
    fetch(`/api/songs/${songId}/parts/${part.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "track-sound", layer, via, value }),
    }).catch(() => {});
  }
  // Mute / delete a track — quick structural ops on the server, then refetch.
  function onTrackMute(layer: number, muted: boolean) {
    // INSTANT: silence the line + flip the card locally + live-update the audio NOW;
    // the server persists in the background (no refetch — the optimistic state is right).
    const code = muteToggleLine(part.strudel || "", layer, muted);
    const tracks = (part.tracks ?? []).map((t, i) =>
      i === layer ? { ...t, muted } : t,
    );
    onLocalPart({ strudel: code, tracks });
    // The mute is baked into `code` (muteToggleLine) — re-apply live, AND pulse
    // the bus gates so the layer's already-ringing voices and tails die NOW
    // (the rewrite alone only silences future events; a pad's release + room
    // tail rang on for seconds and read as "the button doesn't work").
    if (playing) {
      liveLayers(code);
      onMuteGate(tracks);
    }
    fetch(`/api/songs/${songId}/parts/${part.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "track-mute", layer, muted }),
    }).catch(() => {});
  }
  // ONE-TAP "apply to the whole song": push this track's current settings onto the
  // same instrument (matched by sound) in every OTHER loop. Section-only otherwise.
  // Layers start CLOSED — you land on a clean loop (name + brief) and open the layers when
  // you want to tweak. Exception: a loop that's still COMPOSING opens so you watch it build.
  const [layersOpen, setLayersOpen] = useState(() => generating);

  const lit = playing;
  return (
    <div
      style={{ "--i": Math.min(index, 8) } as CSSProperties}
      className={`animate-rise group/card relative rounded-[22px] border bg-white/[0.02] bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-lg transition duration-300 ${
        // Each card is its own stacking context (entrance animation), so the
        // instrument dropdown would paint UNDER the next card unless the card
        // holding the open drawer lifts above its siblings.
        instOpen || menuOpen ? "z-30" : "z-0"
      } ${
        lit
          ? paused
            ? "border-accent/40 from-accent/[0.07]" // held: lit but still
            : "playing-glow border-accent/60 from-accent/[0.12]"
          : selected
            ? // SELECTED (not playing): a single clean accent border + soft glow — no ring/offset (that
              // made a "line inside the line").
              "border-accent/60 from-accent/[0.06] shadow-[0_0_54px_-22px_rgba(224,49,156,.6)]"
            : "border-white/[0.07] hover:border-white/[0.16] hover:from-white/[0.09] hover:shadow-[0_0_60px_-22px_rgba(224,49,156,.45)]"
      }`}
    >
      <div className="flex items-center gap-3 p-4 sm:gap-3.5 sm:p-5">
        {/* play — the mix, from here */}
        <button
          onClick={onPlay}
          disabled={!hasCode || lockPlay}
          title={
            playing
              ? paused
                ? "Resume"
                : "Pause"
              : "Play from here — the song continues on"
          }
          className={`group/play relative mt-0.5 flex shrink-0 items-center justify-center rounded-full text-white transition-[transform,width,height] duration-200 hover:scale-[1.06] active:scale-95 disabled:cursor-default disabled:opacity-30 ${
            expanded ? "h-12 w-12" : "h-9 w-9"
          }`}
        >
          {/* fuchsia→violet fill + glow (brighter while playing) */}
          <span
            aria-hidden
            className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
              playing
                ? "shadow-[0_0_30px_-2px_rgba(224,49,156,.9),inset_0_1px_0_rgba(255,255,255,.25)]"
                : "shadow-[0_10px_28px_-8px_rgba(224,49,156,.85),inset_0_1px_0_rgba(255,255,255,.25)] group-hover/play:shadow-[0_0_34px_-2px_rgba(224,49,156,.9),inset_0_1px_0_rgba(255,255,255,.3)]"
            }`}
          />
          {/* live ring while playing */}
          {playing && (
            <span
              aria-hidden
              className="absolute -inset-[3px] rounded-full ring-1 ring-accent/40"
            />
          )}
          <span className="relative">
            {playing && !paused ? <PauseGlyph /> : <PlayGlyph />}
          </span>
        </button>

        {/* body — the loop's NAME always shows; its description opens with the card */}
        <div className="min-w-0 flex-1">
          <button
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="w-full text-left"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 truncate text-[16px] font-semibold tracking-tight text-foreground">
                {part.label?.trim() || `Loop ${index + 1}`}
              </span>
              <span className="min-w-0 flex-1" />
              {!expanded && !generating && tracks.length > 0 && (
                <span className="flex shrink-0 items-center gap-2.5 text-[11.5px] text-muted/40">
                  {tracks.length} {tracks.length === 1 ? "layer" : "layers"}
                  {Number.isFinite(hold) && (hold as number) > 1 && (
                    <span className="text-accent/80">{hold}×</span>
                  )}
                </span>
              )}
            </span>
            {/* composing status — shown open or closed so a building loop reads clearly */}
            {generating && (
              <span
                key={part.status_message || compStep}
                className="animate-fade-in mt-1 block text-[13px]"
              >
                <span className="shimmer-text">
                  {part.status_message || COMPOSE_STEPS[compStep]}
                </span>
              </span>
            )}
          </button>
          {(pending || errored) && !generating && (
            <button
              onClick={() =>
                call("POST", `/api/songs/${songId}/generate`, {
                  partId: part.id,
                })
              }
              disabled={busy || working}
              className="btn-primary mt-3 rounded-full px-4 py-1.5 text-[14px] font-medium transition active:scale-[.98] disabled:opacity-40"
            >
              {errored ? "Try again" : "Generate"}
            </button>
          )}
        </div>

        {/* ONE control — everything this loop can do lives behind ⋯ (edit · delete). */}
        <div className="relative mt-0.5 shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Loop actions"
            className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 leading-none transition active:scale-95 ${
              menuOpen
                ? "bg-white/[0.08] text-foreground"
                : "bg-white/[0.05] text-muted/45 hover:bg-white/[0.09] hover:text-foreground"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.05] p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
                {/* Editing needs the finished loop — while it's still composing (or has no
                    music yet) the entry point is plainly OFF, not a bar that refuses. */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect();
                  }}
                  disabled={generating || pending || !hasCode}
                  title={
                    generating || pending
                      ? "Editing opens once this loop finishes composing"
                      : undefined
                  }
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-foreground transition hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                  {generating || pending ? "Edit loop — composing…" : "Edit loop"}
                </button>
                {/* REPEAT — hold this loop 2×/4×/8× before the song moves on.
                    Zero AI, tap the active count again to clear it. */}
                {hasCode && !generating && (
                  <div className="flex items-center gap-1 px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mr-1 text-foreground/80">
                      <path d="m17 2 4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="m7 22-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    </svg>
                    {[2, 4, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() => onHold(hold === n ? undefined : n)}
                        title={
                          hold === n
                            ? "Back to a single pass"
                            : `Repeat this loop ${n}×`
                        }
                        className={`rounded-full px-2.5 py-1 text-[12px] font-medium leading-none transition active:scale-95 ${
                          hold === n
                            ? "bg-gradient-to-r from-[#ff63c1] to-accent-strong text-white"
                            : "text-muted/60 hover:bg-white/[0.06] hover:text-foreground"
                        }`}
                      >
                        {n}×
                      </button>
                    ))}
                  </div>
                )}
                {total > 1 && (
                  <>
                    <div className="mx-3 my-1.5 h-px bg-white/[0.06]" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (
                          confirm(
                            "Delete this loop? The loops around it will meet directly.",
                          )
                        )
                          call("DELETE", `/api/songs/${songId}/parts/${part.id}`);
                      }}
                      disabled={busy || working}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-red-300/90 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
                      </svg>
                      Delete loop
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {expanded && (
        <>
      {/* the loop's brief — FULL WIDTH below the header, never squeezed beside the play
          button (which crushed it into a 2-words-per-line column on mobile) */}
      {part.intent && (
        <p className="-mt-1 px-4 pb-3.5 text-[13px] leading-relaxed text-muted/65 sm:px-5">
          {part.intent}
        </p>
      )}
      {/* playhead — fills as the loop plays; only the playing loop (always expanded)
          carries one. A CSS scaleX animation drives it for constant compositor speed. */}
      {playhead && (
        <div className="mx-4 mb-3 sm:mx-5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              key={playhead.key}
              className="h-full w-full origin-left bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_10px_rgba(224,49,156,.5)]"
              style={{
                animation: `playhead-sweep ${playhead.loopSec}s linear infinite`,
                animationDelay: `${playhead.delay}s`,
                // PAUSE freezes the bar in its tracks — the CSS clock holds with
                // the (suspended) audio clock, so resume stays in phase.
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        </div>
      )}

      {/* (Whole-loop notices + whole-loop style chips removed — everything now
          operates per-track: see the Tracks section above.) */}

      {/* TRACKS — the layer engine's per-track panels: each voice with its own
          knobs + pills, streaming in the moment it lands so you can play with the
          loop while it's still building. */}
      {tracks.length > 0 && (
        <div className="border-t border-white/[0.04]">
          <button
            onClick={() => setLayersOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-5 pb-1 pt-3.5 text-left transition hover:opacity-80"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted/45">
              Layers
            </span>
            <span className="h-px flex-1 bg-white/[0.04]" />
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`text-muted/40 transition-transform duration-200 ${layersOpen ? "" : "-rotate-90"}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {layersOpen && (
            <>
          <TrackCards
            tracks={tracks}
            code={part.strudel || ""}
            generating={generating}
            narration={part.status_message}
            busy={working}
            onKnobInput={onTrackKnobInput}
            onKnobCommit={onTrackKnobCommit}
            onPill={onTrackPill}
            onMute={onTrackMute}
            onReset={onTrackReset}
            onSwapInstrument={onSwapInstrument}
            onSolo={onSolo}
            soloedLayer={soloedLayer}
            enrichingLayers={enrichingLayers}
            onOpenLayer={onOpenLayer}
          />
            </>
          )}
        </div>
      )}

      {/* instruments — THIS loop's voices, swapped one for another, on demand */}
      {hasCode && !generating && swaps.length > 0 && (
        <div className="border-t border-white/[0.04]">
          <button
            onClick={() => setInstOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition hover:bg-white/[0.02]"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted/45">
              Instruments
            </span>
            <span className="h-px flex-1 bg-white/[0.04]" />
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`text-muted/40 transition-transform duration-200 ${instOpen ? "" : "-rotate-90"}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {instOpen && (
            <div className="animate-fade-in space-y-4 px-5 pb-5 pt-1">
              {swaps.map((sw) => (
                <SwapRow
                  key={`${sw.layer ?? ""}:${sw.find}`}
                  swap={sw}
                  active={activeSwapSound(part.strudel || "", sw)}
                  onPick={(s) => swapSound(sw, s)}
                />
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

// Your own pills, remembered ACROSS songs (most recent first, capped) — type
// "add trumpets" once and it's one tap forever after.


/* ------------------------------------------------------------------- tweak */

// Granular per-loop SOUND control: the parameterize pass exposed each key number
// as a labelled slider. The CODE is the single source of truth — values are read
// straight from the const lines, and moving a slider rewrites just that const
// (so when a style pill swaps in a whole new variant, the panel simply shows the
// new variant's knobs and defaults). Live hot-swap while playing; persists on
// pointer-up.

// One slider row — shared by the per-loop Tweak and the song-wide Visuals panel.
function SliderRow({
  c,
  hint,
  onInput,
  onCommit,
  onReset,
}: {
  c: ReturnType<typeof parseControls>[number];
  /** The instrument currently playing this knob's layer — derived LIVE from
   *  the code, so it follows every swap ("Chords level · Vibraphone"). */
  hint?: string;
  onInput: (name: string, v: number) => void;
  onCommit: () => void;
  onReset: (name: string, def: number) => void;
}) {
  const fmt = (v: number) =>
    Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
  const changed = c.value !== c.def;
  const pct = Math.max(
    0,
    Math.min(100, ((c.value - c.min) / (c.max - c.min || 1)) * 100),
  );
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13.5px] text-foreground/90">
          {c.label}
          {hint && (
            <span className="text-[11.5px] text-muted/45"> · {hint}</span>
          )}
        </span>
        <button
          onClick={() => changed && onReset(c.name, c.def)}
          title={changed ? "Back to its default" : undefined}
          className={`font-mono text-[12px] tabular-nums tracking-tight transition ${
            changed
              ? "text-accent hover:text-accent-strong"
              : "cursor-default text-muted/50"
          }`}
        >
          {fmt(c.value)}
        </button>
      </div>
      {c.desc && (
        <p className="mt-1 truncate text-[12px] leading-snug text-muted/50">
          {c.desc}
        </p>
      )}
      <input
        type="range"
        min={c.min}
        max={c.max}
        step={c.step}
        value={c.value}
        onChange={(e) => onInput(c.name, Number(e.target.value))}
        // Persist on release — and on a CANCELLED gesture too (finger slides
        // off / scroll steals the pointer), or the change silently never saves
        // and the next refetch snaps the knob back.
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onBlur={onCommit}
        className="slider mt-3"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
    </div>
  );
}


/* ------------------------------------------------------------------- sound */



/* ----------------------------------------------------------------- visuals */

/** Song-wide visual tweaks. The visuals are ONE aesthetic for the whole piece,
 *  so their knobs live here — moving a slider grades EVERY section's visuals in
 *  lockstep (and repaints the playing one live, without touching the audio).
 *  Its own reset walks the look back to how it was painted.
 *  An AUXILIARY sheet (the voice studio's sibling): it opens from the header's
 *  Visuals pill into the same slot, wearing the same machined card. */
function VisualsPanel({
  songId,
  parts,
  playing,
  painting,
  onPaint,
  onLocal,
  onClose,
}: {
  songId: string;
  parts: Part[];
  playing: string | null;
  painting: boolean;
  onPaint: (force?: boolean) => void;
  onLocal: (id: string, code: string) => void;
  onClose: () => void;
}) {
  // The "look" chip you tapped, lit until you nudge a slider (mirrors the layer cards).
  const [activeLook, setActiveLook] = useState<string | null>(null);
  // Knob values touched since the last persist — sent as a delta on commit.
  const touchedValsRef = useRef<Record<string, number>>({});
  // Safety-net commit (see Tweak): a moved knob always saves.
  const vCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const withVisuals = parts.filter((p) => p.strudel && hasHydra(p.strudel));
  // The knobs are the SAME four on every section (the deterministic grade) —
  // read the spec from the first section that carries one.
  const specPart = withVisuals.find(
    (p) => parseVControls(p.strudel as string).length > 0,
  );
  const vcontrols = specPart ? parseVControls(specPart.strudel as string) : [];

  // Persist as a DELTA to every section — the server rewrites only these
  // consts on its CURRENT code, so a stale client can never erase anything
  // (that's how a loop's freshly-painted visuals once got wiped).
  function persistValues(values: Record<string, number>) {
    if (Object.keys(values).length === 0) return;
    for (const p of withVisuals) {
      fetch(`/api/songs/${songId}/parts/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "control", values }),
      }).catch(() => {});
    }
  }
  // Grade every section's visuals with the given values, live.
  function applyTo(targets: Record<string, number>) {
    for (const p of withVisuals) {
      let code = p.strudel as string;
      for (const [n, v] of Object.entries(targets))
        code = setControlValue(code, n, v);
      if (code !== p.strudel) {
        onLocal(p.id, code);
        // Repaint ONLY the visuals — never the audio scheduler.
        if (playing === p.id) void updateVisuals(code);
      }
    }
  }
  function apply(name: string, v: number) {
    setActiveLook(null);
    touchedValsRef.current[name] = v;
    applyTo({ [name]: v });
    if (vCommitTimer.current) clearTimeout(vCommitTimer.current);
    vCommitTimer.current = setTimeout(commit, 600);
  }
  function commit() {
    if (vCommitTimer.current) {
      clearTimeout(vCommitTimer.current);
      vCommitTimer.current = null;
    }
    const values = touchedValsRef.current;
    touchedValsRef.current = {};
    persistValues(values);
  }
  function resetOne(name: string, def: number) {
    setActiveLook(null);
    delete touchedValsRef.current[name];
    applyTo({ [name]: def });
    persistValues({ [name]: def });
  }
  function resetAll() {
    setActiveLook(null);
    touchedValsRef.current = {};
    const targets = Object.fromEntries(vcontrols.map((c) => [c.name, c.def]));
    applyTo(targets);
    persistValues(targets);
  }

  const dirty = vcontrols.some((c) => c.value !== c.def);

  // One-tap "looks" — AI-PROPOSED for this specific visual (the @vlooks block written at paint
  // time, the visual twin of a layer's pills): each is a named set of grade values grounded in
  // what the visual renders. Visuals painted before @vlooks existed fall back to three fixed
  // intensity presets mapped across the knobs. Lights up until you nudge a slider.
  const vlooks = specPart
    ? parseVLooks(specPart.strudel as string)
    : { defaultName: "", looks: [] };
  const aiLooks = vlooks.looks;
  const looks: { name: string; targets: Record<string, number> }[] = aiLooks.length
    ? aiLooks.map((l) => ({
        name: l.name,
        // Clamp each value into its control's real range; unknown controls are dropped.
        targets: Object.fromEntries(
          Object.entries(l.set).flatMap(([k, v]) => {
            const c = vcontrols.find((x) => x.name === k);
            return c ? [[k, Math.min(c.max, Math.max(c.min, v))] as [string, number]] : [];
          }),
        ),
      }))
    : [
        { name: "Calm", frac: 0.25 },
        { name: "Flowing", frac: 0.55 },
        { name: "Intense", frac: 0.9 },
      ].map((l) => ({
        name: l.name,
        targets: Object.fromEntries(
          vcontrols.map((c) => {
            const raw = c.min + l.frac * (c.max - c.min);
            const stepped = c.step ? Math.round(raw / c.step) * c.step : raw;
            return [c.name, Math.min(c.max, Math.max(c.min, Number(stepped.toFixed(4))))];
          }),
        ),
      }));
  function applyLook(look: { name: string; targets: Record<string, number> }) {
    if (Object.keys(look.targets).length === 0) return;
    setActiveLook(look.name);
    touchedValsRef.current = { ...touchedValsRef.current, ...look.targets };
    applyTo(look.targets);
    persistValues(look.targets);
  }

  // No visuals anywhere yet → the whole strip IS the paint action (one gesture, no drawer).
  const nothingPainted = withVisuals.length === 0;

  return (
    <section className="animate-fade-in relative mt-6 overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.03] p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl">
      {/* NO icon — the sheet IS light: a slow-drifting aurora lives inside it
          (the same life as the page's backdrop), swelling while it paints. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-[-30%] transition-opacity duration-500 ${
          painting ? "opacity-100" : "opacity-60"
        }`}
        style={{
          background:
            "radial-gradient(42% 60% at 18% 30%, rgba(224,49,156,.13), transparent 70%), radial-gradient(46% 64% at 82% 70%, rgba(168,85,247,.12), transparent 70%)",
          filter: "blur(18px)",
          animation: "aurora 16s ease-in-out infinite alternate",
        }}
      />
      {/* header row — same anatomy as the voice sheet: dot, name, ✕ */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/85">
            Visuals
          </span>
          {painting && (
            <span className="shimmer-text min-w-0 truncate text-[11px]" aria-live="polite">
              painting…
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close the visuals"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted/60 transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {nothingPainted ? (
        // No visuals anywhere yet → the whole strip IS the paint action.
        <button
          onClick={() => {
            if (!painting) onPaint(false);
          }}
          disabled={painting}
          className="relative mt-4 w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-4 text-left transition duration-300 hover:border-accent/35 hover:shadow-[0_0_40px_-18px_rgba(224,49,156,.5)] active:scale-[.99] disabled:cursor-default"
        >
          <span className="block text-[13px] text-foreground/85">
            {painting ? (
              <span className="shimmer-text">
                Painting one living look across the piece…
              </span>
            ) : (
              "Tap to paint one living look across the whole piece"
            )}
          </span>
        </button>
      ) : (
        <div className="relative mt-5 space-y-5">
          {vcontrols.length > 0 && (
            <>
              <div>
                <div className="mb-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted/35">
                    Look
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* The piece's ORIGINAL look — lit while the grade is untouched, so a glance
                      shows you're at default and ONE tap brings the visuals back after a change. */}
                  <button
                    onClick={resetAll}
                    title="Back to the original look"
                    className={`rounded-full px-3 py-1.5 text-[11.5px] transition active:scale-[.97] ${
                      !dirty && !activeLook
                        ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                        : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
                    }`}
                  >
                    {vlooks.defaultName ? sentenceLabel(vlooks.defaultName) : "Default"}
                  </button>
                  {looks.map((l) => (
                    <button
                      key={l.name}
                      onClick={() => applyLook(l)}
                      title={`A ${l.name.toLowerCase()} look`}
                      className={`rounded-full px-3 py-1.5 text-[11.5px] transition active:scale-[.97] ${
                        activeLook === l.name
                          ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                          : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
                      }`}
                    >
                      {sentenceLabel(l.name)}
                    </button>
                  ))}
                  {/* re-roll the whole piece's look — a dashed "make a new one"
                      chip at the end of the row, a peer of the looks it replaces. */}
                  <button
                    onClick={() => onPaint(true)}
                    disabled={painting}
                    title="Paint a fresh look for the whole piece"
                    className="rounded-full border border-dashed border-white/[0.16] px-3 py-1.5 text-[11.5px] text-muted/55 transition hover:border-accent/50 hover:bg-accent/10 hover:text-accent active:scale-[.97] disabled:opacity-40"
                  >
                    {painting ? <span className="shimmer-text">painting</span> : "↻ Repaint"}
                  </button>
                </div>
              </div>
              {vcontrols.map((c) => (
                <SliderRow
                  key={c.name}
                  c={c}
                  onInput={apply}
                  onCommit={commit}
                  onReset={resetOne}
                />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** One layer's instrument, as a single-choice control: the CURRENT sound shows
 *  as a quiet pill; tapping it opens a small menu of alternatives (✓ on the
 *  active one). Reads instantly as "pick one", never as a tag cloud. */
function SwapRow({
  swap,
  active,
  onPick,
}: {
  swap: SoundSwap;
  active: string;
  onPick: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The original is shown by its INSTRUMENT NAME (so you know what you're coming
  // back to), with a quiet "original" tag in the menu.
  const origLabel = swap.findLabel?.trim() || prettySoundName(swap.find);
  // Dedupe by sound name so two labels can't point at the same sound (which made
  // several rows read as "selected" at once).
  const seen = new Set<string>();
  const opts = [{ s: swap.find, label: origLabel }, ...swap.options].filter(
    (o) => (seen.has(o.s) ? false : (seen.add(o.s), true)),
  );
  // No genuine alternatives (all options collapsed to the original) → no row.
  if (opts.length < 2) return null;
  // Active by INDEX (a value can collide; a position can't) → exactly one ✓.
  const currentIdx = Math.max(
    0,
    opts.findIndex((o) => o.s === active),
  );
  const current = opts[currentIdx];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-[13.5px] text-foreground/90">
        {swap.label}
      </span>
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition active:scale-[.97] ${
            current.s === swap.find
              ? "bg-white/[0.05] text-foreground/80 hover:bg-white/[0.09]"
              : "bg-accent/15 text-accent hover:bg-accent/20"
          }`}
        >
          {current.label}
          <span
            className={`text-[9px] leading-none text-muted/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.05] p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
              {opts.map((opt, i) => (
                <button
                  key={opt.s}
                  onClick={() => {
                    setOpen(false);
                    onPick(opt.s);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
                >
                  <span className="truncate">
                    {opt.label}
                    {i === 0 && (
                      <span className="ml-1.5 text-[11px] text-muted/55">
                        original
                      </span>
                    )}
                  </span>
                  {i === currentIdx && (
                    <span className="shrink-0 text-[12px] text-accent">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

