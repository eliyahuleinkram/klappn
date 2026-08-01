import type { Sql } from "postgres";
import { db } from "./db";

/**
 * Billing — A MONTHLY PLAN, with the meter honest underneath (2026-08-02, the
 * user: "move away from token based billing, we will move towards subscription
 * based billing").
 *
 * THE DEAL: the instrument is free forever and always will be. The MACHINE —
 * the whispers, the conversation, the composing — runs on a plan that covers a
 * month at a time (PLANS below). A claimed account gets a taste on the house
 * first: no card, no clock, no seven-day countdown running while you are at
 * work. It waits until you use it.
 *
 * TWO BUCKETS THAT NEVER MIX (readMeter):
 *   · the PLAN covers the first N units of each calendar month, and refills.
 *   · the LIFETIME bucket — the sign-up taste plus every top-up ever bought —
 *     never expires, and is only touched once a month's allowance is gone.
 * A free account is simply an empty plan bucket, which is why one formula
 * serves everybody. Top-ups survive as an overflow valve so a good night never
 * hits a wall, and every prepaid dollar sold in the July token era stays
 * spendable, forever, exactly as promised.
 *
 * Units are COST-WEIGHTED (lib/llm.ts onUsage: output ×5, cache read ×0.1,
 * cache write ×1.25/×2 — Anthropic's own ratios, scaled by the served model's
 * rate) so a metered unit tracks real spend on every model. The $/M rate stays
 * public in lib/pricing.ts: a plan is a simpler promise, not a vaguer one, and
 * anyone who wants to check our arithmetic still can.
 *
 * Limits are a HARD gate checked before any AI work starts (never
 * mid-composition — a loop that begins always finishes).
 */

export type PlanId = "free" | "creator" | "studio" | "label" | "owner";

// The pricing constants live in lib/pricing.ts (client-safe — the billing UI
// imports them directly; this file re-exports for every server-side caller).
export {
  cardFeeCents,
  CREDIT_PACK_USD,
  FREE_TASTE_TOKENS,
  loopsFor,
  nightsFor,
  songsFor,
  TIERS,
  TOKENS_PER_LOOP,
  TOKENS_PER_NIGHT,
  TOKENS_PER_SONG,
  tokensForUsdCents,
  totalWithCardFeeCents,
  USD_CENTS_PER_MILLION,
} from "./pricing";
import { FREE_TASTE_TOKENS, loopsFor, TIERS, TOKENS_PER_LOOP } from "./pricing";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly token allowance. */
  tokens: number;
  /** Display price, USD/month. */
  usd: number;
  /** Stripe recurring price id ("" = no Stripe object; the free tier). */
  priceId: string;
  blurb: string;
}

/**
 * THE GIFT, IN ONE SENTENCE — the only place this is worded.
 *
 * A walk-in gets the instrument free forever; the MACHINE (the whispers, the
 * conversation, the composing) runs on a monthly plan, and a claimed account
 * starts with a taste of it on the house. Said once, at the moment it matters,
 * and never as a nag: the house rule is that we are confident enough not to
 * push. Every gate that needs an account answers with this line, so a guest
 * never reads two versions of the same offer.
 *
 * WHAT IT BUYS, NOT WHAT IT COUNTS (user, 2026-08-02 — this SUPERSEDES the
 * 07-28/29 "tokens, never dollars" law, which was written for a prepaid meter
 * where the unit WAS the product). Under a subscription, making somebody do
 * arithmetic is the exact thing the subscription is there to abolish: the copy
 * says a song, a night in the room. The token number stays readable underneath
 * for anyone who wants it — on the billing page, in open code — and it is
 * still never dressed up in dollars.
 */
export const SIGNUP_GIFT =
  "Make an account and your first song — and a night in the room — are on the house.";

