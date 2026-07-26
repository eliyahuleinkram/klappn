import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import ZaltzIDE from "@/components/ZaltzIDE";

// Session is read per-request so the avatar is RIGHT on first paint — the
// client-only /api/me fetch made every visit open as "you" for a beat
// (user 07-27: klappn.com doesn't blink; neither may the instrument).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "zaltz — the instrument you type",
  description:
    "Strudel on the left, Hydra on the right, our own engine underneath. Sketches keep themselves, the machine whispers the next line, and every take lands in the running mix. Type a bar — the room moves.",
  // The grain, not the Klappn mark: SVG for the browsers that take it, PNG for
  // the rest; the worker also answers /favicon.ico host-aware for Safari.
  icons: {
    icon: [
      { url: "/zaltz-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/zaltz-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/zaltz-icon-180.png",
  },
};

/** PUBLIC IDE (zaltz.klappn.com lands here) — no account, no gate: play first,
 *  a guest session appears only when you save or ask the machine, and one
 *  email later it's all yours forever. */
export default async function ZaltzPage() {
  // Identity only — the meter still hydrates via /api/me (billing needs its
  // own queries); this is just so the avatar never flashes "you" at a friend.
  let initialMe: { signedIn: boolean; isGuest: boolean; email: string | null } | null = null;
  try {
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
