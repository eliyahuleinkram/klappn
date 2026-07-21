import type { Sql } from "postgres";
import type { ModelCallRecord } from "./llm";
import { db, ownsTransientClient } from "./db";

/**
 * Persistence for the model-call training corpus (model_calls + model_prompts).
 *
 * Why a separate prompt table: the system prompt is huge (the Strudel spec etc.) and IDENTICAL
 * across thousands of calls. Storing it per row would bloat the table ~10× for no signal,
 * so we dedupe it by hash into `model_prompts` and reference it by `system_hash` from each
 * `model_calls` row. Full training input = join the two back.
 *
 * IMPORTANT: callers BUFFER records in memory and call `saveModelCalls` in BATCH at awaited
 * checkpoints (per part). NEVER call it once-per-model-call — a fresh connection per call
 * leaks PlanetScale slots on Workers (see the Workflows worker's makeMeter/makeCallTrace).
 */

/** FNV-1a-style 64-bit hash (two 32-bit halves) as 16 hex chars. NOT cryptographic — just a
 *  dedupe key. A collision would at worst merge two distinct system prompts into one row, which
 *  is vanishingly unlikely for our ~dozen prompts and harmless. Synchronous (no Web Crypto await). */
export function promptHash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc9dc5118;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + 0x9e3779b9), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Batch-write a buffer of model calls: upsert the (deduped) system prompts first, then the
 *  call rows. One connection for the whole batch. Throws on DB error so the caller can re-queue. */
export async function saveModelCalls(
  recs: ModelCallRecord[],
  sql: Sql,
): Promise<void> {
  if (!recs.length) return;

  const prompts = new Map<string, { hash: string; kind: string; text: string }>();
  const rows = recs.map((r) => {
    const hash = promptHash(r.system);
    if (!prompts.has(hash)) prompts.set(hash, { hash, kind: r.kind, text: r.system });
    return {
      song_id: r.songId ?? null,
      part_id: r.partId ?? null,
      kind: r.kind,
      attempt: r.attempt ?? null,
      model: r.model ?? null,
      effort: r.effort ?? null,
      thinking: r.thinking ?? null,
      system_hash: hash,
      user_text: r.userText,
      output: r.output,
      total_tokens: r.totalTokens ?? null,
      input_tokens: r.inputTokens ?? null,
      output_tokens: r.outputTokens ?? null,
      cache_read_tokens: r.cacheReadTokens ?? null,
      cache_write_tokens: r.cacheWriteTokens ?? null,
      latency_ms: r.latencyMs ?? null,
    };
  });

  await sql`insert into model_prompts ${sql(
    [...prompts.values()],
    "hash",
    "kind",
    "text",
  )} on conflict (hash) do nothing`;

  await sql`insert into model_calls ${sql(
    rows,
    "song_id",
    "part_id",
    "kind",
    "attempt",
    "model",
    "effort",
    "thinking",
    "system_hash",
    "user_text",
    "output",
    "total_tokens",
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "latency_ms",
  )}`;
}

/**
 * APP-WORKER capture (the Workflows worker has its own makeCallTrace): buffer every
 * cfg.onCall record in memory and batch-write at ONE awaited `flush()` before the route
 * returns. Inside a request `db()` is the request-scoped shared client (closed by the
 * scope teardown); with no scope on workerd (a background job) the minted transient
 * client is closed HERE — the flagIssue default-param leak, not repeated (see
 * [db-connection-leak-fix]). Best-effort by construction: a failed flush logs and drops
 * (the route must never fail because the training logger did).
 */
export function makeCallSink(ids?: { songId?: string; partId?: string }) {
  const cur = { ...ids };
  const pending: ModelCallRecord[] = [];
  const onCall = (rec: ModelCallRecord) => {
    pending.push(rec);
  };
  /** Stamp/override the ids records get at flush — for routes where the song is
   *  CREATED after the model call (the derive-then-create flow). */
  const setIds = (patch: { songId?: string; partId?: string }) => {
    Object.assign(cur, patch);
  };
  const flush = async (): Promise<void> => {
    if (!pending.length) return;
    const batch = pending
      .splice(0)
      .map((r) => ({ ...r, songId: r.songId ?? cur.songId, partId: r.partId ?? cur.partId }));
    const owned = ownsTransientClient();
    const sql = db();
    try {
      await saveModelCalls(batch, sql);
    } catch (e) {
      console.error("[klappn] call-sink flush failed", e);
    } finally {
      if (owned) await sql.end({ timeout: 5 }).catch(() => {});
    }
  };
  return { onCall, setIds, flush };
}
