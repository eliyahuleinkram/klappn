import { getUserId, getUserEmail, unauthorized } from "@/lib/session";
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
 * tokens at exactly our model cost — see lib/billing.ts). Body
 * `{ usd: 5 | 10 | 25 | 50 }` → `{ url }` to redirect to (hosted Checkout —
 * no Stripe.js, no publishable key needed). One-time payment, mode "payment";
 * the webhook credits the ledger when it lands.
 *
 * A live legacy subscription blocks top-ups: the monthly meter and the
 * lifetime credit meter must never mix. Cancel in the portal first.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = (await req.json().catch(() => null)) as { usd?: number } | null;
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
    const email = await getUserEmail(req).catch(() => null);
    const customer = await ensureCustomer(userId, email);
    const session = await stripeFetch("/checkout/sessions", {
      mode: "payment",
      customer,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(usdCents),
      "line_items[0][price_data][product_data][name]": `Klappn tokens — ${(tokens / 1_000_000).toLocaleString()}M`,
      "line_items[0][price_data][product_data][description]":
        "Prepaid generation tokens at exactly our model cost. They never expire.",
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
      success_url: `${origin}/billing?topped=1`,
      cancel_url: `${origin}/billing`,
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
