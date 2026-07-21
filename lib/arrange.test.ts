/**
 * Tests for the native song arrangement builder (lib/arrange.ts): loop code →
 * single expression, sections → one arrange() program, cycle→span mapping.
 * Run: node_modules/.bin/esbuild lib/arrange.test.ts --bundle --format=esm --platform=node --outfile=/tmp/ar.mjs && node --test /tmp/ar.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildArrangement,
  movesFromPresence,
  nextUnit,
  parseSetcpm,
  presenceFromMoves,
  sectionEntries,
  sectionExpression,
  sectionParts,
  spanAtCycle,
} from "./arrange";

const LOOP_A = `// a comment
$: s("bd*4").gain(0.9).orbit(1)
$: note("c3 e3 g3 e3").s("sawtooth")
  .lpf(800)
  .orbit(2)
_$: s("hh*8") // muted layer drops away
setcpm(120/4)`;

const LOOP_B = `$: s("hh*8").orbit(3)
/* @swaps
[{"options":[{"s":"hh"}]}]
*/
setcpm(120/4)

/* @hydra
osc(10).out()
*/`;

test("sectionExpression stacks active layers and drops muted/setcpm/comments", () => {
  const expr = sectionExpression(LOOP_A);
  assert.ok(expr);
  assert.match(expr!, /^stack\(/);
  assert.match(expr!, /s\("bd\*4"\)/);
  assert.match(expr!, /\.lpf\(800\)/);
  assert.ok(!expr!.includes("hh*8"), "muted layer must not play");
  assert.ok(!expr!.includes("setcpm"), "tempo is set once, program-level");
});

test("sectionExpression folds mix-bus all() dials onto the stack (stays gapless)", () => {
  // Song-wide SOUND dials arrive as trailing all(x => x.lpf(…)) lines after the
  // setcpm. They must NOT force the section off the embeddable path — they fold
  // onto the final expression so the song keeps riding one gapless arrange().
  const withDials = `$: s("bd*4").orbit(1)
$: note("c3 e3").s("saw").orbit(2)
setcpm(120/4)
all(x => x.lpf(400))
all(x => x.room(0.30))`;
  const expr = sectionExpression(withDials);
  assert.ok(expr, "must stay embeddable (not fall to the stepper)");
  assert.match(expr!, /^stack\(/);
  assert.match(expr!, /\)\.lpf\(400\)\.room\(0\.30\)$/, "dials fold onto the stack tail");
  assert.ok(!expr!.includes("all("), "the all() wrapper is gone once folded");
  // and it composes into a real arrange() program
  const arr = buildArrangement([{ id: "p", code: withDials, seconds: 2 }]);
  assert.ok(arr, "a dialed section still builds one arrangement");
  assert.match(arr!.program, /arrange\(/);
});

test("sectionExpression: a single mix dial folds onto a lone-layer expression", () => {
  const expr = sectionExpression(`$: s("bd*4").orbit(1)
