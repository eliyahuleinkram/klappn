import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql } from "postgres";
// `cloudflare:workers` is a workerd runtime module. On Workers it exposes the
// configured bindings via `env`; in local `vinext dev` (Node) it's aliased to a
// stub (see vite.config.ts) whose `env` is empty. This import stays
// framework-neutral — it's a Cloudflare runtime API, not a vinext one, so the
// code also works under Next.js + OpenNext on Workers.
import { env as cfEnv } from "cloudflare:workers";

/**
 * Postgres access for Klappn.
 *
 * On Cloudflare Workers the connection string comes from a Hyperdrive binding
 * (`env.HYPERDRIVE.connectionString`). Hyperdrive pools the connections and
 * caches reads at the edge, which is what lets a Worker talk to PlanetScale
 * Postgres without holding its own TCP pool.
 *
 * Resolution order:
 *   1. an explicit connection string argument (the Workflows worker passes its
 *      own `env.HYPERDRIVE.connectionString`)
 *   2. the Hyperdrive binding on the current Worker (`cfEnv.HYPERDRIVE`)
 *   3. process.env.HYPERDRIVE_CONNECTION_STRING (manual override)
 *   4. process.env.DATABASE_URL (local dev: a local Postgres or a direct URL)
 */
function hyperdriveConnectionString(): string | undefined {
  const hd = (cfEnv as { HYPERDRIVE?: { connectionString?: string } })
    ?.HYPERDRIVE;
  return hd?.connectionString;
}

function resolveConnectionString(explicit?: string): string {
  const conn =
    explicit ||
    hyperdriveConnectionString() ||
    process.env.HYPERDRIVE_CONNECTION_STRING ||
    process.env.DATABASE_URL;
  if (!conn) {
    throw new Error(
      "No Postgres connection string. On Workers, add a Hyperdrive binding " +
        "named HYPERDRIVE; locally, set DATABASE_URL.",
    );
  }
  return conn;
}

/** Whether any connection source is configured (used to gate Better Auth). */
export function hasConnectionString(): boolean {
  return Boolean(
    hyperdriveConnectionString() ||
      process.env.HYPERDRIVE_CONNECTION_STRING ||
      process.env.DATABASE_URL,
  );
}

function makeClient(conn: string): Sql {
  return postgres(conn, {
    // Required behind Hyperdrive / poolers: no server-side prepared statements.
    prepare: false,
    // CRITICAL on Cloudflare Workers + Hyperdrive: postgres.js otherwise runs a
    // pg_catalog type-introspection query on connect, which hangs over
    // Hyperdrive. Disabling it removes that round-trip.
    fetch_types: false,
    // ONE connection per client. We create a fresh client per request-scope (app) or per
    // withSql() (workflow steps), and Hyperdrive already pools the expensive origin
    // connections — so a per-client pool of 5 just multiplies open PlanetScale connections
    // (each client could hold 5) and was a major contributor to exhausting max_connections
    // (the FATAL "remaining connection slots are reserved for SUPERUSER"). max:1 caps it; our
    // queries within a scope run sequentially, so a bigger pool bought nothing.
    max: 1,
    // Reap an idle connection quickly so a client that isn't explicitly .end()'d (or whose
    // .end() is cut short by the Worker tearing down the I/O context) still releases fast.
    idle_timeout: 5,
    max_lifetime: 60,
  });
}

/**
 * Per-request database scope.
 *
 * THE hard rule on Cloudflare Workers: a connection (an I/O object) created in
 * one request CANNOT be used from another request — doing so throws "Cannot
 * perform I/O on behalf of a different request" (or, for the promise that
 * resolves it, the continuation is cancelled and the query hangs forever). So a
 * postgres.js client must NOT be cached at module scope across requests.
 *
 * Instead the Worker entry wraps each request in `runWithDbScope`, and every
 * `getSql()` within that request shares ONE client (so warmPool() and Better
 * Auth hit the same connection), which is closed when the request finishes.
 * Hyperdrive pools the expensive PlanetScale connections, so creating a fresh
 * postgres.js→Hyperdrive client per request is cheap.
 */
