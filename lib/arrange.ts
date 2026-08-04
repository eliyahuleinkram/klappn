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
import { endingExpr } from "./endings-catalog";
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
  /** THE SPAN THE SHAPE WAS WRITTEN FOR (2026-08-04). A repeat dial restates
   *  `bars` in its own terms (held × the loop's length) — set this to the
   *  ARRANGEMENT's own span at the same time and the renderer replays the
   *  authored moves and sweeps in PROPORTION over the new one. Absent (or
   *  equal to `bars`) = play them exactly where they were written. Never set
   *  for a hold LATCH, whose stretch is temporary and phase-preserving. */
  authoredBars?: number;
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
  /** THE ENDING TEMPLATE (2026-08-02) — lib/endings-catalog. When set, the tail
   *  is BUILT from it and its knobs, so it is guaranteed to arrive at silence;
   *  freehand `code` (every song written before this) still renders as it did.
   *  The model picks one at birth; the same knobs are the user's afterwards. */
  tpl?: string;
  gain?: number;
  tone?: number;
  space?: number;
  /** The key the tail was voiced for — an ending out of key is an accident. */
  key?: string;
  /** How many bars BEFORE the song's last bar the tail comes in (2026-08-02).
   *  0 = it waits until the song is over, which is what every ending did
   *  before this; up to the final section's whole length, which is the song
   *  resolving into its ending rather than after it. Whatever doesn't fit
   *  inside the last section extends past the end on its own. */
  start?: number;
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
  /** Each section's code AS THE PROGRAM PLAYS IT — i.e. after the global orbit
   *  re-bus. The section a caller handed in is NOT what sounds: rebusArrangement
   *  renumbers `.orbit(n)` song-wide by effect signature, so anything that needs
   *  the REAL bus numbers (the solo/mute orbit gates) must read these, never the
   *  standalone per-section transform. */
  codes: { id: string; code: string }[];
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

/** One move per bar, the LATER state winning. Shrinking a span can round two
 *  authored moves onto the same bar; the arc runs one way, so the further-on
 *  layer set is the one that belongs there. Input must be sorted by bar. */
function dedupeByBar<T extends { bar: number }>(list: T[]): T[] {
  const out: T[] = [];
  for (const m of list) {
    if (out.length && out[out.length - 1].bar === m.bar) out[out.length - 1] = m;
    else out.push(m);
  }
  return out;
}

/** Overlay/ending code must read as a playable expression (same source shapes
 *  compose-strudel accepts) and must not smuggle a tempo change. */
