import { db } from "./db";

/**
 * SKETCHES — the zaltz IDE's saved work: one row = one live-coding sketch,
 * a Strudel pane (music) + a Hydra pane (visuals), hand-written. Ownership is
 * enforced here like everywhere else: every query filters by user_id. Guests
 * (anonymous users) own sketches exactly like accounts do — the claim merge
 * (lib/guest.ts) moves them when the account arrives.
 */

export interface SketchRow {
  id: string;
  title: string;
  strudel: string;
  hydra: string;
  updated_at: string;
}

/** Hard caps — a sketch is a screen of code, not a blob store. */
export const SKETCH_TITLE_MAX = 120;
export const SKETCH_CODE_MAX = 40_000;
const SKETCHES_PER_USER = 500;

export function clampSketch(input: {
  title?: unknown;
  strudel?: unknown;
  hydra?: unknown;
}): { title?: string; strudel?: string; hydra?: string } {
  const out: { title?: string; strudel?: string; hydra?: string } = {};
  if (typeof input.title === "string")
    out.title = input.title.trim().slice(0, SKETCH_TITLE_MAX) || "untitled sketch";
  if (typeof input.strudel === "string") out.strudel = input.strudel.slice(0, SKETCH_CODE_MAX);
  if (typeof input.hydra === "string") out.hydra = input.hydra.slice(0, SKETCH_CODE_MAX);
  return out;
}

export async function listSketches(userId: string): Promise<SketchRow[]> {
  const sql = db();
  return await sql<SketchRow[]>`
    select id, title, strudel, hydra, updated_at
    from sketches where user_id = ${userId}
    order by updated_at desc
    limit 200`;
}

/** Insert while the user is under the cap; null = cap reached. */
export async function createSketch(
  userId: string,
  fields: { title?: string; strudel?: string; hydra?: string },
): Promise<SketchRow | null> {
  const sql = db();
  const rows = await sql<SketchRow[]>`
    insert into sketches (user_id, title, strudel, hydra)
    select ${userId}, ${fields.title ?? "untitled sketch"},
           ${fields.strudel ?? ""}, ${fields.hydra ?? ""}
    where (select count(*) from sketches where user_id = ${userId}) < ${SKETCHES_PER_USER}
    returning id, title, strudel, hydra, updated_at`;
  return rows[0] ?? null;
}

export async function updateSketch(
  id: string,
  userId: string,
  fields: { title?: string; strudel?: string; hydra?: string },
): Promise<SketchRow | null> {
  const sql = db();
  const rows = await sql<SketchRow[]>`
    update sketches set
      title   = coalesce(${fields.title ?? null}, title),
      strudel = coalesce(${fields.strudel ?? null}, strudel),
      hydra   = coalesce(${fields.hydra ?? null}, hydra)
    where id = ${id} and user_id = ${userId}
    returning id, title, strudel, hydra, updated_at`;
  return rows[0] ?? null;
}

export async function deleteSketch(id: string, userId: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    delete from sketches where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}
