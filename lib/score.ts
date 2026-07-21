/**
 * The engine-agnostic, music-theory SCORE a loop is composed from, plus the
 * per-layer SOUND assignments. These are the shared data shapes of the
 * composition pipeline (construct the score → pick the sounds → render the whole
 * loop). Kept in their own module so the composer (lib/anthropic.ts), the job core
 * (lib/jobs.ts) and the DB layer (lib/songs.ts) can all use them without importing
 * one another.
 *
 * The score is an EXPLICIT, note-by-note event timeline (like a piano roll): every
 * sounding note is one event placed on the beat grid (bar + within-bar t). That
 * precision is the point — it makes the render mechanical and keeps every layer
 * locked to the same grid + the one shared progression, so the parts cohere by
 * construction. The render (one call, all layers together) then turns the whole
 * score into the Strudel loop.
 */

/** One sounding note — a single pitch, a struck chord, or a drum hit — placed on
 *  the loop's beat timeline. */
export interface ScoreEvent {
  /** Which cycle of the loop this note sits in — 0-indexed (0 = first bar, up to
   *  loopBars-1). 1 cycle = 1 bar. */
  bar: number;
  /** Onset WITHIN that bar, in beats from the bar's downbeat: 0 ≤ t < beatsPerBar
   *  (0 = downbeat, 0.5 = "& of beat 1", 0.25/0.75 = sixteenths). Cycle-relative,
   *  so it can never exceed the cycle length. */
  t: number;
  /** How long the note is held, in beats (sustain/decay; MAY ring past the bar end). */
  dur: number;
  /** Scientific pitch ("D4"); an ARRAY = a chord struck together
   *  (["D3","F3","A3"]); or a percussion role token: kick | snare | clap | rim |
   *  hat_closed | hat_open | ride | crash | tom | perc. c4 = middle C = MIDI 60. */
  pitch: string | string[];
  /** Strike strength, 0..1 (accents are higher-vel events). */
  vel: number;
  /** Articulation: staccato | tenuto | legato | let-ring | accent. */
  art: string;
}

/** One voice / layer of the loop — becomes exactly one Strudel "$:" line. */
export interface ScorePart {
  /** Short name, e.g. "warm sub bass", "rhodes chords". */
  name: string;
  /** Its musical job: bass, harmony pad, lead melody, rhythm / groove, … */
  role: string;
  /** Acoustic description ONLY — no product, synth or sample names. */
  instrumentCharacter: string;
  /** The sound's space, in musical terms: "close and dry" or "distant /
   *  reverberant". */
  space: string;
  /** Register / tessitura, e.g. "low (Bb1–F2)". */
  register: string;
  /** Every sounding note, fully enumerated on the beat timeline. */
  events: ScoreEvent[];
  /** Optional EXACT-repeat directive for identical bars, e.g. "bars 2-8 reproduce
   *  bar 1's events verbatim, each onset shifted by the bar offset". */
  repeat?: string;
}

/** One chord of the loop's single shared progression. */
export interface ScoreChord {
  /** Which bars it spans, 0-indexed, e.g. "0-1". */
  bars: string;
  /** Roman numeral, e.g. "i", "iv", "V7". */
  roman: string;
  /** Strudel / iReal chord symbol, e.g. "Dm", "F^7", "C7". */
  chord: string;
  /** The chord tones, e.g. ["D","F","A"]. */
  tones: string[];
}

/** The full engine-agnostic score for ONE loop. */
export interface LoopScore {
  key: string;
  tonic: string;
  mode: string;
  tempoBpm: number;
  /** Time signature, "N/D" (almost always "4/4"). */
  meter: string;
  /** The time signature's beats-per-bar (4 for 4/4). */
  beatsPerBar: number;
  /** Loop length in bars — a power of 2 (4 / 8 / 16), sized to ~20 seconds. */
  loopBars: number;
  /** One-line form / phrase shape. */
  form: string;
  /** One-line dynamic arc across the loop. */
  dynamicArc: string;
  harmony: {
    /** How fast the chords change, e.g. "one chord every 2 bars". */
    harmonicRhythm: string;
    progression: ScoreChord[];
  };
  /** The single part name that owns the low register (the sub). */
  lowRegisterOwner: string;
  parts: ScorePart[];
}

