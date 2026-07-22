/**
 * PRICING CONSTANTS — client-safe (no imports; lib/billing.ts re-exports
 * these for the server side). The whole price sheet lives here, stated once,
 * shown everywhere: the price is a public number in open code.
 */

/**
 * THE RATE: dollars per 1M weighted units — anchored today to Fable 5's
 * $10/1M input rate; the usage weights (output ×5, cache ×0.1/×1.25 —
 * lib/llm.ts) normalize every other token kind to it. $1 = 100k units.
 * If the model or the pricing changes, change THIS constant and the /open
 * page together — the promise is a price you can READ, right here.
 */
export const USD_CENTS_PER_MILLION = 1_000;

/**
 * Loops are the friendly ESTIMATE unit — "~30k weighted units buys a loop"
 * (measured p50 28k, rounded up so people land a loop ABOVE the estimate,
 * never below). Since the open-source pivot this is no longer a disguise for
 * the $/M rate: the rate is public, token counts are shown next to loops.
 */
export const TOKENS_PER_LOOP = 30_000;

/** Whole loops a token allowance buys (floored — under-promise). */
export function loopsFor(tokens: number): number {
  return Math.floor(tokens / TOKENS_PER_LOOP);
}

/** Tokens a payment buys — $1 = 100k weighted units, exact. */
export function tokensForUsdCents(usdCents: number): number {
  return Math.round((usdCents / USD_CENTS_PER_MILLION) * 1_000_000);
}

/** The purchasable top-up amounts (USD, token value — the card fee is added
 *  on top at checkout). Flat rate — no bulk games; the $5 floor keeps the
 *  fixed part of the card fee from dwarfing the purchase. */
export const CREDIT_PACK_USD = [5, 10, 25, 50] as const;

/**
 * CARD PROCESSING PASS-THROUGH — the card fee is Stripe's, not ours.
 * Stripe's standard rate (2.9% + 30¢) is charged on the TOTAL, so the total
 * grosses up: T = (cost + fixed) / (1 − pct), ceiled to the next cent so
 * rounding can never make a sale net negative. The fee line is shown before
 * checkout and itemized inside it — no markup hides in the fee. (Stripe
 * charges more for some international cards; that sliver is on us until it
 * ever matters.)
 */
export const CARD_FEE_PCT = 0.029;
export const CARD_FEE_FIXED_CENTS = 30;

/** Total to charge so that (total − Stripe's fee) = costCents, exactly. */
export function totalWithCardFeeCents(costCents: number): number {
  return Math.ceil((costCents + CARD_FEE_FIXED_CENTS) / (1 - CARD_FEE_PCT));
}

/** The card-fee line item for a given token cost. */
export function cardFeeCents(costCents: number): number {
  return totalWithCardFeeCents(costCents) - costCents;
}
