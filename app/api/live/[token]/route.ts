import { getLiveLink, setLiveState } from "@/lib/live";
import { getUserId, unauthorized } from "@/lib/session";
import type { LiveState } from "@/lib/set-live";

export const dynamic = "force-dynamic";

/** MANY LISTENERS, ONE ROW: every phone in the crowd polls this endpoint every
 *  ~1.5s, but the state changes at most every 300ms (the DJ's debounce) — so a
 *  short per-isolate micro-cache collapses the herd to ~1 DB read per TTL. The
 *  cache holds plain data only (safe at module scope on Workers, unlike I/O
 *  objects), and `now` is ALWAYS stamped fresh per response — listener clock
 *  sync feeds on it, a cached timestamp would skew every phone's bar grid. */
const CACHE_TTL_MS = 600;
interface CacheEntry {
  state: LiveState | Record<string, never> | null;
  expiresAt: string;
  gone: boolean;
  at: number;
  /** True while ONE request refreshes an expired entry — everyone else serves
   *  the stale copy instead of stampeding the DB (measured: a synchronized
   *  50-way burst of cache misses queues ~5s on Hyperdrive). Workers can't
   *  share an in-flight promise across requests (cross-request I/O throws),
   *  so serve-stale is the coalescing that IS safe. */
  refreshing?: boolean;
}
const linkCache = new Map<string, CacheEntry>();
/** Tokens a request on this isolate is currently COLD-fetching (no cached
 *  entry at all). Siblings wait for the result to LAND IN THE CACHE instead of
 *  each opening a DB connection — a Workers request must not await another
 *  request's I/O promise, but polling shared plain data is safe. Measured
 *  before this: a 50-way cold burst = 50 concurrent connection opens, some
 *  failing outright (500s). */
const coldFetch = new Set<string>();

function readCache(token: string): CacheEntry | null {
  const hit = linkCache.get(token);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age < CACHE_TTL_MS) return hit;
  // Serve stale only while a refresh is plausibly in flight (≤5×TTL) — a
  // killed request must not wedge `refreshing` on and freeze the state.
  if (hit.refreshing && age < CACHE_TTL_MS * 5) return hit;
  return null;
}

async function fetchThroughCache(token: string): Promise<CacheEntry> {
  const hit = linkCache.get(token);
  if (!hit && coldFetch.has(token)) {
    // A sibling request is already querying this token — wait for its entry.
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const landed = linkCache.get(token);
      if (landed) return landed;
    }
    // The leader died — fall through and query ourselves.
  }
  if (hit) hit.refreshing = true; // claim the refresh; latecomers serve stale
  else coldFetch.add(token);
  try {
    const link = await getLiveLink(token);
    const entry: CacheEntry = link
      ? { state: link.state, expiresAt: link.expires_at, gone: false, at: Date.now() }
      : { state: null, expiresAt: "", gone: true, at: Date.now() };
    linkCache.set(token, entry);
    if (linkCache.size > 64) {
      for (const [k, v] of linkCache)
        if (Date.now() - v.at >= CACHE_TTL_MS && !v.refreshing) linkCache.delete(k);
    }
    return entry;
  } catch (e) {
    if (hit) {
      hit.refreshing = false; // a later poll retries the refresh
      return hit; // a stale answer beats a dropped poll mid-set
    }
    throw e;
  } finally {
    coldFetch.delete(token);
  }
}

/** PUBLIC: the DJ's current performance state — polled by every listener.
 *  The token is the credential; an expired/unknown token reads 410 so the
 *  listener page can settle to "this set has ended". */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const entry = readCache(token) ?? (await fetchThroughCache(token));
  if (entry.gone) return Response.json({ ended: true }, { status: 410 });
  return Response.json(
    { state: entry.state, expiresAt: entry.expiresAt, now: Date.now() },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
  );
}

/** DJ-side publish (owner only): `{ state }` — the whole performance in one
 *  small object, replaced atomically on every change + heartbeat. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as { state?: LiveState } | null;
  if (!body?.state || typeof body.state !== "object") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (JSON.stringify(body.state).length > 4096) {
    return Response.json({ error: "state too large" }, { status: 413 });
  }
  const ok = await setLiveState(token, userId, body.state);
  if (!ok) return Response.json({ error: "gone" }, { status: 410 });
  // Same-isolate listeners see the new state on their next poll; other
  // isolates age out within the TTL anyway.
  linkCache.delete(token);
  return Response.json({ ok: true, now: Date.now() });
}
