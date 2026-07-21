/**
 * Same-origin sound-asset proxy. The playback engine loads ALL of its remote
 * assets — sample manifests, audio files, soundfont data — through this route
 * instead of hitting third-party CDNs from the browser, so the client's
 * network tab shows only /api/snd/* on our own domain (no vendor hostnames,
 * no library-identifying URLs).
 *
 * Path shapes:
 *   m/<name>       — a sample MANIFEST from the registry below, with its
 *                    `_base` (and any absolute URLs) rewritten to `u/...`
 *                    same-origin paths so every sample fetch also lands here.
 *   u/<b64>/<path> — a sample/audio file: <b64> is a base64url-encoded
 *                    upstream base URL (allowlisted hosts only), <path> the
 *                    file path appended to it.
 *   f/<file>       — GM soundfont data (<name>.js) from the webaudiofont set.
 *
 * Caching: audio + fonts are immutable in practice → 1y browser cache (via the
 * response `Cache-Control`); manifests get 1 day. Upstream fetches are edge-
 * cached for a year through the Cloudflare Cache API (see `fetchUpstream`).
 */

import { after } from "next/server";

export const dynamic = "force-dynamic";

const MAPS_UPSTREAM = "https://strudel.b-cdn.net";
const LIB_UPSTREAM = "https://cdn.jsdelivr.net/gh/tidalcycles/Dirt-Samples@master";
const FONTS_UPSTREAM = "https://felixroos.github.io/webaudiofontdata/sound";

/** Opaque manifest names → upstream. `base` overrides the manifest's own
 *  `_base` (the classic library's manifest hardcodes a rate-limited host). */
const MANIFESTS: Record<string, { url: string; base?: string }> = {
  "d0.json": { url: `${MAPS_UPSTREAM}/uzu-drumkit.json` },
  "d1.json": { url: `${MAPS_UPSTREAM}/piano.json` },
  "d2.json": { url: `${MAPS_UPSTREAM}/vcsl.json` },
  "d3.json": { url: `${MAPS_UPSTREAM}/mridangam.json` },
  "d4.json": { url: `${MAPS_UPSTREAM}/tidal-drum-machines.json` },
  "d5.json": { url: `${MAPS_UPSTREAM}/uzu-wavetables.json` },
  "a0.json": { url: `${MAPS_UPSTREAM}/tidal-drum-machines-alias.json` },
  "lib.json": { url: `${LIB_UPSTREAM}/strudel.json`, base: `${LIB_UPSTREAM}/` },
};

/** Only these upstreams can be addressed through u/ — never an open proxy. */
const ALLOWED_HOSTS = new Set([
  "strudel.b-cdn.net",
  "cdn.jsdelivr.net",
  "raw.githubusercontent.com",
  "felixroos.github.io",
]);

const b64url = (s: string): string =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string): string | null => {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
};

const proxiedBase = (upstreamBase: string): string =>
  `/api/snd/u/${b64url(upstreamBase)}/`;

/** Rewrite a manifest so every URL it can produce resolves back through this
 *  route: `_base` keys (top-level and per-entry) become u/ bases; any absolute
 *  http(s) string becomes a u/ path of its own. Relative sample paths are left
 *  alone — the loader concatenates them onto the rewritten `_base`. */
function rewriteManifest(value: unknown, forceBase?: string): unknown {
  if (typeof value === "string") {
    return /^https?:\/\//.test(value) ? `/api/snd/u/${b64url(value)}` : value;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteManifest(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "_base" && typeof v === "string") {
        out[k] = proxiedBase(forceBase ?? v);
      } else {
        out[k] = rewriteManifest(v);
      }
    }
    if (forceBase && !("_base" in out)) out._base = proxiedBase(forceBase);
    return out;
  }
  return value;
}

/** Fetch an upstream asset, edge-cached for a year via the Cloudflare Cache API.
 *
 *  We can't use the `cf: { cacheEverything, cacheTtl }` fetch hint here: this
 *  route is `force-dynamic`, so the framework injects `cache: "no-store"` on
 *  every subrequest that doesn't set one, and Workers refuses to combine
 *  `cacheTtl` with `no-store` ("CacheTtl … is not compatible with cache:
 *  no-store header"), which 500s the whole handler. So we cache explicitly
 *  instead. Everything here is best-effort: a miss, a Cache API failure, or a
 *  Node dev runtime with no `caches` global must never break the response. */
async function fetchUpstream(url: string): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default: Cache } })
    .caches?.default;
  const key = new Request(url, { method: "GET" });
  if (cache) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) return hit;
  }
  const resp = await fetch(url, { cache: "no-store" });
  if (cache && resp.ok && resp.body) {
    // Cache a clone under our own long TTL; drain it after the response is sent
    // (via `after`) so streaming a large body can't deadlock on tee backpressure.
    const cached = new Response(resp.clone().body, resp);
    cached.headers.set("cache-control", YEAR);
    after(cache.put(key, cached).catch(() => {}));
  }
  return resp;
}

const YEAR = "public, max-age=31536000, immutable";
const DAY = "public, max-age=86400";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [kind, ...rest] = path ?? [];

  if (kind === "m" && rest.length === 1) {
    const entry = MANIFESTS[rest[0]];
    if (!entry) return new Response("not found", { status: 404 });
    const up = await fetchUpstream(entry.url);
    if (!up.ok) return new Response("upstream error", { status: 502 });
    const json = rewriteManifest(await up.json(), entry.base);
    return Response.json(json, {
      headers: { "cache-control": DAY },
    });
  }

  if (kind === "u" && rest.length >= 1) {
    const base = unb64url(rest[0]);
    if (!base) return new Response("bad path", { status: 400 });
    let url: URL;
    try {
      // Next has already percent-decoded the segments — re-encode them for the upstream URL.
      url = new URL(base + rest.slice(1).map(encodeURIComponent).join("/"));
    } catch {
      return new Response("bad path", { status: 400 });
    }
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      return new Response("not found", { status: 404 });
    }
    const up = await fetchUpstream(url.toString());
    if (!up.ok) return new Response("upstream error", { status: up.status === 404 ? 404 : 502 });
    return new Response(up.body, {
      headers: {
        "content-type": up.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": YEAR,
      },
    });
  }

  if (kind === "f" && rest.length === 1 && /^[\w.-]+\.js$/.test(rest[0])) {
    const up = await fetchUpstream(`${FONTS_UPSTREAM}/${rest[0]}`);
    if (!up.ok) return new Response("upstream error", { status: up.status === 404 ? 404 : 502 });
    return new Response(up.body, {
      headers: {
        "content-type": "text/javascript",
        "cache-control": YEAR,
      },
    });
  }

  return new Response("not found", { status: 404 });
}
