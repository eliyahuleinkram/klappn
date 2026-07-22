import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM layer — Claude Fable 5, full stop. Every composition, edit, label and
 * critique call goes through `complete()` to the native Anthropic API; the
 * per-call ROUTE table sets effort, and the deterministic gates run for free
 * with at most ONE repair pass if a loop would crash. Callers (lib/anthropic.ts)
 * never see the wire.
 *
 * (Klappn spent its first month as a multi-provider bake-off — Kimi, GLM,
 * Gemini, Grok, an OpenRouter roster. Fable won on the ear, repeatedly, and the
 * zoo was removed 2026-07-20. `songs.model` history is preserved in the
 * training capture; the column now always reads "fable".)
 *
 * Hard rules (so they can't drift): adaptive thinking + per-call effort; NEVER
 * temperature/top_p/top_k/budget_tokens (they 400 on this model); the system
 * prompt is cached. A 90s no-event stall watchdog + an 8-min overall wall guard
 * every stream (see completeAnthropic).
 *
 * On the Workflows worker process.env is empty, so the key is threaded in via
 * LlmConfig; the Next.js app worker falls back to process.env.
 */

export interface LlmConfig {
  anthropicApiKey?: string;
  anthropicModel?: string;
  /** The song's stored model id. Always "fable" for new work; legacy values
   *  ("anthropic"/"sonnet"/…) from the bake-off era route to Fable too. */
  model?: string;
  /** Opt into Anthropic FAST MODE (`speed:"fast"`, 2.5× output tok/s, premium pricing). Only
   *  works once the org has a non-zero fast-mode rate limit. Threaded from env.FAST_MODE for the
   *  Workflows worker (its process.env is empty). Default off. */
  fastMode?: boolean;
  /** Force mock responses (handled by the caller, declared here for threading). */
  mock?: boolean;
  /** Billing meter: called after each model call with the TOTAL tokens used
   *  (input + output, thinking included). Must never throw; fire-and-forget. */
  onUsage?: (tokens: number) => unknown;
  /** Training-data capture: called after EACH model call with its FULL trajectory
   *  (system, user, raw output, tokens, latency, trace labels). Like onUsage it MUST
   *  never throw and is fire-and-forget — the sink BUFFERS in memory and batch-flushes;
   *  it must NEVER open a DB connection per call (that leaks connections — see the
   *  Workflows worker's makeMeter/makeCallTrace). Unset on non-traced paths. */
  onCall?: (rec: ModelCallRecord) => unknown;
  /** INTERNAL (set by complete()'s traced path, not by callers): raw per-call token
   *  counts straight from the provider's usage block — UNweighted, unlike onUsage's
   *  cost units — so the training corpus keeps the true input/output split. Same
   *  rules as onUsage: must never throw, fire-and-forget. */
  onRawUsage?: (u: RawTokenUsage) => unknown;
}

/** Raw provider-reported token counts for ONE model call (no cost weighting). */
export interface RawTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** One model call's full trajectory — the unit of training data we persist (model_calls).
 *  Failed/rejected attempts are captured too: each retry is its own complete() call, and
 *  the gate's feedback rides the NEXT attempt's `userText`, so the repair chain is whole. */
export interface ModelCallRecord {
  /** What the call was for: compose | polish | done | edit | meter | enrich | derive | breaks | other. */
  kind: string;
  songId?: string;
  partId?: string;
  /** 0-based retry index within one logical step (e.g. the compose layer's repair loop). */
  attempt?: number;
  /** The model/toggle that ran it (cfg.model: "anthropic" | "glm" | slug). */
  model?: string;
  effort?: string;
  thinking?: boolean;
  /** The (large, repeated) system prompt — deduped by hash into model_prompts on save. */
  system: string;
  userText: string;
  output: string;
  /** COST-WEIGHTED units (what onUsage meters) — kept for billing cross-checks. */
  totalTokens?: number;
  /** RAW provider counts — the true input/output split for training statistics. */
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs?: number;
}

const ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-8";

// ── PROVIDER ─────────────────────────────────────────────────────────────────
// One wire: the native Anthropic Messages API. Output tokens are metered at 5×
// input (the ×5 in completeAnthropic's usage handler).
export type Provider = "anthropic";

/** Per-call options for `complete()`. Returns the visible text. */
export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";
export interface CompleteOpts {
  /** Which provider runs THIS call (default "anthropic"; ROUTE sets it per call). */
  provider?: Provider;
  /** Output/reasoning effort for THIS call (low|medium|high|xhigh|max). Default "high". */
  effort?: AnthropicEffort;
  /** Legacy no-op (was the DeepSeek model tier). Single model now — ignored. */
  tier?: "pro" | "flash";
  /** Whether the model THINKS at all. false = mechanical copy (labels) → drops
   *  effort to "low". Default true. */
  thinking?: boolean;
  /** HARD token budget (thinking + answer) for THIS call, capping the effort
   *  tier's default. THE COMPLETION LEVER: Cloudflare kills a Workflow step at
   *  ~5 min wall-clock, and a thinking model streams at tens of tok/s — so a call allowed 24k
   *  tokens can be executed mid-thought (observed). Adaptive thinking PLANS
   *  within max_tokens, so a ~14k budget (~3.3 min) makes the call finish its
   *  thought instead of being killed mid-greatness. */
  maxTokens?: number;
  /** Training-trace labels for THIS call — surfaced to cfg.onCall so the captured row is
   *  labelled (kind/attempt + ids). Purely for data capture; never affects the request. */
  trace?: { kind?: string; songId?: string; partId?: string; attempt?: number };
  /** PROMPT-CACHE SPLIT: a STABLE user-prompt prefix (e.g. the loop brief) that
   *  repeats byte-identically across sibling calls while the rest of the user
   *  text varies (the layer loop's growing prior-tracks list). Rendered as its
   *  own cache-marked content block ahead of `userText`, so sibling calls hit
   *  [system + prefix] even when their tails diverge. Non-Anthropic providers
   *  and the training capture see it prepended to the user text — semantics
   *  identical, only the cache boundary moves. */
  cacheStable?: string;
}

/** Per-agent effort presets. The per-song TOGGLE (cfg.model) picks WHO runs each call;
 *  `effort` then bites on every model: high for the creative/critic passes, low for the
 *  cosmetic/mechanical ones. (Opus "max" can overthink, so the legacy score/translate
 *  passes run at "high".) Cosmetic structured-JSON (enrich) runs on the song's OWN
 *  model and RETRIES with an escalating budget + tolerant parse — see enrichLayers. */
export const ROUTE = {
  compose: { provider: "anthropic", effort: "high" } as CompleteOpts, // direct-Strudel compose/edit calls + hydra visuals (code)
  score: { provider: "anthropic", effort: "high" } as CompleteOpts, // legacy enumerated score
  pick: { provider: "anthropic", effort: "low" } as CompleteOpts, // instrument/kit per part
  translate: { provider: "anthropic", effort: "high" } as CompleteOpts, // legacy score → layers
  create: { provider: "anthropic", effort: "high" } as CompleteOpts, // framing planners (workspace + adjacent section) — HIGH: it sets bpm/key/progression/intent, great cascading effect downstream
  judge: { provider: "anthropic", effort: "high" } as CompleteOpts, // the hydra critic
  transform: { provider: "anthropic", effort: "low" } as CompleteOpts, // parameterize / suggest
  copy: { provider: "anthropic", effort: "low" } as CompleteOpts, // labels / narration
};

export async function complete(
  system: string,
  userText: string,
  cfg?: LlmConfig,
  opts?: CompleteOpts,
): Promise<string> {
  // FAST PATH: no training-capture sink → the routing call is byte-identical (zero overhead).
  if (!cfg?.onCall) return completeRoute(system, userText, cfg, opts);
  // TRACED PATH: time the call + capture THIS call's tokens (wrap onUsage so the meter still
  // sees them), then hand the full trajectory to cfg.onCall (buffered, never a per-call DB write).
  let callTokens = 0;
  // Raw counts ACCUMULATE — an internal retry/fallback replay is still one logical call,
  // and its spend belongs to this record (mirrors how callTokens sums onUsage).
  const raw: RawTokenUsage = {};
  const addRaw = (k: keyof RawTokenUsage, v?: number) => {
    if (v && v > 0) raw[k] = (raw[k] ?? 0) + v;
  };
  const tracingCfg: LlmConfig = {
    ...cfg,
    onUsage: (t: number) => {
      if (t > 0) callTokens += t;
      return cfg.onUsage?.(t);
    },
    onRawUsage: (u: RawTokenUsage) => {
      addRaw("inputTokens", u.inputTokens);
      addRaw("outputTokens", u.outputTokens);
      addRaw("cacheReadTokens", u.cacheReadTokens);
      addRaw("cacheWriteTokens", u.cacheWriteTokens);
    },
  };
  const started = Date.now();
  let output = "";
  try {
    output = await completeRoute(system, userText, tracingCfg, opts);
    return output;
  } finally {
    try {
      cfg.onCall({
        kind: opts?.trace?.kind ?? "other",
        songId: opts?.trace?.songId,
        partId: opts?.trace?.partId,
        attempt: opts?.trace?.attempt,
        model: cfg.model ?? "anthropic",
        effort: opts?.effort,
        thinking: opts?.thinking,
        system,
        userText: (opts?.cacheStable ?? "") + userText,
        output,
        totalTokens: callTokens || undefined,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        cacheReadTokens: raw.cacheReadTokens,
        cacheWriteTokens: raw.cacheWriteTokens,
        latencyMs: Date.now() - started,
      });
    } catch {
      /* capture must NEVER break generation */
    }
  }
}

async function completeRoute(
  system: string,
  userText: string,
  cfg?: LlmConfig,
  opts?: CompleteOpts,
): Promise<string> {
  // Every route lands on Fable 5. "sonnet" → Sonnet 5: legacy songs from the
  // multi-model era edit on what wrote them, AND the thinking-off cheap calls
  // (enrich / fx-enrich naming + the done-check) pin it deliberately — a
  // no-thinking call needs no Fable;
  // everything else — "fable", "anthropic", stale A/B ids, unset — is Fable.
  // HARD pin — no `cfg?.anthropicModel ??` fallback: both workers' cfg carries
  // the env default in anthropicModel, and a soft pin silently lost to it
  // (2026-07-02: every "fable" song was actually composed by Opus 4.8).
  const model = cfg?.model ?? process.env.MODEL_PROVIDER;
  if (model === "sonnet")
    return completeAnthropic(system, userText, { ...cfg, anthropicModel: "claude-sonnet-5" }, opts);
  return completeAnthropic(system, userText, { ...cfg, anthropicModel: "claude-fable-5" }, opts);
}

// --- Anthropic (Opus 4.8 / claude-opus-4-8) ---------------------------------

function anthropicClient(cfg?: LlmConfig): Anthropic {
  const apiKey = cfg?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  // maxRetries:0 — the SDK does NOT retry streaming requests anyway (verified), and we don't
  // want it re-running a call that already streamed. completeAnthropic does its own guarded,
  // pre-stream-only retry instead (see below).
  return new Anthropic({
    apiKey,
    timeout: 28 * 60 * 1000,
    maxRetries: 0,
    // Fast-mode research preview — gates the request `speed: "fast"` field (see completeAnthropic).
    defaultHeaders: { "anthropic-beta": "fast-mode-2026-02-01" },
  });
}

/** True for TRANSIENT Anthropic failures that are safe to retry BEFORE any token streams —
 *  5xx / overloaded / 429 / request-timeout / dropped connection. NOT a 4xx (bad request) or a
 *  watchdog user-abort, which must surface. Checks the SDK's APIError.status, the error-body
 *  type, and the message text (the error sometimes arrives as a JSON string). */
function isRetryableApiError(e: unknown): boolean {
  const any = e as {
    status?: number;
    error?: { status?: number; type?: string; error?: { type?: string } };
    type?: string;
    message?: string;
  };
  const status = any?.status ?? any?.error?.status;
  if (typeof status === "number" && (status === 408 || status === 409 || status === 429 || status >= 500))
    return true;
  const type = any?.error?.error?.type || any?.error?.type || any?.type;
  if (type === "overloaded_error" || type === "api_error") return true;
  return /internal server error|overloaded|ECONNRESET|ETIMEDOUT|EPIPE|fetch failed|socket hang up|terminated/i.test(
    String(any?.message ?? ""),
  );
}

async function completeAnthropic(
  system: string,
  userText: string,
  cfg?: LlmConfig,
  opts?: CompleteOpts,
): Promise<string> {
  const anthropic = anthropicClient(cfg);
  const model =
    cfg?.anthropicModel || process.env.CLAUDE_MODEL || ANTHROPIC_DEFAULT_MODEL;
  // Fable 5 has a different request surface than the Opus/Sonnet family:
  //  - thinking is ALWAYS ON — an explicit {type:"disabled"} 400s; the param must be OMITTED
  //    (adaptive is the only mode). noThink calls instead ride output_config effort "low".
  //  - fast mode (speed:"fast") is Opus 4.8/4.7 only — never send it on Fable.
  //  - safety classifiers can decline a request (HTTP 200, stop_reason "refusal") — we opt into
  //    the server-side fallback so a declined call is transparently re-served by Opus 4.8 in the
  //    same request (beta server-side-fallback-2026-06-01) instead of shipping an empty layer.
  const isFable = model.startsWith("claude-fable");
  // Default "high" (Opus's default thinking) everywhere now — composition,
  // critique, edits all run at high; the post-hoc validate + critique + refine
  // loop is the quality net (not deeper single-shot thinking). High is far
  // cheaper and far less likely to overthink/overrun the per-step wall than max.
  // Anthropic is one always-adaptive model, so tier is a no-op; only effort bites.
  // thinking:false (a pure SELECTION/copy call — e.g. the instrument pick) → thinking DISABLED
  // on Opus/Sonnet, not just low effort ({type:"disabled"} is faster/cheaper — no reasoning
  // tokens). On FABLE thinking can't be turned off, so the same flag maps to effort "low"
  // (adaptive barely thinks there). The prompt must be answer-only — our pick/copy prompts
  // already say "Output ONLY …", and the callers regex-extract the fields.
  const noThink = opts?.thinking === false;
  const effort = noThink ? "low" : (opts?.effort ?? "high");
  // Output budget TIERED BY EFFORT — thinking bills as output ($50/M on the top
  // models), so a flat 64k cap lets one runaway think cost dollars. 64k is only
  // what Anthropic recommends for max/xhigh; lower efforts think far less.
  const tierTokens =
    effort === "max" || effort === "xhigh"
      ? 64000
      : effort === "high"
        ? 24000
        : effort === "medium"
          ? 16000
          : 8000;
  // A per-call budget caps the tier (never raises it) — the completion lever
  // for calls living under the ~5-min Workflow step wall (see CompleteOpts).
  const maxTokens = Math.min(opts?.maxTokens ?? tierTokens, tierTokens);
  // FAST MODE (research preview, beta header `fast-mode-2026-02-01` set on the client) — up to
  // 2.5× higher output tok/s from Opus 4.8 at PREMIUM pricing ($10/$50 per MTok vs $5/$25). GATED
  // behind FAST_MODE (off by default): the org needs a NON-ZERO "fast mode tokens/min" rate limit
  // (a usage-tier / credit thing) or EVERY fast request 429s — so leaving it on with a 0 limit
  // would just add a failed-attempt + backoff to every call. cfg.fastMode covers the Workflows
  // worker (empty process.env); process.env.FAST_MODE covers the app worker. When on, a 429/529
  // (fast has no auto-fallback) is caught in the retry loop below and re-tried at STANDARD speed.
  const fast =
    model.startsWith("claude-opus") && // fast mode is Opus 4.8/4.7 ONLY — 400s on Fable/Sonnet
    (cfg?.fastMode === true ||
      process.env.FAST_MODE === "1" ||
      process.env.FAST_MODE === "true");
  const params = {
    model,
    max_tokens: maxTokens,
    ...(fast ? { speed: "fast" } : {}),
    // adaptive thinking + the per-call effort. Valid levels: low|medium|high|xhigh|max.
    // ⚠ "max" can overthink a single short part (one test ran ~7.5 min, no code) and,
    // with the ~5-min step wall + no refine loop, that part ERRORs — "xhigh" is the
    // proven fallback for generation. NEVER temperature/top_p/top_k/budget_tokens (400s).
    // Fable: OMIT thinking entirely (always-on adaptive; explicit disabled 400s) and always
    // send effort — "low" is the no-think substitute there.
    ...(isFable ? {} : { thinking: noThink ? { type: "disabled" } : { type: "adaptive" } }),
    ...(noThink && !isFable ? {} : { output_config: { effort } }),
    // PROMPT CACHING, two breakpoints. The system block alone is usually BELOW
    // Fable 5's 2048-token cacheable minimum (lean prompts!) — a marker there
    // never caches, which is why the console flagged a low hit rate. The
    // workhorse is the marker on the USER text: the layer-by-layer composer's
    // prompt is APPEND-ONLY across a loop's calls (system + brief + layers so
    // far), so caching system+user gives an incremental hit on every layer,
    // retry, and gate re-ask (reads ~0.1×, writes 1.25× — sub-minimum spans
    // silently skip, costing nothing). 1h on system: the same static system
    // strings recur across every song all day.
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...(opts?.cacheStable
            ? [{ type: "text" as const, text: opts.cacheStable, cache_control: { type: "ephemeral" as const } }]
            : []),
          { type: "text", text: userText, cache_control: { type: "ephemeral" } },
        ],
      },
    ],
    // DO NOT set temperature / top_p / top_k — any value 400s on Opus 4.8.
  } as Anthropic.MessageStreamParams;

  // STALL WATCHDOG + HARD WALL. Two independent failure modes seen in prod:
  //  1) SILENCE — a healthy stream emits events continuously (thinking deltas
  //     count), so 90s of NO events means the connection is dead, not busy.
  //  2) SLOW DRIP — a stream that emits one event just under every 90s but
  //     never finishes. The gap-watchdog NEVER trips, and (observed 2026-06-11)
  //     the Cloudflare step `timeout: "10 minutes"` did NOT kill the wedged
  //     await either — one compose sat "Working" for 3+ HOURS, freezing the
  //     song on "generating". The inter-event watchdog alone cannot catch this;
  //     we need an OVERALL deadline, like the minimax path's AbortSignal.timeout.
  // So: abort on 90s of silence OR after an 8-min overall wall (well under the
  // 10-min step timeout, so the step's own retry/fallback path takes over).
  const STALL_MS = 90_000;
  const HARD_CAP_MS = 8 * 60_000;

  // TRANSIENT-FAILURE RETRY. Anthropic 5xx / overloaded / 429 / dropped-connection errors
  // come in spikes (an incident) and happen BEFORE any token streams, so retrying them is
  // FREE — no thinking tokens were burned. We retry ONLY while nothing has streamed yet
  // (firstEventMs < 0); a mid-stream failure or our own watchdog abort (which can follow
  // burned tokens) is NEVER retried. This is the resilience the SDK's maxRetries does NOT
  // provide for streaming (verified: maxRetries:4 still 500s), and that the old
  // maxRetries:0 + step retries:0 lacked — a single transient 500 used to flag a whole part
  // as "error" and fail the song.
  const MAX_ATTEMPTS = 4;
  let res: Anthropic.Message | undefined;
  // Hoisted to function scope so the post-loop usage/cache log reads the SUCCESSFUL attempt's
  // telemetry (re-set at the top of each attempt below; were loop-scoped → out of scope at the log).
  let startedAt = Date.now();
  let firstEventMs = -1;
  let maxGapMs = 0;
  for (let attempt = 1; ; attempt++) {
    // Fable rides the BETA stream so we can attach the server-side refusal fallback: a policy
    // decline is re-served by Opus 4.8 inside the same call (declined-before-output attempts
    // aren't billed; the rescue bills at Opus rates). Everything else uses the plain stream.
    // The Beta stream class is runtime-identical for everything we touch (.on("streamEvent"),
    // .controller, .finalMessage()) — collapse the union so the handlers below typecheck once.
    const stream: ReturnType<typeof anthropic.messages.stream> = isFable
      ? (anthropic.beta.messages.stream({
          ...params,
          betas: ["server-side-fallback-2026-06-01"],
          fallbacks: [{ model: "claude-opus-4-8" }],
        } as unknown as Parameters<typeof anthropic.beta.messages.stream>[0]) as unknown as ReturnType<
          typeof anthropic.messages.stream
        >)
      : anthropic.messages.stream(params);
    startedAt = Date.now();
    let lastEvent = Date.now();
    // Stream-shape telemetry: time-to-first-event + the longest inter-event gap.
    // This is the data that tells a DEAD stream (no first event) apart from a
    // QUIET one (long thinking gaps) when diagnosing stalls from `wrangler tail`.
    firstEventMs = -1;
    maxGapMs = 0;
    stream.on("streamEvent", () => {
      const now = Date.now();
      if (firstEventMs < 0) {
        firstEventMs = now - startedAt;
        // One line per call: how long the API sat silent before the stream began.
        // The stalls we chase die BEFORE the first event — this makes that visible.
        console.log(`[klappn] anthropic(${model}) first event after ${firstEventMs}ms`);
      } else maxGapMs = Math.max(maxGapMs, now - lastEvent);
      lastEvent = now;
    });
    const watchdog = setInterval(() => {
      const now = Date.now();
      // Silence is only DEATH before the stream has begun. Once the first event
      // has arrived, the request is alive — and adaptive thinking emits ZERO
      // events while the model reasons (measured: a melody compose sent
      // message_start at ~4s then nothing for minutes; the old 90s rule shot 8
      // healthy requests in a row). After first event, only the hard wall aborts.
      const silent = firstEventMs < 0 && now - lastEvent > STALL_MS;
      const overdue = now - startedAt > HARD_CAP_MS;
      if (silent || overdue) {
        console.error(
          `[klappn] anthropic(${model}) ${
            overdue ? `exceeded ${HARD_CAP_MS / 60_000}min wall` : `silent ${STALL_MS / 1000}s`
          } — aborting (first-event=${firstEventMs}ms maxgap=${maxGapMs}ms age=${now - startedAt}ms)`,
        );
        try {
          stream.controller.abort();
        } catch {
          /* already settled */
        }
      }
    }, 10_000);

    try {
      // Beta (Fable) and plain streams return Message/BetaMessage — identical in every field we
      // read (content/usage/stop_reason), so collapse to the plain type.
      res = (await stream.finalMessage()) as Anthropic.Message;
      clearInterval(watchdog);
      break;
    } catch (e) {
      clearInterval(watchdog);
      // Retry ONLY a pre-stream transient failure with attempts left — never once tokens began.
      if (firstEventMs < 0 && attempt < MAX_ATTEMPTS && isRetryableApiError(e)) {
        // FAST MODE has no auto-fallback — a 429/529 is usually fast-capacity contention, not a
        // real rate-limit. So drop to STANDARD speed for the retry: the call still completes (just
        // not 2.5×) instead of hard-failing the layer. First attempt always tries fast.
        const p = params as { speed?: string };
        const wasFast = p.speed === "fast";
        if (wasFast) delete p.speed;
        const backoff = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
        console.error(
          `[klappn] anthropic(${model}) transient failure attempt ${attempt}/${MAX_ATTEMPTS} (${
            (e as Error)?.message?.slice(0, 80) ?? e
          })${wasFast ? " — falling back to STANDARD speed" : ""} — retrying in ${backoff}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  if (!res) throw new Error("anthropic: no response"); // unreachable — loop breaks or throws

  const u = res.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  if (u?.cache_read_input_tokens || u?.cache_creation_input_tokens) {
    console.log(
      `[klappn] anthropic(${model}) cache: read=${u.cache_read_input_tokens ?? 0} write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens} stop=${res.stop_reason} first-event=${firstEventMs}ms maxgap=${maxGapMs}ms total=${Date.now() - startedAt}ms`,
    );
  }
  // Fable classifier-fallback visibility: when the safety classifier declines and the server-side
  // fallback re-serves the call on Opus 4.8, the only trace is otherwise Opus rows in the billing
  // console. Detect via the fallback content block or the fallback_message usage iteration.
  if (isFable) {
    const iters = (u as { iterations?: Array<{ type?: string }> }).iterations;
    const fellBack =
      iters?.some((i) => i?.type === "fallback_message") ||
      res.content.some((b) => (b as { type: string }).type === "fallback");
    if (fellBack) {
      console.log(`[klappn] anthropic(${model}) classifier FALLBACK — served by ${res.model}`);
    }
  }
  // Billing meter — COST-WEIGHTED token units, so a metered "token" tracks real
  // dollars. Opus-class pricing: output bills ~5× input (thinking bills as
  // output), cache reads ~10% of input, cache writes 1.25×. Normalised to
  // input-token units, so the metered total tracks model cost — which is what
  // the plan allowances are priced against.
  try {
    const used =
      (u?.input_tokens ?? 0) +
      (u?.output_tokens ?? 0) * 5 +
      (u?.cache_read_input_tokens ?? 0) * 0.1 +
      (u?.cache_creation_input_tokens ?? 0) * 1.25;
    if (used > 0) void cfg?.onUsage?.(Math.round(used));
    if (u)
      void cfg?.onRawUsage?.({
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens,
        cacheWriteTokens: u.cache_creation_input_tokens,
      });
  } catch {
    /* metering must never break a model call */
  }
  // Fable safety classifiers: stop_reason "refusal" arrives as a SUCCESSFUL response with empty
  // (or partial, discardable) content. With the server-side fallback attached it means the WHOLE
  // chain (Fable → Opus 4.8) declined. Last resort: ONE client-side replay on Sonnet 5 — it can't
  // ride the server-side chain (Fable's allowed_fallback_models is ["claude-opus-4-8"] only,
  // verified live 2026-07-02), so it gets its own fresh call. Sonnet's own refusal (isFable
  // false on the recursive call) still throws, so the caller's error path remains the floor.
  if (res.stop_reason === ("refusal" as typeof res.stop_reason)) {
    if (isFable) {
      console.error(
        `[klappn] anthropic(${model}) whole fallback chain declined — replaying once on claude-sonnet-5`,
      );
      return completeAnthropic(system, userText, { ...cfg, anthropicModel: "claude-sonnet-5" }, opts);
    }
    throw new Error(`claude declined the request (stop_reason=refusal, model=${model})`);
  }
  if (res.stop_reason === "max_tokens") {
    const hasText = res.content.some((b) => b.type === "text" && b.text.trim());
    if (!hasText) {
      throw new Error("claude hit max_tokens before emitting any text");
    }
  }
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
