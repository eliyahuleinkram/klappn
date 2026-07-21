import {
  cancelEchoReference,
  denoise,
  encodeWavPcm16,
  highpass,
  mixToMono,
  psolaShift,
  quantizeSegments,
  segmentsFromVoicing,
  yinTrack,
} from "./vocal-dsp";

/**
 * THE VOCAL PIPELINE — raw take in, finished take out. Pure math (runs in a
 * Worker via lib/vocal-worker, or inline as the fallback):
 *
 *   reference echo cancel (when the engine's output was captured alongside
 *   the RAW mic) → trim head → high-pass → MMSE-LSA denoise →
 *   YIN pitch track → RETUNE-SPEED PSOLA re-tune (see below) →
 *   beat-grid timing alignment → peak normalize → WAV (full-rate).
 *
 * THE TUNER IS A RETUNE SPEED, NOT A GATE. The old design spliced verbatim
 * input against corrected resynthesis behind a hysteresis gate — and every
 * seam between the two states was a potential dip; a vibrato hovering the
 * threshold made a TRAIN of them (the "artificial/crackly" verdict). Now the
 * correction is CONTINUOUS everywhere:
 *   (a) a TARGET curve — voiced runs are segmented into NOTES (split on
 *       sustained >80-cent moves) and each note targets the scale note
 *       nearest its median f0, a stepwise curve;
 *   (b) the sung pitch is PULLED toward the target by a one-pole whose time
 *       constant the Tune knob sets: 0.3 → ~220 ms (lazy, natural), 0.65 →
 *       ~120 ms, 1.0 → ~35 ms (tight). Note onsets START at the sung pitch
 *       (the pull state resets to "no correction") and glide in; vibrato
 *       survives because the pull is slow next to a 5–6 Hz wobble;
 *   (c) the ratio curve (target-pulled / sung) is median-3 + EMA smoothed —
 *       no gate, no splice, no seams;
 *   (d) PSOLA resynthesizes the WHOLE take with that smooth curve. In-tune
 *       passages ride at ratio ≈ 1 — near-transparent resynthesis.
 * Timing/denoise stay 0..1 strengths; 0 bypasses those stages entirely.
 *
 * An optional VOICE CHARACTER (see ProcessInput.character) rides the same
 * PSOLA pass: transpose, formant scale and pitch-flatten compose with the
 * correction ratios, so one render bakes both the fix and the identity.
 * `targetSemis` transposes the TARGET curve — the singer is pulled to the
 * TRANSPOSED scale, which is how a song-level key/transpose change carries
 * the voice with it (re-run from the raw take).
 */

export interface ProcessInput {
  left: Float32Array;
  right?: Float32Array;
  sampleRate: number;
  /** The engine's own output, captured alongside the RAW mic (see
   *  lib/vocal-client createVoiceRecorder). When present, the pipeline runs
   *  reference echo cancellation FIRST — we subtract the exact music the
   *  speakers played instead of letting the browser's half-duplex AEC gate
   *  and warble the voice. Mono; resampled here if the rates differ. */
  ref?: Float32Array;
  refSampleRate?: number;
  /** Head trim: how far into the recording the song's downbeat landed (ms). */
  trimMs: number;
  bpm: number;
  /** Grid resolution for timing snap: 2 = 8th notes, 4 = 16ths. */
  subdivision: number;
  /** Scale pitch classes (0-11); null = chromatic snap (still in tune). */
  scalePcs: number[] | null;
  tune: number;
  timing: number;
  denoiseAmt: number;
  /** Waveform-editor CUTS, seconds on the POST-TRIM timeline. The removed
   *  spans become silence (never a splice — the take stays aligned to the
   *  song), with 8ms fades so the edit doesn't click. Kept here so knob
   *  re-runs from the raw take preserve the edits. */
  cuts?: { start: number; end: number }[];
  /** VOICE CHARACTER — a one-tap identity baked into the render, applied
   *  inside the tune stage's ratio math (so it composes with correction and
   *  rides the same median+EMA smoothing):
   *    semis     — transpose: every ratio × 2^(semis/12).
   *    formant   — spectral-envelope scale passed to psolaShift (>1 chipmunk,
   *                <1 giant); pitch and timbre move independently.
   *    flatten   — 0..1 pull of the (post-snap) pitch toward flattenHz,
   *                geometric in ratio; 1 = constant pitch (the ROBOT).
   *    flattenHz — the flatten target; null/unset = the take's median f0.
   *  A character runs even at tune 0 — identities don't require correction. */
  character?: {
    semis?: number;
    formant?: number;
    flattenHz?: number | null;
    flatten?: number;
  };
  /** TARGET TRANSPOSE (semitones, may be negative): shifts the tuner's TARGET
   *  curve — the sung pitch is pulled to the TRANSPOSED scale, so a song-level
   *  key/transpose change re-tunes the voice into the new key (re-run from the
   *  raw take). Unlike character.semis (a uniform ratio multiply), this rides
   *  the correction itself: the transpose part of the pull is NOT clamped and
   *  note onsets start at the already-transposed sung pitch (no scoop). At
   *  tune 0 it degrades to a plain transpose. Default 0. */
  targetSemis?: number;
  /** When true, ProcessOutput.rawWav carries the echo-cancelled but otherwise
   *  UNPROCESSED mono (pre-trim, pre-everything) as WAV — the durable source
   *  the server stores so later key/transpose changes can re-tune from it. */
  wantRaw?: boolean;
}

