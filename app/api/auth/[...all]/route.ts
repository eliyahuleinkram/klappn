import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";

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
