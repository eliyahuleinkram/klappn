import { getSessionUser, unauthorized } from "@/lib/session";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  ensureCustomer,
  getBilling,
  PLANS,
  stripeFetch,
  tokensForUsdCents,
  type PlanId,
} from "@/lib/billing";

/**
 * Start a Stripe Checkout. Two things are for sale, and the body says which:
 *
 *   { plan: "creator" | "studio" }  → THE SUBSCRIPTION (mode "subscription").
 *                                     The product. The webhook sets the plan.
 *   { usd: 5 | 10 | 25 | 50 }       → a TOP-UP (mode "payment"), the overflow
 *                                     valve for a month that ran long.
 *
 * A top-up no longer refuses subscribers (2026-08-02, the subscription pivot):
 * the two meters are separate buckets now, the plan's month and a lifetime
 * bucket the plan's spill draws on, so they can be held at once without
 * confusing anybody — see readMeter.
 *
 * Changing or cancelling a live plan is the PORTAL's job, not a second
 * checkout — Stripe handles proration there, and two subscriptions on one
 * customer is a support ticket waiting to happen.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  // Money needs a name on the door: a guest session has no real email, so the
  // purchase would be chained to a cookie that can vanish. The client opens
  // sign-in on this code; the guest's work and meters ride along on link.
  if (user.isAnonymous) {
    return Response.json(
      {
        error: "Sign in first so the plan is yours, not this browser's.",
        code: "account_required",
      },
      { status: 401 },
    );
  }
  const userId = user.id;

  const body = (await req.json().catch(() => null)) as {
    plan?: string;
    usd?: number;
    back?: string;
  } | null;
  // Where to land after Stripe: a same-site PATH only (the room passes /engine
  // so checkout returns to the session in progress). Anything else → /billing.
  const back =
    typeof body?.back === "string" && /^\/[a-z0-9/-]*$/i.test(body.back)
      ? body.back
      : "/billing";
  const origin = new URL(req.url).origin;
  const billing = await getBilling(userId);
  if (billing.plan === "owner") {
    return Response.json(
      { error: "The house account is unmetered — there is nothing to buy." },
      { status: 409 },
    );
  }

  // ── THE SUBSCRIPTION ──────────────────────────────────────────────────────
  if (body?.plan) {
    const id = body.plan as PlanId;
    const plan = id === "creator" || id === "studio" ? PLANS[id] : null;
    if (!plan) return Response.json({ error: "no such plan" }, { status: 400 });
    if (!plan.priceId) {
      console.error(`[klappn] plan ${id} has no Stripe price id configured`);
      return Response.json(
        { error: "That plan isn’t open yet — try again shortly." },
        { status: 503 },
      );
    }
    if (billing.plan !== "free") {
      // Already subscribed: switching tiers belongs in the portal, where
      // Stripe prorates it and there is only ever one subscription.
      return Response.json(
        {
          error: "You’re already on a plan — change it in Manage.",
          code: "use_portal",
        },
        { status: 409 },
      );
    }
    try {
      const customer = await ensureCustomer(userId, user.email);
      const session = await stripeFetch("/checkout/sessions", {
        mode: "subscription",
        customer,
        "line_items[0][price]": plan.priceId,
        "line_items[0][quantity]": "1",
        client_reference_id: userId,
        "metadata[userId]": userId,
        // The subscription object carries the id too — the webhook reads plan
        // changes off `customer.subscription.*`, which only sees ITS metadata.
        "subscription_data[metadata][userId]": userId,
        success_url: `${origin}${back}?subscribed=1`,
        cancel_url: `${origin}${back}`,
      });
      return Response.json({ url: String(session.url) });
    } catch (e) {
      console.error("[klappn] subscription checkout failed", e);
      return Response.json(
        { error: "Couldn’t start checkout — try again." },
        { status: 502 },
      );
    }
  }

  // ── THE TOP-UP ────────────────────────────────────────────────────────────
  const usd = CREDIT_PACK_USD.find((v) => v === body?.usd);
  if (!usd) {
    return Response.json(
      { error: "pick one of the listed amounts" },
      { status: 400 },
    );
  }
  const usdCents = usd * 100;
  const tokens = tokensForUsdCents(usdCents);
  const feeCents = cardFeeCents(usdCents);

  try {
    const customer = await ensureCustomer(userId, user.email);
    const session = await stripeFetch("/checkout/sessions", {
      mode: "payment",
      customer,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(usdCents),
      "line_items[0][price_data][product_data][name]": `Klappn top-up — ${(tokens / 1_000_000).toLocaleString()}M units`,
      "line_items[0][price_data][product_data][description]":
        "Extra machine time at the posted rate. It never expires.",
      // The card fee, passed through to the cent as its own visible line —
      // (tokens + this) minus Stripe's cut nets exactly the token cost.
      "line_items[1][quantity]": "1",
      "line_items[1][price_data][currency]": "usd",
      "line_items[1][price_data][unit_amount]": String(feeCents),
      "line_items[1][price_data][product_data][name]": "Card processing",
      "line_items[1][price_data][product_data][description]":
        "Stripe’s fee, passed through exactly. We add nothing and keep nothing.",
      client_reference_id: userId,
      "metadata[kind]": "token_credits",
      "metadata[userId]": userId,
      "metadata[tokens]": String(tokens),
      success_url: `${origin}${back}?topped=1`,
      cancel_url: `${origin}${back}`,
    });
    return Response.json({ url: String(session.url) });
  } catch (e) {
    console.error("[klappn] checkout failed", e);
    return Response.json(
      { error: "Couldn’t start checkout — try again." },
      { status: 502 },
    );
  }
}
