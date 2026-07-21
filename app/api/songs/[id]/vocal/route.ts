import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import { db } from "@/lib/db";
import {
  createVocalTake,
  deleteVocalTake,
  listVocalTakes,
  updateVocalTake,
  vocalKey,
  vocalRawKey,
} from "@/lib/vocal";

export const dynamic = "force-dynamic";

/** A SONG HAS ONE VOICE. GET reads it (list shape kept for the client);
 *  PUT uploads the processed render — REPLACING the song's existing voice
 *  in place when one exists (same row, same R2 key; rows never accumulate),
 *  creating the row only when the song has none. The body is the finished
 *  WAV (the browser already cleaned/tuned/timed it); knobs ride in
 *  x-klappn-fx so the voice plays back exactly as auditioned.
 *
 *  A FRESH RECORDING also carries its RAW take (echo-cancelled, unprocessed
 *  mono WAV — the re-tune source) in the SAME round trip: the body is the
 *  render + the raw concatenated, x-klappn-raw-bytes names the raw's byte
 *  length (the LAST n bytes). The recording's loop ANCHOR rides dedicated
 *  headers (x-klappn-anchor-part / x-klappn-anchor-offset) — see lib/vocal. */

const MAX_BYTES = 60 * 1024 * 1024; // per part (render / raw)

interface R2Bucketish {
  put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}
const bucket = (): R2Bucketish | undefined =>
  (env as unknown as { RENDER_CACHE?: R2Bucketish }).RENDER_CACHE;

async function ownsSong(songId: string, userId: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    select id from songs where id = ${songId} and user_id = ${userId}`;
  return rows.length > 0;
}

/** The recording's loop anchor from the request headers — validated against
 *  the song's own parts (a part deleted mid-save must not fail the take on a
 *  foreign-key error; it just means "no anchor"). Undefined = headers absent
 *  (a knob re-run) — leave the row's anchor alone. */
async function anchorFrom(
  req: Request,
  songId: string,
): Promise<{ partId: string | null; offsetSec: number } | undefined> {
  const part = (req.headers.get("x-klappn-anchor-part") || "").trim();
  if (!part) return undefined;
  const offset = Number(req.headers.get("x-klappn-anchor-offset") || 0);
  const sql = db();
  const rows = await sql`
    select id from parts where id = ${part} and song_id = ${songId}`;
  return {
    partId: rows.length ? part : null,
    offsetSec: Number.isFinite(offset) ? offset : 0,
  };
}

/** Split a PUT body into render + optional raw via x-klappn-raw-bytes (the
 *  raw is the LAST n bytes). Null = malformed sizes. */
function splitBody(
  req: Request,
  body: ArrayBuffer,
): { render: ArrayBuffer; raw: ArrayBuffer | null } | null {
  const rawBytes = Number(req.headers.get("x-klappn-raw-bytes") || 0);
  if (!Number.isFinite(rawBytes) || rawBytes < 0) return null;
  if (!rawBytes) {
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;
    return { render: body, raw: null };
  }
  const renderBytes = body.byteLength - rawBytes;
  if (renderBytes <= 0 || renderBytes > MAX_BYTES || rawBytes > MAX_BYTES)
    return null;
  return {
    render: body.slice(0, renderBytes),
    raw: body.slice(renderBytes),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const takes = await listVocalTakes(id, userId);
  return Response.json({ takes }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!(await ownsSong(id, userId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.arrayBuffer();
  const split = splitBody(req, body);
  if (!split) {
    return Response.json({ error: "take too large" }, { status: 413 });
  }
  const durationMs = Number(req.headers.get("x-klappn-duration") || 0);
  const title = (req.headers.get("x-klappn-title") || "").trim() || null;
  let fx: Record<string, unknown> = {};
  try {
    fx = JSON.parse(req.headers.get("x-klappn-fx") || "{}");
  } catch {
    /* knobs are optional */
  }
  const anchor = await anchorFrom(req, id);

  const r2 = bucket();
  if (!r2) return Response.json({ error: "storage unavailable" }, { status: 503 });

  // ONE voice per song: an existing row is REPLACED in place (audio, fx,
  // duration — same id, same key). Legacy multi-take songs collapse to one
  // here: extras beyond the newest are swept away with their audio.
  const existing = await listVocalTakes(id, userId);
  const current = existing[0];
  if (current) {
    for (const extra of existing.slice(1)) {
      const gone = await deleteVocalTake(extra.id, userId);
      if (gone) {
        try {
          await r2.delete(gone.r2_key);
          if (gone.raw_r2_key) await r2.delete(gone.raw_r2_key);
        } catch {
          /* orphaned audio is harmless */
        }
      }
    }
    await r2.put(current.r2_key, split.render, {
      httpMetadata: { contentType: "audio/wav" },
    });
    const rawKey = split.raw ? vocalRawKey(id, current.id) : undefined;
    if (split.raw && rawKey) {
      await r2.put(rawKey, split.raw, {
        httpMetadata: { contentType: "audio/wav" },
      });
    }
    await updateVocalTake(current.id, userId, {
      fx,
      durationMs,
      title: title ?? undefined,
      rawR2Key: rawKey,
      anchorPartId: anchor?.partId,
      anchorOffsetSec: anchor === undefined ? undefined : anchor.offsetSec,
    });
    return Response.json({
      take: {
        ...current,
        fx,
        duration_ms: Math.max(0, Math.round(durationMs)),
        title: title ?? current.title,
        raw_r2_key: rawKey ?? current.raw_r2_key,
        anchor_part_id:
          anchor === undefined ? current.anchor_part_id : anchor.partId,
        anchor_offset_sec:
          anchor === undefined ? current.anchor_offset_sec : anchor.offsetSec,
      },
    });
  }

  const take = await createVocalTake(id, userId, durationMs, fx, title, undefined, {
    withRaw: !!split.raw,
    anchorPartId: anchor?.partId ?? null,
    anchorOffsetSec: anchor?.offsetSec ?? null,
  });
  await r2.put(vocalKey(id, take.id), split.render, {
    httpMetadata: { contentType: "audio/wav" },
  });
  if (split.raw) {
    await r2.put(vocalRawKey(id, take.id), split.raw, {
      httpMetadata: { contentType: "audio/wav" },
    });
  }
  return Response.json({ take }, { status: 201 });
}
