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
 * loop lands (2026-07-21, the user; an at-birth auto-run was reversed same
 * day). Runs autoShapeSong: ONE high call authors the whole shape — effect
 * glides AND break fills together, REPLACING both sets (the pill says so
 * before the tap; empty lists clear). Owner-scoped, billed like any
 * generation. Returns the fresh lists so the page can swap them in without a
 * reload.
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
    await autoShapeSong(
      id,
      {
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
        model: song.model ?? "anthropic",
      },
      sql,
    );
    await sink.flush();
    // autoShapeSong is best-effort by design — read back what actually rides
    // now so the client shows the truth (unchanged lists = the model whiffed).
    const fresh = await getSong(id, userId, sql);
    const plan = (fresh?.plan ?? {}) as SongPlan & { overlays?: BreakOverlay[] };
    return Response.json({
      ok: true,
      effects: plan.effects ?? [],
      overlays: plan.overlays ?? [],
    });
  } finally {
    await releaseReservation(gate.id);
  }
}
