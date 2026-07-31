/**
 * hydra-eval.ts — the SERVER-SIDE EVAL EQUIVALENT for Hydra (2026-07-02, the user: "errors must be
 * caught before they hit the browser; an eval equivalent for hydra too").
 *
 * Hydra can't actually run on Workers (no WebGL/WebGPU), so this mirrors exactly what the BROWSER
 * throws when the code evals there — nothing more (no motion/doctrine judgment; that lives in the
 * prompt):
 *   • a syntax error                              → SyntaxError at eval
 *   • an unknown operator IN A HYDRA CHAIN        → "X is not a function"
 *   • a chain op called bare (not on a source)    → "X is not defined"
 *   • an unknown bare function                    → "X is not defined"
 *   • no .out()                                   → renders nothing (a black "visual")
 *
 * THE PARITY LAW (2026-07-31, the user: "everything one can do in Hydra must be doable here"):
 * this gate NEVER refuses code the engine would run. It is SCOPE-AWARE — a name the sketch itself
 * declared (`let gKick = H(…)`, `const gate = …`, a function, a destructured binding, a parameter)
 * is callable, because calling it can't throw; so are the JS built-ins (Math, Number, JSON…), the
 * whole hydra page surface (render/hush/setFunction/screencap/update/speed/bpm/time/mouse/a/s0…),
 * array sequencing ([1,2,3].fast(2)), the external sources (s0.initCam()), and `await initHydra()`
 * (a no-op here — the room's hydra is already up, and sketches are evaluated in an async scope).
 * Judgment is spent ONLY where it's certain: a chain hanging off a real hydra source, and a bare
 * call to a name nothing declared.
 *
 * The operator roster is hydra-synth's own src/glsl/glsl-functions.js (52 fns, re-checked
 * 2026-07-31 against hydra-synth 1.4.0 and our own zissl engine) + the non-GLSL chain call (out).
 * Anything INSIDE an H(...) argument is a Strudel expression (saw.slow(8).range(…), "<0 1 2 3>")
 * and is exempt.
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

/** The external sources' own methods (s0..s3) — hydra-source.js + zissl's Source. */
const SOURCE_METHODS = new Set([
  "init", "initCam", "initScreen", "initVideo", "initImage", "initStream", "clear",
]);

/** Hydra's array-sequencing modifiers (it patches Array.prototype; so does zissl). */
const ARRAY_MODS = new Set(["fast", "slow", "smooth", "ease", "offset", "fit"]);

/** Bare identifiers that are legitimately callable at the top level. */
const BARE_OK = new Set([
  ...SRC_FNS,
  "H",
  "render", "hush", "update", "afterUpdate", "setResolution", "setFunction",
  "setTime", "screencap", "initHydra", "loadScript",
]);

// The page objects a sketch READS (o0…o3, s0…s3, a, time, speed, bpm, mouse,
// width, height, stats) are deliberately unlisted: a bare reference is not a
// call, the engine stamps far more names than we could enumerate (all of
// strudel's controls land on the page too), and a wrong "not defined" would
// refuse code that runs. Judgment stays on CALLS, where we can be sure.

/** JS built-ins a sketch may lean on (Math.floor, Array.from, JSON.stringify…). */
const JS_GLOBALS = new Set([
  "Math", "Number", "String", "Boolean", "Array", "Object", "JSON", "Date",
  "Map", "Set", "console", "parseInt", "parseFloat", "isFinite", "isNaN",
  "Promise", "globalThis", "window", "document", "performance", "fetch",
  "requestAnimationFrame", "structuredClone",
]);

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

/** Every name a binding pattern introduces (`let {a, b: [c]} = …`, `(x, ...rest) => …`). */
function patternNames(node: Any, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  switch (node.type) {
    case "Identifier":
      out.add(node.name);
      return;
    case "ObjectPattern":
      node.properties?.forEach((p: Any) =>
        patternNames(p.type === "RestElement" ? p.argument : p.value, out),
      );
      return;
    case "ArrayPattern":
      node.elements?.forEach((e: Any) => patternNames(e, out));
      return;
    case "AssignmentPattern":
      patternNames(node.left, out);
      return;
    case "RestElement":
      patternNames(node.argument, out);
      return;
  }
}

/** Every name the sketch itself declares — these can always be called. */
function declaredNames(ast: Any): Set<string> {
  const names = new Set<string>();
  walk(ast, (node) => {
    switch (node.type) {
      case "VariableDeclarator":
        patternNames(node.id, names);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if (node.id) names.add(node.id.name);
        node.params?.forEach((p: Any) => patternNames(p, names));
        break;
      case "ClassDeclaration":
        if (node.id) names.add(node.id.name);
        break;
      case "CatchClause":
        if (node.param) patternNames(node.param, names);
        break;
      case "AssignmentExpression":
        // `update = (dt) => {}` — hydra's own idiom: a bare assignment to a
        // page global. It declares nothing, but the name is live after it.
        if (node.left?.type === "Identifier") names.add(node.left.name);
        break;
    }
  });
  return names;
}

