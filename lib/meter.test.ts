/**
 * Tests for the subscription meter's arithmetic (lib/billing readMeter's two
 * buckets, via the pure pieces it is built from).
 *
 * This is the one file in the repo whose failure mode is somebody's money: too
 * generous and the house eats it silently, too mean and we take machine time a
 * customer already paid for. So the properties are pinned rather than trusted —
 * especially the one that is easy to get wrong, that a plan CHANGE must never
 * retroactively consume prepaid top-ups.
 * Run: tsx --test lib/meter.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_TASTE_TOKENS,
  nightsFor,
  songsFor,
  TIERS,
  TOKENS_PER_NIGHT,
  TOKENS_PER_SONG,
  tokensForUsdCents,
} from "./pricing";

// The whole price sheet lives in lib/pricing (client-safe, no database), and
// lib/billing's PLANS is that sheet SPREAD — `creator: {...TIERS[0], priceId}`
// — so testing the sheet tests what the gate meters against. Importing
// lib/billing here is not possible on purpose: it speaks to Postgres.
const PLANS = {
  free: { tokens: FREE_TASTE_TOKENS },
  creator: TIERS[0],
  studio: TIERS[1],
};

/** The spill sum, exactly as `creditsSpent` computes it in SQL:
 *  Σ over periods of max(0, that period's usage − the monthly allowance). */
const spill = (periods: number[], allowance: number) =>
  periods.reduce((n, used) => n + Math.max(0, used - allowance), 0);

/** What readMeter does with the pieces, once they are in hand. */
function meter(o: {
  periods: number[];
  monthUsed: number;
  allowance: number;
  peak: number;
  taste: number;
  credits: number;
}) {
  const spent = spill(o.periods, o.peak);
  const planLeft = Math.max(0, o.allowance - o.monthUsed);
  const creditsLeft = Math.max(0, o.taste + o.credits - spent);
  return { spent, planLeft, creditsLeft, remaining: planLeft + creditsLeft };
}

const CREATOR = PLANS.creator.tokens;
const TASTE = PLANS.free.tokens;

test("a free account is just an empty plan bucket — the old prepaid arithmetic, unchanged", () => {
  // No plan → allowance 0 → spill IS lifetime usage, which is exactly how the
  // prepaid meter behaved before the pivot.
  const m = meter({
    periods: [120_000, 90_000],
    monthUsed: 90_000,
    allowance: 0,
    peak: 0,
    taste: TASTE,
    credits: 0,
  });
  assert.equal(m.spent, 210_000);
  assert.equal(m.planLeft, 0);
  assert.equal(m.creditsLeft, TASTE - 210_000);
  assert.equal(m.remaining, TASTE - 210_000);
});

test("a subscriber inside the month never touches the lifetime bucket", () => {
  const m = meter({
    periods: [800_000],
    monthUsed: 800_000,
    allowance: CREATOR,
    peak: CREATOR,
    taste: TASTE,
    credits: tokensForUsdCents(1000), // a $10 top-up, bought and untouched
  });
  assert.equal(m.spent, 0, "the plan covered all of it");
  assert.equal(m.planLeft, CREATOR - 800_000);
  assert.equal(m.creditsLeft, TASTE + tokensForUsdCents(1000));
});

test("past the month, the spill comes out of the top-ups — and only the spill", () => {
  const over = CREATOR + 300_000;
  const m = meter({
    periods: [over],
    monthUsed: over,
    allowance: CREATOR,
    peak: CREATOR,
    taste: 0,
    credits: 1_000_000,
  });
  assert.equal(m.spent, 300_000);
  assert.equal(m.planLeft, 0);
  assert.equal(m.creditsLeft, 700_000);
  assert.equal(m.remaining, 700_000);
});

test("A DOWNGRADE MUST NOT EAT PREPAID TIME — this is what peak_allowance is for", () => {
  // Studio all year, one big month, then a downgrade to Creator. Computed
  // against the CURRENT plan that month would suddenly spill (2.4M − 1.1M) and
  // silently swallow 1.3M units of top-up somebody bought. Against the PEAK it
  // spills nothing, because nothing about the past changed.
  const periods = [2_400_000];
  const naive = spill(periods, PLANS.creator.tokens);
  const withPeak = spill(periods, PLANS.studio.tokens);
  assert.ok(naive > 1_000_000, "the naive reading really does take a bite");
  assert.equal(withPeak, 0);
  const m = meter({
    periods,
    monthUsed: 0, // a fresh month on the smaller plan
    allowance: PLANS.creator.tokens,
    peak: PLANS.studio.tokens,
    taste: 0,
    credits: 2_000_000,
  });
  assert.equal(m.creditsLeft, 2_000_000, "every prepaid unit survives the downgrade");
});

test("the gate closes only when BOTH buckets are empty", () => {
  const dry = meter({
    periods: [CREATOR],
    monthUsed: CREATOR,
    allowance: CREATOR,
    peak: CREATOR,
    taste: 0,
    credits: 0,
  });
  assert.equal(dry.remaining, 0);
  const carried = meter({
    periods: [CREATOR],
    monthUsed: CREATOR,
    allowance: CREATOR,
    peak: CREATOR,
    taste: 0,
    credits: 500_000,
  });
  assert.equal(carried.remaining, 500_000, "a top-up carries you to the 1st");
});

test("a tier can never print a promise its own allowance cannot pay", () => {
  for (const t of TIERS) {
    assert.ok(
      songsFor(t.tokens) * TOKENS_PER_SONG <= t.tokens,
      `${t.id}: songs over-promised`,
    );
    assert.ok(
      nightsFor(t.tokens) * TOKENS_PER_NIGHT <= t.tokens,
      `${t.id}: nights over-promised`,
    );
    assert.ok(songsFor(t.tokens) >= 1 && nightsFor(t.tokens) >= 1, `${t.id}: buys nothing`);
    assert.ok(t.usd > 0 && t.tokens > 0);
  }
});

test("the free taste is worth a song and a night — the sentence the door says", () => {
  // SIGNUP_GIFT promises "your first song — and a night in the room". If the
  // taste is ever trimmed below that, the door starts lying.
  assert.ok(songsFor(PLANS.free.tokens) >= 1);
  assert.ok(nightsFor(PLANS.free.tokens) >= 1);
});
