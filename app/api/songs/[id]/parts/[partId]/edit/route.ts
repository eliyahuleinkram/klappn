import { getSong, setSongStatus } from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { releaseReservation, reserveQuota } from "@/lib/billing";
import { triggerLoopEdit } from "@/lib/workflows";

export const dynamic = "force-dynamic";

/**
 * NATURAL-LANGUAGE edit of ONE loop — the typed change on a selected loop ("drop the pad and add a shaker",
 * "make the bass darker"). The router splits it into ordered ops and the executor applies them to this loop
 * only, composed against its neighbouring sections so the song stays cohesive. It can be several model calls
 * (a batch may include an add), so it runs in the async EditWorkflow and streams back via the poll — the
 * loop flips to "generating" and updates in place when it's done. Body: { request }.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const { id, partId } = await params;
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const song = await getSong(id, userId);
  if (!song) return Response.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { request?: string } | null;
  const request = body?.request?.trim();
  if (!request) return Response.json({ error: "request required" }, { status: 400 });

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  // Flip the loop's song to generating so the client polls; walk it back if the kick fails.
  const prev = song.status;
  await setSongStatus(id, "generating");
  try {
    const workflowId = await triggerLoopEdit(id, partId, request.slice(0, 300));
    return Response.json({ ok: true, workflowId });
  } catch (e) {
    console.error(`[klappn] loop-edit trigger failed for ${partId}:`, e);
    await setSongStatus(id, prev).catch(() => {});
    return Response.json({ error: "Couldn’t start — try again." }, { status: 502 });
  }
  } finally {
    await releaseReservation(gate.id);
  }
}
