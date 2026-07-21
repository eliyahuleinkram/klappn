import { arrangeSong, dressSectionSweeps } from "@/lib/jobs";
import { db } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
import {
  getSongWithParts,
  removeSongSectionListItem,
  setSongEndingMode,
  setSongSectionMoves,
  setSongSectionSweepTake,
  applySongSectionTake,
} from "@/lib/songs";
import { sealDeep } from "@/lib/seal";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * RE-SHAPE the song, on demand. Songs are auto-shaped at composition time
 * (GenerationWorkflow's post-finalize arrange sweep) — this route is the manual
 * re-roll and the catch-up for songs from before auto-arrangement. One HIGH call
 * (lib/arrange-plan) writes plan.arrangement: per-section layer entries/exits,
 * sweeps, one-way overlays, and the ending; the next play renders it.
 *
 * Body (optional): `{ direction }` — the user's own words for how the song
 * should move (the ✎ re-roll); `{ sectionId }` — re-roll ONLY that loop's
 * unfold (the per-loop ✦ button), the model still seeing the whole song.
 * Runs inline; the client awaits it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    direction?: string;
    sectionId?: string;
    targetBars?: number;
    dressEffects?: boolean;
  };
  const direction =
    typeof body.direction === "string" ? body.direction.trim().slice(0, 500) : undefined;
  const onlySectionId =
    typeof body.sectionId === "string" && body.sectionId ? body.sectionId : undefined;
  const targetBars =
    Number.isFinite(body.targetBars) && (body.targetBars as number) > 0
      ? Math.min(256, Math.floor(body.targetBars as number))
      : undefined;
  const dressEffects = body.dressEffects === true && !!onlySectionId;

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {
    const sp = await getSongWithParts(id, userId);
    if (!sp) return Response.json({ error: "not found" }, { status: 404 });
    if (!sp.parts.some((p) => p.status === "ready" && p.strudel?.trim())) {
      return Response.json({ error: "no music to arrange yet" }, { status: 409 });
    }
    // A scoped re-roll must target a real ready section of THIS song.
    if (onlySectionId && !sp.parts.some((p) => p.id === onlySectionId && p.strudel?.trim())) {
      return Response.json({ error: "no such loop" }, { status: 404 });
    }
    const sink = makeCallSink({ songId: id });
    const cfg = {
      onUsage: (t: number) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
      model: sp.song.model ?? "anthropic",
    };
    // KNOB DRESS (lazy on-open fallback): ONE low-effort call names this
    // section's effect knobs — idempotent, never recomposes the unfold.
    if (dressEffects) {
      const sweeps = await dressSectionSweeps(id, onlySectionId!, cfg, db());
      await sink.flush();
      if (!sweeps)
        return Response.json(
          { error: "Couldn’t name the knobs this time — try again." },
          { status: 502 },
        );
      return Response.json(sealDeep({ ok: true, sweeps }));
    }
    const arrangement = await arrangeSong(
      id,
      cfg,
      db(),
      direction,
      onlySectionId,
      targetBars,
    );
    await sink.flush();
    if (!arrangement) {
      return Response.json(
        { error: "Couldn’t arrange this time — try again." },
        { status: 502 },
      );
    }
    // Ending lines are code-bearing → sealed like every strudel response.
    return Response.json(sealDeep({ ok: true, arrangement }));
  } finally {
    await releaseReservation(gate.id);
  }
}

