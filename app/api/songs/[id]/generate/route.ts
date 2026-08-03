import {
  claimGenerating,
  getSong,
  getSongWithParts,
  setGenerationWorkflowId,
  setSongStatus,
} from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { triggerGeneration } from "@/lib/workflows";
import {
  addTokenUsage,
  assertComposeSlots,
  releaseReservation,
  reserveQuota,
} from "@/lib/billing";
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

  const slots = await assertComposeSlots(userId, id);
  if (slots) return slots;
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

  // WHAT A TAP ON ONE SECTION ACTUALLY MEANS (2026-08-02, the user: "if a loop
  // fails along the way then we cannot generate the subsequent loops as
  // everything needs to flow").
  //
  // Every section is composed from the finished code of the ones before it, so
  // a section is only worth making once the ones before it exist — and the ones
  // AFTER a hole are worth remaking once it's filled. A tap therefore resumes
  // from here to the end of what's unmade, in order: this section and every
  // later one still missing its music. Sections that are already ready are
  // skipped by the workflow, so a healthy song is untouched.
  //
  // `finish` rides along when this run will leave nothing unmade — the song
  // completes here, so it gets its arrangement and its sweep exactly as a birth
  // does. If something before the tapped section is still missing, the song
  // isn't finished by this run and the shape waits.
  const sp = await getSongWithParts(id, userId);
  const ordered = (sp?.parts ?? []).slice().sort((a, b) => a.position - b.position);
  const unmade = ordered.filter((p) => !(p.status === "ready" && p.strudel?.trim()));
  const from = partId ? ordered.find((p) => p.id === partId) : undefined;
  const resume = from ? unmade.filter((p) => p.position >= from.position) : unmade;
  const completes = resume.length > 0 && resume.length === unmade.length;
  let workflowId: string;
  try {
    workflowId = resume.length
      ? await triggerGeneration(
          id,
          resume.map((p) => p.id),
          undefined,
          completes ? { finish: true } : undefined,
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
