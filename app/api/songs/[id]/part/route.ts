import { deriveAdjacentPart, type SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import {
  getSongWithParts,
  injectPart,
  saveSongDirection,
  setGenerationWorkflowId,
  setPartStatus,
  setSongStatus,
} from "@/lib/songs";
import { triggerGeneration } from "@/lib/workflows";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * Add ONE new loop to a song — prepend ("before"), append ("after"), or slot it
 * into ANY gap (`position`: 0..parts.length, the index the new loop will take).
 *
 * SEAMS ARE SACRED: the new loop is composed seeing its neighbours' full code
 * and must OVERLAP at the edges — open with the sounds the previous loop ends
 * with, and (when something follows) converge so its final bar already plays
 * the sounds the next loop opens with. The blend critic verifies the hand-off.
 *
 * Body `{ side?: "before" | "after", position?: number, prompt? }` — `position`
 * wins when given; `side` remains for the edge affordances.
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

  const body = (await req.json().catch(() => ({}))) as {
    side?: string;
    position?: number;
    prompt?: string;
    kind?: string;
  };
  const prompt = (body.prompt || "").trim().slice(0, 2000);
  // A BREAK is a loop that knows what it's for. There is no break button
  // anymore (2026-07-14) — the WORDS decide: the derive reads the direction
  // and returns kind "break" when it asks for a hand-off. An explicit body
  // kind still forces it (API compat).
  const requestedKind: "loop" | "break" | undefined =
    body.kind === "break" ? "break" : undefined;

  const sp = await getSongWithParts(id, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const { song, parts } = sp;
  const plan = (song.plan as SongPlan) || {
    summary: "",
    bpm: 120,
    key: "A minor",
    parts: [],
  };

  const sorted = [...parts].sort((a, b) => a.position - b.position);
  const isBusy = (p?: { status: string }) =>
    !!p && (p.status === "pending" || p.status === "generating");

  // WHERE the new loop lands: an explicit gap index (0..n, from the arrange
  // surface) wins; the edge affordances still send side "before"/"after".
  const position =
    typeof body.position === "number" && Number.isFinite(body.position)
      ? Math.max(0, Math.min(sorted.length, Math.floor(body.position)))
      : body.side === "before"
        ? 0
        : sorted.length;
  const side: "before" | "after" | "between" =
    position === 0 ? "before" : position === sorted.length ? "after" : "between";

  // Per-gap lock: don't slot a new part against a neighbour that's still building
  // (its code — which the new loop must overlap with — doesn't exist yet).
  if (isBusy(sorted[position - 1]) || isBusy(sorted[position])) {
    return Response.json(
      { error: "That spot is still building — let it finish first." },
      { status: 409 },
    );
  }

  // Plan the new section from the full arrangement + the user's direction, so it
  // realizes what they asked for AND overlaps cleanly with its neighbours.
  const sink = makeCallSink({ songId: id }); // the derive call carries the user's raw direction
  const d = await deriveAdjacentPart(
    {
      plan,
      // bars ride along so the derive can match the song's existing loop
      // lengths (its bars come back clamped 2..8; injectPart re-clamps 2..32).
      parts: sorted.map((p) => ({
        label: p.label ?? "",
        intent: p.intent ?? "",
        bars: p.bars,
      })),
      side,
      at: side === "between" ? position : undefined,
      prompt,
      kind: requestedKind,
    },
    {
      onUsage: (t) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
      model: song.model ?? "anthropic",
    },
  );
  await sink.flush();

  // THE SONG'S DIRECTION NOTE follows the words: when the derive judged the
  // user's direction a whole-track steer, its rewritten note lands on
  // plan.direction — every later compose/extend/edit reads it. Best-effort.
  if (d.direction && d.direction !== (plan.direction ?? "").trim())
    await saveSongDirection(id, d.direction).catch(() => {});

  // Append lands via the "end" sentinel — the index is computed inside the
  // insert transaction, so a concurrent extend-before can't stale our tail.
  const part = await injectPart(
    id,
    side === "after" && typeof body.position !== "number" ? "end" : position,
    d.label,
    d.intent,
    d.bars,
    d.kind,
  );

  const prevStatus = song.status;
  await setSongStatus(id, "generating");
  try {
    const wf = await triggerGeneration(id, part.id); // compose ONLY the new part
    await setGenerationWorkflowId(id, wf);
  } catch (e) {
    // Don't strand the song in "generating" — and don't strand the PART either:
    // the client renders `pending` with the same growing card as `generating`,
    // so a failed kick-off left `pending` looked like an eternal load (seen
    // live 2026-07-22). `error` is the status with a "Try again" button.
    console.error(`[klappn] trigger failed for new part ${part.id}:`, e);
    await setPartStatus(part.id, "error").catch(() => {});
    await setSongStatus(id, prevStatus).catch(() => {});
    return Response.json(
      { error: "The section was added but composing didn’t start — tap Try again on it." },
      { status: 502 },
    );
  }

  return Response.json({ partId: part.id, status: "generating" }, { status: 201 });
  } finally {
    await releaseReservation(gate.id);
  }
}
