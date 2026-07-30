/**
 * Mock Claude responses for testing without spending API credits.
 *
 * Enabled when KLAPPN_MOCK_LLM is "1"/"true" (a wrangler var on the app and/or
 * workflows worker) or when a caller passes { mock: true }. The mock returns
 * VALID, varied, playable Strudel so the full pipeline — generation Workflow,
 * DB writes, per-part playback, and "play whole song" — can be exercised end to
 * end without calling the real model. Keep production with the var unset.
 */

import type {
  EditedPart,
} from "./anthropic";

export function mockEnabled(explicit?: boolean): boolean {
  if (explicit) return true;
  const v = process.env.KLAPPN_MOCK_LLM;
  return v === "1" || v === "true";
}
// A few distinct, valid layered patterns. Each is a complete program (sets
// tempo, stacks layers via `$:`) so it plays on its own AND in the song
// scheduler. They differ audibly so transitions between sections are obvious.
export function mockEdit(
  parts: { id: string; label: string | null; strudel: string | null }[],
  changeRequest: string,
): EditedPart[] {
  // Echo every part back unchanged except a marker comment so the edit is
  // observable in tests without the model.
  return parts.map((p) => ({
    id: p.id,
    strudel: `// [MOCK edit] ${changeRequest.slice(0, 60)}\n${p.strudel ?? ""}`,
  }));
}
