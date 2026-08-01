import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { readMeter, type Meter } from "@/lib/billing";
import SignIn from "@/components/SignIn";
import BillingClient from "@/components/BillingClient";

export const dynamic = "force-dynamic";

/**
 * The plan page (the subscription pivot, 2026-08-02). Real numbers still ship
 * to the client on purpose — transparency IS the product — but they are no
 * longer the headline: the page says what a month buys, and the units sit
 * underneath for anyone who wants to check the arithmetic.
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

  // A DISPLAY READ NEVER MINTS (mint: false) — the taste is claimed by the
  // gate, at the moment somebody actually asks the machine for something.
  let meter: Meter | null = null;
  try {
    meter = await readMeter(userId);
  } catch {
    /* fail soft — the client renders the free view from its own defaults */
  }

  return <BillingClient meter={meter} />;
}
