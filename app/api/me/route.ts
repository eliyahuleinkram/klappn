import { getSessionUser } from "@/lib/session";
import { PLANS, readMeter } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * The room's one identity + meter read: who am I (guest counts), what plan is
 * on the door, and how much machine time is left before the gate closes.
 * (poolOpen is a launch-era relic kept for parsing; the sign-up taste is
 * uncapped, so it simply reads true — every claimed account can mint one.)
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req).catch(() => null);
  if (!user) {
    return Response.json({ signedIn: false, poolOpen: true });
  }
  let plan = "free";
  let usedTokens = 0;
  let credits = 0;
  let allowanceTokens = PLANS.free.tokens;
  let remainingTokens: number | null = PLANS.free.tokens;
  try {
    const m = await readMeter(user.id);
    plan = m.plan;
    credits = m.credits;
    // The two buckets, flattened for the client: what a month covers plus what
    // never expires. The room only ever asks "is there anything left?".
    allowanceTokens = m.planAllowance + m.taste + m.credits;
    usedTokens = m.planAllowance ? m.monthUsed : m.spent;
    remainingTokens = m.remaining;
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
    remainingTokens,
  });
}
