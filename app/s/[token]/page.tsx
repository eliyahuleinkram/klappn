import { notFound } from "next/navigation";
import { warmPool } from "@/lib/db";
import { getSharedSong } from "@/lib/songs";
import { sealDeep } from "@/lib/seal";
import SongClient from "@/components/SongClient";

export const dynamic = "force-dynamic";

/**
 * A SHARED SONG — open to anyone holding the link, account or not.
 *
 * No session is read and none is needed: the token is the permission. The whole
 * song arrives exactly as its owner made it, and from here it is the visitor's
 * to play with — every deterministic control works and every change is theirs
 * alone, kept in their own browser (SongClient's shared mode). Nothing they do
 * can reach the owner's song, and no AI door is open to them.
 */
export default async function SharedSongPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await warmPool(); // a cold reserve() hangs on Hyperdrive — see lib/db.ts
  const result = await getSharedSong(token);
  if (!result) notFound();
  return (
    <SongClient
      songId={result.song.id}
      initialSong={sealDeep(result.song)}
      initialParts={sealDeep(result.parts)}
      shared={token}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSharedSong(token).catch(() => null);
  const title = result?.song.title?.trim() || "A hit on Klappn";
  return {
    title,
    description: "Play it, take it apart, make it yours — no account needed.",
  };
}
