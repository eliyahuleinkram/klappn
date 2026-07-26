import { STRUDEL_SPEC } from "./strudel-spec";
import { HYDRA_SPEC } from "./hydra-spec";

/**
 * THE IDE'S AI — two surfaces, both quiet servants of the coder's hands
 * (the Ask/proposal path and the tweak chips lived here once; both were cut
 * 2026-07-26 when the product settled on copilot + dials — git history keeps
 * them):
 *
 *  1. THE COPILOT — ghost completion at the caret (/api/complete). Opus 5
 *     thinking-DISABLED: dialect accuracy at no-thinking latency. The other
 *     pane rides along as read-only context.
 *  2. THE NAMER — after a clean run (/api/names), every `$:` line gets a
 *     human name ("Deep kick", "Acid bass") so the dials read like a desk,
 *     not a stack trace. Sonnet 5 no-thinking — naming is cheap.
 */

// ── THE COPILOT ──────────────────────────────────────────────────────────────

const COMPLETE_CONTRACT = `You are inline code-completion in a live-coding IDE. You get the code BEFORE the cursor and the code AFTER it. Output ONLY the raw text to insert at the cursor — no prose, no fences, never repeat text that is already there. Match the file's own style and vocabulary; finish the current line, or add the next line(s) that most belong. A comment stating an intent ("// rolling acid bassline") is an ASK — write the code that fulfils it on the following line(s). When text follows the cursor ON THE SAME LINE, complete only what fits between — finish the expression there, never start a new line. Stop at a natural point (at most ~3 lines). Only output nothing when the code is already complete as it stands.`;

export const COMPLETE_STRUDEL_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. Stay in the file's key and grid; add layers that serve the loop (never double an existing voice). A HYDRA pane may be given as read-only context — never emit hydra code here.

${STRUDEL_SPEC}`;

export const COMPLETE_HYDRA_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), hydra's own clocks frozen, all motion via H(<strudel signal>). The STRUDEL pane may be given as read-only context — read its loop length and energy so every H() period divides the loop; never emit strudel code here.

${HYDRA_SPEC}`;

/** The user block for one completion call — the other pane rides along as
 *  read-only context (a hydra ghost should know the music it lights). */
export function completeUserText(
  before: string,
  after: string,
  context: string,
  contextLabel: string,
): string {
  return `${
    context.trim()
      ? `${contextLabel} (read-only context):\n${context}\n\n`
      : ""
  }BEFORE (cursor at the end of this):
${before}
AFTER:
${after || "(end of file)"}`;
}

/** Clean a raw completion: strip fences, drop overlap with what's already
 *  typed, kill trailing junk. Empty string = nothing to show. */
export function cleanCompletion(raw: string, before: string): string {
  let s = raw.replace(/^\s*```[a-z]*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");
  s = s.replace(/\s+$/, "");
  if (!s) return "";
  // A model that re-emits the tail of `before` — trim the longest overlap.
  const tail = before.slice(-Math.min(before.length, 200));
  for (let n = Math.min(tail.length, s.length); n > 0; n--) {
    if (tail.endsWith(s.slice(0, n))) {
      s = s.slice(n);
      break;
    }
  }
  s = s.replace(/^\r?\n(?=\S)/, "\n");
  // Completing at the end of a COMMENT line: without a leading newline the
  // taken code lands INSIDE the comment and falls silent. Deterministic guard.
  const lastLine = before.slice(before.lastIndexOf("\n") + 1);
  if (s && !s.startsWith("\n") && /^\s*\/\//.test(lastLine)) s = "\n" + s;
  return s;
}

// ── THE NAMER — human names for the dials, after a clean run ─────────────────

export const NAMES_SYSTEM = `You are given a live-coded Strudel loop — one \`$:\` (or muted \`_$:\`) line per voice. Return JSON ONLY:
{"layers":[{"n":<1-based position of the line>,"name":"<what this voice IS, 1-3 words a non-musician reads at a glance: "Deep kick", "Acid bass", "Shimmer hats">"}]}
One entry per line, in order. Name what it SOUNDS like, never the code. Two similar voices get distinguishing names ("Low hats" / "Bright hats").`;

/** Tolerant parse of the namer's JSON → names by 0-based layer position. */
export function parseNames(raw: string): string[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const d = JSON.parse(m[0]) as { layers?: unknown };
    const byN = new Map<number, string>();
    for (const l of Array.isArray(d.layers) ? d.layers : []) {
      const e = l as { n?: unknown; name?: unknown };
      if (typeof e.n === "number" && typeof e.name === "string" && e.name.trim())
        byN.set(e.n, e.name.trim().slice(0, 28));
    }
    const names: string[] = [];
    for (const [n, name] of byN) if (n >= 1 && n <= 24) names[n - 1] = name;
    return names;
  } catch {
    return [];
  }
}
