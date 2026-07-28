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

const COMPLETE_CONTRACT = `You are inline code-completion in a live-coding IDE. You get the code BEFORE the cursor and the code AFTER it. Output ONLY the raw text to insert at the cursor — no prose, no fences, no backticks around or after the code, never repeat text that is already there. Match the file's own style and vocabulary; finish the current line, or add the next line(s) that most belong — added lines BEGIN WITH A NEWLINE; never glue a comment or a new statement onto the end of an existing line. A comment stating an intent ("// rolling acid bassline") is an ASK — write the code that fulfils it on the following line(s). Never output only a comment: every completion must contain code (if the cursor is inside an unfinished comment, finish it, then write the code it asks for). When text follows the cursor ON THE SAME LINE, complete only what fits between — finish the expression there, never start a new line. Stop at a natural point (at most ~6 lines). A live sketch is NEVER finished: when the cursor sits at the end of code that already runs, offer the next move — a new line (or lines) that serves what is already playing. A move the sketch already made is not a move: never re-offer a line or transform the file already has. Output nothing only when no insertion at this exact spot could be valid.

THE TRIM — the exception, not the job. Your job is to GROW and DEVELOP the sketch: additions, variations, the next move. But when something already playing is audibly WRONG — a duplicated line, a voice at a crushing gain, an effect piled past taste — you may answer with a trim instead of an insertion, in exactly this form and nothing else:
[trim]
<one existing full line, copied byte-exact from the file>
[to]
<that line rewritten quieter/simpler — or exactly [gone] to remove it>
The [to] line must be one complete valid line in the file's own dialect. Offer a trim RARELY — only for a clear fault an insertion cannot answer; a merely busy sketch still deserves an addition or a variation. NEVER trim what is already quiet: a muted line (one starting \`_$:\`) or a low-gain voice is not a problem — leave it be.`;

export const COMPLETE_STRUDEL_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. Stay in the file's key and grid; add layers that serve the loop (never double an existing voice). A running loop nearly always has a next move — an unfilled role, a variation, a quiet layer under what plays; an empty answer is a last resort, never a habit. When the stack is already dense, prefer a VARIATION or a sparse, quiet voice over another loud layer. (If a trim is ever the right call, the kindest is the MUTE — rewrite the line with its \`$:\` prefixed as \`_$:\`, reversible in one keystroke — but growth is the job; the trim is rare.) A HYDRA pane may be given as read-only context — never emit hydra code here.

${STRUDEL_SPEC}`;

export const COMPLETE_HYDRA_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), hydra's own clocks frozen, all motion via H(<strudel signal>). After a chain's .out() the next move is a NEW chain on its own line — a src(o0).<transforms>.out() post-chain (feedback welcome) or a fresh source; never chain methods onto .out() itself. Never repeat a move the file already made: one src(o0) post-chain is enough — after that, vary something else (deepen an existing chain's arguments, add a different modulation, blend a new source). MORE IS NOT BETTER in a picture: two or three chains fill a frame — past that, offer only the smallest touch (one argument's modulation, a subtle post-chain), or nothing at all; a sketch that keeps growing turns to mud. The STRUDEL pane may be given as read-only context — read its loop length and energy so every H() period divides the loop; never emit strudel code here.

${HYDRA_SPEC}`;

// ── THE ONE-TAP FIX ──────────────────────────────────────────────────────────
// The error chip's ✦ fix: the broken pane + its error in, the mended pane out.
// Thinking-off (a fix is surgery, not composition); the route gates the result
// with the same server validators the ghost rides.

const FIX_CONTRACT = `You are the one-tap FIX in a live-coding IDE. You get a file and the error it throws at eval. Output ONLY the corrected file, whole — raw code, no prose, no fences. Make the SMALLEST change that kills the error; keep everything else byte-identical (same style, same ideas, no additions, no commentary). If the error cannot be caused by this code, output the file unchanged.`;

export const FIX_STRUDEL_SYSTEM = `${FIX_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer.

${STRUDEL_SPEC}`;

export const FIX_HYDRA_SYSTEM = `${FIX_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), all motion via H(<strudel signal>).

${HYDRA_SPEC}`;

// ── THE EXPLAIN ──────────────────────────────────────────────────────────────
// Select a fragment, tap ✦ explain: one on-demand Sonnet call (never
// pre-computed — commentary ahead of time is tokens burned on lines nobody
// asked about). The point is TEACHING: the coder leaves able to write it.

const EXPLAIN_CONTRACT = `You are the teacher inside a live-coding room. You get a file and a SELECTED fragment of it. Explain what the fragment does IN THIS FILE, so the coder learns to write it themselves. Plain words, concrete: name what the ear hears (or the eye sees) when it runs, and what the key values are doing. 2-4 short sentences, prose only — no headers, no lists, no code fences. If one value is worth turning to feel it, end by saying which and which way. Speak only to the selection in its context; never walk the whole file.`;

export const EXPLAIN_STRUDEL_SYSTEM = `${EXPLAIN_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer.

${STRUDEL_SPEC}`;

