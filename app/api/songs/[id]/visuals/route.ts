import { type SongPlan } from "@/lib/anthropic";
import { stripMetaBlocks } from "@/lib/controls";
import { attachVisualBlocks, stripHydraBlock } from "@/lib/hydra-embed";
import { paintSongVisual } from "@/lib/jobs";
import { getUserId, unauthorized } from "@/lib/session";
import { getSongWithParts, saveSongVisual, writePartStrudel } from "@/lib/songs";
import { sealDeep } from "@/lib/seal";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * REPAINT the song's visual, on demand. Songs are auto-painted at composition time
 * (GenerationWorkflow paints in parallel with the first loop) — this route is the
 * manual re-roll behind the "↻ Repaint" chip, and the catch-up paint for songs from
 * before auto-visuals (or whose auto-paint failed). One HIGH-effort Hydra call synced
 * to the requested part's music — always a FRESH look (no hand-off of the previous
 * take) — then one LOW-effort pass that names its one-tap looks. The deterministic
 * colour-grade (@vcontrols) rails are attached in code.
 *
 * Body `{ partId }`. Runs inline; the client awaits it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { partId?: string };
  if (!body.partId) return Response.json({ error: "partId required" }, { status: 400 });

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const sp = await getSongWithParts(id, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const { song, parts } = sp;
  const part = parts.find((p) => p.id === body.partId);
  if (!part?.strudel?.trim()) {
    return Response.json({ error: "that part has no music yet" }, { status: 409 });
  }
  const plan = (song.plan as SongPlan) || { summary: "", bpm: 120, key: "A minor", parts: [] };

  // NO continuity hand-off: painting writes ONE visual across the WHOLE song, so the only
  // "neighbour" a paint could see is the previous take itself — feeding it back ("CONTINUE this
  // palette, do NOT restart") locked every re-paint into reproducing the old look (a song whose
  // visual came out dark could never re-roll out of it). A paint is a FRESH look, every time.
  // The visual reads the MUSIC only — the @controls/@swaps/@edits meta blocks and their
  // consts are UI plumbing, dead tokens to a visual call.
  const music = stripMetaBlocks(stripHydraBlock(part.strudel));
  const sink = makeCallSink({ songId: id, partId: part.id });
  const visual = await paintSongVisual(
    music,
    plan,
    part.intent ?? undefined,
    // model = the song's chosen model; meter usage to this user.
    {
      onUsage: (t) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
      model: song.model ?? "anthropic",
    },
  );
  await sink.flush();
  if (!visual) {
    return Response.json(
      { error: "Couldn’t paint visuals this time — try again." },
      { status: 502 },
    );
  }

  // CANONICAL copy on the plan: a section composed later with no painted neighbour
  // attaches this (and the auto-paint trigger sees the song as already painted).
  await saveSongVisual(id, visual);

  // ONE visual for the WHOLE song: write the SAME @hydra (+ the deterministic @vcontrols grade
  // + its @vlooks) onto EVERY part, each keeping its own music. So the visual is IDENTICAL
  // across loops and flows seamlessly section→section — only its H()-synced state advances —
  // never a different sketch per part (which read as a jarring "step change" when the song
  // moved between loops). The sketch is generated once (above, from the requested part) and shared.
  let requested = "";
  for (const p of parts) {
    if (!p.strudel?.trim()) continue;
    const withHydra = attachVisualBlocks(p.strudel, visual);
    await writePartStrudel(p.id, withHydra, "ready");
    if (p.id === part.id) requested = withHydra;
  }
  // Return the requested part's new code so the client lights the (shared) visual up IMMEDIATELY.
  return Response.json(sealDeep({ ok: true, strudel: requested }));
  } finally {
    await releaseReservation(gate.id);
  }
}
