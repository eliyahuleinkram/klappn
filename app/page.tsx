import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { listDoorSongs, listSongsRich, type SongRowRich } from "@/lib/songs";
import { sealDeep } from "@/lib/seal";
import SignIn from "@/components/SignIn";
import HomeClient from "@/components/HomeClient";
import type { DoorSong } from "@/components/DoorGallery";

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

  if (!userId) {
    // THE DOOR — the owner-curated songs a visitor can play before any
    // account exists. Card whispers only (no code); an empty door renders
    // the classic sign-in.
    let door: DoorSong[] = [];
    try {
      door = (await listDoorSongs()) as unknown as DoorSong[];
    } catch {
      door = [];
    }
    return <SignIn door={door} />;
  }

  let songs: SongRowRich[] = [];
  try {
    songs = await listSongsRich(userId);
  } catch {
    songs = [];
  }

  return <HomeClient initialSongs={sealDeep(songs)} userEmail={email} />;
}
