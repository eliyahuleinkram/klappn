import { env } from "cloudflare:workers";
import { getEventByToken } from "@/lib/events";

export const dynamic = "force-dynamic";

/** PUBLIC poster image — this is also the link's OG image, so WhatsApp/iMessage
 *  previews render the artwork. Long edge cache, busted by ?v=updated_at. */

interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}
const bucket = () =>
  (env as unknown as { RENDER_CACHE?: { get(k: string): Promise<R2Object | null> } })
    .RENDER_CACHE;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const event = await getEventByToken(token).catch(() => null);
  if (!event?.poster_key) return new Response("not found", { status: 404 });
  const obj = await bucket()?.get(event.poster_key);
  if (!obj) return new Response("not found", { status: 404 });
  const buf = await obj.arrayBuffer();
  return new Response(buf, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}