// ── LAYER-BY-LAYER MODEL (rev 2026-06) ────────────────────────────────────────
// A loop is now an ordered list of TRACKS, each generated on its own (one "$:"
// line) and carrying its own tweak panel — so the UI shows every track separately
// and you tweak each directly. The playable Strudel is just setcpm(...) + the
// tracks' code joined. This supersedes the score→pick→render shapes above.

/** One tweak knob on a track: a real Strudel method (gain, lpf, room, …) exposed
 *  as a slider over [min,max], starting at the line's current value. */
export interface TrackControl {
  /** Short UI label, e.g. "Filter", "Reverb". */
  name: string;
  /** The Strudel method it drives, e.g. "lpf" — the slider rewrites this arg. */
  param: string;
  min: number;
  max: number;
  /** Current value (the line's value for `param` at generation). */
  value: number;
}

/** A one-tap chip on a track: a PRESET of slider values (no AI, no rewrite) — tapping
 *  it just moves this track's knobs to `set`. Pre-baked by the model at generation. */
export interface TrackPill {
  /** Plain-language name a non-musician gets: "Darker", "Punchier", "More space". */
  name: string;
  /** param → target value, each within that control's [min,max]. Keys are the
   *  track's own control params (e.g. {"lpf":600,"room":0.7}). */
  set: Record<string, number>;
}

/** One generated layer of the loop = exactly one Strudel "$:" line, plus the tweak
 *  panel (label + knobs + preset pills) the model produced for it. */
export interface LoopTrack {
  /** The single "$:" line, ready to play (gated + auto-fixed). */
  code: string;
  /** 2-3 word name a non-musician gets, e.g. "Sub Bass", "Hi-Hats". */
  label: string;
  /** 1-3 word name for the layer's DEFAULT feel as generated, e.g. "Punchy 909", "Warm Drift" —
   *  labels the "back to original" Feel chip so it DESCRIBES the sound (not the word "Signature"). */
  signature?: string;
  /** The knobs worth touching on this track (normie-named: "Volume", "Filter"). */
  controls: TrackControl[];
  /** One-tap slider PRESETS — tapping sets `pill.set` onto the knobs (no AI). */
  pills: TrackPill[];
  /** Alternative INSTRUMENTS for this layer (tap to swap the sound). `via` is which
   *  method to rewrite — "sound" (synth voice) or "bank" (drum kit). No AI on tap. */
  swap?: { via: "sound" | "bank"; options: { name: string; s: string }[] };
  /** The sound/kit token the layer STARTED on, captured the first time it's swapped, so
   *  the card's ⟲ "back to original" can restore the instrument too (not just the knobs).
   *  Absent until the first swap; an un-swapped layer is already on its original. */
  origSound?: string;
  /** The PLAIN-LANGUAGE musical intent the composer wrote for this layer (notes / rhythm /
   *  dynamics / movement), BEFORE it was transcribed to Strudel. Persisted so the add-track
   *  path can carry each existing layer's MEANING forward (not just its dense code) when
   *  composing the next voice. Absent on pre-2026-06-24 / legacy-engine tracks. */
  notation?: string;
  /** Muted = dropped from the playable mix (still shown, un-mutable). */
  muted?: boolean;
  /** True once the LAZY enrich has run for this layer (panels are built on the card's first
   *  open — never at generation — so unopened layers cost nothing; see enrichPartLayer).
   *  Absent on pre-2026-07-13 tracks, whose panels were baked in at generation. */
  enriched?: boolean;
}

/** The instrument / drum-kit chosen for ONE part before the render, plus the
 *  deterministic mix routing (derived from the part's dynamic + index). */
export interface SoundPick {
  /** The part this applies to — matches ScorePart.name. */
  name: string;
  /** A melodic / harmonic instrument: an oscillator name or a gm_* name. */
  sound?: string;
  /** A drum part: the drum-machine bank for .bank(). */
  bank?: string;
  /** The part's bus level (0..1-ish). */
  gain?: number;
  /** The effects-bus number; layers with distinct reverb/delay get distinct orbits. */
  orbit?: number;
}