setcpm(120/4)
all(x => x.shape(0.20))`);
  assert.ok(expr);
  assert.doesNotMatch(expr!, /^stack\(/);
  assert.match(expr!, /\.shape\(0\.20\)$/);
});

test("sectionExpression still bails on a real statement after setcpm", () => {
  // The fold must recognise ONLY all(x => x.chain) — anything else is unknown
  // code and must drop to the stepper rather than be mis-embedded.
  assert.equal(
    sectionExpression(`$: s("bd*4")\nsetcpm(120/4)\nlet z = 1`),
    null,
  );
});

test("sectionExpression: single layer needs no stack, hydra block stripped", () => {
  const expr = sectionExpression(LOOP_B);
  assert.ok(expr);
  assert.doesNotMatch(expr!, /^stack\(/);
  assert.match(expr!, /s\("hh\*8"\)/);
  assert.ok(!expr!.includes("@hydra"));
});

test("sectionExpression rejects real statements (stepper fallback)", () => {
  assert.equal(sectionExpression(`let x = "c3"\n$: note(x)\nsetcpm(120/4)`), null);
  assert.equal(sectionExpression(`setcpm(120/4)`), null); // nothing to play
});

test("parseSetcpm reads the arg", () => {
  assert.equal(parseSetcpm(LOOP_A), "120/4");
  assert.equal(parseSetcpm(`setcpm( 90 )`), "90");
  assert.equal(parseSetcpm(`$: s("bd")`), null);
});

test("parseSetcpm honours the LAST setcpm — a stale baked line must not win", () => {
  // stored loop code can carry its own setcpm; transformForPlayback appends the
  // live-dial one at the END. evaluate() plays the last — so must the parser.
  const code = `setcpm(118/4)\n$: s("bd*4")\nsetcpm(127.44/4)`;
  assert.equal(parseSetcpm(code), "127.44/4");
});

test("buildArrangement composes spans on one tempo", () => {
  // 120/4 cpm = 30 cycles/min = 0.5 cps → a 4-bar loop = 8s
  const arr = buildArrangement([
    { id: "a", code: LOOP_A, seconds: 8 },
    { id: "b", code: LOOP_B, seconds: 16 },
  ]);
  assert.ok(arr);
  assert.equal(arr!.totalCycles, 12); // 4 + 8 cycles
  assert.deepEqual(
    arr!.spans.map((s) => [s.id, s.start, s.end]),
    [
      ["a", 0, 4],
      ["b", 4, 12],
    ],
  );
  assert.match(arr!.program, /^setcpm\(120\/4\)\narrange\(/);
  assert.match(arr!.program, /\[4, stack\(/);
  assert.match(arr!.program, /\[8, \(s\("hh\*8"\)/);
  assert.match(arr!.program, /@hydra/, "the song visual rides the program");
  // the final EXPRESSION must be the arrange (trailing comment is fine)
  const beforeHydra = arr!.program.split("/* @hydra")[0].trim();
  assert.match(beforeHydra, /\)$/);
});

test("buildArrangement refuses mixed tempos", () => {
  const arr = buildArrangement([
    { id: "a", code: LOOP_A, seconds: 8 },
    { id: "b", code: LOOP_B.replace("setcpm(120/4)", "setcpm(140/4)"), seconds: 8 },
  ]);
  assert.equal(arr, null);
});

test("layers ending in line comments cannot swallow the closing paren", () => {
  const expr = sectionExpression(
    `$: s("bd*4").gain(0.9) // punchy\n$: s("hh*8") // airy\nsetcpm(120/4)`,
  );
  assert.ok(expr);
  // the ) that closes each layer must sit on its own line, past the comment
  for (const layerLine of expr!.split("\n").filter((l) => l.includes("//")))
    assert.ok(!layerLine.trim().endsWith(")"), `comment swallowed a paren: ${layerLine}`);
  assert.doesNotThrow(() => new Function(`const stack = (...a)=>a, s = () => ({gain(){return this}});\nreturn ${expr}`));
});

test("multi-line muted layers drop entirely (continuation lines too)", () => {
  const expr = sectionExpression(
    `$: s("bd*4")\n_$: s("hh*8")\n  .gain(0.5)\n  .orbit(3)\nsetcpm(120/4)`,
  );
  assert.ok(expr, "continuations of a muted layer must not force the stepper");
  assert.ok(!expr!.includes("hh*8"));
  assert.ok(!expr!.includes("orbit(3)"));
});

test("nextUnit groups same-tempo runs, breaks at tempo changes", () => {
  const at = (bpm: number, id: string) => ({
    id,
    code: `$: s("bd*4")\nsetcpm(${bpm}/4)`,
    seconds: 8,
  });
  // song A (120) = loop+break+loop, song B (140) = loop — a set shape
  const list = [at(120, "a1"), at(120, "aBreak"), at(120, "a2"), at(140, "b1")];
  const u1 = nextUnit(list, 0);
  assert.ok(u1.arrangement, "same-tempo run must arrange");
  assert.deepEqual(
    u1.sections.map((s) => s.id),
    ["a1", "aBreak", "a2"],
  );
  const u2 = nextUnit(list, u1.sections.length);
  assert.ok(u2.arrangement);
  assert.deepEqual(
    u2.sections.map((s) => s.id),
    ["b1"],
  );
});

test("nextUnit isolates non-embeddable sections for the stepper", () => {
  const list = [
    { id: "weird", code: `let x = "c3"\n$: note(x)\nsetcpm(120/4)`, seconds: 8 },
    { id: "ok", code: `$: s("bd*4")\nsetcpm(120/4)`, seconds: 8 },
  ];
  const u = nextUnit(list, 0);
  assert.equal(u.arrangement, null);
  assert.deepEqual(
    u.sections.map((s) => s.id),
    ["weird"],
  );
  assert.ok(nextUnit(list, 1).arrangement, "the clean section still arranges");
});

