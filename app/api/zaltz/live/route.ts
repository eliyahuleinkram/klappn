import { createZaltzLiveLink, endZaltzLinks, getActiveZaltzLink } from "@/lib/live";
import { getUserId, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * THE ZALTZ ROOM'S LIVE DOOR (2026-07-28) — the live-coding room broadcasts
 * exactly like a set (one mix stream on the Realtime SFU; see lib/rtc), but
 * there's no set row: the link hangs on the USER (kind 'zaltz', one open door
 * per user). Same shape as /api/sets/[id]/live so both DJs learn one flow.
 */

/** Is the room on air? A reloaded page asks on mount. */
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const link = await getActiveZaltzLink(userId);
  return Response.json(
    link ? { token: link.token, expiresAt: link.expires_at } : { token: null },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Open the door: body `{ hours?, title? }` (1–24h, default 6). */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    hours?: number;
    title?: string;
  };
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : null;
  const link = await createZaltzLiveLink(userId, body.hours ?? 6, title);
  return Response.json({ token: link.token, expiresAt: link.expires_at });
}

/** Close the door now — every listener's next poll sees the room has ended. */
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  await endZaltzLinks(userId);
  return Response.json({ ok: true });
}
