import {
  capacityHeldCount,
  createPendingTicket,
  getEventByToken,
  platformFeeCents,
  salesClosed,
} from "@/lib/events";
import { getConnect, stripeFetch } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * PUBLIC ticket checkout — one-time Stripe payment, no account needed (Stripe
 * collects the buyer's email; the webhook lands it on the ticket). The 10%
 * platform fee is ledgered on the pending ticket row at creation.
 *
 * PAYOUTS: when the organizer has a READY Connect account, this is a
 * DESTINATION CHARGE — their 90% transfers automatically, the 10% stays as
 * application_fee_amount. No account (or not ready yet) falls back to
 * platform-collected with the same ledger, so a ticket never bounces on
 * payout plumbing.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const event = await getEventByToken(token).catch(() => null);
  if (!event || event.status !== "live") {
    return Response.json({ error: "this event is gone" }, { status: 404 });
  }
  if (event.price_cents <= 0) {
    return Response.json({ error: "this event is free — just RSVP" }, { status: 400 });
  }
  if (salesClosed(event)) {
    return Response.json({ error: "ticket sales have closed" }, { status: 410 });
  }
  // Confirmed + fresh pending sessions — N parallel buyers can no longer all
  // pass the gate and oversell the room (see capacityHeldCount).
  if (
    event.capacity !== null &&
    (await capacityHeldCount(event.id)) >= event.capacity
  ) {
    return Response.json({ error: "this one's at capacity" }, { status: 409 });
  }

  const origin = new URL(req.url).origin;
  try {
    const connect = await getConnect(event.user_id);
    const payout: Record<string, string> =
      connect.accountId && connect.ready
        ? {
            "payment_intent_data[application_fee_amount]": String(
              platformFeeCents(event.price_cents),
            ),
            "payment_intent_data[transfer_data][destination]": connect.accountId,
          }
        : {};
    const session = await stripeFetch("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": event.currency || "usd",
      "line_items[0][price_data][unit_amount]": String(event.price_cents),
      "line_items[0][price_data][product_data][name]": `${event.title} — ticket`,
      "line_items[0][quantity]": "1",
      "metadata[kind]": "event_ticket",
      "metadata[eventId]": event.id,
      "metadata[eventToken]": event.token,
      success_url: `${origin}/e/${event.token}?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/e/${event.token}`,
      ...payout,
    });
    await createPendingTicket(event.id, String(session.id), event.price_cents);
    return Response.json({ url: String(session.url) });
  } catch (e) {
    console.error("[klappn] event checkout failed", e);
    return Response.json({ error: "checkout didn't start — try again" }, { status: 502 });
  }
}
