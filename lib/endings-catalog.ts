import { isKnownBank } from "./sound-palette";

/**
 * ENDINGS — how a song stops, as data (2026-08-02, the user: "we should have a
 * few options for how to end a song, which should work similar to like the
 * breaks, we have something defined with parameters and the AI can choose it").
 *
 * WHY THIS EXISTS. The ending used to be a raw Strudel line the arrangement
 * model wrote freehand, and freehand it wrote a HELD CHORD: a pad with
 * `sustain(0.7)` sat at constant level for the whole tail and then stopped
 * dead. The song didn't ring out, it just ended — which is precisely what the
 * user heard. A ring-out is not a sound, it is a SHAPE: something has to fall
 * to nothing. So every template here ends at zero by construction, and no model
 * is trusted to remember that.
 *
 * Same contract as lib/breaks-catalog: the model picks a template and its
 * knobs, the expression is built deterministically from them, and the same
 * knobs are under the user's fingers afterwards. Zero AI to tweak.
 *
 * A template is given the song's TONIC (the root it should land on) because an
 * ending that isn't in the song's key isn't an ending, it's an accident.
 *
 * NO SOUNDFONTS IN A TAIL (2026-08-02, the user: "maybe it is because of the
 * sound engine"). These lines are the LAST four bars of a song and, unlike
 * every other note in it, their sound may appear nowhere else — a `gm_*` font
 * whose first and only use is the outro has to be fetched and decoded right at
 * the moment it must sound, and a font that isn't loaded yet plays SILENCE.
 * That is a ring-out you cannot hear. So every tail is built from the engine's
 * built-in oscillators (triangle, sawtooth), which are always there, shaped
 * with the filter and envelope instead of borrowed from a sample bank. The one
 * sampled voice left is the crash, and it rides alongside a synth chord that
 * carries the gesture on its own if the bank is cold.
 */

export type EndingKnobField = "bars" | "gain" | "tone" | "space";

/** The tweak surface — one row per knob, shared by the panel and the API. */
export const ENDING_KNOBS = [
  { field: "bars", word: "Length", min: 1, max: 16, int: true },
  { field: "gain", word: "Level", min: 0, max: 1.2 },
  { field: "tone", word: "Tone", min: 0, max: 1 },
  { field: "space", word: "Space", min: 0, max: 1 },
] as const;

export function endingKnobText(field: EndingKnobField, v: number): string {
  if (field === "bars") return `${Math.round(v)} ${Math.round(v) === 1 ? "bar" : "bars"}`;
  return `${Math.round(v * 100)}%`;
}

export interface EndingMove {
  tpl: string;
  /** The word the control wears. */
  word: string;
  /** What it does, in the ear's language — shown under the word. */
  hint: string;
  /** Natural length in bars — a starting point, not a limit. */
  bars: number;
  /** Default level. */
  gain: number;
  /**
   * The tail, built for the length it's given and the song's tonic.
   *
   * EVERY ONE MUST REACH SILENCE. `saw.range(hi, 0)` descends across the whole
   * tail, so whatever the material is, the last thing you hear is it leaving.
   */
  code: (a: { bars: number; root: string; chord: string; bank: string }) => string;
}

const DEF_BANK = "RolandTR909";

