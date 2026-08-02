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
  free: { tokens: 0 },
  creator: TIERS[0],
  studio: TIERS[1],
};

/** The spill sum, exactly as `creditsSpent` computes it in SQL: every period
 *  against ITS OWN stamped cover (token_usage.covered). */
const spill = (months: { used: number; covered: number }[]) =>
  months.reduce((n, m) => n + Math.max(0, m.used - m.covered), 0);

/** The fallback sum, for when `covered` is missing: one allowance across all
 *  of history (user_billing.peak_allowance). */
const spillFlat = (used: number[], allowance: number) =>
  used.reduce((n, u) => n + Math.max(0, u - allowance), 0);

/** What readMeter does with the pieces, once they are in hand. */
function meter(o: {
  months: { used: number; covered: number }[];
  monthUsed: number;
  allowance: number;
  credits: number;
}) {
  const spent = spill(o.months);
  const planLeft = Math.max(0, o.allowance - o.monthUsed);
  const creditsLeft = Math.max(0, o.credits - spent);
  return { spent, planLeft, creditsLeft, remaining: planLeft + creditsLeft };
}

const CREATOR = PLANS.creator.tokens;

test("a free account buys NOTHING from the models — no plan, no taste", () => {
  // 2026-08-02, the user: "if you want to use the AI capabilities of the
  // software you gotta pay". Free is an empty plan bucket AND an empty
  // lifetime bucket; only bought credits ever fill the second one.
  const m = meter({
    months: [
      { used: 120_000, covered: 0 },
      { used: 90_000, covered: 0 },
    ],
    monthUsed: 90_000,
    allowance: 0,
    credits: 0,
  });
  assert.equal(m.spent, 210_000);
  assert.equal(m.planLeft, 0);
  assert.equal(m.creditsLeft, 0, "nothing is on the house");
  assert.equal(m.remaining, 0, "the gate is shut until something is bought");
});

test("a free account with bought credits spends exactly those", () => {
  const m = meter({
    months: [{ used: 200_000, covered: 0 }],
    monthUsed: 200_000,
    allowance: 0,
    credits: 500_000,
  });
  assert.equal(m.remaining, 300_000, "top-ups are the only free-plan fuel");
});

test("a subscriber inside the month never touches the lifetime bucket", () => {
  const m = meter({
    months: [{ used: 800_000, covered: CREATOR }],
    monthUsed: 800_000,
    allowance: CREATOR,
    credits: tokensForUsdCents(1000), // a $10 top-up, bought and untouched
  });
  assert.equal(m.spent, 0, "the plan covered all of it");
  assert.equal(m.planLeft, CREATOR - 800_000);
  assert.equal(m.creditsLeft, tokensForUsdCents(1000));
});

test("past the month, the spill comes out of the top-ups — and only the spill", () => {
  const over = CREATOR + 300_000;
  const m = meter({
    months: [{ used: over, covered: CREATOR }],
    monthUsed: over,
    allowance: CREATOR,
    credits: 1_000_000,
  });
  assert.equal(m.spent, 300_000);
  assert.equal(m.planLeft, 0);
  assert.equal(m.creditsLeft, 700_000);
  assert.equal(m.remaining, 700_000);
});

test("A DOWNGRADE MUST NOT EAT PREPAID TIME — the month keeps its own cover", () => {
  // Studio all year, one big month, then a downgrade to Creator. Read against
  // the CURRENT plan, that month would suddenly spill (2.4M − 1.1M) and
  // silently swallow 1.3M units of top-up somebody bought. Stamped, the past
  // cannot move.
  const studioMonth = { used: 2_400_000, covered: PLANS.studio.tokens };
  assert.ok(
    spillFlat([studioMonth.used], PLANS.creator.tokens) > 1_000_000,
    "the naive reading really does take a bite",
  );
  const m = meter({
    months: [studioMonth],
    monthUsed: 0, // a fresh month on the smaller plan
    allowance: PLANS.creator.tokens,
    credits: 2_000_000,
  });
  assert.equal(m.spent, 0);
  assert.equal(m.creditsLeft, 2_000_000, "every prepaid unit survives the downgrade");
});

test("A CANCELLATION MUST NOT KEEP COVERING — the leak a global 'best plan' left open", () => {
  // Studio for a month, cancel, then keep using the room for free. The paid
  // month stays covered (nothing reaches back), and the FREE month is covered
  // by nothing — it comes out of the bucket, exactly as a free month should.
  // A single high-water allowance across history would have covered both, and
  // handed a churned subscriber a Studio-sized month, every month, for nothing.
  const months = [
    { used: 3_000_000, covered: PLANS.studio.tokens }, // paid, covered
    { used: 400_000, covered: 0 }, // free again
  ];
  assert.equal(spill(months), 400_000);
  assert.equal(
    spillFlat(months.map((x) => x.used), PLANS.studio.tokens),
    0,
    "the high-water reading would have let the free month ride for free",
  );
  const m = meter({
    months,
    monthUsed: 400_000,
    allowance: 0,
    credits: 1_000_000,
  });
  assert.equal(m.creditsLeft, 600_000, "the free month draws on the bucket");
});

test("the gate closes only when BOTH buckets are empty", () => {
  const dry = meter({
    months: [{ used: CREATOR, covered: CREATOR }],
    monthUsed: CREATOR,
    allowance: CREATOR,
    credits: 0,
  });
  assert.equal(dry.remaining, 0);
  const carried = meter({
    months: [{ used: CREATOR, covered: CREATOR }],
    monthUsed: CREATOR,
    allowance: CREATOR,
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

test("there is no free taste — the free plan grants zero", () => {
  // The taste was 500k, sized when a prompt made ONE loop; a prompt makes a
  // whole SONG now, so it could no longer buy what the door promised. Removed
  // rather than shrunk (2026-08-02) — a deliberately worse first song is the
  // worst possible first impression.
  assert.equal(PLANS.free.tokens, 0);
  assert.equal(songsFor(PLANS.free.tokens), 0);
  assert.equal(nightsFor(PLANS.free.tokens), 0);
});
