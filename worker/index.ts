/**
 * Cloudflare Worker entry point.
 *
 * vinext 0.0.54's `deploy` command (which would normally generate this file) is
 * an unimplemented stub, so we provide the entry by hand. It delegates every
 * request to vinext's App Router handler, which serves static assets via the
 * ASSETS binding and renders SSR/RSC routes. The `@cloudflare/vite-plugin` build
 * (configured with main = ./worker/index.ts in wrangler.jsonc) resolves the
 * handler's internal `virtual:` app-server import.
 *
 * We don't use next/image, so the image-optimization wrapper vinext would add
 * is omitted — we delegate straight to the handler.
 */
import handler from "vinext/server/app-router-entry";
import { closeDbScope, runWithDbScope } from "../lib/db";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response> {
    // Force HTTPS. Without this, http://klappn.com is served in the clear and
    // browsers show "Not secure". We redirect at the edge based on the visitor's
    // real scheme (Cloudflare puts it in `cf-visitor`; the request URL also
    // carries it). A genuine HTTPS request reports scheme "https" and is left
    // alone, so there's no redirect loop.
    const url = new URL(request.url);
    let scheme = url.protocol === "https:" ? "https" : "http";
    try {
      const v = request.headers.get("cf-visitor");
      if (v) scheme = (JSON.parse(v).scheme as string) || scheme;
    } catch {
      /* ignore malformed header */
    }
    if (scheme === "http") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    // Canonical host: www is attached as a custom domain only so the hostname
    // resolves — everything on it bounces to the apex (auth cookies and shared
    // links live on one host).
    if (url.hostname === "www.klappn.com") {
      url.hostname = "klappn.com";
      return Response.redirect(url.toString(), 301);
    }

    // zaltz's front door: zaltz.klappn.com's root serves the playground page.
    // (/zaltz itself is the ENGINE BINARY — extensionless wasm — so the page
    // lives at /engine.) Assets, /api and deep links pass through untouched —
    // except the favicon: browsers ask the HOST for /favicon.ico on their own
    // terms (Safari ignores <link> icons half the time), so on this host it
    // answers with the grain, not the Klappn mark.
    let req = request;
    if (url.hostname === "zaltz.klappn.com") {
      if (url.pathname === "/") {
        url.pathname = "/engine";
        req = new Request(url.toString(), request);
      } else if (url.pathname === "/favicon.ico") {
        url.pathname = "/zaltz-favicon.ico";
        req = new Request(url.toString(), request);
      } else if (url.pathname === "/apple-touch-icon.png" || url.pathname === "/apple-touch-icon-precomposed.png") {
        url.pathname = "/zaltz-icon-180.png";
        req = new Request(url.toString(), request);
      }
    }

    // Every request gets its own Postgres scope (see lib/db.ts). We BUFFER the
    // response body before returning so that all server-component / RSC database
    // work runs INSIDE this request's I/O context — a connection opened here
    // cannot be touched once the request ends, and RSC otherwise renders lazily
    // as the body stream is pulled (after this function returns). Buffering is
    // cheap here: the Worker only handles HTML pages and JSON APIs; static
    // assets are served directly by the ASSETS binding and never reach this code.
    return runWithDbScope(async (scope) => {
      try {
        const res = await handler.fetch(req, env, ctx);
        // 101/204/304 and redirects have no body — pass straight through.
        if (!res.body || res.status === 101) return res;
        const buf = await res.arrayBuffer();
        return new Response(buf, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      } finally {
        // Close after the response (and its render) are fully materialised.
        ctx.waitUntil(closeDbScope(scope));
      }
    });
  },
};
