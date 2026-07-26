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
 *  (A NAMER — AI names on the mixer faders — lived here briefly; it died
 *  2026-07-26 when the mixer became the Sets deck: deterministic channel
 *  kills + master-chain dials need no names. Git history keeps it.)
 */

// ── THE COPILOT ──────────────────────────────────────────────────────────────

const COMPLETE_CONTRACT = `You are inline code-completion in a live-coding IDE. You get the code BEFORE the cursor and the code AFTER it. Output ONLY the raw text to insert at the cursor — no prose, no fences, never repeat text that is already there. Match the file's own style and vocabulary; finish the current line, or add the next line(s) that most belong — added lines BEGIN WITH A NEWLINE; never glue a comment or a new statement onto the end of an existing line. A comment stating an intent ("// rolling acid bassline") is an ASK — write the code that fulfils it on the following line(s). Never output only a comment: every completion must contain code (if the cursor is inside an unfinished comment, finish it, then write the code it asks for). When text follows the cursor ON THE SAME LINE, complete only what fits between — finish the expression there, never start a new line. Stop at a natural point (at most ~3 lines). Only output nothing when the code is already complete as it stands.`;

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
  // The mirror case — starting a NEW statement at the end of a CODE line: a
  // `//` or `$:` can never continue an expression, so glued inline it comments
  // out the tail or breaks the line (seen on prod: "// clap layered…" welded
  // onto `.orbit(6)`). Same deterministic newline.
  else if (s && !s.startsWith("\n") && lastLine.trim() && /^\s*(\/\/|\$:)/.test(s))
    s = "\n" + s;
  return s;
}
