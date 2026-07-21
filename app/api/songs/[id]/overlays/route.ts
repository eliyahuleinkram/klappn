import { getUserId, unauthorized } from "@/lib/session";
import {
  appendSongOverlays,
  getSongWithParts,
  patchSongOverlay,
  removeSongOverlay,
} from "@/lib/songs";
import { BREAK_KNOBS, breakMoveOf, type BreakOverlay } from "@/lib/breaks-catalog";
import { db } from "@/lib/db";

/**
 * BREAK OVERLAYS (plan.overlays) — deterministic drum rides over loop ranges
 * (lib/breaks-catalog). Same surface shape as the effects route:
 *  - POST { add: {...} }        → user-born break (zero AI), validated + appended
 *  - PATCH { id, gain? , fromId?, toId?, remove? } → tweak / reach / remove
 * (The `{ auto: true }` path moved 2026-07-21: the whole-song sweep lives at
 * POST /api/songs/:id/shape — effects AND breaks in one tap of the pill.)
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
    gain?: number;
    heat?: number;
    tone?: number;
    space?: number;
    fromId?: string;
    toId?: string;
    remove?: boolean;
  };
  const oid = typeof body.id === "string" ? body.id : "";
  if (!oid) return Response.json({ error: "overlay id required" }, { status: 400 });
  if (body.remove === true) {
    const ok = await removeSongOverlay(id, userId, oid);
    if (!ok) return Response.json({ error: "no such break" }, { status: 409 });
    return Response.json({ ok: true });
  }
  const patch: Record<string, unknown> = {};
  for (const k of BREAK_KNOBS) {
    const v = body[k.field];
    if (Number.isFinite(v)) patch[k.field] = Math.min(k.max, Math.max(k.min, v as number));
  }
  if (typeof body.fromId === "string" && body.fromId) patch.fromId = body.fromId;
  if (typeof body.toId === "string" && body.toId) patch.toId = body.toId;
  if (!Object.keys(patch).length)
    return Response.json({ error: "nothing to change" }, { status: 400 });
  const ok = await patchSongOverlay(id, userId, oid, patch);
  if (!ok) return Response.json({ error: "no such break" }, { status: 409 });
  return Response.json({ ok: true });
}

type AddBreak = {
  id?: string;
  tpl?: string;
  gain?: number;
  heat?: number;
  tone?: number;
  space?: number;
  fromId?: string;
  toId?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { add?: AddBreak };
  if (body.add && typeof body.add === "object") return addBreak(id, userId, body.add);
  return Response.json({ error: "add required" }, { status: 400 });
}

async function addBreak(songId: string, userId: string, add: AddBreak): Promise<Response> {
  const sp = await getSongWithParts(songId, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const move = breakMoveOf(String(add.tpl ?? ""));
  if (!move) return Response.json({ error: "unknown break template" }, { status: 400 });
  const fromAt = sp.parts.findIndex((p) => p.id === add.fromId);
  const toAt = sp.parts.findIndex((p) => p.id === (add.toId ?? add.fromId));
  if (fromAt < 0 || toAt < fromAt)
    return Response.json({ error: "bad anchors" }, { status: 400 });
  const knob = (v: unknown, min: number, max: number, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  const overlay: BreakOverlay = {
    id: typeof add.id === "string" && /^[0-9a-f-]{36}$/i.test(add.id) ? add.id : crypto.randomUUID(),
    tpl: move.tpl,
    name: move.word,
    gain: knob(add.gain, 0, 1.2, move.gain),
    heat: knob(add.heat, 0, 0.6, 0),
    tone: knob(add.tone, 0, 1, 1),
    space: knob(add.space, 0, 0.8, 0),
    fromId: add.fromId as string,
    toId: (add.toId ?? add.fromId) as string,
  };
  await appendSongOverlays(songId, [overlay], db());
  return Response.json({ ok: true, overlay });
}
