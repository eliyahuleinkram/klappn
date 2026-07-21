import {
  deleteSong,
  getSong,
  getSongWithParts,
  moveBreak,
  patchSongPlan,
  reconcileStaleGeneration,
  restoreMeterFromCache,
  setBreakChoice,
  setBridge,
  setPartStatus,
  setSongPlaylist,
  setSongTitle,
} from "@/lib/songs";
import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";
import { terminateGeneration, triggerMeterChange } from "@/lib/workflows";
import { releaseReservation, reserveQuota } from "@/lib/billing";
import { beatsPerBar } from "@/lib/playback";

// This route is POLLED every ~2s for live generation progress, so it must NEVER be
// cached — the page is force-dynamic, but the poll API was not, so its responses
// could be edge-cached and updates lagged until a manual refresh. force-dynamic +
// no-store on the response guarantees every poll sees the latest tracks/status.
export const dynamic = "force-dynamic";

// Mutate a workspace. One of:
//   { title }                        — rename
//   { playlist }                     — put in a playlist (null clears)
//   { bridge: { fromPartId, type } } — set/clear a transition (Phase 2)
//   { settings: { transpose?, bpm? } } — manual playback transforms (Phase 3)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    playlist?: string | null;
    bridge?: { fromPartId?: string; type?: string };
    breakChoice?: { afterPartId?: string; choice?: number | null };
    breakMove?: { fromPartId?: string; toPartId?: string };
    sound?: { brightness?: number; punch?: number; space?: number };
    holdCycles?: Record<string, number>;
    settings?: { transpose?: number; bpm?: number; key?: string; genre?: string };
    timeSignature?: string;
  } | null;
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  // TIME SIGNATURE — a structural rework: EVERY loop is rewritten in sequence
  // (1st, then 2nd, …) at pill-grade effort. Quota-gated like generation.
  if (typeof body.timeSignature === "string") {
    const ts = body.timeSignature.replace(/\s/g, "");
    if (!/^\d{1,2}\/\d{1,2}$/.test(ts) || beatsPerBar(ts) < 2 || beatsPerBar(ts) > 12) {
      return Response.json({ error: "bad time signature" }, { status: 400 });
    }
    const sp = await getSongWithParts(id, userId);
    if (!sp) return Response.json({ error: "not found" }, { status: 404 });
    const plan = (sp.song.plan ?? {}) as {
      timeSignature?: string;
      meterCache?: Record<string, { id: string; strudel: string; tracks: unknown }[]>;
    };
    const current = plan.timeSignature || "4/4";
    if (current === ts) return Response.json({ ok: true });
    if (
      sp.song.status === "generating" ||
      sp.parts.some((p) => p.status === "generating")
    ) {
      return Response.json(
        { error: "this song is already being reworked — let it finish first" },
        { status: 409 },
      );
    }
    // Snapshot the CURRENT render under its meter, so switching back to it later is
    // instant (no regeneration).
    const cache = { ...(plan.meterCache ?? {}) };
    cache[current] = sp.parts
      .filter((p) => p.strudel?.trim())
      .map((p) => ({ id: p.id, strudel: p.strudel as string, tracks: p.tracks }));
    // Already rendered THIS meter before? RESTORE it instantly — no AI rework.
    const cached = cache[ts];
    if (cached?.length) {
      await restoreMeterFromCache(id, userId, ts, cached, cache);
      return Response.json({ ok: true, restored: true });
    }
    // First time in this meter → rework. Persist the snapshot, mark every loop
    // reworking NOW so the UI shows loading the instant you tap (the workflow is
    // async — without this the status only flips once the workflow gets going),
    // then fire the rework.
    const gate = await reserveQuota(userId);
    if (!gate.ok) return gate.response;
    try {
      await patchSongPlan(id, userId, { meterCache: cache });
      await Promise.all(
        sp.parts
          .filter((p) => p.strudel?.trim())
          .map((p) => setPartStatus(p.id, "generating")),
      );
      try {
        await triggerMeterChange(id, ts);
      } catch (e) {
        console.error(`[klappn] meter trigger failed for ${id}:`, e);
        return Response.json({ error: "couldn’t start the rework" }, { status: 500 });
      }
      return Response.json({ ok: true }, { status: 202 });
    } finally {
      await releaseReservation(gate.id);
    }
  }

  // Song-wide SOUND dials (the mix-bus performance layer) — clamped, stored on
  // the plan, applied at play time only (the loops themselves never change).
  if (body.sound && typeof body.sound === "object") {
    const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
    };
    const sound = {
      brightness: clamp(body.sound.brightness, 400, 12000, 12000),
      punch: clamp(body.sound.punch, 0, 0.5, 0),
      space: clamp(body.sound.space, 0, 0.6, 0),
    };
    const ok = await patchSongPlan(id, userId, { sound });
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  // Per-loop REPEAT latches — JSON-safe map keyed by part id: -1 = forever, an integer
  // count (2/4/8), key absent = off. Validated, stored on the plan, used at play time only
  // (the loops themselves never change). Mirrors the `sound` branch.
  if (body.holdCycles && typeof body.holdCycles === "object") {
    const clean: Record<string, number> = {};
    for (const [k, raw] of Object.entries(body.holdCycles)) {
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n)) continue;
      if (n === -1) clean[k] = -1; // forever sentinel
      else if (n >= 2 && n <= 64) clean[k] = n; // a sane repeat count
      // anything else (0, 1, NaN) = "off" → omit the key
    }
    const ok = await patchSongPlan(id, userId, { holdCycles: clean });
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  // Move a gap's BREAK to another gap (re-key; swaps if the target wears one) —
  // instant, deterministic, no AI. The arrange surface drags beads with this.
  if (
    body.breakMove &&
    typeof body.breakMove.fromPartId === "string" &&
    typeof body.breakMove.toPartId === "string"
  ) {
    const ok = await moveBreak(
      id,
      userId,
      body.breakMove.fromPartId,
      body.breakMove.toPartId,
    );
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  // Pick which one-bar BREAK a gap wears (null = none) — instant, no AI.
  if (body.breakChoice && typeof body.breakChoice.afterPartId === "string") {
    const ok = await setBreakChoice(
      id,
      userId,
      body.breakChoice.afterPartId,
      typeof body.breakChoice.choice === "number" ? body.breakChoice.choice : null,
    );
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if ("playlist" in body) {
    const ok = await setSongPlaylist(
      id,
      userId,
      typeof body.playlist === "string" ? body.playlist : null,
    );
    if (!ok) return Response.json({ error: "couldn’t set playlist" }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (typeof body.title === "string") {
    const ok = await setSongTitle(id, userId, body.title);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body.bridge && typeof body.bridge.fromPartId === "string") {
    const ok = await setBridge(
      id,
      userId,
      body.bridge.fromPartId,
      String(body.bridge.type || "cut"),
    );
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body.settings && typeof body.settings === "object") {
    const patch: Record<string, unknown> = {};
    if (typeof body.settings.transpose === "number") {
      patch.transpose = Math.max(-24, Math.min(24, Math.round(body.settings.transpose)));
    }
    if (typeof body.settings.bpm === "number") {
      patch.bpm = Math.max(40, Math.min(220, Math.round(body.settings.bpm)));
    }
    if (typeof body.settings.key === "string") {
      patch.key = body.settings.key.trim().slice(0, 40) || "A minor";
    }
    if (typeof body.settings.genre === "string") {
      patch.genre = body.settings.genre.trim().slice(0, 40);
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "no valid settings" }, { status: 400 });
    }
    const ok = await patchSongPlan(id, userId, patch);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "nothing to update" }, { status: 400 });
}

