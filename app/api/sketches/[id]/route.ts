import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";
import { clampSketch, deleteSketch, updateSketch } from "@/lib/sketches";

export const dynamic = "force-dynamic";

/** Save over / delete ONE sketch — ownership scoped in the lib. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "bad body" }, { status: 400 });
  const sketch = await updateSketch(id, userId, clampSketch(body));
  if (!sketch) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(sealDeep({ sketch }));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const gone = await deleteSketch(id, userId);
  if (!gone) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
