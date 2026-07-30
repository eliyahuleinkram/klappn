import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM layer — THREE Claude models, chosen PER CALL. Every composition, edit,
 * label and critique goes through `complete()` to the native Anthropic API; the
 * ROUTE table below names each agent and pins its model, its effort, its
 * thinking and its token budget, and the deterministic gates run for free with
 * at most ONE repair pass if a loop would crash. Callers (lib/anthropic.ts)
 * never see the wire.
 *
 * THE THREE TIERS (2026-07-30 — the user: "select the best model for it"):
 *   fable  → claude-fable-5  ($10/$50) — the model that INVENTS music. Reserved
 *            for the calls whose output the ear judges directly and which have
 *            no cheap second chance: writing a layer and writing a break. Fable won the original bake-off on the ear; Opus 5 took
 *            the whole roster on 2026-07-25 for PRICE, not for sound. The
 *            invention calls go back.
 *   opus   → claude-opus-5   ($5/$25)  — the model that REWORKS and REASONS:
 *            edits over given material, re-bars, repairs, planners, structured
 *            JSON, visuals, and the room's no-thinking surgery.
 *   sonnet → claude-sonnet-5 ($3/$15)  — the model that NAMES and DECIDES ONE
 *            BIT: panels, labels, presets, the done-check, the teacher. Every
 *            one of these runs thinking OFF; a no-thinking call needs no
 *            composing tier.
 * The line between fable and opus is INVENT vs TRANSFORM. Move a call across it
 * by editing its ROUTE entry — never at the call site.
 *
 * (Klappn spent its first month as a multi-provider bake-off — Kimi, GLM,
 * Gemini, Grok, an OpenRouter roster; the zoo was removed 2026-07-20.
 * `songs.model` history is preserved in the training capture; new songs read
 * "opus", legacy rows read "fable" — both are routing tags, and the per-call
 * ROUTE entry decides what actually answers.)
 *
 * Hard rules (so they can't drift): adaptive thinking + per-call effort; NEVER
 * temperature/top_p/top_k/budget_tokens (they 400 on these models); Fable 5
 * cannot disable thinking AT ALL (400 at any effort) and Opus 5 only at effort
 * ≤ high; the system prompt is cached. A 90s no-event stall watchdog + an 8-min
 * overall wall guard every stream (see completeAnthropic).
 *
 * On the Workflows worker process.env is empty, so the key is threaded in via
 * LlmConfig; the Next.js app worker falls back to process.env.
 */

export interface LlmConfig {
  anthropicApiKey?: string;
  anthropicModel?: string;
  /** The song's stored routing id ("opus" for new work; "fable"/"anthropic"/…
   *  from earlier eras). Since the per-call agent table it is a TAG, not a
   *  route: every call carries its own `opts.model`, which wins. It survives as
   *  the training-capture label and as the last-resort tier when a call somehow
   *  reaches complete() without a ROUTE entry ("sonnet" → Sonnet 5, else Opus 5). */
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

/** The three tiers a call may run on. `ROUTE` names one per agent. */
export type ModelTier = "fable" | "opus" | "sonnet";

/** Tier → the live Anthropic model id. The ONLY place ids are written. */
const TIER_MODEL: Record<ModelTier, string> = {
  fable: "claude-fable-5",
  opus: "claude-opus-5",
  sonnet: "claude-sonnet-5",
};

/**
 * PER-MODEL COST FACTOR — the model's input rate over the anchor rate the house
 * bills at (lib/pricing.ts USD_CENTS_PER_MILLION = 500 ⇒ $5/1M, Opus 5's own
 * input price). Anthropic's ratios are uniform across current models (output
 * 5× input, cache read 0.1×, cache write 1.25× — verified against the live
 * price sheet 2026-07-26), so ONE factor per model makes a weighted unit equal
 * real dollars no matter which model served the call: a Sonnet unit costs 3/5
 * of an Opus unit and meters as 0.6. Matched by prefix against the model id
 * that ACTUALLY answered (res.model — the classifier fallback can swap models
 * mid-call). Unknown models bill at the anchor (never silently under-charge).
 * Sonnet 5's $2/1M intro (through 2026-08-31) is deliberately ignored — the
 * sticker rate is the durable one and a promo shouldn't reprice the meter.
 */
const MODEL_COST_FACTOR: ReadonlyArray<readonly [prefix: string, factor: number]> = [
  ["claude-opus-5", 1], // $5/1M in — the anchor
  ["claude-opus-4", 1], // $5/1M (Opus 4.6–4.8 — the classifier-fallback route)
  ["claude-fable-5", 2], // $10/1M
  ["claude-sonnet", 0.6], // $3/1M (Sonnet 5 + 4.6)
  ["claude-haiku", 0.2], // $1/1M
];

function modelCostFactor(modelId: string): number {
  for (const [prefix, factor] of MODEL_COST_FACTOR)
    if (modelId.startsWith(prefix)) return factor;
  return 1;
}

// ── PROVIDER ─────────────────────────────────────────────────────────────────
// One wire: the native Anthropic Messages API. Output tokens are metered at 5×
// input (the ×5 in completeAnthropic's usage handler).
export type Provider = "anthropic";

/** Per-call options for `complete()`. Returns the visible text. */
export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";
export interface CompleteOpts {
  /** Which provider runs THIS call (default "anthropic"; ROUTE sets it per call). */
  provider?: Provider;
  /** WHICH MODEL runs THIS call — the per-call tier, set by the call's ROUTE
   *  entry. AUTHORITATIVE: it beats cfg.model (the song's stored routing tag),
   *  because the agent decides what it needs, not the row it was born in.
   *  Unset → the legacy behaviour (cfg.model "sonnet" → Sonnet 5, else Opus 5). */
  model?: ModelTier;
  /** Output/reasoning effort for THIS call (low|medium|high|xhigh|max). Default "high". */
  effort?: AnthropicEffort;
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
  /** TTL for THIS call's `cacheStable` breakpoint. "5m" (default) is right for a
   *  prefix reused within one burst; "1h" is for a prefix reused across a whole
   *  song's generation, where the 5-minute window expires mid-loop and every
   *  layer pays the write again. A 1h write costs 2x input vs 1.25x for 5m, so it
   *  only pays when the prefix is genuinely re-read many times — see ROUTE. */
  cacheTtl?: "5m" | "1h";
  /** PROMPT-CACHE SPLIT: a STABLE user-prompt prefix (e.g. the loop brief) that
   *  repeats byte-identically across sibling calls while the rest of the user
   *  text varies (the layer loop's growing prior-tracks list). Rendered as its
   *  own cache-marked content block ahead of `userText`, so sibling calls hit
   *  [system + prefix] even when their tails diverge. Non-Anthropic providers
   *  and the training capture see it prepended to the user text — semantics
   *  identical, only the cache boundary moves. */
  cacheStable?: string;
}

/**
 * THE AGENT TABLE — one entry per AI call in the product, and the only place a
 * model, an effort, a thinking mode or a token budget is chosen. Call sites
 * spread an entry (`{ ...ROUTE.compose, trace: … }`) and add nothing but their
 * trace label; anything they'd override belongs here instead, or it drifts.
 *
 * Reading a row: `model` is the tier (see the file header — invent/transform/
 * name), `effort` is how hard it thinks, `thinking:false` disables reasoning
 * outright (latency-critical or answer-only calls; NEVER on a fable row — Fable
 * 5 400s on disabled thinking), and `maxTokens` is the HARD budget for thinking
 * + answer together. That budget is the completion lever, not a cost knob:
 * Cloudflare kills a Workflow step at ~5 min and adaptive thinking PLANS within
 * max_tokens, so a snug budget makes a call finish its thought instead of being
 * executed mid-sentence.
 */
export const ROUTE = {
  // ── INVENT MUSIC — Fable 5. The ear is the acceptance test here and there is
  //    no cheap second chance: what these write is what a human hears.
  compose: { provider: "anthropic", model: "fable", effort: "high", maxTokens: 14000, cacheTtl: "1h" } as CompleteOpts, // write the loop's next $: layer (brief cached 1h — a loop outlives 5m)
  breaks: { provider: "anthropic", model: "fable", effort: "high", maxTokens: 8000 } as CompleteOpts, // the one-bar hand-off between two loops

  // ── REWORK MUSIC — Opus 5. The material is given; the job is disciplined
  //    rewriting, which is exactly what Opus 5 is strongest at.
  edit: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 14000 } as CompleteOpts, // rewrite a whole loop
  meter: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 14000 } as CompleteOpts, // re-bar into a new time signature
  repair: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 8000 } as CompleteOpts, // fix a loop that threw at playback

  // ── PLAN — Opus 5. Structured JSON, cascading decisions, no ear involved.
  create: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 12000 } as CompleteOpts, // derive the workspace / the adjacent section
  arrange: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 14000 } as CompleteOpts, // the song's arrangement (legacy)
  shape: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 8000 } as CompleteOpts, // the page's effects + breaks
  coach: { provider: "anthropic", model: "opus", effort: "medium", maxTokens: 4000 } as CompleteOpts, // the vocal chart / its alternative looks
  score: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 16000 } as CompleteOpts, // legacy enumerated score
  translate: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 16000 } as CompleteOpts, // legacy score → $: layers
  knobs: { provider: "anthropic", model: "opus", effort: "medium", maxTokens: 12000 } as CompleteOpts, // legacy parameterize (a CODE rewrite)

  // ── VISUALS — Opus 5. Hydra is code with a taste requirement.
  hydra: { provider: "anthropic", model: "opus", effort: "high", maxTokens: 8000 } as CompleteOpts,
  hydraRepair: { provider: "anthropic", model: "opus", effort: "medium", maxTokens: 6000 } as CompleteOpts,

  // ── THE ROOM'S FAST LANE — Opus 5, thinking OFF. A whisper that arrives late
  //    is a wrong whisper; Opus keeps the dialect straight at no-think latency.
  ghost: { provider: "anthropic", model: "opus", thinking: false, maxTokens: 640 } as CompleteOpts,
  assist: { provider: "anthropic", model: "opus", thinking: false, maxTokens: 1200 } as CompleteOpts, // ✎ edit, a selected span
  rework: { provider: "anthropic", model: "opus", thinking: false, maxTokens: 8000 } as CompleteOpts, // ✎ edit, the WHOLE pane (same agent, a file-sized answer)
  fix: { provider: "anthropic", model: "opus", thinking: false, maxTokens: 4000 } as CompleteOpts, // ✦ one-tap fix

  // ── NAME / DECIDE ONE BIT — Sonnet 5, thinking OFF. Answer-only work; a
  //    no-thinking call needs no composing tier.
  done: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 200, cacheTtl: "1h" } as CompleteOpts, // DONE / MORE (same brief, same 1h window as compose)
  pick: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 2000 } as CompleteOpts, // instrument/kit per part (legacy)
  panel: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 2500 } as CompleteOpts, // a layer's knobs + presets
  swap: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 1200 } as CompleteOpts, // alternative sounds from the catalog
  copy: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 2000 } as CompleteOpts, // labels / look names / stem names
  steer: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 600 } as CompleteOpts, // the section brief + the track's direction note
  explain: { provider: "anthropic", model: "sonnet", thinking: false, maxTokens: 350 } as CompleteOpts, // ✦ teach the selection
  setOrder: { provider: "anthropic", model: "sonnet", effort: "medium", maxTokens: 3000 } as CompleteOpts, // order a Set's songs (real key/tempo reasoning, tiny)
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
        // What ACTUALLY ran (the call's ROUTE tier), falling back to the song's
        // stored routing tag. Before the per-call table this was the same value;
        // now a fable/sonnet row would otherwise be logged as its song's "opus".
        model: opts?.model ?? cfg.model ?? "anthropic",
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

