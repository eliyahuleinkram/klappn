/**
 * Scales the AI composes in that stock tonal.js doesn't know.
 *
 * strudel's .scale() THROWS on names missing from the tonal dictionary — there
 * is no chromatic fallback — so every name strudel-spec.ts advertises MUST
 * resolve, or the take dies at eval with "Invalid scale name" and the fixer
 * (reading the same spec, which says the name is fine) can never heal it.
 *
 * Quarter-tone maqamat (bayati, rast) use their standard 12-TET
 * approximations. Registration must reach the SAME @tonaljs instance
 * @strudel/tonal reads — "@tonaljs/tonal" is in STRUDEL_DEDUPE
 * (vite.config.ts) so both resolve to one copy.
 */
import { Scale, ScaleType } from "@tonaljs/tonal";

// [name (colon form → spaces, as strudel normalizes), intervals, aliases]
const EXTRA_SCALES: [string, string[], string[]][] = [
  ["maqam hijaz", ["1P", "2m", "3M", "4P", "5P", "6m", "7m"], ["hijaz"]],
  ["maqam bayati", ["1P", "2m", "3m", "4P", "5P", "6m", "7m"], ["bayati"]],
  ["maqam rast", ["1P", "2M", "3M", "4P", "5P", "6M", "7m"], ["rast"]],
  ["raga bhairav", ["1P", "2m", "3M", "4P", "5P", "6m", "7M"], ["bhairav"]],
  ["raga todi", ["1P", "2m", "3m", "4A", "5P", "6m", "7M"], ["todi"]],
  ["raga kafi", ["1P", "2M", "3m", "4P", "5P", "6M", "7m"], ["kafi"]],
  ["gypsy minor", ["1P", "2M", "3m", "4A", "5P", "6m", "7M"], []],
  ["byzantine", ["1P", "2m", "3M", "4P", "5P", "6m", "7M"], []],
  ["neapolitan minor", ["1P", "2m", "3m", "4P", "5P", "6m", "7M"], []],
  ["insen", ["1P", "2m", "4P", "5P", "7m"], []],
  ["bebop dominant", ["1P", "2M", "3M", "4P", "5P", "6M", "7m", "7M"], []],
];

/** Idempotent — call from every module that imports @strudel/tonal, before
 *  any pattern is built or queried. */
export function registerExtraScales(): void {
  for (const [name, intervals, aliases] of EXTRA_SCALES) {
    if (ScaleType.get(name).empty) ScaleType.add(intervals, name, aliases);
  }
  // Loud, early tell if module duplication ever breaks the shared instance.
  if (Scale.get("C maqam hijaz").empty) {
    console.error("[klappn] extra scale registration did not take — duplicate @tonaljs instance?");
  }
}
