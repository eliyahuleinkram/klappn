import type { Sql } from "postgres";
import { db } from "./db";
import type { PartRow, SongRow } from "./songs";

/**
 * SETS — an ordered arrangement of the user's songs, played as one continuous
 * performance with AI-composed hand-offs between songs. Same access discipline
 * as lib/songs.ts: every read/write is ownership-scoped by user_id, and the
 * songs a set references are re-scoped on hydration (an entry pointing at a
 * song that isn't the session user's simply doesn't hydrate).
 */

/** One slot in the set. `id` is a stable entry id (NOT the song id) so the same
 *  song can appear twice and transitions key cleanly by boundary. */
export interface SetEntry {
  id: string;
  songId: string;
}

/** A song-to-song hand-off leaving the entry `fromEntryId` — same shape as
 *  song.plan.breaks so the compose/pick/regenerate flow transfers directly. */
export interface SetTransition {
  options: { label: string; strudel: string }[];
  chosen: number | null;
}

export interface SetPlan {
  entries?: SetEntry[];
  transitions?: Record<string, SetTransition>;
}

export interface SetRow {
  id: string;
  user_id: string;
  title: string;
  plan: SetPlan | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export function entriesOf(plan: unknown): SetEntry[] {
  const p = plan && typeof plan === "object" ? (plan as SetPlan) : {};
  return (p.entries ?? []).filter(
    (e): e is SetEntry =>
      !!e && typeof e.id === "string" && typeof e.songId === "string",
  );
}

function transitionsOf(plan: unknown): Record<string, SetTransition> {
  const p = plan && typeof plan === "object" ? (plan as SetPlan) : {};
  return { ...(p.transitions ?? {}) };
}

// --- CRUD ------------------------------------------------------------------

export async function listSets(userId: string, sql: Sql = db()): Promise<SetRow[]> {
  return sql<SetRow[]>`
    select * from sets where user_id = ${userId} order by updated_at desc`;
}

export async function createSet(
  userId: string,
  title: string,
  entries: SetEntry[] = [],
  sql: Sql = db(),
): Promise<SetRow> {
  const t = (title || "").trim().slice(0, 80) || "untitled set";
  const plan: SetPlan = { entries, transitions: {} };
  const [row] = await sql<SetRow[]>`
    insert into sets (user_id, title, plan)
    values (${userId}, ${t}, ${sql.json(plan as Parameters<typeof sql.json>[0])})
    returning *`;
  return row;
}

export async function getSet(
  setId: string,
  userId: string,
  sql: Sql = db(),
): Promise<SetRow | null> {
  const [row] = await sql<SetRow[]>`
    select * from sets where id = ${setId} and user_id = ${userId}`;
  return row ?? null;
}

export async function deleteSet(
  setId: string,
  userId: string,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    delete from sets where id = ${setId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function setSetTitle(
  setId: string,
  userId: string,
  title: string,
  sql: Sql = db(),
): Promise<boolean> {
  const t = (title || "").trim().slice(0, 80) || "untitled set";
  const rows = await sql`
    update sets set title = ${t} where id = ${setId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Shallow-merge a partial plan into the set's plan JSON — ownership-scoped.
 *  Same read-modify-write shape as patchSongPlan (set edits are low-contention). */
export async function patchSetPlan(
  setId: string,
  userId: string,
  patch: Partial<SetPlan>,
  sql: Sql = db(),
): Promise<boolean> {
  const set = await getSet(setId, userId, sql);
  if (!set) return false;
  const base =
    set.plan && typeof set.plan === "object"
      ? (set.plan as Record<string, unknown>)
      : {};
  const next = { ...base, ...patch };
  const rows = await sql`
    update sets
    set plan = ${sql.json(next as Parameters<typeof sql.json>[0])}
    where id = ${setId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Replace the set's song order. A hand-off is composed for a SPECIFIC pair of
 *  neighbours, so any transition whose leading entry was removed — or whose
 *  FOLLOWING entry changed (reorder, insert, removal downstream) — is dropped:
 *  easing into the wrong song is worse than a clean cut. */
export async function setSetEntries(
  setId: string,
  userId: string,
  entries: SetEntry[],
  sql: Sql = db(),
): Promise<boolean> {
  const set = await getSet(setId, userId, sql);
  if (!set) return false;
  const nextOf = (list: SetEntry[]): Map<string, string> => {
    const m = new Map<string, string>();
    if (list.length > 1)
      list.forEach((e, i) => m.set(e.id, list[(i + 1) % list.length].id));
    return m;
  };
  const oldNext = nextOf(entriesOf(set.plan));
  const newNext = nextOf(entries);
  const transitions = transitionsOf(set.plan);
  for (const k of Object.keys(transitions)) {
    if (!newNext.has(k) || oldNext.get(k) !== newNext.get(k)) delete transitions[k];
  }
  return patchSetPlan(setId, userId, { entries, transitions }, sql);
}

// --- transitions (AI hand-offs between songs) --------------------------------

/** Store a boundary's freshly-composed transition OPTIONS (keeps an existing
 *  choice if it still points at a valid option). Ownership-scoped. */
export async function saveSetTransition(
  setId: string,
  userId: string,
  fromEntryId: string,
  options: { label: string; strudel: string }[],
  sql: Sql = db(),
): Promise<SetTransition | null> {
  const set = await getSet(setId, userId, sql);
  if (!set) return null;
  const transitions = transitionsOf(set.plan);
  const prevChosen = transitions[fromEntryId]?.chosen ?? null;
  const t: SetTransition = {
    options,
    chosen: prevChosen !== null && prevChosen < options.length ? prevChosen : null,
  };
  transitions[fromEntryId] = t;
  const ok = await patchSetPlan(setId, userId, { transitions }, sql);
  return ok ? t : null;
}

/** Pick which transition a boundary wears (null = hard cut). Ownership-scoped. */
export async function setSetTransitionChoice(
  setId: string,
  userId: string,
  fromEntryId: string,
  choice: number | null,
  sql: Sql = db(),
): Promise<boolean> {
  const set = await getSet(setId, userId, sql);
  if (!set) return false;
  const transitions = transitionsOf(set.plan);
  const t = transitions[fromEntryId];
  if (!t) return choice === null; // nothing composed yet; "none" is a no-op
  t.chosen =
    choice !== null && choice >= 0 && choice < t.options.length
      ? Math.floor(choice)
      : null;
  transitions[fromEntryId] = t;
  return patchSetPlan(setId, userId, { transitions }, sql);
}

// --- hydration ---------------------------------------------------------------

export interface SetBundle {
  set: SetRow;
  /** Every referenced song (that belongs to the user), with its ordered parts —
   *  everything set playback needs in ONE payload. */
  songs: { song: SongRow; parts: PartRow[] }[];
}

export async function getSetHydrated(
  setId: string,
  userId: string,
  sql: Sql = db(),
): Promise<SetBundle | null> {
  const set = await getSet(setId, userId, sql);
  if (!set) return null;
  const ids = [...new Set(entriesOf(set.plan).map((e) => e.songId))];
  if (ids.length === 0) return { set, songs: [] };
  const songs = await sql<SongRow[]>`
    select * from songs where user_id = ${userId} and id in ${sql(ids)}`;
  const parts = songs.length
    ? await sql<PartRow[]>`
        select * from parts where song_id in ${sql(songs.map((s) => s.id))}
        order by song_id, position asc`
    : [];
  return {
    set,
    songs: songs.map((song) => ({
      song,
      parts: parts.filter((p) => p.song_id === song.id),
    })),
  };
}
