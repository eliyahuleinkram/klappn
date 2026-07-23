import { db } from "./db";

/**
 * Fixed-window rate limiting backed by Postgres — the only store every
 * isolate shares (Workers spin up per-isolate memory, so in-memory counters
 * are decorative there). One upsert per check, keyed by (key, time bucket).
 *
 * Fails OPEN on DB error: a limiter outage must never take sign-in down
 * with it.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const sql = db();
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  try {
    const rows = await sql<{ count: number }[]>`
      insert into rate_limits (key, bucket, count)
      values (${key}, ${bucket}, 1)
      on conflict (key, bucket)
      do update set count = rate_limits.count + 1
      returning count
    `;
    const count = rows[0]?.count ?? 1;
    if (count === 1) {
      // First hit of a fresh window sweeps day-old buckets, so the table
      // never grows past live traffic. Best-effort.
      void sql`
        delete from rate_limits where created_at < now() - interval '1 day'
      `.catch(() => {});
    }
    return count <= max;
  } catch (e) {
    console.error("[klappn] rate-limit check failed:", (e as Error)?.message);
    return true;
  }
}

/** The best client identity a Worker gets: the connecting IP. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** The one 429 the gated surfaces share. */
export function tooMany(): Response {
  return Response.json(
    { error: "Easy — try again in a few minutes." },
    { status: 429 },
  );
}