/**
 * The ZERO-AI edits on the unfold (never a model call, all instant, all
 * data-only — no code crosses this handler):
 *  - `{ ending: "stop" | "loop" }` — flip how the song ends.
 *  - `{ sectionId, moves: [{bar, layers[]}] }` — replace one section's layer
 *    timeline (the paint lanes commit).
 *  - `{ sectionId, useBars: n }` — switch to a length already composed (its
 *    cached take swaps in; 409 when uncached — the client composes instead).
 *  - `{ sectionId, sweep: i, take: {from,to,curve,name} }` — wear one of an
 *    effect's takes.
 *  - `{ sectionId, removeOverlay: n }` / `{ sectionId, removeSweep: n }` —
 *    a chip's ✕.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    ending?: string;
    sectionId?: string;
    moves?: { bar?: number; layers?: number[] }[];
    layerCount?: number;
    useBars?: number;
    sweep?: number;
    take?: {
      from?: number;
      to?: number;
      bar?: number;
      bars?: number;
      curve?: string;
      name?: string;
    };
    removeOverlay?: number;
    removeSweep?: number;
  };

  if (body.ending !== undefined) {
    if (body.ending !== "stop" && body.ending !== "loop") {
      return Response.json({ error: "ending must be 'stop' or 'loop'" }, { status: 400 });
    }
    const ok = await setSongEndingMode(id, userId, body.ending);
    if (!ok) return Response.json({ error: "nothing to edit yet" }, { status: 409 });
    return Response.json({ ok: true, ending: body.ending });
  }

  const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";
  if (!sectionId) return Response.json({ error: "sectionId required" }, { status: 400 });

  // SWITCH LENGTH — only ever to a length already composed (a cached take).
  // An uncached length 409s and the client runs the ✦ compose path instead.
  if (body.useBars !== undefined) {
    const bars =
      Number.isFinite(body.useBars) && (body.useBars as number) >= 1
        ? Math.min(256, Math.floor(body.useBars as number))
        : null;
    if (bars == null) return Response.json({ error: "bad bars" }, { status: 400 });
    const spec = await applySongSectionTake(id, userId, sectionId, bars);
    if (!spec)
      return Response.json({ error: "that length isn't composed yet" }, { status: 409 });
    return Response.json(sealDeep({ ok: true, spec }));
  }

  // WEAR A TAKE — swap one effect's from/to/curve/name in place, zero AI.
  if (body.sweep !== undefined) {
    const idx = Number.isInteger(body.sweep) && (body.sweep as number) >= 0 ? (body.sweep as number) : null;
    const t = body.take;
    if (
      idx == null ||
      !t ||
      !Number.isFinite(t.from) ||
      !Number.isFinite(t.to)
    )
      return Response.json({ error: "sweep + take{from,to} required" }, { status: 400 });
    const take = {
      from: t.from as number,
      to: t.to as number,
      curve: t.curve === "sine" ? ("sine" as const) : ("linear" as const),
      ...(Number.isFinite(t.bar) && (t.bar as number) >= 0
        ? { bar: Math.min(512, Math.floor(t.bar as number)) }
        : {}),
      ...(Number.isFinite(t.bars) && (t.bars as number) >= 1
        ? { bars: Math.min(256, Math.floor(t.bars as number)) }
        : {}),
      ...(typeof t.name === "string" && t.name.trim()
        ? { name: t.name.trim().slice(0, 40) }
        : {}),
    };
    const ok = await setSongSectionSweepTake(id, userId, sectionId, idx, take);
    if (!ok) return Response.json({ error: "no such effect" }, { status: 409 });
    return Response.json({ ok: true });
  }

  if (Array.isArray(body.moves)) {
    // Data-only sanitize (ints, sane caps) — the renderer re-validates at play.
    const moves = body.moves
      .filter((m) => m && Number.isFinite(m.bar) && Array.isArray(m.layers))
      .slice(0, 128)
      .map((m) => ({
        bar: Math.max(0, Math.min(512, Math.floor(m.bar as number))),
        layers: (m.layers as number[])
          .filter((i) => Number.isInteger(i) && i >= 1 && i <= 64)
          .slice(0, 64),
      }));
    const layerCount =
      Number.isInteger(body.layerCount) && (body.layerCount as number) >= 1 && (body.layerCount as number) <= 64
        ? (body.layerCount as number)
        : null;
    if (layerCount == null)
      return Response.json({ error: "layerCount required with moves" }, { status: 400 });
    const ok = await setSongSectionMoves(id, userId, sectionId, moves, layerCount);
    if (!ok) return Response.json({ error: "that section isn't in the unfold" }, { status: 409 });
    return Response.json({ ok: true });
  }

  const removal =
    body.removeOverlay !== undefined
      ? ({ kind: "overlays", index: body.removeOverlay } as const)
      : body.removeSweep !== undefined
        ? ({ kind: "sweeps", index: body.removeSweep } as const)
        : null;
  if (removal) {
    if (!Number.isInteger(removal.index) || (removal.index as number) < 0) {
      return Response.json({ error: "bad index" }, { status: 400 });
    }
    const ok = await removeSongSectionListItem(
      id,
      userId,
      sectionId,
      removal.kind,
      removal.index as number,
    );
    if (!ok) return Response.json({ error: "that section isn't in the unfold" }, { status: 409 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "nothing to do" }, { status: 400 });
}