const ONE_SHOT_RE = /\b(?:note|n|s|sound|chord|stack|seq|cat|run|silence)\s*\(/;
const oneShotOk = (code: string) => ONE_SHOT_RE.test(code) && !/setcpm\s*\(/.test(code);

/** Strip a leading `$:` — overlay lines arrive in the layer form the model
 *  writes everywhere else, but here they embed as bare expressions. */
const bareExpr = (code: string) => code.trim().replace(/^\$\s*:\s*/, "").trim();

/** Does this layer's code set the param ITSELF (alias-aware)? An outer sweep
 *  on the same param would OVERRIDE the layer's own value — a composed tone,
 *  an accent pattern — so the renderer skips those voices (see sectionEntries).
 *  Name-boundary matters: `.room(` must not match `.roomsize(`, `.delay(`
 *  must not match `.delaytime(` — the `\(` anchor guarantees it. */
const PARAM_ALIASES: Record<string, string[]> = {
  lpf: ["lpf", "cutoff"],
  resonance: ["resonance", "lpq"],
  gain: ["gain"],
  room: ["room"],
  delay: ["delay"],
  shape: ["shape"],
};
export function authorsParam(layer: string, param: string): boolean {
  for (const name of PARAM_ALIASES[param] ?? [param])
    if (new RegExp(`\\.${name}\\s*\\(`).test(layer)) return true;
  return false;
}

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
  // THE SHAPE SCALES WITH THE SPAN (2026-08-04, the user, on turning a repeat
  // dial: "how does it re-decide which layers come in when"). It doesn't —
  // and it must not have to. The moves and sweeps carry ABSOLUTE bar numbers
  // written for one span, so a dial that restated the span used to truncate
  // them (×½ dropped the peak and the thin-out outright: `m.bar < C`) or
  // strand them (×2 played the whole arc in the first half and then froze on
  // the last layer set for the rest). Neither was anybody's decision.
  //
  // So the authored positions are replayed in PROPORTION: a rise written over
  // sixteen bars becomes the same rise over thirty-two, and over eight it
  // compresses instead of losing its end. Zero AI — the arrangement's musical
  // judgment (what enters, in what order, at what point of the arc) is kept
  // exactly; only the ruler changes. `authoredBars` is set by the surfaces
  // that restate a span (arrOf and its mirrors) — never by a hold LATCH,
  // whose stretch is temporary and phase-preserving.
  const authoredBars =
    Number.isFinite(spec.authoredBars) && (spec.authoredBars as number) > 0
      ? Math.floor(spec.authoredBars as number)
      : null;
  const spanBars =
    Number.isFinite(spec.bars) && (spec.bars as number) > 0 ? Math.floor(spec.bars as number) : C;
  const scale = authoredBars && authoredBars !== spanBars ? spanBars / authoredBars : 1;
  /** An authored bar, placed on the span actually playing. */
  const at = (bar: number) => Math.max(0, Math.round(bar * scale));
  /** A length in bars, kept at least one bar however far it shrinks. */
  const span = (bars: number) => Math.max(1, Math.round(bars * scale));
  // moves — validated hard, and skipped WHOLESALE when authored against a
  // different layer count (a mute/edit shifted the indices; wrong layers
  // dropping out is far worse than the section just playing full).
  const moves =
    spec.layerCount != null && spec.layerCount !== n
      ? []
      : dedupeByBar(
          (spec.moves ?? [])
            .filter((m) => Number.isFinite(m?.bar) && Array.isArray(m?.layers))
            .map((m) => ({
              bar: at(Math.max(0, Math.floor(m.bar))),
              layers: [...new Set(m.layers.filter((i) => Number.isInteger(i) && i >= 1 && i <= n))],
            }))
            .filter((m) => m.bar < C)
            .sort((a, b) => a.bar - b.bar),
        );
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
      bar: at(Math.max(0, Math.floor(w.bar))),
      end: 0,
      bars: span(Math.max(1, Math.floor(w.bars))),
    }))
    .map((w) => ({ ...w, end: Math.min(C, w.bar + w.bars) }))
    .filter((w) => w.bar < C);
  const overlays = (spec.overlays ?? [])
    .filter((o) => o && typeof o.code === "string" && Number.isFinite(o.bar) && Number.isFinite(o.bars))
    .map((o) => ({
      code: bareExpr(o.code),
      bar: at(Math.max(0, Math.floor(o.bar))),
      end: 0,
      bars: span(Math.max(1, Math.floor(o.bars))),
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
    // THE MUSIC RESUMES ITS PHRASE ACROSS A CUT (2026-08-04, song db62451f:
    // "the stampede sounds extremely intense… the reverb is way too strong").
    // Each arrange() entry runs its pattern from LOCAL cycle 0, and sweeps/
    // overlays have always re-entered with .early(elapsed) — but the LAYERS
    // did not, on the old assumption that a loop layer is a 1-bar cycle.
    // Composed layers are legally multi-bar phrases (`<A B C D>` slowcats),
    // so every move/sweep edge snapped all of them back to their FIRST cell:
    // a section cut at bars 2/4/8/12/14 re-struck its densest bar and its
    // bell/chord hits five times into 7-9s reverbs — heard as hammering and
    // reverb pile-up, absent when the bare loop plays uncut. .early(a) resumes
    // each phrase where the section actually is; on a true 1-bar layer a
    // whole-bar shift is the identity, so nothing else changes.
    // A SWEEP MAY ONLY TOUCH A PARAM THE LAYER LEFT FREE (2026-08-04, song
    // db62451f: "the reverb just gets outta control with that saw"). An outer
    // control OVERRIDES every hap's own value — so a section lpf sweep
    // (600→6000) tore a bass composed dark at lpf 200 wide open, its
    // shape(.42).distort(1.1) — voiced FOR a closed filter — became a buzz
    // wall, and a gain sweep flattened every authored accent pattern
    // ("0.78 0.56 …" → one scalar). "Sweeps ride the whole section's existing
    // sound" was the intent; replace-the-sound was the render. So the sweep
    // now wraps each voice INDIVIDUALLY and skips any voice that authors the
    // param itself — a layer's own tone always wins; the sweep shapes the
    // dimensions the composition left open.
    const swept = (l: string, base: string): string => {
      let v = base;
      for (const w of sweeps)
        if (w.bar <= a && w.end > a && !authorsParam(l, w.param)) {
          const sig = w.curve === "sine" ? "sine" : "saw";
          const phase = a > w.bar ? `.early(${a - w.bar})` : "";
          v = `(${v}).${w.param}(${sig}.range(${w.from},${w.to}).slow(${w.bars})${phase})`;
        }
      return v;
    };
    const voices = active.map((l) =>
      swept(l, `(${l}\n)${a > 0 ? `.early(${a})` : ""}`),
    );
    for (const o of overlays)
      if (o.bar <= a && o.end > a)
        voices.push(
          swept(o.code, `(${o.code}\n)${a > o.bar ? `.early(${a - o.bar})` : ""}`),
        );
    const expr =
      voices.length === 0 ? "silence" : voices.length === 1 ? voices[0] : `stack(\n${voices.join(",\n")}\n)`;
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
    /** The caller has ALREADY bussed every layer deliberately (the door's
     *  per-layer kill gates assign one orbit per (layer, signature) across
     *  the whole song — same crackle law, different grouping). Skip the
     *  global signature re-bus, which would merge layers back onto shared
     *  buses and make per-layer gating impossible. */
    keepOrbits?: boolean;
  } = {},
): Arrangement | null {
  let usable = sections.filter((s) => s.code && s.code.trim());
  if (usable.length === 0) return null;
  // ONE signature → ONE bus for the WHOLE song (2026-07-14): per-loop orbit
  // numbering means orbit N carries different reverb setups in different
  // loops, and superdough regenerates the bus mid-ring at every seam — the
  // "clicks in many loops". Re-bus globally here, the one chokepoint every
  // song playback, rebuild and render flows through. Idempotent.
  const rebused = opts.keepOrbits
    ? usable.map((s) => s.code)
    : rebusArrangement(usable.map((s) => s.code));
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
    const move = breakMoveOf(o.tpl);
    if (!move) continue;
    const a = spans.find((sp) => sp.id === o.fromId);
    if (!a || a.end <= a.start) continue;
    const spanLen = a.end - a.start;
    // THE TURN IS A PROPORTION OF THE SECTION (2026-08-02). A one-bar roll at
    // the end of a section that ran thirty-two bars is a rumour, not a turn —
    // so the fill's length is authored per break (o.bars) and only falls back
    // to the template's own. Never longer than the section itself, and never
    // the WHOLE of a multi-bar section: a break has to break something.
    const want = Number.isFinite(o.bars as number) ? Math.floor(o.bars as number) : move.bars;
    const room = spanLen > 1 ? spanLen - 1 : spanLen;
    const fill = Math.max(1, Math.min(want, room));
    // The line is authored AFTER the length is known, and for exactly that
    // length: a fill is one gesture stretched over its bars, never a bar
    // played `fill` times (which restarted every rise from the bottom).
    const line = breakExpr({ ...o, bars: fill });
    if (!line) continue;
    // A break ENDS AT THE TURN — always. Only its length varies, so the window
    // is simply the section's last `fill` bars: silence until it opens (the
    // mask steps one slot per cycle across the whole span), then the fill
    // breaks the music into the next section.
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
  if (ends) {
    // A SONG THAT ENDS ALWAYS RINGS OUT (2026-08-02, the user: "sometimes the
    // ends here rings out does not work"). The control says "Ends here — rings
    // out", but the tail was only ever appended when an AI-authored line
    // existed — and flipping the switch by hand writes `{mode:"stop"}` with no
    // code at all, so half the songs on prod simply CUT at the last bar, taking
    // every reverb and delay tail with them.
    //
    // So the tail is unconditional now: the authored one-shot when there is a
    // usable one, otherwise SILENCE. Silence is not nothing — it keeps the
    // transport running for those bars, which is exactly what lets the last
    // chord decay instead of being guillotined. Deterministic, no AI, and it
    // makes the words on the button true for every song.
    // A TEMPLATE WINS OVER FREEHAND (2026-08-02). The catalog's tails are shaped
    // to reach zero; a hand-written line is whatever it was — and what the
    // arrangement model wrote freehand was a chord with `sustain(0.7)`, which
    // held at one level for the whole tail and then simply stopped. That is the
    // "it doesn't ring out" the user heard.
    const built = opts.ending?.tpl
      ? endingExpr({
          tpl: opts.ending.tpl,
          key: opts.ending.key,
          bars: opts.ending.bars,
          gain: opts.ending.gain,
          tone: opts.ending.tone,
          space: opts.ending.space,
        })
      : null;
    const authored = built ?? (opts.ending?.code ? bareExpr(opts.ending.code) : "");
    const usable = authored && oneShotOk(authored);
    const endBars = Math.max(1, Math.min(16, Math.floor(opts.ending?.bars ?? 2)));
    // WHERE THE TAIL BEGINS (2026-08-02, the user: "the ring-out can start
    // anywhere in the final loop from the beginning to the end (inclusive),
    // and then it can extend on its own").
    //
    // `start` counts bars from the END of the last section, so 0 means the
    // tail waits until the song is over (what every ending did before this)
    // and a larger number reaches back INTO the final loop — the song resolving
    // into its ending rather than after it. The overlapping part rides the last
    // section the way a break does (.late + a mask, so it sounds only from its
    // bar onward), and whatever is left over is appended, re-entered with
    // .early so the gesture CONTINUES its phase instead of striking twice.
    const lastSpan = spans[spans.length - 1];
    const lastLen = lastSpan ? lastSpan.end - lastSpan.start : 0;
    const reach = Math.max(0, Math.min(Math.floor(opts.ending?.start ?? 0), lastLen));
    const overlap = Math.min(reach, endBars);
    const overhang = Math.max(0, endBars - overlap);
    if (usable && overlap > 0 && lastSpan) {
      const off = lastLen - overlap; // bars into the last section before it enters
      const mask = `${"0 ".repeat(off)}${"1 ".repeat(overlap)}`.trim();
      const rider = off > 0 ? `(${authored}).late(${off}).mask("<${mask}>")` : `(${authored})`;
      for (const e of entries) {
        if (e.at >= lastSpan.end || e.at + e.cycles <= lastSpan.start + off) continue;
        const phase = e.at > lastSpan.start ? `.early(${e.at - lastSpan.start})` : "";
        e.expr = `stack((${e.expr}), (${rider}${phase}))`;
      }
    }
    if (overhang > 0 || overlap === 0) {
      const bars = overhang > 0 ? overhang : endBars;
      // Resume the gesture where the overlap left it, so a decay that began
      // inside the last loop keeps falling instead of restarting.
      const tail = usable
        ? overlap > 0
          ? `((${authored}).early(${overlap}))`
          : `(${authored}\n)`
        : `silence`;
      entries.push({ cycles: bars, expr: tail, at });
      spans.push({ id: "__end", start: at, end: at + bars, bars });
      at += bars;
    }
  }
  // THE GUARD (2026-08-02, the user: "when it is meant to end, it still loops
  // back to the beginning of where we hit play from"). arrange() is cyclic and
  // the terminal stop is a TIMER — if that timer is ever lost or lands late,
  // the pattern wraps and the first thing you hear is the section you pressed
  // play on, at full volume. So an ending program carries 32 bars of SILENCE
  // after its tail, OUTSIDE totalCycles: every timer, progress tick and export
  // still ends at the audible end, but a wrap now lands in silence — a missed
  // stop costs quiet, never a relapse into the song.
  if (ends) entries.push({ cycles: 32, expr: "silence", at });
  const body = entries.map((e) => `[${e.cycles}, ${e.expr}]`).join(",\n");
  // The seek shift rides the WHOLE pattern (normalized into [0, total) —
  // arrange() is cyclic, so late(k) === late(k mod total)).
  const late =
    Number.isFinite(opts.lateCycles) && at > 0
      ? ((Math.round(opts.lateCycles!) % at) + at) % at
      : 0;
  let program = `setcpm(${cpmArg})\narrange(\n${body}\n)${late ? `.late(${late})` : ""}`;
  if (hydra && opts.attachVisual !== false) program = attachHydraBlock(program, hydra);
  return {
    program,
    spans,
    totalCycles: at,
    cps,
    ends,
    codes: usable.map((s) => ({ id: s.id, code: s.code })),
  };
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
    /** See buildArrangement — the caller already bussed every layer. */
    keepOrbits?: boolean;
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