// ── the arrangement spec renderer (moves / sweeps / overlays / ending) ──────

const PARTS3 = {
  layers: [`s("bd*4").gain(0.9)`, `s("hh*8")`, `note("c3 e3 g3 e3").s("sawtooth")`],
  mixTail: "",
};

test("sectionParts splits layers and carries the mix tail", () => {
  const p = sectionParts(`$: s("bd*4").orbit(1)
$: s("hh*8").orbit(2)
setcpm(120/4)
all(x => x.lpf(400))`);
  assert.ok(p);
  assert.equal(p!.layers.length, 2);
  assert.equal(p!.mixTail, ".lpf(400)");
});

test("sectionEntries: no spec → one whole-loop entry", () => {
  const segs = sectionEntries(PARTS3, 8, null);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].cycles, 8);
  assert.match(segs[0].expr, /^stack\(/);
});

test("sectionEntries: moves cut the span into layer subsets (silence = [])", () => {
  const segs = sectionEntries(PARTS3, 8, {
    moves: [
      { bar: 0, layers: [1] },
      { bar: 4, layers: [1, 2, 3] },
      { bar: 7, layers: [] },
    ],
  });
  assert.deepEqual(segs.map((s) => s.cycles), [4, 3, 1]);
  assert.ok(!segs[0].expr.includes("hh*8"), "hats wait until bar 4");
  assert.ok(segs[1].expr.includes("hh*8") && segs[1].expr.includes("sawtooth"));
  assert.equal(segs[2].expr, "silence", "an empty move is a bar of silence");
});

test("sectionEntries: moves authored for a different layer count are skipped", () => {
  const segs = sectionEntries(PARTS3, 8, { layerCount: 5, moves: [{ bar: 0, layers: [1] }] });
  assert.equal(segs.length, 1, "mismatched moves must not misfire — play the whole loop");
  assert.match(segs[0].expr, /hh\*8/);
});

test("sectionEntries: a sweep wraps its window and resumes phase across cuts", () => {
  const segs = sectionEntries(PARTS3, 8, {
    sweeps: [{ param: "lpf", from: 300, to: 2400, bar: 0, bars: 8 }],
    moves: [{ bar: 4, layers: [1, 2, 3] }],
  });
  assert.equal(segs.length, 2);
  assert.match(segs[0].expr, /\.lpf\(saw\.range\(300,2400\)\.slow\(8\)\)$/);
  assert.match(segs[1].expr, /\.lpf\(saw\.range\(300,2400\)\.slow\(8\)\.early\(4\)\)$/, "resume, not restart");
});

test("sectionEntries: sweeps with unsafe params are dropped", () => {
  const segs = sectionEntries(PARTS3, 4, {
    sweeps: [{ param: "lpf());alert(", from: 0, to: 1, bar: 0, bars: 4 }],
  });
  assert.equal(segs.length, 1);
  assert.ok(!segs[0].expr.includes("alert"));
});

test("sectionEntries: an overlay rides its window and continues across cuts", () => {
  const segs = sectionEntries(PARTS3, 8, {
    overlays: [{ bar: 4, bars: 4, code: `$: s("crash").slow(4)` }],
    moves: [{ bar: 6, layers: [1] }],
  });
  // cuts at 0,4,6,8 → three segments
  assert.deepEqual(segs.map((s) => s.cycles), [4, 2, 2]);
  assert.ok(!segs[0].expr.includes("crash"));
  assert.match(segs[1].expr, /s\("crash"\)\.slow\(4\)/);
  assert.doesNotMatch(segs[1].expr, /crash[^]*early/, "starts at its own time 0");
  assert.match(segs[2].expr, /crash[^]*\.early\(2\)/, "continues mid-gesture past the cut");
});

test("sectionEntries: overlays that aren't playable expressions are dropped", () => {
  const segs = sectionEntries(PARTS3, 4, {
    overlays: [
      { bar: 0, bars: 2, code: `setcpm(200/4)` },
      { bar: 0, bars: 2, code: `let x = 1` },
    ],
  });
  assert.equal(segs.length, 1);
  assert.ok(!segs[0].expr.includes("setcpm") && !segs[0].expr.includes("let x"));
});

