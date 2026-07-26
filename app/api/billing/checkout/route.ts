import { getSessionUser, unauthorized } from "@/lib/session";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  ensureCustomer,
  getBilling,
  stripeFetch,
  tokensForUsdCents,
} from "@/lib/billing";

/**
 * Start a Stripe Checkout for a PREPAID TOKEN top-up (the open-source pivot:
 * tokens at the posted public rate — see lib/pricing.ts). Body
 * `{ usd: 5 | 10 | 25 | 50 }` → `{ url }` to redirect to (hosted Checkout —
 * no Stripe.js, no publishable key needed). One-time payment, mode "payment";
 * the webhook credits the ledger when it lands.
 *
 * A live legacy subscription blocks top-ups: the monthly meter and the
 * lifetime credit meter must never mix. Cancel in the portal first.
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
        error: "Sign in first so your tokens are yours forever, not this browser's.",
        code: "account_required",
      },
      { status: 401 },
    );
  }
  const userId = user.id;

  const body = (await req.json().catch(() => null)) as {
    usd?: number;
    back?: string;
  } | null;
  // Where to land after Stripe: a same-site PATH only (the IDE passes /engine
  // so checkout returns to the session in progress). Anything else → /billing.
  const back =
    typeof body?.back === "string" && /^\/[a-z0-9/-]*$/i.test(body.back)
      ? body.back
      : "/billing";
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

  const billing = await getBilling(userId);
  if (billing.plan !== "free" && billing.plan !== "owner") {
    return Response.json(
      {
        error:
          "You’re on a legacy monthly plan — cancel it in Manage subscription first, then top up here.",
      },
      { status: 409 },
    );
  }

  const origin = new URL(req.url).origin;
  try {
    const customer = await ensureCustomer(userId, user.email);
    const session = await stripeFetch("/checkout/sessions", {
      mode: "payment",
      customer,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(usdCents),
      "line_items[0][price_data][product_data][name]": `Klappn tokens — ${(tokens / 1_000_000).toLocaleString()}M`,
      "line_items[0][price_data][product_data][description]":
        "Prepaid generation tokens — a price you can read. They never expire.",
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
