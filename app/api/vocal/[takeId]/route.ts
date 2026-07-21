import { env } from "cloudflare:workers";
import { getUserId, unauthorized } from "@/lib/session";
import { getVocalTake } from "@/lib/vocal";

export const dynamic = "force-dynamic";

/** A library take's AUDIO by take id alone (ownership checked on the row) —
 *  how a take born on another song gets pulled into this one. */

interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}
const bucket = () =>
  (env as unknown as { RENDER_CACHE?: { get(k: string): Promise<R2Object | null> } })
    .RENDER_CACHE;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ takeId: string }> },
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
