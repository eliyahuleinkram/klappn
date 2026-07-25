/**
 * The composition model. There is exactly one: Claude Opus 5, routed natively
 * in lib/llm.ts. Klappn's first month ran a live multi-model bake-off (Sonnet,
 * Opus, GLM, Kimi, Gemini, Grok, an OpenRouter roster) — Fable won on the ear,
 * and the roster was removed 2026-07-20 when the product narrowed to one voice.
 * Opus 5 (launched 2026-07-24) took over on 2026-07-25: near-Fable quality at
 * half the price.
 *
 * `songs.model` persists the id per song. Legacy rows read "fable" (and older
 * bake-off ids before that); lib/llm.ts routes every legacy id to Opus 5 too,
 * so stored values and routing agree without a data migration. With a single
 * option the UI never shows a picker (HomeClient gates on
 * MODEL_OPTIONS.length > 1).
 */
export const MODEL_OPTIONS = [
  { id: "opus", label: "Claude Opus 5", blurb: "Anthropic (native) · most capable" },
] as const;

/** A persisted/routable model id. */
export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];

/** Default when the user doesn't choose. */
export const DEFAULT_MODEL: ModelId = "opus";

/** True only for models the UI currently offers. */
export function isModelId(s: unknown): s is ModelId {
  return typeof s === "string" && MODEL_OPTIONS.some((m) => m.id === s);
}
