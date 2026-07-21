import { listDoorSongs } from "@/lib/songs";

/**
 * THE DOOR, list side — the owner-curated songs a signed-out visitor can play.
 * Public by design: no session, no user data, no code (cards only). The play
 * payload lives at /api/door/[id].
 */
export async function GET() {
  try {
    const songs = await listDoorSongs();
    return Response.json(
      { songs },
      // No cache: the list is a fresh shuffle per request, and freezing one
      // deal at the edge would defeat it.
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    // A cold local DB must not crash the sign-in page — an empty door is fine.
    return Response.json({ songs: [] });
  }
}
