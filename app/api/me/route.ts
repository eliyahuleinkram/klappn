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
 * tokens are left before the gate closes. Signed-out callers still learn
 * whether the free-taste pool has room — that's the line on the door.
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

/** Does the fixed free-taste pool still have room for a newcomer? */
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
