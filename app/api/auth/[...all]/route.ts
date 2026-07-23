import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

// The unauthenticated endpoints that SEND EMAIL (OTP code, magic link) or
// accept code guesses get a durable per-IP / per-email gate here, before
// Better Auth sees the request — its built-in limiter is in-memory, which
// on Workers means per-isolate and effectively absent.
async function gate(req: Request): Promise<Response | null> {
  if (req.method !== "POST") return null;
  const path = new URL(req.url).pathname;
  const sends =
    path.endsWith("/email-otp/send-verification-otp") ||
    path.endsWith("/sign-in/magic-link");
  const verifies = path.endsWith("/sign-in/email-otp");
  if (!sends && !verifies) return null;
  const ip = clientIp(req);
  if (sends) {
    const body = (await req
      .clone()
      .json()
      .catch(() => null)) as { email?: string } | null;
    const email = (body?.email || "").trim().toLowerCase();
    if (!(await rateLimit(`auth-send:ip:${ip}`, 8, 600))) return tooMany();
    if (email && !(await rateLimit(`auth-send:email:${email}`, 4, 600))) {
      return tooMany();
    }
    return null;
  }
  // Verify: looser, but tight enough that 6 digits cannot be walked.
  return (await rateLimit(`auth-verify:ip:${ip}`, 30, 600)) ? null : tooMany();
}

// Better Auth owns everything under /api/auth/* (sign-in, magic link, session).
// Build the handler lazily (per first request) so nothing touches the DB binding
// at module load — see lib/auth.ts.
//
// Before delegating, we warm the Postgres pool. Better Auth queries through
// Kysely + kysely-postgres-js, whose driver uses `sql.reserve()` for every
// query; on Workers + Hyperdrive a cold `reserve()` hangs forever. warmPool()
// opens an idle connection first so `reserve()` returns immediately. See
// lib/db.ts → warmPool() for the full explanation.
async function handle(req: Request): Promise<Response> {
  const limited = await gate(req);
  if (limited) return limited;
  try {
    await warmPool();
  } catch (e) {
    // If warming fails we still try the handler — better a real error than a
    // silent swallow.
    console.error("[klappn][auth] warmPool failed:", (e as Error)?.message);
  }
  return getAuth().handler(req);
}

export function GET(req: Request) {
  return handle(req);
}
export function POST(req: Request) {
  return handle(req);
}
