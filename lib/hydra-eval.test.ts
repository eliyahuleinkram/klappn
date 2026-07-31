/**
 * The gate's own contract: it must refuse exactly what the browser throws — and
 * nothing else. Every "accepts" case below is code hydra (or our zissl) runs
 * fine; every "refuses" case is a real crash or a black screen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hydraServerErrors } from "./hydra-eval";

const ok = (code: string) =>
  assert.deepEqual(hydraServerErrors(code), [], `should accept:\n${code}`);
const fails = (code: string, needle: string) => {
  const errs = hydraServerErrors(code);
  assert.ok(errs.length, `should refuse:\n${code}`);
  assert.ok(
    errs.some((e) => e.includes(needle)),
    `expected an error mentioning "${needle}", got: ${errs.join(" | ")}`,
  );
};

test("the plain shape still passes", () => {
  ok(`osc(4, 0, 1).rotate(H(saw.slow(8).range(0, 6.283))).color(1, .6, .3).kaleid(6).out()`);
  ok(`osc(10).out(o0)\nvoronoi(5, 0).thresh(.4).out(o1)\nsrc(o0).blend(src(o1), .5).out(o2)\nrender(o2)`);
});

test("a control bus of the sketch's own functions is legal JS — never refuse it", () => {
  ok(`
let arc  = H(saw.slow(16))
let beat = H(isaw.fast(4))
let gate = (...spans) => () => spans.some((s) => arc() >= s[0] && arc() < s[1]) ? 1 : 0
let gKick = gate([0.25, 0.75], [0.875, 1])
let sides = () => [6, 6, 8, 12][Math.floor(arc() * 16) % 4]
function kick() { return gKick() * beat() }
osc(() => 5 + arc() * 6, 0, 0.9).kaleid(sides).scale(() => 1 - kick() * 0.07).out(o0)
render(o0)`);
});

test("hydra's own page surface is in scope", () => {
  ok(`update = (dt) => { speed = 1 + Math.sin(time) }\nosc(10).out(o0)`);
  ok(`await s0.initCam()\nsrc(s0).saturate(2).out(o0)`);
  ok(`await initHydra()\nosc(4).out(o0)`);
  ok(`s0.initImage("https://example.com/a.png")\nsrc(s0).out(o0)`);
  ok(`osc([10, 20, 30].fast(2), 0, 1).out(o0)`);
  ok(`shape(4).mult(osc(10).sum()).out(o0)`);
  ok(`prev().scale(0.99).layer(osc(4).luma()).out(o0)`);
  ok(`osc(() => 20 + a.fft[0] * 40).out(o0)`);
  ok(`setFunction({ name: "wobble", type: "coord", inputs: [], glsl: "return _st;" })\nosc(4).out(o0)`);
  ok(`hush()\nsolid(1, 0, 0).out(o0)`);
});

test("destructuring, loops and locals that shadow nothing", () => {
  ok(`
const [lo, hi] = [0.2, 0.8]
const pick = (n) => lo + (hi - lo) * n
let chain = osc(4)
for (let i = 0; i < 2; i++) chain = chain.rotate(pick(i / 2))
chain.out(o0)`);
});

test("H() arguments are Strudel, not hydra — never judged", () => {
  ok(`osc(4).rotate(H("<0 1 2 3>")).out(o0)`);
  ok(`osc(4).hue(H(sine.slow(4).range(0, 1))).out(o0)`);
  ok(`osc(4).kaleid(H(saw.segment(4).range(3, 8))).out(o0)`);
});

test("the real crashes are still caught", () => {
  fails(`osc(4).wompwomp(0.5).out(o0)`, "not real hydra functions");
  fails(`osc(4).blur(3).out(o0)`, "not real hydra functions");
  fails(`rotate(0.1).out(o0)`, "called bare");
  fails(`osc(4).out(o0).brightness(0.2)`, ".out() ends a chain");
  fails(`osc(4).rotate(0.1)`, "no .out()");
  fails(`osc(4.out(o0)`, "syntax error");
  fails(``, "empty visual");
  fails(`glitch(4).out(o0)`, "not real hydra functions");
  fails(`s0.initWebcam()\nsrc(s0).out(o0)`, "no such source method");
});

test("a typo'd bare call is still a crash — scope-awareness is not blindness", () => {
  fails(`let arc = H(saw)\nosc(() => arcc()).out(o0)`, "not real hydra functions");
});
