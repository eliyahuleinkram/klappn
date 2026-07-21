"use client";

// RETIRED 2026-07-12 — voice moved to live sets. Nothing mounts this
// component anymore (the song page's Sing pill and its plumbing are gone);
// it is kept for reference. The /api vocal routes and lib/vocal-* stay
// dormant; saved takes remain on the server but no longer play.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  createVoiceRecorder,
  decodeToRaw,
  processTake,
} from "@/lib/vocal-client";
import {
  VOCAL_PRESETS,
  defaultVocalFx,
  type VocalFxSettings,
} from "@/lib/vocal-fx";
import {
  scaleFromKey,
  shiftScale,
  type ProcessInput,
  type ProcessOutput,
} from "@/lib/vocal-pipeline";
import {
  attachVocal,
  setLiveVocalCharacter,
  setVocalFx,
  soloVocal,
  stopSolo,
  vocalPosition,
  vocalState,
} from "@/lib/vocal-layer";
import {
  ensureEngineStarted,
  getEngineAudioContext,
  serverLoopSink,
} from "@/lib/strudel-client";

/**
 * THE VOICE STUDIO — sing over your song, and the machine meets you halfway.
 *
 * A SONG HAS ONE VOICE — and RECORDING IS THE ONLY WAY IN. No takes, no
 * list, no files-feeling: opening the studio when the song already has a
 * voice lands you straight on it (fetched, decoded, its saved knobs
 * restored). The lifecycle is one straight line: record → it IS the voice →
 * Remove (confirmed inline) → record again.
 *
 * ONE WAY TO RECORD — WITH THE SONG, headphones on. The song plays from the
 * top and you're already rolling; one worklet on the engine's context
 * captures the RAW mic and the engine's own output sample-locked, so the
 * pipeline subtracts the actual music instead of letting browser AEC warble
 * the voice. (A silent/beat-dots mode existed and was killed by verdict: the
 * visuals don't help — headphones are the way.) The mic is a CHOICE: a quiet
 * device capsule in the idle view lists every audioinput once permission
 * exists (USB interfaces just show up), the pick persists in localStorage
 * and rides getUserMedia as deviceId:{exact} on both capture paths.
 *
 * One sheet, one flow: record → the pipeline cleans, tunes and times it →
 * the WAVEFORM is the voice (drag to select, cut what you don't want — cuts
 * survive every re-process; TAP to play from right there) → LOOKS are one
 * tap (six house presets, plus three the song itself names after ✦ asks
 * Fable to listen).
 *
 * THERE IS NO SAVE BUTTON — AND NO SAVE UI AT ALL. The moment processing
 * lands, the voice IS in the song (auto-saved; every knob/cut/voice change
 * syncs itself, debounced, update-in-place on the same row). Sync is SILENT;
 * only a failed save speaks, through the red error line. THE TRANSPORT LIVES
 * HERE TOO: a play control in the header plays the song (the voice riding,
 * as everywhere), tap-to-seek on the waveform plays from there, and the
 * headphone icon solos the voice by itself (lib/vocal-layer soloVocal — same
 * chain, no song). The header is exactly: dot · VOICE · play · solo · fold ·
 * close. FX knobs land on the live layer, and the waveform's playhead
 * follows whichever is sounding. Scrap is the only deliberate act. The whole
 * sheet folds to a slim capsule from its header — state survives the fold.
 */

interface Take {
  id: string;
  title: string | null;
  duration_ms: number;
  fx: Partial<VocalFxSettings>;
  created_at: string;
  anchor_part_id?: string | null;
  anchor_offset_sec?: number | null;
}
interface Raw {
  left: Float32Array;
  right?: Float32Array;
  sampleRate: number;
  trimMs: number;
  /** Engine-output reference recorded alongside the RAW mic — the offline
   *  echo canceller's far end. Kept with the raw take so knob re-runs cancel
   *  from the original every time. */
  ref?: Float32Array;
  refSampleRate?: number;
}
interface Look {
  tune: number;
  timing: number;
  clean: number;
  fx: VocalFxSettings;
}

type VoiceCharacter = NonNullable<ProcessInput["character"]>;

/** VOICES — one-tap identities for people who don't love their own voice.
 *  `character` is DSP (transpose/formant/flatten, BAKED into the render by
 *  the pipeline's PSOLA pass); `fx` is an optional live patch on the seat
 *  chain. Phone is honest about itself: the telephone is pure FX color (air 0
 *  + hot drive band-limits the tone), no pitch move — so its character is
 *  null and only the patch applies. Robot leaves flattenHz unset so the
 *  pipeline flattens to the take's own median f0. */
const VOICES: {
  id: string;
  label: string;
  character: VoiceCharacter | null;
  fx?: Partial<VocalFxSettings>;
}[] = [
  { id: "you", label: "You", character: null },
  { id: "chipmunk", label: "Chipmunk", character: { semis: 5, formant: 1.35 } },
  { id: "helium", label: "Helium", character: { semis: 3, formant: 1.5 } },
  { id: "deep", label: "Deep", character: { semis: -4, formant: 0.82 } },
  { id: "giant", label: "Giant", character: { semis: -7, formant: 0.7 } },
  {
    id: "robot",
    label: "Robot",
    character: { flatten: 1, flattenHz: null },
    fx: { drive: 0.45, glow: 0.3, echo: 0.2 },
  },
  {
    id: "phone",
    label: "Phone",
    character: null,
    fx: { air: 0, drive: 0.7, glow: 0, echo: 0.05, space: 0.05 },
  },
  {
    id: "ghost",
    label: "Ghost",
    character: { semis: 2, formant: 1.15 },
    fx: { space: 0.9, echo: 0.4, level: 0.8 },
  },
];

interface Props {
  songId: string;
  bpm: number;
  keyName: string | null;
  /** The song's CURRENT transpose (semitones). Recording tunes the voice to
   *  the TRANSPOSED scale (the singer sang along with the transposed song);
   *  a change while the studio is open re-runs the pipeline so the voice
   *  follows the song into its new key. */
  transpose: number;
  /** RECORDING transport: start the mix from the top with the song's voice
   *  layer held OUT (the old voice must not print into the raw mic).
   *  Resolves when the engine is sounding — with THE ANCHOR: the first loop
   *  of the mix and where it begins on the take's timeline (usually 0), so
   *  the voice stays glued to its loop when the arrangement changes. */
  playFromTop: () => Promise<{
    anchorPartId: string;
    anchorOffsetSec: number;
  } | null>;
  /** LISTENING transport: play the song (the voice riding, as everywhere)
   *  from the section containing `sec` — null/0 = from the top. */
  playFromSec: (sec: number | null) => Promise<void>;
  /** The song is sounding right now (the page's transport state). */
  mixPlaying: boolean;
  stopMix: () => void;
  onClose: () => void;
  /** The song-level mute — carried through every save so a knob tweak can
   *  never un-mute the voice behind the user's back. */
  muted?: boolean;
  /** Flip the song-level mute (the page owns the flag AND the live layer);
   *  worn in the header as a small speaker pill, lit while the voice sounds. */
  onToggleMuted?: () => void;
  /** THE SONG'S VOICE as the page already knows it — when present, the studio
   *  opens straight onto it (ready view) instead of the idle screen. */
  initialTake?: {
    id: string;
    fx: Record<string, unknown>;
    durationMs: number;
    anchorPartId?: string | null;
    anchorOffsetSec?: number | null;
  } | null;
  /** The decoded render, when the page already holds it (a previous play or
   *  studio session) — skips the fetch on open. */
  initialBuffer?: AudioBuffer;
  /** The song page's window onto the song's ONE voice: fired after every
   *  auto-save / remove. `buffer` rides along when the AUDIO changed (the
   *  decoded dry render — exactly what the vocal layer plays), so the page
   *  never re-downloads what the studio already has. */
  onTakeChanged?: (
    take: {
      id: string;
      fx: Record<string, unknown>;
      durationMs: number;
      anchorPartId: string | null;
      anchorOffsetSec: number;
    } | null,
    buffer?: AudioBuffer,
  ) => void;
}

