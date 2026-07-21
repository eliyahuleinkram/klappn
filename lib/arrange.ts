/**
 * Native song sequencing — the WHOLE song as ONE Strudel pattern.
 *
 * The old sequencer stepped sections with wall timers: at each boundary it
 * hush()ed and re-evaluated the next loop, so every seam carried the evaluate
 * cost as an audible gap (worst on phones), and lead-compensation hacks made
 * desktop timing worse. Strudel already HAS the primitive for "this loop, then
 * that loop": arrange([cycles, pattern], ...) — the scheduler then renders
 * every seam as pure pattern math, sample-exact on every device, and a
 * backgrounded phone keeps flowing through transitions because they live
 * INSIDE the pattern, not in a timer.
 *
 * This module is pure string→string so it can be unit-tested headless: it
 * converts a loop's `$:`-layer program into a single `stack(...)` expression
 * and composes sections into an `arrange(...)` program.
 */

import { attachHydraBlock, extractHydra, stripHydraBlock } from "./hydra-embed";
import { breakExpr, breakMoveOf, type BreakOverlay } from './breaks-catalog';
import { rebusArrangement } from "./reverb-orbits";

/** One playable section going into the arrangement. */
export interface ArrangeSection {
  id: string;
  /** DECORATED code (post transformForPlayback — carries its own setcpm). */
  code: string;
  /** Musical length in seconds (already repeat-aware). */
  seconds: number;
  /** Explicit span length in cycles — overrides seconds (hold extensions). */
  cycles?: number;
  /** Model-authored arrangement for this section (plan.arrangement) — layer
   *  entries/exits, sweeps and overlays rendered by sectionEntries. Optional:
   *  absent = the whole loop plays for the whole span (the classic behavior). */
  arr?: SectionArrange | null;
}

// ── the model-authored arrangement spec (persisted as plan.arrangement) ──────
// These shapes are CAPABILITY, not policy: every field is optional, every value
// is the model's (or absent). The renderer only validates and executes.

/** From `bar` (0-based, within the section's span) only these layers play —
 *  1-based indices into the section's active `$:` lines, [] = silence. */
export interface SectionMove {
  bar: number;
  layers: number[];
}

/** Wrap the section in `.param(signal.range(from,to).slow(bars))` over
 *  [bar, bar+bars) — a filter rise, a gain fall, any single-arg control. */
export interface SectionSweep {
  param: string;
  from: number;
  to: number;
  bar: number;
  bars: number;
  /** linear (saw, default) or sine (up-and-back). */
  curve?: "linear" | "sine";
  /** This effect's FEEL — the model's 2-4 words for the move a listener feels
   *  ("Swelling from the dark"), sentence-cased. The chip's face. */
  name?: string;
  /** The effect's KNOBS — AI-named once (the low-effort enrich pass, like a
   *  layer's tweak panel), ridden in real time with zero AI: each binds a
   *  musical name + range to one end of the glide. Never read by the renderer. */
  controls?: SweepControl[];
  /** The AI-authored home values — what "revert this effect" restores. Stamped
   *  once at authoring (composeSongArrangement); UI-only, never read here. */
  home?: { from: number; to: number };
  /** Legacy (07-13b, superseded by controls): tappable preset variants. */
  takes?: SweepTake[];
}

/** One knob on an effect: a musical name for one end of the glide and the
 *  range worth exploring there. Moving it writes sweep[field] — pure math. */
export interface SweepControl {
  name: string;
  field: "from" | "to";
  min: number;
  max: number;
}

/** A sweep's ADJUSTABLE fields as one bundle — what the effect knobs write
 *  (values + where/how long it rides). Param and identity never change here. */
export interface SweepTake {
  name?: string;
  from: number;
  to: number;
  curve?: "linear" | "sine";
  bar?: number;
  bars?: number;
}

/** One-way material riding the section: an extra expression superimposed over
 *  [bar, bar+bars) — a riser, a fill, an impact. Plays from ITS time 0 at
 *  `bar`; a multi-bar gesture writes its own .slow(bars). */
