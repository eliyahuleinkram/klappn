import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { listSongsRich, type SongRowRich } from "@/lib/songs";
import SignIn from "@/components/SignIn";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  // If the DB/auth isn't wired yet (local dev before setup), fail soft to the
  // sign-in screen rather than crashing the whole page.
  let userId: string | null = null;
  let email: string | null | undefined = null;
  try {
    await warmPool(); // Kysely reserve() hangs cold on Hyperdrive — see lib/db.ts
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
    email = session?.user?.email;
  } catch {
    userId = null;
  }

  if (!userId) return <SignIn />;

  let songs: SongRowRich[] = [];
  try {
    songs = await listSongsRich(userId);
  } catch {
    songs = [];
  }

  return <HomeClient initialSongs={songs} userEmail={email} />;
}
