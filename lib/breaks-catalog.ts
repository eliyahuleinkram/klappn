/**
 * BREAKS — deterministic drum FILLS at the turns of a song (2026-07-16, the
 * user: a break is a BREAKING POINT, not a beat — it rides the closing
 * bar(s) of one loop so the music breaks seamlessly into the next). No AI at
 * add time: each template is a fixed fill for its last `bars` bars; arrange
 * masks it to the very end of the loop it's anchored to. The song's own
 * setcpm carries the tempo, and cycle = bar, so the fills land in any meter.
 *
 * The knobs (Level / Heat / Tone / Space) are pure math too — clamped ranges
 * baked straight into the line at arrange time. Zero AI, live-slideable.
 */

export interface BreakOverlay {
  id: string;
  /** Template key from BREAK_MOVES — the code re-expands from this. */
  tpl: string;
  name?: string;
  /** Level, 0..1.2 — multiplies the fill's own envelope. */
  gain: number;
  /** Heat — drive into the wave, 0..0.6 (.shape). Default 0. */
  heat?: number;
  /** Tone — how open the top is, 0..1 (lpf 400→12k, exp). Default 1 = open. */
  tone?: number;
  /** Space — room send, 0..0.8 (.room). Default 0 = dry. */
  space?: number;
  /** The loop whose ENDING the break rides — the fill breaks it into the
   *  next. (toId kept equal for wire compat with the riding-range era.) */
  fromId: string;
  toId: string;
}

/** The tweak surface — one row per knob, shared by panel + API clamps. */
export const BREAK_KNOBS = [
  { field: "gain", word: "Level", min: 0, max: 1.2 },
  { field: "heat", word: "Heat", min: 0, max: 0.6 },
  { field: "tone", word: "Tone", min: 0, max: 1 },
  { field: "space", word: "Space", min: 0, max: 0.8 },
] as const;
export type BreakKnobField = (typeof BREAK_KNOBS)[number]["field"];

export function breakKnobDefault(move: BreakMove, field: BreakKnobField): number {
  if (field === "gain") return move.gain;
  return field === "tone" ? 1 : 0;
}

export interface BreakMove {
  tpl: string;
  word: string;
  hint: string;
  gain: number;
  /** How many closing bars of the anchor loop the fill occupies. */
  bars: number;
  /** The fill (cycle = bar). Every template carries its OWN .gain envelope —
   *  the Level knob multiplies it (.mul(gain)) instead of overwriting it. */
  code: () => string;
}

export const BREAK_MOVES: BreakMove[] = [
  {
    tpl: "roll",
    word: "Snare roll",
    hint: "a roll that lifts the last bar into the turn",
    gain: 0.85,
    bars: 1,
    code: () => `s("sd*16").bank("RolandTR909").gain(saw.range(0.4,0.95))`,
  },
  {
    tpl: "run",
    word: "Tom run",
    hint: "toms tumble down through the last bar",
    gain: 0.9,
    bars: 1,
    code: () =>
      `s("ht [ht mt] [mt lt] [lt sd sd sd]").bank("RolandTR909").gain(0.9)`,
  },
  {
    tpl: "build",
    word: "Rising build",
    hint: "a roll that doubles as it climbs, four bars",
    gain: 0.7,
    bars: 4,
    code: () =>
      `s("sd*<4 8 16 32>").bank("RolandTR909").gain(saw.range(0.5,1).slow(4))`,
  },
  {
    tpl: "stutter",
    word: "Kick stutter",
    hint: "the kick trips over itself into the turn",
    gain: 0.9,
    bars: 1,
    code: () => `s("bd*2 bd*3 bd*4 bd*8").bank("RolandTR909").gain(0.9)`,
  },
  {
    tpl: "clap",
    word: "Clap build",
    hint: "claps double across the last two bars",
    gain: 0.8,
    bars: 2,
    code: () =>
      `s("cp*<4 8>").bank("RolandTR909").gain(saw.range(0.5,0.95).slow(2))`,
  },
  {
    tpl: "crash",
    word: "Crash out",
    hint: "one last push, the crash rings over the turn",
    gain: 0.85,
    bars: 1,
    code: () => `s("~ ~ [sd sd] [sd cr]").bank("RolandTR909").gain(0.9)`,
  },
  {
    tpl: "tumble",
    word: "Tom fall",
    hint: "toms cascade down the last two bars",
    gain: 0.9,
    bars: 2,
    code: () =>
      `s("<[ht*2 mt*2] [lt*2 sd*4]>").bank("RolandTR909").gain(0.9)`,
  },
  {
    tpl: "lift",
    word: "Hat lift",
    hint: "hats rise and hang on the turn",
    gain: 0.6,
    bars: 1,
    code: () =>
      `s("hh*8 hh*8 hh*16 [hh*16 oh]").bank("RolandTR909").hpf(5000).gain(saw.range(0.4,0.8))`,
  },
];

export function breakMoveOf(tpl: string): BreakMove | undefined {
  return BREAK_MOVES.find((m) => m.tpl === tpl);
}

const clamp = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** The fill's playable expression — deterministic. The caller (arrange)
 *  masks it to the anchor loop's closing bars; this is just the line. */
export function breakExpr(o: {
  tpl: string;
  gain: number;
  heat?: number;
  tone?: number;
  space?: number;
}): string | null {
  const m = breakMoveOf(o.tpl);
  if (!m) return null;
  const g = clamp(o.gain, 0, 1.2, m.gain);
  const heat = clamp(o.heat, 0, 0.6, 0);
  const tone = clamp(o.tone, 0, 1, 1);
  const space = clamp(o.space, 0, 0.8, 0);
  // .mul(gain(g)) rides the template's own envelope; .gain(g) would erase it
  let x = `${m.code()}.mul(gain(${Math.round(g * 100) / 100}))`;
  if (heat > 0.01) x += `.shape(${Math.round(heat * 100) / 100})`;
  // tone: exponential 400 Hz → 12 kHz; fully open = no filter in the line
  if (tone < 0.99) x += `.lpf(${Math.round(400 * Math.pow(30, tone))})`;
  if (space > 0.01) x += `.room(${Math.round(space * 100) / 100})`;
  return x;
}
