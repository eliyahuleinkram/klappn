import { getUserId, unauthorized } from "@/lib/session";
import { getSong, setSongShared } from "@/lib/songs";

/**
 * THE SHARE LINK — mint or revoke (2026-08-02, the user: "we also need to be
 * able to share a song").
 *
 * POST { on: true }  → returns the token (idempotent: an existing link keeps
 *                      working, so re-tapping Share never breaks a link already
 *                      sent to someone).
 * POST { on: false } → revokes, killing every copy of the link at once.
 *
 * The token IS the permission: whoever holds the link opens the song at
 * /s/<token> with no account. What they change, they change only for
 * themselves — the visitor's copy lives in their browser and never reaches this
 * song (see SongClient's shared mode). Zero AI is reachable from there, and not
 * because the UI hides it: every mutating route on this API is session-scoped,
 * so a visitor has nothing to authenticate with even if they craft the request.
 *
 * No quota gate — a link costs nothing to make.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { on?: boolean };
  const song = await getSong(id, userId);
  if (!song) return Response.json({ error: "not found" }, { status: 404 });
  const token = await setSongShared(id, userId, body.on !== false);
  return Response.json({ ok: true, token, path: token ? `/s/${token}` : null });
}
