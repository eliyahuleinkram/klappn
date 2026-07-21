import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import {
  deleteEvent,
  setEventTrack,
  updateEvent,
  type EventPatch,
} from "@/lib/events";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as EventPatch & {
    trackPartId?: string | null;
  };
  const event = await updateEvent(id, userId, body);
  if (!event) return Response.json({ error: "not found" }, { status: 404 });
  // The trailer — a loop of THEIR music on the public page. Ownership of the
  // part is proven inside setEventTrack; a bad id is simply ignored.
  if (body.trackPartId !== undefined) {
    await setEventTrack(id, userId, body.trackPartId).catch(() => {});
  }
  return Response.json({ event });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const gone = await deleteEvent(id, userId);
  if (!gone) return Response.json({ error: "not found" }, { status: 404 });
  // Best-effort: sweep the poster out of R2 with the row.
  if (gone.poster_key) {
    try {
      const r2 = (env as unknown as { RENDER_CACHE?: { delete(k: string): Promise<void> } })
        .RENDER_CACHE;
      await r2?.delete(gone.poster_key);
    } catch {
      /* orphaned poster is harmless */
    }
  }
  return Response.json({ ok: true });
}