/**
 * Which tier answers THIS call. Two inputs, in order:
 *
 *  1. The ROUTE entry's `model` — the agent's own need.
 *  2. THE SONG'S QUALITY DIAL (`cfg.model`, see lib/models.ts) — but ONLY as a
 *     veto on the fable rows. Fable is the one tier that costs real money to
 *     reach, so the calls that want it get it only when the maker chose Studio
 *     for this song; a Standard song composes on Opus. Nothing else moves:
 *     Sonnet rows stay Sonnet and Opus rows stay Opus on either setting, because
 *     no amount of paying more makes a knob label better.
 *
 * The dial's id is "studio" and NOT "fable" on purpose: songs from the
 * 2026-07 bake-off era carry a literal "fable" in the column, and they must keep
 * resolving to Standard rather than silently becoming the expensive tier.
 *
 * Exported for lib/llm.test.ts — the veto is the one piece of routing whose
 * failure mode is a bill, so it is tested rather than trusted.
 */
export function resolveTier(cfg?: LlmConfig, opts?: CompleteOpts): ModelTier {
  const want: ModelTier = opts?.model ?? (cfg?.model === "sonnet" ? "sonnet" : "opus");
  if (want === "fable" && cfg?.model !== "studio") return "opus";
  return want;
}

async function completeRoute(
  system: string,
  userText: string,
  cfg?: LlmConfig,
  opts?: CompleteOpts,
): Promise<string> {
  // HARD pin — no `cfg?.anthropicModel ??` fallback: both workers' cfg carries
  // the env default in anthropicModel, and a soft pin silently lost to it
  // (2026-07-02: every "fable" song was actually composed by Opus 4.8).
  const tier = resolveTier(cfg, opts);
  try {
    return await completeAnthropic(system, userText, { ...cfg, anthropicModel: TIER_MODEL[tier] }, opts);
  } catch (e) {
    // FABLE'S ONE PREREQUISITE, made survivable. Claude Fable 5 is not served to
    // an org whose data-retention configuration is under 30 days: EVERY request
    // 400s, payload-independent. That would silently take composition down, so a
    // Fable call REJECTED BY THE API degrades ONCE to Opus 5 (the tier the whole
    // roster ran on until 2026-07-30) and says so loudly in the log. A genuine
    // bad-request in our own payload fails there too, so nothing is masked.
    //
    // NARROW ON PURPOSE — only a 4xx rejection. A transient 5xx already has its
    // own retry loop, and our watchdog ABORT (the 8-min wall) must NEVER land
    // here: re-running an 8-minute call on another model would double the wall
    // and blow the ~5-min Workflow step it lives in.
    if (tier !== "fable" || !isModelRejectedError(e)) throw e;
    console.error(
      `[klappn] anthropic(claude-fable-5) rejected the call — degrading THIS call to claude-opus-5. ` +
        `If this repeats, check the org's data retention (Fable 5 requires 30-day; ZDR orgs 400 on every request): ` +
        `${(e as Error)?.message?.slice(0, 200) ?? e}`,
    );
    return completeAnthropic(system, userText, { ...cfg, anthropicModel: TIER_MODEL.opus }, opts);
  }
}