/** The identifier a member expression hangs off: `osc(1).rotate(2)` → the osc call. */
function chainRoot(node: Any): Any {
  let cur = node;
  for (;;) {
    if (cur?.type === "MemberExpression") cur = cur.object;
    else if (cur?.type === "CallExpression") cur = cur.callee;
    else return cur;
  }
}

/** Does this member call hang off a real hydra source — `osc(…)`, `src(o0)`, `prev()`? */
function rootsInHydraSource(node: Any): boolean {
  let cur = node;
  for (;;) {
    if (cur?.type === "MemberExpression") {
      cur = cur.object;
      continue;
    }
    if (cur?.type === "CallExpression") {
      if (cur.callee?.type === "Identifier" && SRC_FNS.has(cur.callee.name)) return true;
      cur = cur.callee;
      continue;
    }
    return false;
  }
}

/** The browser-crash equivalents for a Hydra program. [] = it will eval and render. */
export function hydraServerErrors(code: string): string[] {
  const errors: string[] = [];
  const s = (code || "").trim();
  if (!s) return ["empty visual"];

  let ast: Any = null;
  try {
    // sourceType module + allowAwaitOutsideFunction: sketches run inside an
    // async scope in the room, so `await initHydra()` / `await s0.initCam()`
    // parse here exactly as they eval there.
    ast = parse(s, { ecmaVersion: 2022, sourceType: "module", allowAwaitOutsideFunction: true });
  } catch (e) {
    errors.push(`syntax error: ${String((e as Error).message).split("\n")[0]}`);
    return errors; // nothing else is checkable
  }

  if (!/\.out\s*\(/.test(s))
    errors.push("no .out() — the final chain must end with .out() or nothing renders");

  // .out() returns undefined → chaining after it throws "Cannot read properties
  // of undefined" at eval (seen live: `.out().brightness(...)`). The chain ENDS
  // at .out(). (zissl returns the chain, hydra-synth returns undefined — we hold
  // the stricter line so a sketch reads the same on both engines.)
  if (/\.out\s*\([^)]*\)\s*\./.test(s))
    errors.push(
      ".out() ends a chain and returns nothing — calling anything after it throws; put the transform BEFORE .out()",
    );

  const declared = declaredNames(ast);
  const unknown = new Set<string>();
  const bare = new Set<string>();
  const badSource = new Set<string>();
  walk(ast, (node) => {
    // Anything inside H(...) is a Strudel expression — exempt.
    if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      node.callee.name === "H"
    )
      return false;
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    if (callee?.type === "Identifier") {
      const name = callee.name;
      if (BARE_OK.has(name) || declared.has(name) || JS_GLOBALS.has(name)) return;
      // a chain op called bare throws "X is not defined"; a made-up name likewise
      (CHAIN_FNS.has(name) ? bare : unknown).add(name);
      return;
    }
    if (callee?.type !== "MemberExpression" || callee.property?.type !== "Identifier") return;
    const name = callee.property.name;
    if (CHAIN_FNS.has(name) || SRC_FNS.has(name) || ARRAY_MODS.has(name)) return;
    const root = chainRoot(callee);
    // s0.initCam() and friends — we know that object's whole API.
    if (root?.type === "Identifier" && /^s[0-3]$/.test(root.name)) {
      if (!SOURCE_METHODS.has(name)) badSource.add(`${root.name}.${name}`);
      return;
    }
    // A chain hanging off a real source is ours to judge; anything else (a
    // local object, Math, a JS built-in) is not — calling it may be perfectly
    // fine, and no gate should refuse code the engine would run.
    if (rootsInHydraSource(callee)) unknown.add(name);
  });
  if (unknown.size)
    errors.push(
      `not real hydra functions (they throw at eval): ${[...unknown].map((f) => `${f}()`).join(", ")} — use only hydra-synth's real operators`,
    );
  if (bare.size)
    errors.push(
      `chain operator(s) called bare: ${[...bare].map((f) => `${f}(…)`).join(", ")} — these are methods, valid only chained onto a source (they throw "is not defined" bare)`,
    );
  if (badSource.size)
    errors.push(
      `no such source method: ${[...badSource].join(", ")} — an external source takes init/initCam/initScreen/initVideo/initImage/clear`,
    );
  return errors;
}