export const PLANS: Record<PlanId, Plan> = {
  // Free is the pre-subscription state, not a plan on the page. `tokens` is
  // the SIGN-UP TASTE (lib/pricing FREE_TASTE_TOKENS — a song and a night in
  // the room, no card, no clock). Anonymous walk-ins get the free instrument
  // but never the taste: a walk-in needs no email, so a blanket grant is
  // bot-farmable — it lands when a name lands on the door.
  free: {
    id: "free",
    name: "Free",
    tokens: FREE_TASTE_TOKENS,
    usd: 0,
    priceId: "",
    blurb: "the instrument is yours. The machine, for a while.",
  },
  // THE TWO ON THE SHELF — name, price and allowance come from lib/pricing's
  // TIERS (the client reads that same row, so the grid and the gate can never
  // disagree); only the Stripe price id is added here, from the environment.
  creator: {
    ...TIERS[0],
    priceId: process.env.STRIPE_PRICE_CREATOR || "",
  },
  studio: {
    ...TIERS[1],
    priceId: process.env.STRIPE_PRICE_STUDIO || "",
  },
  // HISTORICAL (pre-pivot): the retired top tier, sized so $/loop dipped
  // slightly below Studio's as a bulk nod. Kept only so existing Label
  // subscribers keep their allowance until they cancel.
  label: {
    id: "label",
    name: "Label",
    tokens: 12_000_000,
    usd: 129,
    priceId: process.env.STRIPE_PRICE_LABEL || "",
    blurb: "you don’t run out — the night does.",
  },
  // The HOUSE account — unmetered testing for the owner. Never shown in the
  // tier grid, never purchasable, never downgraded by Stripe webhooks. Set by
  // hand in user_billing (plan = 'owner').
  owner: {
    id: "owner",
    name: "Owner",
    tokens: Number.MAX_SAFE_INTEGER,
    usd: 0,
    priceId: "",
    blurb: "House account — unmetered.",
  },
};

export function planByPriceId(priceId: string): PlanId | null {
  for (const p of Object.values(PLANS)) {
    if (p.priceId && p.priceId === priceId) return p.id;
  }
  return null;
}

/** The current usage period — calendar month, UTC ("2026-06"). */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export interface BillingRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanId;
}

export async function getBilling(
  userId: string,
  sql: Sql = db(),
): Promise<BillingRow> {
  try {
    const [row] = await sql<BillingRow[]>`
      select user_id, stripe_customer_id, stripe_subscription_id, plan
      from user_billing where user_id = ${userId}`;
    if (
      row &&
      (row.plan === "creator" ||
        row.plan === "studio" ||
        row.plan === "label" ||
        row.plan === "owner")
    )
      return row;
    return row
      ? { ...row, plan: "free" }
      : {
          user_id: userId,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          plan: "free",
        };
  } catch {
    // table not migrated yet → everyone is free tier
    return {
      user_id: userId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan: "free",
    };
  }
}

export async function setBilling(
  userId: string,
  patch: {
    plan?: PlanId;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
  },
  sql: Sql = db(),
): Promise<void> {
  // THE HIGH-WATER MARK rises here and only here — a plan change is rare, the
  // metering path is not (see peak_allowance in schema.sql: it is what keeps a
  // downgrade from retroactively eating somebody's prepaid top-ups).
  // SUBSCRIPTION allowances only: "free" carries the sign-up taste in the same
  // field, and letting that count as a monthly allowance would forgive a
  // taste's worth of spill in every period a free account ever had.
  const gained =
    patch.plan === "creator" || patch.plan === "studio" || patch.plan === "label"
      ? PLANS[patch.plan].tokens
      : 0;
  try {
    await writeBilling(userId, patch, gained, sql);
  } catch (e) {
    // A PLAN MUST LAND EVEN IF THE COLUMN HASN'T (deploy ordering): this runs
    // from the Stripe webhook, and a throw here means somebody paid and never
    // got their plan. peak_allowance is protection for prepaid top-ups — worth
    // losing for one write, never worth losing a customer's subscription over.
    console.info(
      "[klappn] user_billing.peak_allowance is missing — plan written without it. " +
        "Run: alter table user_billing add column if not exists peak_allowance bigint not null default 0;",
      String(e).slice(0, 120),
    );
    await writeBilling(userId, patch, null, sql);
  }
}

