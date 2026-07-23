/**
 * Hydra lives in the loop's code as an INERT comment block, the same convention
 * `parameterize` uses for `/* @controls *\/`. The musical Strudel is never
 * touched: run the stored code as plain Strudel and the `/* @hydra *\/` comment
 * is ignored (pure audio, copy-paste stays audio-only). Our own player extracts
 * the block and runs it as real Hydra code alongside the audio for visuals.
 *
 * The block is appended at the END (after the music) so it never collides with
 * the `@controls` block parameterize prepends at the TOP.
 */

const HYDRA_RE = /\n*\/\*\s*@hydra\b\s*([\s\S]*?)\*\//;

/** The Hydra code stored in a loop, or null if it has none. */
export function extractHydra(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.match(HYDRA_RE);
  const inner = m?.[1]?.trim();
  return inner ? inner : null;
}

/** The loop's code with any @hydra block removed (the pure music). */
export function stripHydraBlock(code: string): string {
  return code.replace(HYDRA_RE, "").replace(/\s+$/, "") + "\n";
}

/** Replace (or add) a loop's @hydra block. `hydra` empty → just strip it. */
export function attachHydraBlock(code: string, hydra: string): string {
  const base = stripHydraBlock(code);
  const inner = (hydra || "").trim();
  if (!inner) return base;
  // A "*/" inside the visual code would close the comment early — defuse it.
  const safe = inner.replace(/\*\//g, "* /");
  return `${base.replace(/\s+$/, "")}\n\n/* @hydra\n${safe}\n*/\n`;
}

/** Does this loop carry Hydra visuals? */
export function hasHydra(code: string | null | undefined): boolean {
  return extractHydra(code) !== null;
}

/** The song's ONE visual, stored canonically on the plan (`plan.visual`): the graded
 *  @hydra sketch plus its @vcontrols grade spec and @vlooks one-tap looks (JSON strings).
 *  Every part carries a rendered copy of these blocks in its strudel; this is the source
 *  of truth a part attaches when it has no painted neighbour to inherit from. */
export interface SongVisual {
  hydra: string;
  vcontrols?: string;
  vlooks?: string;
}

/** Write a song visual onto a loop's code: replaces any existing @hydra / @vcontrols /
 *  @vlooks blocks with this visual's, leaving the music untouched. */
export function attachVisualBlocks(code: string, v: SongVisual): string {
  const stripped = stripHydraBlock(code).replace(
    /\/\*\s*@(?:vcontrols|vlooks)\b[\s\S]*?\*\/\n*/g,
    "",
  );
  let out = attachHydraBlock(stripped, v.hydra);
  if (v.vcontrols) {
    out = out.replace(
      "/* @hydra",
      `/* @vcontrols\n${v.vcontrols}\n*/\n\n${v.vlooks ? `/* @vlooks\n${v.vlooks}\n*/\n\n` : ""}/* @hydra`,
    );
  }
  return out;
}
