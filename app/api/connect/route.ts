import { getUserId, unauthorized } from "@/lib/session";
import {
  getConnect,
  refreshConnectReady,
  setConnect,
  stripeFetch,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * STRIPE CONNECT onboarding — how an organizer starts getting paid out.
 * POST → an Express account (created once) + a fresh account-link URL; the
 * organizer completes Stripe's hosted flow and lands back on /events. GET →
 * current state, re-asking Stripe when an account exists but isn't marked
 * ready yet (this is what flips `ready` after onboarding completes).
 */

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const state = await getConnect(userId);
  let ready = state.ready;
  if (state.accountId && !ready) {
    ready = await refreshConnectReady(userId, state.accountId);
  }
  return Response.json(
    { connected: !!state.accountId, ready },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const origin = new URL(req.url).origin;
  try {
    let { accountId } = await getConnect(userId);
    if (!accountId) {
      const acct = await stripeFetch("/accounts", {
        type: "express",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "metadata[userId]": userId,
      });
      accountId = String(acct.id);
      await setConnect(userId, { accountId });
    }
    const link = await stripeFetch("/account_links", {
      account: accountId,
      refresh_url: `${origin}/events?connect=retry`,
      return_url: `${origin}/events?connect=done`,
      type: "account_onboarding",
    });
    return Response.json({ url: String(link.url) });
  } catch (e) {
    console.error("[klappn] connect onboarding failed", e);
    return Response.json(
      { error: "Stripe onboarding didn't start — try again." },
      { status: 502 },
    );
  }
}
