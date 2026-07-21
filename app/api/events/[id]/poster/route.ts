import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import { getEvent, setEventPoster } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * POSTER upload — the event's one image, stored in R2 (the RENDER_CACHE bucket
 * under an events/ prefix; same store, different namespace). PUT the raw image
 * body; the public page serves it back via /api/e/<token>/poster.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface R2Bucketish {
  put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}
const bucket = (): R2Bucketish | undefined =>
  (env as unknown as { RENDER_CACHE?: R2Bucketish }).RENDER_CACHE;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const event = await getEvent(id, userId);
  if (!event) return Response.json({ error: "not found" }, { status: 404 });

  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES.has(type)) {
    return Response.json({ error: "jpeg, png, webp or gif only" }, { status: 415 });
  }
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return Response.json({ error: "image must be under 8 MB" }, { status: 413 });
  }

  const r2 = bucket();
  if (!r2) return Response.json({ error: "storage unavailable" }, { status: 503 });
  const key = `events/poster/${id}`;
  await r2.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000" },
  });
  await setEventPoster(id, userId, key);
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const event = await getEvent(id, userId);
  if (!event) return Response.json({ error: "not found" }, { status: 404 });
  if (event.poster_key) {
    try {
      await bucket()?.delete(event.poster_key);
    } catch {
      /* best-effort */
    }
  }
  await setEventPoster(id, userId, null);
  return Response.json({ ok: true });
}