export interface ProcessOutput {
  wav: ArrayBuffer;
  /** The echo-cancelled, otherwise untouched mono take as WAV (pre-trim —
   *  trimMs/cuts live in the saved fx json so a re-run reproduces them).
   *  Present only when ProcessInput.wantRaw was set. */
  rawWav?: ArrayBuffer;
  durationMs: number;
  sampleRate: number;
  /** What the singer actually did — measured PRE-correction, so the vocal
   *  coach judges the take, not our own processing. */
  stats: {
    medianF0: number;
    minF0: number;
    maxF0: number;
    voicedRatio: number;
    seconds: number;
    /** Echo-cancel observability: present when a reference rode along —
     *  whether cancellation actually ran (a silent reference skips it), how
     *  much overall energy it removed, the estimated speaker→mic delay and
     *  the trust blend β. Persisted into the saved fx json (echoStats) so a
     *  field take that came back with music in it can be diagnosed. */
    echo?: {
      applied: boolean;
      attenuationDb: number;
      beta?: number;
      delayMs?: number;
    };
  };
}

const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// --- the song's key → scale pitch classes (for the tuner) -------------------

const NOTE_PC: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6,
  g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11,
};
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** "E minor" / "F# major" → the scale's pitch classes; null when unparsable
 *  (the tuner then snaps chromatically — still in tune, just not diatonic). */
