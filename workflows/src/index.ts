/**
 * Klappn Workflows Worker.
 *
 * This is a separate Cloudflare Worker (deployed independently of the vinext
 * Next.js app) whose only job is to host the two durable Workflows. Keeping the
 * Workflow classes here — rather than trying to export them from the vinext
 * worker — is what lets the Next.js app stay framework-neutral: it triggers
 * these Workflows over the Cloudflare REST API (see lib/workflows.ts).
 *
 * The heavy lifting lives in the shared, Cloudflare-free job core (lib/jobs.ts);
 * here we only wrap each unit of work in a durable `step.do(...)` so a failure
 * retries that step alone.
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getSql } from "../../lib/db";
import {
  applyPartEdit,
  attachSongVisualEverywhere,
  buildArrangement,
  composePartWith,
  enrichPartTracks,
  convertOnePartMeter,
  editLoopDirect,
  flipSongMeterPlan,
  loadSongContext,
  mergeGenWithUserEdits,
  paintSongVisual,
  runEdit,
  writePartProgressMerged,
  type StepRunner,
} from "../../lib/jobs";
import { hasHydra, type SongVisual } from "../../lib/hydra-embed";
import {
  saveSongVisual,
  setPartMessage,
  setPartStatus,
  setSongStatus,
  writePartComposition,
} from "../../lib/songs";
import { addTokenUsage } from "../../lib/billing";
import { saveModelCalls } from "../../lib/call-trace";
import type { ModelCallRecord } from "../../lib/llm";
import type { ClaudeConfig } from "../../lib/anthropic";

interface Env {
  HYPERDRIVE: { connectionString: string };
  // One model: Fable 5 via the native Anthropic API (lib/llm.ts).
  ANTHROPIC_API_KEY: string;
  CLAUDE_MODEL?: string;
  // Anthropic fast mode opt-in (set "1" once the org has a non-zero fast-mode rate limit).
  FAST_MODE?: string;
  KLAPPN_MOCK_LLM?: string;
}

function cfgOf(env: Env): ClaudeConfig {
  // process.env is empty on this worker — every key threads through cfg.
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.CLAUDE_MODEL,
    fastMode: env.FAST_MODE === "1" || env.FAST_MODE === "true",
    mock: env.KLAPPN_MOCK_LLM === "1" || env.KLAPPN_MOCK_LLM === "true",
  };
}

/**
 * Run one unit of DB work on a FRESH, warmed, per-step Postgres client.
 *
 * Each durable `step.do(...)` can execute in a different Worker invocation than
 * the one that started the run (retries, 30-min timeouts, resumes). A
 * connection created in one invocation cannot be used in another on Cloudflare
 * Workers, so we must NOT share a client across steps — we open one inside the
 * step, warm it (a cold `sql.begin()`/`reserve()` hangs over Hyperdrive — see
 * lib/db.ts → warmPool), and close it when the step finishes.
 */
async function withSql<T>(
  env: Env,
  fn: (sql: ReturnType<typeof getSql>) => Promise<T>,
): Promise<T> {
  const sql = getSql(env.HYPERDRIVE.connectionString);
  try {
    await sql`select 1`; // warm the connection before any transaction
    return await fn(sql);
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* ignore close errors */
    }
  }
}

/**
 * Token meter that NEVER opens a DB connection per model call. `cfg.onUsage` fires (UNAWAITED — see
 * `void cfg?.onUsage?.()` in lib/llm.ts) after EVERY model call, so making it open+close a fresh
 * postgres client each time LEAKED connections on Workers: the client's `.end()` raced with the
 * step's I/O-context teardown and never completed, piling up open PlanetScale connections until
 * `max_connections` was exhausted (FATAL "remaining connection slots are reserved for SUPERUSER").
 * Fix: accumulate in memory (pure, no I/O — genuinely safe to fire-and-forget) and `flush()` at
 * AWAITED checkpoints (per part / before each return), which opens ONE connection that's awaited so
 * it closes cleanly. A crash loses at most the unflushed tail; flushing per-part bounds that, and a
 * failed flush re-queues so the next checkpoint retries.
 */
