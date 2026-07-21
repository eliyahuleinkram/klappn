import { getUserId, unauthorized } from "@/lib/session";
import { appendSongEffects, getSongWithParts, patchSongEffect, removeSongEffect } from "@/lib/songs";
import { BUS_REBUILD_PARAMS } from "@/lib/arrange-plan";
import type { SongFx, SweepControl } from "@/lib/arrange";
import { enrichSweepControls } from "@/lib/arrange-plan";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { db } from "@/lib/db";
import type { SongPlan } from "@/lib/anthropic";
import { computeLoopBars } from "@/lib/loop-length";

/**
 * SONG-LEVEL EFFECTS (chapters era) — the zero-AI edits on plan.effects:
 *  - `{ id, from, to }` — ride an effect's glide (knob release persists here).
 *  - `{ id, remove: true }` — the band's ✕.
 * All data-only, owner-scoped, instant.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    from?: number;
    to?: number;
    fromId?: string;
    toId?: string;
    remove?: boolean;
  };
  const fxId = typeof body.id === "string" ? body.id : "";
  if (!fxId) return Response.json({ error: "effect id required" }, { status: 400 });
  if (body.remove === true) {
    const ok = await removeSongEffect(id, userId, fxId);
    if (!ok) return Response.json({ error: "no such effect" }, { status: 409 });
    return Response.json({ ok: true });
  }
  // Values (a knob ride) and/or anchors (the Reach ± stretching the span).
  const patch: Record<string, unknown> = {};
  if (Number.isFinite(body.from) && Number.isFinite(body.to)) {
    patch.from = body.from;
    patch.to = body.to;
  }
  if (typeof body.fromId === "string" && body.fromId) patch.fromId = body.fromId;
  if (typeof body.toId === "string" && body.toId) patch.toId = body.toId;
  if (!Object.keys(patch).length)
    return Response.json({ error: "nothing to change" }, { status: 400 });
  const ok = await patchSongEffect(id, userId, fxId, patch);
  if (!ok) return Response.json({ error: "no such effect" }, { status: 409 });
  return Response.json({ ok: true });
}

/** A user-born effect (zero AI): `{ add: {...} }` — validated, appended. */
type AddFx = {
  id?: string;
  param?: string;
  from?: number;
  to?: number;
  curve?: string;
  name?: string;
  fromId?: string;
  toId?: string;
  controls?: unknown;
};
async function addEffect(
  songId: string,
  userId: string,
  add: AddFx,
): Promise<Response> {
  const sp = await getSongWithParts(songId, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const param = typeof add.param === "string" ? add.param.trim() : "";
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(param) || !Number.isFinite(add.from) || !Number.isFinite(add.to))
    return Response.json({ error: "param/from/to required" }, { status: 400 });
  if (BUS_REBUILD_PARAMS.test(param))
    return Response.json(
      { error: "that parameter rebuilds a shared bus — it can't glide" },
      { status: 400 },
    );
  const fromAt = sp.parts.findIndex((p) => p.id === add.fromId);
  const toAt = sp.parts.findIndex((p) => p.id === add.toId);
  if (fromAt < 0 || toAt < fromAt)
    return Response.json({ error: "bad anchors" }, { status: 400 });
  const controls: SweepControl[] = Array.isArray(add.controls)
    ? (add.controls as unknown[])
        .filter(
          (c): c is SweepControl =>
            !!c &&
            typeof c === "object" &&
            typeof (c as SweepControl).name === "string" &&
            ((c as SweepControl).field === "from" || (c as SweepControl).field === "to") &&
            Number.isFinite((c as SweepControl).min) &&
            Number.isFinite((c as SweepControl).max),
        )
        .slice(0, 4)
        .map((c) => ({ name: c.name.slice(0, 40), field: c.field, min: c.min, max: c.max }))
    : [];
  const fx: SongFx = {
    // the client mints the id so its optimistic copy IS the saved one
    id: typeof add.id === "string" && /^[0-9a-f-]{36}$/i.test(add.id) ? add.id : crypto.randomUUID(),
    param,
    from: add.from as number,
    to: add.to as number,
    curve: add.curve === "sine" ? "sine" : "linear",
    ...(typeof add.name === "string" && add.name.trim() ? { name: add.name.trim().slice(0, 60) } : {}),
    home: { from: add.from as number, to: add.to as number },
    ...(controls.length ? { controls } : {}),
    fromId: add.fromId as string,
    toId: add.toId as string,
  };
  await appendSongEffects(songId, [fx], db());
  return Response.json({ ok: true, effect: fx });
}

/**
 * LAZY KNOB DRESS for a song effect (the fx-enrich pattern): a band opened
 * with no controls yet runs ONE low-effort call and persists them. Idempotent.
 * Body: `{ id }`. Or a user-born effect: `{ add: {...} }` (zero AI).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { id?: string; add?: AddFx };
  if (body.add && typeof body.add === "object") return addEffect(id, userId, body.add);
  // (The `{ auto: true }` path moved 2026-07-21: the whole-song sweep lives at
  // POST /api/songs/:id/shape — effects AND breaks in one tap of the pill.)
  const fxId = typeof body.id === "string" ? body.id : "";
  if (!fxId) return Response.json({ error: "effect id required" }, { status: 400 });
  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {
    const sp = await getSongWithParts(id, userId);
    if (!sp) return Response.json({ error: "not found" }, { status: 404 });
    const plan = sp.song.plan as SongPlan;
    const fx = (plan.effects ?? []).find((e) => e.id === fxId);
    if (!fx) return Response.json({ error: "no such effect" }, { status: 409 });
    if (fx.controls?.length) return Response.json({ ok: true, controls: fx.controls });
    const anchor = sp.parts.find((p) => p.id === fx.fromId);
    const spanBars = Math.max(
      1,
      computeLoopBars(anchor?.strudel || "") || anchor?.bars || 4,
    );
    const sink = makeCallSink({ songId: id });
    const dressed = await enrichSweepControls(
      {
        genre: plan.genre,
        section: [anchor?.label, anchor?.intent].filter(Boolean).join(" — "),
        sweeps: [
          {
            param: fx.param,
            from: fx.from,
            to: fx.to,
            bar: 0,
            bars: spanBars,
            curve: fx.curve,
            name: fx.name,
          },
        ],
      },
      {
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
        model: sp.song.model ?? "anthropic",
      },
    ).catch(() => null);
    await sink.flush();
    const controls = dressed?.[0]?.controls ?? [];
    if (!controls.length)
      return Response.json(
        { error: "Couldn’t name the knobs this time — try again." },
        { status: 502 },
      );
    await patchSongEffect(id, null, fxId, { controls }, db());
    return Response.json({ ok: true, controls });
  } finally {
    await releaseReservation(gate.id);
  }
}

