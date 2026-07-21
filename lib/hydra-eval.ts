/**
 * hydra-eval.ts — the SERVER-SIDE EVAL EQUIVALENT for Hydra (2026-07-02, the user: "errors must be
 * caught before they hit the browser; an eval equivalent for hydra too").
 *
 * Hydra can't actually run on Workers (no WebGL), so this mirrors exactly what the BROWSER throws
 * when the code evals there — nothing more (no motion/doctrine judgment; that lives in the prompt):
 *   • a syntax error                              → SyntaxError at eval
 *   • an unknown function in a chain              → "X is not a function"
 *   • a chain op called bare (not on a source)    → "X is not defined"
 *   • no .out()                                   → renders nothing (a black "visual")
 *
 * The function roster is hydra-synth's own src/glsl/glsl-functions.js (fetched 2026-07-02) + the
 * non-GLSL chain calls (out) + our H() bridge. Anything INSIDE an H(...) argument is a Strudel
 * signal expression (saw.slow(8).range(…)) and is exempt.
 */
import { parse } from "acorn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** Sources — callable bare (they start a chain). */
const SRC_FNS = new Set([
  "noise", "voronoi", "osc", "shape", "gradient", "src", "solid", "prev",
]);

/** Every chainable operator (hydra-synth glsl-functions.js: coord + color + combine + combineCoord). */
const CHAIN_FNS = new Set([
  // coord
  "rotate", "scale", "pixelate", "repeatX", "repeatY", "repeat", "kaleid",
  "scroll", "scrollX", "scrollY",
  // color
  "posterize", "shift", "invert", "contrast", "brightness", "luma", "thresh",
  "color", "saturate", "hue", "colorama", "r", "g", "b", "a", "sum",
  // combine
  "add", "sub", "layer", "blend", "mult", "diff", "mask",
  // combineCoord
  "modulate", "modulateScale", "modulatePixelate", "modulateRotate",
  "modulateHue", "modulateRepeat", "modulateRepeatX", "modulateRepeatY",
  "modulateScrollX", "modulateScrollY", "modulateKaleid",
  // output
  "out",
]);

/** Bare identifiers that are legitimately callable / referencable at the top level. */
const BARE_OK = new Set([...SRC_FNS, "H", "render", "hush", "update", "setResolution"]);

/** Identifiers that may appear as bare ARGUMENTS (outputs/sources/globals). */
const IDENT_OK = new Set(["o0", "o1", "o2", "o3", "s0", "s1", "s2", "s3", "H"]);

function walk(node: Any, visit: (n: Any) => boolean | void): void {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") {
    if (visit(node) === false) return; // subtree exempt (H args)
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit));
    else if (v && typeof v === "object" && typeof v.type === "string") walk(v, visit);
  }
}

/** The browser-crash equivalents for a Hydra program. [] = it will eval and render. */
export function hydraServerErrors(code: string): string[] {
  const errors: string[] = [];
  const s = (code || "").trim();
  if (!s) return ["empty visual"];

  let ast: Any = null;
  try {
    ast = parse(s, { ecmaVersion: 2022, sourceType: "module" });
  } catch (e) {
    errors.push(`syntax error: ${String((e as Error).message).split("\n")[0]}`);
    return errors; // nothing else is checkable
  }

  if (!/\.out\s*\(/.test(s))
    errors.push("no .out() — the final chain must end with .out() or nothing renders");

  const unknown = new Set<string>();
  const bare = new Set<string>();
  walk(ast, (node) => {
    // Anything inside H(...) is a Strudel signal expression — exempt.
    if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      node.callee.name === "H"
    )
      return false;
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    if (callee?.type === "Identifier") {
      if (!BARE_OK.has(callee.name)) {
        // a chain op called bare throws "X is not defined"; a made-up name likewise
        (CHAIN_FNS.has(callee.name) ? bare : unknown).add(callee.name);
      }
    } else if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
      const name = callee.property.name;
      if (!CHAIN_FNS.has(name) && !SRC_FNS.has(name) && !IDENT_OK.has(name))
        unknown.add(name);
    }
  });
  if (unknown.size)
    errors.push(
      `not real hydra functions (they throw at eval): ${[...unknown].map((f) => `${f}()`).join(", ")} — use only hydra-synth's real operators`,
    );
  if (bare.size)
    errors.push(
      `chain operator(s) called bare: ${[...bare].map((f) => `${f}(…)`).join(", ")} — these are methods, valid only chained onto a source (they throw "is not defined" bare)`,
    );
  return errors;
}
