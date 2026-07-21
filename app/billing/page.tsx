import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import {
  allowanceFor,
  getBilling,
  getCredits,
  getUsage,
  tasteAvailable,
  usedFor,
  type PlanId,
} from "@/lib/billing";
import SignIn from "@/components/SignIn";
import BillingClient from "@/components/BillingClient";

export const dynamic = "force-dynamic";

/**
 * Tokens page (the prepaid-token pivot, 2026-07-19). Real token counts and
 * real dollars ship to the client on purpose — transparency IS the product;
 * the old "loops only, never tokens" concealment is gone with the tiers.
 */
export default async function BillingPage() {
  let userId: string | null = null;
  try {
    await warmPool();
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return <SignIn />;

  let plan: PlanId = "free";
  let usedTokens = 0;
  let credits = 0;
  let allowanceTokens = allowanceFor("free", 0);
  try {
    const [billing, usage, creditTokens] = await Promise.all([
      getBilling(userId),
      getUsage(userId),
      getCredits(userId),
    ]);
    plan = billing.plan;
    credits = creditTokens;
    // Credits meter against lifetime; legacy subscriptions against the month.
    usedTokens = usedFor(plan, usage);
    // Free pool: show the taste only if this account holds/can claim a grant,
    // so the meter here always agrees with the compose gate.
    const taste = plan === "free" ? await tasteAvailable(userId) : true;
    allowanceTokens = allowanceFor(plan, credits, taste);
  } catch {
    /* fail soft — show the free view */
  }

  return (
    <BillingClient
      plan={plan}
      usedTokens={usedTokens}
      allowanceTokens={allowanceTokens}
      credits={credits}
    />
  );
}
