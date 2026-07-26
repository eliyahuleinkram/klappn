import { getAuth } from "./auth";
import { warmPool } from "./db";

/**
 * Resolve the authenticated user id from the Better Auth session. Returns null
 * if there is no valid session. Every route handler calls this and filters all
 * DB access by the returned id — this is where ownership is enforced.
 *
 * warmPool() runs first: Better Auth reads the session through Kysely, whose
 * driver uses `sql.reserve()`, which hangs on a cold pool over Hyperdrive.
 * See lib/db.ts → warmPool().
 */
export async function getUserId(req: Request): Promise<string | null> {
  await warmPool();
  const session = await getAuth().api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

/** The signed-in user's email (for Stripe customer creation). Null when absent. */
export async function getUserEmail(req: Request): Promise<string | null> {
  await warmPool();
  const session = await getAuth().api.getSession({ headers: req.headers });
  return session?.user?.email ?? null;
}

export interface SessionUser {
  id: string;
  email: string | null;
  /** True for a guest minted by the anonymous plugin (no real email yet). */
  isAnonymous: boolean;
}

/** The whole session identity in one read — for routes that treat guests
 *  differently (checkout needs a claimed account; everything else doesn't). */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  await warmPool();
  const session = await getAuth().api.getSession({ headers: req.headers });
  const u = session?.user as
    | { id: string; email?: string | null; isAnonymous?: boolean | null }
    | undefined;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null, isAnonymous: !!u.isAnonymous };
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
