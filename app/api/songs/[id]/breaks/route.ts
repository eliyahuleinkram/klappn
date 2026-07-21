import { generateBreaks, type SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import { getSongWithParts, saveBreakOptions, setBreakChoice, type BreakSet } from "@/lib/songs";
import { stripHydraBlock } from "@/lib/hydra-embed";
import { stripMetaBlocks } from "@/lib/controls";
import { strudelServerErrors } from "@/lib/strudel-interp";
import { flagIssue } from "@/lib/issues";
import { sealDeep } from "@/lib/seal";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * Compose THE BREAK for one gap — a one-bar easing between the loop `afterPartId`
 * and the loop that follows it, AI-written from both neighbours' code and
 * AUTO-APPLIED the moment it lands (↻ regenerate replaces it; None removes it).
 * Composed once per gap (cached on song.plan.breaks). Runs inline; the client
 * awaits it. Body `{ afterPartId, regenerate?, prompt? }` — a prompt is the
 * user's own direction for the hand-off and always means a fresh compose.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    afterPartId?: string;
    regenerate?: boolean;
    prompt?: string;
  };
  if (!body.afterPartId) {
    return Response.json({ error: "afterPartId required" }, { status: 400 });
  }
  // The user's direction for this hand-off — it rides into ONE generateBreaks
  // call below and is never persisted.
  const direction =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";

  const sp = await getSongWithParts(id, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const { song, parts } = sp;

  const sorted = [...parts].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((p) => p.id === body.afterPartId);
  const from = sorted[i];
  const to = i >= 0 ? sorted[i + 1] : undefined;
  if (!from?.strudel?.trim() || !to?.strudel?.trim()) {
    return Response.json(
      { error: "both loops around this gap must be finished first" },
      { status: 409 },
    );
  }

  // Already composed for this gap → return the cached set (choosing is free).
  const plan = (song.plan as SongPlan & { breaks?: Record<string, BreakSet> }) || {};
  const existing = plan.breaks?.[from.id];
  if (existing?.options?.length && !body.regenerate && !direction) {
    return Response.json(sealDeep({ ok: true, set: existing }));
  }
  // regenerate (or a user direction): fall through to compose a FRESH set of
  // options (saveBreakOptions overwrites).

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  // Hand the model each neighbour as its per-layer Strudel (`notation`) so it borrows the real sounds,
  // falling back to the stripped played Strudel for old parts that have no per-layer notation.
  const neighbourContext = (p: { tracks?: unknown; strudel?: string | null }): string => {
    const tks = (Array.isArray(p.tracks) ? p.tracks : []) as Array<{ notation?: string }>;
    return tks.length && tks.every((t) => t.notation)
      ? tks.map((t) => `$: ${t.notation}`).join("\n")
      : stripMetaBlocks(stripHydraBlock(p.strudel ?? ""));
  };
  // ONE break per compose — and since a single candidate leaves no slack, a compose whose
  // candidate fails the play-gate gets a retry FED THE REAL GATE ERRORS (a fresh roll wastes
  // the model's good musical idea over one bad sound name), then one final fresh attempt.
  const sink = makeCallSink({ songId: id, partId: from.id });
  const options: { label: string; strudel: string }[] = [];
  let feedback = "";
  for (let attempt = 0; attempt < 3 && options.length === 0; attempt++) {
    const candidates = await generateBreaks(
      {
        plan: plan as SongPlan,
        fromMusic: neighbourContext(from),
        toMusic: neighbourContext(to),
        direction: direction || undefined,
        feedback: attempt === 1 ? feedback : undefined, // attempt 2 fixes; attempt 3 rolls fresh
      },
      {
        onUsage: (t) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
        model: song.model ?? "anthropic",
      },
    );
    // Keep only a break that passes the full server eval; the browser self-heal covers the rest.
    for (const c of candidates) {
      const errs = await strudelServerErrors(c.strudel, {
        bpm: (plan as SongPlan).bpm,
        timeSignature: (plan as SongPlan).timeSignature,
      });
      if (errs.length) {
        feedback = errs.join("\n");
        await flagIssue("break-gate", errs.join("; "), { songId: id, partId: from.id });
        continue;
      }
      options.push(c);
    }
  }
  await sink.flush();
  if (options.length === 0) {
    await flagIssue("break-compose-failed", "no candidate passed the gate after 3 attempts", {
      songId: id,
      partId: from.id,
    });
    return Response.json(
      { error: "Couldn’t compose the break for this gap — try again." },
      { status: 502 },
    );
  }

  const set = await saveBreakOptions(id, userId, from.id, options);
  if (!set) return Response.json({ error: "not found" }, { status: 404 });
  // Freshly composed → wear it right away (one break, applied; the picker offers None / ↻).
  await setBreakChoice(id, userId, from.id, 0);
  return Response.json(sealDeep({ ok: true, set: { ...set, chosen: 0 } }));
  } finally {
    await releaseReservation(gate.id);
  }
}
