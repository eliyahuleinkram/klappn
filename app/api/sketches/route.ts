import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";
import { clampSketch, createSketch, listSketches } from "@/lib/sketches";

export const dynamic = "force-dynamic";

/** The IDE's saved sketches — list mine / save a new one. Guests (anonymous
 *  sessions) are first-class owners here; no AI, no quota, just rows. */
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const sketches = await listSketches(userId);
  return Response.json(sealDeep({ sketches }));
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "bad body" }, { status: 400 });
  const sketch = await createSketch(userId, clampSketch(body));
  if (!sketch) {
    return Response.json(
      { error: "That's a full crate — delete a few sketches first." },
      { status: 409 },
    );
  }
  return Response.json(sealDeep({ sketch }), { status: 201 });
}
