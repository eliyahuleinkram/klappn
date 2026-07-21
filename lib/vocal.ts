import type { Sql } from "postgres";
import { db } from "./db";

/**
 * VOCAL TAKES — the user's voice as a first-class layer of a song.
 *
 * The take stored here is the PROCESSED render: the browser records (or
 * accepts an upload), cleans it (capture-time AEC/NS + spectral gate), tunes
 * it to the song's key, aligns its timing to the beat grid (lib/vocal-dsp.ts),
 * and uploads the result as WAV. `fx` are the non-destructive playback knobs;
 * `lyrics` the timed words for the one standardized word display.
 */

export interface VocalTakeRow {
  id: string;
  song_id: string;
  user_id: string;
  r2_key: string;
  /** The RAW take (echo-cancelled, otherwise untouched mono WAV) — the source
   *  a key/transpose change re-tunes from. Null on legacy takes. */
  raw_r2_key: string | null;
  /** THE ANCHOR — the loop the voice is glued to: the first part in the mix
   *  at record time. Playback derives the voice's song-time origin from where
   *  this part sits NOW, so rearranging (e.g. prepending a loop) carries the
   *  voice with its loop. Null (or a deleted part) = origin 0, the legacy
   *  behavior. */
  anchor_part_id: string | null;
  /** Seconds into the TAKE where the anchor part began at record time. */
  anchor_offset_sec: number | null;
  title: string | null;
  duration_ms: number;
  fx: Record<string, unknown>;
  lyrics: { w: string; t0: number; t1: number }[] | null;
  created_at: string;
  updated_at: string;
}

export function vocalKey(songId: string, takeId: string): string {
  return `vocals/${songId}/${takeId}.wav`;
}

export function vocalRawKey(songId: string, takeId: string): string {
  return `vocals/${songId}/${takeId}.raw.wav`;
}

export async function listVocalTakes(
  songId: string,
  userId: string,
  sql: Sql = db(),
): Promise<VocalTakeRow[]> {
  return sql<VocalTakeRow[]>`
    select * from vocal_takes
    where song_id = ${songId} and user_id = ${userId}
    order by created_at desc`;
}

export async function getVocalTake(
  takeId: string,
  userId: string,
  sql: Sql = db(),
): Promise<VocalTakeRow | null> {
  const [row] = await sql<VocalTakeRow[]>`
    select * from vocal_takes where id = ${takeId} and user_id = ${userId}`;
  return row ?? null;
}

export async function createVocalTake(
  songId: string,
  userId: string,
  durationMs: number,
  fx: Record<string, unknown>,
  title: string | null = null,
  sql: Sql = db(),
  opts?: {
    /** Also point raw_r2_key at vocals/<song>/<take>.raw.wav (the caller is
     *  about to upload the raw alongside the render). */
    withRaw?: boolean;
    anchorPartId?: string | null;
    anchorOffsetSec?: number | null;
  },
): Promise<VocalTakeRow> {
  const [row] = await sql<VocalTakeRow[]>`
    insert into vocal_takes (song_id, user_id, r2_key, duration_ms, fx, title,
                             anchor_part_id, anchor_offset_sec)
    values (${songId}, ${userId}, '', ${Math.max(0, Math.round(durationMs))},
            ${sql.json(fx as Parameters<typeof sql.json>[0])},
            ${title ? title.slice(0, 120) : null},
            ${opts?.anchorPartId ?? null}, ${opts?.anchorOffsetSec ?? null})
    returning *`;
  // The keys embed the take id, so they land in a second write.
  const key = vocalKey(songId, row.id);
  const rawKey = opts?.withRaw ? vocalRawKey(songId, row.id) : null;
  await sql`update vocal_takes
    set r2_key = ${key}, raw_r2_key = ${rawKey} where id = ${row.id}`;
  return { ...row, r2_key: key, raw_r2_key: rawKey };
}

export async function updateVocalTake(
  takeId: string,
  userId: string,
  patch: {
    fx?: Record<string, unknown>;
    lyrics?: { w: string; t0: number; t1: number }[] | null;
    title?: string;
    durationMs?: number;
    rawR2Key?: string | null;
    anchorPartId?: string | null;
    anchorOffsetSec?: number | null;
  },
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update vocal_takes set
      fx = ${patch.fx === undefined ? sql`fx` : sql.json(patch.fx as Parameters<typeof sql.json>[0])},
      lyrics = ${patch.lyrics === undefined ? sql`lyrics` : patch.lyrics === null ? null : sql.json(patch.lyrics as unknown as Parameters<typeof sql.json>[0])},
      title = ${patch.title === undefined ? sql`title` : patch.title.trim().slice(0, 120) || null},
      duration_ms = ${patch.durationMs === undefined ? sql`duration_ms` : Math.max(0, Math.round(patch.durationMs))},
      raw_r2_key = ${patch.rawR2Key === undefined ? sql`raw_r2_key` : patch.rawR2Key},
      anchor_part_id = ${patch.anchorPartId === undefined ? sql`anchor_part_id` : patch.anchorPartId},
      anchor_offset_sec = ${patch.anchorOffsetSec === undefined ? sql`anchor_offset_sec` : patch.anchorOffsetSec}
    where id = ${takeId} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}

/** THE LIBRARY — every take the user has kept, across all songs, newest first
 *  (each carries its song's title so the picker can say where it was born). */
export async function listAllVocalTakes(
  userId: string,
  sql: Sql = db(),
): Promise<(VocalTakeRow & { song_title: string })[]> {
  return sql<(VocalTakeRow & { song_title: string })[]>`
    select v.*, s.title as song_title
    from vocal_takes v join songs s on s.id = v.song_id
    where v.user_id = ${userId}
    order by v.created_at desc
    limit 200`;
}

export async function deleteVocalTake(
  takeId: string,
  userId: string,
  sql: Sql = db(),
): Promise<{ r2_key: string; raw_r2_key: string | null } | null> {
  const [row] = await sql<{ r2_key: string; raw_r2_key: string | null }[]>`
    delete from vocal_takes where id = ${takeId} and user_id = ${userId}
    returning r2_key, raw_r2_key`;
  return row ?? null;
}

// (The key→scale helper lives in lib/vocal-pipeline.ts — it's pure math and
// the CLIENT needs it; this module pulls in postgres and must stay server-only.)
