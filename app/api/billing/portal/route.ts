import { getUserId, getUserEmail, unauthorized } from "@/lib/session";
import { ensureCustomer, stripeFetch } from "@/lib/billing";

/** Open the Stripe customer portal (manage / change / cancel the plan).
 *  Returns `{ url }` to redirect to. */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const origin = new URL(req.url).origin;
  try {
    const email = await getUserEmail(req).catch(() => null);
    const customer = await ensureCustomer(userId, email);
    const session = await stripeFetch("/billing_portal/sessions", {
      customer,
      return_url: `${origin}/billing`,
    });
    return Response.json({ url: String(session.url) });
  } catch (e) {
    console.error("[klappn] portal failed", e);
    return Response.json(
      { error: "Couldn’t open billing — try again." },
      { status: 502 },
    );
  }
}
