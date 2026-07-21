/**
 * Tests for the reverb-consolidation transform (lib/reverb-cap.ts).
 * Run: node_modules/.bin/esbuild lib/reverb-cap.test.ts --bundle --format=esm --platform=node --outfile=/tmp/rc.mjs && node --test /tmp/rc.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { capReverbs, reverbLayerCount } from "./reverb-cap";

const LOOP = `setcpm(142/4)
$: s("bd*4").gain(1.3)
$: s("bd*4").decay(0.4).room(0.5).roomsize(4).orbit(1)
$: note("e2").room(0.4).roomsize(3).orbit(3)
$: s("cr").room(0.45).roomsize(3).orbit(3)
$: s("perc").room(0.3).roomsize(2).orbit(4)
$: s("crackle").room(0.35).roomsize(2.5).orbit(5)`;

test("caps reverb-bearing layers to the strongest sends", () => {
  assert.equal(reverbLayerCount(LOOP), 5);
  const out = capReverbs(LOOP, 2);
  assert.equal(reverbLayerCount(out), 2);
  // the two strongest sends (0.5, 0.45) survive
  assert.ok(/s\("bd\*4"\)\.decay\(0\.4\)\.room\(0\.5\)/.test(out));
  assert.ok(/s\("cr"\)\.room\(0\.45\)/.test(out));
  // the weaker three are de-verbed
  assert.ok(!/note\("e2"\).*room/.test(out));
  assert.ok(!/s\("perc"\).*room/.test(out));
  assert.ok(!/s\("crackle"\).*room/.test(out));
});

test("de-verb strips the whole room family but keeps other calls + orbit", () => {
  const out = capReverbs(LOOP, 2);
  const percLine = out.split("\n").find((l) => l.includes('"perc"'))!;
  assert.ok(!percLine.includes("room"));
  assert.ok(percLine.includes(".orbit(4)")); // routing preserved
  assert.ok(percLine.includes('s("perc")'));
});

test("non-reverb layers and non-layer lines are untouched", () => {
  const out = capReverbs(LOOP, 2);
  assert.ok(out.includes("setcpm(142/4)"));
  assert.ok(out.includes('$: s("bd*4").gain(1.3)')); // the dry kick, unchanged
});

test("idempotent + no-op when already light", () => {
  const light = `setcpm(120/4)\n$: s("bd").room(0.5).roomsize(2)`;
  assert.equal(capReverbs(light, 2), light);
  const once = capReverbs(LOOP, 2);
  assert.equal(capReverbs(once, 2), once);
});

test("roomfade/roomlp variants also stripped", () => {
  const c = `$: s("a").room(0.9).roomsize(3).roomfade(0.5).roomlp(8000)
$: s("b").room(0.8).roomsize(2)
$: s("c").room(0.1).roomsize(1).roomfade(0.2)`;
  const out = capReverbs(c, 2);
  const cLine = out.split("\n").find((l) => l.includes('"c"'))!;
  assert.ok(!/room/.test(cLine));
});
