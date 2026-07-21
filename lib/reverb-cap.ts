/**
 * REVERB CONSOLIDATION — a server-side "make it easy on the client" pass.
 *
 * Convolution reverb is the single most expensive Web Audio effect, and the
 * composer stacks it on many layers (Golem Strut: reverb on 5 layers / 4 orbit
 * buses = 4 live convolvers, on top of 14 synth layers). No phone renders that
 * in real time — it's the root of the "completely fails" mobile glitching.
 *
 * A mixing engineer would never put reverb on every track; reverb is a shared
 * send you apply to a FEW elements. This transform enforces that: it keeps the
 * reverb on the `maxReverbs` layers with the STRONGEST send (where the wash is
 * actually heard) and strips the `.room*` calls from the rest — cutting the
 * convolver count hard while preserving the dominant ambience. Pure string →
 * string so it's unit-testable and safe to run over stored code.
 */

/** The reverb-param call family stripped from a de-verbed layer. */
const ROOM_CALLS = /\.(room|roomsize|roomfade|roomlp|roomdim|iresponse|ir)\(\s*[^()]*\)/g;

/** A layer's reverb SEND amount (the `.room(x)` value), or null if it has none. */
function roomSend(layer: string): number | null {
  const m = layer.match(/\.room\(\s*("?)([\d.]+)\1\s*\)/);
  return m ? Number(m[2]) : null;
}

/** Strip the whole reverb-param family from a layer (leaves everything else). */
function deverb(layer: string): string {
  return layer.replace(ROOM_CALLS, "");
}

/**
 * Cap a loop's Strudel code to at most `maxReverbs` reverb-bearing layers,
 * keeping the strongest sends. Non-reverb layers and every other line are
 * untouched. Idempotent.
 */
export function capReverbs(code: string, maxReverbs = 2): string {
  if (!code) return code;
  const lines = code.split("\n");
  // Index the reverb-bearing LAYER lines ($: or _$:) with a room send.
  const reverbLines: { idx: number; send: number }[] = [];
  lines.forEach((line, idx) => {
    if (!/^\s*_?\$\s*:/.test(line)) return;
    const send = roomSend(line);
    if (send != null) reverbLines.push({ idx, send });
  });
  if (reverbLines.length <= maxReverbs) return code; // already light enough
  // Keep the strongest `maxReverbs` sends; strip reverb from the rest.
  const keep = new Set(
    [...reverbLines]
      .sort((a, b) => b.send - a.send)
      .slice(0, maxReverbs)
      .map((r) => r.idx),
  );
  for (const { idx } of reverbLines) {
    if (!keep.has(idx)) lines[idx] = deverb(lines[idx]);
  }
  return lines.join("\n");
}

/** How many reverb-bearing layers a loop has (for measuring the reduction). */
export function reverbLayerCount(code: string): number {
  return (code || "")
    .split("\n")
    .filter((l) => /^\s*_?\$\s*:/.test(l) && roomSend(l) != null).length;
}
