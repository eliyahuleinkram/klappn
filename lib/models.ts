/**
 * The composition model. There is exactly one: Claude Fable 5, routed natively
 * in lib/llm.ts. Klappn's first month ran a live multi-model bake-off (Sonnet,
 * Opus, GLM, Kimi, Gemini, Grok, an OpenRouter roster) — Fable won on the ear,
 * and the roster was removed 2026-07-20 when the product narrowed to one voice.
 *
 * `songs.model` persists the id per song. Legacy ids from the bake-off era were
 * migrated to "fable" in the same change, so stored values and routing agree.
 * With a single option the UI never shows a picker (HomeClient gates on
 * MODEL_OPTIONS.length > 1).
 */
export const MODEL_OPTIONS = [
  { id: "fable", label: "Claude Fable 5", blurb: "Anthropic (native) · most capable" },
] as const;

/** A persisted/routable model id. */
export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];

/** Default when the user doesn't choose. */
export const DEFAULT_MODEL: ModelId = "fable";

/** True only for models the UI currently offers. */
export function isModelId(s: unknown): s is ModelId {
  return typeof s === "string" && MODEL_OPTIONS.some((m) => m.id === s);
}
