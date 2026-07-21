/**
 * Tests for the deterministic orbit plumbing (lib/reverb-orbits.ts) — the
 * sidechain WIRING above all: targets moved to fresh orbits, duck args
 * rewritten to exactly those, depth defaulted, drums-only ducks dropped.
 * Run: node_modules/.bin/esbuild lib/reverb-orbits.test.ts --bundle --format=esm --platform=node --outfile=/tmp/ro.mjs && node --test /tmp/ro.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignReverbOrbits,
  rebusArrangement,
  sanitizeDuckTargets,
  stripDuckFamily,
  wireSidechain,
} from "./reverb-orbits";

const KICK = `$: s("bd*4").bank("RolandTR909").duck(1).gain(1.1)`;
const BASS = `$: note("<d1 c1>").s("sawtooth").lpf(200)`;
const PAD = `$: note("[d3,a3,f4]").s("sawtooth").room(.7).roomsize(6)`;
const HATS = `$: s("hh*8").bank("RolandTR909").hpf(7000)`;

test("wireSidechain moves tonal targets to fresh orbits and aims the duck at them", () => {
  const code = `setcpm(120/4)\n${KICK}\n${BASS}\n${PAD}\n${HATS}`;
  const out = wireSidechain(code);
  // bass and pad differ in effect signature → two fresh orbits (2 and 3)
  const bass = out.split("\n").find((l) => l.includes("<d1 c1>"))!;
  const pad = out.split("\n").find((l) => l.includes("roomsize"))!;
  const hats = out.split("\n").find((l) => l.includes("hh*8"))!;
  const kick = out.split("\n").find((l) => l.includes("bd*4"))!;
  assert.match(bass, /\.orbit\(2\)/);
  assert.match(pad, /\.orbit\(3\)/);
  assert.ok(!/\.orbit\(/.test(hats), "percussion stays on the default bus");
  assert.match(kick, /\.duck\("2:3"\)/);
  // engine default depth of 1 pumps to silence — an unset depth gets .6
  assert.match(kick, /\.duckdepth\(\.6\)/);
});

test("wireSidechain groups same-signature targets on one orbit and keeps a written depth", () => {
  const code = `setcpm(120/4)\n$: s("bd*4").duck(1).duckdepth(.4)\n${BASS}\n$: note("a2 c3").s("square").lpf(600)`;
  const out = wireSidechain(code);
  // both tonal layers are dry (same empty signature) → they share orbit 2
  assert.equal((out.match(/\.orbit\(2\)/g) ?? []).length, 2);
  assert.match(out, /\.duck\("2"\)/);
  assert.match(out, /\.duckdepth\(\.4\)/);
  assert.ok(!/\.duckdepth\(\.6\)/.test(out));
});

test("wireSidechain rewrites a misused bare-amount duck arg", () => {
  const code = `setcpm(120/4)\n$: s("bd*4").duck(0.8)\n${BASS}`;
  const out = wireSidechain(code);
  assert.match(out, /\.duck\("2"\)/);
  assert.ok(!out.includes("duck(0.8)"));
});

test("wireSidechain drops the duck family when there is nothing tonal to pump", () => {
  const code = `setcpm(120/4)\n$: s("bd*4").duck(1).duckattack(.1)\n${HATS}`;
  const out = wireSidechain(code);
  assert.ok(!/\.duck/.test(out));
});

test("wireSidechain leaves duck-free code byte-identical", () => {
  const code = `setcpm(120/4)\n${BASS}\n${HATS}`;
  assert.equal(wireSidechain(code), code);
});

test("sanitizeDuckTargets grounds duckorbit too and keeps only real orbits", () => {
  const code = `$: s("bd*4").duckorbit("2:9")\n$: note("c3").s("sine").orbit(2)`;
  const out = sanitizeDuckTargets(code);
  assert.match(out, /\.duck\("2"\)/);
  assert.ok(!out.includes("9"));
});

test("stripDuckFamily removes every duck control", () => {
  const code = `$: s("bd*4").duck(1).duckdepth(.5).duckattack(.1).gain(1)`;
  assert.equal(stripDuckFamily(code), `$: s("bd*4").gain(1)`);
});

test("assignReverbOrbits sees the .size() alias (the clicking-violin bug)", () => {
  const code = [
    "setcpm(68/4)",
    '$: note("d2").s("gtr").room(0.35).size(3).pan(0.45)',
    '$: note("a4").s("vln").room(0.5).size(4).pan(0.6)',
    '$: note("d1").s("bass").room(0.2).size(2)',
    '$: s("bd").room(0.3).size(2)',
  ].join("\n");
  const out = assignReverbOrbits(code);
  const orbits = [...out.matchAll(/\.orbit\((\d)\)/g)].map((m) => m[1]);
  // three distinct sizes → three orbits; the two size-2 layers share one
  assert.equal(orbits.length, 4);
  assert.equal(new Set(orbits).size, 3);
  assert.equal(orbits[2], orbits[3]);
});

test("assignReverbOrbits never writes inside trailing comment blocks", () => {
  const code = [
    "setcpm(60/4)",
    '$: note("a4").s("vln").room(0.5).size(4)',
    '$: s("bd").room(0.3).size(2)',
    "",
    "/* @hydra",
    "osc(5, 0, 1.4)",
    "  .saturate(1).out()",
    "*/",
  ].join("\n");
  const out = assignReverbOrbits(code);
  assert.ok(/\.size\(2\)\.orbit\(2\)/.test(out), "orbit appended to the layer chain");
  assert.ok(!/out\(\)\.orbit/.test(out), "hydra block untouched");
});

test("rebusArrangement: one signature = one bus across the whole song", () => {
  const a = [
    "setcpm(60/4)",
    '$: note("a4").s("pad").room(0.5).size(7).orbit(1)',
    '$: s("bd").room(0.3).size(2).orbit(2).duck("1")',
  ].join("\n");
  const b = [
    "setcpm(60/4)",
    '$: note("e2").s("bass").room(0.2).size(3).orbit(1)', // same orbit, DIFFERENT size
    '$: note("c5").s("bells").room(0.6).size(7).orbit(2)', // size 7 again — must join section A's bus
  ].join("\n");
  const [ra, rb] = rebusArrangement([a, b]);
  const orbOf = (code: string, needle: string) => {
    const line = code.split("\n").find((l: string) => l.includes(needle));
    return line?.match(/\.orbit\((\d+)\)/)?.[1];
  };
  assert.equal(orbOf(ra, "pad"), orbOf(rb, "bells")); // size 7 shares one bus
  assert.notEqual(orbOf(rb, "bass"), orbOf(ra, "pad")); // size 3 ≠ size 7
  assert.notEqual(orbOf(ra, "bd"), orbOf(ra, "pad"));
  // the sidechain still ducks the pad, on its NEW bus
  assert.ok(ra.includes(`.duck("${orbOf(ra, "pad")}")`), "duck target remapped");
  // idempotent
  assert.deepEqual(rebusArrangement([ra, rb]), [ra, rb]);
});

