/**
 * CLOUDFLARE REALTIME SFU — signaling proxy.
 *
 * The browser drives the WebRTC handshake (create session, publish/pull tracks,
 * renegotiate) but must NEVER hold the app's Bearer token. So every SFU call
 * goes through here: we inject `Authorization: Bearer <REALTIME_APP_TOKEN>` and
 * forward to the app's own namespace on rtc.live.cloudflare.com. The client can
 * only ever reach paths under OUR app id (it's server-side), so the blast
 * radius is our own SFU app — and we allowlist just the signaling surface.
 *
 * Flow (see components: SetClient publishes, LiveListenClient pulls):
 *   POST sessions/new                     → { sessionId }
 *   POST sessions/{id}/tracks/new         → publish (local) or pull (remote) tracks + SDP
 *   PUT  sessions/{id}/renegotiate        → finish a pull's SDP exchange
 */

import { getUserId } from "@/lib/session";
import { getLiveLink } from "@/lib/live";

const SFU_BASE = "https://rtc.live.cloudflare.com/v1/apps";

// Only the SFU signaling endpoints — not the whole API surface.
const ALLOW = [
  /^sessions\/new$/,
  /^sessions\/[A-Za-z0-9._-]+\/tracks\/new$/,
  /^sessions\/[A-Za-z0-9._-]+\/renegotiate$/,
];

export const dynamic = "force-dynamic";

async function proxy(
  req: Request,
  params: Promise<{ path: string[] }>,
): Promise<Response> {
  const { path } = await params;
  const sub = (path ?? []).join("/");
  if (!ALLOW.some((re) => re.test(sub))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  // WHO may signal: a signed-in user (the DJ publishing a set) or a holder of
  // an unexpired live-link token (a listener — the /live page is public and
  // the token IS its credential, sent as a header). Without this gate anyone
  // could mint SFU sessions on the app's account.
  const userId = await getUserId(req);
  if (!userId) {
    const lt = req.headers.get("x-live-token") || "";
    const link = lt ? await getLiveLink(lt) : null;
    if (!link) return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const appId = process.env.REALTIME_APP_ID;
  const token = process.env.REALTIME_APP_TOKEN;
  if (!appId || !token) {
    return Response.json({ error: "realtime not configured" }, { status: 503 });
  }
  const body = await req.text(); // opaque SDP/track JSON — pass straight through
  const upstream = await fetch(`${SFU_BASE}/${appId}/${sub}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body || undefined,
  });
  // Mirror the SFU's status + JSON; never cache a handshake.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params);
}
export function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params);
}
