import { createLiveLink, endLiveLinks, getActiveLiveLink } from "@/lib/live";
import { getUserId, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Is this set on air? A reloaded DJ page asks on mount, so the on-air chip
 *  reflects the truth (the broadcast outlives the tab). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const link = await getActiveLiveLink(id, userId);
  return Response.json(
    link ? { token: link.token, expiresAt: link.expires_at } : { token: null },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Open the set's live door: create (or return the existing unexpired) listener
 *  link. Body `{ hours? }` (1–24, default 6). Owner only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { hours?: number };
  const link = await createLiveLink(id, userId, body.hours ?? 6);
  if (!link) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ token: link.token, expiresAt: link.expires_at });
}

/** Close the door now — every listener's next poll sees the set has ended. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  await endLiveLinks(id, userId);
  return Response.json({ ok: true });
}