async function writeBilling(
  userId: string,
  patch: {
    plan?: PlanId;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
  },
  gained: number | null,
  sql: Sql,
): Promise<void> {
  await sql`
    insert into user_billing (user_id, plan, stripe_customer_id, stripe_subscription_id${gained === null ? sql`` : sql`, peak_allowance`})
    values (${userId}, ${patch.plan ?? "free"}, ${patch.stripeCustomerId ?? null}, ${patch.stripeSubscriptionId ?? null}${gained === null ? sql`` : sql`, ${gained}`})
    on conflict (user_id) do update set
      ${gained === null ? sql`` : sql`peak_allowance = greatest(user_billing.peak_allowance, ${gained}),`}
      plan = coalesce(${patch.plan ?? null}, user_billing.plan),
      stripe_customer_id = coalesce(${patch.stripeCustomerId ?? null}, user_billing.stripe_customer_id),
      stripe_subscription_id = ${patch.stripeSubscriptionId === undefined ? sql`user_billing.stripe_subscription_id` : (patch.stripeSubscriptionId ?? null)},
      updated_at = now()`;
}

// --- Stripe Connect (event-ticket payouts) ----------------------------------

export interface ConnectState {
  accountId: string | null;
  ready: boolean; // charges_enabled mirrored locally — checkout never calls Stripe
}

export async function getConnect(
  userId: string,
  sql: Sql = db(),
): Promise<ConnectState> {
  try {
    const [row] = await sql<{ stripe_account_id: string | null; stripe_account_ready: boolean }[]>`
      select stripe_account_id, stripe_account_ready
      from user_billing where user_id = ${userId}`;
    return {
      accountId: row?.stripe_account_id ?? null,
      ready: !!row?.stripe_account_ready,
    };
  } catch {
    return { accountId: null, ready: false };
  }
}

export async function setConnect(
  userId: string,
  patch: { accountId?: string; ready?: boolean },
  sql: Sql = db(),
): Promise<void> {
  await sql`
    insert into user_billing (user_id, stripe_account_id, stripe_account_ready)
    values (${userId}, ${patch.accountId ?? null}, ${patch.ready ?? false})
    on conflict (user_id) do update set
      stripe_account_id = coalesce(${patch.accountId ?? null}, user_billing.stripe_account_id),
      stripe_account_ready = ${patch.ready === undefined ? sql`user_billing.stripe_account_ready` : patch.ready},
      updated_at = now()`;
}

/** Ask Stripe whether the account can take charges, and mirror the answer.
 *  Called at onboarding-return and events-page status checks — never inline in
 *  checkout (a Stripe call per ticket would be latency for nothing). */
export async function refreshConnectReady(
  userId: string,
  accountId: string,
  sql: Sql = db(),
): Promise<boolean> {
  try {
    const acct = await stripeFetch(`/accounts/${accountId}`);
    const ready = acct.charges_enabled === true;
    await setConnect(userId, { ready }, sql);
    return ready;
  } catch {
    return false;
  }
}

/** Record tokens against the user's CURRENT month. Best-effort: metering must
 *  never break the model call it rides on (or block it — call without await). */