type Stage = "idle" | "loading" | "recording" | "processing" | "ready";

// --- the mic: pick the device once, it sticks ---------------------------------

const MIC_KEY = "klappn:voice-mic";

interface MicDevice {
  deviceId: string;
  label: string;
}

/** Device labels arrive as hardware strings — strip the noise ("Default -"
 *  prefixes, "(Built-in)", USB vendor:product hex ids), keep the name. */
function cleanMicLabel(label: string): string {
  return (
    label
      .replace(/^(default|communications)\s*[-–]\s*/i, "")
      .replace(/\s*\((built-?in|[0-9a-f]{4}:[0-9a-f]{4})\)\s*/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || "Microphone"
  );
}

/** 🎧 when the label smells like a headset (its mic travels with the ears);
 *  🎙 for everything else — built-ins, USB mics, interfaces. */
function micIcon(label: string): string {
  return /headphone|headset|earbud|airpod|bluetooth|hands-?free|buds/i.test(label)
    ? "🎧"
    : "🎙";
}

// --- the waveform: the take you can touch ------------------------------------

function Waveform({
  buffer,
  cuts,
  selection,
  onSelect,
  onTap,
  position,
  solo,
}: {
  buffer: AudioBuffer;
  cuts: { start: number; end: number }[];
  selection: { a: number; b: number } | null;
  onSelect: (sel: { a: number; b: number } | null) => void;
  /** TAP-TO-SEEK: a tap (no drag) plays from that time. Drag still selects. */
  onTap: (t: number) => void;
  /** Playhead position — rides the SONG's vocal layer (lib/vocal-layer). */
  position: () => number | null;
  /** Soloing — the voice alone; the wave brightens to say so. */
  solo: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ t0: number; moved: boolean } | null>(null);
  const dur = buffer.duration;

  // Peak pairs (min/max) per bucket — computed once per buffer.
  const peaks = useMemo(() => {
    const N = 700;
    const d = buffer.getChannelData(0);
    const per = Math.max(1, Math.floor(d.length / N));
    const out = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      let mn = 0;
      let mx = 0;
      const s = i * per;
      const e = Math.min(d.length, s + per);
      for (let j = s; j < e; j += 4) {
        const v = d[j];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      out[i * 2] = mn;
      out[i * 2 + 1] = mx;
    }
    return out;
  }, [buffer]);

  useEffect(() => {
    let live = true;
    let last = 0;
    const draw = (ts: number) => {
      if (!live) return;
      requestAnimationFrame(draw);
      if (ts - last < 33) return; // ~30fps is plenty for a strip
      last = ts;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const n = peaks.length / 2;
      const mid = h / 2;
      const inCut = (t: number) =>
        cuts.some((c) => t >= c.start && t <= c.end);
      for (let i = 0; i < n; i++) {
        const x = (i / n) * w;
        const t = (i / n) * dur;
        const mn = peaks[i * 2];
        const mx = peaks[i * 2 + 1];
        g.fillStyle = inCut(t)
          ? "rgba(255,255,255,0.07)"
          : solo
            ? "rgba(255,142,208,0.55)" // soloing — the voice alone, lit
            : "rgba(255,255,255,0.30)";
        const yTop = mid - mx * (mid - 2);
        const yBot = mid - mn * (mid - 2);
        g.fillRect(x, yTop, Math.max(1, w / n - 0.5), Math.max(1, yBot - yTop));
      }
      // selection wash
      if (selection) {
        const x0 = (selection.a / dur) * w;
        const x1 = (selection.b / dur) * w;
        g.fillStyle = "rgba(224,49,156,0.16)";
        g.fillRect(x0, 0, x1 - x0, h);
        g.fillStyle = "rgba(255,99,193,0.8)";
        g.fillRect(x0, 0, 1, h);
        g.fillRect(x1, 0, 1, h);
      }
      // playhead
      const pos = position();
      if (pos !== null) {
        const x = (pos / dur) * w;
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#ff63c1");
        grad.addColorStop(1, "#b3126f");
        g.fillStyle = grad;
        g.fillRect(x - 1, 0, 2, h);
      }
    };
    requestAnimationFrame(draw);
    return () => {
      live = false;
    };
  }, [peaks, cuts, selection, position, dur, solo]);

  const timeAt = (clientX: number) => {
    const el = canvasRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur));
  };

  return (
    <canvas
      ref={canvasRef}
      // max-w-full is LOAD-BEARING: the draw loop writes the canvas's width
      // ATTRIBUTE (clientWidth × dpr), which becomes its intrinsic size — and a
      // replaced element's intrinsic width sets the grid track's min-content
      // unless max-width caps it. Without this, one wide first paint locked
      // every knob row 200px past the card edge on phones.
      className="h-[72px] w-full max-w-full cursor-crosshair touch-none rounded-xl border border-white/[0.07] bg-black/30"
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone — the drag still tracks via move/up */
        }
        drag.current = { t0: timeAt(e.clientX), moved: false };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const t = timeAt(e.clientX);
        if (Math.abs(t - drag.current.t0) > 0.02) {
          drag.current.moved = true;
          onSelect({
            a: Math.min(drag.current.t0, t),
            b: Math.max(drag.current.t0, t),
          });
        }
      }}
      onPointerUp={(e) => {
        // Tap (no drag) = SEEK: clear any selection and play from there.
        if (drag.current && !drag.current.moved) {
          onSelect(null);
          onTap(timeAt(e.clientX));
        }
        drag.current = null;
      }}
    />
  );
}

// --- knobs --------------------------------------------------------------------

function Knob({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    // min-w-0 twice over: on the label so the GRID track it sits in can
    // shrink below the row's content width, and on the range input so the
    // FLEX row inside can compress — without both, the intrinsic min-width
    // of a range input pushed the knob rows out past the card border.
    <label className="flex w-full min-w-0 items-center gap-3 text-[12px] text-muted">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="slider knob-flex min-w-0"
      />
      <span className="w-8 shrink-0 text-right tabular-nums text-muted/70">
        {Math.round(value * 100)}
      </span>
    </label>
  );
}

// --- the studio ----------------------------------------------------------------

