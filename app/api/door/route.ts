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
      // Public + briefly edge-cached: the door is hit by every signed-out
      // visitor and changes only when the owner re-curates.
      { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
    );
  } catch {
    // A cold local DB must not crash the sign-in page — an empty door is fine.
    return Response.json({ songs: [] });
  }
}
