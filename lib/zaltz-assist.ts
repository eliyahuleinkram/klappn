import { STRUDEL_SPEC } from "./strudel-spec";
import { HYDRA_SPEC } from "./hydra-spec";

/**
 * THE IDE'S BANDMATE — the one system prompt behind /api/assist. Not a
 * composer-pipeline call: the coder owns the code, the model proposes a take on
 * it, and NOTHING lands until the coder accepts (no autocomplete, ever — the
 * proposal is shown whole and taken or dismissed). Lean by law: task + output
 * contract + the two specs, once.
 *
 * The output markers are chosen so a code fence inside the code can't break
 * parsing, and parseAssist tolerates a model that wraps a pane in ``` anyway.
 */
export const ASSIST_SYSTEM = `You are the resident bandmate in a live-coding IDE. Two panes: STRUDEL (the music) and HYDRA (the visuals). You get the current panes and one ask from the coder — apply the ask to the code.

- Change only what the ask needs; every line it doesn't touch comes back byte-identical.
- Return ONLY the pane(s) you changed, each COMPLETE (the whole pane, never a fragment). Filling an empty pane counts as changing it.
- Strudel pane shape: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. In key, on the grid.
- Hydra pane shape: plain hydra-synth chains ending in \`.out()\`; every motion via \`H(<strudel signal>)\` so the picture runs on the transport clock (spec below).
- The ask is a musician talking, not a spec — read the intent, keep it playable live.

Output EXACTLY this shape and nothing else (omit any pane you didn't change):
STRUDEL<<<
<the full revised strudel pane>
>>>
HYDRA<<<
<the full revised hydra pane>
>>>
NOTE<<<
<one short line — what you did, plain words>
>>>

${STRUDEL_SPEC}

${HYDRA_SPEC}`;

export interface AssistProposal {
  strudel?: string;
  hydra?: string;
  note?: string;
}

function grab(out: string, tag: string): string | null {
  const m = out.match(new RegExp(`${tag}<<<[ \\t]*\\r?\\n?([\\s\\S]*?)>>>`));
  if (!m) return null;
  let s = m[1];
  // Tolerate a model that wrapped the pane in a code fence anyway.
  s = s.replace(/^\s*```[a-z]*\r?\n/i, "").replace(/\r?\n```\s*$/i, "");
  s = s.replace(/\s+$/, "");
  return s;
}

/** Pull the revised panes + note out of the model's reply. A pane the model
 *  omitted stays undefined (= "no change"); an explicitly EMPTY pane comes
 *  back as "" (= "clear it"). */
export function parseAssist(raw: string): AssistProposal {
  const out: AssistProposal = {};
  const strudel = grab(raw, "STRUDEL");
  const hydra = grab(raw, "HYDRA");
  const note = grab(raw, "NOTE");
  if (strudel !== null) out.strudel = strudel;
  if (hydra !== null) out.hydra = hydra;
  if (note !== null) out.note = note.split("\n")[0].slice(0, 200);
  // A model that ignored the markers but clearly wrote strudel: salvage it as
  // the strudel pane rather than failing the whole call.
  if (strudel === null && hydra === null && /^\s*(setcpm|\$:)/m.test(raw)) {
    out.strudel = raw
      .replace(/^\s*```[a-z]*\r?\n/i, "")
      .replace(/\r?\n```\s*$/i, "")
      .replace(/\s+$/, "");
  }
  return out;
}

/** The user block for one assist call. */
export function assistUserText(
  strudel: string,
  hydra: string,
  ask: string,
): string {
  return `STRUDEL PANE:
${strudel.trim() ? strudel : "(empty)"}

HYDRA PANE:
${hydra.trim() ? hydra : "(empty)"}

ASK: ${ask}`;
}

// ── THE COPILOT (2026-07-26, user reversal: autocomplete IS wanted) ──────────
// Ghost-text completion at the caret — the fast lane. Runs on Sonnet 5 with
// thinking DISABLED (the latency win; same pin as every no-thinking utility
// call). Small, throttled, metered like everything else.

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

// ── TWEAKS — one-tap next moves, generated after a CLEAN run ─────────────────

export const TWEAKS_SYSTEM = `You are given a live-coded loop (a Strudel music pane + a Hydra visual pane; either may be empty). Return JSON ONLY:
{"tweaks":[{"name":"<1-3 words>","ask":"<the change, imperative, ≤120 chars>"}],
 "layers":[{"n":<1-based position of the \`$:\` line>,"name":"<what this voice IS, 1-3 words a non-musician reads: "Deep kick", "Acid bass", "Shimmer hats">"}]}
TWEAKS: 4 or 5, each a DISTINCT move a live coder would actually reach for next — groove, texture, energy, space, light. At least ONE is for the VISUAL: reshape the hydra pane when it has code, or introduce a visual when it's empty (say so in the ask). Names a non-musician reads at a glance; asks concrete enough to execute. Never a tweak that just undoes another.
LAYERS: one entry per \`$:\` (or muted \`_$:\`) line of the STRUDEL pane, in order — name what it sounds like, never the code.`;

export interface Tweak {
  name: string;
  ask: string;
}

/** Tolerant parse of the tweaks JSON (fences, stray prose around it). Also
 *  carries the AI's human NAMES for each `$:` layer, in pane order — the
 *  dials wear these so a non-musician knows what every fader IS. */
export function parseTweaks(raw: string): { tweaks: Tweak[]; layerNames: string[] } {
  const none = { tweaks: [], layerNames: [] };
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return none;
  try {
    const d = JSON.parse(m[0]) as { tweaks?: unknown; layers?: unknown };
    const tweaks = (Array.isArray(d.tweaks) ? d.tweaks : [])
      .filter(
        (t): t is Tweak =>
          !!t &&
          typeof (t as Tweak).name === "string" &&
          typeof (t as Tweak).ask === "string",
      )
      .slice(0, 5)
      .map((t) => ({ name: t.name.trim().slice(0, 40), ask: t.ask.trim().slice(0, 160) }));
    const byN = new Map<number, string>();
    for (const l of Array.isArray(d.layers) ? d.layers : []) {
      const e = l as { n?: unknown; name?: unknown };
      if (typeof e.n === "number" && typeof e.name === "string" && e.name.trim())
        byN.set(e.n, e.name.trim().slice(0, 28));
    }
    const layerNames: string[] = [];
    for (let i = 1; i <= byN.size + 8 && layerNames.length < 24; i++) {
      if (byN.has(i)) layerNames[i - 1] = byN.get(i)!;
    }
    return { tweaks, layerNames };
  } catch {
    return none;
  }
}
