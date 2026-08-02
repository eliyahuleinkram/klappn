import { isKnownBank } from "./sound-palette";

/**
 * BREAKS — deterministic drum FILLS at the turns of a song (2026-07-16, the
 * user: a break is a BREAKING POINT, not a beat — it rides the closing
 * bar(s) of one loop so the music breaks seamlessly into the next). No AI at
 * add time: each template is a fixed fill, and arrange masks it to the very
 * end of the loop it's anchored to. The song's own setcpm carries the tempo,
 * and cycle = bar, so the fills land in any meter.
 *
 * HOW LONG it runs belongs to the SECTION, not the template (2026-08-02): the
 * catalog `bars` is only a starting point, and `BreakOverlay.bars` — authored
 * per turn, dialled by the Length knob — is what actually plays. Where it sits
 * is never a question: a break ends ON the change, or it isn't a turn.
 *
 * The knobs (Length / Level / Heat / Tone / Space) are pure math too — clamped
 * ranges baked straight into the line at arrange time. Zero AI, live-slideable.
 */

export interface BreakOverlay {
  id: string;
  /** Template key from BREAK_MOVES — the code re-expands from this. */
  tpl: string;
  name?: string;
  /** How many CLOSING bars of the anchor loop the fill occupies (2026-08-02,
   *  the user: "what if a loop repeats itself 16 times… the break should be on
   *  the last 3 bars"). A turn is a proportion of the SECTION, not a property
   *  of the template. Absent = the template's own length (every break written
   *  before this rides its catalog length, unchanged). */
  bars?: number;
  /** THE KIT the fill is played on (2026-08-02, the user). Every template used
   *  to hardcode RolandTR909, so a lo-fi hip-hop turn and a techno turn broke
   *  on the same snare. A verified bank name (lib/sound-palette PALETTE_BANKS);
   *  absent = the template's own default. */
  bank?: string;
  /** Level, 0..1.2 — multiplies the fill's own envelope. */
  gain: number;
  /** Tune, -12..+12 semitones — the whole kit up or down (sample rate, so it
   *  shortens as it rises: a tight snare gets tighter). Default 0. */
  tune?: number;
  /** Pan, 0..1 — where the fill sits across the stereo field. Default 0.5. */
  pan?: number;
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

/** The tweak surface — one row per knob, shared by panel + API clamps.
 *  A break ENDS AT THE TURN — that's what makes it a turn (2026-08-02, the
 *  user, after a short-lived "Early" knob: "there should be no early parameter,
 *  just length"). So the only thing in time is how LONG it is, counted in whole
 *  bars; everything else is a feel, in percent. */
export const BREAK_KNOBS = [
  { field: "bars", word: "Length", min: 1, max: 8, int: true },
  { field: "gain", word: "Level", min: 0, max: 1.2 },
  { field: "heat", word: "Heat", min: 0, max: 0.6 },
  { field: "tone", word: "Tone", min: 0, max: 1 },
  { field: "space", word: "Space", min: 0, max: 0.8 },
  { field: "tune", word: "Tune", min: -12, max: 12, int: true },
  { field: "pan", word: "Pan", min: 0, max: 1 },
] as const;
export type BreakKnobField = (typeof BREAK_KNOBS)[number]["field"];

/** How a knob reads on the panel: bars say bars, feels say percent. */
export function breakKnobText(field: BreakKnobField, v: number): string {
  if (field === "bars") return `${Math.round(v)} ${Math.round(v) === 1 ? "bar" : "bars"}`;
  if (field === "tune") {
    const n = Math.round(v);
    return n === 0 ? "as sampled" : `${n > 0 ? "+" : ""}${n} semitones`;
  }
  if (field === "pan") {
    const n = Math.round(v * 100);
    return n === 50 ? "centre" : n < 50 ? `${50 - n} left` : `${n - 50} right`;
  }
  return `${Math.round(v * 100)}%`;
}

export function breakKnobDefault(move: BreakMove, field: BreakKnobField): number {
  if (field === "gain") return move.gain;
  if (field === "bars") return move.bars;
  if (field === "pan") return 0.5;
  return field === "tone" ? 1 : 0;
}

/** The kits a turn may be played on — classic machines whose one-shot names
 *  (bd sd hh oh cp rim cr rd ht mt lt) the templates rely on. Verified against
 *  PALETTE_BANKS by the caller; the AI picks one, the panel offers the same. */
export const DEFAULT_BREAK_BANK = "RolandTR909";
export const BREAK_BANKS = [
  "RolandTR909",
  "RolandTR808",
  "RolandTR707",
  "RolandTR606",
  "LinnDrum",
  "AkaiMPC60",
  "OberheimDMX",
  "AlesisHR16",
  "EmuSP12",
  "BossDR550",
] as const;

export interface BreakMove {
  tpl: string;
  word: string;
  hint: string;
  gain: number;
  /** The fill's NATURAL length in bars — the starting point for the Length
   *  knob, not a limit. */
  bars: number;
  /** The fill, authored FOR THE LENGTH IT IS GIVEN (cycle = bar).
   *
   *  A fill is one gesture, not a bar that repeats (2026-08-02, the user: "if
   *  we are increasing the intensity in the break that intensity should
   *  continue to increase, not drop back down to zero because it is a
   *  repeat"). So every template takes its real length and spreads its whole
   *  arc across it: densities step once per bar from first to last, and every
   *  envelope is .slow(bars) so it climbs exactly once, end to end. At the
   *  natural length these produce what they always did.
   *
   *  Each carries its OWN .gain envelope — the Level knob multiplies it
   *  (.mul(gain)) instead of overwriting it. */
  code: (bars: number) => string;
}

/**
 * `bars` per-bar steps from `lo` to `hi`, as a cycle list ("<4 8 16 32>") —
 * one step per bar, so a density climbs across the WHOLE fill instead of
 * restarting every bar. Geometric, because doubling is how drums intensify.
 */
function ramp(lo: number, hi: number, bars: number): string {
  const n = Math.max(1, Math.floor(bars));
  if (n === 1) return `${hi}`;
  return Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(lo * Math.pow(hi / lo, i / (n - 1)))),
  ).join(" ");
}