// --- Anthropic (Fable 5 / Opus 5 / Sonnet 5) ---------------------------------

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

/** True when the API itself REJECTED the request — a 4xx that is not a rate limit
 *  (400 bad request / 401 / 403 forbidden / 404 unknown model). This is the shape
 *  an org-level "this model isn't served to you" refusal takes. Deliberately NOT
 *  true for 408/409/429/5xx (the transient retry's job) or for an AbortError from
 *  our own stall/wall watchdog, which carries no HTTP status at all. */
function isModelRejectedError(e: unknown): boolean {
  const any = e as { status?: number; error?: { status?: number } };
  const status = any?.status ?? any?.error?.status;
  return status === 400 || status === 401 || status === 403 || status === 404;
}

async function completeAnthropic(
  system: string,
  userText: string,
  cfg?: LlmConfig,
  opts?: CompleteOpts,
): Promise<string> {
  const anthropic = anthropicClient(cfg);
  // completeRoute always sets anthropicModel from the tier table (and the refusal
  // replay sets it explicitly), so this is only ever the tier's own id. The literal
  // default is unreachable belt-and-braces — there is deliberately NO env override:
  // one used to live here, and because the tier pin overwrites anthropicModel it
  // would silently do nothing, which is worse than not existing.
  const model = cfg?.anthropicModel || TIER_MODEL.opus;
  // Opus 5 request surface (launch day 2026-07-24, verified against the live migration guide):
  //  - thinking is ON BY DEFAULT (adaptive when the param is omitted). Explicit
  //    {type:"adaptive"} and {type:"disabled"} are both accepted — disabled only at
  //    effort ≤ high (disabled + xhigh/max 400s; our noThink calls never set those).
  //  - safety classifiers can decline a request (HTTP 200, stop_reason "refusal") — we opt into
  //    the server-side fallback (beta server-side-fallback-2026-07-01, fallbacks:"default":
  //    the API re-runs the declined call on its recommended fallback for the refusal category)
  //    instead of shipping an empty layer.
  const isOpus5 = model.startsWith("claude-opus-5");
  // Claude Fable 5 (and Mythos 5) — thinking is ALWAYS ON: {type:"disabled"} 400s
  // at every effort, unlike Opus 5 (legal at effort ≤ high) and Sonnet 5 (legal).
  // So a fable row silently keeps adaptive thinking even if a caller asks for
  // none. ROUTE never pairs the two; this is the belt to that braces.
  const isFable = model.startsWith("claude-fable-5") || model.startsWith("claude-mythos-5");
  // 2026-07-30 (the user: "select the best model for it… and the thinking mode"):
  // EFFORT IS PER CALL AGAIN, and it comes from the call's ROUTE entry — see the
  // agent table above. This replaces the single global number (high → medium →
  // OFF → ON at medium, four revisions between 2026-07-25 and 2026-07-30) that
  // superseded every route: one number could not be right for both "write eight
  // bars of music" and "name this knob", and the table now says both.
  //
  // thinking:false (a pure SELECTION/copy/latency call — the instrument pick, the
  // done-check, the room's whisper) → thinking DISABLED outright, not just low
  // effort: {type:"disabled"} is faster and cheaper (no reasoning tokens at all).
  // It omits output_config entirely, so the server default (high) applies — which
  // is what keeps it legal on Opus 5, where disabled + xhigh/max is a 400. The
  // prompt must then be answer-only: our pick/copy prompts already say "Output
  // ONLY …" and the callers regex-extract the fields. (effort still maps to "low"
  // below purely to pick the smallest max_tokens tier for these calls.)
  const noThink = opts?.thinking === false && !isFable;
  const effort: AnthropicEffort = noThink ? "low" : (opts?.effort ?? "high");
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
    // Fast mode gate: Opus 4.8/4.7 only for now. Opus 5 DOES ship a fast mode (2.5×
    // output speed at 2× price per the launch notes), but its beta header/surface is
    // unverified here — widen this gate only after a live test, or every call could 400.
    model.startsWith("claude-opus-4") &&
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
    thinking: noThink ? { type: "disabled" } : { type: "adaptive" },
    ...(noThink ? {} : { output_config: { effort } }),
    // PROMPT CACHING, two breakpoints. The cacheable minimum is 512 tokens on
    // Fable 5 and Opus 5 (1024 on Sonnet 5), so the lean system block caches on
    // every tier we use, at 1h — the same static system strings recur across
    // every song all day, and that block is the biggest repeated span we send.
    //
    // THE RULE FOR `cacheStable` (2026-07-30 — do NOT "optimise" by marking every
    // call's prefix): a cache WRITE costs 1.25x input at 5m and 2x at 1h, and a
    // read costs 0.1x. So marking a prefix that is sent ONCE is a straight LOSS,
    // and marking one that is usually sent once and occasionally twice (every
    // parse-failure retry loop in this codebase) is a loss on average too. It
    // only pays where the SAME prefix is reliably re-sent many times inside the
    // TTL. Today that is exactly three calls, and they are all already marked:
    //   · compose  — the brief, re-sent for all 8-16 layers of a loop (1h: a loop
    //                takes longer than the 5-minute window, so 5m re-wrote it)
    //   · done     — the same brief, between those same layers (1h, same reason)
    //   · ghost    — the other pane, re-sent across one typing burst (5m is right)
    // Before adding a fourth, count the re-sends. If it is not "many, reliably,
    // inside the TTL", leaving it unmarked is the cheaper answer.
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...(opts?.cacheStable
            ? [
                {
                  type: "text" as const,
                  text: opts.cacheStable,
                  cache_control:
                    opts.cacheTtl === "1h"
                      ? ({ type: "ephemeral", ttl: "1h" } as const)
                      : ({ type: "ephemeral" } as const),
                },
              ]
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
    // Opus 5 rides the BETA stream so we can attach the server-side refusal fallback: a policy
    // decline is re-served by the API's recommended fallback model inside the same call
    // (declined-before-output attempts aren't billed; the rescue bills at the fallback model's
    // rates). fallbacks:"default" — Opus 5's launch surface — lets the API pick the fallback
    // per refusal category rather than us pinning one. Everything else uses the plain stream.
    // FABLE 5 DELIBERATELY STAYS ON THE PLAIN STREAM (2026-07-30): the "default" scalar form is
    // only verified here against Opus 5, and an unaccepted beta/parameter pair 400s the request
    // — which on the compose route means every layer of every song. Fable's refusals are covered
    // client-side instead (the one replay below). Widen this gate only after a live test.
    // The Beta stream class is runtime-identical for everything we touch (.on("streamEvent"),
    // .controller, .finalMessage()) — collapse the union so the handlers below typecheck once.
    const stream: ReturnType<typeof anthropic.messages.stream> = isOpus5
      ? (anthropic.beta.messages.stream({
          ...params,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
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
      // Beta (Opus 5) and plain streams return Message/BetaMessage — identical in every field we
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
  // Classifier-fallback visibility: when the safety classifier declines and the server-side
  // fallback re-serves the call on another model, the only trace is otherwise foreign rows in
  // the billing console. Detect via the fallback content block or the fallback_message usage
  // iteration; res.model names who actually served it.
  if (isOpus5) {
    const iters = (u as { iterations?: Array<{ type?: string }> }).iterations;
    const fellBack =
      iters?.some((i) => i?.type === "fallback_message") ||
      res.content.some((b) => (b as { type: string }).type === "fallback");
    if (fellBack) {
      console.log(`[klappn] anthropic(${model}) classifier FALLBACK — served by ${res.model}`);
    }
  }
  // Billing meter — COST-WEIGHTED token units, so a metered "token" tracks real
  // dollars ON EVERY MODEL. Two multipliers compose: (1) the kind weights —
  // output bills 5× input (thinking bills as output), cache reads 0.1×, cache
  // writes 1.25× at a 5-minute TTL and 2× at an hour, uniform ratios across
  // current Anthropic models; (2) the
  // per-model factor (MODEL_COST_FACTOR) scaling to the anchor rate the house
  // sells at ($5/1M = Opus 5 input). res.model — not the requested id — decides
  // the factor, because the classifier fallback can have another model serve
  // the call. Fast mode (usage.speed === "fast") bills 2× the standard rate.
  //
  // THE WRITE RATE WAS WRONG UNTIL 2026-07-30: every write was billed at 1.25×
  // while the SYSTEM block — the biggest cached span we send, on every single
  // call — has always been written at a 1h TTL, which costs 2×. That silently
  // under-charged the house on every cache miss. Now the per-TTL breakdown is
  // read when the API reports it, and a flat count falls back to 2× — the
  // conservative read, because "never silently under-charge" is the standing
  // rule and the 1h system block dominates the writes either way.
  try {
    const servedBy = (res.model as string) || model;
    const speedFactor =
      (u as { speed?: string }).speed === "fast" ? 2 : 1;
    const breakdown = (u as {
      cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
    }).cache_creation;
    const writeUnits = breakdown
      ? (breakdown.ephemeral_5m_input_tokens ?? 0) * 1.25 +
        (breakdown.ephemeral_1h_input_tokens ?? 0) * 2
      : (u?.cache_creation_input_tokens ?? 0) * 2;
    const used =
      ((u?.input_tokens ?? 0) +
        (u?.output_tokens ?? 0) * 5 +
        (u?.cache_read_input_tokens ?? 0) * 0.1 +
        writeUnits) *
      modelCostFactor(servedBy) *
      speedFactor;
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
  // Safety classifiers: stop_reason "refusal" arrives as a SUCCESSFUL response with empty
  // (or partial, discardable) content. With the server-side fallback attached it means the
  // WHOLE chain (Opus 5 → its recommended fallback) declined. Last resort: ONE client-side
  // replay on Sonnet 5 as its own fresh call. Sonnet's own refusal (isOpus5 false on the
  // recursive call) still throws, so the caller's error path remains the floor.
  if (res.stop_reason === ("refusal" as typeof res.stop_reason)) {
    // ONE client-side replay, on the next tier down: Opus 5 → Sonnet 5 (its
    // server-side chain has already declined by the time we're here), Fable 5 →
    // Opus 5 (Fable rides the plain stream — see the beta gate above — so this
    // IS its whole fallback). The rescue model's own refusal falls through to
    // the throw, so the caller's error path remains the floor.
    const rescue = isOpus5 ? "claude-sonnet-5" : isFable ? "claude-opus-5" : "";
    if (rescue) {
      console.error(
        `[klappn] anthropic(${model}) declined the request — replaying once on ${rescue}`,
      );
      return completeAnthropic(system, userText, { ...cfg, anthropicModel: rescue }, opts);
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
