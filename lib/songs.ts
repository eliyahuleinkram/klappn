import type { Sql } from "postgres";
import { db } from "./db";
import type { SongPlan } from "./anthropic";
import { remapMoves } from "./arrange";
import type { SectionArrange, SongArrangement, SweepTake } from "./arrange";
import type { SongVisual } from "./hydra-embed";
import type { LoopScore, LoopTrack, SoundPick } from "./score";
import { DEFAULT_MODEL, type ModelId } from "./models";

/**
 * Ownership-enforced data access. Every read/write is scoped by user_id (songs)
 * or by a join through song ownership (parts). No route or workflow should
 * touch a song/part without going through one of these functions, so a
 * client-supplied id can never reach a row that isn't the session user's.
 *
 * Each function takes an optional `sql` so the Workflows worker can pass a
 * client built from its Hyperdrive binding; the Next.js side uses the default.
 */

export type SongStatus =
  | "draft"
  | "overview"
  | "generating"
  | "ready"
  | "error";
export type PartStatus = "pending" | "generating" | "ready" | "error";

export interface SongRow {
  id: string;
  user_id: string;
  title: string;
  global_prompt: string | null;
  plan: SongPlan | Record<string, never>;
  status: SongStatus;
  generation_workflow_id: string | null;
  /** Playlist this loop belongs to (null = none). Optional: absent on databases
   *  that haven't applied the playlist migration. */
  playlist?: string | null;
  /** Composition model — always "fable" (legacy ids were migrated 2026-07-20). */
  model?: ModelId;
  /** Set = this song plays on the signed-out DOOR gallery (owner-curated;
   *  newest first). Optional pre-migration. */
  featured_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartRow {
  id: string;
  song_id: string;
  position: number;
  label: string | null;
  intent: string | null;
  strudel: string | null;
  status: PartStatus;
  /** Live "what's happening now" line shown while composing (best-effort; may be
   *  absent on databases that haven't applied the status_message migration). */
  status_message?: string | null;
  /** The code as first composed — snapshotted before the first AI edit so the
   *  "Original" pill can restore it. Optional pre-migration. */
  original_strudel?: string | null;
  /** LEGACY low-CPU twin — the twin system is retired (2026-07-20: every
   *  device plays `strudel`; ZALTZ synthesizes on the audio thread). The
   *  column keeps old data and is nulled on rewrites; nothing reads it. */
  strudel_mobile?: string | null;
  /** Which edit pill (variant) is currently applied — null/absent = the
   *  original. Optional pre-migration. */
  edit_choice?: string | null;
  /** Cached COMPUTED variants: { "<pill>": "<strudel>" } — a pill is composed
   *  once, ever; re-taps restore from here. Optional pre-migration. */
  variants?: Record<string, string> | null;
  /** 'loop' (a place — repeats), 'break' (a SHORT transitional loop — same
   *  card/layers/unfold as any loop, the label just says what it's for), or
   *  legacy 'bridge' (the old one-way transition; plays once in the mix).
   *  Optional pre-migration; absent/null reads as 'loop'. */
  kind?: "loop" | "bridge" | "break" | null;
  /** How many bars this section plays in "Play song" (arrangement length). */
  bars: number;
  /** The engine-agnostic music-theory score this loop was composed from, and the
   *  per-layer sound picks. Persisted so the loop can be re-translated / edited at
   *  the music level. Optional pre-migration; null until first composed. */
  score?: LoopScore | null;
  sounds?: SoundPick[] | null;
  /** The per-track breakdown (layer engine): each "$:" line + its tweak panel.
   *  This is what the per-track UI renders; null on legacy/score-path parts. */
  tracks?: LoopTrack[] | null;
  created_at: string;
  updated_at: string;
}

// --- songs ---------------------------------------------------------------

/** A song row enriched for the HOME page's deep cards: its ordered section labels, total layer
 *  count, and the first playable part (so home can play a loop without loading the song page).
 *  No strudel in the payload — playback fetches the code on demand (one small request). */
export interface SongRowRich extends SongRow {
  sections: string[] | null;
  layer_count: number;
  first_part_id: string | null;
}

export async function listSongsRich(userId: string, sql: Sql = db()): Promise<SongRowRich[]> {
  return sql<SongRowRich[]>`
    select s.*,
      coalesce((select json_agg(p.label order by p.position)
                from parts p where p.song_id = s.id), '[]'::json) as sections,
      coalesce((select sum(jsonb_array_length(p.tracks))::int
                from parts p where p.song_id = s.id and jsonb_typeof(p.tracks) = 'array'), 0) as layer_count,
      (select p.id from parts p
       where p.song_id = s.id and p.strudel is not null and p.status = 'ready'
       order by p.position limit 1) as first_part_id
    from songs s where s.user_id = ${userId} order by s.updated_at desc`;
}

// --- the door (signed-out gallery) ---------------------------------------

/** What the signed-out door lists: enough to render a card and nothing that
 *  belongs to an account (no user_id, no prompt, no code). */
export interface DoorSongRow {
  id: string;
  title: string;
  plan: Record<string, unknown>;
  updated_at: string;
}

/** The owner-curated songs behind the door, newest featured first. Public —
 *  the card whisper only (identity, no code, no prompt-derived text). */
export async function listDoorSongs(sql: Sql = db()): Promise<DoorSongRow[]> {
  return sql<DoorSongRow[]>`
    select id, title,
      jsonb_build_object('bpm', plan->'bpm', 'key', plan->'key', 'genre', plan->'genre') as plan,
      updated_at
    from songs
    where featured_at is not null and status = 'ready'
    order by featured_at desc limit 12`;
}

// The plan keys gallery playback actually reads (lib/home-sections) plus the
// card's identity whisper — everything else (summary, meterCache, visual
// source, workflow bookkeeping) stays home.
const DOOR_PLAN_KEYS = [
  "bpm",
  "key",
  "genre",
  "timeSignature",
  "transpose",
  "sound",
  "breaks",
  "holdCycles",
  "arrangement",
  "effects",
  "overlays",
  "chapters",
] as const;

/** One featured song with its playable parts — the door's play payload.
 *  Gated on featured_at (a de-featured id 404s again) and stripped to what
 *  gallery playback reads: no prompts, no variants, no originals, no scores. */
export async function getDoorSongWithParts(
  songId: string,
  sql: Sql = db(),
): Promise<{
  song: { id: string; title: string; plan: Record<string, unknown> };
  parts: Pick<PartRow, "id" | "label" | "strudel" | "status" | "kind" | "bars">[];
} | null> {
  const [song] = await sql<{ id: string; title: string; plan: Record<string, unknown> }[]>`
    select id, title, plan from songs
    where id = ${songId} and featured_at is not null and status = 'ready'`;
  if (!song) return null;
  const plan: Record<string, unknown> = {};
  for (const k of DOOR_PLAN_KEYS) {
    const v = (song.plan ?? {})[k];
    if (v !== undefined) plan[k] = v;
  }
  const parts = await sql<Pick<PartRow, "id" | "label" | "strudel" | "status" | "kind" | "bars">[]>`
    select id, label, strudel, status, kind, bars
    from parts where song_id = ${songId} order by position asc`;
  return { song: { id: song.id, title: song.title, plan }, parts };
}

/** Put a song on (or take it off) the door. Ownership-scoped like every other
 *  mutation; the ROUTE additionally restricts this to the owner plan. */
export async function setSongFeatured(
  songId: string,
  userId: string,
  featured: boolean,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update songs set featured_at = ${featured ? sql`now()` : null}
    where id = ${songId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function createSong(
  userId: string,
  globalPrompt: string,
  title: string,
  model: ModelId = DEFAULT_MODEL,
  sql: Sql = db(),
): Promise<SongRow> {
  const [row] = await sql<SongRow[]>`
    insert into songs (user_id, title, global_prompt, status, model)
    values (${userId}, ${title}, ${globalPrompt}, 'draft', ${model})
    returning *`;
  return row;
}

/** Delete a song (its parts cascade via FK) — only if it belongs to userId.
 *  Returns true if a row was deleted, false if it wasn't the user's / didn't exist. */
export async function deleteSong(
  songId: string,
  userId: string,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    delete from songs where id = ${songId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

/** Bulk-delete songs in ONE round-trip — only those belonging to userId (a
 *  foreign id in the list is silently skipped, never touched). Returns the rows
 *  actually deleted, with each one's generation_workflow_id so the caller can
 *  halt any workflow still composing it. Empty `ids` → no query, no rows.
 *
 *  This exists so bulk delete is a single request/connection instead of the
 *  client fanning out one DELETE per loop, which spiked N simultaneous DB
 *  connections and blew past the pool ceiling. */
export async function deleteSongs(
  ids: string[],
  userId: string,
  sql: Sql = db(),
): Promise<{ id: string; generation_workflow_id: string | null }[]> {
  if (ids.length === 0) return [];
  return sql<{ id: string; generation_workflow_id: string | null }[]>`
    delete from songs
    where user_id = ${userId} and id in ${sql(ids)}
    returning id, generation_workflow_id`;
}

/** Returns the song only if it belongs to userId, else null. */
export async function getSong(
  songId: string,
  userId: string,
  sql: Sql = db(),
): Promise<SongRow | null> {
  const [row] = await sql<SongRow[]>`
    select * from songs where id = ${songId} and user_id = ${userId}`;
  return row ?? null;
}

export async function getSongWithParts(
  songId: string,
  userId: string,
  sql: Sql = db(),
): Promise<{ song: SongRow; parts: PartRow[] } | null> {
  const song = await getSong(songId, userId, sql);
  if (!song) return null;
  const parts = await sql<PartRow[]>`
    select * from parts where song_id = ${songId} order by position asc`;
  return { song, parts };
}

export async function setSongStatus(
  songId: string,
  status: SongStatus,
  sql: Sql = db(),
): Promise<void> {
  await sql`update songs set status = ${status} where id = ${songId}`;
}

/** ATOMICALLY claim a song for generation: flip to 'generating' only if it isn't
 *  already. Closes the check-then-act race where two concurrent POSTs both started
 *  a workflow over the same pending parts (duplicate Fable spend + interleaved
 *  writes). Returns null when the song isn't the user's; otherwise `{ won, prev }`
 *  — won=false means another request already holds it, `prev` is the status before
 *  the flip (so a failed trigger can walk it back exactly). All CTEs share one
 *  statement snapshot, so `cur` reads the ORIGINAL status while `upd` conditionally
 *  flips it. */
export async function claimGenerating(
  songId: string,
  userId: string,
  sql: Sql = db(),
): Promise<{ won: boolean; prev: SongStatus } | null> {
  const rows = await sql<{ prev: SongStatus; won: boolean }[]>`
    with cur as (
      select status from songs where id = ${songId} and user_id = ${userId}
    ),
    upd as (
      update songs set status = 'generating'
      where id = ${songId} and user_id = ${userId} and status <> 'generating'
      returning id
    )
    select cur.status as prev, exists (select 1 from upd) as won from cur`;
  return rows.length ? { won: rows[0].won, prev: rows[0].prev } : null;
}

/** Rename a workspace — ownership-scoped. Returns true if a row was updated. */
export async function setSongTitle(
  songId: string,
  userId: string,
  title: string,
  sql: Sql = db(),
): Promise<boolean> {
  const t = (title || "").trim().slice(0, 80) || "Untitled workspace";
  const rows = await sql`
    update songs set title = ${t} where id = ${songId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Shallow-merge a partial plan into a song's plan JSON — ownership-scoped.
 *  Used for manual, non-AI settings (bridges, transpose, tempo). Read-modify-
 *  write; bridge/setting edits are low-contention so a transaction isn't needed.
 *  Returns true if a row was updated. */
export async function patchSongPlan(
  songId: string,
  userId: string,
  patch: Record<string, unknown>,
  sql: Sql = db(),
): Promise<boolean> {
  const song = await getSong(songId, userId, sql);
  if (!song) return false;
  const base =
    song.plan && typeof song.plan === "object"
      ? (song.plan as Record<string, unknown>)
      : {};
  const next = { ...base, ...patch };
  const rows = await sql`
    update songs
    set plan = ${sql.json(next as unknown as Parameters<typeof sql.json>[0])}
    where id = ${songId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Persist the song's canonical visual onto its plan (plan.visual) — a targeted
 *  jsonb_set, never a whole-plan read-modify-write: the generation workflow calls this
 *  WHILE other plan keys may be changing (user settings land mid-generation), and a
 *  stale full-plan write here would silently revert them. No ownership scope — callers
 *  are the workflow (ownership enforced at trigger time) and owner-checked routes. */
export async function saveSongVisual(
  songId: string,
  visual: SongVisual,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update songs
    set plan = jsonb_set(plan, '{visual}', ${sql.json(visual as unknown as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
}

// ── CHAPTERS-ERA SONG EFFECTS (plan.effects) ─────────────────────────────────
// Song-level glides anchored to part ranges (lib/arrange SongFx), written at
// chapterize time and edited zero-AI from the song page. Array-valued but tiny
// (≤ a handful per song): reads/rewrites go through one targeted jsonb_set.

/** Append freshly authored effects (the chapterize write). No ownership scope
 *  — callers are the workflow + owner-checked routes. */
export async function appendSongEffects(
  songId: string,
  effects: unknown[],
  sql: Sql = db(),
): Promise<void> {
  if (!effects.length) return;
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      '{effects}',
      coalesce(plan->'effects', '[]'::jsonb) || ${sql.json(effects as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId}`;
}

/** plan.overlays — the BREAK overlays (deterministic drum rides; see
 *  lib/breaks-catalog). Same storage contract as effects. */
export async function appendSongOverlays(
  songId: string,
  overlays: unknown[],
  sql: Sql = db(),
): Promise<void> {
  if (!overlays.length) return;
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      '{overlays}',
      coalesce(plan->'overlays', '[]'::jsonb) || ${sql.json(overlays as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId}`;
}

export async function patchSongOverlay(
  songId: string,
  userId: string | null,
  overlayId: string,
  patch: Record<string, unknown>,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<{ overlays: unknown }[]>`
    select plan->'overlays' as overlays from songs
    where id = ${songId}${userId ? sql` and user_id = ${userId}` : sql``}`;
  const list = Array.isArray(rows[0]?.overlays) ? (rows[0].overlays as Record<string, unknown>[]) : null;
  if (!list) return false;
  let hit = false;
  const next = list.map((e) => {
    if (!e || e.id !== overlayId) return e;
    hit = true;
    return { ...e, ...patch };
  });
  if (!hit) return false;
  await sql`
    update songs set plan = jsonb_set(plan, '{overlays}', ${sql.json(next as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
  return true;
}

export async function removeSongOverlay(
  songId: string,
  userId: string,
  overlayId: string,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<{ overlays: unknown }[]>`
    select plan->'overlays' as overlays from songs
    where id = ${songId} and user_id = ${userId}`;
  const list = Array.isArray(rows[0]?.overlays) ? (rows[0].overlays as Record<string, unknown>[]) : null;
  if (!list) return false;
  const next = list.filter((e) => e && e.id !== overlayId);
  if (next.length === list.length) return false;
  await sql`
    update songs set plan = jsonb_set(plan, '{overlays}', ${sql.json(next as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
  return true;
}

export async function replaceSongOverlays(
  songId: string,
  userId: string,
  overlays: unknown[],
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update songs
    set plan = jsonb_set(plan, '{overlays}', ${sql.json(overlays as Parameters<typeof sql.json>[0])})
    where id = ${songId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** REPLACE the song's whole effects list (the auto-effects button — the UI
 *  warns first; user-born effects are wiped by design). Owner-scoped. */
export async function replaceSongEffects(
  songId: string,
  userId: string,
  effects: unknown[],
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update songs
    set plan = jsonb_set(plan, '{effects}', ${sql.json(effects as Parameters<typeof sql.json>[0])})
    where id = ${songId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Patch ONE song effect by id (values ride, ↺ restores, enrich lands knobs).
 *  Owner-scoped when userId given (route edits); workflow writes pass null. */
export async function patchSongEffect(
  songId: string,
  userId: string | null,
  fxId: string,
  patch: Record<string, unknown>,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<{ effects: unknown }[]>`
    select plan->'effects' as effects from songs
    where id = ${songId}${userId ? sql` and user_id = ${userId}` : sql``}`;
  const list = Array.isArray(rows[0]?.effects) ? (rows[0].effects as Record<string, unknown>[]) : null;
  if (!list) return false;
  let hit = false;
  const next = list.map((e) => {
    if (!e || e.id !== fxId) return e;
    hit = true;
    return { ...e, ...patch };
  });
  if (!hit) return false;
  await sql`
    update songs
    set plan = jsonb_set(plan, '{effects}', ${sql.json(next as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
  return true;
}

/** Drop ONE song effect by id (the band's ✕). Owner-scoped. */
export async function removeSongEffect(
  songId: string,
  userId: string,
  fxId: string,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<{ effects: unknown }[]>`
    select plan->'effects' as effects from songs
    where id = ${songId} and user_id = ${userId}`;
  const list = Array.isArray(rows[0]?.effects) ? (rows[0].effects as Record<string, unknown>[]) : null;
  if (!list) return false;
  const next = list.filter((e) => e?.id !== fxId);
  if (next.length === list.length) return false;
  await sql`
    update songs
    set plan = jsonb_set(plan, '{effects}', ${sql.json(next as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
  return true;
}

/** Persist the song's model-authored arrangement (plan.arrangement) — same
 *  targeted-jsonb_set discipline as saveSongVisual: this runs post-finalize in
 *  the generation workflow while other plan keys may be changing, so a full-plan
 *  read-modify-write would silently revert them. Null clears it (back to the
 *  classic whole-loop playback). */
export async function saveSongArrangement(
  songId: string,
  arrangement: SongArrangement | null,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update songs
    set plan = jsonb_set(plan, '{arrangement}', ${sql.json(arrangement as unknown as Parameters<typeof sql.json>[0])})
    where id = ${songId}`;
}

/** Merge ONE section's whole unfold spec into plan.arrangement — the write
 *  behind a PER-LOOP re-unfold (arrangeSong scoped to one section). Uses jsonb
 *  `||` merges so it CREATES arrangement/sections when absent and leaves every
 *  other section (and the ending) untouched. No ownership scope — callers are
 *  the workflow (ownership at trigger) and owner-checked routes. */
export async function saveSongSectionSpec(
  songId: string,
  sectionId: string,
  spec: unknown,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update songs
    set plan = plan || jsonb_build_object(
      'arrangement',
      coalesce(plan->'arrangement', '{}'::jsonb) || jsonb_build_object(
        'sections',
        coalesce(plan->'arrangement'->'sections', '{}'::jsonb) || jsonb_build_object(
          ${sectionId}::text,
          ${sql.json(spec as Parameters<typeof sql.json>[0])}
        )
      )
    )
    where id = ${songId}`;
}

/** Replace ONE section's layer moves inside the unfold — the zero-AI write
 *  behind the per-layer paint lanes. Targeted jsonb_set on exactly that
 *  section's `moves`; owner-scoped; no-op when the section isn't in the
 *  arrangement. Moves arrive pre-sanitized by the route (data only, no code). */
export async function setSongSectionMoves(
  songId: string,
  userId: string,
  sectionId: string,
  moves: { bar: number; layers: number[] }[],
  /** The layer count the user painted against — re-stamps the section, so
   *  painting a STALE section (layer count drifted) re-validates it instead
   *  of writing moves the renderer would keep skipping. */
  layerCount: number,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    update songs
    set plan = jsonb_set(
      jsonb_set(
        plan,
        array['arrangement','sections', ${sectionId}::text, 'moves'],
        ${sql.json(moves as unknown as Parameters<typeof sql.json>[0])}
      ),
      array['arrangement','sections', ${sectionId}::text, 'layerCount'],
      to_jsonb(${layerCount}::int)
    )
    where id = ${songId} and user_id = ${userId}
      and plan->'arrangement'->'sections' ? ${sectionId}
    returning id`;
  return rows.length > 0;
}

/** THE UNFOLD FOLLOWS THE LAYERS (2026-07-13): after an edit changes a loop's
 *  layer shape (a delete, an AI rewrite that added/removed lines), re-point
 *  its unfold instead of letting the moves go stale. `mapping[newIndex] = old
 *  0-based index | null` (null = brand-new layer → plays through). Remaps the
 *  ACTIVE spec and every cached length take, re-stamps layerCounts. Zero AI.
 *  No ownership scope — callers are owner-checked routes / the workflow. */
export async function syncSectionSpecLayers(
  songId: string,
  sectionId: string,
  mapping: (number | null)[],
  sql: Sql = db(),
): Promise<void> {
  const rows = await sql<{ spec: SectionArrange | null }[]>`
    select plan->'arrangement'->'sections'->${sectionId} as spec
    from songs where id = ${songId}`;
  const spec = rows[0]?.spec;
  if (!spec || typeof spec !== "object") return;
  const n = mapping.length;
  const next: SectionArrange = {
    ...spec,
    moves: remapMoves(spec.moves, mapping),
    layerCount: n,
    takes: Object.fromEntries(
      Object.entries(spec.takes ?? {}).map(([k, t]) => [
        k,
        { ...t, moves: remapMoves(t?.moves, mapping), layerCount: n },
      ]),
    ),
  };
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      array['arrangement','sections', ${sectionId}::text],
      ${sql.json(next as unknown as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId} and plan->'arrangement'->'sections' ? ${sectionId}`;
}

/** SWITCH a section to one of its CACHED lengths (the length capsule's zero-AI
 *  path): the current state is stashed back under its own bar count (so a
 *  painted lane survives the round trip), then the chosen take swaps in as the
 *  active spec. Owner-scoped; null when the section (or that take) isn't there
 *  — the caller then composes the length instead. */
export async function applySongSectionTake(
  songId: string,
  userId: string,
  sectionId: string,
  bars: number,
  sql: Sql = db(),
): Promise<SectionArrange | null> {
  const rows = await sql<{ spec: SectionArrange | null }[]>`
    select plan->'arrangement'->'sections'->${sectionId} as spec
    from songs where id = ${songId} and user_id = ${userId}`;
  const spec = rows[0]?.spec;
  if (!spec || typeof spec !== "object") return null;
  const take = spec.takes?.[String(bars)];
  if (!take) return null;
  const curBars = String(Math.max(1, Math.floor(spec.bars ?? bars)));
  const next: SectionArrange = {
    ...spec,
    bars,
    moves: take.moves,
    sweeps: take.sweeps,
    layerCount: take.layerCount,
    takes: {
      ...spec.takes,
      [curBars]: {
        moves: spec.moves,
        sweeps: spec.sweeps,
        layerCount: spec.layerCount,
      },
    },
  };
  const done = await sql<{ id: string }[]>`
    update songs
    set plan = jsonb_set(
      plan,
      array['arrangement','sections', ${sectionId}::text],
      ${sql.json(next as unknown as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId} and user_id = ${userId}
      and plan->'arrangement'->'sections' ? ${sectionId}
    returning id`;
  return done.length ? next : null;
}

/** Replace ONE section's whole sweeps array — the write behind the effect-knob
 *  enrich (AI-named controls landing on every sweep at once). Targeted
 *  jsonb_set; no ownership scope (callers are the workflow + owner-checked
 *  routes); no-op when the section isn't in the unfold. */
export async function setSongSectionSweeps(
  songId: string,
  sectionId: string,
  sweeps: unknown[],
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      array['arrangement','sections', ${sectionId}::text, 'sweeps'],
      ${sql.json(sweeps as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId} and plan->'arrangement'->'sections' ? ${sectionId}`;
}

/** Wear one of an effect's TAKES (zero-AI): swap from/to/curve/name in place on
 *  sweeps[index], keeping its param, timing and take list. Owner-scoped. */
export async function setSongSectionSweepTake(
  songId: string,
  userId: string,
  sectionId: string,
  index: number,
  take: SweepTake,
  sql: Sql = db(),
): Promise<boolean> {
  if (!Number.isInteger(index) || index < 0 || index > 64) return false;
  const rows = await sql<{ id: string }[]>`
    update songs
    set plan = jsonb_set(
      plan,
      array['arrangement','sections', ${sectionId}::text, 'sweeps', ${String(index)}::text],
      (plan->'arrangement'->'sections'->${sectionId}->'sweeps'->${index}::int) ||
        ${sql.json(take as unknown as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId} and user_id = ${userId}
      and plan->'arrangement'->'sections'->${sectionId}->'sweeps'->${index}::int is not null
    returning id`;
  return rows.length > 0;
}

/** Remove ONE overlay or sweep from a section's unfold (the chip's ✕) — a
 *  jsonb `#-` path delete, owner-scoped, index-addressed. */
export async function removeSongSectionListItem(
  songId: string,
  userId: string,
  sectionId: string,
  kind: "overlays" | "sweeps",
  index: number,
  sql: Sql = db(),
): Promise<boolean> {
  if (!Number.isInteger(index) || index < 0 || index > 64) return false;
  const rows = await sql<{ id: string }[]>`
    update songs
    set plan = plan #- array['arrangement','sections', ${sectionId}::text, ${kind}::text, ${String(index)}::text]
    where id = ${songId} and user_id = ${userId}
      and plan->'arrangement'->'sections' ? ${sectionId}
    returning id`;
  return rows.length > 0;
}

/** Flip ONLY the arrangement's ending mode (stop ⟷ loop) — the zero-AI toggle
 *  behind the unfold's end mark. Targeted jsonb_set so nothing else in the
 *  arrangement (or plan) is touched; owner-scoped (this is a user route action).
 *  No-op when the song has no arrangement yet. */
export async function setSongEndingMode(
  songId: string,
  userId: string,
  mode: "stop" | "loop",
  sql: Sql = db(),
): Promise<boolean> {
  // `||`-built (not jsonb_set): chapters-era songs have NO plan.arrangement
  // parent, and jsonb_set silently no-ops on a missing path — the toggle
  // looked dead on every new song.
  const rows = await sql<{ id: string }[]>`
    update songs
    set plan = plan || jsonb_build_object(
      'arrangement',
      coalesce(plan->'arrangement', '{}'::jsonb) || jsonb_build_object(
        'ending',
        coalesce(plan->'arrangement'->'ending', '{}'::jsonb) || jsonb_build_object('mode', ${mode}::text)
      )
    )
    where id = ${songId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** Instantly swap the song back to a meter we've ALREADY rendered (cached in
 *  plan.meterCache) — NO AI rework. Restores each cached part's strudel + tracks
 *  and flips the plan's timeSignature, keeping the cache so it stays a fast toggle
 *  (back-and-forth between meters never regenerates). */
export async function restoreMeterFromCache(
  songId: string,
  userId: string,
  ts: string,
  cached: { id: string; strudel: string; tracks: unknown }[],
  cache: Record<string, unknown>,
  sql: Sql = db(),
): Promise<void> {
  for (const r of cached) {
    if (!r.strudel?.trim()) continue;
    await sql`
      update parts
      set strudel = ${r.strudel},
          tracks = ${sql.json((r.tracks ?? null) as Parameters<typeof sql.json>[0])},
          status = 'ready'
      where id = ${r.id} and song_id = ${songId}`;
  }
  await patchSongPlan(songId, userId, { timeSignature: ts, meterCache: cache }, sql);
}

// --- breaks (one-bar AI easings between adjacent loops) ----------------------
// Stored on song.plan.breaks, keyed by the LEADING loop's part id:
//   { [fromPartId]: { options: [{label, strudel}], chosen: number | null } }
// Options are AI-composed once per gap (on first open); choosing is instant and
// deterministic. chosen=null → no break (hard seam, with the DJ-sweep fallback).

export interface BreakSet {
  /** `strudelMobile` = the low-CPU twin of this break option (mobile plays it,
   *  desktop plays `strudel`). Absent = not generated → mobile uses `strudel`. */
  options: { label: string; strudel: string; strudelMobile?: string | null }[];
  chosen: number | null;
}

function breaksOf(plan: unknown): Record<string, BreakSet> {
  const p =
    plan && typeof plan === "object" ? (plan as Record<string, unknown>) : {};
  return { ...((p.breaks as Record<string, BreakSet>) || {}) };
}

/** Store a gap's freshly-composed break OPTIONS (keeps any existing choice if
 *  it still points at a valid option). Ownership-scoped. */
export async function saveBreakOptions(
  songId: string,
  userId: string,
  fromPartId: string,
  options: { label: string; strudel: string }[],
  sql: Sql = db(),
): Promise<BreakSet | null> {
  const song = await getSong(songId, userId, sql);
  if (!song) return null;
  const breaks = breaksOf(song.plan);
  const prevChosen = breaks[fromPartId]?.chosen ?? null;
  const set: BreakSet = {
    options,
    chosen: prevChosen !== null && prevChosen < options.length ? prevChosen : null,
  };
  breaks[fromPartId] = set;
  const ok = await patchSongPlan(songId, userId, { breaks }, sql);
  return ok ? set : null;
}

/** Pick which break a gap wears (null = none). Ownership-scoped. */
export async function setBreakChoice(
  songId: string,
  userId: string,
  fromPartId: string,
  choice: number | null,
  sql: Sql = db(),
): Promise<boolean> {
  const song = await getSong(songId, userId, sql);
  if (!song) return false;
  const breaks = breaksOf(song.plan);
  const set = breaks[fromPartId];
  if (!set) return choice === null; // nothing to choose from; "none" is a no-op
  set.chosen =
    choice !== null && choice >= 0 && choice < set.options.length
      ? Math.floor(choice)
      : null;
  breaks[fromPartId] = set;
  return patchSongPlan(songId, userId, { breaks }, sql);
}

/** Move a gap's break to ANOTHER gap — a pure plan re-key (options + choice travel
 *  whole), zero AI. If the destination gap already wears a break the two SWAP, so a
 *  drag between two dressed seams never destroys either. The break's repeat latch
 *  (plan.holdCycles["break:<id>"]) travels with it. Ownership-scoped. */
export async function moveBreak(
  songId: string,
  userId: string,
  fromPartId: string,
  toPartId: string,
  sql: Sql = db(),
): Promise<boolean> {
  if (fromPartId === toPartId) return true;
  const song = await getSong(songId, userId, sql);
  if (!song) return false;
  const breaks = breaksOf(song.plan);
  const moving = breaks[fromPartId];
  if (!moving) return false;
  const displaced = breaks[toPartId];
  breaks[toPartId] = moving;
  if (displaced) breaks[fromPartId] = displaced;
  else delete breaks[fromPartId];
  const plan =
    song.plan && typeof song.plan === "object"
      ? (song.plan as Record<string, unknown>)
      : {};
  const holds: Record<string, number> = {
    ...((plan.holdCycles as Record<string, number>) || {}),
  };
  const fromKey = `break:${fromPartId}`;
  const toKey = `break:${toPartId}`;
  const movingHold = holds[fromKey];
  const displacedHold = holds[toKey];
  delete holds[fromKey];
  delete holds[toKey];
  if (movingHold != null) holds[toKey] = movingHold;
  if (displaced && displacedHold != null) holds[fromKey] = displacedHold;
  return patchSongPlan(songId, userId, { breaks, holdCycles: holds }, sql);
}

/** Set (or clear) the bridge transition leaving `fromPartId`. type "cut"/empty
 *  removes it (hard cut is the default). Ownership-scoped. */
export async function setBridge(
  songId: string,
  userId: string,
  fromPartId: string,
  type: string,
  sql: Sql = db(),
): Promise<boolean> {
  const song = await getSong(songId, userId, sql);
  if (!song) return false;
  const plan =
    song.plan && typeof song.plan === "object"
      ? (song.plan as Record<string, unknown>)
      : {};
  const bridges: Record<string, string> = {
    ...((plan.bridges as Record<string, string>) || {}),
  };
  if (!type || type === "cut") delete bridges[fromPartId];
  else bridges[fromPartId] = type;
  return patchSongPlan(songId, userId, { bridges }, sql);
}

/** Snapshot every ready part's code into original_strudel (ONCE — only where it's
 *  still null), so an AI edit can always be walked back to the first composition.
 *  Best-effort pre-migration. */
export async function snapshotPartOriginals(
  songId: string,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`
      update parts set original_strudel = strudel
      where song_id = ${songId} and original_strudel is null and strudel is not null`;
  } catch {
    /* column not migrated yet — the Original pill just won't appear */
  }
}

/** Snapshot ONE part's code into original_strudel (only if not yet snapshotted) —
 *  run before a variant edit so "Original" always means the first composition. */
export async function snapshotPartOriginal(
  partId: string,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`
      update parts set original_strudel = strudel
      where id = ${partId} and original_strudel is null and strudel is not null`;
  } catch {
    /* column not migrated yet */
  }
}

/** Remember a COMPUTED variant forever: { pill: code }. A style is composed
 *  once; every later tap restores from this cache (zero model calls).
 *  Best-effort pre-migration. */
export async function saveVariantSnapshot(
  partId: string,
  pill: string,
  code: string,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`
      update parts
      set variants = coalesce(variants, '{}'::jsonb)
                     || jsonb_build_object(${pill}::text, ${code}::text)
      where id = ${partId}`;
  } catch {
    /* column not migrated yet — the pill will just recompute */
  }
}

/** Keep the WORN identity's snapshot in sync with manual edits (knob writes,
 *  instrument swaps): wearing Original → the original snapshot follows; wearing
 *  a style → that style's cached take follows. So switching away and back
 *  always returns the loop exactly as you left it. Best-effort. */
export async function syncWornSnapshot(
  partId: string,
  code: string,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`
      update parts set
        original_strudel = case
          when edit_choice is null and original_strudel is not null
            then ${code} else original_strudel end,
        variants = case
          when edit_choice is not null
            then coalesce(variants, '{}'::jsonb)
                 || jsonb_build_object(edit_choice, ${code}::text)
          else variants end
      where id = ${partId}`;
  } catch {
    /* pre-migration — snapshots just don't follow manual edits */
  }
}

/** Record which edit pill (variant) a part is wearing — null = the original.
 *  Best-effort pre-migration. */
export async function setPartEditChoice(
  partId: string,
  pill: string | null,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`update parts set edit_choice = ${pill} where id = ${partId}`;
  } catch {
    /* column not migrated yet — the pill just won't show as selected */
  }
}

/** Restore a part's code to its pre-edit original. Returns the restored code, or
 *  null if there's no snapshot (or the column isn't migrated). */
export async function restorePartOriginal(
  songId: string,
  partId: string,
  sql: Sql = db(),
): Promise<string | null> {
  try {
    const rows = await sql<{ strudel: string }[]>`
      update parts set strudel = original_strudel, status = 'ready'
      where id = ${partId} and song_id = ${songId} and original_strudel is not null
      returning strudel`;
    return rows[0]?.strudel ?? null;
  } catch {
    return null;
  }
}

/** Put a loop in a playlist (null clears it). Ownership-scoped; best-effort on
 *  databases that haven't applied the playlist migration. Returns true if set. */
export async function setSongPlaylist(
  songId: string,
  userId: string,
  playlist: string | null,
  sql: Sql = db(),
): Promise<boolean> {
  const name = playlist?.trim().slice(0, 60) || null;
  try {
    const rows = await sql`
      update songs set playlist = ${name}
      where id = ${songId} and user_id = ${userId}
      returning id`;
    return rows.length > 0;
  } catch {
    return false; // column not migrated yet
  }
}

/**
 * RECOVERY: settle "generating" rows whose run is DEAD — called lazily from the
 * polled GET routes, so a stuck song can never lock the UI forever.
 *
 * Every live run writes constantly (narration lines, status flips, part code —
 * and each part write bumps the song's updated_at), and the LLM stall watchdog
 * caps any silent call at ~90s, so 15 minutes of TOTAL silence means the
 * workflow is gone (terminated, crashed, evicted) — not thinking.
 *
 * Parts: one that already has code (a variant rework died mid-flight) keeps it
 * and returns to 'ready'; one with none (first compose died) becomes 'error'
 * (the card offers "Try again"). The song then settles to 'ready' if anything
 * is playable, else 'error'. Returns true if anything changed. Best-effort —
 * a failure here must never break the read it rides on.
 */
export async function reconcileStaleGeneration(
  songId: string,
  sql: Sql = db(),
): Promise<boolean> {
  try {
    const settled = await sql<{ id: string }[]>`
      update parts
      set status = case when strudel is not null then 'ready' else 'error' end,
          status_message = null
      where song_id = ${songId} and status = 'generating'
        and updated_at < now() - interval '15 minutes'
      returning id`;

    const [s] = await sql<{ status: string; stale: boolean }[]>`
      select status, updated_at < now() - interval '15 minutes' as stale
      from songs where id = ${songId}`;
    if (!s || s.status !== "generating") return settled.length > 0;
    // A live song bumps constantly; only settle it once it's silent (or we just
    // settled its dead parts above) AND nothing is still composing.
    if (!s.stale && settled.length === 0) return false;
    const [c] = await sql<{ live: number; ok: number }[]>`
      select count(*) filter (where status = 'generating')::int as live,
             count(*) filter (where status = 'ready' and strudel is not null)::int as ok
      from parts where song_id = ${songId}`;
    if (Number(c?.live) > 0) return settled.length > 0;
    await sql`
      update songs set status = ${Number(c?.ok) > 0 ? "ready" : "error"}
      where id = ${songId} and status = 'generating'`;
    return true;
  } catch {
    return false;
  }
}

export async function setGenerationWorkflowId(
  songId: string,
  workflowId: string,
  sql: Sql = db(),
): Promise<void> {
  await sql`update songs set generation_workflow_id = ${workflowId} where id = ${songId}`;
}

/**
 * Persist an overview plan: store plan json, create one pending part per planned
 * part (in order), and move the song to 'overview'. Single transaction.
 */
export async function saveOverview(
  songId: string,
  plan: SongPlan,
  sql: Sql = db(),
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update songs
      set plan = ${tx.json(plan as unknown as Parameters<typeof tx.json>[0])},
          status = 'overview'
      where id = ${songId}`;
    // Replace any existing planned parts (overview can be re-run from draft).
    await tx`delete from parts where song_id = ${songId}`;
    for (let i = 0; i < plan.parts.length; i++) {
      const p = plan.parts[i];
      await tx`
        insert into parts (song_id, position, label, intent, bars, status)
        values (${songId}, ${i}, ${p.label}, ${p.intent}, ${p.bars ?? 8}, 'pending')`;
    }
  });
}

// --- parts (workflow-side writes; ownership already enforced upstream) ----

export async function getPartsOrdered(songId: string, sql: Sql = db()): Promise<PartRow[]> {
  return sql<PartRow[]>`
    select * from parts where song_id = ${songId} order by position asc`;
}

export async function setPartStatus(
  partId: string,
  status: PartStatus,
  sql: Sql = db(),
  message?: string,
): Promise<void> {
  // Optional message records WHY (e.g. the exception on an 'error') into status_message
  // so failures are diagnosable instead of silently leaving the last narration line.
  if (message !== undefined) {
    try {
      await sql`update parts set status = ${status}, status_message = ${message} where id = ${partId}`;
      return;
    } catch {
      // status_message column not migrated — fall through so the status change itself
      // can never fail on account of the (optional) message.
    }
  }
  await sql`update parts set status = ${status} where id = ${partId}`;
}

export async function writePartStrudel(
  partId: string,
  strudel: string,
  status: PartStatus,
  sql: Sql = db(),
): Promise<void> {
  await sql`update parts set strudel = ${strudel}, status = ${status} where id = ${partId}`;
}

/** Persist a freshly composed loop: the merged Strudel code PLUS the music-theory
 *  score and the per-layer sound picks it was built from (both stored as jsonb),
 *  so the loop can later be re-translated or edited at the music level. */
export async function writePartComposition(
  partId: string,
  strudel: string,
  score: LoopScore | null,
  sounds: SoundPick[] | null,
  tracks: LoopTrack[] | null,
  status: PartStatus,
  sql: Sql = db(),
): Promise<void> {
  // The mobile twin was made from the PREVIOUS composition, so ANY authoritative
  // composition write — an AI edit, a mute, a knob, a swap — leaves it stale.
  // A stale twin is not cosmetic: a MUTED layer kept playing on phones (heard on
  // song afc88060 — the muted crash still washed over every loop). Invalidate it
  // here; the mobile client + the post-finalize sweep regenerate on demand.
  await sql`
    update parts
    set strudel = ${strudel},
        strudel_mobile = null,
        score = ${score ? sql.json(score as unknown as Parameters<typeof sql.json>[0]) : null},
        sounds = ${sounds ? sql.json(sounds as unknown as Parameters<typeof sql.json>[0]) : null},
        tracks = ${tracks ? sql.json(tracks as unknown as Parameters<typeof sql.json>[0]) : null},
        status = ${status}
    where id = ${partId}`;
}

/** STREAMING write during layer-by-layer generation: persist the partial loop +
 *  the tracks generated SO FAR, keeping status 'generating'. This is what lets the
 *  client show and play each track the moment it lands, instead of waiting for the
 *  whole stack. Best-effort (called outside a durable step); the final
 *  writePartComposition is the authoritative 'ready' write. */
export async function writePartProgress(
  partId: string,
  strudel: string,
  tracks: LoopTrack[],
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update parts
    set strudel = ${strudel},
        tracks = ${sql.json(tracks as unknown as Parameters<typeof sql.json>[0])},
        status = 'generating'
    where id = ${partId}`;
}

/** REBASE a loop onto structurally new code (e.g. a time-signature change):
 *  the new code becomes the loop's base identity. The take cache and the
 *  Original snapshot are cleared — they were written in the OLD structure and
 *  restoring one would mix meters. The pill VOCABULARY (in the code's @edits
 *  block) survives; tapping a pill recomputes its take from the new base. */
export async function rebasePartStrudel(
  partId: string,
  strudel: string,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update parts
    set strudel = ${strudel},
        original_strudel = null,
        variants = '{}'::jsonb,
        edit_choice = null,
        status = 'ready',
        status_message = ''
    where id = ${partId}`;
}

/** Like rebasePartStrudel, but ALSO rebases the saved score + sound picks — a
 *  meter change re-bars the score, so later edits must build on the NEW structure
 *  (not the old-meter score). Same snapshot/cache clearing as rebasePartStrudel. */
export async function rebasePartComposition(
  partId: string,
  strudel: string,
  score: LoopScore | null,
  sounds: SoundPick[] | null,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    update parts
    set strudel = ${strudel},
        score = ${score ? sql.json(score as unknown as Parameters<typeof sql.json>[0]) : null},
        sounds = ${sounds ? sql.json(sounds as unknown as Parameters<typeof sql.json>[0]) : null},
        original_strudel = null,
        variants = '{}'::jsonb,
        edit_choice = null,
        status = 'ready',
        status_message = ''
    where id = ${partId}`;
}

/** Best-effort: write the live "what's happening now" line for a composing part.
 *  Wrapped so a missing column (pre-migration) or a transient error can NEVER
 *  break the (cosmetic) narration — or the composition running alongside it. */
export async function setPartMessage(
  partId: string,
  message: string,
  sql: Sql = db(),
): Promise<void> {
  try {
    await sql`update parts set status_message = ${message} where id = ${partId}`;
  } catch {
    /* column not migrated yet, or a transient hiccup — narration is optional */
  }
}

/** Set a loop's section label (Intro/Verse/Drop/…) — ownership-scoped. Returns
 *  true if a row was updated. */
export async function setPartLabel(
  songId: string,
  partId: string,
  label: string,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update parts set label = ${label.slice(0, 40)}
    where id = ${partId} and song_id = ${songId} returning id`;
  return rows.length > 0;
}

/** Set a part's strudel directly (a MANUAL, non-AI edit — e.g. the mixer), scoped
 *  to the owning song so a part id from another song can't be touched. Returns
 *  true if a row was updated. */
export async function setPartStrudelOwned(
  songId: string,
  partId: string,
  strudel: string,
  sql: Sql = db(),
): Promise<boolean> {
  // Clear any legacy mobile twin — the twin system is retired (every device
  // plays the original); a stored twin from before must never outlive a rewrite.)
  const rows = await sql`
    update parts set strudel = ${strudel}, strudel_mobile = null, status = 'ready'
    where id = ${partId} and song_id = ${songId} returning id`;
  return rows.length > 0;
}

// --- structural ops (transactional renumbering) --------------------------
// The unique(song_id, position) constraint rejects transient collisions, so
// all renumbering happens inside a transaction with positions shifted as a set.

/** Insert a new pending part at `position`, shifting later parts down by one.
 *  `position: "end"` appends — the index is computed INSIDE the transaction, so
 *  two concurrent inserts (extend-before + extend-after fired together) can't
 *  both aim at a stale snapshot's tail and land the "after" part mid-song.
 *  `bars` is the loop length (how long it repeats), clamped to a sane range.
 *  `kind` distinguishes a 'loop' (a place) from a 'bridge' (a one-way
 *  transition between two adjacent loops). */
export async function injectPart(
  songId: string,
  position: number | "end",
  label: string,
  intent: string,
  bars = 8,
  kind: "loop" | "bridge" | "break" = "loop",
  sql: Sql = db(),
): Promise<PartRow> {
  // Breaks are legitimately tiny — a 1-bar break is a break, not junk input.
  const b = Math.min(32, Math.max(kind === "break" ? 1 : 2, Math.round(Number(bars)) || 8));
  return sql.begin(async (tx) => {
    const pos =
      position === "end"
        ? Number(
            (
              await tx<{ p: number }[]>`
                select coalesce(max(position) + 1, 0)::int as p
                from parts where song_id = ${songId}`
            )[0]?.p ?? 0,
          )
        : position;
    // Shift in descending order would be ideal, but a single set-based update
    // avoids row-by-row collisions entirely.
    await tx`
      update parts set position = position + 1
      where song_id = ${songId} and position >= ${pos}`;
    const [row] = await tx<PartRow[]>`
      insert into parts (song_id, position, label, intent, bars, status, kind)
      values (${songId}, ${pos}, ${label}, ${intent}, ${b}, 'pending', ${kind})
      returning *`;
    return row;
  });
}

/** Remove a part and close the gap so positions stay 0..n-1 contiguous.
 *  Removing a LOOP also removes any bridge that touched it — a bridge is a
 *  journey between two specific loops; orphaned, it makes no sense. */
export async function removePart(
  songId: string,
  partId: string,
  sql: Sql = db(),
): Promise<void> {
  await sql.begin(async (tx) => {
    const [removed] = await tx<{ position: number; kind?: string | null }[]>`
      delete from parts where id = ${partId} and song_id = ${songId}
      returning position, kind`;
    if (!removed) return;
    if ((removed.kind ?? "loop") !== "bridge") {
      try {
        await tx`
          delete from parts
          where song_id = ${songId} and kind = 'bridge'
            and position in (${removed.position - 1}, ${removed.position + 1})`;
      } catch {
        /* kind column not migrated yet — nothing to cascade */
      }
    }
    // Renumber compactly (handles 1-2 removals in one pass). The deferrable
    // unique(song_id, position) lets the whole set shift atomically.
    await tx`
      update parts p set position = t.rn - 1
      from (
        select id, row_number() over (order by position) as rn
        from parts where song_id = ${songId}
      ) t
      where p.id = t.id and p.song_id = ${songId}`;
  });
}

/** Move a part from one index to another, renumbering the affected range. */
export async function reorderPart(
  songId: string,
  partId: string,
  toPosition: number,
  sql: Sql = db(),
): Promise<void> {
  await sql.begin(async (tx) => {
    const [part] = await tx<{ position: number }[]>`
      select position from parts where id = ${partId} and song_id = ${songId}`;
    if (!part) return;
    const from = part.position;
    if (from === toPosition) return;

    // Park the moving row at a sentinel position outside the valid range to
    // avoid colliding with the unique constraint while the others shift.
    await tx`update parts set position = -1 where id = ${partId}`;
    if (from < toPosition) {
      await tx`
        update parts set position = position - 1
        where song_id = ${songId} and position > ${from} and position <= ${toPosition}`;
    } else {
      await tx`
        update parts set position = position + 1
        where song_id = ${songId} and position >= ${toPosition} and position < ${from}`;
    }
    await tx`update parts set position = ${toPosition} where id = ${partId}`;
  });
}

/** Replace a part's intent and reset it to pending for regeneration. */
export async function replacePartIntent(
  songId: string,
  partId: string,
  label: string | null,
  intent: string,
  sql: Sql = db(),
): Promise<PartRow | null> {
  const [row] = await sql<PartRow[]>`
    update parts
    set intent = ${intent},
        label = coalesce(${label}, label),
        strudel = null,
        status = 'pending'
    where id = ${partId} and song_id = ${songId}
    returning *`;
  return row ?? null;
}
