import {
  createSong,
  listSongsRich,
  deleteSongs,
  getSongWithParts,
  injectPart,
  reconcileStaleGeneration,
  saveOverview,
  setGenerationWorkflowId,
  setSongStatus,
} from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";
import {
  deriveWorkspaceFromLoop,
  type MixInspiration,
} from "@/lib/anthropic";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { terminateManyGenerations, triggerGeneration } from "@/lib/workflows";
import { stripHydraBlock } from "@/lib/hydra-embed";
import { DEFAULT_MODEL, isModelId, type ModelId } from "@/lib/models";

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  let songs = await listSongsRich(userId);
  // RECOVERY: settle any song whose composing run died, so the home grid can't
  // show "Composing…" forever (and its poll can stop). Cheap: reconcile checks
  // staleness itself and a healthy run is left untouched.
  const generating = songs.filter((s) => s.status === "generating").slice(0, 8);
  if (generating.length) {
    const changed = await Promise.all(
      generating.map((s) => reconcileStaleGeneration(s.id)),
    );
    if (changed.some(Boolean)) songs = await listSongsRich(userId);
  }
  // The rich rows carry plan (meterCache, arrangement, breaks, visual) — code
  // lives in there, so the list seals like every other song payload.
  return Response.json(sealDeep({ songs }));
}

/**
 * Create a WORKSPACE by describing its FIRST loop (ChatGPT-style — you start
 * with a request, not a setup form). From that one request the AI infers the
 * whole track's identity (title, genre, tempo, key) AND the first loop, which we
 * insert and start composing immediately.
 *
 * Body `{ firstLoop }` → the natural-language request.
 * Body `{}` (no request) → a blank workspace with defaults (fallback).
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    firstLoop?: string;
    loopIds?: unknown;
    model?: unknown;
  };
  // QUOTA GATE — creating a loop is the most expensive thing in the product.
  // ATOMIC reservation (not a bare check): parallel POSTs each take a hold, so
  // the (N+1)th sees the first N's holds and is refused — the simple check-then-
  // act gate let a free user fire N requests at once and blow past the cap. The
  // hold is released in the finally once composing is triggered (its real cost is
  // metered separately as the workflow runs).
  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const firstLoop = (body.firstLoop || "").trim();

  // Optional INSPIRATION loops the user selected to seed this new loop from.
  const loopIds = Array.isArray(body.loopIds)
    ? body.loopIds.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  // One model: Fable 5 (isModelId admits nothing else). Persisted per song.
  const model: ModelId = isModelId(body.model) ? body.model : DEFAULT_MODEL;

  if (!firstLoop && loopIds.length === 0) {
    // Fallback: blank beat, no AI.
    const song = await createSong(userId, "", "Untitled", model);
    await saveOverview(song.id, {
      summary: "",
      bpm: 120,
      key: "A minor",
      parts: [],
    }).catch(() => {});
    return Response.json({ id: song.id, status: "overview" }, { status: 201 });
  }

  // Gather inspiration from the selected loops (their music, owned; @hydra stripped).
  const inspirations: MixInspiration[] = [];
  for (const id of loopIds) {
    const sp = await getSongWithParts(id, userId);
    if (!sp) continue;
    for (const p of sp.parts) {
      if (p.strudel?.trim())
        inspirations.push({
          label: p.label || sp.song.title || "loop",
          intent: p.intent || "",
          strudel: stripHydraBlock(p.strudel),
        });
    }
  }

  // TRAINING CORPUS: the derive call carries the user's RAW first-loop request —
  // capture it like every workflow call (the song id is stamped once it exists).
  const sink = makeCallSink();
  const cfg = {
    onUsage: (t: number) => void addTokenUsage(userId, t),
    onCall: sink.onCall,
    model,
  };

  // Derive the track's identity + the first loop from the request (+ inspiration).
  // Runs on the chosen model too (the planner respects the toggle).
  const d = await deriveWorkspaceFromLoop(
    firstLoop,
    cfg,
    inspirations.length ? inspirations : undefined,
  );
  const song = await createSong(
    userId,
    (firstLoop || d.intent).slice(0, 2000),
    d.title,
    model,
  );
  sink.setIds({ songId: song.id });
  await sink.flush();
  await saveOverview(song.id, {
    summary: "",
    bpm: d.bpm,
    key: d.key,
    genre: d.genre || undefined,
    timeSignature: d.timeSignature,
    parts: [],
    // The derive call FAILED and these are the safe defaults — flag it so "Try again"
    // re-runs the idea call (rederiveSongIdentity) instead of composing off them forever.
    ...(d.fallback ? { underived: true } : {}),
  }).catch(() => {});
  // BORN WITH ACTS (2026-07-14): the derive plans the piece's sections (one for
  // a loop ask, 2-4 for a song ask) and every one composes now, in order — a
  // journey needs acts, and acts hidden behind manual Extend taps never happened.
  const partIds: string[] = [];
  for (let i = 0; i < d.parts.length; i++) {
    const p = await injectPart(song.id, i, d.parts[i].label, d.parts[i].intent, d.bars);
    partIds.push(p.id);
  }

  // Start composing right away. If the trigger fails, the song must NOT be
  // stranded in "generating" — walk it back to overview, where the loop page
  // offers a Generate button.
  await setSongStatus(song.id, "generating");
  try {
    const wf = await triggerGeneration(song.id, partIds, model);
    await setGenerationWorkflowId(song.id, wf);
  } catch (e) {
    console.error(`[klappn] trigger failed for new song ${song.id}:`, e);
    await setSongStatus(song.id, "overview").catch(() => {});
    return Response.json({ id: song.id, status: "overview" }, { status: 201 });
  }

  return Response.json({ id: song.id, status: "generating" }, { status: 201 });
  } finally {
    // Release the hold — the compose that's now running meters its own cost.
    await releaseReservation(gate.id);
  }
}

/**
 * BULK delete workspaces — `{ ids: string[] }`. One request, one connection: a
 * single ownership-scoped `delete … where id in (…)`, then halt any running
 * generation workflows (bounded, best-effort). This replaces the client fanning
 * out one DELETE per loop, which spiked N simultaneous DB connections and blew
 * past the pool ceiling so "some" deletes 500'd. Foreign ids are ignored; the
 * response is all-or-nothing, so the client no longer sees partial failure.
 */
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? [
        ...new Set(
          body.ids.filter((x): x is string => typeof x === "string"),
        ),
      ].slice(0, 500)
    : [];
  if (ids.length === 0) return Response.json({ error: "no ids" }, { status: 400 });

  // Delete the owned rows in one round-trip; the return tells us which workflows
  // (if any) are still composing so we can stop them. The workflow also self-
  // stops once its row is gone, so terminating after the delete is safe.
  const deleted = await deleteSongs(ids, userId);
  await terminateManyGenerations(deleted.map((r) => r.generation_workflow_id));
  return Response.json({ ok: true, deleted: deleted.length });
}
