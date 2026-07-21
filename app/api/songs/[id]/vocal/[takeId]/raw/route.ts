import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import { getVocalTake } from "@/lib/vocal";

export const dynamic = "force-dynamic";

interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}
interface R2Bucketish {
  get(key: string): Promise<R2Object | null>;
}
const bucket = (): R2Bucketish | undefined =>
  (env as unknown as { RENDER_CACHE?: R2Bucketish }).RENDER_CACHE;

/** THE RAW TAKE — the echo-cancelled but otherwise unprocessed mono WAV the
 *  take was recorded as: what every re-process (knob re-runs in the studio,
 *  the key/transpose re-tune) should run from. Owner-only. 404 on legacy
 *  takes that never stored one — callers fall back to the processed render. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; takeId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { takeId } = await params;
  const take = await getVocalTake(takeId, userId);
  if (!take || !take.raw_r2_key)
    return Response.json({ error: "not found" }, { status: 404 });
  const obj = await bucket()?.get(take.raw_r2_key);
  if (!obj) return Response.json({ error: "audio missing" }, { status: 404 });
  return new Response(await obj.arrayBuffer(), {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "audio/wav",
      "cache-control": "private, max-age=3600",
    },
  });
}
