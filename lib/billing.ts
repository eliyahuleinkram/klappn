import type { Sql } from "postgres";
import { db } from "./db";

/**
 * Billing — PREPAID TOKENS AT COST (2026-07-19, the open-source pivot),
 * metered in COST-WEIGHTED token units (lib/llm.ts onUsage: output ×5, cache
 * read ×0.1, cache write ×1.25 — the same price ratios every Anthropic model
 * uses, so the unit is model-agnostic; only the $/unit differs by model).
 *
 * THE DEAL, stated plainly (and shown to users just as plainly — /open): you
 * buy tokens at one flat public rate — $10 per 1M weighted units (anchored
 * today to Fable 5's input rate), with output/cache normalized by the
 * weights above. The rate lives in open code (lib/pricing.ts) — changing it
 * is a commit anyone can read. Credits never expire and are metered
 * against LIFETIME usage alongside the free taste. This replaces the
 * subscription tiers AND their old posture of hiding the $/M rate behind
 * opaque "loops" — the rate is now the headline. Loops remain as a friendly
 * ESTIMATE (~30k units each, measured p50 28k), never a disguise.
 *
 * Limits are a HARD gate checked before any AI work starts (never
 * mid-composition — a loop that begins always finishes).
 *
 * LEGACY SUBSCRIPTIONS: PLANS + the webhook sync remain so existing
 * subscribers keep exactly the old monthly-allowance behavior until they
 * cancel (portal still works). Tiers are no longer purchasable — checkout
 * sells credits only — and a live subscription blocks credit purchase so the
 * two meters never mix.
 */

export type PlanId = "free" | "creator" | "studio" | "label" | "owner";

// The pricing constants live in lib/pricing.ts (client-safe — the billing UI
// imports them directly; this file re-exports for every server-side caller).
export {
  cardFeeCents,
  CREDIT_PACK_USD,
  loopsFor,
  TOKENS_PER_LOOP,
  tokensForUsdCents,
  totalWithCardFeeCents,
  USD_CENTS_PER_MILLION,
} from "./pricing";
import { loopsFor, TOKENS_PER_LOOP } from "./pricing";

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

export const PLANS: Record<PlanId, Plan> = {
  // Free is the pre-subscription state, not a plan on the page: a 3-loop
  // taste — ONCE, LIFETIME, it never refills (usedFor meters free against
  // all-time usage, paid against the month). It left the tier grid
  // 2026-07-05 (page.tsx filters it) — the blurb below is vestigial.
  free: {
    id: "free",
    name: "Free",
    tokens: 100_000,
    usd: 0,
    priceId: "",
    blurb: "taste the full flow.",
  },
  creator: {
    id: "creator",
    name: "Creator",
    tokens: 1_100_000,
    usd: 12,
    priceId: process.env.STRIPE_PRICE_CREATOR || "",
    blurb: "a new groove every night before you sleep.",
  },
  studio: {
    id: "studio",
    name: "Studio",
    tokens: 3_500_000,
    usd: 39,
    priceId: process.env.STRIPE_PRICE_STUDIO || "",
    blurb: "walk in humming, walk out with an EP.",
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
  await sql`
    insert into user_billing (user_id, plan, stripe_customer_id, stripe_subscription_id)
    values (${userId}, ${patch.plan ?? "free"}, ${patch.stripeCustomerId ?? null}, ${patch.stripeSubscriptionId ?? null})
    on conflict (user_id) do update set
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
  try {
    await sql`
      insert into token_usage (user_id, period, tokens)
      values (${userId}, ${currentPeriod()}, ${Math.round(tokens)})
      on conflict (user_id, period) do update
      set tokens = token_usage.tokens + excluded.tokens`;
  } catch (e) {
    console.error("[klappn] usage metering failed", e);
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

/** The units a plan meters against: legacy paid allowances refresh monthly;
 *  the free taste + purchased credits are lifetime — they never refill and
 *  never expire. */
export function usedFor(plan: PlanId, usage: Usage): number {
  return plan === "free" ? usage.lifetime : usage.month;
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

/** The tokens a user may spend before the gate closes: the free lifetime
 *  taste plus every credit they've bought (free plan), or the legacy monthly
 *  subscription allowance (paid plans, until they cancel), or ∞ (owner). */
export function allowanceFor(plan: PlanId, credits: number): number {
  return plan === "free" ? PLANS.free.tokens + credits : PLANS[plan].tokens;
}

/** The pre-flight QUOTA GATE for every route that starts AI work. Returns null
 *  when there's headroom, or a ready-to-return 402 Response when the month's
 *  tokens are spent. (Checked before work starts — a loop that begins always
 *  finishes, so going slightly over on the last loop is by design.) */
export async function assertQuota(userId: string): Promise<Response | null> {
  const [billing, usage, credits] = await Promise.all([
    getBilling(userId),
    getUsage(userId),
    getCredits(userId),
  ]);
  const plan = PLANS[billing.plan] ?? PLANS.free;
  const used = usedFor(plan.id, usage);
  const limit = allowanceFor(plan.id, credits);
  if (used < limit) return null;
  return quotaExceeded(plan.id, used, limit, credits);
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
      error:
        plan === "free"
          ? credits > 0
            ? "Your tokens are spent — top up to keep composing."
            : "That was the free taste — top up tokens to keep composing."
          : "You’ve used this month’s loops — they refresh next month, or top up tokens on the billing page.",
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
      const limit = allowanceFor(plan.id, credits);
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