export async function addTokenUsage(
  userId: string,
  tokens: number,
  sql: Sql = db(),
): Promise<void> {
  if (!userId || !Number.isFinite(tokens) || tokens <= 0) return;
  const n = Math.round(tokens);
  const period = currentPeriod();
  try {
    // THE MONTH STAMPS ITS OWN COVER. What the plan is worth is read off
    // user_billing in the SAME statement (no extra round trip on a path that
    // runs per model call) and written beside the usage, so `creditsSpent` can
    // ask "how much of this month did the plan NOT cover?" of every past month
    // without needing to know what plan was live back then. `greatest` on
    // conflict means a mid-month upgrade keeps the better cover for the whole
    // month — monotonic, and in the customer's favour.
    await sql`
      insert into token_usage (user_id, period, tokens, covered)
      select ${userId}, ${period}, ${n}, coalesce((
        select case ub.plan
          when 'creator' then ${PLANS.creator.tokens}
          when 'studio' then ${PLANS.studio.tokens}
          when 'label' then ${PLANS.label.tokens}
          else 0
        end from user_billing ub where ub.user_id = ${userId}
      ), 0)
      on conflict (user_id, period) do update
      set tokens = token_usage.tokens + excluded.tokens,
          covered = greatest(token_usage.covered, excluded.covered)`;
  } catch (e) {
    // No `covered` column yet — meter anyway. Losing the stamp costs precision
    // in the spill sum; losing the USAGE would cost the house the whole call.
    try {
      await sql`
        insert into token_usage (user_id, period, tokens)
        values (${userId}, ${period}, ${n})
        on conflict (user_id, period) do update
        set tokens = token_usage.tokens + excluded.tokens`;
    } catch (e2) {
      console.error("[klappn] usage metering failed", e2);
      return;
    }
    console.info(
      "[klappn] token_usage.covered is missing — metered without it. " +
        "Run: alter table token_usage add column if not exists covered bigint not null default 0;",
      String(e).slice(0, 120),
    );
  }
}

export interface Usage {
  /** This calendar month's units. */
  month: number;
  /** All-time units — the free taste is metered against this. */
  lifetime: number;
}

export async function getUsage(
  userId: string,
  sql: Sql = db(),
): Promise<Usage> {
  try {
    const [row] = await sql<{ month: string | number; lifetime: string | number }[]>`
      select
        coalesce(sum(tokens) filter (where period = ${currentPeriod()}), 0) as month,
        coalesce(sum(tokens), 0) as lifetime
      from token_usage where user_id = ${userId}`;
    return {
      month: Number(row?.month ?? 0),
      lifetime: Number(row?.lifetime ?? 0),
    };
  } catch {
    return { month: 0, lifetime: 0 };
  }
}

/** The units a plan meters against: a subscription's allowance refreshes
 *  monthly; the free taste + purchased top-ups are lifetime — they never
 *  refill and never expire. */
export function usedFor(plan: PlanId, usage: Usage): number {
  return plan === "free" ? usage.lifetime : usage.month;
}

/**
 * TOP-UP UNITS ALREADY SPENT — every period's usage PAST the monthly
 * allowance, summed. This is the whole interaction between the two meters,
 * and it is deliberately one line of arithmetic:
 *
 *   the plan covers the first `allowance` units of each month;
 *   anything past that comes out of the lifetime bucket.
 *
 * On the free plan `allowance` is 0, so this reduces to lifetime usage — the
 * exact prepaid semantics that shipped in July, unchanged.
 *
 * `allowance` is the account's PEAK (see peak_allowance in schema.sql): using
 * the current plan would let a downgrade retroactively eat credit somebody
 * paid for. The peak can only forgive spill, never invent it.
 */
export async function creditsSpent(
  userId: string,
  allowance: number,
  sql: Sql = db(),
): Promise<number> {
  try {
    // EACH PERIOD AGAINST ITS OWN COVER (token_usage.covered — what the plan
    // was worth THAT month, stamped as the usage was metered). Nothing about a
    // past month can change afterwards, which is the only way both of these
    // are true at once: cancelling never reaches back and eats prepaid
    // top-ups, and a churned subscriber's new free months are not still
    // covered by a plan they no longer pay for.
    const [row] = await sql<{ spill: string | number }[]>`
      select coalesce(sum(greatest(tokens - coalesce(covered, 0), 0)), 0) as spill
      from token_usage where user_id = ${userId}`;
    return Number(row?.spill ?? 0);
  } catch {
    // No `covered` column yet: fall back to one allowance across all history
    // (see peakAllowance). Never returns 0 on failure — a zero here would
    // report every bucket as untouched and open the gate to everybody.
    try {
      const [row] = await sql<{ spill: string | number }[]>`
        select coalesce(sum(greatest(tokens - ${Math.round(allowance)}, 0)), 0) as spill
        from token_usage where user_id = ${userId}`;
      return Number(row?.spill ?? 0);
    } catch {
      return 0;
    }
  }
}

