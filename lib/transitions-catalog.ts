/**
 * TRANSITIONS — how one song becomes the next, as data (2026-08-03, the user:
 * "the transitions should work in the same way as the ending of songs do, you
 * can choose which type of transition you want, and then there are tweaks
 * available").
 *
 * Same contract as lib/endings-catalog and lib/breaks-catalog: the model picks
 * a template and its knobs, the gesture is built deterministically from them,
 * and those same knobs are under your fingers afterwards. Zero AI to tweak.
 *
 * WHAT IS DIFFERENT FROM AN ENDING. An ending is MATERIAL — a tail, written as
 * Strudel, appended to the song. A transition is a GESTURE: nothing is written
 * into anybody's code, because the two songs are already whole. It is the hand
 * on the mixer between them — level, filter, echo, the tape slowing down — plus
 * the one moment the record changes. So a template here is a pure function of
 * time: give it how far through the move you are and it says where every dial
 * stands. The room just follows it (ZaltzIDE.runTransition), and puts every
 * dial back exactly where you left it when the move is over.
 *
 * TIME IS MEASURED IN BARS, and the swap lands ON THE GRID. `lands` is the
 * bar-line the next song arrives on; the gesture is started EARLY by exactly
 * its own swap offset so the drop is on the beat and not a bar after it.
 */

export type TransitionKnobField = "lands" | "bars" | "depth" | "tone" | "space";

export interface TransitionKnobs {
  lands: number;
  bars: number;
  depth: number;
  tone: number;
  space: number;
}

export interface TransitionShape extends Partial<TransitionKnobs> {
  tpl: string;
}

/** The tweak surface — one row per knob, shared by the panel and the API. */
export const TRANSITION_KNOBS = [
  // WHEN it lands, first and full-width: the bar-line the next song arrives on.
  // 0 is "the second you say so" — everything else waits for the music.
  { field: "lands", word: "Lands on", min: 0, max: 8, int: true },
  { field: "bars", word: "Takes", min: 1, max: 8, int: true },
  { field: "depth", word: "Depth", min: 0, max: 1 },
  { field: "tone", word: "Tone", min: 0, max: 1 },
  { field: "space", word: "Space", min: 0, max: 1 },
] as const;

export function transitionKnobText(field: TransitionKnobField, v: number): string {
  if (field === "lands") {
    const n = Math.round(v);
    if (n === 0) return "the second you say so";
    return n === 1 ? "the next bar" : `the next ${n}-bar line`;
  }
  if (field === "bars") {
    const n = Math.round(v);
    return `${n} ${n === 1 ? "bar" : "bars"}`;
  }
  return `${Math.round(v * 100)}%`;
}

/** Where every dial stands at one instant of the move. */
export interface TransitionFrame {
  /** Multiplier on the room's own master level, 0..1. */
  master: number;
  /** Offset added to the perf FILTER dial (-100 shut, +100 thinned). */
  filter: number;
  /** Echo send the gesture asks for, 0..1 (combined with yours by max). */
  echo: number;
  /** Reverb send the gesture asks for, 0..1 (same). */
  space: number;
  /** Multiplier on the scheduler's cps — 1 is the song's own tempo. */
  rate: number;
  /** Echo delay time in seconds, when the gesture wants it tempo-locked. */
  echoTime?: number;
  /** Echo regen 0..0.85, when the gesture wants it. */
  echoTail?: number;
}

/** A one-shot the gesture throws (a riser, an impact) — never in your panes. */
export interface TransitionHit {
  /** Milliseconds from the start of the gesture. */
  ms: number;
  s: string;
  note: number;
  gain: number;
  /** Seconds. */
  duration: number;
}

export interface TransitionMove {
  tpl: string;
  /** The word the control wears. */
  word: string;
  /** What it does, in the ear's language — shown under the word. */
  hint: string;
  /** Defaults, the same shape as the knobs. */
  def: TransitionKnobs;
  /** Which knobs actually shape it; the rest are shown dimmed with a reason. */
  uses: TransitionKnobField[];
  /** How far through the gesture the record changes, 0..1. */
  swap: number;
  /** Where the dials stand at t (0..1 across the whole gesture). */
  at: (t: number, k: TransitionKnobs, barSecs: number) => TransitionFrame;
  /** One-shots, placed in the gesture's own time. */
  hits?: (k: TransitionKnobs, totalSecs: number) => TransitionHit[];
}

/** At rest — every dial where the room left it. */
const REST: TransitionFrame = { master: 1, filter: 0, echo: 0, space: 0, rate: 1 };