export function scaleFromKey(key: string | undefined | null): number[] | null {
  if (!key) return null;
  const m = key.trim().toLowerCase().match(/^([a-g][#b]?)\s*(major|minor|maj|min|m)?/);
  if (!m) return null;
  const tonic = NOTE_PC[m[1]];
  if (tonic === undefined) return null;
  const minor = m[2] === "minor" || m[2] === "min" || m[2] === "m";
  const steps = minor ? MINOR : MAJOR;
  return steps.map((s) => (tonic + s) % 12);
}

/** The scale's pitch classes shifted by `semis` semitones — the scale a take
 *  was actually SUNG in when the song was transposed at record time. */
export function shiftScale(
  pcs: number[] | null,
  semis: number,
): number[] | null {
  if (!pcs || !semis) return pcs;
  const s = ((Math.round(semis) % 12) + 12) % 12;
  return pcs.map((p) => (p + s) % 12);
}

function medianSmooth(x: Float32Array, win: number): Float32Array {
  const half = Math.floor(win / 2);
  const out = new Float32Array(x.length);
  const buf: number[] = [];
  for (let i = 0; i < x.length; i++) {
    buf.length = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(x.length - 1, i + half); j++)
      buf.push(x[j]);
    buf.sort((a, b) => a - b);
    out[i] = buf[Math.floor(buf.length / 2)];
  }
  return out;
}

// --- the retune-speed tuner ---------------------------------------------------

/** The Tune knob → the retune TIME CONSTANT (seconds): how fast a note is
 *  pulled onto its target. Piecewise-linear in ln(τ) through the calibrated
 *  points — 0.3 → 220 ms (lazy, natural), 0.65 → 120 ms, 1.0 → 35 ms (tight).
 *  This is the TOTAL chain constant; the ratio EMA's own ~36 ms is subtracted
 *  from the pull so the knob's number is what the ear actually gets. */
function retuneTau(tune: number): number {
  const knots: [number, number][] = [
    [0, 0.35],
    [0.3, 0.22],
    [0.65, 0.12],
    [1, 0.035],
  ];
  const t = Math.max(0, Math.min(1, tune));
  for (let i = 1; i < knots.length; i++) {
    if (t <= knots[i][0]) {
      const [x0, y0] = knots[i - 1];
      const [x1, y1] = knots[i];
      const f = (t - x0) / (x1 - x0);
      return Math.exp(Math.log(y0) + f * (Math.log(y1) - Math.log(y0)));
    }
  }
  return 0.035;
}

/** Nearest scale note (as a MIDI number, any octave) to f0. */
function nearestScaleMidi(f0: number, scale: number[]): number {
  const midi = 69 + 12 * Math.log2(f0 / 440);
  let best = Math.round(midi);
  let bestD = Infinity;
  for (const pc of scale) {
    const cand = pc + 12 * Math.round((midi - pc) / 12); // nearest octave of this pc
    const d = Math.abs(cand - midi);
    if (d < bestD) {
      bestD = d;
      best = cand;
    }
  }
  return best;
}

/**
 * The TARGET curve: per voiced frame, the scale note (MIDI) that frame is
 * pulled toward; 0 where unvoiced. Voiced runs are segmented into NOTES —
 * split where the (median-smoothed) sung pitch moves >80 cents away from the
 * note's running center and STAYS there ~50 ms — and each note's target is
 * the scale note nearest its own median f0. Stepwise by construction: the
 * target never chases vibrato or a scoop; it re-decides only at note changes.
 */
function buildTargetMidi(
  f0: Float32Array,
  voiced: Uint8Array,
  hop: number,
  sr: number,
  scale: number[],
): Float32Array {
  const n = f0.length;
  const target = new Float32Array(n);
  const hopSec = hop / sr;
  const SUSTAIN = Math.max(2, Math.ceil(0.05 / hopSec)); // ~50 ms of "it moved"
  let i = 0;
  while (i < n) {
    if (!(voiced[i] && f0[i] > 0)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && voiced[j + 1] && f0[j + 1] > 0) j++;
    const len = j - i + 1;
    const cents = new Float32Array(len);
    for (let k = 0; k < len; k++) cents[k] = 1200 * Math.log2(f0[i + k] / 440);
    const sm = medianSmooth(cents, 5);
    const closeSeg = (a: number, b: number): void => {
      // the note's target = nearest scale note to its MEDIAN sung pitch
      const buf: number[] = [];
      for (let k = a; k < b; k++) buf.push(f0[i + k]);
      buf.sort((x, y) => x - y);
      const med = buf[buf.length >> 1];
      const note = nearestScaleMidi(med, scale);
      for (let k = a; k < b; k++) target[i + k] = note;
    };
    let segStart = 0;
    let mean = sm[0]; // running center of the current note
    let count = 1;
    let excur = 0; // consecutive frames >80c away from the center
    for (let k = 1; k < len; k++) {
      if (Math.abs(sm[k] - mean) > 80) {
        excur++;
        if (excur >= SUSTAIN) {
          const cut = k - SUSTAIN + 1; // split where the move began
          closeSeg(segStart, cut);
          segStart = cut;
          mean = sm[cut];
          count = 1;
          for (let q = cut + 1; q <= k; q++) {
            count++;
            mean += (sm[q] - mean) / count;
          }
          excur = 0;
        }
      } else {
        excur = 0;
        count++;
        mean += (sm[k] - mean) / count;
      }
    }
    closeSeg(segStart, len);
    i = j + 1;
  }
  return target;
}

function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.max(1, Math.round((x.length * to) / from));
  const out = new Float32Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = x[Math.min(j, x.length - 1)];
    const b = x[Math.min(j + 1, x.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function processTakeBuffers(m: ProcessInput): ProcessOutput {
  const sr = m.sampleRate;
  let x = mixToMono(m.left, m.right);

  // Reference echo cancellation — BEFORE the trim: mic and reference are
  // captured sample-locked by one worklet (lib/vocal-capture-worklet), so
  // their zero points line up exactly (the cross-correlation inside measures
  // the one CONSTANT speaker→mic delay).
  let echoStats:
    | { applied: boolean; attenuationDb: number; beta?: number; delayMs?: number }
    | undefined;
  if (m.ref && m.ref.length) {
    const ref =
      m.refSampleRate && m.refSampleRate !== sr
        ? resampleLinear(m.ref, m.refSampleRate, sr)
        : m.ref;
    echoStats = { applied: false, attenuationDb: 0 };
    x = cancelEchoReference(x, ref, sr, echoStats);
  }

  // THE RAW — echo-cancelled, otherwise untouched, PRE-trim: the durable
  // source of truth a key/transpose change re-tunes from later. Captured here
  // (before trim/cuts/denoise/tune all of which live in the saved fx json)
  // so a re-run from this WAV reproduces the take exactly.
  const rawWav = m.wantRaw ? encodeWavPcm16([x], sr) : undefined;

  // Head trim: t=0 of the take becomes t=0 of the song. The cut lands on the
  // nearest zero-crossing (searched ±5 ms — inaudible as timing, exactly the
  // difference between silence and a step) and the first 5 ms fade in: a
  // slice landing mid-waveform starts the take on a discontinuity, and a
  // discontinuity is a click.
  const trim = Math.min(x.length, Math.max(0, Math.round((m.trimMs / 1000) * sr)));
  if (trim > 0) {
    const R = Math.round(0.005 * sr);
    let cut = trim;
    for (let k = 0; k <= R; k++) {
      const f = trim + k; // prefer forward — never resurrect trimmed audio
      const b = trim - k;
      if (f + 1 < x.length && x[f] <= 0 !== x[f + 1] <= 0) {
        cut = f + 1;
        break;
      }
      if (k > 0 && b > 0 && x[b - 1] <= 0 !== x[b] <= 0) {
        cut = b;
        break;
      }
    }
    x = x.slice(Math.min(cut, x.length)); // fresh buffer — safe to mutate
    const F = Math.min(x.length, Math.round(0.005 * sr));
    for (let i = 0; i < F; i++) x[i] *= i / F;
  }

  // Editor cuts → silence-with-fades. Silencing (not splicing) keeps every
  // later sample exactly where the singer put it against the song.
  if (m.cuts?.length) {
    x = x.slice();
    const fade = Math.round(0.008 * sr);
    for (const c of m.cuts) {
      const a = Math.max(0, Math.min(x.length, Math.round(c.start * sr)));
      const b = Math.max(a, Math.min(x.length, Math.round(c.end * sr)));
      for (let i = Math.max(0, a - fade); i < a; i++)
        x[i] *= (a - i) / fade;
      x.fill(0, a, b);
      for (let i = b; i < Math.min(x.length, b + fade); i++)
        x[i] *= (i - b) / fade;
    }
  }

  x = highpass(x, sr, 80);
  if (m.denoiseAmt > 0.01) x = denoise(x, sr, Math.min(1, m.denoiseAmt));

  const track = yinTrack(x, sr);

  // Stats before any correction — the coach must hear the SINGER.
  const f0s: number[] = [];
  let voicedCount = 0;
  for (let i = 0; i < track.f0.length; i++) {
    if (track.voiced[i] && track.f0[i] > 0) {
      f0s.push(track.f0[i]);
      voicedCount++;
    }
  }
  f0s.sort((a, b) => a - b);
  const stats = {
    medianF0: f0s[Math.floor(f0s.length / 2)] ?? 0,
    minF0: f0s[0] ?? 0,
    maxF0: f0s[f0s.length - 1] ?? 0,
    voicedRatio: track.f0.length ? voicedCount / track.f0.length : 0,
    seconds: x.length / sr,
    echo: echoStats,
  };

  const ch = m.character;
  const chSemis = ch?.semis ?? 0;
  const chFormant = ch?.formant ?? 1;
  const chFlatten = Math.max(0, Math.min(1, ch?.flatten ?? 0));
  // The flatten target: explicit Hz, else the take's own median — the robot
  // speaks at YOUR center, whoever you are.
  const flatHz = ch?.flattenHz ?? stats.medianF0;
  const hasCharacter = chSemis !== 0 || chFormant !== 1 || chFlatten > 0.001;

  const targetSemis = m.targetSemis ?? 0;
  const doTune = m.tune > 0.01;
  if (doTune || hasCharacter || targetSemis !== 0) {
    const scale = m.scalePcs && m.scalePcs.length ? m.scalePcs : CHROMATIC;
    const semisMul = Math.pow(2, chSemis / 12);
    const semisCents = targetSemis * 100;
    const ratios = new Float32Array(track.f0.length);
    const targetMidi = doTune
      ? buildTargetMidi(track.f0, track.voiced, track.hop, sr, scale)
      : null;
    const hopSec = track.hop / sr;
    // The knob names the TOTAL retune time. The ratio EMA below is part of
    // that chain (~36 ms of its own), so the pull runs at the remainder —
    // at Tune 1.0 the pull is effectively instant and the EMA alone sets the
    // ~35 ms glide.
    const EMA_TC = -hopSec / Math.log(1 - 0.15);
    const k = 1 - Math.exp(-hopSec / Math.max(0.003, retuneTau(m.tune) - EMA_TC));
    // The pull state, in cents of correction (sung → target). Rests at the
    // plain transpose: a note ONSET starts at the (transposed) sung pitch —
    // "state resets to sung, not target" — and glides onto the note.
    let s = semisCents;
    for (let i = 0; i < ratios.length; i++) {
      if (!(track.voiced[i] && track.f0[i] > 0)) {
        ratios[i] = 1;
        continue;
      }
      const f0 = track.f0[i];
      let r: number;
      if (doTune && targetMidi![i] > 0) {
        const sungC = 1200 * Math.log2(f0 / 440);
        const tgtC = (targetMidi![i] - 69) * 100 + semisCents;
        // Nudge, never yank: the CORRECTION part of the error is clamped to
        // ±250 cents; the transpose part passes whole (a move, not a fix).
        const err =
          semisCents + Math.max(-250, Math.min(250, tgtC - semisCents - sungC));
        const onset = i === 0 || !track.voiced[i - 1];
        if (onset) s = semisCents;
        else s += k * (err - s);
        r = Math.pow(2, s / 1200);
      } else {
        // Tune off: a pure transpose (identity when targetSemis is 0 too —
        // characters still work with correction off).
        r = Math.pow(2, semisCents / 1200);
      }
      if (chFlatten > 0 && flatHz > 0) {
        // Geometric (cents-linear) mix of the corrected pitch toward flatHz:
        // flatten 1 replaces it outright — constant pitch (the ROBOT).
        const target = f0 * r;
        r = (Math.pow(flatHz / target, chFlatten) * target) / f0;
      }
      ratios[i] = r * semisMul;
    }
    // Median-3 rides over single-frame tracker blips; the one-pole EMA
    // (alpha 0.15 ≈ 36 ms) rounds off the ~6 ms frame steps PSOLA would
    // otherwise render as a faint zipper on held notes. The EMA state RESETS
    // at every unvoiced→voiced edge so a fresh note starts exactly on its
    // onset ratio instead of gliding in from the silence ratio (1.0). The
    // resulting curve is CONTINUOUS everywhere — no gate, no verbatim splice,
    // no seams; in-tune passages simply ride at ratio ≈ 1 through PSOLA.
    const smooth = medianSmooth(ratios, 3);
    let ema = 1;
    for (let i = 0; i < smooth.length; i++) {
      const onset = track.voiced[i] && (i === 0 || !track.voiced[i - 1]);
      if (onset) ema = smooth[i];
      else ema += 0.15 * (smooth[i] - ema);
      smooth[i] = ema;
    }
    x = psolaShift(
      x,
      sr,
      track,
      (i) => smooth[Math.min(i, smooth.length - 1)] || 1,
      chFormant,
    );
  }

  if (m.timing > 0.01 && m.bpm > 0) {
    const segs = segmentsFromVoicing(track.f0, track.voiced, track.hop, sr);
    if (segs.length) {
      x = quantizeSegments(
        x,
        sr,
        segs,
        { bpm: m.bpm, subdivision: Math.max(1, m.subdivision) },
        Math.min(1, m.timing),
        // 90 ms max: a phrase nudged toward the grid, never yanked — bigger
        // shifts audibly chopped real singing (150 was in doubled-syllable
        // territory at slow tempos).
        90,
      );
    }
  }

  // Peak-normalize to −3 dBFS so every take sits at the same level under the
  // mix. (Was −1 dB: a vocal parked 1 dB under full scale is HOT against the
  // music and leaves the FX chain nothing — drive pre-gain, the doubler/echo/
  // plate sends and the 1.5× Voice knob all stack on top of this peak. −3 dB
  // keeps takes consistent with EACH OTHER while the Voice knob, not the
  // file, decides how loud the voice rides.)
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak > 1e-4) {
    const g = 0.708 / peak; // −3 dBFS
    for (let i = 0; i < x.length; i++) x[i] *= g;
  }

  const wav = encodeWavPcm16([x], sr);
  return {
    wav,
    rawWav,
    durationMs: Math.round((x.length / sr) * 1000),
    sampleRate: sr,
    stats,
  };
}
