import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import ZaltzIDE from "@/components/ZaltzIDE";

// Session is read per-request so the avatar is RIGHT on first paint — the
// client-only /api/me fetch made every visit open as "you" for a beat
// (user 07-27: klappn.com doesn't blink; neither may the instrument).
export const dynamic = "force-dynamic";

// MERGED INTO KLAPPN (2026-07-28, user: "it is a feature within klappn"):
// the room is Klappn's own — Klappn title, Klappn mark; "zaltz" stays the
// ENGINE's name (the repo, the npm package), never this surface's brand.
export const metadata: Metadata = {
  title: "Klappn — the instrument you type",
  description:
    "Strudel on the left, Hydra on the right, our own engine underneath. Sketches keep themselves, the machine whispers the next line, and every take lands in the running mix. Type a bar — the room moves.",
};

/** PUBLIC IDE (zaltz.klappn.com lands here) — no account, no gate: play first,
 *  a guest session appears only when you save or ask the machine, and one
 *  email later it's all yours forever. */
export default async function ZaltzPage() {
  // Identity only — the meter still hydrates via /api/me (billing needs its
  // own queries); this is just so the avatar never flashes "you" at a friend.
  let initialMe: { signedIn: boolean; isGuest: boolean; email: string | null } | null = null;
  try {
    // Better Auth reads the session through Kysely, whose driver reserve()s a
    // connection — and a cold reserve() over Hyperdrive hangs the whole render
    // (live 1101s on zaltz.klappn.com 07-27, any visit WITH a session cookie).
    // Same law as every other server page: warm the pool first.
    await warmPool();
    const session = await getAuth().api.getSession({ headers: await headers() });
    const u = session?.user as
      | { email?: string | null; isAnonymous?: boolean | null }
      | undefined;
    initialMe = u
      ? { signedIn: true, isGuest: !!u.isAnonymous, email: u.email ?? null }
      : { signedIn: false, isGuest: false, email: null };
  } catch {
    /* DB not up (fresh clone) — the client fetch takes over as before */
  }
  return <ZaltzIDE initialMe={initialMe} />;
}