export interface SectionOverlay {
  bar: number;
  bars: number;
  code: string;
  /** The model's 2-4 word CHARACTER for the gesture ("white-noise riser") —
   *  what the chip shows instead of the raw Strudel. */
  name?: string;
}

export interface SectionArrange {
  /** Total bars this section occupies (a 4-bar loop can unfold over 16) —
   *  an explicit ArrangeSection.cycles (a user hold) still wins over it. */
  bars?: number;
  moves?: SectionMove[];
  sweeps?: SectionSweep[];
  overlays?: SectionOverlay[];
  /** Active-layer count the moves were authored against. When the section's
   *  current layer count differs (a mute or edit shifted the indices) the
   *  moves are skipped — sweeps/overlays don't reference indices and stay. */
  layerCount?: number;
  /** The model-authored BAR-LENGTH OPTIONS for this loop (≤4, multiples of its
   *  natural length, always including the active `bars`). The user picks from
   *  these — never a free stepper. UI metadata, never read by the renderer. */
  lengths?: number[];
  /** Cached unfolds keyed by String(bars) — every length already composed for
   *  this loop, so switching back is instant and zero-AI. Each take is a full
   *  moves/sweeps state for that span. Never read by the renderer. */
  takes?: Record<string, SectionTake>;
  /** Legacy: the global Feel option ("build"|…) — dead since per-effect feels
   *  (2026-07-13); tolerated on old rows, never written or read. */
  feel?: string;
}

/** One cached length's unfold — what swaps in when its bar count is chosen. */
export interface SectionTake {
  moves?: SectionMove[];
  sweeps?: SectionSweep[];
  layerCount?: number;
}

/** How the song ends. mode "stop" = play once then stop (playback reads
 *  Arrangement.ends), optionally with a final one-shot (the ring-out). Absent
 *  or "loop" = wrap forever (the classic behavior). */
export interface SongEnding {
  mode?: "stop" | "loop";
  code?: string;
  bars?: number;
}

/** The whole song's model-authored arrangement, persisted as plan.arrangement
 *  (composed by lib/arrange-plan.ts, rendered here). Sections are keyed by
 *  part id; a section absent from the map plays whole — the classic behavior.
 *  LEGACY since chapters (2026-07-14): new songs materialize their unfold as
 *  real parts + song-level effects; this spec renderer keeps old songs alive. */
export interface SongArrangement {
  sections?: Record<string, SectionArrange>;
  ending?: SongEnding | null;
}

/** A SONG-LEVEL effect (chapters era, 2026-07-14): one glide living OUTSIDE
 *  the loops, riding the song's own timeline from the start of part `fromId`
 *  through the end of part `toId` (inclusive). Because it's anchored to parts,
 *  a repeated loop STRETCHES the glide instead of restarting it, and reorders
 *  carry it with its chapters. Persisted as plan.effects. */
export interface SongFx {
  /** Stable identity for edits (the UI/PATCH key). */
  id: string;
  param: string;
  from: number;
  to: number;
  /** linear (saw, default) or sine (up-and-back). */
  curve?: "linear" | "sine";
  /** The move a listener feels ("Swelling from the dark") — the band's face. */
  name?: string;
  /** AI-named knobs (the fx-enrich pattern) — UI-only. */
  controls?: SweepControl[];
  /** The authored home values — what ↺ restores. */
  home?: { from: number; to: number };
  fromId: string;
  toId: string;
}

export interface ArrangeSpan {
  id: string;
  /** Arrangement-cycle where this section starts (inclusive). */
  start: number;
  /** Arrangement-cycle where it ends (exclusive). */
  end: number;
  /** The section's own loop length in cycles (bars) — phrase unit for holds. */
  bars: number;
}

export interface Arrangement {
  /** Full program: setcpm + final arrange(...) expression (+ @hydra block). */
  program: string;
  spans: ArrangeSpan[];
  totalCycles: number;
  /** cycles per second — for mapping scheduler time to spans. */
  cps: number;
  /** True when the song ENDS at totalCycles (SongEnding mode "stop") — the
   *  player must stop there instead of letting the pattern wrap. */
  ends: boolean;
}

