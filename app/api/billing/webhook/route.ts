import {
  addCredits,
  getBilling,
  planByPriceId,
  setBilling,
  stripeFetch,
  verifyStripeSignature,
  type PlanId,
} from "@/lib/billing";
import { confirmPaidTicket, getEventByToken } from "@/lib/events";
import { emailConfigured, eventTicketEmail, sendEmail } from "@/lib/email";

/**
 * Stripe → klappn plan sync. Signature-verified (HMAC, v1 scheme); NO auth
 * session (Stripe calls this). Handles:
 *   checkout.session.completed      → set the purchased plan
 *   customer.subscription.updated   → follow plan/price changes + cancellations
 *   customer.subscription.deleted   → back to free
 * The userId travels in client_reference_id / subscription metadata.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "not configured" }, { status: 500 });

  const payload = await req.text();
  const ok = await verifyStripeSignature(
    payload,
    req.headers.get("stripe-signature"),
    secret,
  );
  if (!ok) return Response.json({ error: "bad signature" }, { status: 400 });

  let event: {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }
  const obj = (event.data?.object ?? {}) as Record<string, unknown>;

  // Confirm an event ticket from a checkout session — shared by the sync
  // (`completed`, card paid inline) and async (`async_payment_succeeded`, e.g.
  // bank debits that settle later) paths. Only ever confirms a session Stripe
  // reports as actually PAID: `completed` fires with payment_status "unpaid" for
  // delayed-notification methods, and confirming then would give a free ticket
  // that a later async failure can't take back.
  async function confirmTicketFromSession(): Promise<Response> {
    if (String(obj.payment_status ?? "") !== "paid") {
      // Not paid yet (async pending) — wait for async_payment_succeeded.
      return Response.json({ received: true });
    }
    const details = (obj.customer_details ?? {}) as {
      email?: string;
      name?: string;
    };
    const buyerEmail = String(details.email ?? "");
    const ticket = buyerEmail
      ? await confirmPaidTicket(
          String(obj.id ?? ""),
          buyerEmail,
          details.name ? String(details.name) : null,
        )
      : null;
    if (ticket && emailConfigured()) {
      const ev = await getEventByToken(ticket.event_token).catch(() => null);
      if (ev) {
        const url = `${new URL(req.url).origin}/e/${ev.token}`;
        const msg = eventTicketEmail(ev, url, ticket.amount_cents);
        await sendEmail({ to: ticket.email, ...msg }).catch(() => {});
      }
    }
    return Response.json({ received: true });
  }

  // Credit a paid token-top-up session to the ledger. Shared by the sync
  // (`completed`) and async (`async_payment_succeeded`) paths; only ever
  // credits a session Stripe reports as PAID, and addCredits is idempotent on
  // the session id so webhook retries can't double-credit.
  async function creditTokensFromSession(): Promise<Response> {
    if (String(obj.payment_status ?? "") !== "paid") {
      return Response.json({ received: true }); // async pending — wait
    }
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const userId = meta.userId || String(obj.client_reference_id ?? "");
    const tokens = Number(meta.tokens);
    const amount = Number(obj.amount_total ?? 0);
    if (userId && Number.isFinite(tokens) && tokens > 0) {
      await addCredits(userId, tokens, amount, String(obj.id ?? ""));
    }
    return Response.json({ received: true });
  }

  try {
    // Async settlement of a delayed-notification payment.
    if (event.type === "checkout.session.async_payment_succeeded") {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (meta.kind === "event_ticket") return await confirmTicketFromSession();
      if (meta.kind === "token_credits") return await creditTokensFromSession();
      return Response.json({ received: true });
    }
    if (event.type === "checkout.session.async_payment_failed") {
      // The pending ticket simply never confirms — nothing to undo. (No seat was
      // ever consumed; capacity counts confirmed rows only.)
      return Response.json({ received: true });
    }
    if (event.type === "checkout.session.completed") {
      // EVENT TICKETS (one-time payments) ride the same webhook: the session's
      // metadata.kind marks them, and they never touch plan/billing state.
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (meta.kind === "event_ticket") {
        return await confirmTicketFromSession();
      }
      // TOKEN TOP-UPS (the prepaid-token pivot) — credit the ledger, never plan state.
      if (meta.kind === "token_credits") {
        return await creditTokensFromSession();
      }
      const userId = String(obj.client_reference_id ?? "");
      const customer = obj.customer ? String(obj.customer) : undefined;
      const subscription = obj.subscription ? String(obj.subscription) : null;
      if (userId && (await getBilling(userId)).plan === "owner") {
        return Response.json({ received: true }); // the house is never re-planned
      }
      if (userId) {
        // The session doesn't carry the price — read it off the subscription.
        let plan: PlanId = "creator";
        if (subscription) {
          const sub = await stripeFetch(`/subscriptions/${subscription}`);
          const items = sub.items as
            | { data?: { price?: { id?: string } }[] }
            | undefined;
          const priceId = items?.data?.[0]?.price?.id ?? "";
          plan = planByPriceId(priceId) ?? "creator";
        }
        await setBilling(userId, {
          plan,
          stripeCustomerId: customer,
          stripeSubscriptionId: subscription,
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      const userId = meta.userId || "";
      if (userId && (await getBilling(userId)).plan === "owner") {
        return Response.json({ received: true }); // the house is never re-planned
      }
      if (userId) {
        const status = String(obj.status ?? "");
        const items = obj.items as
          | { data?: { price?: { id?: string } }[] }
          | undefined;
        const priceId = items?.data?.[0]?.price?.id ?? "";
        const live = status === "active" || status === "trialing";
        const plan: PlanId =
          event.type === "customer.subscription.deleted" || !live
            ? "free"
            : (planByPriceId(priceId) ?? "free");
        await setBilling(userId, {
          plan,
          stripeSubscriptionId:
            event.type === "customer.subscription.deleted"
              ? null
              : String(obj.id ?? ""),
        });
      }
    }
  } catch (e) {
    console.error("[klappn] webhook handling failed", e);
    // 500 → Stripe retries — correct for transient DB issues.
    return Response.json({ error: "handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