// Polled by the client every ~2s while a song is generating. Ownership-scoped:
// returns 404 (not 403) for songs that aren't the session user's, so ids don't
// leak existence.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  let result = await getSongWithParts(id, userId);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  // RECOVERY: if anything claims to be composing, settle dead runs so a killed
  // workflow can never leave this song locked + polling forever.
  if (
    result.song.status === "generating" ||
    result.parts.some((p) => p.status === "generating")
  ) {
    if (await reconcileStaleGeneration(id)) {
      result = (await getSongWithParts(id, userId)) ?? result;
    }
  }
  // Loop code crosses the wire sealed (see lib/seal.ts) — the client opens it.
  return Response.json(sealDeep(result), {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}

// Delete a song (parts cascade). Ownership-scoped: only the session user can
// delete their own song; a non-owner / unknown id gets 404 (ids don't leak).
// We STOP its generation Workflow first — otherwise the instance keeps running,
// burning model calls writing to parts that no longer exist.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  // Fetch first (ownership check + grab the running instance id), then halt the
  // Workflow, then delete. The workflow also self-stops once the row is gone.
  const song = await getSong(id, userId);
  if (!song) return Response.json({ error: "not found" }, { status: 404 });
  await terminateGeneration(song.generation_workflow_id);
  await deleteSong(id, userId);
  return Response.json({ ok: true });
}
