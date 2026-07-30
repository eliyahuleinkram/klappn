/**
 * THE QUALITY DIAL — how hard the house writes this song's music.
 *
 * Not a model picker (that died with the bake-off on 2026-07-20, and naming
 * engines at people was never the product). It is ONE choice with ONE
 * consequence: on Studio the calls that INVENT music — the per-layer composer
 * and the break writer — run on the costlier tier, and the maker is told, before
 * they tap, roughly what that spends. Everything else in the song (edits,
 * planners, panels, visuals, the room) is identical either way; those calls were
 * never the ones a stronger model changed.
 *
 * `songs.model` persists the choice per song, so a song keeps composing the way
 * it was born. Standard is the default and every legacy value ("fable",
 * "anthropic", stale bake-off ids) resolves to it — see resolveTier in
 * lib/llm.ts, which is the ONLY place the dial turns into a model id.
 */
export const MODEL_OPTIONS = [
  { id: "opus", label: "Standard", blurb: "The composer we ship." },
  {
    id: "studio",
    label: "Studio",
    blurb: "A stronger hand writes the loops — about twice the tokens.",
  },
] as const;

/** A persisted/routable model id. */
export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];

/** Default when the user doesn't choose. STANDARD — the dial only ever costs
 *  more, so it is opt-in; nobody's spend doubles because we shipped a toggle. */
export const DEFAULT_MODEL: ModelId = "opus";

/** True only for models the UI currently offers. */
export function isModelId(s: unknown): s is ModelId {
  return typeof s === "string" && MODEL_OPTIONS.some((m) => m.id === s);
}