/** `setcpm(a/b)` or `setcpm(n)` argument, or null when absent. Takes the LAST
 *  occurrence — evaluate() executes them in order so the last one is what the
 *  code actually means, and decorated code can carry a stale baked setcpm
 *  ahead of the live-dial one appended by transformForPlayback (taking the
 *  first pinned the arrangement to the stale tempo: dials did nothing, or a
 *  beats-less baked value played wildly fast). */
export function parseSetcpm(code: string): string | null {
  const all = code.match(/setcpm\(\s*[0-9.]+(?:\s*\/\s*[0-9.]+)?\s*\)/g);
  if (!all || all.length === 0) return null;
  const m = all[all.length - 1].match(/setcpm\(\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)\s*\)/);
  return m ? m[1].replace(/\s+/g, "") : null;
}

function cpmToCps(arg: string): number {
  const [a, b] = arg.split("/").map(Number);
  const cpm = b ? a / b : a;
  return cpm / 60;
}

/**
 * A loop program decomposed for arranging: one expression per `$:`/`_$:` line
 * (in order — the 1-based indices SectionMove.layers point at) plus the folded
 * mix-bus tail. A MUTED `_$:` layer keeps its slot as `silence` (2026-07-13:
 * mute must never shift the indices an unfold was authored against — it used
 * to drop the whole moves timeline). setcpm lines, comments and blank lines
 * drop away. Returns null when the code contains statements we can't safely
 * embed (a `let`/`const`/function prelude) — the caller falls back to the
 * stepper.
 */
