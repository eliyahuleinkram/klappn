/**
 * PRICING CONSTANTS — client-safe (no imports; lib/billing.ts re-exports
 * these for the server side). The whole price sheet lives here, stated once,
 * shown everywhere: the price is a public number in open code.
 */

/**
 * THE RATE: dollars per 1M weighted units — REPRICED 2026-07-26 to track the
 * composer's own input rate (Opus 5: $5/1M — the ANCHOR). A weighted unit
 * tracks real model spend 1:1 across EVERY model we run: lib/llm.ts normalizes
 * each token kind (output ×5, cache read ×0.1, cache write ×1.25 at 5m and ×2
 * at 1h — Anthropic's uniform ratios) and then scales by the served model's own
 * rate over the anchor (MODEL_INPUT_USD_PER_MILLION → modelCostFactor: Opus 5
 * ×1, Fable 5 ×2, Sonnet 5 ×0.4 while its intro rate runs and ×0.6 after,
 * Haiku ×0.2), so a call that cost less bills less. THE RULE, plainly: a
 * customer's dollar buys a dollar of our spend, whichever model answered.
 * $1 = 200k units. The card fee is itemized separately at checkout and passed
 * through to the cent, so a top-up nets exactly its token value. If a model or
 * its pricing moves, move THIS constant (anchor) or that model's rate in
 * lib/llm.ts with it — the promise is a price you can READ, right here, that
 * follows what the machine actually costs.
 * (History: launched at $10/1M when Fable 5 — $10/1M input — was the composer;
 * halved when Opus 5 took over rather than pocketing the difference.)
 */
export const USD_CENTS_PER_MILLION = 500;

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

/**
 * WHAT A MONTH BUYS — the units the price page speaks since the subscription
 * pivot (2026-08-02). A plan should be readable without arithmetic: songs and
 * nights, with the token number still printed underneath for anyone who wants
 * to check it.
 *
 * Both are honest ESTIMATES, floored so a plan always delivers at least what
 * it promised, and both are derived from measured shapes rather than wishes:
 *
 *  · a SONG is its sections — five is the common shape, each one a loop at
 *    TOKENS_PER_LOOP (measured p50 28k, rounded up).
 *  · a NIGHT IN THE ROOM is a real live-coding session: ~100 whispers at
 *    TOKENS_PER_GHOST plus ~20 turns of conversation (~4.3k each warm, the
 *    measured shape — the first turn of a session costs more because it writes
 *    the cache, and that is inside the rounding).
 *
 * If either shape moves, move it HERE — the page, the tier grid and the meter
 * all read these, so they can never disagree with each other.
 */
export const LOOPS_PER_SONG = 5;
export const TOKENS_PER_SONG = TOKENS_PER_LOOP * LOOPS_PER_SONG; // 150k
export const TOKENS_PER_NIGHT = 350_000;

/** Whole songs an allowance buys (floored). */
export function songsFor(tokens: number): number {
  return Math.floor(tokens / TOKENS_PER_SONG);
}

/** Whole nights in the room an allowance buys (floored). */
export function nightsFor(tokens: number): number {
  return Math.floor(tokens / TOKENS_PER_NIGHT);
}

/**
 * The IDE copilot's friendly estimate — "~2.5k weighted units buys a ghost".
 * Ghosts run OPUS 5 no-thinking (2026-07-27 quality call) and units bill at
 * the served model's own rate (Opus 5 = the anchor, ×1). MEASURED live
 * 2026-07-27 on the same prompt shape: a warm multi-line ghost = ~13.8k cache
 * read ×0.1 + ~250 write ×1.25 + ~140 out ×5 ≈ 2.0–2.4k weighted — rounded UP
 * like TOKENS_PER_LOOP so the meter under-promises, never over. The IDE
 * speaks ghosts, not loops — a completion stays ~10× cheaper than a loop.
 */
export const TOKENS_PER_GHOST = 2_500;

/** Tokens a payment buys — at $5/1M, $1 = 200k weighted units, exact. */
export function tokensForUsdCents(usdCents: number): number {
  return Math.round((usdCents / USD_CENTS_PER_MILLION) * 1_000_000);
}

/**
 * THE SHELF (2026-08-02, the subscription pivot) — client-safe, so the price
 * page, the tier grid and the meter all read the SAME row. lib/billing.ts
 * builds PLANS from this and adds the Stripe price ids from the environment;
 * nothing about a price is ever typed twice.
 *
 * `tokens` is the monthly allowance in the same weighted units everything else
 * is metered in, so what a tier buys can be DERIVED (songsFor / nightsFor) and
 * can never drift from what the gate actually allows.
 */
export const TIERS = [
  {
    id: "creator",
    name: "Creator",
    usd: 12,
    tokens: 1_100_000,
    blurb: "a song a week, and the room on the nights you want it.",
  },
  {
    id: "studio",
    name: "Studio",
    usd: 39,
    tokens: 3_500_000,
    blurb: "live in it — an EP a month, and the room whenever.",
  },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

/**
 * NO FREE TASTE (2026-08-02, the user: "Remove tastes. Remove that entire
 * concept… If you want to use the AI capabilities of the software you gotta
 * pay").
 *
 * There was a 500k sign-up taste, sized when a prompt made ONE loop. A prompt
 * makes a whole SONG now — roughly five times that — so the taste could no
 * longer buy the thing the door promises, and the only ways out were to shrink
 * what a taste generates (a deliberately worse first song, which is the worst
 * possible first impression) or to raise it (a launch bill with no ceiling).
 * Neither is worth keeping a concept for. The instrument is still free — the
 * room, the editor, playback, everything a person's own hands do. The MODELS
 * are what costs money, and those you buy.
 */

/** The top-up amounts (USD, token value — the card fee is added on top at
 *  checkout). Since the subscription pivot these are the OVERFLOW VALVE, not
 *  the product: the plan covers the month, a top-up is for the night that ran
 *  long. Flat rate — no bulk games; the $5 floor keeps the fixed part of the
 *  card fee from dwarfing the purchase. */
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
