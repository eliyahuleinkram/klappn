import type { Sql } from "postgres";
import { db } from "./db";
import { getSet, getSetHydrated, type SetBundle } from "./sets";
import type { LiveState } from "./set-live";

/**
 * LIVE LISTENER LINKS — an expiring public token that lets anyone follow a
 * set's performance on their own phone. The DJ's computer renders the set and
 * STREAMS the mixed audio (and Hydra visual) to the Cloudflare Realtime SFU;
 * the published STATE carries the now-playing label + where the broadcast is
 * (state.broadcast), and each listener just plays the stream — no per-phone
 * synthesis (see components/LiveListenClient + lib/rtc). The token IS the
 * credential for reading; writes stay owner-scoped.
 */

export interface LiveLinkRow {
  token: string;
  set_id: string;
  user_id: string;
  state: LiveState | Record<string, never>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/** Short, URL-friendly, unguessable (~62 bits). */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("")
    .slice(0, 12);
}

/** The set's current unexpired link, if any — how a reloaded DJ page finds out
 *  it is still on air (the broadcast outlives the browser tab). */
export async function getActiveLiveLink(
  setId: string,
  userId: string,
  sql: Sql = db(),
): Promise<LiveLinkRow | null> {
  const [row] = await sql<LiveLinkRow[]>`
    select * from live_links
    where set_id = ${setId} and user_id = ${userId} and expires_at > now()
    order by expires_at desc limit 1`;
  return row ?? null;
}

/** Create a live link for a set — or return the set's existing unexpired one
 *  (one live door per set; re-tapping Invite never scatters tokens). */
export async function createLiveLink(
  setId: string,
  userId: string,
  hours = 6,
  sql: Sql = db(),
): Promise<LiveLinkRow | null> {
  const set = await getSet(setId, userId, sql);
  if (!set) return null;
  const existing = await getActiveLiveLink(setId, userId, sql);
  if (existing) return existing;
  const h = Math.min(24, Math.max(1, Math.round(hours) || 6));
  const [row] = await sql<LiveLinkRow[]>`
    insert into live_links (token, set_id, user_id, expires_at)
    values (${newToken()}, ${setId}, ${userId}, now() + make_interval(hours => ${h}))
    returning *`;
  return row;
}

/** The link, or null if unknown/expired. PUBLIC read — the token is the key. */
export async function getLiveLink(
  token: string,
  sql: Sql = db(),
): Promise<LiveLinkRow | null> {
  const [row] = await sql<LiveLinkRow[]>`
    select * from live_links where token = ${token} and expires_at > now()`;
  return row ?? null;
}

/** DJ-side state publish — owner-scoped so a stolen session can't hijack. */
export async function setLiveState(
  token: string,
  userId: string,
  state: LiveState,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update live_links
    set state = ${sql.json(state as unknown as Parameters<typeof sql.json>[0])},
        updated_at = now()
    where token = ${token} and user_id = ${userId} and expires_at > now()
    returning token`;
  return rows.length > 0;
}

/** End the broadcast now (expire the set's live links). */
export async function endLiveLinks(
  setId: string,
  userId: string,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update live_links set expires_at = now()
    where set_id = ${setId} and user_id = ${userId} and expires_at > now()`;
}

/** Everything a listener needs, keyed by token alone: the set hydrated exactly
 *  as the OWNER sees it (their user id scopes the songs, not the visitor's). */
export async function getLiveBundle(
  token: string,
  sql: Sql = db(),
): Promise<{ link: LiveLinkRow; bundle: SetBundle } | null> {
  const link = await getLiveLink(token, sql);
  if (!link) return null;
  const bundle = await getSetHydrated(link.set_id, link.user_id, sql);
  if (!bundle) return null;
  return { link, bundle };
}
