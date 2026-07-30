/**
 * ON THE BAR — the quantize wait's arithmetic (lib/strudel-client.msToNextCycle).
 *
 * The function reads the live scheduler clock, so the maths is tested here
 * against an injected cycle position rather than the engine: the shape of the
 * answer is what matters, and every branch of it is a live-set failure mode.
 * "Go now" (0) is the safe answer everywhere — a change that never lands is
 * infinitely worse than one that lands a hair early.
 *
 * Run: npm test (tsx --test lib/*.test.ts)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

/** The exact body of msToNextCycle, with the clock as a parameter. Kept in step
 *  with lib/strudel-client.ts — the guard below fails if that copy drifts. */
function msToNextCycle(cps: number, cycle: number): number {
  if (!(cps > 0)) return 0;
  if (!(cycle > 0)) return 0;
  const remaining = Math.ceil(cycle) - cycle;
  const ms = (remaining / cps) * 1000;
  if (!Number.isFinite(ms) || ms < 55) return 0;
  return Math.min(ms, 1000 / cps);
}

// 122 BPM in 4/4 => 30.5 bars/min => ~0.5083 cycles/sec => a bar is ~1967ms.
const CPS = 122 / 4 / 60;
const BAR_MS = 1000 / CPS;

test("waits the remaining slice of the bar", () => {
  // A quarter of the way in => three quarters of a bar left.
  const ms = msToNextCycle(CPS, 8.25);
  assert.ok(Math.abs(ms - BAR_MS * 0.75) < 1, `${ms} vs ${BAR_MS * 0.75}`);
});

test("never waits longer than one bar", () => {
  for (const cycle of [0.001, 1.0001, 7.5, 99.999]) {
    const ms = msToNextCycle(CPS, cycle);
    assert.ok(ms <= BAR_MS + 1e-9, `cycle ${cycle} asked for ${ms}ms`);
  }
});

test("a downbeat already under the hands is 'go now', not a whole bar of silence", () => {
  // 20ms short of the line: waiting costs more latency than it buys tightness,
  // and rounding up to the NEXT bar would be a ~2s hole in the set.
  const nearlyThere = 9 - (0.02 / 1000) * CPS * 1000;
  assert.equal(msToNextCycle(CPS, nearlyThere), 0);
  // exactly on the line
  assert.equal(msToNextCycle(CPS, 9), 0);
});

test("refuses to wait when waiting would be a lie", () => {
  assert.equal(msToNextCycle(0, 4.5), 0, "no tempo");
  assert.equal(msToNextCycle(-1, 4.5), 0, "impossible tempo");
  assert.equal(msToNextCycle(NaN, 4.5), 0, "unparsed setcpm");
  assert.equal(msToNextCycle(CPS, 0), 0, "nothing playing — the send IS the downbeat");
  assert.equal(msToNextCycle(CPS, NaN), 0, "clock unreadable");
});

test("a very fast room still quantizes without stalling", () => {
  // 480 BPM in 4/4 => a bar is 500ms; half a bar left is still worth waiting for.
  const fast = 480 / 4 / 60;
  const ms = msToNextCycle(fast, 3.5);
  assert.ok(ms > 55 && ms <= 500, `${ms}`);
});

test("the copy here still matches lib/strudel-client.ts", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./strudel-client.ts", import.meta.url), "utf8");
  const body = src.slice(
    src.indexOf("export function msToNextCycle"),
    src.indexOf("function audioContext()"),
  );
  // The five decisions this test pins, each present in the shipped function.
  for (const needle of [
    "if (!(cps > 0)) return 0;",
    "Math.ceil(cycle) - cycle",
    "(remaining / cps) * 1000",
    "ms < 55",
    "Math.min(ms, 1000 / cps)",
  ])
    assert.ok(body.includes(needle), `shipped msToNextCycle no longer has: ${needle}`);
});