export default function VoiceStudio({
  songId,
  bpm,
  keyName,
  transpose,
  playFromTop,
  playFromSec,
  mixPlaying,
  stopMix,
  onClose,
  muted,
  onToggleMuted,
  initialTake,
  initialBuffer,
  onTakeChanged,
}: Props) {
  // A song with a voice opens ONTO it — no idle screen in between (the
  // restore effect below fetches/decodes and lands in "ready").
  const [stage, setStage] = useState<Stage>(initialTake ? "loading" : "idle");
  // A knob-turn RE-RUN in flight while stage stays "ready" — the voice on the
  // bench never unmounts, only a small busy chip appears (see runPipeline).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // THE SONG'S ONE VOICE ROW — survives re-records (a new take PUT-replaces
  // this same id; rows never accumulate). Null only when the song has none.
  const [savedTakeId, setSavedTakeId] = useState<string | null>(
    initialTake?.id ?? null,
  );
  // SOLO — the voice alone, no song (lib/vocal-layer soloVocal). Leaving solo
  // stops it; solo deliberately ignores the song-level mute flag.
  const [solo, setSolo] = useState(false);
  // HONESTY FLAG — the recorder had to take the browser-AEC fallback (no
  // engine tap = no music cancellation). One quiet line while recording;
  // never a silent degrade.
  const [noCancel, setNoCancel] = useState(false);
  // FOLDED — the sheet collapses to its slim header capsule (state survives;
  // nothing unmounts but the UI below the header). Default expanded: opening
  // via Sing means "I'm here to work".
  const [collapsed, setCollapsed] = useState(false);

  // THE MIC — every audioinput the browser will name (labels exist only once
  // permission has been granted; until then the capsule simply isn't there),
  // and the user's sticky pick. USB/interface mics appear here by themselves:
  // enumerateDevices lists them like any other input.
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [micId, setMicId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(MIC_KEY);
    } catch {
      return null;
    }
  });
  const [micOpen, setMicOpen] = useState(false);
  const micIdRef = useRef(micId);
  micIdRef.current = micId;
  const refreshMics = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const named = all.filter((d) => d.kind === "audioinput" && d.label);
      // Chrome aliases the system default as extra "default"/"communications"
      // rows — drop them when the real devices are listed too.
      const real = named.filter(
        (d) => d.deviceId !== "default" && d.deviceId !== "communications",
      );
      setMics(
        (real.length ? real : named).map((d) => ({
          deviceId: d.deviceId,
          label: d.label,
        })),
      );
    } catch {
      /* no device API — the capsule just never appears */
    }
  }, []);
  useEffect(() => {
    void refreshMics(); // permission may already exist — the capsule shows now
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshMics();
    md.addEventListener("devicechange", onChange); // plug/unplug refreshes
    return () => md.removeEventListener("devicechange", onChange);
  }, [refreshMics]);
  function pickMic(id: string) {
    setMicId(id);
    setMicOpen(false);
    try {
      localStorage.setItem(MIC_KEY, id);
    } catch {
      /* private mode — the choice just doesn't stick */
    }
  }
  // The capsule shows the pick when it's still plugged in, else the default.
  const currentMic = mics.find((m) => m.deviceId === micId) ?? mics[0] ?? null;

  // REMOVE asks once, inline — the button morphs into its own confirmation
  // (never a browser confirm()). Any other move clears the question.
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Correction knobs (re-process).
  // GENTLE DEFAULTS — the machine nudges, it doesn't process: heavy default
  // tune/timing/clean is exactly what read as watery + choppy on real takes.
  const [tune, setTune] = useState(0.65);
  const [timing, setTiming] = useState(0.3);
  const [clean, setClean] = useState(0.25);

  // The seat (live FX) + looks.
  const [fx, setFx] = useState<VocalFxSettings>({ ...defaultVocalFx });
  const [activeLook, setActiveLook] = useState<string | null>(null);
  // The voice — which identity the take wears. The character itself lives in
  // a ref (runPipeline reads it like the knobs); the id drives the tiles.
  const [voiceId, setVoiceId] = useState("you");
  const voiceChar = useRef<VoiceCharacter | null>(null);

  // The editor.
  const [cuts, setCuts] = useState<{ start: number; end: number }[]>([]);
  const [selection, setSelection] = useState<{ a: number; b: number } | null>(null);

  const recorder = useRef(createVoiceRecorder());
  const raw = useRef<Raw | null>(null);
  const processed = useRef<ProcessOutput | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  // THE RAW UPLOAD — a fresh recording stores its echo-cancelled unprocessed
  // mono alongside the render (the re-tune source for later key/transpose
  // moves). True from stop-recording until the raw actually lands on the
  // server; the pipeline hands the encoded raw back via wantRaw.
  const rawNeedsUpload = useRef(false);
  const rawWavRef = useRef<ArrayBuffer | null>(null);
  // THE SCALE THE TAKE WAS SUNG IN: the song's transpose at record time. The
  // tuner snaps against the key shifted by THIS, and targets shift by however
  // far the song has moved since (targetSemis) — so the voice follows the
  // song into a new key without ever re-recording.
  const recordedTranspose = useRef(0);
  const transposeProp = useRef(transpose);
  transposeProp.current = transpose;
  // THE ANCHOR — which loop the take is glued to (captured at record start
  // from playFromTop; restored with a saved voice). Rides the save headers.
  const anchorRef = useRef<{ partId: string; offsetSec: number } | null>(
    initialTake?.anchorPartId
      ? {
          partId: initialTake.anchorPartId,
          offsetSec: initialTake.anchorOffsetSec ?? 0,
        }
      : null,
  );
  // The saved render's duration — so fx-only syncs (and a restored voice with
  // no processed output yet) can still report durationMs.
  const durationMsRef = useRef(initialTake?.durationMs ?? 0);
  const procSeq = useRef(0);
  const knobs = useRef({ tune, timing, clean });
  knobs.current = { tune, timing, clean };
  const cutsRef = useRef(cuts);
  cutsRef.current = cuts;
  const fxRef = useRef(fx);
  fxRef.current = fx;
  // Event-time mirrors for the auto-sync (it runs from timers).
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const savedTakeIdRef = useRef(savedTakeId);
  savedTakeIdRef.current = savedTakeId;
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;
  const mutedRef = useRef(!!muted);
  mutedRef.current = !!muted;
  const soloRef = useRef(solo);
  soloRef.current = solo;

  // OPEN ONTO THE VOICE. A song has one voice, and if it exists the studio
  // lands directly in the ready view: fetch+decode the saved render (or take
  // the buffer the page already holds), restore its knob/voice metadata from
  // the saved fx, and put it on the bench. When the song has none — or the
  // audio is gone — fall gracefully to the idle view.
  const restoreSeq = useRef(0);
  useEffect(() => {
    const mySeq = ++restoreSeq.current;
    const restore = async () => {
      let meta = initialTake ?? null;
      // The page usually knows; when it doesn't (opened before its fetch
      // landed), ask the server for the song's voice directly.
      if (!meta) {
        try {
          const res = await fetch(`/api/songs/${songId}/vocal`);
          const d = (await res.json().catch(() => ({}))) as { takes?: Take[] };
          const t = d.takes?.[0];
          if (t)
            meta = {
              id: t.id,
              fx: t.fx ?? {},
              durationMs: t.duration_ms,
              anchorPartId: t.anchor_part_id ?? null,
              anchorOffsetSec: t.anchor_offset_sec ?? 0,
            };
        } catch {
          /* offline — the idle view still works */
        }
        if (mySeq !== restoreSeq.current) return;
        if (!meta) {
          setStage("idle");
          return;
        }
        setStage("loading");
        setSavedTakeId(meta.id);
      }
      try {
        let buf = initialBuffer ?? null;
        if (!buf) {
          const res = await fetch(`/api/songs/${songId}/vocal/${meta.id}`);
          if (!res.ok) throw new Error();
          const bytes = await res.arrayBuffer();
          const ctx = ac() ?? new AudioContext();
          buf = await ctx.decodeAudioData(bytes);
        }
        if (mySeq !== restoreSeq.current) return;
        // The saved metadata IS the bench state: fx knobs live on the chain,
        // correction knobs + voice pill show what's baked into the render.
        const m = meta.fx ?? {};
        const num = (v: unknown, d: number) =>
          typeof v === "number" && Number.isFinite(v) ? v : d;
        setTune(num(m.tune, 0.65));
        setTiming(num(m.timing, 0.3));
        setClean(num(m.clean, 0.25));
        setVoiceId(typeof m.voice === "string" ? m.voice : "you");
        const nextFx: VocalFxSettings = { ...defaultVocalFx };
        for (const k of Object.keys(defaultVocalFx) as (keyof VocalFxSettings)[])
          nextFx[k] = num(m[k], defaultVocalFx[k]);
        setFx(nextFx);
        anchorRef.current =
          meta.anchorPartId != null
            ? { partId: meta.anchorPartId, offsetSec: meta.anchorOffsetSec ?? 0 }
            : anchorRef.current;
        // THE RAW IS THE SOURCE: fetch the stored raw take so every re-run
        // processes from the ORIGINAL (cuts, character and tuning re-apply
        // from the saved fx — nothing is baked into the raw). Legacy takes
        // (no raw) fall back to the render, as before.
        let rawSrc: Raw | null = null;
        try {
          const rr = await fetch(`/api/songs/${songId}/vocal/${meta.id}/raw`);
          if (rr.ok) {
            const bytes = await rr.arrayBuffer();
            const rctx = ac() ?? new AudioContext();
            const rbuf = await rctx.decodeAudioData(bytes);
            rawSrc = {
              left: rbuf.getChannelData(0).slice(),
              sampleRate: rbuf.sampleRate,
              trimMs: num(m.trimMs, 0),
            };
          }
        } catch {
          /* legacy take / offline — the render below stands in */
        }
        if (mySeq !== restoreSeq.current) return;
        if (rawSrc) {
          raw.current = rawSrc;
          // Re-processing runs from source, so what the render WEARS must
          // re-apply on every re-run: the saved cuts, the voice character,
          // and the scale the take was sung in (record-time transpose).
          setCuts(
            Array.isArray(m.cuts)
              ? (m.cuts as { start: number; end: number }[]).filter(
                  (c) =>
                    c && Number.isFinite(c.start) && Number.isFinite(c.end),
                )
              : [],
          );
          voiceChar.current =
            m.character && typeof m.character === "object"
              ? (m.character as VoiceCharacter)
              : null;
          recordedTranspose.current = Math.round(num(m.recordedTranspose, 0));
        } else {
          // The render doubles as the re-run source (legacy: the raw was
          // never kept): the character is BAKED into it — keep it out of the
          // re-run input or a mere knob nudge would apply it twice. Same for
          // the transpose: the render is "recorded" in the song's CURRENT key.
          raw.current = {
            left: buf.getChannelData(0).slice(),
            right:
              buf.numberOfChannels > 1
                ? buf.getChannelData(1).slice()
                : undefined,
            sampleRate: buf.sampleRate,
            trimMs: 0,
          };
          voiceChar.current = null;
          recordedTranspose.current = Math.round(transposeProp.current);
        }
        buffer.current = buf;
        processed.current = null;
        durationMsRef.current = meta.durationMs;
        titleRef.current = "Voice";
        setSavedTakeId(meta.id);
        setStage("ready");
      } catch {
        if (mySeq !== restoreSeq.current) return;
        // The row exists but its audio doesn't (or won't decode) — start
        // fresh rather than stranding a dead screen.
        setStage("idle");
      }
    };
    void restore();
    return () => {
      restoreSeq.current++;
    };
    // Open-time snapshot by design: the page's later saves flow through
    // onTakeChanged, not through re-restoring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Recording clock.
  useEffect(() => {
    if (stage !== "recording") return;
    const t0 = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(
    () => () => {
      recorder.current.cancel();
      stopSolo(); // solo never outlives the studio
      // A knob turn right before close must not evaporate — flush the
      // debounced sync on the way out (fire-and-forget; the PUT/PATCH is
      // independent of this component's life).
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
        void doSyncRef.current?.();
      }
    },
    [],
  );

  // THE CONFIDENCE METER — while recording, a live input bar proves the mic
  // hears you BEFORE you burn a take singing into a dead device (the single
  // biggest "is this thing on?" gap). Cheap: one AnalyserNode tapped on the
  // capture stream, one rAF loop, direct style writes — no React state churn
  // at animation rate.
  const meterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stage !== "recording") return;
    const stream = recorder.current.stream();
    const ctx = ac();
    if (!stream || !ctx) return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    let src: MediaStreamAudioSourceNode;
    try {
      src = ctx.createMediaStreamSource(stream);
      src.connect(analyser); // analyser only — never to the destination (echo!)
    } catch {
      return; // the meter is a nicety — never block recording on it
    }
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let shown = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(data); // byte variant: oldest-Safari-safe
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      // ×4 puts a normal singing RMS (~0.05–0.25) on a useful arc; fast
      // attack / slow release so syllables flash and the bar breathes down.
      const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
      shown = level > shown ? level : shown * 0.9;
      const el = meterRef.current;
      if (el) {
        el.style.transform = `scaleX(${Math.max(0.02, shown)})`;
        el.style.opacity = String(0.4 + 0.6 * shown);
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      try {
        src.disconnect();
      } catch {
        /* already gone */
      }
    };
  }, [stage]);

  function ac(): AudioContext | null {
    return getEngineAudioContext();
  }
  // The playhead rides the SONG's vocal layer: position in the mix, shown
  // while it falls inside the take (past the end = the loop's silent pad —
  // no playhead, same as not playing).
  const positionOf = useCallback(() => {
    const pos = vocalPosition();
    if (pos === null) return null;
    const dur = buffer.current?.duration ?? 0;
    return pos <= dur ? pos : null;
  }, []);

  // ---- capture ---------------------------------------------------------------

  async function startRecording() {
    setError(null);
    setConfirmRemove(false);
    leaveSolo(); // recording owns the transport
    try {
      // ORDER IS LOAD-BEARING. The recorder decides its capture path by
      // whether the engine's context + broadcast tap exist AT start() — and
      // on a fresh page they don't until the engine boots. Booting it here
      // (no music yet; playFromTop starts that a beat later) is what makes
      // the sample-locked path the NORMAL path instead of a lucky one; the
      // old order silently fell back to browser AEC with no reference and
      // printed the whole song into the take.
      await ensureEngineStarted().catch(() => {
        /* the recorder falls back — and the UI says so below */
      });
      await recorder.current.start(micIdRef.current ?? undefined);
      setNoCancel(recorder.current.mode() !== "locked");
      // First grant just happened — device labels exist now, the capsule can.
      void refreshMics();
      const t0 = performance.now();
      // The song starts; you're already rolling — and the mix hands back THE
      // ANCHOR (its first loop): the take will stay glued to that loop when
      // the arrangement changes later.
      const anchor = await playFromTop();
      const trimMs = performance.now() - t0;
      anchorRef.current = anchor
        ? { partId: anchor.anchorPartId, offsetSec: anchor.anchorOffsetSec }
        : null;
      raw.current = { left: new Float32Array(0), sampleRate: 0, trimMs };
      setElapsed(0);
      setStage("recording");
    } catch {
      setError("The mic didn't open — check permission and try again.");
    }
  }

  async function stopRecording() {
    try {
      const recording = await recorder.current.stop();
      stopMix();
      if (recording.kind === "pcm") {
        // Sample-locked worklet capture: mic and reference are already raw
        // PCM on the engine's clock — no decode, no codec, and mic[i]/ref[i]
        // are simultaneous by construction (mono in-worklet already).
        raw.current = {
          left: recording.mic,
          sampleRate: recording.sampleRate,
          trimMs: raw.current?.trimMs ?? 0,
          ref: recording.ref ?? undefined,
          refSampleRate: recording.ref ? recording.sampleRate : undefined,
        };
      } else {
        // Fallback capture (browser AEC, no reference): one blob to decode.
        const ctx = ac() ?? new AudioContext();
        const decoded = await decodeToRaw(recording.mic, ctx);
        raw.current = {
          ...decoded,
          trimMs: raw.current?.trimMs ?? 0,
        };
      }
      freshTakeState();
      // A fresh recording ships its RAW (cancelled, unprocessed) alongside
      // the render, and remembers the scale it was sung in.
      rawNeedsUpload.current = true;
      recordedTranspose.current = Math.round(transposeProp.current);
      await runPipeline();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the recording.");
      setStage("idle");
    }
  }

  /** New material resets everything the old voice owned — EXCEPT the song's
   *  voice row (savedTakeId): a re-record/re-import REPLACES the voice on the
   *  same row, update-in-place. Clearing the decoded buffer here is
   *  LOAD-BEARING: runPipeline treats "a buffer already exists" as a knob
   *  RE-RUN (stay in the ready UI) vs new material (full processing stage) —
   *  new material must always take the full path. */
  function freshTakeState(title?: string) {
    buffer.current = null;
    processed.current = null;
    rawNeedsUpload.current = false;
    rawWavRef.current = null;
    setBusy(false);
    setConfirmRemove(false);
    setCuts([]);
    setSelection(null);
    audioDirty.current = false;
    fxDirty.current = false;
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    setActiveLook(null);
    setVoiceId("you");
    voiceChar.current = null;
    titleRef.current = title?.trim() || "Voice";
  }

  // ---- the pipeline ------------------------------------------------------------

  async function runPipeline() {
    const r = raw.current;
    if (!r || !r.left.length) {
      setStage("idle");
      return;
    }
    const mySeq = ++procSeq.current;
    // SEAMLESS RE-RUNS. Only the FIRST process of a take owns the screen —
    // once a take is on the bench, a knob turn must not unmount the ready UI
    // (the old behavior flipped stage to "processing", which tore down the
    // waveform, knobs and audition for a beat on every dial move). A re-run
    // keeps stage "ready", raises the busy chip, and keeps the OLD buffer
    // visible and PLAYING until the new one lands.
    const rerun = buffer.current !== null;
    if (rerun) {
      setBusy(true);
    } else {
      setStage("processing");
    }
    try {
      const out = await processTake({
        left: r.left,
        right: r.right,
        sampleRate: r.sampleRate,
        ref: r.ref,
        refSampleRate: r.refSampleRate,
        trimMs: r.trimMs,
        bpm,
        subdivision: 2,
        // The scale the take was SUNG in (key shifted by the record-time
        // transpose); targets then move by however far the song's transpose
        // has drifted since — the voice follows the song into a new key.
        scalePcs: shiftScale(scaleFromKey(keyName), recordedTranspose.current),
        targetSemis: Math.round(transposeProp.current) - recordedTranspose.current,
        tune: knobs.current.tune,
        timing: knobs.current.timing,
        denoiseAmt: knobs.current.clean,
        cuts: cutsRef.current,
        character: voiceChar.current ?? undefined,
        // A fresh recording needs its raw (cancelled, unprocessed) back for
        // the one-round-trip upload alongside the render.
        wantRaw: rawNeedsUpload.current,
      });
      if (mySeq !== procSeq.current) return; // superseded by a newer run
      processed.current = out;
      if (out.rawWav) rawWavRef.current = out.rawWav;
      if (out.stats.echo) echoStatsRef.current = out.stats.echo;
      if (process.env.NODE_ENV !== "production") {
        const e = out.stats.echo;
        console.log(
          `[klappn] voice echo: applied=${e?.applied ?? false} attenuation=${(
            e?.attenuationDb ?? 0
          ).toFixed(1)}dB delay=${e?.delayMs ?? 0}ms β=${(e?.beta ?? 0).toFixed(2)}`,
        );
      }
      const ctx = ac() ?? new AudioContext();
      const next = await ctx.decodeAudioData(out.wav.slice(0));
      if (mySeq !== procSeq.current) return;
      // The song page hot-swaps the playing layer when the save hands the
      // new buffer over (onTakeChanged → updateVocalBuffer): cuts are
      // silence-in-place and re-tunes preserve the time base, so old and new
      // timelines line up sample-for-sample and the voice never drops a beat.
      buffer.current = next;
      setStage("ready");
      // SEAMLESS: the take goes into the song the moment it exists. First
      // process = save NOW (record → it IS part of the song); a knob re-run
      // syncs itself quietly after the dial settles.
      scheduleSync("audio", rerun ? 900 : 0);
    } catch (e) {
      if (mySeq !== procSeq.current) return;
      setError(e instanceof Error ? e.message : "Processing failed.");
      setStage(raw.current?.left.length ? "ready" : "idle");
    } finally {
      if (mySeq === procSeq.current) setBusy(false);
    }
  }

  const reproc = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleReprocess(delay = 550) {
    if (!raw.current?.left.length) return;
    if (reproc.current) clearTimeout(reproc.current);
    reproc.current = setTimeout(() => void runPipeline(), delay);
  }

  // ---- auto-sync: the take keeps ITSELF saved --------------------------------
  // Every change lands on the same take (update-in-place PUT); a new raw take
  // creates one (title "Voice"). fx-only moves ride the light PATCH. All of it
  // is debounced and serialized — the header ✓ is the only UI.

  const titleRef = useRef("Voice");
  // The last render's echo-cancel numbers — persisted into the saved fx json
  // (echoStats) so a bad field take can be diagnosed from the DB row alone.
  const echoStatsRef = useRef<ProcessOutput["stats"]["echo"] | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioDirty = useRef(false);
  const fxDirty = useRef(false);
  const saveBusy = useRef(false);
  const savePending = useRef(false);
  const doSyncRef = useRef<(() => Promise<void>) | null>(null);

  function scheduleSync(kind: "audio" | "fx", delay = 900) {
    if (kind === "audio") audioDirty.current = true;
    else fxDirty.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void doSync(), delay);
  }

  async function doSync(): Promise<void> {
    syncTimer.current = null;
    if (saveBusy.current) {
      savePending.current = true;
      return;
    }
    // A re-run is rendering — what's on the bench isn't what the knobs say
    // yet. Wait it out (runPipeline schedules a fresh sync anyway).
    if (busyRef.current) {
      syncTimer.current = setTimeout(() => void doSync(), 400);
      return;
    }
    if (!audioDirty.current && !fxDirty.current) return;
    const out = processed.current;
    // fx-only tweaks on a RESTORED voice have no fresh render — that's fine,
    // they ride the light PATCH. Audio dirt (or a first save) needs the wav.
    if (!out && (audioDirty.current || !savedTakeIdRef.current)) return;
    saveBusy.current = true;
    const wasAudio = audioDirty.current;
    audioDirty.current = false;
    fxDirty.current = false;
    try {
      // The character rides the fx metadata (x-klappn-fx is arbitrary json):
      // it's how the voice remembers WHICH identity it wears; `muted` carries
      // the song-level chip state through so a knob tweak never un-mutes it.
      const knobMeta = {
        ...fxRef.current,
        tune: knobs.current.tune,
        timing: knobs.current.timing,
        clean: knobs.current.clean,
        character: voiceChar.current,
        voice: voiceIdRef.current,
        muted: mutedRef.current,
        // The re-process recipe: with the RAW stored server-side, these let
        // any later run (a reopen, the key/transpose re-tune) reproduce the
        // render exactly from source.
        trimMs: raw.current?.trimMs ?? 0,
        cuts: cutsRef.current,
        recordedTranspose: recordedTranspose.current,
        targetSemis:
          Math.round(transposeProp.current) - recordedTranspose.current,
        // Observability, not a knob: how the echo cancel did on this take
        // (null on restored voices that were never re-rendered here).
        echoStats: echoStatsRef.current,
      };
      const durationMs = out?.durationMs ?? durationMsRef.current;
      // A fresh recording rides its RAW in the SAME round trip: body =
      // render + raw concatenated, x-klappn-raw-bytes marks the split, and
      // the anchor headers name the loop the take is glued to.
      const rawUpload = rawNeedsUpload.current ? rawWavRef.current : null;
      const packBody = (
        wav: ArrayBuffer,
      ): { body: ArrayBuffer; extra: Record<string, string> } => {
        if (!rawUpload) return { body: wav, extra: {} };
        const buf = new ArrayBuffer(wav.byteLength + rawUpload.byteLength);
        const u = new Uint8Array(buf);
        u.set(new Uint8Array(wav), 0);
        u.set(new Uint8Array(rawUpload), wav.byteLength);
        const extra: Record<string, string> = {
          "x-klappn-raw-bytes": String(rawUpload.byteLength),
        };
        const a = anchorRef.current;
        if (a) {
          extra["x-klappn-anchor-part"] = a.partId;
          extra["x-klappn-anchor-offset"] = String(a.offsetSec);
        }
        return { body: buf, extra };
      };
      const create = async (): Promise<string> => {
        // The collection PUT is replace-or-create server-side too, so even a
        // stale bench can never grow a second row for the song's one voice.
        const { body, extra } = packBody(out!.wav);
        const res = await fetch(`/api/songs/${songId}/vocal`, {
          method: "PUT",
          headers: {
            "content-type": "audio/wav",
            "x-klappn-duration": String(durationMs),
            "x-klappn-fx": JSON.stringify(knobMeta),
            "x-klappn-title": titleRef.current,
            ...extra,
          },
          body,
        });
        const d = (await res.json().catch(() => ({}))) as {
          take?: Take;
          error?: string;
        };
        if (!res.ok || !d.take) throw new Error(d.error || "save failed");
        return d.take.id;
      };
      let takeId = savedTakeIdRef.current;
      if (!takeId) {
        takeId = await create();
        setSavedTakeId(takeId);
      } else if (wasAudio) {
        // The song already HAS a voice — the new render REPLACES it in place
        // (same row, same key; audio + fx + duration in one move).
        const { body, extra } = packBody(out!.wav);
        const res = await fetch(`/api/songs/${songId}/vocal/${takeId}`, {
          method: "PUT",
          headers: {
            "content-type": "audio/wav",
            "x-klappn-duration": String(durationMs),
            "x-klappn-fx": JSON.stringify(knobMeta),
            ...extra,
          },
          body,
        });
        if (res.status === 404) {
          // The row vanished under us (deleted elsewhere) — recreate.
          takeId = await create();
          setSavedTakeId(takeId);
        } else if (!res.ok) throw new Error("save failed");
      } else {
        const res = await fetch(`/api/songs/${songId}/vocal/${takeId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fx: knobMeta }),
        });
        if (!res.ok) throw new Error("save failed");
      }
      durationMsRef.current = durationMs;
      if (rawUpload) {
        // The raw landed with this save — later knob re-runs don't re-ship it.
        rawNeedsUpload.current = false;
        rawWavRef.current = null;
      }
      // The song page seats the voice from here — with the decoded buffer in
      // hand when the audio changed, so play never re-downloads it.
      onTakeChanged?.(
        {
          id: takeId,
          fx: knobMeta,
          durationMs,
          anchorPartId: anchorRef.current?.partId ?? null,
          anchorOffsetSec: anchorRef.current?.offsetSec ?? 0,
        },
        wasAudio ? (buffer.current ?? undefined) : undefined,
      );
    } catch (e) {
      // Keep the dirt — the next change (or flush) retries.
      audioDirty.current = audioDirty.current || wasAudio;
      fxDirty.current = true;
      setError(e instanceof Error ? e.message : "Couldn't sync your voice.");
    } finally {
      saveBusy.current = false;
      if (savePending.current) {
        savePending.current = false;
        void doSync();
      }
    }
  }
  doSyncRef.current = doSync;

  // KEY FOLLOWS THE SONG, LIVE: a transpose change while the studio is open
  // re-runs the pipeline (targets shift to the transposed scale) and the
  // auto-sync saves it — the page-level retune (SongClient) stays out of the
  // way while the studio is mounted.
  const lastTranspose = useRef(transpose);
  useEffect(() => {
    if (lastTranspose.current === transpose) return;
    lastTranspose.current = transpose;
    if (raw.current?.left.length && buffer.current) scheduleReprocess(600);
    // scheduleReprocess is stable in behavior (refs all the way down).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transpose]);

  function dspKnob(setter: (v: number) => void) {
    return (v: number) => {
      setter(v);
      setActiveLook(null);
      scheduleReprocess();
    };
  }

  // ---- transport: play the song, or the voice alone ---------------------------

  /** Seat the voice on the engine's context so SOLO can sound even before the
   *  song ever played on this page (the page's own attach, startVocalForMix,
   *  re-seats whenever the mix plays — attachVocal replaces in place). Falls
   *  back to a studio-owned context only when the engine never booted. */
  const soloCtx = useRef<AudioContext | null>(null);
  function ensureSeated(): boolean {
    if (vocalState().attached) return true;
    const buf = buffer.current;
    if (!buf) return false;
    const engine = ac();
    const ctx =
      engine ?? soloCtx.current ?? (soloCtx.current = new AudioContext());
    attachVocal(
      ctx,
      buf,
      { ...fxRef.current, muted: mutedRef.current },
      engine ? serverLoopSink(ctx) : ctx.destination,
      bpm,
    );
    return true;
  }

  function leaveSolo() {
    if (!soloRef.current) return;
    setSolo(false);
    stopSolo();
  }

  /** The "voice only" pill: solo the voice from the playhead (or the top).
   *  Solo ignores the song-level mute — soloing IS asking to hear it. */
  function toggleSolo() {
    if (soloRef.current) {
      leaveSolo();
      return;
    }
    if (!ensureSeated()) return;
    if (mixPlaying) stopMix();
    const pos = vocalPosition();
    const dur = buffer.current?.duration ?? 0;
    soloVocal(pos !== null && pos < dur ? pos : 0);
    setSolo(true);
  }

  /** The header play/pause: THE SONG, with the voice riding — as everywhere. */
  async function togglePlay() {
    leaveSolo();
    if (mixPlaying) {
      stopMix();
      return;
    }
    try {
      await playFromSec(null);
    } catch {
      setError("Audio engine failed to start.");
    }
  }

  /** TAP-TO-SEEK on the waveform: play from right there — the voice alone
   *  (exact) when soloing, else the song (section-granular, voice riding). */
  function seekTo(t: number) {
    if (soloRef.current) {
      if (ensureSeated()) soloVocal(t);
      return;
    }
    void playFromSec(t).catch(() => {});
  }

  // ---- editor actions ----------------------------------------------------------

  function cutSelection() {
    if (!selection) return;
    setCuts((c) => [...c, { start: selection.a, end: selection.b }]);
    setSelection(null);
    scheduleReprocess(150);
  }

  // ---- looks ---------------------------------------------------------------------

  // Live FX land straight on the SONG's vocal layer (lib/vocal-layer) — the
  // take plays only as part of the mix, and the knobs move that chain while
  // it sounds (a no-op when the layer isn't seated; the save carries them).
  function liveFx(patch: Partial<VocalFxSettings>) {
    setActiveLook(null);
    setFx((f) => {
      const next = { ...f, ...patch };
      setVocalFx(patch);
      return next;
    });
    scheduleSync("fx");
  }

  /** A voice tile: the character re-renders (DSP, scheduleReprocess — stage
   *  stays "ready" behind the busy chip, exactly like a knob turn) and the fx
   *  patch lands live on the chain. "You" = character null, back to yourself. */
  function applyVoice(v: (typeof VOICES)[number]) {
    setVoiceId(v.id);
    const changed =
      JSON.stringify(v.character) !== JSON.stringify(voiceChar.current);
    voiceChar.current = v.character;
    // REAL-TIME: the chip changes the sound the instant it's tapped — a live
    // approximation on the playing chain (granular shift at 2^(semis/12),
    // formant ignored; Robot = 30 Hz ring-mod). The baked PSOLA render
    // resets it to bypass when it hot-swaps in (updateVocalBuffer), so the
    // render never rides double-shifted.
    setLiveVocalCharacter({
      semis: v.character?.semis ?? 0,
      robot: v.id === "robot",
    });
    if (v.fx) {
      setActiveLook(null); // the patch moved the seat — no look owns it now
      setFx((f) => {
        const next = { ...f, ...v.fx };
        setVocalFx(v.fx!);
        return next;
      });
      scheduleSync("fx");
    }
    // Only a character change costs a render — Phone (fx-only) stays instant.
    if (changed) scheduleReprocess(150);
  }

  function applyLook(id: string, look: Look) {
    setActiveLook(id);
    setFx(look.fx);
    setVocalFx(look.fx);
    scheduleSync("fx");
    const changed =
      look.tune !== knobs.current.tune ||
      look.timing !== knobs.current.timing ||
      look.clean !== knobs.current.clean;
    setTune(look.tune);
    setTiming(look.timing);
    setClean(look.clean);
    if (changed) scheduleReprocess(150);
  }

  // ---- removing the voice ------------------------------------------------------------

  /** Remove = take the voice OUT of the song — the one deliberate act (asked
   *  once, inline, by the footer capsule). Clears the bench AND the row
   *  (otherwise the very next knob turn would quietly resurrect it), and
   *  returns the studio to the idle record view. */
  async function removeVoice() {
    const id = savedTakeIdRef.current;
    leaveSolo();
    raw.current = null;
    anchorRef.current = null;
    freshTakeState();
    setSavedTakeId(null);
    setStage("idle");
    onTakeChanged?.(null);
    if (id)
      await fetch(`/api/songs/${songId}/vocal/${id}`, {
        method: "DELETE",
      }).catch(() => {});
  }

  // ---- render --------------------------------------------------------------------------

  const pill = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
      active
        ? "border-accent/50 bg-accent/[0.14] text-accent-strong shadow-[0_0_20px_-6px_rgba(224,49,156,.6)]"
        : "border-white/[0.09] bg-white/[0.03] text-foreground/70 hover:border-white/[0.16] hover:text-foreground"
    }`;

  return (
    <section
      className={`animate-fade-in mt-6 rounded-3xl border border-white/[0.09] bg-[#101115]/85 shadow-[0_30px_90px_-40px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl ${
        collapsed ? "px-5 py-3" : "p-5"
      }`}
    >
      {/* header row — the fold. Clicking the strip collapses the sheet to
          this slim capsule and back; everything below stays MOUNTED while
          folded (the take, the knobs, a render in flight — all survive). */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand the voice panel" : "Collapse the voice panel"}
          className="group flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/85">
            Voice
          </span>
          {/* sync is SILENT — no whisper, no ✓ (auto-save just works; a
              failed save still surfaces through the red error line). */}
        </button>
        {/* THE TRANSPORT — right here, no trips back to the loop cards: play
            the song (the voice riding, as everywhere) or solo the voice
            alone. Lives through the fold; recording owns its own controls. */}
        {stage !== "recording" && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => void togglePlay()}
              aria-label={mixPlaying ? "Pause the song" : "Play the song"}
              title={
                mixPlaying
                  ? "Pause the song"
                  : "Play the song — your voice rides it"
              }
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
                mixPlaying
                  ? "border-transparent bg-gradient-to-br from-[#ff63c1] via-[#e0319c] to-[#b3126f] text-white shadow-[0_0_18px_-4px_rgba(224,49,156,.8)]"
                  : "border-white/[0.12] bg-white/[0.04] text-foreground/85 hover:border-white/[0.2] hover:bg-white/[0.08]"
              }`}
            >
              {mixPlaying ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </button>
            {stage === "ready" && (
              // SOLO — icon-only (headphones, the same solo iconography as
              // the layer cards' SoloGlyph): hear the voice alone, no song.
              // Lit one-pink while soloing, quiet otherwise.
              <button
                onClick={toggleSolo}
                aria-pressed={solo}
                aria-label="Voice only"
                title={solo ? "Back to the full song" : "Hear the voice alone"}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
                  solo
                    ? "border-accent/50 bg-accent/[0.16] text-accent-strong shadow-[0_0_18px_-6px_rgba(224,49,156,.7)]"
                    : "border-white/[0.09] bg-white/[0.03] text-muted/70 hover:border-white/[0.16] hover:text-foreground"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
                  <path d="M18 13h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1z" />
                  <path d="M6 13H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1z" />
                </svg>
              </button>
            )}
            {stage === "ready" && onToggleMuted && (
              // MUTE — the voice's place in the SONG (the headphones above solo
              // it; this silences it in the mix). The app's ONLY voice-mute
              // control; persists via the take's fx.
              <button
                onClick={onToggleMuted}
                aria-pressed={!!muted}
                aria-label={muted ? "Unmute the voice" : "Mute the voice"}
                title={muted ? "The voice is muted in the song" : "Mute the voice in the song"}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
                  muted
                    ? "border-white/[0.16] bg-white/[0.06] text-muted"
                    : "border-white/[0.09] bg-white/[0.03] text-accent-strong hover:border-white/[0.16]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H3v6h3l5 4z" />
                  {muted ? (
                    <path d="M16 9l5 6M21 9l-5 6" />
                  ) : (
                    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
                  )}
                </svg>
              </button>
            )}
          </div>
        )}
        {/* The chevron is a duplicate door (the name strip also folds the
            sheet) — on phones it gives its 32px to the mute pill so the
            header never clips its own name. */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand the voice panel" : "Collapse the voice panel"}
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-full text-muted/50 transition hover:bg-white/[0.06] hover:text-foreground sm:grid"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => {
            // Recording is the only state where the studio started the music
            // itself — take it down with the sheet. A song the USER played
            // keeps playing; the panel is not the transport.
            if (stage === "recording") stopMix();
            onClose();
          }}
          aria-label="Close the voice studio"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted/60 transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* the flow */}
      {!collapsed && stage === "loading" && (
        <div className="mt-5 flex flex-col items-center gap-2 py-8">
          <span className="shimmer-text text-[14px]">
            Bringing your voice in…
          </span>
        </div>
      )}

      {/* THE IDLE VIEW — one centered composition: the mic breathing in its
          own light, the record CTA as the hero, one quiet line, the device
          capsule beneath it. Recording is the only way in. */}
      {!collapsed && stage === "idle" && (
        <div className="mt-4 flex flex-col items-center px-2 pb-8 pt-10 text-center sm:pt-12">
          <div
            className="animate-rise relative grid h-16 w-16 place-items-center"
            style={{ "--i": 0 } as CSSProperties}
          >
            {/* the halo — the studio's pilot light */}
            <span
              aria-hidden
              className="absolute h-16 w-16 animate-pulse rounded-full bg-accent/[0.16] blur-xl"
            />
            <span
              aria-hidden
              className="absolute h-11 w-11 rounded-full border border-white/[0.08] bg-white/[0.02]"
            />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="relative text-accent-strong drop-shadow-[0_0_8px_rgba(255,99,193,.5)]"
            >
              <rect x="9" y="2.5" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
              <path d="M12 18v3" />
            </svg>
          </div>
          <button
            onClick={() => void startRecording()}
            className="btn-primary animate-rise mt-7 flex items-center gap-2.5 rounded-full px-9 py-3.5 text-[15px] font-semibold tracking-tight"
            style={{ "--i": 1 } as CSSProperties}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,.8)]" />
            Sing it
          </button>
          <p
            className="animate-rise mt-6 text-[11.5px] text-muted/55"
            style={{ "--i": 2 } as CSSProperties}
          >
            Wear headphones — the mic should hear only you.
          </p>
          {/* THE MIC — a quiet capsule naming the input; tap for the machined
              list. Only once permission exists (labels before a grant are
              empty strings — nothing worth a capsule). */}
          {currentMic && (
            <div
              className="animate-rise mt-3 flex w-full flex-col items-center"
              style={{ "--i": 3 } as CSSProperties}
            >
              <button
                onClick={() => setMicOpen((o) => !o)}
                aria-expanded={micOpen}
                aria-haspopup="listbox"
                title="Choose the microphone"
                className="flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-muted/70 transition hover:border-white/[0.16] hover:text-foreground active:scale-[.97]"
              >
                <span aria-hidden className="text-[12px] leading-none">
                  {micIcon(currentMic.label)}
                </span>
                <span className="min-w-0 truncate">
                  {cleanMicLabel(currentMic.label)}
                </span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={`shrink-0 opacity-60 transition-transform duration-200 ${
                    micOpen ? "rotate-180" : ""
                  }`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {micOpen && (
                <div
                  role="listbox"
                  aria-label="Microphone"
                  className="mt-2 w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/[0.09] bg-black/40 backdrop-blur"
                >
                  {mics.map((m, i) => {
                    const active = m.deviceId === currentMic.deviceId;
                    return (
                      <button
                        key={m.deviceId || i}
                        role="option"
                        aria-selected={active}
                        onClick={() => pickMic(m.deviceId)}
                        className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12px] transition active:scale-[.99] ${
                          i > 0 ? "border-t border-white/[0.06]" : ""
                        } ${
                          active
                            ? "bg-accent/[0.1] text-accent-strong"
                            : "text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
                        }`}
                      >
                        <span aria-hidden className="text-[13px] leading-none">
                          {micIcon(m.label)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {cleanMicLabel(m.label)}
                        </span>
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!collapsed && stage === "recording" && (
        <div className="mt-5 flex flex-col items-center gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="playing-glow h-3 w-3 rounded-full bg-accent" />
            <span className="tabular-nums text-[22px] font-semibold tracking-tight text-foreground">
              {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
            </span>
          </div>
          {/* the live input meter — the singer SEES they're being heard */}
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              ref={meterRef}
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: "scaleX(0.02)",
                opacity: 0.4,
                backgroundImage:
                  "linear-gradient(90deg, #b3126f, #e0319c 60%, #ff63c1)",
                boxShadow: "0 0 12px rgba(224,49,156,0.55)",
              }}
            />
          </div>
          {noCancel && (
            <p className="text-[11.5px] text-amber-200/70">
              Recording without music cancellation — use headphones.
            </p>
          )}
          <button
            onClick={() => void stopRecording()}
            className="flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.05] px-6 py-3 text-[14px] font-semibold text-foreground transition hover:bg-white/[0.1]"
          >
            <span className="h-3 w-3 rounded-[3px] bg-foreground" />
            That&rsquo;s it
          </button>
        </div>
      )}

      {!collapsed && stage === "processing" && (
        <div className="mt-5 flex flex-col items-center gap-2 py-8">
          <span className="shimmer-text text-[14px]">
            Polishing your voice — cleaning the room, finding the key, seating the timing…
          </span>
        </div>
      )}

      {!collapsed && stage === "ready" && buffer.current && (
        <div className="mt-5 grid gap-5">
          {/* THE VOICE — a waveform you can touch: tap to play from there,
              drag to select what to cut */}
          <div className="relative">
            <Waveform
              buffer={buffer.current}
              cuts={cuts}
              selection={selection}
              onSelect={setSelection}
              onTap={seekTo}
              position={positionOf}
              solo={solo}
            />
            {/* the ONE affordance under a selection — floats over the wave
                (no layout shift); tapping anywhere else already clears it */}
            {selection && (
              <button
                onClick={cutSelection}
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-black/70 px-3.5 py-1 text-[12px] font-semibold text-accent-strong backdrop-blur transition hover:bg-accent/[0.18] active:scale-95"
              >
                Cut
              </button>
            )}
          </div>

          {/* VOICES — one-tap identities; the character is baked into the
              render, the patch rides the chain live. Taps are OPTIMISTIC: the
              chip lights instantly, the audio hot-swaps when the render lands
              (last tap wins) — the only tell is a breath on the active chip. */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/50">
              Voice
            </p>
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => applyVoice(v)}
                  className={`${pill(voiceId === v.id)} ${
                    busy && voiceId === v.id ? "animate-pulse" : ""
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* LOOKS — one tap. min-w-0 is LOAD-BEARING: this wrapper is the
              GRID ITEM, and without it min-width:auto sizes the whole column
              track to the pills' full unscrolled width — every knob row then
              bleeds ~200px past the card edge on phones (the scroll container
              inside can't shrink what its parent won't). */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/50">
              Look
            </p>
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {VOCAL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    applyLook(p.id, { tune, timing, clean, fx: p.settings })
                  }
                  className={pill(activeLook === p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* the correction knobs — how much the machine helps */}
          <div className="grid min-w-0 gap-2.5">
            <Knob label="Tune" value={tune} onChange={dspKnob(setTune)} />
            <Knob label="Timing" value={timing} onChange={dspKnob(setTiming)} />
            <Knob label="Clean" value={clean} onChange={dspKnob(setClean)} />
          </div>
          <div className="h-px bg-white/[0.06]" />
          {/* the seat knobs — live, no re-process */}
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-x-8">
            <Knob label="Voice" value={fx.level / 1.5} onChange={(v) => liveFx({ level: v * 1.5 })} />
            <Knob label="Air" value={fx.air} onChange={(v) => liveFx({ air: v })} />
            <Knob label="Glow" value={fx.glow} onChange={(v) => liveFx({ glow: v })} />
            <Knob label="Drive" value={fx.drive} onChange={(v) => liveFx({ drive: v })} />
            <Knob label="Echo" value={fx.echo} onChange={(v) => liveFx({ echo: v })} />
            <Knob label="Space" value={fx.space} onChange={(v) => liveFx({ space: v })} />
          </div>

          {/* the ONE footer control — no save button (the voice is ALREADY in
              the song, see the header ✓). Remove is the only door out of the
              ready view: it asks once, inline (the button morphs into its own
              machined confirmation capsule), and on yes the studio returns to
              the record view. */}
          <div className="flex min-h-[36px] items-center justify-end">
            {confirmRemove ? (
              <div className="flex items-stretch overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.03]">
                <span className="flex items-center whitespace-nowrap pl-4 pr-3 text-[12px] text-foreground/85">
                  Remove the voice?
                </span>
                <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
                <button
                  onClick={() => void removeVoice()}
                  className="whitespace-nowrap px-3.5 text-[12px] font-semibold text-red-300/90 transition hover:bg-red-500/[0.12] hover:text-red-200 active:scale-[.97]"
                >
                  Yes
                </button>
                <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-white/[0.08]" />
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="whitespace-nowrap py-2 pl-3.5 pr-4 text-[12px] text-muted/60 transition hover:bg-white/[0.04] hover:text-foreground active:scale-[.97]"
                >
                  keep it
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] text-muted/60 transition hover:text-red-400/80"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {!collapsed && error && (
        <p className="mt-4 text-[13px] text-red-400/90">{error}</p>
      )}
    </section>
  );
}