/** 0 → 1 → 0 across the move, peaking where the songs change. */
const arc = (t: number, swap: number): number => {
  const x = t < swap ? (swap <= 0 ? 1 : t / swap) : 1 - (t - swap) / (1 - swap || 1);
  return Math.sin((Math.max(0, Math.min(1, x)) * Math.PI) / 2);
};
const ease = (x: number): number => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

export const TRANSITION_MOVES: TransitionMove[] = [
  {
    tpl: "cut",
    word: "Straight in",
    hint: "no ceremony — on the beat, the next song is simply there",
    def: { lands: 1, bars: 1, depth: 0, tone: 1, space: 0 },
    uses: ["lands"],
    swap: 0,
    at: () => REST,
  },
  {
    tpl: "blend",
    word: "Blend",
    hint: "the room dips, and the new song is already inside it",
    def: { lands: 4, bars: 2, depth: 0.8, tone: 0.55, space: 0.3 },
    uses: ["lands", "bars", "depth", "tone", "space"],
    swap: 0.5,
    at: (t, k) => {
      const a = arc(t, 0.5);
      return {
        master: 1 - 0.94 * k.depth * a,
        // TONE is how dark the gap goes: wide open at 1, shut down at 0.
        filter: -(1 - k.tone) * 70 * a,
        echo: 0,
        space: k.space * 0.7 * a,
        rate: 1,
      };
    },
  },
  {
    tpl: "sweep",
    word: "Sweep",
    hint: "the old song closes down; the new one opens up under your hand",
    def: { lands: 4, bars: 4, depth: 0.75, tone: 0.3, space: 0.2 },
    uses: ["lands", "bars", "depth", "tone", "space"],
    swap: 0.5,
    at: (t, k) => {
      // TONE picks the direction the room travels: below halfway it SHUTS
      // (low-pass closing to a rumble), above it THINS (high-pass climbing).
      const dir = k.tone < 0.5 ? -1 : 1;
      const extent = (45 + 55 * k.depth) * dir;
      const a = t < 0.5 ? ease(t / 0.5) : 1 - ease((t - 0.5) / 0.5);
      return {
        master: 1 - 0.3 * k.depth * arc(t, 0.5),
        filter: extent * a,
        echo: 0,
        space: k.space * 0.6 * arc(t, 0.5),
        rate: 1,
      };
    },
  },
  {
    tpl: "echo",
    word: "Echo out",
    hint: "the last bar smears into the dark and the next one walks in dry",
    def: { lands: 4, bars: 2, depth: 0.7, tone: 0.4, space: 0.35 },
    uses: ["lands", "bars", "depth", "tone", "space"],
    swap: 0.45,
    at: (t, k, barSecs) => {
      const rise = t < 0.45 ? ease(t / 0.45) : Math.pow(1 - (t - 0.45) / 0.55, 1.6);
      const after = t > 0.45 ? 1 - (t - 0.45) / 0.55 : 0;
      return {
        master: 1 - 0.55 * k.depth * arc(t, 0.45),
        // the smear darkens as it falls behind the new song
        filter: -(1 - k.tone) * 55 * after,
        echo: Math.max(0, k.depth * rise),
        space: k.space * 0.8 * rise,
        rate: 1,
        // the throw is TEMPO-LOCKED — a quarter of a bar, so the smear stays
        // in time with the room instead of fighting it
        echoTime: Math.max(0.05, Math.min(1.4, barSecs / 4)),
        echoTail: 0.3 + 0.45 * k.depth,
      };
    },
  },
  {
    tpl: "lift",
    word: "Lift",
    hint: "a rise gathers over the old song, breaks, and drops you into the new one",
    def: { lands: 8, bars: 4, depth: 0.8, tone: 0.6, space: 0.3 },
    uses: ["lands", "bars", "depth", "tone", "space"],
    swap: 0.82,
    at: (t, k) => {
      const up = ease(t / 0.82);
      const after = t > 0.82;
      return {
        // thin the room out under the riser so the rise owns the air
        master: after ? 1 : 1 - 0.3 * k.depth * up,
        filter: after ? 0 : (25 + 55 * k.depth) * up,
        echo: 0,
        space: after ? 0 : k.space * 0.6 * up,
        rate: 1,
      };
    },
    hits: (k, totalSecs) => [
      {
        ms: 0,
        s: "gm_reverse_cymbal",
        // TONE is the rise's pitch — low and heavy, or bright and screaming.
        note: Math.round(45 + k.tone * 33),
        gain: 0.25 + 0.55 * k.depth,
        duration: Math.max(0.5, totalSecs * 0.82),
      },
      {
        ms: Math.round(totalSecs * 0.82 * 1000),
        s: "gm_taiko_drum",
        note: 36,
        gain: 0.3 + 0.5 * k.depth,
        duration: 1.6,
      },
    ],
  },
  {
    tpl: "drag",
    word: "Tape stop",
    hint: "everything drags to a halt — and then the next one is on top of you",
    def: { lands: 4, bars: 2, depth: 0.75, tone: 0.35, space: 0.2 },
    uses: ["lands", "bars", "depth", "tone", "space"],
    swap: 0.78,
    at: (t, k) => {
      if (t >= 0.78) {
        // the record is back at speed the instant the new song lands
        const back = (t - 0.78) / 0.22;
        return { master: Math.min(1, 0.55 + back * 0.8), filter: 0, echo: 0, space: 0, rate: 1 };
      }
      const x = ease(t / 0.78);
      return {
        // 1 → as low as a tenth of tempo: the motor giving up
        master: 1 - 0.85 * k.depth * Math.pow(x, 1.5),
        filter: -(1 - k.tone) * 75 * x,
        echo: 0,
        space: k.space * 0.7 * x,
        rate: Math.max(0.08, 1 - (0.55 + 0.4 * k.depth) * x),
      };
    },
  },
];