export function sectionParts(code: string): { layers: string[]; mixTail: string } | null {
  const src = stripHydraBlock(code || "");
  const lines = src.split("\n");
  const layers: string[] = [];
  // Song-wide SOUND dials arrive as trailing `all(x => x.lpf(…))` mix-bus lines
  // (see lib/playback applyMixSound). Left as top-level statements they made the
  // whole section non-embeddable → the song fell off the gapless arrange() path
  // onto the seam-gapping stepper. A master effect over every hap is the same
  // whether applied per-layer via all() or once onto the combined stack, so we
  // FOLD each such transform onto the final expression instead of bailing.
  const mixChains: string[] = [];
  let current: string[] | null = null;
  let inMuted = false;
  let inBlockComment = false;
  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (/^\s*\/\*/.test(trimmed) && !trimmed.includes("*/")) {
      inBlockComment = true;
      continue;
    }
    const isLayerStart = /^\s*\$\s*:/.test(line);
    const isMutedStart = /^\s*_\$\s*:/.test(line);
    if (isLayerStart || isMutedStart) {
      if (current) layers.push(current.join("\n"));
      // A muted layer HOLDS ITS SLOT as silence — layer numbering (and with it
      // every unfold move) survives any mute/unmute round trip.
      if (isMutedStart) layers.push("silence");
      current = isLayerStart ? [line.replace(/^\s*\$\s*:/, "")] : null;
      inMuted = isMutedStart;
      continue;
    }
    // setcpm TERMINATES a layer — it trails the last layer in stored code
    // (mixer semantics run layers to EOF) and must never ride into the
    // expression (that's a syntax error inside the parens).
    if (/^setcpm\(/.test(trimmed)) {
      if (current) layers.push(current.join("\n"));
      current = null;
      inMuted = false;
      continue;
    }
    if (current) {
      current.push(line);
      continue;
    }
    if (inMuted) continue; // a muted layer's continuation lines drop with it
    // Outside any layer: inert lines are allowed, and mix-bus `all()` transforms
    // are folded onto the final expression (below) rather than rejected.
    if (
      trimmed === "" ||
      trimmed.startsWith("//") ||
      /^\/\*.*\*\/$/.test(trimmed) ||
      /^setcpm\(/.test(trimmed)
    )
      continue;
    // `all(x => x.lpf(400))` → fold `.lpf(400)` onto the stack. The param name is
    // whatever the lambda used; the body must be a single `<param>.<chain>` with
    // balanced parens (exactly what applyMixSound emits). Anything else we don't
    // recognise still bails to the stepper — never mis-embed unknown code.
    const mix = trimmed.match(/^all\(\s*(\w+)\s*=>\s*\1\s*\.(.+)\)\s*$/);
    if (mix) {
      mixChains.push(`.${mix[2].trim()}`);
      continue;
    }
    return null; // a real statement (let/const/…) — not embeddable, use the stepper
  }
  if (current) layers.push(current.join("\n"));
  const exprs = layers.map((l) => l.trim()).filter(Boolean);
  if (exprs.length === 0) return null;
  return { layers: exprs, mixTail: mixChains.join("") };
}

/** Some (or all) of a section's layers as one expression, mix tail folded on.
 *  Close every paren on its OWN line — a layer ending in a `// line comment`
 *  must not swallow the `)` (that was a real syntax error in production code). */
function stackOf(exprs: string[], mixTail: string): string {
  if (exprs.length === 0) return `silence${mixTail}`;
  if (exprs.length === 1) return `(${exprs[0]}\n)${mixTail}`;
  return `stack(\n(${exprs.join("\n),\n(")}\n)\n)${mixTail}`;
}

/** A loop program as ONE expression (the classic whole-loop form). */
export function sectionExpression(code: string): string | null {
  const p = sectionParts(code);
  return p ? stackOf(p.layers, p.mixTail) : null;
}

// ── render a section's arrangement spec into arrange() entries ───────────────

/** A control name we can safely emit as `.name(…)` — anything else is dropped
 *  (the spec is model-written JSON; never let a weird string become code). */
const PARAM_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** Overlay/ending code must read as a playable expression (same source shapes
 *  compose-strudel accepts) and must not smuggle a tempo change. */
const ONE_SHOT_RE = /\b(?:note|n|s|sound|chord|stack|seq|cat|run|silence)\s*\(/;
const oneShotOk = (code: string) => ONE_SHOT_RE.test(code) && !/setcpm\s*\(/.test(code);

/** Strip a leading `$:` — overlay lines arrive in the layer form the model
 *  writes everywhere else, but here they embed as bare expressions. */
const bareExpr = (code: string) => code.trim().replace(/^\$\s*:\s*/, "").trim();

/**
 * One section span → its arrange() entries. No spec (or an empty one) → the
 * classic single entry [C, wholeLoop]. With a spec, the span is cut at every
 * move / sweep edge / overlay edge and each segment gets exactly the voices
 * and wraps the spec asks for.
 *
 * Timing model: each arrange() entry runs its pattern from LOCAL cycle 0 at
 * the entry's start (stepcat + fast + slow — verified against @strudel/core).
 * So a sweep or overlay that CONTINUES across a cut re-enters later segments
 * with `.early(elapsed)` to resume its phase instead of restarting. Loop
 * layers are 1-bar cycles by contract, so re-entering them needs nothing.
 */
export function sectionEntries(
  parts: { layers: string[]; mixTail: string },
  C: number,
  spec?: SectionArrange | null,
): { cycles: number; expr: string }[] {
  const n = parts.layers.length;
  const whole = () => [{ cycles: C, expr: stackOf(parts.layers, parts.mixTail) }];
  if (!spec) return whole();
  // moves — validated hard, and skipped WHOLESALE when authored against a
  // different layer count (a mute/edit shifted the indices; wrong layers
  // dropping out is far worse than the section just playing full).
  const moves =
    spec.layerCount != null && spec.layerCount !== n
      ? []
      : (spec.moves ?? [])
          .filter((m) => Number.isFinite(m?.bar) && Array.isArray(m?.layers))
          .map((m) => ({
            bar: Math.max(0, Math.floor(m.bar)),
            layers: [...new Set(m.layers.filter((i) => Number.isInteger(i) && i >= 1 && i <= n))],
          }))
          .filter((m) => m.bar < C)
          .sort((a, b) => a.bar - b.bar);
  // a redundant all-layers move at bar 0 is the spec's way of saying "start full"
  const sweeps = (spec.sweeps ?? [])
    .filter(
      (w) =>
        w && PARAM_RE.test(w.param ?? "") && Number.isFinite(w.from) && Number.isFinite(w.to) &&
        Number.isFinite(w.bar) && Number.isFinite(w.bars),
    )
    .map((w) => ({
      param: w.param,
      from: w.from,
      to: w.to,
      curve: w.curve,
      bar: Math.max(0, Math.floor(w.bar)),
      end: 0,
      bars: Math.max(1, Math.floor(w.bars)),
    }))
    .map((w) => ({ ...w, end: Math.min(C, w.bar + w.bars) }))
    .filter((w) => w.bar < C);
  const overlays = (spec.overlays ?? [])
    .filter((o) => o && typeof o.code === "string" && Number.isFinite(o.bar) && Number.isFinite(o.bars))
    .map((o) => ({
      code: bareExpr(o.code),
      bar: Math.max(0, Math.floor(o.bar)),
      end: 0,
      bars: Math.max(1, Math.floor(o.bars)),
    }))
    .map((o) => ({ ...o, end: Math.min(C, o.bar + o.bars) }))
    .filter((o) => o.bar < C && oneShotOk(o.code));
  if (!moves.length && !sweeps.length && !overlays.length) return whole();
  const cuts = new Set<number>([0, C]);
  for (const m of moves) cuts.add(m.bar);
  for (const w of sweeps) { cuts.add(w.bar); cuts.add(w.end); }
  for (const o of overlays) { cuts.add(o.bar); cuts.add(o.end); }
  const marks = [...cuts].sort((a, b) => a - b);
  const out: { cycles: number; expr: string }[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i];
    const b = marks[i + 1];
    let active = parts.layers;
    for (const m of moves) if (m.bar <= a) active = m.layers.map((idx) => parts.layers[idx - 1]);
    const voices = active.map((l) => `(${l}\n)`);
    for (const o of overlays)
      if (o.bar <= a && o.end > a)
        voices.push(`(${o.code}\n)${a > o.bar ? `.early(${a - o.bar})` : ""}`);
    let expr =
      voices.length === 0 ? "silence" : voices.length === 1 ? voices[0] : `stack(\n${voices.join(",\n")}\n)`;
    for (const w of sweeps)
      if (w.bar <= a && w.end > a) {
        const sig = w.curve === "sine" ? "sine" : "saw";
        const phase = a > w.bar ? `.early(${a - w.bar})` : "";
        expr = `(${expr}).${w.param}(${sig}.range(${w.from},${w.to}).slow(${w.bars})${phase})`;
      }
    out.push({ cycles: b - a, expr: `${expr}${parts.mixTail}` });
  }
  return out;
}

/**
 * Compose decorated sections into one program. Returns null when the sections
 * can't ride a single pattern (mixed tempos, no playable layers, unsupported
 * statements) — the caller keeps the stepper for those.
 *
 * A section with an arrangement spec renders as SEVERAL arrange() entries
 * (its cut segments) but keeps exactly ONE span — every consumer of spans
 * (hold latch, section UI, rebuild fingerprints) keys them by section id and
 * assumes id-uniqueness.
 */
export function buildArrangement(
  sections: ArrangeSection[],
  opts: {
    attachVisual?: boolean;
    ending?: SongEnding | null;
    /** SONG-LEVEL effects (chapters era) — glides anchored to part ranges,
     *  wrapped onto every entry they cover with resumed phase, so one move
     *  rides seamlessly across loops, repeats and seams. */
    effects?: SongFx[] | null;
    /** BREAK OVERLAYS — deterministic drum lines riding loop ranges, stacked
     *  over every entry they cover (plan.overlays; lib/breaks-catalog). */
    overlays?: BreakOverlay[] | null;
    /** Rotate the whole program later by N cycles (`.late(n)`) — the SEEK
     *  primitive: re-evaluating with a new shift moves the CONTENT under the
     *  scheduler's untouched clock, so a jump to any bar is gapless.
     *  (scheduler.setCycle() is off the table — see schedulerCycleNow.) */
    lateCycles?: number;
  } = {},
): Arrangement | null {
  let usable = sections.filter((s) => s.code && s.code.trim());
  if (usable.length === 0) return null;
  // ONE signature → ONE bus for the WHOLE song (2026-07-14): per-loop orbit
  // numbering means orbit N carries different reverb setups in different
  // loops, and superdough regenerates the bus mid-ring at every seam — the
  // "clicks in many loops". Re-bus globally here, the one chokepoint every
  // song playback, rebuild and render flows through. Idempotent.
  const rebused = rebusArrangement(usable.map((s) => s.code));
  usable = usable.map((s, i) => (rebused[i] === s.code ? s : { ...s, code: rebused[i] }));
  const cpmArg = parseSetcpm(usable[0].code);
  if (!cpmArg) return null;
  const cps = cpmToCps(cpmArg);
  if (!(cps > 0)) return null;
  const entries: { cycles: number; expr: string; at: number }[] = [];
  const spans: ArrangeSpan[] = [];
  let hydra: string | null = null;
  let at = 0;
  for (const s of usable) {
    const arg = parseSetcpm(s.code);
    if (arg !== cpmArg) return null; // one pattern = one tempo
    const parts = sectionParts(s.code);
    if (!parts) return null;
    if (!hydra) hydra = extractHydra(s.code);
    // seconds are whole musical bars by construction; round guards float dust.
    // `bars` stays the section's NORMAL length — the phrase unit for holds —
    // even when cycles/arr.bars stretch the span. Precedence for the span
    // length: an explicit cycles override (a live hold) > the arrangement's
    // bars > the natural length.
    const bars = Math.max(1, Math.round(s.seconds * cps));
    const arrBars =
      s.arr && Number.isFinite(s.arr.bars) ? Math.max(1, Math.min(256, Math.floor(s.arr.bars!))) : null;
    const cycles = Math.max(1, Math.round(s.cycles ?? arrBars ?? bars));
    let segAt = at;
    for (const seg of sectionEntries(parts, cycles, s.arr)) {
      entries.push({ ...seg, at: segAt });
      segAt += seg.cycles;
    }
    spans.push({ id: s.id, start: at, end: at + cycles, bars });
    at += cycles;
  }
  // SONG-LEVEL EFFECTS — each glide covers [fromId's start, toId's end) on the
  // timeline just built. Every entry inside the window is wrapped with the SAME
  // signal, re-entered at its elapsed phase (`.early`) — the seams disappear
  // and a repeated chapter stretches the move instead of restarting it. An
  // effect naming a part that isn't in this unit is skipped whole.
  for (const fx of opts.effects ?? []) {
    if (
      !fx || !PARAM_RE.test(fx.param ?? "") ||
      !Number.isFinite(fx.from) || !Number.isFinite(fx.to)
    )
      continue;
    const a = spans.find((s) => s.id === fx.fromId);
    const b = spans.find((s) => s.id === fx.toId);
    if (!a || !b || b.end <= a.start) continue;
    const start = a.start;
    const total = b.end - a.start;
    const sig = fx.curve === "sine" ? "sine" : "saw";
    for (const e of entries) {
      if (e.at >= b.end || e.at + e.cycles <= start) continue;
      const phase = e.at > start ? `.early(${e.at - start})` : "";
      e.expr = `(${e.expr}).${fx.param}(${sig}.range(${fx.from},${fx.to}).slow(${total})${phase})`;
    }
  }
  // BREAK OVERLAYS — deterministic drum FILLS at the turns. Each one anchors
  // to the loop whose ENDING it rides (fromId) and sounds only in that loop's
  // closing `bars` bars: silence until the window opens (.late + a <0…1> mask
  // stepping one slot per cycle across the whole span), then the fill breaks
  // the music into the next loop. Cycle = bar, so any meter lands.
  for (const o of opts.overlays ?? []) {
    if (!o) continue;
    const line = breakExpr(o);
    const move = breakMoveOf(o.tpl);
    if (!line || !move) continue;
    const a = spans.find((sp) => sp.id === o.fromId);
    if (!a || a.end <= a.start) continue;
    const spanLen = a.end - a.start;
    const fill = Math.max(1, Math.min(move.bars, spanLen));
    const off = spanLen - fill;
    const winStart = a.start + off;
    const composite =
      off > 0
        ? `(${line}).late(${off}).mask("<${("0 ".repeat(off) + "1 ".repeat(fill)).trim()}>")`
        : `(${line})`;
    for (const e of entries) {
      if (e.at >= a.end || e.at + e.cycles <= winStart) continue;
      const phase = e.at > a.start ? `.early(${e.at - a.start})` : "";
      e.expr = `stack((${e.expr}), (${composite}${phase}))`;
    }
  }
  // the ending: a one-shot tail after the last section (the ring-out). The
  // `ends` flag itself is what tells playback to STOP at totalCycles instead
  // of wrapping — with or without tail code.
  const ends = opts.ending?.mode === "stop";
  if (ends && opts.ending?.code) {
    const code = bareExpr(opts.ending.code);
    if (oneShotOk(code)) {
      const endBars = Math.max(1, Math.min(16, Math.floor(opts.ending.bars ?? 2)));
      entries.push({ cycles: endBars, expr: `(${code}\n)`, at });
      spans.push({ id: "__end", start: at, end: at + endBars, bars: endBars });
      at += endBars;
    }
  }
  const body = entries.map((e) => `[${e.cycles}, ${e.expr}]`).join(",\n");
  // The seek shift rides the WHOLE pattern (normalized into [0, total) —
  // arrange() is cyclic, so late(k) === late(k mod total)).
  const late =
    Number.isFinite(opts.lateCycles) && at > 0
      ? ((Math.round(opts.lateCycles!) % at) + at) % at
      : 0;
  let program = `setcpm(${cpmArg})\narrange(\n${body}\n)${late ? `.late(${late})` : ""}`;
  if (hydra && opts.attachVisual !== false) program = attachHydraBlock(program, hydra);
  return { program, spans, totalCycles: at, cps, ends };
}

// ── presence ⟷ moves (the unfold editor's math) ─────────────────────────────
// The per-layer paint surface edits a boolean matrix (layer × bar); moves are
// its compressed form. Round-trips exactly through the SAME semantics the
// renderer plays (active = all layers until the first move).

/** Re-point a section's moves after its layers changed shape (a delete, an
 *  edit that added/removed/rewrote lines). `mapping[newIndex] = old 0-based
 *  index` (null = a brand-new layer with no old counterpart — it plays
 *  THROUGH, i.e. joins every move's audible set, so fresh material is never
 *  silently muted by an old timeline). Dropped old layers vanish from every
 *  move. Same numbering contract as the renderer (1-based). */
export function remapMoves(
  moves: SectionMove[] | undefined,
  mapping: (number | null)[],
): SectionMove[] {
  const oldToNew = new Map<number, number>();
  const fresh: number[] = [];
  mapping.forEach((old, ni) => {
    if (old == null) fresh.push(ni + 1);
    else oldToNew.set(old + 1, ni + 1);
  });
  return (moves ?? [])
    .filter((m) => m && Number.isFinite(m.bar) && Array.isArray(m.layers))
    .map((m) => ({
      bar: m.bar,
      layers: [
        ...m.layers
          .map((l) => oldToNew.get(l))
          .filter((x): x is number => x != null),
        ...fresh,
      ].sort((a, b) => a - b),
    }));
}

/** moves → per-layer presence: presence[layer][bar], layers 0-based here. */
export function presenceFromMoves(
  moves: SectionMove[] | undefined,
  layerCount: number,
  bars: number,
): boolean[][] {
  const n = Math.max(0, layerCount);
  const B = Math.max(1, bars);
  const valid = (moves ?? [])
    .filter((m) => m && Number.isFinite(m.bar) && Array.isArray(m.layers))
    .map((m) => ({
      bar: Math.max(0, Math.floor(m.bar)),
      set: new Set(m.layers.filter((i) => Number.isInteger(i) && i >= 1 && i <= n)),
    }))
    .filter((m) => m.bar < B)
    .sort((a, b) => a.bar - b.bar);
  const out: boolean[][] = Array.from({ length: n }, () => Array(B).fill(true));
  if (!valid.length) return out;
  let idx = 0;
  let cur: Set<number> | null = null; // null = all layers (before the first move)
  for (let b = 0; b < B; b++) {
    while (idx < valid.length && valid[idx].bar <= b) cur = valid[idx++].set;
    if (cur) for (let l = 0; l < n; l++) out[l][b] = cur.has(l + 1);
  }
  return out;
}

/** presence → minimal moves: one move per bar where the audible set changes;
 *  [] when every layer plays throughout (the spec's "no moves" form). */
export function movesFromPresence(presence: boolean[][]): SectionMove[] {
  const n = presence.length;
  const B = n ? presence[0].length : 0;
  const moves: SectionMove[] = [];
  let prev: string | null = null;
  const allOn = Array.from({ length: n }, (_, l) => l + 1).join(",");
  for (let b = 0; b < B; b++) {
    const set: number[] = [];
    for (let l = 0; l < n; l++) if (presence[l][b]) set.push(l + 1);
    const key = set.join(",");
    if (prev === null) {
      // bar 0: only worth a move if it differs from "everything plays"
      if (key !== allOn) moves.push({ bar: 0, layers: set });
      prev = key;
      continue;
    }
    if (key !== prev) moves.push({ bar: b, layers: set });
    prev = key;
  }
  return moves;
}

/** The span containing an arrangement cycle (wrapping — the song loops). */
export function spanAtCycle(spans: ArrangeSpan[], totalCycles: number, cycle: number): ArrangeSpan | null {
  if (!spans.length || totalCycles <= 0 || !Number.isFinite(cycle)) return null;
  const pos = ((cycle % totalCycles) + totalCycles) % totalCycles;
  return spans.find((s) => pos >= s.start && pos < s.end) ?? null;
}

/** One playable unit: a maximal run of sections that share one pattern
 *  (same tempo, embeddable code), or a single section the stepper must play.
 *  A SET partitions into one unit per song — hard boundaries land exactly on
 *  the tempo changes, i.e. the hand-off breaks that were written to mask them. */
export interface ArrangeUnit {
  sections: ArrangeSection[];
  /** null → not embeddable; play sections[0] with the stepper. */
  arrangement: Arrangement | null;
}

/** The unit starting at `startIdx` (callers walk the list unit by unit).
 *  `opts.ending` only applies when this unit runs through the END of the
 *  list — an ending mid-song (before a tempo change) would stop the set. */
export function nextUnit(
  sections: ArrangeSection[],
  startIdx: number,
  opts: {
    attachVisual?: boolean;
    ending?: SongEnding | null;
    effects?: SongFx[] | null;
    overlays?: BreakOverlay[] | null;
  } = {},
): ArrangeUnit {
  const head = sections[startIdx];
  if (!head) return { sections: [], arrangement: null };
  const embeddable = (s: ArrangeSection) =>
    parseSetcpm(s.code) !== null && sectionExpression(s.code) !== null;
  if (!embeddable(head)) return { sections: [head], arrangement: null };
  const cpm = parseSetcpm(head.code);
  const run: ArrangeSection[] = [head];
  for (let i = startIdx + 1; i < sections.length; i++) {
    const s = sections[i];
    if (!embeddable(s) || parseSetcpm(s.code) !== cpm) break;
    run.push(s);
  }
  const isTail = startIdx + run.length >= sections.length;
  const arrangement = buildArrangement(run, { ...opts, ending: isTail ? opts.ending : null });
  return arrangement
    ? { sections: run, arrangement }
    : { sections: [head], arrangement: null };
}