/**
 * The best monthly allowance this account has ever held — raised on every plan
 * change, never lowered (see schema.sql).
 *
 * DEGRADES SAFELY, and this is deliberate: where the column does not exist yet
 * (prod's role cannot ALTER — the migration is a hand-run line), this falls
 * back to the CURRENT plan's allowance, which is the correct answer for every
 * account that has never downgraded. The stronger guarantee switches itself on
 * the moment the column appears; nothing else has to change.
 */
export async function peakAllowance(
  userId: string,
  plan: PlanId,
  sql: Sql = db(),
): Promise<number> {
  const now = plan === "free" || plan === "owner" ? 0 : PLANS[plan].tokens;
  try {
    const [row] = await sql<{ peak: string | number }[]>`
      select coalesce(peak_allowance, 0) as peak from user_billing where user_id = ${userId}`;
    return Math.max(now, Number(row?.peak ?? 0));
  } catch {
    return now;
  }
}

/**
 * THE METER — one read, one formula, every surface. What anyone can still
 * spend is two buckets that never mix:
 *
 *   what the plan still covers this month  +  what is left of the lifetime
 *   bucket (the sign-up taste plus every top-up ever bought)
 *
 * The plan bucket refills on the 1st; the lifetime bucket never expires and is
 * only touched once a month's allowance is gone. A free account simply has an
 * empty plan bucket, which is why the same formula serves both.
 */
export interface Meter {
  plan: PlanId;
  /** What the subscription covers each month (0 when there isn't one). */
  planAllowance: number;
  /** Units spent this calendar month. */
  monthUsed: number;
  /** What the plan still covers before the month is out. */
  planLeft: number;
  /** The sign-up taste, if this account holds (or can mint) one. */
  taste: number;
  /** Units ever bought as top-ups. */
  credits: number;
  /** Of taste + credits, what is already gone. */
  spent: number;
  /** What is left of the lifetime bucket. */
  creditsLeft: number;
  /** Everything still spendable — `null` for the house (unmetered). */
  remaining: number | null;
}

/** Read the meter. `mint` claims the sign-up taste if this account has never
 *  had it (the gate does; a display read never should). */
export async function readMeter(
  userId: string,
  { mint = false }: { mint?: boolean } = {},
): Promise<Meter> {
  const [billing, usage, credits] = await Promise.all([
    getBilling(userId),
    getUsage(userId),
    getCredits(userId),
  ]);
  const plan = PLANS[billing.plan] ? billing.plan : "free";
  if (plan === "owner") {
    return {
      plan,
      planAllowance: PLANS.owner.tokens,
      monthUsed: usage.month,
      planLeft: PLANS.owner.tokens,
      taste: 0,
      credits,
      spent: 0,
      creditsLeft: 0,
      remaining: null,
    };
  }
  const planAllowance = plan === "free" ? 0 : PLANS[plan].tokens;
  const [peak, hasTaste] = await Promise.all([
    peakAllowance(userId, plan),
    mint ? claimTasteGrant(userId) : tasteAvailable(userId),
  ]);
  const taste = hasTaste ? PLANS.free.tokens : 0;
  const spent = await creditsSpent(userId, peak);
  const planLeft = Math.max(0, planAllowance - usage.month);
  const creditsLeft = Math.max(0, taste + credits - spent);
  return {
    plan,
    planAllowance,
    monthUsed: usage.month,
    planLeft,
    taste,
    credits,
    spent,
    creditsLeft,
    remaining: planLeft + creditsLeft,
  };
}

