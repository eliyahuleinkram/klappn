import type { Sql } from "postgres";
import { db, ownsTransientClient } from "./db";

/**
 * issues.ts — persistent flagging of everything that goes wrong in the pipeline (2026-07-02, the
 * user: "we should be able to flag any issues that happen"). Every gate failure, every browser
 * error the self-heal reports, every repair outcome lands here — queryable, so failure classes
 * surface instead of vanishing into console logs.
 *
 * Best-effort by construction: flagging must never break the flow it observes. The table is
 * created lazily on first use (idempotent), so no manual migration is required.
 */
let ensured = false;

export async function flagIssue(
  kind: string,
  detail: string,
  ids?: { songId?: string | null; partId?: string | null },
  sql?: Sql,
): Promise<void> {
  // No caller-provided client + no request scope (a Workflow step): db() mints a fresh
  // one-connection client that ONLY this call knows about — it must be closed here, or the
  // connection orphans at the origin (this exact default-param leak re-exhausted
  // max_connections on 2026-07-05; flagIssue fires on every gate failure).
  const owned = !sql && ownsTransientClient();
  const s = sql ?? db();
  try {
    if (!ensured) {
      await s`
        create table if not exists issues (
          id bigint generated always as identity primary key,
          song_id text,
          part_id text,
          kind text not null,
          detail text not null,
          created_at timestamptz not null default now()
        )`;
      await s`create index if not exists issues_kind_idx on issues (kind, created_at desc)`;
      ensured = true;
    }
    await s`
      insert into issues (song_id, part_id, kind, detail)
      values (${ids?.songId ?? null}, ${ids?.partId ?? null}, ${kind}, ${detail.slice(0, 2000)})`;
  } catch (e) {
    console.error("[klappn] flagIssue failed", e);
  } finally {
    if (owned) await s.end({ timeout: 5 }).catch(() => {});
  }
}
