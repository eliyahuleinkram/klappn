import { getSong, setSongStatus, snapshotPartOriginals } from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { triggerEdit } from "@/lib/workflows";
import { releaseReservation, reserveQuota } from "@/lib/billing";

// Kick off the edit Workflow with a natural-language change request.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const song = await getSong(id, userId);
  if (!song) return Response.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    changeRequest?: string;
  } | null;
  const changeRequest = body?.changeRequest?.trim();
  if (!changeRequest) {
    return Response.json({ error: "changeRequest is required" }, { status: 400 });
  }

  // Keep the way home: snapshot each part's code ONCE (before its first AI edit)
  // so the "Original" pill can always restore the first composition.
  await snapshotPartOriginals(id);
  // Flip to "generating" right away so the UI shows "Composing…" immediately
  // (the workflow also sets this, but a touch later) — and walk it back if the
  // trigger fails, so the song can't be stranded.
  await setSongStatus(id, "generating").catch(() => {});
  let workflowId: string;
  try {
    workflowId = await triggerEdit(id, changeRequest);
  } catch (e) {
    console.error(`[klappn] edit trigger failed for song ${id}:`, e);
    await setSongStatus(id, "ready").catch(() => {});
    return Response.json(
      { error: "Couldn’t start the edit — try again." },
      { status: 502 },
    );
  }
  return Response.json({ id, workflowId });
  } finally {
    await releaseReservation(gate.id);
  }
}
