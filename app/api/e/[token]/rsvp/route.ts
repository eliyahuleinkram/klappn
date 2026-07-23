import { claimFreeTicket, getEventByToken, salesClosed } from "@/lib/events";
import { emailConfigured, eventTicketEmail, sendEmail } from "@/lib/email";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * PUBLIC free-event RSVP — the token is the invitation, an email is the whole
 * form. Idempotent per email (re-tapping "I'm in" never errors). Paid events
 * refuse here and go through /checkout instead.
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
  if (event.price_cents > 0) {
    return Response.json({ error: "this event is ticketed" }, { status: 400 });
  }
  if (salesClosed(event)) {
    return Response.json({ error: "ticket sales have closed" }, { status: 410 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = (body.email || "").trim();
  if (!email || !email.includes("@") || email.length > 320) {
    return Response.json({ error: "enter a real email" }, { status: 400 });
  }

  // Each fresh claim sends a confirmation mail, which makes this public
  // endpoint an email-send surface — gate it per-IP and per-event before
  // any row lands.
  if (!(await rateLimit(`rsvp:ip:${clientIp(req)}`, 8, 600))) return tooMany();
  if (!(await rateLimit(`rsvp:event:${event.id}`, 40, 3600))) return tooMany();

  const ticket = await claimFreeTicket(
    event.id,
    email,
    (body.name || "").trim() || null,
    event.capacity,
  );
  if (ticket === "full") {
    return Response.json({ error: "this one's at capacity" }, { status: 409 });
  }
  if (!ticket) return Response.json({ error: "enter a real email" }, { status: 400 });

  // Confirmation email — best-effort; the RSVP stands either way. Only on the
  // FIRST claim: this endpoint is public and unauthenticated, so emailing on
  // every POST would let anyone spam an arbitrary address by re-RSVPing it.
  if (ticket.fresh && emailConfigured()) {
    const origin = new URL(req.url).origin;
    const msg = eventTicketEmail(event, `${origin}/e/${event.token}`, 0);
    void sendEmail({ to: ticket.row.email, ...msg }).catch(() => {});
  }
  return Response.json({ ok: true });
}
