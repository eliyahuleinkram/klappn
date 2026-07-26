import { getSessionUser } from "@/lib/session";
import {
  allowanceFor,
  FREE_TASTE_GRANTS,
  getBilling,
  getCredits,
  getUsage,
  PLANS,
  tasteAvailable,
  usedFor,
} from "@/lib/billing";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The IDE's one identity + meter read: who am I (guest counts), and how many
 * tokens are left before the gate closes. (poolOpen is a launch-era relic —
 * the free-taste pool closed 2026-07-26, so it now always reads false; kept so
 * older clients keep parsing.)
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req).catch(() => null);
  if (!user) {
    return Response.json({ signedIn: false, poolOpen: await poolOpen() });
  }
  let plan: string = "free";
  let usedTokens = 0;
  let credits = 0;
  let allowanceTokens = allowanceFor("free", 0);
  try {
    const [billing, usage, creditTokens] = await Promise.all([
      getBilling(user.id),
      getUsage(user.id),
      getCredits(user.id),
    ]);
    plan = billing.plan;
    credits = creditTokens;
    usedTokens = usedFor(billing.plan, usage);
    const taste = billing.plan === "free" ? await tasteAvailable(user.id) : true;
    allowanceTokens = allowanceFor(billing.plan, credits, taste);
  } catch {
    /* fail soft — free view */
  }
  return Response.json({
    signedIn: true,
    isGuest: user.isAnonymous,
    email: user.isAnonymous ? null : user.email,
    plan,
    owner: plan === "owner",
    usedTokens,
    credits,
    allowanceTokens: plan === "owner" ? PLANS.owner.tokens : allowanceTokens,
    remainingTokens:
      plan === "owner" ? null : Math.max(0, allowanceTokens - usedTokens),
  });
}

/** Does the fixed free-taste pool still have room? Always false since the
 *  pool closed (FREE_TASTE_GRANTS = 0) — see lib/billing.ts. */
async function poolOpen(): Promise<boolean> {
  try {
    const sql = db();
    const [row] = await sql<{ total: string | number }[]>`
      select count(*) as total from taste_grants`;
    return Number(row?.total ?? 0) < FREE_TASTE_GRANTS;
  } catch {
    return true; // fail open, like the gate
  }
}
