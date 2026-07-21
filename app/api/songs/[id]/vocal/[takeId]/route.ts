import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import { db } from "@/lib/db";
import {
  deleteVocalTake,
  getVocalTake,
  updateVocalTake,
  vocalRawKey,
} from "@/lib/vocal";

export const dynamic = "force-dynamic";

interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}
interface R2Bucketish {
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}
const bucket = (): R2Bucketish | undefined =>
  (env as unknown as { RENDER_CACHE?: R2Bucketish }).RENDER_CACHE;

/** The take's audio — owner-only; the player fetches it into an AudioBuffer. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; takeId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { takeId } = await params;
  const take = await getVocalTake(takeId, userId);
  if (!take) return Response.json({ error: "not found" }, { status: 404 });
  const obj = await bucket()?.get(take.r2_key);
  if (!obj) return Response.json({ error: "audio missing" }, { status: 404 });
  return new Response(await obj.arrayBuffer(), {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "audio/wav",
      "cache-control": "private, max-age=3600",
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; takeId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { takeId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    fx?: Record<string, unknown>;
    lyrics?: { w: string; t0: number; t1: number }[] | null;
    title?: string;
  };
  // Whitelist the editable fields — passing `body` straight through would let a
  // caller set rawR2Key/anchor* (mass assignment): rawR2Key feeds the raw GET,
  // which serves bucket.get(raw_r2_key), i.e. an arbitrary-R2-read primitive.
  const patch: Parameters<typeof updateVocalTake>[2] = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (body.fx !== undefined && typeof body.fx === "object")
    patch.fx = body.fx as Record<string, unknown>;
  if (body.lyrics === null || Array.isArray(body.lyrics))
    patch.lyrics = body.lyrics;
  const ok = await updateVocalTake(takeId, userId, patch);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}

/** REPLACE the take's audio in place — "save as you go": knob/cut changes
 *  re-render and land on the SAME take (and the same R2 key), so the library
 *  never fills with near-duplicates. Knobs ride x-klappn-fx like the create.
 *  A RE-RECORD also carries its raw take (x-klappn-raw-bytes names the LAST
 *  n bytes of the body) and its loop anchor (x-klappn-anchor-* headers) —
 *  both absent on a plain knob re-run, which leaves them untouched. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; takeId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id, takeId } = await params;
  const take = await getVocalTake(takeId, userId);
  if (!take) return Response.json({ error: "not found" }, { status: 404 });
  const MAX = 60 * 1024 * 1024;
  const body = await req.arrayBuffer();
  const rawBytes = Number(req.headers.get("x-klappn-raw-bytes") || 0);
  const renderBytes =
    Number.isFinite(rawBytes) && rawBytes > 0
      ? body.byteLength - rawBytes
      : body.byteLength;
  if (renderBytes <= 0 || renderBytes > MAX || rawBytes > MAX || rawBytes < 0) {
    return Response.json({ error: "take too large" }, { status: 413 });
  }
  const render = rawBytes > 0 ? body.slice(0, renderBytes) : body;
  const raw = rawBytes > 0 ? body.slice(renderBytes) : null;
  const r2 = (env as unknown as {
    RENDER_CACHE?: {
      put(
        key: string,
        value: ArrayBuffer,
        opts?: { httpMetadata?: { contentType?: string } },
      ): Promise<unknown>;
    };
  }).RENDER_CACHE;
  if (!r2) return Response.json({ error: "storage unavailable" }, { status: 503 });
  await r2.put(take.r2_key, render, { httpMetadata: { contentType: "audio/wav" } });
  const rawKey = raw ? vocalRawKey(id, takeId) : undefined;
  if (raw && rawKey) {
    await r2.put(rawKey, raw, { httpMetadata: { contentType: "audio/wav" } });
  }
  let fx: Record<string, unknown> | undefined;
  try {
    fx = JSON.parse(req.headers.get("x-klappn-fx") || "");
  } catch {
    fx = undefined;
  }
  const durationMs = Number(req.headers.get("x-klappn-duration") || 0) || undefined;
  // The anchor, validated against the song's own parts (a deleted part means
  // "no anchor", never a failed save); header absent = leave the row's alone.
  let anchorPartId: string | null | undefined;
  let anchorOffsetSec: number | null | undefined;
  const anchorHdr = (req.headers.get("x-klappn-anchor-part") || "").trim();
  if (anchorHdr) {
    const sql = db();
    const rows = await sql`
      select id from parts where id = ${anchorHdr} and song_id = ${id}`;
    anchorPartId = rows.length ? anchorHdr : null;
    const off = Number(req.headers.get("x-klappn-anchor-offset") || 0);
    anchorOffsetSec = Number.isFinite(off) ? off : 0;
  }
  await updateVocalTake(takeId, userId, {
    fx,
    durationMs,
    rawR2Key: rawKey,
    anchorPartId,
    anchorOffsetSec,
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; takeId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { takeId } = await params;
  const gone = await deleteVocalTake(takeId, userId);
  if (!gone) return Response.json({ error: "not found" }, { status: 404 });
  try {
    await bucket()?.delete(gone.r2_key);
    if (gone.raw_r2_key) await bucket()?.delete(gone.raw_r2_key);
  } catch {
    /* orphaned audio is harmless */
  }
  return Response.json({ ok: true });
}