export function transitionMoveOf(tpl: string): TransitionMove | undefined {
  return TRANSITION_MOVES.find((m) => m.tpl === tpl);
}

/** The one every seam wears until somebody says otherwise. */
export const DEFAULT_TRANSITION = "blend";

const clamp = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** A stored shape → a complete, in-range set of knobs. Unknown template → blend. */
export function transitionKnobsOf(shape: TransitionShape | null | undefined): {
  move: TransitionMove;
  knobs: TransitionKnobs;
} {
  const move =
    transitionMoveOf(String(shape?.tpl ?? "")) ?? transitionMoveOf(DEFAULT_TRANSITION)!;
  const d = move.def;
  return {
    move,
    knobs: {
      lands: Math.round(clamp(shape?.lands, 0, 8, d.lands)),
      bars: Math.round(clamp(shape?.bars, 1, 8, d.bars)),
      depth: clamp(shape?.depth, 0, 1, d.depth),
      tone: clamp(shape?.tone, 0, 1, d.tone),
      space: clamp(shape?.space, 0, 1, d.space),
    },
  };
}

export function transitionKnobDefault(move: TransitionMove, field: TransitionKnobField): number {
  return move.def[field];
}

/** What the model handed back, made safe to store. */
export function sanitizeTransition(raw: unknown): TransitionShape {
  const r = (raw ?? {}) as Partial<TransitionKnobs> & { tpl?: unknown };
  const { move, knobs } = transitionKnobsOf({ ...r, tpl: String(r.tpl ?? "") });
  return { tpl: move.tpl, ...knobs };
}

export interface TransitionPlan {
  tpl: string;
  /** The whole move, in milliseconds. */
  totalMs: number;
  /** When inside it the record changes. */
  swapMs: number;
  /** The bar-grid the swap must land on (0 = right now). */
  lands: number;
  /** Where every dial stands `ms` into the move. */
  frameAt: (ms: number) => TransitionFrame;
  /** One-shots, in the gesture's own time. */
  hits: TransitionHit[];
}

/**
 * The playable gesture — deterministic, and always ending back at rest.
 *
 * `cps` is the room's real cycles-per-second, and a cycle IS a bar here (the
 * house contract), so a 4-bar move at 0.5 cps is 8 seconds long.
 */
export function transitionPlan(
  shape: TransitionShape | null | undefined,
  cps: number | null | undefined,
): TransitionPlan {
  const { move, knobs } = transitionKnobsOf(shape);
  const barSecs = cps && cps > 0 ? 1 / cps : 2;
  const totalSecs = move.tpl === "cut" ? 0 : knobs.bars * barSecs;
  const totalMs = Math.round(totalSecs * 1000);
  return {
    tpl: move.tpl,
    totalMs,
    swapMs: Math.round(totalMs * move.swap),
    lands: knobs.lands,
    frameAt: (ms) => {
      if (totalMs <= 0) return REST;
      const t = Math.max(0, Math.min(1, ms / totalMs));
      return move.at(t, knobs, barSecs);
    },
    hits: totalMs > 0 ? (move.hits?.(knobs, totalSecs) ?? []) : [],
  };
}

/** Every sound a transition can throw — warmed before the night starts. */
export const TRANSITION_SOUNDS: string[] = Array.from(
  new Set(
    TRANSITION_MOVES.flatMap((m) =>
      (m.hits?.(m.def, 4) ?? []).map((h) => h.s),
    ),
  ),
);
