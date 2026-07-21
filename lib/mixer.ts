/**
 * Manual per-instrument mixer — deterministic, NO AI. Lets a person set the
 * level of each layer ($: line) in a loop, or mute it (level 0), by rewriting
 * that layer's `.gain(...)`. `loopLayers` reads the current levels for the UI;
 * `setLayerGain` writes a new one.
 *
 * Dependency-light (no acorn / no Node) so it bundles into the browser AND runs
 * server-side. Setting a layer's gain to a constant overrides any patterned gain
 * on that layer (e.g. an accent pattern) — that's the trade-off of taking manual
 * control; an AI edit can restore dynamics later.
 */

export interface MixLayer {
  /** 1-based index among the ACTIVE `$:` layers (matches setLayerGain). */
  layer: number;
  /** Best-guess instrument/sound name for the label. */
  sound: string;
  /** Current gain if it's a plain number; null if patterned or absent. */
  gain: number | null;
  /** True if the layer's gain is a pattern (a manual change will flatten it). */
  patterned: boolean;
}

const SOUND_RE = /\bs(?:ound)?\s*\(\s*["'`]([^"'`]+)/;

/** A label for a layer: its sound, or a sensible fallback. */
function layerSound(text: string): string {
  const m = text.match(SOUND_RE);
  if (m) {
    const tok = m[1].trim().split(/\s+/)[0].replace(/[:*/!@].*$/, "");
    if (tok && tok !== "~") return tok;
  }
  if (/\bchord\s*\(/.test(text)) return "chords";
  if (/\bnote\s*\(|\bn\s*\(/.test(text)) return "melody";
  return "layer";
}

/** Parse a layer's gain: { gain:number|null, patterned:boolean }. */
function layerGain(text: string): { gain: number | null; patterned: boolean } {
  const i = text.indexOf(".gain(");
  if (i === -1) return { gain: null, patterned: false };
  const arg = text.slice(i + 6).trimStart();
  const num = arg.match(/^(-?\d*\.?\d+)\s*\)/);
  if (num) return { gain: Number(num[1]), patterned: false };
  return { gain: null, patterned: true }; // a pattern / expression
}

/** Group code into ACTIVE `$:` layers, returning each layer's [start,end) line
 *  range. Muted `_$:` and non-layer lines (setcpm, let …) are skipped. */
function activeLayerRanges(lines: string[]): { start: number; end: number }[] {
  const starts: number[] = [];
  lines.forEach((raw, i) => {
    if (/^\s*\$\s*:/.test(raw)) starts.push(i);
  });
  return starts.map((start, k) => {
    // a layer runs until the next layer-or-muted-layer start, or end of file
    let end = lines.length;
    for (let j = start + 1; j < lines.length; j++) {
      if (/^\s*_?\$\s*:/.test(lines[j])) {
        end = j;
        break;
      }
    }
    void k;
    return { start, end };
  });
}

/** Read each active layer's sound + current level for the mixer UI. */
export function loopLayers(code: string): MixLayer[] {
  const lines = (code || "").split("\n");
  return activeLayerRanges(lines).map((r, idx) => {
    const text = lines.slice(r.start, r.end).join("\n");
    const { gain, patterned } = layerGain(text);
    return { layer: idx + 1, sound: layerSound(text), gain, patterned };
  });
}

function fmtGain(v: number): string {
  const x = Math.min(2, Math.max(0, Math.round(v * 100) / 100));
  return String(x);
}

/** Find the balanced `.gain(...)` span in `text` starting at `from`, or null. */
function gainSpan(text: string): { i: number; j: number } | null {
  const i = text.indexOf(".gain(");
  if (i === -1) return null;
  let depth = 0;
  let j = i + ".gain".length;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { i, j: j + 1 };
    }
  }
  return { i, j: text.length }; // unbalanced — replace to end (defensive)
}

/**
 * Set the gain (level) of the `layer`-th active `$:` layer (1-based) to `value`.
 * Replaces an existing `.gain(...)` (numeric or patterned) or appends one if the
 * layer has none. Returns the rewritten code (unchanged if the layer isn't found).
 */
export function setLayerGain(
  code: string,
  layer: number,
  value: number,
): string {
  const lines = (code || "").split("\n");
  const ranges = activeLayerRanges(lines);
  const r = ranges[layer - 1];
  if (!r) return code;

  const text = lines.slice(r.start, r.end).join("\n");
  const span = gainSpan(text);
  let rewritten: string;
  if (span) {
    rewritten = text.slice(0, span.i) + `.gain(${fmtGain(value)})` + text.slice(span.j);
  } else {
    // No gain yet — append one to the end of the layer's chain.
    rewritten = text.replace(/\s*$/, "") + `.gain(${fmtGain(value)})`;
  }

  return [...lines.slice(0, r.start), rewritten, ...lines.slice(r.end)].join("\n");
}