export const EXPLAIN_HYDRA_SYSTEM = `${EXPLAIN_CONTRACT}

The file is a Hydra sketch: chains ending in .out(), all motion via H(<strudel signal>).

${HYDRA_SPEC}`;

/** The explain call's user block. */
export function explainUserText(code: string, sel: string): string {
  return `THE FILE:
${code}

THE SELECTION TO EXPLAIN:
${sel}`;
}

// ── THE SELECTION EDIT ───────────────────────────────────────────────────────
// Select a span, say the change, the copilot rewrites EXACTLY that span
// (2026-07-28, user: "with the AI copilot, you must be able to perform the
// edit"). An editor's move, not a chat: the reply is the replacement text and
// nothing else; the route gates it differentially like a ghost.

const EDIT_SEL_CONTRACT = `You are the selection EDIT in a live-coding IDE. You get a FILE, a SELECTED SPAN from it, and an instruction. Output ONLY the code that replaces the selected span — raw code, no prose, no fences, nothing from outside the span. Make the SMALLEST change that fulfils the instruction; match the file's own style and vocabulary; inside the span, keep everything the instruction didn't ask about byte-identical. The replacement must splice cleanly into the file exactly where the span sat (same expression position — never open or orphan brackets across the span's edges). Quieting is a first-class edit: "quieter" / "sparser" / "strip the reverb" mean REDUCE — lower gains, remove methods, thin the pattern; to mute a whole layer, prefix its \`$:\` as \`_$:\` (the mute idiom). If the right change is to REMOVE the span entirely, output exactly [gone] and nothing else. If the instruction cannot apply to this selection, output the span unchanged.`;

export const EDIT_SEL_STRUDEL_SYSTEM = `${EDIT_SEL_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. Stay in the file's key and grid.

${STRUDEL_SPEC}`;

export const EDIT_SEL_HYDRA_SYSTEM = `${EDIT_SEL_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), hydra's own clocks frozen, all motion via H(<strudel signal>).

${HYDRA_SPEC}`;

/** The selection-edit call's user block. */
export function editSelUserText(code: string, sel: string, ask: string): string {
  return `THE FILE:
${code}

THE SELECTED SPAN (replace exactly this):
${sel}

THE INSTRUCTION:
${ask}`;
}

/** The fix call's user block. */
export function fixUserText(code: string, error: string): string {
  return `THE FILE:
${code}

THE ERROR IT THROWS:
${error}`;
}

/** The user block for one completion call, SPLIT for the prompt cache: the
 *  read-only context (the other pane — byte-stable across a whole typing
 *  burst) rides as CompleteOpts.cacheStable, its own cache-marked block, so
 *  every keystroke's summon re-reads [system + context] at ~0.1× instead of
 *  re-paying it; only BEFORE/AFTER vary per call. stable + tail concatenate
 *  to exactly the old single-block text — semantics unchanged. */
export function completeUserParts(
  before: string,
  after: string,
  context: string,
  contextLabel: string,
  midi?: string,
): { stable: string; tail: string } {
  // Recent MIDI rides the VARYING tail (it changes with every phrase played —
  // caching it would poison the stable block).
  const played = midi?.trim()
    ? `JUST PLAYED on the connected keys (oldest first — the coder may want the loop to answer this phrase, in its key and shape): ${midi.trim()}\n\n`
    : "";
  return {
    stable: context.trim()
      ? `${contextLabel} (read-only context):\n${context}\n\n`
      : "",
    tail: `${played}BEFORE (cursor at the end of this):
${before}
AFTER:
${after || "(end of file)"}`,
  };
}

/** Clean a raw completion: strip fences, drop overlap with what's already
 *  typed, kill trailing junk. Empty string = nothing to show. */
export function cleanCompletion(raw: string, before: string): string {
  let s = raw.replace(/^\s*```[a-z]*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");
  s = s.replace(/\s+$/, "");
  // Sonnet sometimes wraps the answer in SINGLE backticks (inline-code habit)
  // — a stray edge backtick reads as a template literal and kills the eval
  // ("Unterminated template", seen live). Our dialect never uses backticks,
  // so edge ones are always wrapper junk.
  s = s.replace(/^`+/, "").replace(/`+\s*$/, "");
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
  // A no-thinking model's laziest "next move" is the move the file JUST made —
  // the same line again (seen live: `.every(4, x=>x.ply(2))` ghosted right
  // under an identical line, twice running). An echo is not a move: drop
  // ghost lines that duplicate the line directly above them (in the file or
  // within the ghost itself).
  {
    const lines = s.split("\n");
    const kept: string[] = [];
    let prev = before
      .split("\n")
      .filter((l) => l.trim())
      .pop()
      ?.trim();
    for (const line of lines) {
      const t = line.trim();
      if (t && t === prev) continue;
      kept.push(line);
      if (t) prev = t;
    }
    s = kept.join("\n");
    if (!s.trim()) return "";
  }
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
