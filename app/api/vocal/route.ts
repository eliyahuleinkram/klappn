import { getUserId, unauthorized } from "@/lib/session";
import { listAllVocalTakes } from "@/lib/vocal";

export const dynamic = "force-dynamic";

/** THE VOICE LIBRARY — every take the user has kept, across all songs, so a
 *  take born on one track can be pulled into another. */
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const takes = await listAllVocalTakes(userId);
  return Response.json(
    {
      takes: takes.map((t) => ({
        id: t.id,
        songId: t.song_id,
        songTitle: t.song_title,
        title: t.title,
        durationMs: t.duration_ms,
        fx: t.fx,
        hasLyrics: !!t.lyrics?.length,
        createdAt: t.created_at,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
