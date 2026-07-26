import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import SignIn from "@/components/SignIn";

export const dynamic = "force-dynamic";

/**
 * CLAIM — where a guest attaches an email. The OTP flow runs with the guest
 * session still live, so Better Auth links the two and the server-side merge
 * (lib/guest.ts) carries every loop, sketch and meter onto the account.
 * Already-claimed accounts have nothing to do here → home.
 */
export default async function ClaimPage() {
  let claimed = false;
  try {
    await warmPool();
    const session = await getAuth().api.getSession({ headers: await headers() });
    const u = session?.user as { id?: string; isAnonymous?: boolean | null } | undefined;
    claimed = !!u?.id && !u.isAnonymous;
  } catch {
    /* fail soft — the form still renders */
  }
  // Outside the try: redirect() throws its control-flow error on purpose.
  if (claimed) redirect("/");
  return <SignIn claim />;
}