export const ENDING_MOVES: EndingMove[] = [
  {
    tpl: "ring",
    word: "Ring out",
    hint: "the last chord struck once and left to decay",
    bars: 4,
    gain: 0.5,
    code: ({ bars, chord }) =>
      `note("${chord}").s("triangle").attack(0.02).decay(${(bars * 0.5).toFixed(2)}).sustain(0).release(${(bars * 0.9).toFixed(2)}).lpf(2600).gain(saw.range(0.9,0).slow(${bars}))`,
  },
  {
    tpl: "breath",
    word: "Let it breathe",
    hint: "nothing new — the room empties and the tails fall away",
    bars: 2,
    gain: 1,
    // Silence is a real ending: the transport keeps running so every reverb and
    // delay already in the air decays instead of being guillotined.
    code: () => `silence`,
  },
  {
    tpl: "fall",
    word: "Fall away",
    hint: "the tonic walks down and thins into nothing",
    bars: 4,
    gain: 0.5,
    code: ({ bars, root }) =>
      `note("<${root} ${root}>").s("triangle").attack(0.01).decay(1.4).sustain(0).release(2.4).gain(saw.range(0.8,0).slow(${bars})).lpf(saw.range(6000,400).slow(${bars}))`,
  },
  {
    tpl: "crash",
    word: "Crash and hold",
    hint: "one last hit, ringing until it's gone",
    bars: 4,
    gain: 0.55,
    code: ({ bars, chord, bank }) =>
      `stack(s("cr").bank("${bank}").gain(0.9), note("${chord}").s("sawtooth").attack(0.01).decay(${(bars * 0.5).toFixed(2)}).sustain(0).release(${(bars * 0.8).toFixed(2)}).lpf(1800).gain(0.5)).gain(saw.range(1,0).slow(${bars}))`,
  },
  {
    tpl: "dim",
    word: "Close the lid",
    hint: "the light goes out of it — the filter shuts as it fades",
    bars: 4,
    gain: 0.5,
    code: ({ bars, chord }) =>
      `note("${chord}").s("sawtooth").attack(0.05).decay(${bars}).sustain(0).release(${(bars * 0.6).toFixed(2)}).lpf(saw.range(5000,220).slow(${bars})).lpq(3).gain(saw.range(0.85,0).slow(${bars}))`,
  },
  {
    tpl: "cut",
    word: "Cut",
    hint: "it stops on the beat — nothing after it",
    bars: 1,
    gain: 1,
    code: () => `silence`,
  },
];

export function endingMoveOf(tpl: string): EndingMove | undefined {
  return ENDING_MOVES.find((m) => m.tpl === tpl);
}

export function endingKnobDefault(move: EndingMove, field: EndingKnobField): number {
  if (field === "bars") return move.bars;
  if (field === "gain") return move.gain;
  return field === "tone" ? 1 : 0.35;
}

const clamp = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** "D minor" → the tonic note name for octave 2, and a voiced triad to land on. */
export function tonicOf(key: string): { root: string; chord: string } {
  const m = /^([a-gA-G][#b]?)\s*(minor|min|m|major|maj)?/.exec((key || "").trim());
  const letter = (m?.[1] ?? "c").toLowerCase();
  const minor = /^m/i.test(m?.[2] ?? "minor");
  // A plain triad, voiced low and open — the chord a piece comes to rest on.
  const third = minor ? 3 : 4;
  const semis = [0, third, 7];
  const NOTES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const base = NOTES.indexOf(letter.replace("b", "#"));
  const at = (n: number) => {
    const i = (base + n) % 12;
    const oct = 2 + Math.floor((base + n) / 12);
    return `${NOTES[i < 0 ? i + 12 : i]}${oct}`;
  };
  return {
    root: `${letter}2`,
    chord: `[${semis.map(at).join(",")}]`,
  };
}

/**
 * The ending's playable expression — deterministic, and always arriving at
 * silence. Returns null for an unknown template so the caller can fall back.
 */
export function endingExpr(o: {
  tpl: string;
  key?: string;
  bars?: number;
  gain?: number;
  tone?: number;
  space?: number;
  bank?: string;
}): string | null {
  const m = endingMoveOf(o.tpl);
  if (!m) return null;
  const bars = Math.max(1, Math.min(16, Math.floor(clamp(o.bars, 1, 16, m.bars))));
  const g = clamp(o.gain, 0, 1.2, m.gain);
  const tone = clamp(o.tone, 0, 1, 1);
  const space = clamp(o.space, 0, 1, 0.35);
  const { root, chord } = tonicOf(o.key ?? "C major");
  const bank = o.bank && isKnownBank(o.bank) ? o.bank : DEF_BANK;
  let x = m.code({ bars, root, chord, bank });
  if (x === "silence") return x; // nothing to colour — the room does the work
  x = `(${x}).mul(gain(${Math.round(g * 100) / 100}))`;
  if (tone < 0.99) x += `.lpf(${Math.round(400 * Math.pow(30, tone))})`;
  if (space > 0.01) x += `.room(${Math.round(space * 100) / 100}).roomsize(${(4 + space * 6).toFixed(1)})`;
  return x;
}
