import {
  claimGenerating,
  getSong,
  getSongWithParts,
  setGenerationWorkflowId,
  setSongStatus,
} from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { triggerGeneration } from "@/lib/workflows";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { rederiveSongIdentity } from "@/lib/jobs";
import { makeCallSink } from "@/lib/call-trace";

/**
 * Kick off the generation Workflow. Validates ownership, flips the song to
 * 'generating', stores the workflow instance id, and returns immediately. The
 * client then polls GET /api/songs/:id.
 *
 * Body `{ partId }` → generate that loop (the loop-by-loop flow — the only one).
 * Allowed from any status except 'generating' (a song already generating is
 * rejected to avoid two runs).
 */
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

  // ATOMIC claim — flip to 'generating' only if it isn't already, so two
  // concurrent POSTs can't both start a workflow over the same pending parts.
  const claim = await claimGenerating(id, userId);
  if (!claim) return Response.json({ error: "not found" }, { status: 404 });
  if (!claim.won) {
    return Response.json(
      { error: "already generating — let the current loop finish first" },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    partId?: string;
  } | null;
  const partId = body?.partId?.trim() || undefined;

  // RETRY THE IDEA TOO: if the creation-time derive call failed, the song is composing off
  // the default identity ("Untitled" / 120 / A minor — plan.underived). Re-run the idea call
  // from the stored raw request BEFORE composing, so a retry is a real fresh take, not the
  // defaults again. Best-effort: if the derive fails again we compose as before.
  const song = await getSong(id, userId);
  if ((song?.plan as { underived?: boolean } | null)?.underived) {
    const sink = makeCallSink({ songId: id });
    await rederiveSongIdentity(id, {
      onUsage: (t) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
      model: song!.model,
    }).catch((e) => console.error(`[klappn] re-derive failed for song ${id}:`, e));
    await sink.flush();
  }

  // IS THIS A BIRTH? A song with several sections and NO music anywhere has
  // never been made — whether it just got its arc back from the re-derive above
  // or its first trigger never landed. Compose the whole thing in order and let
  // the run finish itself, exactly as creation does; anything else hands back a
  // single loop where every other song is a piece (2026-08-02). A retry of ONE
  // loop in a song that already has music stays exactly that.
  const sp = await getSongWithParts(id, userId);
  const virgin = !!sp && sp.parts.length > 1 && sp.parts.every((p) => !p.strudel?.trim());
  let workflowId: string;
  try {
    workflowId = virgin
      ? await triggerGeneration(
          id,
          sp!.parts.map((p) => p.id),
          undefined,
          { finish: true },
        )
      : await triggerGeneration(id, partId);
  } catch (e) {
    console.error(`[klappn] trigger failed for song ${id}:`, e);
    await setSongStatus(id, claim.prev).catch(() => {});
    return Response.json(
      { error: "Couldn’t start composing — try again." },
      { status: 502 },
    );
  }
  await setGenerationWorkflowId(id, workflowId);

  return Response.json({ id, status: "generating", workflowId });
  } finally {
    await releaseReservation(gate.id);
  }
}
