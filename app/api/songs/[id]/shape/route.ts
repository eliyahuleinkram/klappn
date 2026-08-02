import { getUserId, unauthorized } from "@/lib/session";
import { getSong } from "@/lib/songs";
import { autoShapeSong } from "@/lib/jobs";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { db } from "@/lib/db";
import type { SongPlan } from "@/lib/anthropic";
import type { BreakOverlay } from "@/lib/breaks-catalog";

/**
 * THE WHOLE-SONG SWEEP — one tap on the pill the song page offers after a new
 * loop lands. (A birth run sweeps ITSELF now — see jobs.finishSong — so this
 * route is the re-roll and the path for every later loop; the 2026-07-21 law
 * that nothing else shapes unasked still stands.)
 *
 * Runs autoShapeSong, which is two shapes at once: ONE high call for the
 * effect glides, which span the piece and need the whole arc, then ONE small
 * call PER TURN, all in parallel, each seeing only the two loops it sits
 * between and the glides crossing it. Both sets are REPLACED wholesale (the
 * pill says so before the tap; empty clears). Owner-scoped, billed like any
 * generation. Returns the fresh lists so the page can swap them in without a
 * reload — plus `result`, what the sweep actually DID, so a no-op can say so
 * instead of miming success (2026-07-31).
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
    const sql = db();
    const song = await getSong(id, userId, sql);
    if (!song) return Response.json({ error: "not found" }, { status: 404 });
    const sink = makeCallSink({ songId: id });
    const result = await autoShapeSong(
      id,
      {
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
        model: song.model ?? "anthropic",
      },
      // The app worker's client is the shared Hyperdrive-backed one — handing
      // it out per unit is enough here; the point of the runner is that the
      // sweep no longer keeps hold of anything while the models think.
      (_name, fn) => fn(sql),
    );
    await sink.flush();
    // autoShapeSong is best-effort by design — read back what actually rides
    // now so the client shows the truth (unchanged lists = the model whiffed).
    const fresh = await getSong(id, userId, sql);
    const plan = (fresh?.plan ?? {}) as SongPlan & { overlays?: BreakOverlay[] };
    return Response.json({
      ok: true,
      result,
      effects: plan.effects ?? [],
      overlays: plan.overlays ?? [],
    });
  } finally {
    await releaseReservation(gate.id);
  }
}
