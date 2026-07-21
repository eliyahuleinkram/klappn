/**
 * Tests for the arrangement composer's pure helpers (lib/arrange-plan.ts) and
 * the unfold-follows-the-layers math (lib/arrange.ts remapMoves + the muted-
 * layer silence placeholder + the seek shift).
 * Run: node_modules/.bin/esbuild lib/arrange-plan.test.ts --bundle --format=esm --platform=node --outfile=/tmp/arp.mjs && node --test /tmp/arp.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanFeel,
  parseArrangementReply,
  sanitizeNextChapter,
  sanitizeSweepControls,
  sanitizeNextFx,
  sanitizeUnfoldFx,
} from "./arrange-plan";
import { buildArrangement, remapMoves, sectionParts } from "./arrange";

test("cleanFeel sentence-cases and trims", () => {
  assert.equal(cleanFeel("swelling from the dark"), "Swelling from the dark");
  assert.equal(cleanFeel("  Filter Opens Up  "), "Filter opens up");
  assert.equal(cleanFeel(""), undefined);
  assert.equal(cleanFeel(42), undefined);
});

test("parseArrangementReply parses sections + moves", () => {
  const parsed = parseArrangementReply(
    `{"sections":{"a":{"bars":16,"moves":[{"bar":0,"layers":[1]}]}}}`,
  );
  assert.ok(parsed?.sections?.a);
  assert.equal(parsed!.sections!.a.bars, 16);
});

test("remapMoves re-points around a deleted layer", () => {
  // 3 layers, delete layer 2 (0-based index 1) → mapping [0, 2]
  const moves = [
    { bar: 0, layers: [1, 2] },
    { bar: 4, layers: [1, 2, 3] },
  ];
  assert.deepEqual(remapMoves(moves, [0, 2]), [
    { bar: 0, layers: [1] },
    { bar: 4, layers: [1, 2] },
  ]);
});

test("remapMoves lets brand-new layers play THROUGH", () => {
  // 2 old layers + 1 appended new (null) → new layer joins every move
  const moves = [{ bar: 2, layers: [2] }];
  assert.deepEqual(remapMoves(moves, [0, 1, null]), [{ bar: 2, layers: [2, 3] }]);
});

test("sectionParts keeps a muted layer's slot as silence (indices stable)", () => {
  const code = `$: s("bd*4")\n_$: s("hh*8")\n$: note("c3").s("sawtooth")\nsetcpm(120/4)`;
  const parts = sectionParts(code);
  assert.ok(parts);
  assert.equal(parts!.layers.length, 3);
  assert.equal(parts!.layers[1], "silence");
  assert.match(parts!.layers[2], /sawtooth/);
});

test("sanitizeSweepControls keeps clean knobs, widens to contain the value", () => {
  const w = { param: "lpf", from: 500, to: 3000, bar: 0, bars: 16 };
  const out = sanitizeSweepControls(
    [
      { name: "darkness floor", field: "from", min: 900, max: 1200 }, // widened: 500 inside
      { name: "Bloom", field: "to", min: 800, max: 8000 },
      { name: "dupe", field: "to", min: 0, max: 1 }, // second "to" dropped
      { name: "junk", field: "sideways", min: 0, max: 1 }, // bad field dropped
      { name: "", field: "from", min: 0, max: 1 }, // no name dropped
    ],
    w,
  );
  assert.deepEqual(out, [
    { name: "Darkness floor", field: "from", min: 500, max: 1200 },
    { name: "Bloom", field: "to", min: 800, max: 8000 },
  ]);
  // inverted / non-finite ranges vanish entirely
  assert.deepEqual(
    sanitizeSweepControls([{ name: "X", field: "to", min: 5, max: 5 }], w),
    [],
  );
});

test("buildArrangement song effects glide across sections with resumed phase", () => {
  const code = `$: s("bd*4")\nsetcpm(120/4)`;
  const a = buildArrangement(
    [
      { id: "one", code, seconds: 8 },
      { id: "two", code, seconds: 8 },
      { id: "three", code, seconds: 8 },
    ],
    {
      effects: [
        {
          id: "fx1",
          param: "lpf",
          from: 200,
          to: 4000,
          fromId: "one",
          toId: "two",
        },
      ],
    },
  );
  assert.ok(a);
  // spans one+two = 8 cycles total: first entry wraps at phase 0, second
  // resumes with .early(4); the third section stays untouched.
  const entries = a!.program.split("\n[");
  assert.match(a!.program, /lpf\(saw\.range\(200,4000\)\.slow\(8\)\)/);
  assert.match(a!.program, /lpf\(saw\.range\(200,4000\)\.slow\(8\)\.early\(4\)\)/);
  assert.equal((a!.program.match(/lpf\(saw/g) ?? []).length, 2);
  void entries;
  // an effect naming an unknown part is skipped whole
  const b = buildArrangement([{ id: "one", code, seconds: 8 }], {
    effects: [
      { id: "x", param: "lpf", from: 1, to: 2, fromId: "one", toId: "ghost" },
    ],
  });
  assert.ok(!/lpf/.test(b!.program));
});

test("buildArrangement lateCycles rotates the program with .late(n)", () => {
  const code = `$: s("bd*4")\nsetcpm(120/4)`;
  const a = buildArrangement(
    [{ id: "x", code, seconds: 8 }],
    { lateCycles: 3 },
  );
  assert.ok(a);
  assert.match(a!.program, /\.late\(3\)$/);
  // normalized into [0,total): shifting by total is a no-op
  const b = buildArrangement([{ id: "x", code, seconds: 8 }], { lateCycles: 4 });
  assert.ok(!/late/.test(b!.program));
});

test("sanitizeUnfoldFx clamps loop ranges and drops junk", () => {
  const out = sanitizeUnfoldFx(
    {
      effects: [
        { name: "swelling from the dark", param: "lpf", from: 200, to: 4000, curve: "sine", fromLoop: 1, toLoop: 3 },
        { param: "gain", from: 0.4, to: 1, fromLoop: 9, toLoop: 1 }, // clamps into range
        { param: "not a param!", from: 1, to: 2, fromLoop: 1, toLoop: 1 }, // dropped
      ],
    },
    3,
  );
  assert.equal(out.length, 2);
  assert.deepEqual(
    { from: out[0].fromLoop, to: out[0].toLoop, name: out[0].name },
    { from: 1, to: 3, name: "Swelling from the dark" },
  );
  assert.deepEqual({ from: out[1].fromLoop, to: out[1].toLoop }, { from: 3, to: 3 });
  assert.deepEqual(sanitizeUnfoldFx(null, 3), []);
});

test("sanitizeNextFx: one glide, done, or null", () => {
  const fx = sanitizeNextFx(
    { name: "opening sky", param: "lpf", from: 300, to: 9000, curve: "linear", fromLoop: 2, toLoop: 9 },
    4,
  );
  assert.ok(fx && fx !== "done");
  assert.deepEqual(
    { param: fx.param, fromLoop: fx.fromLoop, toLoop: fx.toLoop },
    { param: "lpf", fromLoop: 2, toLoop: 4 }, // clamped into range
  );
  assert.equal(sanitizeNextFx({ done: true }, 4), "done");
  assert.equal(sanitizeNextFx({ param: "not a param!", from: 1, to: 2, fromLoop: 1, toLoop: 1 }, 4), null);
  assert.equal(sanitizeNextFx(null, 4), null);
});

test("sanitizeNextChapter keeps in-subset variations and drops junk", () => {
  const out = sanitizeNextChapter(
    {
      name: "bass finds its voice",
      layers: [1, 3],
      vary: {
        "3": '$: note("<c2 g1>").s("sawtooth").lpf(400)',
        "2": '$: s("hh*8")', // not in the subset — dropped
        "1": "setcpm(200)", // smuggled tempo — dropped
      },
    },
    4,
    1,
  );
  assert.ok(out && out !== "done");
  const ch = out as Exclude<typeof out, "done" | null>;
  assert.deepEqual(ch.layers, [1, 3]);
  assert.deepEqual(Object.keys(ch.vary ?? {}), ["3"]);
  assert.equal(sanitizeNextChapter({ done: true }, 4, 1), "done");
});
