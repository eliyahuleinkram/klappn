import { getSessionUser } from "@/lib/session";
import {
  allowanceFor,
  getBilling,
  getCredits,
  getUsage,
  PLANS,
  tasteAvailable,
  usedFor,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * The IDE's one identity + meter read: who am I (guest counts), and how many
 * tokens are left before the gate closes. (poolOpen is a launch-era relic kept
 * for parsing; since 2026-07-28 the sign-up dollar is uncapped, so it simply
 * reads true — every claimed account can mint its grant.)
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req).catch(() => null);
  if (!user) {
    return Response.json({ signedIn: false, poolOpen: true });
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