function makeMeter(env: Env, userId: string) {
  let pending = 0;
  const onUsage = (tokens: number) => {
    if (userId && tokens > 0) pending += tokens;
  };
  const flush = async () => {
    const n = pending;
    if (n <= 0) return;
    pending = 0;
    try {
      await withSql(env, (sql) => addTokenUsage(userId, n, sql));
    } catch {
      pending += n; // re-queue; the next checkpoint retries
    }
  };
  return { onUsage, flush };
}

/**
 * TRAINING-DATA capture, same connection-safe shape as makeMeter: `cfg.onCall` fires after EVERY
 * model call (UNAWAITED), so it ONLY buffers in memory — `flush()` at awaited per-part checkpoints
 * opens ONE connection and batch-writes. `setPart()` stamps the part the calls belong to (songId is
 * stamped always). A failed flush re-queues for the next checkpoint; a crash loses only the tail.
 */
function makeCallTrace(env: Env, songId: string) {
  let pending: ModelCallRecord[] = [];
  let partId: string | undefined;
  const setPart = (id?: string) => {
    partId = id;
  };
  const onCall = (rec: ModelCallRecord) => {
    pending.push({ ...rec, songId: rec.songId ?? songId, partId: rec.partId ?? partId });
  };
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    try {
      await withSql(env, (sql) => saveModelCalls(batch, sql));
    } catch {
      pending = batch.concat(pending); // re-queue; the next checkpoint retries
    }
  };
  return { onCall, setPart, flush };
}

export class GenerationWorkflow extends WorkflowEntrypoint<
  Env,
  {
    songId: string;
    partId?: string;
    partIds?: string[];
    provider?: string;
  }