/** Total prepaid tokens the user has ever bought (the credit ledger). */
export async function getCredits(
  userId: string,
  sql: Sql = db(),
): Promise<number> {
  try {
    const [row] = await sql<{ tokens: string | number }[]>`
      select coalesce(sum(tokens), 0) as tokens
      from token_credits where user_id = ${userId}`;
    return Number(row?.tokens ?? 0);
  } catch {
    // table not migrated yet → no credits
    return 0;
  }
}

/** Credit a paid checkout session. Idempotent on stripe_session_id — Stripe
 *  retries webhooks, and a retry must never double-credit. */
export async function addCredits(
  userId: string,
  tokens: number,
  usdCents: number,
  stripeSessionId: string,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    insert into token_credits (user_id, tokens, usd_cents, stripe_session_id)
    values (${userId}, ${Math.round(tokens)}, ${Math.round(usdCents)}, ${stripeSessionId})
    on conflict (stripe_session_id) do nothing`;
}

/**
 * THE SIGN-UP TASTE — REOPENED 2026-07-28 (user: start people off with $1,
 * then raised to $1.20 same day; supersedes the 2026-07-26 pool-closed
 * decision, which this comment keeps for the record). No pool cap anymore:
 * EVERY CLAIMED (email, non-anonymous) account gets one grant of
 * PLANS.free.tokens ($1.20 = 240k weighted units) on its first compose. Anonymous walk-ins never mint one —
 * a walk-in needs no email, so a blanket grant is bot-farmable; the dollar
 * lands the moment a name lands on the door (and a guest's work rides along
 * through the claim merge). The old FREE_TASTE_GRANTS pool constant is gone;
 * the taste_grants schema is unchanged.
 */

/** Claim the sign-up dollar for this user: mints once per CLAIMED account,
 *  tells the truth about an existing (incl. grandfathered launch) grant.
 *  Fails OPEN (true) on a DB hiccup, like the rest of the gate. */
export async function claimTasteGrant(
  userId: string,
  sql: Sql = db(),
): Promise<boolean> {
  try {
    const rows = await sql`
      insert into taste_grants (user_id)
      select ${userId}
      where exists (
        select 1 from "user" u
        where u.id = ${userId} and coalesce(u."isAnonymous", false) = false
      )
      on conflict (user_id) do nothing
      returning user_id`;
    if (rows.length > 0) return true;
    const [row] = await sql`select 1 as g from taste_grants where user_id = ${userId}`;
    return !!row;
  } catch (e) {
    console.error("[klappn] claimTasteGrant failed — failing open", e);
    return true;
  }
}

/** Read-side twin for display (billing page): true when the user HAS a grant
 *  or would mint one on their first compose (claimed account) — so the meter
 *  shown always matches what the gate would decide. Never claims. */
export async function tasteAvailable(
  userId: string,
  sql: Sql = db(),
): Promise<boolean> {
  try {
    const [row] = await sql<{ mine: number; claimed: boolean | null }[]>`
      select
        (select count(*) from taste_grants where user_id = ${userId})::int as mine,
        (select coalesce("isAnonymous", false) = false from "user" where id = ${userId}) as claimed`;
    return Number(row?.mine ?? 0) > 0 || !!row?.claimed;
  } catch {
    return true; // fail open, same as the gate
  }
}

/** The tokens a user may spend before the gate closes: the free lifetime
 *  taste (IF they hold / can claim a pool grant) plus every credit they've
 *  bought (free plan), or the legacy monthly subscription allowance (paid
 *  plans, until they cancel), or ∞ (owner). */
export function allowanceFor(
  plan: PlanId,
  credits: number,
  hasTaste = true,
): number {
  return plan === "free"
    ? (hasTaste ? PLANS.free.tokens : 0) + credits
    : PLANS[plan].tokens;
}

/** The pre-flight QUOTA GATE for every route that starts AI work. Returns null
 *  when there's headroom, or a ready-to-return 402 Response when the month's
 *  tokens are spent. (Checked before work starts — a loop that begins always
 *  finishes, so going slightly over on the last loop is by design.) */
export async function assertQuota(userId: string): Promise<Response | null> {
  const meter = await readMeter(userId, { mint: true });
  if (meter.remaining === null || meter.remaining > 0) return null;
  const plan = PLANS[meter.plan] ?? PLANS.free;
  const used = meter.planAllowance ? meter.monthUsed : meter.spent;
  const limit = meter.planAllowance + meter.taste + meter.credits;
  const credits = meter.credits;
  // A GUEST IS NOT OUT OF MONEY — THEY ARE OUT OF ACCOUNT (2026-07-29). The
  // dollar only mints for a claimed name, so telling a walk-in to "top up"
  // asks them to pay for something already waiting for them. Offer the gift
  // instead; the till comes later, and only for people it actually applies to.
  if (await isGuestAccount(userId)) return accountRequired();
  return quotaExceeded(plan.id, used, limit, credits);
}

/** Unclaimed walk-in? (the anonymous plugin's real-but-nameless user row) */
export async function isGuestAccount(userId: string, sql = db()): Promise<boolean> {
  try {
    const rows = (await sql`
      select coalesce("isAnonymous", false) as guest from "user" where id = ${userId} limit 1
    `) as { guest: boolean }[];
    return rows.length ? Boolean(rows[0].guest) : false;
  } catch {
    return false; // never lock someone out because a lookup blinked
  }
}

/** The one answer every account-only door gives. 401 so the client opens the
 *  door rather than the till. */
export function accountRequired(what?: string): Response {
  return Response.json(
    {
      error: what ? `${what} ${SIGNUP_GIFT}` : SIGNUP_GIFT,
      code: "account_required",
    },
    { status: 401 },
  );
}

/** The 402 body assertQuota returns — factored so the reservation gate reuses
 *  it. Since the transparency pivot the payload carries REAL token counts next
 *  to the loop estimates — nothing user-facing is disguised anymore. */
function quotaExceeded(
  plan: PlanId,
  used: number,
  limitTokens: number,
  credits: number,
): Response {
  return Response.json(
    {
      // Everyone has a door: top up on /billing (legacy subscribers can also
      // just wait for the month to refresh, so they're told both).
      // Everyone has a door, and it is the one that fits: a free account is
      // being invited to subscribe, a subscriber has simply had a big month.
      error:
        plan === "free"
          ? credits > 0
            ? "That’s everything on the meter — a plan keeps the machine on all month."
            : limitTokens === 0
              ? "The instrument is free; the machine runs on a plan. Pick one and it starts composing."
              : "That was the taste. A plan keeps the machine on all month."
          : "Big month — the plan’s month is spent. It refills on the 1st, and a top-up carries you to it.",
      code: "quota_exhausted",
      plan,
      used: Math.round((used / TOKENS_PER_LOOP) * 10) / 10,
      limit: loopsFor(limitTokens),
      usedTokens: Math.round(used),
      limitTokens: Math.round(limitTokens),
    },
    { status: 402 },
  );
}

/** How long a generation may hold a reservation before the sweep reclaims it —
 *  a backstop for a crashed release, well above any real compose time. */
const RESERVATION_TTL_MIN = 15;

export type QuotaReservation =
  | { ok: true; id: string }
  | { ok: false; response: Response };

/**
 * ATOMIC QUOTA GATE — replaces the check-then-act assertQuota for the routes that
 * start AI work. In ONE serialized transaction (per-user advisory lock) it counts
 * recorded usage PLUS every other in-flight reservation, and only inserts a new
 * hold if there's still room for one more loop. So N requests fired in parallel
 * can no longer all pass before any usage lands — the (N+1)th sees the first N's
 * holds and is refused. On success the caller MUST releaseReservation(id) once the
 * work finishes (its real cost is metered separately via addTokenUsage); a missed
 * release is reclaimed by the TTL sweep at the top of the next gate.
 *
 * Fails OPEN on an unexpected DB error (like the old gate) so a metering outage
 * can't wall off all generation — the abuse it closes is parallelism, not a DB
 * being down.
 */
export async function reserveQuota(userId: string): Promise<QuotaReservation> {
  try {
    return await db().begin(async (tx) => {
      const sql = tx as unknown as Sql; // TransactionSql → Sql for the helpers
      // Serialize concurrent gates for THIS user so the count-then-insert below
      // is race-free (hashtext → int4 widens to the bigint the lock takes).
      await sql`select pg_advisory_xact_lock(hashtext(${userId}))`;
      // TTL sweep — a hold whose release never ran can't block forever.
      await sql`
        delete from token_reservations
        where user_id = ${userId}
          and created_at < now() - (${RESERVATION_TTL_MIN} * interval '1 minute')`;
      const [billing, usage, credits] = await Promise.all([
        getBilling(userId, sql),
        getUsage(userId, sql),
        getCredits(userId, sql),
      ]);
      const plan = PLANS[billing.plan] ?? PLANS.free;
      const used = usedFor(plan.id, usage);
      // FREE POOL: the taste only counts if this account holds (or can still
      // claim) one of the FREE_TASTE_GRANTS pool grants. Claimed here, at the
      // first compose attempt — sign-ups alone never burn a grant.
      const taste = plan.id === "free" ? await claimTasteGrant(userId, sql) : true;
      const limit = allowanceFor(plan.id, credits, taste);
      const [{ reserved }] = await sql<{ reserved: string | number }[]>`
        select coalesce(sum(est_tokens), 0) as reserved
        from token_reservations where user_id = ${userId}`;
      // Room for one more loop? (reserved=0 when nothing's in flight → identical
      // to the old `used < limit` gate; matches "the last loop may run over".)
      if (used + Number(reserved) >= limit) {
        return { ok: false as const, response: quotaExceeded(plan.id, used, limit, credits) };
      }
      const [{ id }] = await sql<{ id: string }[]>`
        insert into token_reservations (user_id, est_tokens)
        values (${userId}, ${TOKENS_PER_LOOP})
        returning id`;
      return { ok: true as const, id };
    });
  } catch (e) {
    console.error("[klappn] reserveQuota failed — failing open", e);
    return { ok: true, id: "" }; // fail open; "" is a no-op for releaseReservation
  }
}

/** Release a hold taken by reserveQuota — call once the generation finishes
 *  (success OR failure). Best-effort; a missed release is TTL-swept. */
export async function releaseReservation(id: string): Promise<void> {
  if (!id) return;
  try {
    await db()`delete from token_reservations where id = ${id}`;
  } catch (e) {
    console.error("[klappn] releaseReservation failed (TTL will reclaim)", e);
  }
}

// --- Stripe (raw REST over fetch — no SDK; form-encoded like Stripe expects) --

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  return k;
}

export async function stripeFetch(
  path: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(params ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json?.error ?? {}) as { message?: string };
    throw new Error(`stripe ${path}: ${err.message || res.status}`);
  }
  return json;
}

/** The user's Stripe customer, created on first need and remembered. */
export async function ensureCustomer(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  const billing = await getBilling(userId);
  if (billing.stripe_customer_id) return billing.stripe_customer_id;
  const customer = await stripeFetch("/customers", {
    ...(email ? { email } : {}),
    "metadata[userId]": userId,
  });
  const id = String(customer.id);
  await setBilling(userId, { stripeCustomerId: id });
  return id;
}

/** Verify a Stripe webhook signature (v1 scheme: HMAC-SHA256 over
 *  `${timestamp}.${payload}` with the endpoint secret). */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=", 2) as [string, string]),
  );
  const t = Number(parts.t);
  const sig = parts.v1;
  if (!t || !sig) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