test("buildArrangement: an arranged section keeps ONE span; arr.bars stretches it", () => {
  const arr = buildArrangement([
    {
      id: "a",
      code: LOOP_A,
      seconds: 8, // 4 natural bars at 0.5 cps
      arr: { bars: 16, moves: [{ bar: 0, layers: [1] }, { bar: 8, layers: [1, 2] }] },
    },
    { id: "b", code: LOOP_B, seconds: 16 },
  ]);
  assert.ok(arr);
  assert.deepEqual(
    arr!.spans.map((s) => [s.id, s.start, s.end, s.bars]),
    [
      ["a", 0, 16, 4],
      ["b", 16, 24, 8],
    ],
    "one span per section, natural bars preserved as the phrase unit",
  );
  assert.equal(arr!.totalCycles, 24);
  assert.equal(arr!.ends, false);
  assert.match(arr!.program, /\[8, /, "the arranged section is cut into segments");
});

test("buildArrangement: a user hold (explicit cycles) beats arr.bars", () => {
  const arr = buildArrangement([
    { id: "a", code: LOOP_A, seconds: 8, cycles: 6, arr: { bars: 32 } },
  ]);
  assert.ok(arr);
  assert.equal(arr!.totalCycles, 6);
});

test("buildArrangement: a stop ending appends the ring-out and flags ends", () => {
  const arr = buildArrangement(
    [{ id: "a", code: LOOP_A, seconds: 8 }],
    { ending: { mode: "stop", code: `$: s("crash").slow(2)`, bars: 2 } },
  );
  assert.ok(arr);
  assert.equal(arr!.ends, true);
  assert.equal(arr!.totalCycles, 6);
  assert.deepEqual(arr!.spans.map((s) => s.id), ["a", "__end"]);
  assert.match(arr!.program, /\[2, \(s\("crash"\)\.slow\(2\)/);
});

test("buildArrangement: a stop ending without code still ends (no tail span)", () => {
  const arr = buildArrangement([{ id: "a", code: LOOP_A, seconds: 8 }], {
    ending: { mode: "stop" },
  });
  assert.ok(arr);
  assert.equal(arr!.ends, true);
  assert.equal(arr!.totalCycles, 4);
});

test("nextUnit: the ending only applies to the unit that reaches the list's end", () => {
  const at = (bpm: number, id: string) => ({
    id,
    code: `$: s("bd*4")\nsetcpm(${bpm}/4)`,
    seconds: 8,
  });
  const list = [at(120, "a"), at(140, "b")];
  const ending = { mode: "stop" as const };
  const u1 = nextUnit(list, 0, { ending });
  assert.equal(u1.arrangement!.ends, false, "mid-set unit must not stop the walk");
  const u2 = nextUnit(list, 1, { ending });
  assert.equal(u2.arrangement!.ends, true);
});

// ── presence ⟷ moves (the unfold editor's math) ─────────────────────────────

test("presenceFromMoves mirrors the renderer's semantics", () => {
  const p = presenceFromMoves(
    [
      { bar: 2, layers: [1] },
      { bar: 4, layers: [1, 3] },
    ],
    3,
    6,
  );
  // before the first move ALL layers play; from bar 2 only layer 1; from bar 4 layers 1+3
  assert.deepEqual(
    p.map((r) => r.map((v) => (v ? 1 : 0)).join("")),
    ["111111", "110000", "110011"],
  );
});

test("presence → moves → presence round-trips exactly", () => {
  const presence = [
    [true, true, false, false, true, true],
    [false, false, true, true, true, true],
    [true, true, true, true, true, true],
  ];
  const moves = movesFromPresence(presence);
  assert.deepEqual(presenceFromMoves(moves, 3, 6), presence);
});

test("movesFromPresence: everything-on compresses to NO moves", () => {
  const presence = Array.from({ length: 4 }, () => Array(8).fill(true));
  assert.deepEqual(movesFromPresence(presence), []);
});

test("spanAtCycle maps and wraps", () => {
  const arr = buildArrangement([
    { id: "a", code: LOOP_A, seconds: 8 },
    { id: "b", code: LOOP_B, seconds: 16 },
  ])!;
  assert.equal(spanAtCycle(arr.spans, arr.totalCycles, 0)!.id, "a");
  assert.equal(spanAtCycle(arr.spans, arr.totalCycles, 3.9)!.id, "a");
  assert.equal(spanAtCycle(arr.spans, arr.totalCycles, 4)!.id, "b");
  assert.equal(spanAtCycle(arr.spans, arr.totalCycles, 12.5)!.id, "a"); // wrapped
});