> {
  async run(
    event: WorkflowEvent<{
      songId: string;
      partId?: string;
      partIds?: string[];
      provider?: string;
    }>,
    step: WorkflowStep,
  ) {
    // partId set → generate ONLY that loop (loop-by-loop); partIds → exactly
    // those parts IN THE GIVEN ORDER (e.g. a new loop, then the bridge that
    // needs its code); omitted → every not-yet-ready loop (whole-song). Either
    // way, already-ready loops are kept.
    const { songId, partId, partIds } = event.payload;
    const env = this.env;
    const cfg = cfgOf(env);

    // Flip the song to generating + snapshot plan/parts (one step).
    const ctx = await step.do("load", () =>
      withSql(env, async (sql) => {
        await setSongStatus(songId, "generating", sql);
        const { plan, parts, userId, model } = await loadSongContext(songId, sql);
        return {
          plan,
          userId,
          model,
          parts: parts.map((p) => ({
            id: p.id,
            position: p.position,
            label: p.label,
            intent: p.intent,
            bars: p.bars,
            status: p.status,
            strudel: p.status === "ready" ? p.strudel : null,
            kind:
              p.kind === "bridge" || p.kind === "break"
                ? p.kind
                : ("loop" as const),
          })),
        };
      }),
    );

    // MODEL TOGGLE: route every call in this run to the song's chosen model
    // (persisted at creation).
    cfg.model = ctx.model;

    // BILLING METER: every model call reports its real token usage; record it against the song's
    // owner. Accumulated IN MEMORY and flushed at awaited checkpoints (per part + finalize) — never a
    // fresh connection per call (that leaked connections; see makeMeter).
    const meter = makeMeter(env, ctx.userId);
    cfg.onUsage = meter.onUsage;
    // TRAINING CORPUS: capture every model call (incl. failed compose retries) for future
    // fine-tuning. Same in-memory-buffer + per-part-flush discipline as the meter.
    const trace = makeCallTrace(env, songId);
    cfg.onCall = trace.onCall;

    // Prior-part context, accumulated so each new part hears the ones before it.
    const done = new Map<number, { label: string | null; strudel: string }>();
    for (const p of ctx.parts) {
      if (p.status === "ready" && p.strudel)
        done.set(p.position, { label: p.label, strudel: p.strudel });
    }

    // AUTO-VISUALS: every song gets its ONE visual, painted IN PARALLEL with the music.
    // The trigger is the FIRST composing loop's foundation — three streamed layers is
    // real music to sync to (the early layers fix the loop's cycle length) while the
    // remaining layers + sections still compose, so the paint costs ~zero wall-clock.
    // The finished visual lands canonically on plan.visual (parts composed after that
    // attach it as they write — composePart reads the SAME plan object), and a closing
    // sweep before finalize dresses any part whose ready write beat the paint. Failure
    // is silent by design: a song without visuals plays fine; the music is never
    // blocked, delayed or failed on account of a visual.
    const hasVisual =
      !!ctx.plan.visual?.hydra ||
      ctx.parts.some((p) => p.strudel && hasHydra(p.strudel));
    let visual: SongVisual | null = null;
    let visualRun: Promise<void> | null = null;
    const startVisual = (music: string, intent: string | undefined) => {
      visualRun = (async () => {
        const v = await paintSongVisual(music, ctx.plan, intent, cfg, runStep, "auto");
        if (!v) return;
        visual = v;
        ctx.plan.visual = v; // later parts in THIS run attach it at compose time
        await step.do("visual-save", () =>
          withSql(env, (sql) => saveSongVisual(songId, v, sql)),
        );
      })().catch((e) => console.error("[klappn] auto-visuals failed", e));
    };

    // CRITICAL: each model call is its own durable step. A single step is killed
    // at ~5 min wall-time, and the whole refine loop (several slow pro-model
    // calls) blows past that — so we never cram the loop into one step.
    // NO RETRIES on model steps. Every step here wraps a Fable-5 call, which is
    // expensive — a retried compose can re-burn an entire (max-thinking) call's
    // tokens. The 90s stall watchdog + 8-min wall in lib/llm.ts already abort a
    // hung stream cleanly; on failure we'd rather flag the part as error (the
    // loop page offers a one-tap retry the USER chooses to pay for) than silently
    // pay for 3 attempts. `limit: 0` = exactly one shot.
    const runStep: StepRunner = (name, fn) =>
      step.do(name, { timeout: "10 minutes", retries: { limit: 0, delay: "1 second" } }, fn);

    // The compose QUEUE. partIds → exactly those, in the caller's order (a
    // bridge is listed after the loop it depends on). Otherwise: every pending
    // part, LOOPS FIRST — a bridge is composed from both neighbours' finished
    // code, so it must never run before them.
    const wanted = partIds?.length ? partIds : partId ? [partId] : null;
    const queue = wanted
      ? wanted
          .map((id) => ctx.parts.find((p) => p.id === id))
          .filter((p): p is (typeof ctx.parts)[number] => !!p)
      : [...ctx.parts].sort((a, b) =>
          a.kind === b.kind
            ? a.position - b.position
            : a.kind === "bridge"
              ? 1
              : -1,
        );

    // ENRICH AT BIRTH — each freshly written part's tweak panels build in
    // parallel with the NEXT part's composition (zero wall-clock added);
    // collected before the run ends. Idempotent per layer, best-effort.
    const enrichRuns: Promise<unknown>[] = [];

    for (const p of queue) {
      if (p.status === "ready") continue;
      trace.setPart(p.id); // stamp this part on every model call it triggers
      // Mark this part generating — AND first confirm the song still EXISTS. If it
      // was deleted mid-run, STOP the whole run now so we don't keep spending
      // (expensive) model calls on a dead song. The delete path also terminates
      // this instance outright; this is the belt-and-suspenders that catches a
      // race or a missed terminate. Existence — not status — is the liveness
      // test: with CONCURRENT runs (extend-before + extend-after are two scoped
      // workflows on one song) whichever finishes first flips the song 'ready',
      // and the slower run must re-assert 'generating' and keep composing, not
      // abandon its part.
      const live = await step.do(`mark-${p.id}`, () =>
        withSql(env, async (sql) => {
          const [s] = await sql<{ status: string }[]>`
            select status from songs where id = ${songId}`;
          if (!s) return false;
          if (s.status !== "generating") await setSongStatus(songId, "generating", sql);
          await setPartStatus(p.id, "generating", sql);
          // RETRY = A FRESH TAKE. A part that errored mid-compose still carries the dead
          // run's partial tracks/strudel, and every progress write MERGES with the DB —
          // preferring the DB per layer (mergeGenWithUserEdits, protecting mid-build user
          // tweaks) — so without this wipe the new run's layers were silently REPLACED by
          // the failed run's, index by index ("retry just continues the previous loop").
          // Composing always starts from a clean part; the tweak protection is meant for
          // edits made DURING a run, which still works. (Queued parts are never 'ready'.)
          await sql`update parts set tracks = null, strudel = null where id = ${p.id}`;
          // Best-effort: also drop a stale mobile twin (column may lag on drifted local DBs).
          await sql`update parts set strudel_mobile = null where id = ${p.id}`.catch(() => {});
          return true;
        }),
      );
      if (!live) {
        // Song gone or no longer generating — stop making calls. Settle an in-flight
        // auto-paint first (it never rejects) so the run doesn't exit around live steps.
        if (visualRun) await visualRun;
        return;
      }

      const priorParts = [...done.entries()]
        .filter(([pos]) => pos < p.position)
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => ({ label: v.label ?? "", strudel: v.strudel }));
      const target = {
        label: p.label ?? "",
        intent: p.intent ?? "",
        bars: p.bars ?? 8,
        kind: p.kind,
      };

      try {
        // composePartWith runs in run()'s context (NOT inside a step); each of
        // its score/pick/translate calls becomes its own step via runStep.
        const composed = await composePartWith(
          ctx.plan,
          priorParts,
          target,
          cfg,
          runStep,
          p.id,
          buildArrangement(ctx.parts, p.position),
          // live narration sink — each Flash line lands on this part's row, which
          // the client is already polling. Best-effort; never blocks composition.
          (msg) => withSql(env, (sql) => setPartMessage(p.id, msg, sql)),
          // STREAMING sink — persist each track the instant it lands (best-effort,
          // outside a durable step) so the client shows + plays it while the rest
          // of the stack is still composing. ALSO the auto-paint trigger: the first
          // loop's third layer = the foundation is real, start the visual (un-awaited —
          // it runs beside the remaining layers, never holding a track write).
          (tracks, code) => {
            if (!hasVisual && !visualRun && p.kind === "loop" && tracks.length >= 3)
              startVisual(code, p.intent ?? undefined);
            return withSql(env, (sql) =>
              writePartProgressMerged(
                p.id,
                tracks,
                ctx.plan.bpm,
                ctx.plan.timeSignature ?? "4/4",
                sql,
              ),
            );
          },
        );
        await step.do(`write-${p.id}`, () =>
          withSql(env, async (sql) => {
            // Layer engine: merge in any layer the user tweaked mid-build so this final "ready" write
            // doesn't clobber it (`composed.tracks` is the generator's original, edit-free set). The
            // legacy score path (tracks null) has no per-layer edits — write it as-is.
            if (composed.tracks) {
              const { tracks, code } = await mergeGenWithUserEdits(
                p.id,
                composed.tracks,
                ctx.plan.bpm,
                ctx.plan.timeSignature ?? "4/4",
                sql,
                // Carry the song visual composePart attached (inherited or auto-painted)
                // across the re-merge — a bare merge strips the @hydra/@vcontrols blocks.
                composed.code,
              );
              await writePartComposition(p.id, code, composed.score, composed.sounds, tracks, "ready", sql);
            } else {
              await writePartComposition(p.id, composed.code, composed.score, composed.sounds, composed.tracks, "ready", sql);
            }
          }),
        );
        done.set(p.position, { label: p.label, strudel: composed.code });
        // Keep the in-memory snapshot CURRENT: a bridge composed later in this
        // run reads its neighbours from the arrangement — it must see the loop
        // that just finished, not the pending row from the load step.
        p.status = "ready";
        p.strudel = composed.code;
        // ENRICH AT BIRTH: every layer's tweak panel, in parallel with the next
        // part's composition — a card is live before anyone can tap it.
        enrichRuns.push(
          withSql(env, (sql) => enrichPartTracks(songId, p.id, cfg, sql)).catch(
            (e) => console.error(`[klappn] enrich sweep for part ${p.id} failed`, e),
          ),
        );
        // (THE UNFOLDING removed 2026-07-16, the user: no more blueprints —
        // a prompt makes ONE loop; more loops are the user's own taps.)
      } catch (err) {
        // One stubborn part shouldn't kill the whole song — flag it WITH the reason
        // (so the failure is diagnosable, not silent), then keep going.
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[klappn] part ${p.id} (${p.label}) failed to compose:`, err);
        await step.do(`err-${p.id}`, () =>
          withSql(env, (sql) =>
            setPartStatus(p.id, "error", sql, `compose failed: ${reason}`.slice(0, 500)),
          ),
        );
      }
      // Flush the meter + call-trace once per part (a single awaited connection each), not once per model call.
      await meter.flush();
      await trace.flush();
    }

    // Close out the auto-paint BEFORE finalize: the visual is typically long done (it
    // raced a whole composition), and the sweep dresses any part written before it
    // landed. Order matters — the client stops polling the moment the song is 'ready',
    // so a visual saved after finalize would sit unseen until a reload.
    if (visualRun) {
      await visualRun;
      const v = visual;
      if (v) {
        await step.do("visual-sweep", () =>
          withSql(env, (sql) => attachSongVisualEverywhere(songId, v, sql)),
        );
      }
    }

    // (AUTO-SHAPE at birth lived here for a few hours on 2026-07-21 and was
    // reversed by the user: the whole-song sweep is a CHOICE now — the song
    // page offers it in a pill after a new loop lands, and /api/songs/:id/shape
    // runs it only when tapped. Generation never re-shapes on its own.)

    // Finalize — but never over a SIBLING run's shoulder: with concurrent scoped
    // runs (extend both edges at once), the first to finish must leave the song
    // 'generating' while the other's part is still composing; the last one out
    // flips it 'ready'. Parts left 'pending' by a failed trigger don't hold the
    // song hostage (they have their own Generate button + the stale reconciler).
    await step.do("finalize", () =>
      withSql(env, async (sql) => {
        await sql`
          update songs set status = 'ready'
          where id = ${songId} and status = 'generating'
            and not exists (
              select 1 from parts
              where song_id = ${songId} and status = 'generating'
            )`;
      }),
    );
    await meter.flush();
    await trace.flush();

    // Collect the in-flight enrich sweeps (they ran beside composition;
    // almost always already settled) so their writes land inside the run.
    await Promise.allSettled(enrichRuns);
    await meter.flush();
    await trace.flush();

  }
}

export class EditWorkflow extends WorkflowEntrypoint<
  Env,
  {
    songId: string;
    changeRequest?: string;
    partId?: string;
    pill?: string;
    editRequest?: string;
    timeSignature?: string;
  }
> {
  async run(
    event: WorkflowEvent<{
      songId: string;
      changeRequest?: string;
      partId?: string;
      pill?: string;
      editRequest?: string;
      timeSignature?: string;
    }>,
    step: WorkflowStep,
  ) {
    const { songId, changeRequest, partId, pill, editRequest, timeSignature } = event.payload;
    const env = this.env;
    const cfg = cfgOf(env);
    // BILLING METER — same as generation: usage lands on the song's owner.
    const owner = await step.do("load-owner", () =>
      withSql(env, async (sql) => {
        const [s] = await sql<{ user_id: string; model: string | null }[]>`
          select user_id, model from songs where id = ${songId}`;
        return {
          // model is a reserved native id ("anthropic"/"glm"/"moonshot"/"gemini") OR an OpenRouter
          // slug — pass it through verbatim; complete() routes on it.
          userId: s?.user_id ?? "",
          model: s?.model ?? "anthropic",
        };
      }),
    );
    // Edits run on the SAME model the song was composed with (persisted at creation).
    cfg.model = owner.model;
    // Meter accumulates in memory; flushed before each exit below (never a connection per call).
    const meter = makeMeter(env, owner.userId);
    cfg.onUsage = meter.onUsage;
    // TRAINING CORPUS: capture every edit/meter model call too (same buffer + flush discipline).
    const trace = makeCallTrace(env, songId);
    cfg.onCall = trace.onCall;
    // The flushes live in a FINALLY: a thrown step used to abandon the whole
    // in-memory buffer, dropping the billing for calls that DID run and the
    // training capture of the failure itself — the exact runs the corpus rule
    // says to keep. Early returns flush the same way (empty flush is a no-op).
    try {
      // METER CHANGE: every loop rewritten IN SEQUENCE (1st, then 2nd, …), each
      // a high-effort Fable-5 rewrite in ITS OWN durable step — a whole-song
      // sequence in one step gets killed by the ~5-min per-step wall on any song
      // with 3+ loops. Per-loop failures are absorbed inside convertOnePartMeter
      // (that loop keeps its old code). No retries — a retry re-burns tokens.
      if (timeSignature) {
        const meterCtx = await step.do("meter-flip", () =>
          withSql(env, (sql) => flipSongMeterPlan(songId, timeSignature, sql)),
        );
        if (meterCtx.fromTs === timeSignature) return;
        for (let i = 0; i < meterCtx.partIds.length; i++) {
          const pid = meterCtx.partIds[i];
          trace.setPart(pid);
          await step.do(
            `meter-${pid}`,
            { timeout: "10 minutes", retries: { limit: 0, delay: "1 second" } },
            () =>
              withSql(env, (sql) =>
                convertOnePartMeter(
                  songId,
                  pid,
                  meterCtx.fromTs,
                  timeSignature,
                  { index: i, total: meterCtx.partIds.length },
                  sql,
                  cfg,
                ),
              ),
          );
          // Per-loop checkpoint (same discipline as generation's per-part
          // flush): a failure at loop 3 of 5 keeps loops 1–2 billed+captured.
          await meter.flush();
          await trace.flush();
        }
        return;
      }
      // VARIANT (edit pill): one loop, one tapped change. No retries — it's a
      // Fable-5 call; a failure surfaces and the user re-taps if they want it.
      if (partId && pill) {
        trace.setPart(partId);
        await step.do(
          "variant",
          { timeout: "15 minutes", retries: { limit: 0, delay: "1 second" } },
          () => withSql(env, (sql) => applyPartEdit(songId, partId, pill, sql, cfg)),
        );
        return;
      }
      // NATURAL-LANGUAGE loop edit, DIRECT (2026-07-03, the user): ONE Fable-5 HIGH call — the loop's
      // code + the song-aware brief (neighbours) + the request in, the complete revised loop out. No
      // router, no ops. Changed lines are gated (one retry with the real errors); a failure leaves the
      // loop untouched and surfaces.
      if (partId && editRequest) {
        trace.setPart(partId);
        await step.do(
          "loop-edit",
          { timeout: "30 minutes", retries: { limit: 0, delay: "1 second" } },
          () => withSql(env, (sql) => editLoopDirect(songId, partId, editRequest, sql, cfg)),
        );
        return;
      }
      if (!changeRequest) return;
      // The edit call sends the whole song and rewrites parts — also a Fable-5
      // call, also one-shot (no token-burning retries).
      await step.do(
        "edit",
        { timeout: "30 minutes", retries: { limit: 0, delay: "1 second" } },
        () => withSql(env, (sql) => runEdit(songId, changeRequest, sql, cfg)),
      );
    } finally {
      await meter.flush();
      await trace.flush();
    }
  }
}

// A minimal fetch handler so the worker is also reachable directly (health check
// / optional local-dev triggering via `wrangler dev`).
export default {
  async fetch(): Promise<Response> {
    return new Response("klappn workflows worker", { status: 200 });
  },
};