interface DbScope {
  clients: Map<string, Sql>;
}
const als = new AsyncLocalStorage<DbScope>();

export function inDbScope(): boolean {
  return als.getStore() !== undefined;
}

/** True when a bare `db()`/`getSql()` call right now would mint a TRANSIENT client the
 *  caller owns (workerd with no request scope — e.g. inside a Workflow step). Such a
 *  client is NOT closed by any scope teardown, so the caller must `.end()` it itself;
 *  the idle-timeout reaper can't be relied on (its timer dies with the step's I/O
 *  context — the exact mechanism of the 06-25 meter connection leak). */
export function ownsTransientClient(): boolean {
  return onWorkerd() && als.getStore() === undefined;
}

export function runWithDbScope<T>(fn: (scope: DbScope) => T): T {
  const scope: DbScope = { clients: new Map() };
  return als.run(scope, () => fn(scope));
}

export async function closeDbScope(scope: DbScope): Promise<void> {
  const clients = [...scope.clients.values()];
  scope.clients.clear();
  await Promise.all(
    clients.map((s) => s.end({ timeout: 5 }).catch(() => {})),
  );
}

/** True on the workerd runtime (Workers / Workflows), false on plain Node. */
function onWorkerd(): boolean {
  return (
    (globalThis as { navigator?: { userAgent?: string } }).navigator
      ?.userAgent === "Cloudflare-Workers"
  );
}

// Local dev (plain Node, no worker entry → no request scope): ONE cached client
// per connection string, shared by every caller. Node has no cross-request I/O
// restriction, and the sharing is load-bearing: kysely-postgres-js (Better
// Auth) calls `sql.reserve()` per query, and a COLD reserve() hangs forever in
// Node too (measured), not just over Hyperdrive — so warmPool() only works if
// it warms the SAME client Kysely then reserves from. With per-call transient
// clients, every local Better Auth DB query hung (e.g. magic-link sign-in).
const nodeClients = new Map<string, Sql>();

export function getSql(connectionString?: string): Sql {
  const conn = resolveConnectionString(connectionString);
  const scope = als.getStore();
  if (scope) {
    let sql = scope.clients.get(conn);
    if (!sql) {
      sql = makeClient(conn);
      scope.clients.set(conn, sql);
    }
    return sql;
  }
  if (!onWorkerd()) {
    let sql = nodeClients.get(conn);
    if (!sql) {
      sql = makeClient(conn);
      nodeClients.set(conn, sql);
    }
    return sql;
  }
  // No request scope on workerd (e.g. a Workflow step): a transient per-call
  // client that lives and dies within the current I/O context.
  return makeClient(conn);
}

/**
 * Open a real connection in the pool with a trivial query.
 *
 * Why this exists: on Cloudflare Workers + Hyperdrive, postgres.js's
 * `sql.reserve()` HANGS when it has to open a connection on a *cold* pool (no
 * idle connection available) — the connection-open path for reserved
 * connections never completes over Hyperdrive. A plain `sql\`…\`` query, by
 * contrast, opens connections fine.
 *
 * Better Auth talks to Postgres through Kysely + kysely-postgres-js, whose
 * driver calls `sql.reserve()` for EVERY query. So Better Auth's first query on
 * a fresh isolate is a cold `reserve()` → hang. Running this warm-up query
 * first leaves an idle, already-open connection in the pool for `reserve()` to
 * grab, which makes it return immediately. Cheap (one round-trip) and must run
 * within the same request, just before any Kysely/Better-Auth DB work.
 */
export async function warmPool(connectionString?: string): Promise<void> {
  await getSql(connectionString)`select 1`;
}

// Convenience handle for the Next.js side, which reads the env-provided string.
export const db = (): Sql => getSql();
