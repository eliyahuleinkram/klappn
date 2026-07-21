/**
 * Compute a loop's natural length AFTER the fact — from the composed Strudel, not
 * from a number the planner guessed up front. 1 cycle = 1 bar, so the loop's
 * length in bars = its cycle PERIOD: how many cycles before every layer realigns
 * and the pattern repeats.
 *
 * Per layer the period is driven by its slowcat groups (`<a b c …>` = one element
 * per cycle → N cycles) times any `.slow(n)` (and divided by `.fast(n)`). The
 * whole loop repeats at the LCM of its layers' periods. Deterministic, dependency-
 * free (pure string parsing) so it runs in the browser for the playhead.
 */

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};
const lcm = (a: number, b: number): number => (a && b ? Math.abs(a * b) / gcd(a, b) : a || b || 1);

/** Count top-level, space-separated items in a mini group body (depth-aware: a
 *  nested [..] / <..> / {..} / (..) counts as ONE item). */
function countItems(s: string): number {
  let depth = 0,
    items = 0,
    inItem = false;
  for (const ch of s) {
    const open = ch === "[" || ch === "<" || ch === "{" || ch === "(";
    const close = ch === "]" || ch === ">" || ch === "}" || ch === ")";
    if (close) depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) inItem = false;
    else if (!/\s/.test(ch)) {
      if (!inItem) {
        items++;
        inItem = true;
      }
    }
    if (open) depth++;
  }
  return Math.max(1, items);
}

/** Top-level chain `.slow(n)` / `.fast(n)` factors — NOT ones nested inside an
 *  argument (e.g. `lpf(saw.range(…).slow(8))` slows the FILTER signal, not the
 *  layer, so it must be ignored). Scans at paren/bracket depth 0, skipping strings. */
function topLevelFactors(layer: string): { slow: number[]; fast: number[] } {
  const slow: number[] = [];
  const fast: number[] = [];
  let depth = 0,
    inStr = false,
    q = "";
  for (let i = 0; i < layer.length; i++) {
    const ch = layer[i];
    if (inStr) {
      if (ch === q) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = true;
      q = ch;
    } else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (depth === 0 && ch === ".") {
      const rest = layer.slice(i);
      let m = rest.match(/^\.slow\(\s*([\d.]+)\s*\)/);
      if (m) slow.push(Number(m[1]));
      else if ((m = rest.match(/^\.fast\(\s*([\d.]+)\s*\)/))) fast.push(Number(m[1]));
    }
  }
  return { slow, fast };
}

/** The element counts of every `<…>` slowcat block in a layer (incl. nested). */
function angleCounts(layer: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < layer.length; i++) {
    if (layer[i] !== "<") continue;
    let depth = 1,
      j = i + 1;
    for (; j < layer.length && depth > 0; j++) {
      if (layer[j] === "<") depth++;
      else if (layer[j] === ">") depth--;
    }
    let count = countItems(layer.slice(i + 1, j - 1));
    // Honor a trailing mini-notation slow/speed operator on the group: `<a b c>/n` plays
    // one element every n cycles (period ×n), `<a b c>*n` speeds it (÷n). Without this,
    // `mask("<1 1 1 0>/4")` (a 16-cycle gate) read as 4 → the loop length was under-counted
    // and the mix re-evaluated mid-phrase (playhead snapped back, the dynamics never played).
    const tail = layer.slice(j).match(/^\s*([/*])\s*(\d*\.?\d+)/);
    if (tail) {
      const n = parseFloat(tail[2]);
      if (n > 0) count = tail[1] === "/" ? count * n : count / n;
    }
    out.push(Math.max(1, Math.round(count)));
  }
  return out;
}

/** A loop's length in whole bars (clamped 1–64). Strips the @controls/@hydra
 *  comment blocks and reads only the `$:` music layers. Falls back to 8. */
export function computeLoopBars(code: string | null | undefined): number {
  if (!code) return 8;
  const music = code.replace(/\/\*[\s\S]*?\*\//g, ""); // drop @controls / @hydra
  const layers = music.split(/\$:/).slice(1);
  if (!layers.length) return 8;
  let bars = 1;
  for (const layer of layers) {
    let period = angleCounts(layer).reduce(lcm, 1);
    const { slow, fast } = topLevelFactors(layer);
    for (const n of slow) period = Math.round(period * n);
    for (const n of fast) period = Math.max(1, Math.round(period / n));
    bars = lcm(bars, Math.max(1, period));
  }
  // Cap at a sane musical loop length. Raised 16→32 so a genuinely LONG, developed loop
  // (a 24/32-bar arrangement) PLAYS in full instead of being re-evaluated/truncated
  // mid-phrase ("squashed"). Beyond 32, a number almost always means mismatched layer
  // lengths (drift), not a real loop, and must not show as a wild duration.
  return Math.max(1, Math.min(32, bars));
}
