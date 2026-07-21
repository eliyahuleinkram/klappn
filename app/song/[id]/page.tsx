import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { getSongWithParts } from "@/lib/songs";
import { sealDeep } from "@/lib/seal";
import SongClient from "@/components/SongClient";

export const dynamic = "force-dynamic";

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let userId: string | null = null;
  try {
    await warmPool(); // Kysely reserve() hangs cold on Hyperdrive — see lib/db.ts
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) redirect("/");

  const result = await getSongWithParts(id, userId);
  if (!result) notFound();

  // Loop code crosses to the client sealed (see lib/seal.ts) — nothing readable
  // in view-source / the RSC payload; SongClient opens it on arrival.
  return (
    <SongClient
      songId={id}
      initialSong={sealDeep(result.song)}
      initialParts={sealDeep(result.parts)}
    />
  );
}