/**
 * A tom cascade over `bars` bars: the voice pair walks DOWN the kit once, one
 * step per bar, landing on the snare in the last. `hits` sets the density.
 *
 * Written per-bar rather than by stretching a two-bar figure with .slow() — a
 * fractional slow smears the cascade off the barline, and an integer one over
 * eight bars leaves a hit every other bar, which is not a fill. At the natural
 * two bars this produces exactly what it always did.
 */
function descent(bars: number, hits: number): string {
  const V = ["ht", "mt", "lt", "sd"];
  const n = Math.max(1, Math.floor(bars));
  return Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 2 : Math.round((i / (n - 1)) * 2);
    const last = i === n - 1;
    return `[${V[a]}*${hits} ${V[a + 1]}*${last ? hits * 2 : hits}]`;
  }).join(" ");
}

export const BREAK_MOVES: BreakMove[] = [
  {
    tpl: "roll",
    word: "Snare roll",
    hint: "a snare roll that lifts into the turn",
    gain: 0.85,
    bars: 1,
    // one unbroken swell, however long it runs
    code: (b) => `s("sd*16").gain(saw.range(0.4,0.95).slow(${b}))`,
  },
  {
    tpl: "run",
    word: "Tom run",
    hint: "toms tumble down into the turn",
    gain: 0.9,
    bars: 1,
    // one long tumble down the kit — never the same bar falling twice
    code: (b) =>
      b > 1
        ? `s("<${descent(b, 4)}>").gain(saw.range(0.7,1).slow(${b}))`
        : `s("ht [ht mt] [mt lt] [lt sd sd sd]").gain(0.9)`,
  },
  {
    tpl: "build",
    word: "Rising build",
    hint: "a roll that doubles as it climbs",
    gain: 0.7,
    bars: 4,
    // one step per bar, 4ths up to 32nds across the whole length
    code: (b) =>
      `s("sd*<${ramp(4, 32, b)}>").gain(saw.range(0.5,1).slow(${b}))`,
  },
  {
    tpl: "stutter",
    word: "Kick stutter",
    hint: "the kick trips over itself into the turn",
    gain: 0.9,
    bars: 1,
    code: (b) =>
      b > 1
        ? `s("bd*<${ramp(2, 16, b)}>").gain(saw.range(0.6,1).slow(${b}))`
        : `s("bd*2 bd*3 bd*4 bd*8").gain(0.9)`,
  },
  {
    tpl: "clap",
    word: "Clap build",
    hint: "claps double up into the turn",
    gain: 0.8,
    bars: 2,
    code: (b) =>
      `s("cp*<${ramp(4, 8, b)}>").gain(saw.range(0.5,0.95).slow(${b}))`,
  },
  {
    tpl: "crash",
    word: "Crash out",
    hint: "one last push, the crash rings over the turn",
    gain: 0.85,
    bars: 1,
    // the crash belongs to the LAST bar — the bars before it push toward it
    code: (b) =>
      b > 1
        ? `s("<${ramp(4, 16, b - 1)
            .split(" ")
            .map((n) => `sd*${n}`)
            .join(" ")} [~ ~ [sd sd] [sd cr]]>").gain(saw.range(0.6,1).slow(${b}))`
        : `s("~ ~ [sd sd] [sd cr]").gain(0.9)`,
  },
  {
    tpl: "tumble",
    word: "Tom fall",
    hint: "toms cascade down the turn",
    gain: 0.9,
    bars: 2,
    // the cascade falls once across the fill, never resetting to the top
    code: (b) => `s("<${descent(b, 2)}>").gain(0.9)`,
  },
  {
    tpl: "lift",
    word: "Hat lift",
    hint: "hats rise and hang on the turn",
    gain: 0.6,
    bars: 1,
    // hats thicken bar by bar and the filter opens across the whole rise
    code: (b) =>
      b > 1
        ? `s("hh*<${ramp(8, 16, b)}>").hpf(saw.range(3000,9000).slow(${b})).gain(saw.range(0.4,0.8).slow(${b}))`
        : `s("hh*8 hh*8 hh*16 [hh*16 oh]").hpf(5000).gain(saw.range(0.4,0.8))`,
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
  bank?: string;
  tune?: number;
  pan?: number;
  /** The fill's REAL length in bars — what the caller is actually going to
   *  play, after clamping to the section. The template authors its whole arc
   *  across exactly this many bars. Absent = its natural length. */
  bars?: number;
}): string | null {
  const m = breakMoveOf(o.tpl);
  if (!m) return null;
  const bars = Math.max(
    1,
    Math.min(16, Math.floor(Number.isFinite(o.bars as number) ? (o.bars as number) : m.bars)),
  );
  const g = clamp(o.gain, 0, 1.2, m.gain);
  const heat = clamp(o.heat, 0, 0.6, 0);
  const tone = clamp(o.tone, 0, 1, 1);
  const space = clamp(o.space, 0, 0.8, 0);
  const tune = Math.round(clamp(o.tune, -12, 12, 0));
  const pan = clamp(o.pan, 0, 1, 0.5);
  // THE KIT (2026-08-02). Unverified names are ignored rather than written —
  // a bank that doesn't exist loads nothing and the whole turn goes silent.
  const bank = o.bank && isKnownBank(o.bank) ? o.bank : DEFAULT_BREAK_BANK;
  let x = `${m.code(bars)}.bank("${bank}")`;
  // .mul(gain(g)) rides the template's own envelope; .gain(g) would erase it
  x += `.mul(gain(${Math.round(g * 100) / 100}))`;
  // tune rides the sample rate — 12 semitones up is double speed (and half as
  // long, which is exactly how a pitched-up fill should behave)
  if (tune !== 0) x += `.speed(${(Math.pow(2, tune / 12)).toFixed(4)})`;
  if (heat > 0.01) x += `.shape(${Math.round(heat * 100) / 100})`;
  // tone: exponential 400 Hz → 12 kHz; fully open = no filter in the line
  if (tone < 0.99) x += `.lpf(${Math.round(400 * Math.pow(30, tone))})`;
  if (space > 0.01) x += `.room(${Math.round(space * 100) / 100})`;
  if (Math.abs(pan - 0.5) > 0.01) x += `.pan(${Math.round(pan * 100) / 100})`;
  return x;
}
