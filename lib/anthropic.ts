import { complete, ROUTE, type LlmConfig, type CompleteOpts } from "./llm";
import { hydraServerErrors } from "./hydra-eval";
import type { SongVisual } from "./hydra-embed";
import type { SongArrangement, SongFx } from "./arrange";
import { parseControls, soundInLayer, strudelControlName, type LoopControl } from "./controls";
import { cleanLabel, sentenceLabel } from "./labels";
import { beatsPerBar, paramRange } from "./playback";
import {
  GM_SOUNDS,
  PALETTE_SOUNDS,
  WT_SOUNDS,
  isKnownSound,
  isKnownBank,
} from "./sound-palette";
import {
  mockEdit,
  mockEnabled,
} from "./mock-llm";
import {
  SCORE_SYSTEM,
  EDIT_SCORE_SYSTEM,
  PICK_SOUND_SYSTEM,
  TRANSLATE_SYSTEM,
  ENRICH_SYSTEM,
  MELODIC_SOUNDS,
  DRUM_BANKS,
  DRUM_BANK_SOUNDS,
} from "./compose-prompts";
import {
  composeStagedStrudelLayer,
  type PriorLayer,
  type StagedLayer,
} from "./compose-strudel";
import type {
  LoopScore,
  ScorePart,
  ScoreEvent,
  SoundPick,
  TrackControl,
  TrackPill,
} from "./score";

/**
 * The composer: prompts + the three model calls (overview / generate-part /
 * edit). It is model-agnostic — the actual API call (Claude or DeepSeek, with
 * max thinking) lives in lib/llm.ts and is selected by the LLM_PROVIDER env var.
 *
 * `ClaudeConfig` is kept as an alias of `LlmConfig` for back-compat with the
 * Workflows worker and lib/jobs.ts.
 */
export type ClaudeConfig = LlmConfig;



// ── layer composer ───────────────────────────────────────────────────────────

export type { PriorLayer, StagedLayer } from "./compose-strudel";

/** Compose the next layer of the loop, or null when the loop is full (the stop signal). The model
 *  writes one playable `$: …` Strudel line directly (lib/compose-strudel.ts); `notation` is the
 *  layer's Strudel body — carried forward as the next layers' context and rewritten by edits — and
 *  `code` is the same line with the `$:` prefix. */
export async function composeLayerStaged(
  brief: string,
  prior: PriorLayer[],
  cfg?: LlmConfig,
  insist = false,
): Promise<StagedLayer | null> {
  if (mockEnabled(cfg?.mock))
    return prior.length >= 4
      ? null
      : {
          code: `$: note("c3 e3 g3").sound("sawtooth")`,
          instrument: "sawtooth",
          role: "a voice",
          notation: `note("c3 e3 g3").sound("sawtooth")`,
        };
  return composeStagedStrudelLayer(brief, prior, cfg, insist);
}

export type EnrichPanel = {
  label: string;
  signature: string;
  controls: TrackControl[];
  pills: TrackPill[];
  swap?: { via: "sound" | "bank"; options: { name: string; s: string }[] };
};
const EMPTY_PANEL: EnrichPanel = { label: "", signature: "", controls: [], pills: [] };

/** Parse ONE tweak-panel object from the enrich output — clamping every knob range to
 *  its param's real bounds (pan 0–1, etc.) and every preset value into its knob's range,
 *  so a slider/preset can never go out of bounds or touch a param the layer doesn't have. */
function parsePanel(obj: {
  label?: unknown;
  signature?: unknown;
  controls?: unknown;
  pills?: unknown;
  swap?: unknown;
}): EnrichPanel {
  const controls: TrackControl[] = Array.isArray(obj.controls)
    ? (obj.controls as Record<string, unknown>[])
        .map((c) => ({
          name: String(c?.name ?? c?.param ?? "").trim(),
          param: String(c?.param ?? "").trim(),
          min: Number(c?.min),
          max: Number(c?.max),
          value: Number(c?.value),
        }))
        .map((c) => {
          const r = paramRange(c.param);
          if (!r) return c;
          const min = Math.max(r[0], Math.min(r[1], c.min));
          const max = Math.max(r[0], Math.min(r[1], c.max));
          return { ...c, min, max, value: Math.max(min, Math.min(max, c.value)) };
        })
        .filter(
          (c) =>
            c.param &&
            Number.isFinite(c.min) &&
            Number.isFinite(c.max) &&
            Number.isFinite(c.value) &&
            c.max > c.min,
        )
    : [];
  const spec = new Map(controls.map((c) => [c.param, c]));
  const pills: TrackPill[] = Array.isArray(obj.pills)
    ? (obj.pills as Record<string, unknown>[])
        .map((p) => {
          const name = String(p?.name ?? "").trim();
          const raw = (p?.set ?? {}) as Record<string, unknown>;
          const set: Record<string, number> = {};
          for (const [k, v] of Object.entries(raw)) {
            const c = spec.get(k);
            const num = Number(v);
            if (c && Number.isFinite(num)) set[k] = Math.max(c.min, Math.min(c.max, num));
          }
          return { name, set };
        })
        .filter((p) => p.name && Object.keys(p.set).length > 0)
        .slice(0, 6)
    : [];
  // Alternative instruments (tap to swap the sound/kit) — via "sound" or "bank". DROP any option
  // that isn't a REAL sound/bank: a model (esp. a code model) can hallucinate a name like
  // "gm_pad_polysynth", and an unknown one throws "sound … not found" the instant it's tapped.
  const sw = obj.swap as { via?: unknown; options?: unknown } | undefined;
  const via: "sound" | "bank" = sw?.via === "bank" ? "bank" : "sound";
  const validOpt = (s: string) => (via === "bank" ? isKnownBank(s) : isKnownSound(s));
  const options = Array.isArray(sw?.options)
    ? (sw!.options as Record<string, unknown>[])
        .map((o) => ({ name: String(o?.name ?? "").trim(), s: String(o?.s ?? "").trim() }))
        .filter((o) => o.name && o.s && validOpt(o.s))
        .slice(0, 6)
    : [];
  const swap = options.length ? { via, options } : undefined;
  return { label: String(obj.label ?? "").trim(), signature: String(obj.signature ?? "").trim(), controls, pills, swap };
}

/** Tolerantly pull the JSON array of panels out of a model reply. Models can wrap
 *  JSON in ```fences```, add // or /* *\/ comments, or leave trailing commas — all of
 *  which break a strict JSON.parse. So: strip fences, isolate the outermost [...],
 *  try strict, then retry after removing comments + trailing commas. Returns null if
 *  no array survives (the caller then retries once). */
function parseEnrichArray(out: string): Record<string, unknown>[] | null {
  if (!out) return null;
  const t = out.replace(/```+\s*json/gi, "").replace(/```+/g, "");
  const s = t.indexOf("["),
    e = t.lastIndexOf("]");
  if (s < 0 || e <= s) return null;
  const slice = t.slice(s, e + 1);
  const attempt = (str: string): Record<string, unknown>[] | null => {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? (v as Record<string, unknown>[]) : null;
    } catch {
      return null;
    }
  };
  return (
    attempt(slice) ??
    attempt(
      slice
        .replace(/\/\*[\s\S]*?\*\//g, "") // /* block */ comments
        .replace(/([,{[\s])\/\/[^\n]*/g, "$1") // // line comments (not :// inside a value)
        .replace(/,(\s*[}\]])/g, "$1"), // trailing commas
    )
  );
}

// Cosmetic panels run on the SONG'S OWN model (the toggle), the same one that wrote the
// music, LAYER BY LAYER (not one big N-object array) with thinking OFF — so a single bad
// reply can't wipe every layer's panel. The first arg is the layer's stored notation (its
// Strudel body); the panel is then validated against the playable Strudel: each control
// the AI names is canonicalised to its real Strudel method and KEPT only if that method
// is actually on the line — so a slider can never drive a missing method. A short retry
// cures a stray fence; only then does that one layer fall back to an empty panel.
async function enrichOneLayer(notation: string, strudel: string, cfg?: LlmConfig): Promise<EnrichPanel> {
  for (let i = 0; i < 2; i++) {
    let out = "";
    try {
      out = await complete(ENRICH_SYSTEM, `Layer 1: ${notation}`, cfg, { effort: "low", thinking: false, trace: { kind: "enrich" } });
    } catch {
      continue;
    }
    const arr = parseEnrichArray(out);
    if (arr && arr[0]) return compileEnrichPanel(parsePanel(arr[0]), strudel);
  }
  return { ...EMPTY_PANEL };
}

/**
 * "Compile" a tweak panel onto the playable Strudel: map each control to its canonical Strudel method
 * (`strudelControlName`) and KEEP it only if that method actually appears in the layer — so a slider can
 * NEVER drive a missing/renamed method (legato→clip, size→roomsize, …). Pills are pruned to the
 * surviving params. The playable code is the source of truth, so the panel can't desync from what plays.
 */
export function compileEnrichPanel(panel: EnrichPanel, strudel: string): EnrichPanel {
  const inCode = (param: string) =>
    /^[a-zA-Z]\w*$/.test(param) && new RegExp(`\\.${param}\\(`).test(strudel);
  const controls = (panel.controls ?? [])
    .map((c) => ({ ...c, param: strudelControlName(c.param) ?? c.param }))
    .filter((c) => inCode(c.param));
  const valid = new Set(controls.map((c) => c.param));
  const remap = (set: Record<string, number> | undefined) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(set ?? {})) {
      const mk = strudelControlName(k) ?? k;
      if (valid.has(mk)) out[mk] = v;
    }
    return out;
  };
  const pills = (panel.pills ?? [])
    .map((p) => ({ ...p, set: remap(p.set) }))
    .filter((p) => Object.keys(p.set).length > 0);
  return { ...panel, controls, pills };
}

/** One layer's tweak panel — read its stored notation, validate against its playable Strudel. */
export async function enrichTrack(notation: string, strudel: string, cfg?: LlmConfig): Promise<EnrichPanel> {
  return enrichOneLayer(notation, strudel, cfg);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanPart {
  label: string;
  intent: string;
  /** How many bars this section plays before moving to the next (arrangement). */
  bars: number;
  /** 'loop' (default), 'break' — a SHORT transitional loop between its
   *  neighbours (same card, same layers, same unfold as any loop; the label
   *  just tells the composer what it's for), or legacy 'bridge' — the old
   *  one-way transition (plays once, pre-2026-07-13 songs). */
  kind?: "loop" | "bridge" | "break";
}
export interface SongPlan {
  summary: string;
  bpm: number;
  key: string;
  /** The workspace's genre — set at creation, drives how every loop is composed. */
  genre?: string;
  /** Time signature, e.g. "4/4", "3/4", "7/8". Numerator = beats per bar; the
   *  composer writes in it and playback maps 1 cycle = 1 bar. Defaults to "4/4". */
  timeSignature?: string;
  parts: PlanPart[];
  /** Manual transitions between consecutive loops, keyed by the "from" part id.
   *  Absent / "cut" = a hard cut. Set by the user, never the AI. */
  bridges?: Record<string, string>;
  /** Manual playback transforms (no AI): semitone transpose + tempo override. */
  transpose?: number;
  cpmBpm?: number;
  /** Set when the creation-time derive call FAILED and the song was saved with the default
   *  identity ("Untitled" / 120 BPM / A minor). The generate route sees this on the next
   *  (re)try and re-runs the derive from songs.global_prompt before composing
   *  (rederiveSongIdentity), which clears the flag on success. */
  underived?: boolean;
  /** The song's ONE canonical visual — auto-painted during generation (Repaint replaces
   *  it). Parts carry rendered copies of its blocks; this is what a freshly composed part
   *  attaches when no painted neighbour exists yet. */
  visual?: SongVisual;
  /** The model-authored song arrangement (lib/arrange-plan) — per-section layer
   *  moves/sweeps/overlays + the ending, rendered by lib/arrange at play time.
   *  Absent/null = every section plays whole and the song wraps (classic).
   *  LEGACY since chapters (2026-07-14) — new songs use `effects` below. */
  arrangement?: SongArrangement | null;
  /** SONG-LEVEL effects (chapters era): glides anchored to part ranges,
   *  rendered by buildArrangement across loops, repeats and seams. */
  effects?: SongFx[];
  /** Parts already materialized as chapters (or confirmed whole) — the birth
   *  chapterize is idempotent against this map, keyed by part id. */
  chaptered?: Record<string, boolean>;
  /** Blueprints mid-unfold, keyed by part id: the raw-layers parent whose
   *  children are materializing right now. Set when the unfold starts, cleared
   *  when it completes (the parent is deleted once children exist — it was
   *  scaffolding, not a loop). The client renders these differently. */
  unfolding?: Record<string, boolean | "fx">;
}

export interface GeneratedPartRef {
  label: string;
  strudel: string;
}

export interface EditedPart {
  id: string;
  strudel: string;
}

// ---------------------------------------------------------------------------
// 1. overview — input: the song's global_prompt
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 0. start-from-a-loop — derive the whole workspace from the FIRST loop request
//    and place EACH later loop into the arrangement (no manual ordering / setup)
// ---------------------------------------------------------------------------

export interface DerivedWorkspace {
  title: string;
  genre: string;
  bpm: number;
  key: string;
  timeSignature: string;
  /** First part's label/intent — kept as top-level mirrors of parts[0] for the
   *  single-part consumers (voice flow's placeholder, rederive). */
  label: string;
  intent: string;
  bars: number;
  /** THE PIECE'S SECTIONS, in order (2026-07-14 — a journey needs acts): one
   *  when the request reads like a loop, 2-4 when it reads like a whole track.
   *  The model decides from the words; every part composes at birth. */
  parts: { label: string; intent: string }[];
  /** True when the derive CALL failed and these are the safe defaults ("Untitled" / 120 /
   *  A minor), not a real derivation. Persisted as plan.underived so a later "Try again"
   *  re-runs the idea call instead of composing off the defaults forever. */
  fallback?: boolean;
}

const clampBpm = (n: unknown, d = 120) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(40, Math.min(220, v)) : d;
};
const str = (s: unknown, d = "") =>
  typeof s === "string" && s.trim() ? s.trim().slice(0, 700) : d;

const DERIVE_SYSTEM = `A user is starting an INSTRUMENTAL piece by describing it. From their request, infer the piece's identity AND its material. Whatever they type — even vague or non-musical — return a complete musical vision with real values in every field; translate non-musical text into music, never echo it. A named artist, band or song is a reference to translate: capture its signature faithfully in purely musical terms (genre, groove, instrumentation, harmony, production) — no artist, band or song name appears anywhere in your output. (Inspiration loops, when given: draw on their feel/palette/motifs, never copy them.) Respond with ONLY a JSON object, no markdown:
{
 "title": a 2-4 word track name,
 "genre": the single best-fit genre,
 "bpm": integer tempo,
 "key": "<tonic> major" or "<tonic> minor",
 "timeSignature": "N/D" — almost always "4/4"; an odd or compound meter only when the request clearly implies it,
 "label": a distinctive 1-3 word name for the piece's core material,
 "intent": a faithful 1-2 sentence musical description of it
}`;

// --- meter conversion -------------------------------------------------------

const CONVERT_METER_SYSTEM = `REWRITE the given Strudel loop into a NEW TIME SIGNATURE at the same BPM. It must remain RECOGNIZABLY THE SAME LOOP — same instruments and sounds, same character, same energy, same mix balance — re-phrased so every cycle is ONE BAR of the new meter.

Hard rules:
- Begin the music with setcpm(BPM/NEW_BEATS) (1 cycle = 1 bar of the new meter).
- Re-phrase EVERY layer to fill the new beats-per-bar: drum patterns re-counted, <...> sequences re-grouped, .slow() phrase lengths adjusted, melodic lines re-quantized into the new meter while keeping their gesture and pitches.
- Keep the SAME layers in the SAME ORDER (one "$:" per layer), the same sounds, and the same const-based knobs used in the same roles.
- PRESERVE the inert comment blocks (/* @controls */, /* @swaps */, /* @edits */, /* @hydra */) and the const declarations VERBATIM — they are UI metadata, not music.
- Output the COMPLETE new file (comments + consts + music), nothing else — no prose, no fences.`;

/** Rewrite ONE loop's code into a new time signature (same bpm, same identity).
 *  `previous`/`feedback` drive the one guided repair retry. */
export async function convertPartMeter(
  args: {
    code: string;
    bpm: number;
    fromTs: string;
    toTs: string;
    previous?: string;
    feedback?: string;
  },
  cfg?: ClaudeConfig,
): Promise<string> {
  const { code, bpm, fromTs, toTs, previous, feedback } = args;
  if (mockEnabled(cfg?.mock)) return code;
  const lines = [
    `BPM: ${bpm} (unchanged)`,
    `FROM: ${fromTs}  →  TO: ${toTs} (${beatsPerBar(toTs)} beats per bar — begin with setcpm(${bpm}/${beatsPerBar(toTs)}))`,
    ``,
    `THE LOOP:`,
    code,
  ];
  if (previous && feedback) {
    lines.push(
      ``,
      `YOUR PREVIOUS ATTEMPT (broken):`,
      previous,
      ``,
      `FIX ALL OF THIS and output the complete corrected file:`,
      feedback,
    );
  }
  // HIGH effort — this is the same class of work as an edit pill (a full
  // rewrite of real music), and the user explicitly wants pill-grade quality.
  // 14k budget so each conversion finishes inside its ~5-min step wall.
  const out = stripFences(
    await complete(CONVERT_METER_SYSTEM, lines.join("\n"), cfg, { provider: "anthropic", effort: "high", maxTokens: 14000, trace: { kind: "convert-meter" } }),
  );
  if (!out) throw new Error("convert-meter: empty response");
  return out;
}


/** Turn a free-text first-loop request into the whole workspace's identity +
 *  the first loop. Falls back to safe defaults if the model misbehaves. */
export async function deriveWorkspaceFromLoop(
  query: string,
  cfg?: ClaudeConfig,
  inspirations?: MixInspiration[],
): Promise<DerivedWorkspace> {
  const q = query.trim();
  const fallback: DerivedWorkspace = {
    title: "Untitled",
    genre: "",
    bpm: 120,
    key: "A minor",
    timeSignature: "4/4",
    label: "Intro",
    intent: q || "a fresh loop drawing on the selected ones",
    bars: 8,
    parts: [
      { label: "Intro", intent: q || "a fresh loop drawing on the selected ones" },
    ],
  };
  if (mockEnabled(cfg?.mock)) return fallback;
  // Optional INSPIRATION loops (the user picked existing loops to seed from) — draw
  // on their feel/palette/motifs, but compose a FRESH loop (inspiration, not a copy).
  const ctx =
    inspirations && inspirations.length
      ? `\n\nINSPIRATION LOOP(S) — draw on their feel / palette / motifs (do NOT copy verbatim):\n${inspirations
          .map((l, i) => `### INSPIRATION ${i + 1}: ${l.label}${l.intent ? ` — ${l.intent}` : ""}\n${l.strudel}`)
          .join("\n\n")}`
      : "";
  const userMsg = q
    ? `${q}${ctx}`
    : `Make a loop that grows out of the inspiration below.${ctx}`;
  // Robust: retry on a transient parse/empty/rate-limit hiccup so the workspace
  // never silently defaults to "Untitled / 120 / A minor" on a one-off failure.
  const j = await completeJson<Record<string, unknown>>(
    DERIVE_SYSTEM,
    userMsg,
    cfg,
    { ...ROUTE.create, trace: { kind: "derive" } },
    (x) => !!(x.title || x.genre || x.bpm || x.intent),
  );
  if (!j) return { ...fallback, fallback: true };
  const bpm = clampBpm(j.bpm);
  const tsRaw = str(j.timeSignature).replace(/\s/g, "");
  const tsNum = Number(tsRaw.split("/")[0]);
  const timeSignature =
    /^\d{1,2}\/\d{1,2}$/.test(tsRaw) && tsNum >= 1 && tsNum <= 16 ? tsRaw : "4/4";
  // The planned SECTIONS (1-4, in order). Older/odd replies that still carry a
  // single top-level label/intent become a one-part plan.
  const parts = (Array.isArray(j.parts) ? j.parts : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      label: cleanLabel(str(p.label)),
      intent: str(p.intent),
    }))
    .filter((p) => p.intent)
    .slice(0, 4);
  if (parts.length === 0)
    parts.push({ label: cleanLabel(str(j.label)), intent: str(j.intent, q) });
  return {
    title: str(j.title, "Untitled").slice(0, 60),
    genre: str(j.genre).slice(0, 40),
    bpm,
    key: str(j.key, "A minor").slice(0, 40),
    timeSignature,
    label: parts[0].label,
    intent: parts[0].intent,
    // Length isn't planned — placeholder; the real length is computed from the
    // composed loop (lib/loop-length.ts).
    bars: 8,
    parts,
  };
}

// ---------------------------------------------------------------------------
// 1b. plan-mix — design a ~90s multi-section "mix" from inspiration loop(s)
// ---------------------------------------------------------------------------

/** A loop offered to the mix planner as inspiration (its label, description, code). */
export interface MixInspiration {
  label: string;
  intent: string;
  strudel: string;
}

const DERIVE_ADJACENT_SYSTEM = `You extend an EXISTING instrumental track by adding ONE new section — BEFORE the
first section, AFTER the last, or BETWEEN two existing sections. You're given the
track's identity and its current sections in order (each: a label + an intent).
Design the new section as a DISTINCT musical statement — its own material, character
and energy, clearly different from every existing section's intent. Cohesion comes from
the shared genre, key and tempo, never from restating an existing section's melody or
groove; a referenced motif is TRANSFORMED (fragmented, answered, moved to another
voice), not repeated.
- "before" leads into the current first section; "after" makes the NEXT move after the
  last; "between" takes the hand-off from the section before it and converges into the
  one after.
(The composer sees the neighbours' actual code — the intent's job is the section's own
identity, not the stitching.)
Keep the track's genre, key and tempo. Every section LOOPS: the intent describes a
state held on every repeat, never a one-way arc from silence or into a finale.
If the user gives a DIRECTION, that is your brief — realize THEIR idea in this slot;
a named artist, band or song is translated into purely musical terms, never echoed.
Otherwise choose what best fits the arc.
Respond with ONLY JSON, no prose, no fences:
{ "label": a NEW distinctive 1-3 word label (never one already in the list),
  "intent": a 1-2 sentence description of the section's own material, character and
    energy,
  "kind": "loop" for a full section; "break" when the user's direction asks for a
    short transitional hand-off between its neighbours (a breather, a suspension,
    a riser seam) rather than a section of its own,
  "bars": the loop length in bars — match the song's existing sections (a break is 1-4) }`;

/** Plan ONE new section to prepend ("before"), append ("after") or BRIDGE
 *  ("between", at index `at` — i.e. it will sit before the current parts[at]),
 *  given the whole current arrangement as context + the user's natural-language
 *  direction for what they want there. Deterministic-ish fallback. */
export async function deriveAdjacentPart(
  args: {
    plan: SongPlan;
    parts: { label: string; intent: string; bars?: number }[];
    side: "before" | "after" | "between";
    at?: number;
    prompt?: string;
    /** "break" plans a SHORT transitional loop for this slot (1-4 bars) —
     *  otherwise a full section. */
    kind?: "loop" | "break";
  },
  cfg?: ClaudeConfig,
): Promise<{ label: string; intent: string; bars: number; kind: "loop" | "break" }> {
  const { plan, parts, side, at, prompt } = args;
  // An explicit "break" from the caller still forces it (API compat); the UI
  // no longer sends one — THE WORDS decide (2026-07-14, the user: "the AI
  // learns from your language that the loop is a break").
  const forced = args.kind === "break";
  const isBreak = forced;
  // The new section's length must fit the SONG, not a constant: the model
  // plans it (clamped 2..8 bars — 1..4 for a break), and every fallback lands
  // on the MEDIAN of the existing sections' lengths — a track of 4-bar loops
  // never grows an 8-bar tail just because extend was tapped.
  const clampBars = (v: unknown, asBreak: boolean): number | null => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n <= 0) return null;
    return asBreak ? Math.min(4, Math.max(1, n)) : Math.min(8, Math.max(2, n));
  };
  const lens = parts
    .map((p) => clampBars(p.bars, false))
    .filter((b): b is number => b !== null)
    .sort((a, b) => a - b);
  const medianBars = lens.length
    ? lens.length % 2
      ? lens[lens.length >> 1]
      : Math.round((lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2)
    : 4; // no sections to match — most loops are focused
  const fallback = {
    label: isBreak
      ? "Break"
      : side === "before"
        ? "Intro"
        : side === "between"
          ? "Bridge"
          : "Outro",
    intent: isBreak
      ? "a short break easing the previous section into the next"
      : side === "before"
        ? "set up and lead into the opening section"
        : side === "between"
          ? "bridge the two sections around it — take the hand-off and set up what follows"
          : "carry the track onward from the last section",
    bars: isBreak ? Math.min(2, medianBars) : medianBars,
    kind: (isBreak ? "break" : "loop") as "loop" | "break",
  };
  if (mockEnabled(cfg?.mock)) return fallback;
  const arrangement = parts.length
    ? parts
        .map(
          (p, i) =>
            `${i + 1}. ${p.label || "untitled"}${p.intent ? ` — ${p.intent}` : ""}`,
        )
        .join("\n")
    : "(no sections yet)";
  const want = (prompt || "").trim();
  const user = [
    `TRACK: ${plan.genre || "—"} · ${plan.bpm} BPM · ${plan.key}`,
    plan.summary ? `OVERVIEW: ${plan.summary}` : "",
    ``,
    `CURRENT SECTIONS (in order):`,
    arrangement,
    ``,
    want
      ? `THE USER'S DIRECTION FOR THIS NEW SECTION: ${want}`
      : `(No specific direction — choose what best fits the arc.)`,
    ``,
    isBreak
      ? `Add ONE new BREAK — a SHORT (1-4 bar) transitional section — BETWEEN section ${at ?? 1} ("${parts[(at ?? 1) - 1]?.label || "?"}") and section ${(at ?? 1) + 1} ("${parts[at ?? 1]?.label || "?"}"): sparser than its neighbours, tension into release.`
      : side === "between"
        ? `Add ONE new BRIDGE section BETWEEN section ${at ?? 1} ("${parts[(at ?? 1) - 1]?.label || "?"}") and section ${(at ?? 1) + 1} ("${parts[at ?? 1]?.label || "?"}").`
        : `Add ONE new section ${side === "before" ? "BEFORE the first" : "AFTER the last"} section.`,
  ]
    .filter(Boolean)
    .join("\n");
  // Robust: retry so a transient hiccup doesn't drop us to the generic fallback.
  const j = await completeJson<Record<string, unknown>>(
    DERIVE_ADJACENT_SYSTEM,
    user,
    cfg,
    { ...ROUTE.create, trace: { kind: "derive-adjacent" } },
    (x) => !!str(x.intent),
  );
  const intent = j ? str(j.intent) : "";
  if (!intent) return fallback;
  const kind: "loop" | "break" =
    forced || str(j!.kind) === "break" ? "break" : "loop";
  return {
    label: cleanLabel(str(j!.label, fallback.label)),
    intent,
    bars: clampBars(j!.bars, kind === "break") ?? (kind === "break" ? Math.min(2, medianBars) : medianBars),
    kind,
  };
}

// --- vocal coach -------------------------------------------------------------

const VOCAL_COACH_SYSTEM = `You are the vocal producer for a finished AI-composed track. Given the track's
identity and measurements of a sung take, decide how the studio should treat the
voice — how hard to correct it and where it sits in this production.
Respond with ONLY JSON, no prose, no fences:
{ "scalePcs": pitch classes 0-11 (0=C) the vocal snaps to — the track's ACTUAL mode
    (the stored key is major/minor only; infer the true mode from genre/summary),
  "subdivision": the timing grid the phrasing sits on — 2 (8ths, laid-back), 4
    (16ths, tight/rap), or 3 (triplet feel),
  "tune": 0-1, "timing": 0-1, "clean": 0-1 — correction strengths judged from the
    genre's convention AND the take's stats (an accurate take needs less; a raw
    genre WANTS less; hard-tune genres want 1),
  "fx": { "level": 0-1.5 (1 sits IN the mix), "air": 0-1, "glow": 0-1 (stereo
    double), "drive": 0-1 (saturation), "echo": 0-1 (synced delay), "space": 0-1
    (reverb) } — the voice's place in THIS track,
  "pills": exactly 3 complete alternative looks, each { "label": ≤14 chars — a
    seductive NAME in the product's voice, never an explanation, "tune", "timing",
    "clean", "fx" } spanning a real range: one nearly-raw, one produced, one extreme,
  "note": ONE short line to the singer about the call you made. No hedging. }`;

export interface VocalCoachLook {
  tune: number;
  timing: number;
  clean: number;
  fx: {
    level: number;
    air: number;
    glow: number;
    drive: number;
    echo: number;
    space: number;
  };
}
export interface VocalCoachPlan extends VocalCoachLook {
  scalePcs: number[];
  subdivision: number;
  pills: ({ label: string } & VocalCoachLook)[];
  note: string;
}

/** ONE Fable call that turns the track's context + the take's measured pitch
 *  behaviour into the studio's correction chart + three named looks. This is
 *  where the AI "hears" the song the singer sang over — mode included (the
 *  thing plan.key cannot express). Null on failure — the studio's own defaults
 *  stand and the singer is none the wiser. */
export async function coachVocalTake(
  args: {
    plan: SongPlan;
    sections: { label: string; intent: string }[];
    stats: { medianF0: number; minF0: number; maxF0: number; voicedRatio: number; seconds: number };
    hint?: string;
  },
  cfg?: ClaudeConfig,
): Promise<VocalCoachPlan | null> {
  const { plan, sections, stats, hint } = args;
  const user = [
    `TRACK: ${plan.genre || "—"} · ${plan.bpm} BPM · ${plan.key}${plan.timeSignature ? ` · ${plan.timeSignature}` : ""}`,
    plan.summary ? `OVERVIEW: ${plan.summary}` : "",
    sections.length
      ? `SECTIONS: ${sections.map((s) => s.label).join(" → ")}`
      : "",
    ``,
    `THE TAKE: ${stats.seconds.toFixed(1)}s sung, voiced ${(stats.voicedRatio * 100).toFixed(0)}% of the time, ` +
      `median pitch ${stats.medianF0.toFixed(0)} Hz (range ${stats.minF0.toFixed(0)}–${stats.maxF0.toFixed(0)} Hz).`,
    hint ? `THE SINGER'S OWN ASK: ${hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const clamp01 = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
  const clampFx = (f: unknown): VocalCoachLook["fx"] => {
    const o = (f ?? {}) as Record<string, unknown>;
    const lv = o.level;
    return {
      level:
        typeof lv === "number" && Number.isFinite(lv)
          ? Math.max(0, Math.min(1.5, lv))
          : 1,
      air: clamp01(o.air, 0.35),
      glow: clamp01(o.glow, 0.15),
      drive: clamp01(o.drive, 0.1),
      echo: clamp01(o.echo, 0.15),
      space: clamp01(o.space, 0.25),
    };
  };
  const j = await completeJson<Record<string, unknown>>(
    VOCAL_COACH_SYSTEM,
    user,
    cfg,
    { ...ROUTE.create, trace: { kind: "vocal-coach" } },
    (x) => Array.isArray(x.scalePcs) && Array.isArray(x.pills),
  );
  if (!j) return null;
  const scalePcs = (j.scalePcs as unknown[])
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 11);
  const pills = (j.pills as unknown[]).slice(0, 3).flatMap((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 18) : "";
    if (!label) return [];
    return [
      {
        label,
        tune: clamp01(o.tune, 0.8),
        timing: clamp01(o.timing, 0.55),
        clean: clamp01(o.clean, 0.7),
        fx: clampFx(o.fx),
      },
    ];
  });
  return {
    scalePcs: scalePcs.length ? scalePcs : [0, 2, 4, 5, 7, 9, 11],
    subdivision: j.subdivision === 3 || j.subdivision === 4 ? (j.subdivision as number) : 2,
    tune: clamp01(j.tune, 0.8),
    timing: clamp01(j.timing, 0.55),
    clean: clamp01(j.clean, 0.7),
    fx: clampFx(j.fx),
    pills,
    note: typeof j.note === "string" ? j.note.trim().slice(0, 200) : "",
  };
}

export interface ArrangementItem {
  /** Part id — lets composers spot blueprints (plan.chapters values). */
  id?: string;
  label: string;
  intent: string;
  bars: number;
  position: number;
  isTarget: boolean;
  done: boolean;
  /** This part's finished code (ready parts only) — lets a new part be composed
   *  AND its visuals continue from an actual neighbour, not just its label. */
  strudel?: string | null;
  /** 'loop', 'break' or legacy 'bridge' (see PlanPart.kind). */
  kind?: "loop" | "bridge" | "break";
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2a. parameterize — expose a loop's key numbers as labeled, ranged sliders
// ---------------------------------------------------------------------------

const PARAMETERIZE_SYSTEM = `You are given a finished, working Strudel loop. Expose its most musically
meaningful "knobs" so a NON-CODER can shape the sound with sliders.

Pick the 4 to 8 parameters that matter most for shaping THIS loop. Rewrite the
program so each chosen parameter is a top-level \`const <name> = <number>\` and
the original literal is replaced by that variable; each const's value MUST equal
the literal it replaced, and nothing else about the music changes.

Then, as the very first thing in the file, emit the control spec as a block
comment in EXACTLY this shape (valid JSON array between the markers):

/* @controls
[{"name":"<const name>","label":"…","desc":"…","min":<number>,"max":<number>,"step":<number>}]
*/

Rules:
- "name" is the EXACT const identifier (a valid JS identifier, lowercase, no spaces).
- CANONICAL NAMES: when a knob matches one of these concepts, use EXACTLY this
  name — kick, snare, hats, bass, lead, chords, pads, brightness, space, echo,
  drive (same-named knobs unify into one song-wide control). Invent a name only
  for a concept not on the list.
- "label" is 1-3 friendly words; "desc" is one plain-English sentence, no jargon.
  Name and describe by ROLE, never by position or instrument — knobs are shared
  across the song's loops and instruments can be swapped.
- LEVEL knobs for voices have min 0.
- "min"/"max" bracket the default so the whole range stays musical; "step" is a
  sane increment. All plain numbers.
- Only NUMERIC parameters; every const stays a plain number literal.

Output ONLY the complete Strudel program: the /* @controls */ comment, the
consts, then the code with its literals swapped. No fences, no commentary.`;

/**
 * Second pass (runs after compose): rewrite a finished loop to expose labeled,
 * ranged sliders via a /* @controls *\/ header + top-level consts. Uses default
 * "high" thinking (lighter than composition). SAFE: if the model's output isn't
 * a usable parameterization, we return the ORIGINAL code unchanged (the loop
 * just won't have sliders) — never ship a broken rewrite.
 */
export async function parameterizePart(
  code: string,
  cfg?: ClaudeConfig,
): Promise<string> {
  if (mockEnabled(cfg?.mock)) return code;
  let out: string;
  try {
    out = stripFences(
      await complete(PARAMETERIZE_SYSTEM, code, cfg, { ...ROUTE.transform, trace: { kind: "parameterize" } }),
    );
  } catch {
    return code;
  }
  // Only accept the rewrite if it carries a valid spec whose every control maps
  // to a real numeric const; otherwise keep the original (no sliders).
  if (!out || parseControls(out).length === 0) return code;
  return out;
}

const SWAPS_SYSTEM = `You are given a finished Strudel loop. Propose INSTRUMENT SWAPS a
non-coder could try with one tap — ONE ENTRY PER "$:" LAYER, even when two
layers share a sound (each keeps its own "layer" number and label).
For each melodic/harmonic layer whose sound could plausibly be traded (the
lead, the chords/keys, maybe the bass — not the drums), offer 2-3 alternative
sounds that fit this loop's genre and mood.
"layer" = the 1-based position of that "$:" layer from the top. "find" = the
EXACT sound name in that layer. Options come ONLY from the AVAILABLE SOUNDS
list; each option's "s" is a real sound DIFFERENT from "find" and from the
other options. Skip layers with no genuine alternatives. 4 entries max.
Respond with ONLY valid JSON, no prose, no fences:
{"swaps":[{"layer":<number>,"find":"<exact sound in that layer>","findLabel":"…","label":"…","options":[{"s":"<sound from the list>","label":"…"}]}]}
Every label is a plain instrument name a non-musician recognises; "findLabel"
names the original sound, each option's "label" names the sound chosen.`;

/**
 * One LOW-thinking pass that proposes per-layer instrument ALTERNATIVES for a
 * finished loop (the "swap the lead piano for a guitar" feature). The AI only
 * SUGGESTS — applying a swap is a deterministic string replacement in the UI —
 * and every option is validated against the real loaded-sound catalog, so a tap
 * can never produce silence. Returns the @swaps JSON string, or "" if nothing
 * good was proposed.
 */
export async function suggestSounds(
  code: string,
  cfg?: ClaudeConfig,
): Promise<string> {
  if (mockEnabled(cfg?.mock)) return "";
  const real = new Set<string>([...GM_SOUNDS, ...PALETTE_SOUNDS, ...WT_SOUNDS]);
  // The prompt's list carries only the MELODIC palette (gm_ + wavetables + oscillators) — swaps
  // exclude drums, so the drum/texture categories were dead tokens on every call. The validation
  // set above still accepts anything real.
  const offer = [...GM_SOUNDS, ...WT_SOUNDS, "sawtooth", "square", "triangle", "sine", "supersaw", "pulse"];
  const user = [
    `AVAILABLE SOUNDS (the ONLY valid option names):`,
    offer.join(", "),
    ``,
    `THE LOOP:`,
    code,
  ].join("\n");
  let raw: string;
  try {
    raw = await complete(SWAPS_SYSTEM, user, cfg, { ...ROUTE.transform, trace: { kind: "swaps" } });
  } catch {
    return "";
  }
  const j = parseJson<{
    swaps?: {
      layer?: unknown;
      find?: unknown;
      findLabel?: unknown;
      label?: unknown;
      options?: { s?: unknown; label?: unknown }[];
    }[];
  }>(raw);
  if (!j?.swaps || !Array.isArray(j.swaps)) return "";
  const clean = j.swaps
    .map((s) => {
      const find = typeof s.find === "string" ? s.find : "";
      // The layer claim is VERIFIED against the code — a wrong layer falls back
      // to whole-loop behaviour rather than silently swapping the wrong voice.
      const rawLayer = Math.round(Number(s.layer));
      const layer =
        Number.isFinite(rawLayer) &&
        rawLayer >= 1 &&
        find &&
        soundInLayer(code, find, rawLayer)
          ? rawLayer
          : undefined;
      // Keep ONLY real sounds that DIFFER from the original, deduped by sound, so
      // every option genuinely changes something — then cap at 3.
      const seen = new Set<string>([find]);
      const options = (Array.isArray(s.options) ? s.options : [])
        .map((o) => ({
          s: typeof o.s === "string" ? o.s : "",
          label:
            (typeof o.label === "string" ? o.label.trim().slice(0, 24) : "") ||
            (typeof o.s === "string" ? o.s : ""),
        }))
        .filter((o) => {
          if (!o.s || !real.has(o.s) || seen.has(o.s)) return false;
          seen.add(o.s);
          return true;
        })
        .slice(0, 3);
      return {
        find,
        ...(layer ? { layer } : {}),
        findLabel:
          typeof s.findLabel === "string" ? s.findLabel.trim().slice(0, 24) : "",
        label:
          (typeof s.label === "string" ? s.label.trim().slice(0, 24) : "") ||
          "Layer",
        options,
      };
    })
    .filter(
      (s) =>
        s.find &&
        (code.includes(`"${s.find}"`) || code.includes(`'${s.find}'`)) &&
        s.options.length > 0,
    )
    .slice(0, 4);
  return clean.length ? JSON.stringify(clean) : "";
}

const BREAKS_SYSTEM = `You write BREAKS in Strudel — a one-bar easing played ONCE between two finished loops. You're given both neighbouring loops; use ONLY sound and bank names that appear in their code (an unlisted name plays silence). Write ONE one-bar break — one or more \`$: …\` Strudel lines naming their sounds, labelled in 1-2 plain words.

The break continues the groove it leaves, and the next loop's downbeat lands as its resolution. The one hard rule: a break is fully SILENT before its bar ends — nothing rings, sustains or reverb-washes past the downbeat.

Output ONLY JSON, no prose/fences — exactly ONE entry in "breaks":
{"breaks":[{"label":"…","strudel":"$: …\\n$: …"}]}`;

/** Compose ONE one-bar BREAK for the gap between two finished loops (HIGH effort — it must
 *  nail the hand-off). Returns raw {label, strudel} candidates (normally one) — the caller
 *  validates and keeps only the playable ones; ↻ regenerate replaces it. */
export async function generateBreaks(
  args: {
    plan: SongPlan;
    fromMusic: string;
    toMusic: string;
    /** The user's own words for this hand-off — steers the break when present. */
    direction?: string;
    feedback?: string;
    /** Set when the break bridges TWO SONGS (a DJ-set hand-off): the outgoing
     *  song's tempo/key, so the model knows the material before the break may
     *  be in a different key/tempo and must land in the incoming song's. */
    crossSong?: { fromBpm?: number; fromKey?: string };
  },
  cfg?: ClaudeConfig,
): Promise<{ label: string; strudel: string }[]> {
  const { plan, fromMusic, toMusic, direction, feedback, crossSong } = args;
  if (mockEnabled(cfg?.mock)) return [];
  const beats = beatsPerBar(plan.timeSignature);
  const user = [
    `TRACK: ${plan.summary || "(no summary)"}${plan.genre ? ` (genre: ${plan.genre})` : ""}`,
    `bpm: ${plan.bpm}  key: ${plan.key}  time signature: ${plan.timeSignature || "4/4"} — ONE bar = ${beats} beats (don't write setcpm — it's added for you)`,
    crossSong
      ? `This break is a DJ hand-off between TWO DIFFERENT SONGS: the loop before it is another song (bpm ${crossSong.fromBpm ?? "?"}, key ${crossSong.fromKey ?? "?"}). The break plays at the values above (the incoming song's) — resolve into the incoming song's key, don't restate the outgoing one's.`
      : "",
    ``,
    `THE LOOP BEFORE the break (the break takes the hand-off FROM this):`,
    fromMusic,
    ``,
    `THE LOOP AFTER the break (the break must ease INTO this — cushion whatever enters cold):`,
    toMusic,
    direction ? `\nTHE USER'S DIRECTION FOR THIS HAND-OFF: ${direction}` : "",
    feedback
      ? `\nYOUR PREVIOUS BREAK FAILED THE BUILD — fix exactly these, keep the musical idea:\n${feedback}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await complete(BREAKS_SYSTEM, user, cfg, {
    provider: "anthropic",
    effort: "high", // breaks must nail the hand-off between two loops — worth full thinking
    trace: { kind: "breaks" },
  });
  const j = parseJson<{ breaks?: { label?: unknown; strudel?: unknown }[] }>(raw);
  if (!j?.breaks || !Array.isArray(j.breaks)) return [];
  const out: { label: string; strudel: string }[] = [];
  for (const b of j.breaks) {
    const label =
      (typeof b.label === "string" ? sentenceLabel(b.label).slice(0, 18) : "") ||
      "Break";
    const body = typeof b.strudel === "string" ? b.strudel : "";
    // Keep the `$:` lines as written — the break's playable program is `setcpm(bpm/beats)` + those
    // lines (the caller then validates each candidate and drops any that don't play).
    const exprs = body
      .replace(/```[a-z]*\n?/gi, "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => /^\$:/.test(s));
    if (exprs.length)
      out.push({ label, strudel: `setcpm(${plan.bpm}/${beats})\n${exprs.join("\n")}` });
  }
  return out.slice(0, 1);
}

const ARRANGE_SET_SYSTEM = `You are ordering finished songs into ONE continuous DJ set. You get each song's tempo, key, genre and a one-line description. Choose the order that flows best as a single night: a coherent tempo arc, compatible keys at each hand-off, energy building where it should.
Output ONLY JSON, no prose/fences: {"order":["<id>", …]} — every given id exactly once.`;

/** Order a set's songs into one flowing night (ONE cheap call — it reads
 *  metadata, not code). Returns the entry ids in play order; any id the model
 *  drops is appended so a song can never fall out of the set. */
export async function arrangeSet(
  songs: {
    id: string;
    title: string;
    bpm?: number;
    key?: string;
    genre?: string;
    summary?: string;
  }[],
  cfg?: ClaudeConfig,
): Promise<string[]> {
  if (mockEnabled(cfg?.mock) || songs.length < 2) return songs.map((s) => s.id);
  const user = songs
    .map(
      (s) =>
        `- id: ${s.id} | "${s.title}" | ${s.bpm ?? "?"} bpm | ${s.key ?? "?"}` +
        `${s.genre ? ` | ${s.genre}` : ""}${s.summary ? ` | ${s.summary}` : ""}`,
    )
    .join("\n");
  const raw = await complete(ARRANGE_SET_SYSTEM, user, cfg, {
    provider: "anthropic",
    effort: "medium",
    trace: { kind: "arrange" },
  });
  const j = parseJson<{ order?: unknown[] }>(raw);
  const valid = new Set(songs.map((s) => s.id));
  const out: string[] = [];
  const used = new Set<string>();
  for (const x of Array.isArray(j?.order) ? j.order : []) {
    if (typeof x === "string" && valid.has(x) && !used.has(x)) {
      used.add(x);
      out.push(x);
    }
  }
  for (const s of songs) if (!used.has(s.id)) out.push(s.id);
  return out;
}

const LABEL_SYSTEM = `You write the tweak-knob labels for a finished instrumental loop, for a
NON-CODER. Each control is a top-level "const NAME = number" in the given code.
For EACH name, read what it feeds, then write a label and a description of what
raising vs lowering does in THIS loop.
Respond with ONLY a JSON object mapping each name to { "label", "desc" }:
{"<name>":{"label":"…","desc":"…"}}
label = 1-3 short words. desc = one plain-English sentence naming the up AND
down effect, no jargon. Name by ROLE, never by position or instrument — knobs
are shared across the song's loops and instruments can be swapped. Cover every
name.`;

/**
 * LABEL-ONLY AI pass (runs after the DETERMINISTIC parameterize). It reads the
 * already-parameterized code and rewrites ONLY the label + desc of each control
 * inside the `/* @controls *\/` comment — explaining what raising/lowering each
 * knob does. It NEVER touches the const lines or the music (that comment is
 * ignored at playback), so the loop stays byte-identical. Falls back to the
 * deterministic labels on any failure.
 */
export async function labelControls(
  code: string,
  cfg?: ClaudeConfig,
): Promise<string> {
  const block = code.match(/\/\*\s*@controls\b([\s\S]*?)\*\//);
  if (!block) return code;
  let spec: { name: string; label: string; desc: string }[];
  try {
    spec = JSON.parse(block[1].trim());
  } catch {
    return code;
  }
  if (!Array.isArray(spec) || spec.length === 0) return code;
  if (mockEnabled(cfg?.mock)) return code;

  const names = spec.map((s) => s.name).join(", ");
  const user = [`CONTROL NAMES: ${names}`, ``, `LOOP CODE:`, code].join("\n");
  let raw: string;
  try {
    raw = await complete(LABEL_SYSTEM, user, cfg, { ...ROUTE.copy, trace: { kind: "label" } });
  } catch {
    return code;
  }
  const map = parseJson<Record<string, { label?: string; desc?: string }>>(raw);
  if (!map) return code;

  const clean = (s: unknown, fallback: string) => {
    const v = typeof s === "string" ? s.replace(/\*\//g, " ").trim() : "";
    return v ? v.slice(0, 200) : fallback;
  };
  const merged = spec.map((s) => ({
    ...s,
    label: clean(map[s.name]?.label, s.label),
    desc: clean(map[s.name]?.desc, s.desc),
  }));
  // Replace ONLY the @controls comment; the consts + body are left untouched.
  return code.replace(
    /\/\*\s*@controls\b[\s\S]*?\*\//,
    `/* @controls\n${JSON.stringify(merged)}\n*/`,
  );
}
// ---------------------------------------------------------------------------
// 3. edit — runs inside an Edit Workflow step
// ---------------------------------------------------------------------------

const EDIT_SYSTEM = `You are editing a Strudel composition. You get the whole song as an ordered
list of parts (id, label, full Strudel code) and the user's change request.
Apply the change. The user may target a section by an @-mention of its label or
in plain words; with no target it applies to the whole song. UNTARGETED
sections come back byte-for-byte UNCHANGED. Each section stays a LOOP — every
bar plays on every repeat. Keep the key and tempo unless the request changes
them. Don't invent APIs or sound names. One instrument per "$:" layer.

Respond with ONLY valid JSON, no prose, no fences:
{ "parts": [ { "id": string, "strudel": string } ] }
Return every part, changed or not.`;

export async function editSong(
  args: {
    parts: { id: string; label: string | null; strudel: string | null }[];
    changeRequest: string;
  },
  cfg?: ClaudeConfig,
): Promise<EditedPart[]> {
  const { parts, changeRequest } = args;
  if (mockEnabled(cfg?.mock)) return mockEdit(parts, changeRequest);
  const songText = parts
    .map(
      (p) =>
        `### id: ${p.id}\nlabel: ${p.label ?? ""}\n${p.strudel ?? "(empty)"}`,
    )
    .join("\n\n");
  const userText = [
    `FULL SONG (ordered):`,
    songText,
    ``,
    `CHANGE REQUEST:`,
    changeRequest,
  ].join("\n");
  // AI edits use HIGH effort (not MAX) — a targeted change is well within high.
  // One-shot mode also drops the API reference (the model knows Strudel).
  const raw = await complete(
    EDIT_SYSTEM,
    userText,
    cfg,
    // high (not max): an edit's output can be a whole song, and Opus "max" can overthink.
    { provider: "anthropic", effort: "high", trace: { kind: "edit" } },
  );
  const parsed = parseJson<{ parts: EditedPart[] }>(raw);
  if (!parsed || !Array.isArray(parsed.parts)) {
    throw new Error("edit: model did not return a valid parts array");
  }
  return parsed.parts.filter(
    (p) => typeof p.id === "string" && typeof p.strudel === "string",
  );
}

const EDIT_PART_SYSTEM = `You rework ONE loop of an instrumental Strudel composition. You get the loop's
current Strudel, its musical context (genre, key, tempo, section) and ONE
requested change. Apply that change and only that change — it stays recognisably
the SAME loop: same key, tempo, length in cycles and identity. Don't invent APIs
or sound names. One instrument per "$:" layer.
Respond with ONLY valid JSON, no prose, no fences:
{ "strudel": "<the complete reworked loop>" }`;

/** Apply ONE tapped change (an edit pill) to ONE loop. Single-part in, single
 *  part out — small, fast and immune to the whole-song output ceiling. Throws if
 *  the model doesn't return code; the caller decides what "keep the old one"
 *  looks like. */
export async function editPart(
  args: {
    plan: SongPlan;
    label: string;
    music: string;
    change: string;
    /** A previous attempt to REVISE (the one-shot repair pass). */
    previous?: string;
    /** What was broken in it (validator findings) — must ALL be fixed. */
    feedback?: string;
  },
  cfg?: ClaudeConfig,
): Promise<string> {
  const { plan, label, music, change, previous, feedback } = args;
  if (mockEnabled(cfg?.mock)) return music;
  const user = [
    `TRACK: ${plan.summary}${plan.genre ? ` (genre: ${plan.genre})` : ""}`,
    `bpm: ${plan.bpm}  key: ${plan.key}`,
    `SECTION: ${label}`,
    ``,
    `CURRENT LOOP:`,
    music,
    ``,
    `REQUESTED CHANGE: ${change}`,
    ...(previous && feedback
      ? [
          ``,
          `YOUR PREVIOUS ATTEMPT:`,
          previous,
          ``,
          `It is BROKEN — fix ALL of the following and output the complete corrected loop:`,
          feedback,
        ]
      : []),
  ].join("\n");
  const raw = await complete(
    EDIT_PART_SYSTEM,
    user,
    cfg,
    // high effort — an edit emits Strudel; Opus "max" can overthink.
    { provider: "anthropic", effort: "high", trace: { kind: "edit-pill" } },
  );
  const parsed = parseJson<{ strudel?: string }>(raw);
  const code = typeof parsed?.strudel === "string" ? parsed.strudel.trim() : "";
  if (!code) throw new Error("edit: model did not return the reworked loop");
  return code;
}

// ---------------------------------------------------------------------------
// 4. hydra — a POST-STEP after the Strudel is final. Generates visuals that sync
//    to the loop. Never touches the audio (stored in a separate @hydra block).
// ---------------------------------------------------------------------------

/** The ONE Hydra rulebook — the physics + output contract shared by generate (HYDRA_SYSTEM)
 *  and repair (HYDRA_REPAIR_SYSTEM). Factored so the two can never drift; each prompt keeps
 *  only its one-line task framing. */
const HYDRA_RULES = `Hydra is already running, and a helper \`H(signal)\` is in scope: it turns a Strudel signal into a tempo-locked value. The signal must be CONTINUOUS (a waveform — a stepped pattern snaps between values instead of gliding), and its period must divide the loop's cycle count N (when given) so the motion wraps seamlessly. A sawtooth snaps back at each period's end, so it only fits a parameter whose end state equals its start — a full rotation or a full hue lap; everywhere else use a signal that returns smoothly. Motion reads smooth only when the operation is continuous too: hard-edged operations (thresh, posterize, pixelate) and very fast modulation turn a smooth driver into visible steps and flicker. The frame stays clearly visible the whole loop: mult-masks, luma keys, negative brightness and dark base colours each remove light and their effects MULTIPLY — account for the combined level, not each stage alone. It renders live on a busy page: every source and modulation stage runs per pixel, so keep the chain LEAN — a few stages doing real work, never many stacked. Pass H(…) directly as a parameter, with any scaling done inside the signal via .range — H returns a FUNCTION, so arithmetic on its result is NaN and a black screen. Visuals only — no audio/Strudel code. End the final chain with \`.out()\`. Output raw Hydra code only — no prose, no fences.`;

const HYDRA_SYSTEM = `You write the Hydra (hydra-synth) visual for an instrumental music loop — ONE visual that moves with the music and loops with it, returning to its exact starting frame every N cycles (when given).

${HYDRA_RULES}`;

/** Strip fences/prose and make the Hydra code safe to embed + run. Returns ""
 *  if it doesn't look like real Hydra (no .out()), so the loop just gets no
 *  visuals rather than broken code. */
function sanitizeHydra(raw: string): string {
  let s = stripFences(raw).trim();
  // Drop anything that isn't visuals (defensive — the prompt forbids audio).
  if (/^\s*(?:\$:|setcpm\b|setcps\b)/m.test(s)) {
    s = s
      .split("\n")
      .filter((l) => !/^\s*(?:\$:|setcpm\b|setcps\b)/.test(l))
      .join("\n")
      .trim();
  }
  if (!/\.out\s*\(/.test(s)) return ""; // not a real hydra program
  return s.slice(0, 4000);
}

/** REPAIR (one call) — a Hydra visual failed; fix ONLY what the error is about (parallel of the Strudel
 *  repair). Lean, like the rest: say what we want + the output contract, nothing else. */
const HYDRA_REPAIR_SYSTEM = `A Hydra (hydra-synth) visual for a music loop failed. You're given the visual and the exact error. Fix what the error is about so it renders and loops cleanly, and change nothing else.

${HYDRA_RULES}`;

/**
 * Repair a Hydra visual that errored (at generation gate or at playback): given the visual + the exact
 * error, fix ONLY what's broken (HYDRA_REPAIR_SYSTEM, HIGH) and return sanitized Hydra, or "" if nothing
 * usable. Parallel of repairStrudelLoop. `frame` is just music context for a coherent fix.
 */
export async function repairHydra(
  code: string,
  error: string,
  frame: { genre?: string; intent?: string; key?: string; bpm?: number; loopCycles?: number },
  cfg?: ClaudeConfig,
): Promise<string> {
  const visual = code.trim();
  if (!visual || mockEnabled(cfg?.mock)) return "";
  const n = frame.loopCycles && frame.loopCycles > 0 ? frame.loopCycles : 0;
  const user = [
    `GENRE: ${frame.genre || "—"}   KEY: ${frame.key || "—"}   BPM: ${frame.bpm || "—"}`,
    frame.intent ? `MOOD / INTENT: ${frame.intent}` : "",
    n ? `The visual must loop with the music — return to its exact starting frame every ${n} cycles.` : "",
    ``,
    `THE HYDRA VISUAL that errored:`,
    visual,
    ``,
    `THE ERROR:`,
    error.slice(0, 800),
    ``,
    `Return the corrected Hydra visual, fixing ONLY what the error is about.`,
  ]
    .filter(Boolean)
    .join("\n");
  try {
    return sanitizeHydra(await complete(HYDRA_REPAIR_SYSTEM, user, cfg, { ...ROUTE.compose, effort: "high", trace: { kind: "hydra-repair" } }));
  } catch {
    return "";
  }
}

const VISUAL_LOOKS_SYSTEM = `You are given a Hydra visual for a music loop and its grade controls (each: name, min, max, default). Name the visual's CURRENT look (the controls at their defaults), then propose 3 to 5 one-tap LOOKS — distinct moods of this same visual. Every name: 1-2 words a non-coder understands. Each look: a value for every control, within its range. Ground everything in what this visual actually renders; make the looks clearly distinct from each other and from the default. Respond with ONLY valid JSON, no prose, no fences:
{"default":"…","looks":[{"name":"…","set":{"<control name>":<number>}}]}`;

/**
 * One LOW-thinking pass that proposes this visual's one-tap LOOKS — named grade settings specific
 * to what the visual renders (the visual twin of a layer's pills; replaces the fixed presets).
 * Every value is clamped to its control's real range and unknown controls are dropped, so a tap
 * can never push a slider out of bounds. Returns the `@vlooks` JSON string, or "" when nothing
 * usable came back (the panel then falls back to its fixed presets).
 */
export async function suggestLooks(
  hydra: string,
  vcontrolsJson: string,
  cfg?: ClaudeConfig,
): Promise<string> {
  if (!hydra.trim() || !vcontrolsJson.trim() || mockEnabled(cfg?.mock)) return "";
  let spec: LoopControl[];
  try {
    spec = JSON.parse(vcontrolsJson) as LoopControl[];
  } catch {
    return "";
  }
  const range = new Map(spec.map((c) => [c.name, c]));
  const user = [
    `THE GRADE CONTROLS (JSON):`,
    vcontrolsJson,
    ``,
    `THE HYDRA VISUAL:`,
    hydra,
  ].join("\n");
  let raw: string;
  try {
    raw = await complete(VISUAL_LOOKS_SYSTEM, user, cfg, { ...ROUTE.transform, trace: { kind: "vlooks" } });
  } catch {
    return "";
  }
  const j = parseJson<{ default?: unknown; looks?: { name?: unknown; set?: Record<string, unknown> }[] }>(raw);
  if (!j?.looks || !Array.isArray(j.looks)) return "";
  const defaultName = typeof j.default === "string" ? j.default.trim().slice(0, 18) : "";
  const seen = new Set<string>();
  const clean = j.looks
    .map((l) => {
      const name = typeof l?.name === "string" ? l.name.trim().slice(0, 18) : "";
      const set: Record<string, number> = {};
      for (const [k, v] of Object.entries(l?.set ?? {})) {
        const c = range.get(k);
        const n = Number(v);
        if (!c || !Number.isFinite(n)) continue; // unknown control / junk value → dropped
        set[k] = Math.min(c.max, Math.max(c.min, n));
      }
      return { name, set };
    })
    .filter((l) => {
      const k = l.name.toLowerCase();
      if (!l.name || Object.keys(l.set).length === 0 || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
  return clean.length >= 2 ? JSON.stringify({ default: defaultName, looks: clean }) : "";
}

/** Generate Hydra visuals that sync to a FINISHED loop. Two attempts, each
 *  gen → server eval → targeted repair with the real errors (repairHydra).
 *  Effort HIGH. Fail-safe: returns the first candidate that passes, or "" — never
 *  throws (visuals are optional and must never block or break the loop). */
export async function generateHydra(
  args: {
    strudel: string;
    genre?: string;
    intent?: string;
    key?: string;
    bpm?: number;
    /** The music loop's TRUE length in cycles — the visual must return home every
     *  this-many cycles. Enables the loop-sync gate + tells the model the divisors. */
    loopCycles?: number;
    /** The adjacent finished section's Hydra (when this part joins a multi-part
     *  song) — the new visual should CONTINUE this look, not restart from scratch. */
    priorHydra?: string;
    neighbourLabel?: string;
  },
  cfg?: ClaudeConfig,
  // When provided, EACH gen/repair call becomes its own durable Workflow step —
  // so the gen → check → repair ladder is never crammed into a single step that
  // blows past the 10-min cap (which silently dropped visuals).
  runStep?: <T>(name: string, fn: () => Promise<T>) => Promise<T>,
  stepKey?: string,
): Promise<string> {
  const music = args.strudel?.trim();
  if (!music) return "";
  const sk = stepKey ?? "h";
  const step: <T>(name: string, fn: () => Promise<T>) => Promise<T> =
    runStep ?? ((_n, fn) => fn());
  if (mockEnabled(cfg?.mock))
    return `osc(4, 0, 1.25)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .modulate(noise(1.4, 0), 0.1)\n  .modulateScale(noise(0.6, 0), 0.06)\n  .kaleid(6)\n  .color(1.0, 0.55, 0.7)\n  .hue(H(sine.slow(2).range(-0.03, 0.03)))\n  .saturate(1.18)\n  .out()`;
  const n = args.loopCycles && args.loopCycles > 0 ? args.loopCycles : 0;
  const loopLine = n
    ? `This loop is ${n} cycles long — the visual must return to its exact starting frame every ${n} cycles.`
    : "";
  const continuity = args.priorHydra
    ? `\nThis section joins a MULTI-PART song. The ${args.neighbourLabel || "adjacent"} section's visuals are below — CONTINUE this visual language (same palette, motifs, energy) and EVOLVE it for this section. Do NOT restart from a blank idea:\n${args.priorHydra}`
    : "";
  const user = [
    `THE MUSIC (Strudel) these visuals must sync to:`,
    music,
    ``,
    `GENRE: ${args.genre || "—"}   KEY: ${args.key || "—"}   BPM: ${args.bpm || "—"}`,
    args.intent ? `MOOD / INTENT: ${args.intent}` : "",
    loopLine,
    continuity,
    ``,
    `Write Hydra visuals that move with this loop.`,
  ]
    .filter(Boolean)
    .join("\n");

  // Generate one candidate (sanitized). `fb` is legacy plumbing — the ladder below
  // always calls it cold and routes real errors through repairHydra instead.
  const genOne = async (fb: string, tag: string): Promise<string> => {
    try {
      const raw = await step(`hgen-${sk}-${tag}`, () =>
        complete(
          HYDRA_SYSTEM, // slim doc-light prompt for BOTH paths — no redundant API spec
          fb
            ? `${user}\n\nYOUR PREVIOUS VISUAL HAD PROBLEMS — FIX EXACTLY THESE, keep what works:\n${fb}`
            : user,
          cfg,
          // one-shot: HIGH — visuals are OPT-IN now (a user explicitly asked for
          // them), so spend proper thinking on the one call they requested.
          { ...ROUTE.compose, trace: { kind: "hydra" } }, // hydra visual — Opus, high
        ),
      );
      return sanitizeHydra(raw);
    } catch {
      return "";
    }
  };

  // THE SERVER EVAL + RETRY LADDER (2026-07-02, the user: "caught before it hits the browser…
  // retries"): hydraServerErrors mirrors exactly what the browser eval would throw (syntax,
  // unknown/bare functions, no .out()) — motion QUALITY still rides the prompt. Ladder per
  // attempt: gen → check → targeted repair with the REAL errors → check. Two attempts, then ""
  // (visuals are optional and must never block the loop). The browser self-heal remains the net
  // for anything only WebGL can surface.
  const frame = {
    genre: args.genre,
    intent: args.intent,
    key: args.key,
    bpm: args.bpm,
    loopCycles: args.loopCycles,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = await genOne("", `${attempt}-0`);
    if (!candidate) continue;
    const errs = hydraServerErrors(candidate);
    if (errs.length === 0) return candidate;
    const fixed = await step(`hfix-${sk}-${attempt}`, () =>
      repairHydra(candidate, errs.join("\n"), frame, cfg),
    );
    if (fixed && hydraServerErrors(fixed).length === 0) return fixed;
  }
  return "";
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NEW COMPOSITION CORE — construct the score, pick the sounds, translate each
// layer. A loop is composed by: scoreLoop() → pickSounds() → translateLayer()
// per layer (the caller runs the layers in parallel) → merge. Each stage is ONE
// Opus 4.8 call. The deterministic gates + one repair pass guard the result.
// ---------------------------------------------------------------------------

const POWERS_OF_TWO = [4, 8, 16] as const;

/** Snap loop length to the power of 2 whose duration is closest to ~20s for this
 *  grid — so loop length is never guessed and odd lengths can't slip in. */
function targetLoopBars(bpm: number, beats: number): number {
  const secs = (n: number) => (n * beats * 60) / bpm;
  let best: number = POWERS_OF_TWO[0];
  for (const n of POWERS_OF_TWO)
    if (Math.abs(secs(n) - 20) < Math.abs(secs(best) - 20)) best = n;
  return best;
}

/** Snap a within-bar onset to the nearest CLEAN grid position — a 16th (multiple of
 *  0.25 beats) or a triplet (multiple of 1/3 beat), whichever is closer — and clamp it
 *  inside the bar. A slightly-off t (0.4) becomes the nearest grid step, so a single
 *  stray value can't push a layer off the shared grid in the render. */
function snapT(t: number, beats: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  const sixteenth = Math.round(t / 0.25) * 0.25;
  const triplet = Math.round(t * 3) / 3;
  const snapped = Math.abs(t - sixteenth) <= Math.abs(t - triplet) ? sixteenth : triplet;
  return Math.max(0, Math.min(beats - 1 / 48, Math.round(snapped * 1000) / 1000));
}

/** Force the score's grid to the plan's (the model echoes it but must not drift),
 *  clamp loopBars to a sane power of 2, snap every onset to the grid, and guarantee
 *  well-formed parts/events. */
function normalizeScore(raw: LoopScore, plan: SongPlan, beats: number): LoopScore {
  const bars = (POWERS_OF_TWO as readonly number[]).includes(raw.loopBars)
    ? raw.loopBars
    : targetLoopBars(plan.bpm, beats);
  const parts: ScorePart[] = (Array.isArray(raw.parts) ? raw.parts : [])
    .filter((p) => p && p.name && Array.isArray(p.events))
    .map((p) => ({
      name: String(p.name),
      role: String(p.role ?? ""),
      instrumentCharacter: String(p.instrumentCharacter ?? ""),
      space: String(p.space ?? "close and dry"),
      register: String(p.register ?? ""),
      events: p.events
        .filter(
          (e) =>
            e &&
            Number.isFinite(e.bar) &&
            Number.isFinite(e.t) &&
            Number.isFinite(e.dur) &&
            e.pitch != null,
        )
        .map((e) => ({ ...e, t: snapT(e.t, beats) })),
      ...(p.repeat ? { repeat: String(p.repeat) } : {}),
    }))
    .filter((p) => p.events.length);
  return {
    ...raw,
    key: plan.key,
    tonic: raw.tonic || plan.key.split(/\s+/)[0],
    mode: raw.mode || "",
    tempoBpm: plan.bpm,
    meter: plan.timeSignature || "4/4",
    beatsPerBar: beats,
    loopBars: bars,
    form: raw.form || "",
    dynamicArc: raw.dynamicArc || "",
    harmony: {
      harmonicRhythm: raw.harmony?.harmonicRhythm || "",
      progression: Array.isArray(raw.harmony?.progression) ? raw.harmony.progression : [],
    },
    lowRegisterOwner: raw.lowRegisterOwner || parts[0]?.name || "",
    parts,
  };
}

/** STAGE 1 — construct the loop's music-theory score (per-layer event lists + one
 *  shared progression), WITHIN the track's fixed key/tempo/meter. */
export async function scoreLoop(
  args: {
    plan: SongPlan;
    target: PlanPart;
    /** Finished neighbours, so this loop's score can flow at the seams. */
    neighbours?: { label: string; side: "before" | "after" }[];
  },
  cfg?: ClaudeConfig,
): Promise<LoopScore> {
  const { plan, target, neighbours } = args;
  const beats = beatsPerBar(plan.timeSignature);
  if (mockEnabled(cfg?.mock)) return mockScore(plan, beats);
  const seams = (neighbours ?? [])
    .map((n) =>
      n.side === "after"
        ? `This loop FOLLOWS "${n.label}" — open by continuing its energy, then become its own thing.`
        : `This loop PRECEDES "${n.label}" — hold a comparable energy where they meet. The hand-off itself is composed separately: every bar here (the last included) plays on every repeat, so no one-way build into the next section.`,
    )
    .join("\n");
  const lines = [
    `genre: ${plan.genre || "(unspecified — infer a fitting one and stay consistent)"}`,
    `key: ${plan.key}`,
    `tempo: ${plan.bpm} BPM`,
    `meter: ${plan.timeSignature || "4/4"} (${beats} beats per bar)`,
    `this loop's role: ${target.label}`,
    `this loop's brief: ${target.intent}`,
    seams ? `\nSEAMS:\n${seams}` : "",
    `\nTarget loop length: about 20 seconds — choose loopBars (a power of 2) so loopBars * ${beats} * (60 / ${plan.bpm}) ≈ 20.`,
    `Echo the given key, tempo and meter in your output and compose the score within them.`,
  ].filter(Boolean);
  // GLM can occasionally return an unparseable or empty score (a transient hiccup,
  // or an answer that ran long). One such failure must NOT sink the whole
  // generation, so RETRY the score once before giving up (each attempt is ~70-85s
  // at minimal reasoning — well within the step wall even doubled).
  let raw: LoopScore | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    raw = parseJson<LoopScore>(
      await complete(SCORE_SYSTEM, lines.join("\n"), cfg, ROUTE.score),
    );
    if (raw && Array.isArray(raw.parts) && raw.parts.length) break;
    console.error(
      `[klappn] score-loop attempt ${attempt + 1} produced no usable score${
        attempt === 0 ? " — retrying" : ""
      }`,
    );
  }
  if (!raw || !Array.isArray(raw.parts) || !raw.parts.length)
    throw new Error("score-loop: model returned no usable score");
  return normalizeScore(raw, plan, beats);
}

/** STAGE 1b — REVISE an existing score per a change request (GLM, the idea tier).
 *  Every edit path edits the music HERE, at the score level; the translator (Kimi)
 *  then re-renders only the affected tracks. SAFE: returns the ORIGINAL score on
 *  any failure or in mock, so the caller simply keeps the current code. */
export async function editLoopScore(
  args: {
    plan: SongPlan;
    score: LoopScore;
    change: string;
    sectionLabel?: string;
    neighbours?: { label: string; side: "before" | "after" }[];
  },
  cfg?: ClaudeConfig,
): Promise<LoopScore> {
  const { plan, score, change, sectionLabel, neighbours } = args;
  const beats = beatsPerBar(plan.timeSignature);
  if (mockEnabled(cfg?.mock)) return score;
  const seams = (neighbours ?? [])
    .map((n) =>
      n.side === "after"
        ? `This section FOLLOWS "${n.label}" — keep its opening continuous with that.`
        : `This section PRECEDES "${n.label}" — keep their meeting energies comparable; every bar here repeats, so no one-way build into it.`,
    )
    .join("\n");
  const lines = [
    `genre: ${plan.genre || "(unspecified)"}`,
    `key: ${plan.key}, tempo: ${plan.bpm} BPM, meter: ${plan.timeSignature || "4/4"} (${beats} beats per bar)`,
    sectionLabel ? `section: ${sectionLabel}` : "",
    seams ? `\nSEAMS:\n${seams}` : "",
    ``,
    `CURRENT SCORE (JSON):`,
    JSON.stringify(score),
    ``,
    `CHANGE REQUEST: ${change}`,
  ].filter(Boolean);
  // Robust: retry so a transient parse/empty hiccup doesn't silently no-op the
  // edit (returning the unchanged score). On genuine failure we still keep it.
  const raw = await completeJson<LoopScore>(
    EDIT_SCORE_SYSTEM,
    lines.join("\n"),
    cfg,
    ROUTE.score,
    (j) => Array.isArray(j.parts) && j.parts.length > 0,
  );
  if (!raw || !Array.isArray(raw.parts) || !raw.parts.length) return score;
  return normalizeScore(raw, plan, beats);
}

/** STAGE 2 — assign each layer a REAL Strudel instrument / drum kit (validated
 *  against SOUND_MENU), then stamp deterministic mix routing (gain by role, a
 *  distinct orbit per non-dry part so reverbs never collide). */
export async function pickSounds(
  args: { score: LoopScore; genre?: string },
  cfg?: ClaudeConfig,
): Promise<SoundPick[]> {
  const { score, genre } = args;
  if (mockEnabled(cfg?.mock))
    return score.parts.map((p, i) => routePick(defaultPick(p), p, i));
  const lines = [
    `genre: ${genre || "(unspecified)"}`,
    `key: ${score.key}, tempo: ${score.tempoBpm} BPM, meter: ${score.meter}`,
    ``,
    `PARTS:`,
    ...score.parts.map(
      (p) =>
        `- ${p.name} — ${p.role} — ${p.instrumentCharacter} — space: ${p.space} — register: ${p.register}`,
    ),
  ];
  // Robust: retry so a transient failure doesn't drop the whole loop to generic
  // default sounds (sine / gm_epiano1) — a big part of why a loop "sounds bland".
  const parsed = await completeJson<{ parts: SoundPick[] }>(
    PICK_SOUND_SYSTEM,
    lines.join("\n"),
    cfg,
    ROUTE.pick,
    (j) => Array.isArray(j.parts) && j.parts.length > 0,
  );
  const picks = Array.isArray(parsed?.parts) ? parsed!.parts : [];
  return score.parts.map((p, i) => {
    const raw = picks.find((x) => x?.name === p.name) ?? picks[i];
    return routePick(sanitizePick(raw, p), p, i);
  });
}

/** Percussion part (→ a drum bank) or pitched part (→ an instrument)? Decide from the
 *  events (all percussion tokens) and the role/name. The trailing "s?" is load-bearing:
 *  a plain \bhat\b misses the PLURAL "Hats", which let a stray melodic pick survive on
 *  a hi-hat part. */
function isDrumPart(p: ScorePart): boolean {
  const DRUM =
    /\b(kicks?|snares?|claps?|rims?|hi-?hats?|hats?|rides?|crash(?:es)?|cymbals?|toms?|percs?|percussion|shakers?|congas?|bongos?|tambourines?|cowbells?|drums?|808|909)\b/i;
  const allPerc =
    p.events.length > 0 &&
    p.events.every((e) => typeof e.pitch === "string" && DRUM.test(e.pitch));
  return allPerc || DRUM.test(p.role) || DRUM.test(p.name);
}

function defaultPick(p: ScorePart): SoundPick {
  return isDrumPart(p)
    ? { name: p.name, bank: "RolandTR909" }
    : {
        name: p.name,
        sound: /bass|sub/i.test(`${p.role} ${p.name}`) ? "sine" : "gm_epiano1",
      };
}

/** Keep the model's pick only if it names a REAL sound; otherwise fall back. */
function sanitizePick(raw: SoundPick | undefined, p: ScorePart): SoundPick {
  if (isDrumPart(p)) {
    const bank = raw?.bank && DRUM_BANKS.has(raw.bank) ? raw.bank : "RolandTR909";
    return { name: p.name, bank };
  }
  const sound =
    raw?.sound && MELODIC_SOUNDS.has(raw.sound) ? raw.sound : defaultPick(p).sound;
  return { name: p.name, sound };
}

/** Deterministic mix routing: gain by role, and a UNIQUE orbit per non-dry part
 *  so two layers' reverb/delay settings never share a bus (the engine crackles
 *  when they differ on one orbit). Dry layers all share orbit 1. */
function routePick(pick: SoundPick, p: ScorePart, index: number): SoundPick {
  const role = `${p.role} ${p.name}`.toLowerCase();
  const gain = /kick|\bbass\b|sub/.test(role)
    ? 0.85
    : /snare|clap/.test(role)
      ? 0.7
      : /hat|ride|crash|shaker|tom|rim|perc|cymbal/.test(role)
        ? 0.5
        : /lead|melody|hook/.test(role)
          ? 0.6
          : /pad|chord|harmony|atmos|texture|string|key|piano|organ/.test(role)
            ? 0.45
            : 0.6;
  const dry = /close|dry/i.test(p.space);
  return { ...pick, gain, orbit: dry ? 1 : index + 2 };
}

/** STAGE 3 — render the WHOLE score (every part's event list + assigned sound +
 *  routing) into the complete loop: ONE "$:" line per part, all in a single call so
 *  the model writes them as a coherent MIX. `previous`+`feedback` drive the one
 *  repair retry (the whole loop is re-rendered). Returns the joined "$:" lines. */
export async function translateLoop(
  args: {
    score: LoopScore;
    picks: SoundPick[];
    previous?: string;
    feedback?: string;
  },
  cfg?: ClaudeConfig,
): Promise<string> {
  const { score, picks, previous, feedback } = args;
  if (mockEnabled(cfg?.mock)) return mockLoop(score, picks);
  const pickFor = (name: string, i: number): SoundPick =>
    picks.find((p) => p.name === name) ?? picks[i] ?? { name, sound: "sine", gain: 0.7, orbit: 1 };
  const ev = (e: ScoreEvent) =>
    `    {bar:${e.bar}, t:${e.t}, dur:${e.dur}, pitch:${
      Array.isArray(e.pitch) ? `[${e.pitch.join(",")}]` : e.pitch
    }, vel:${e.vel}, art:${e.art}}`;
  const frame = [
    `SHARED FRAME (every layer obeys it — together they ARE the loop):`,
    `tempo: ${score.tempoBpm} BPM, key: ${score.key}${score.mode ? ` ${score.mode}` : ""}, meter: ${score.meter}, beatsPerBar: ${score.beatsPerBar}, loopBars: ${score.loopBars}.`,
    `1 cycle = 1 bar = ${score.beatsPerBar} beats; the loop is ${score.loopBars} cycles (~${Math.round(
      (score.loopBars * score.beatsPerBar * 60) / score.tempoBpm,
    )}s). Each event names its bar (0..${score.loopBars - 1}) and within-bar t; join each part's bars with <...> so its "$:" spans all ${score.loopBars} cycles.`,
    `(setcpm(${score.tempoBpm}/${score.beatsPerBar}) is prepended upstream — do NOT write it.)`,
    score.harmony.progression.length
      ? `PROGRESSION (pitches come from THIS; bars 0-indexed): ${score.harmony.progression
          .map(
            (c) =>
              `${c.roman} ${c.chord} (bars ${c.bars}${
                Array.isArray(c.tones) && c.tones.length ? `, tones ${c.tones.join(" ")}` : ""
              })`,
          )
          .join(" | ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const partBlocks = score.parts
    .map((part, i) => {
      const pick = pickFor(part.name, i);
      return [
        `PART ${i + 1} — "${part.name}" (role: ${part.role})`,
        pick.bank
          ? `  assigned kit (bank): ${pick.bank} — hits available: ${(DRUM_BANK_SOUNDS[pick.bank] ?? []).join(" ")} (use ONLY these; substitute the closest if a role's letter is missing)`
          : `  assigned sound: ${pick.sound}`,
        `  character: ${part.instrumentCharacter} | space: ${part.space} | register: ${part.register}`,
        `  routing: gain ${pick.gain ?? 0.7}, orbit ${pick.orbit ?? 1}`,
        `  events:`,
        ...part.events.map(ev),
        part.repeat ? `  repeat: ${part.repeat}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const repair =
    previous && feedback
      ? `\n\nYOUR PREVIOUS RENDER (broken):\n${previous}\n\nFIX ALL OF THIS, then output the corrected full set of "$:" lines:\n${feedback}`
      : "";
  const user = `${frame}\n\nRENDER ALL ${score.parts.length} PARTS — one "$:" line each, in order:\n\n${partBlocks}${repair}\n\nOutput the ${score.parts.length} "$:" lines now — nothing else.`;
  const out = stripFences(await complete(TRANSLATE_SYSTEM, user, cfg, ROUTE.translate));
  if (!out) throw new Error("translate-loop: empty response");
  // Keep only the "$:" lines (the model may add stray prose around them).
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("$:"));
  if (!lines.length) throw new Error("translate-loop: no $: lines in response");
  return lines.join("\n");
}

// --- mocks for the new core (used when KLAPPN_MOCK_LLM is on) ----------------

function mockScore(plan: SongPlan, beats: number): LoopScore {
  const root = plan.key.split(/\s+/)[0];
  const bars = targetLoopBars(plan.bpm, beats);
  return {
    key: plan.key,
    tonic: root,
    mode: "",
    tempoBpm: plan.bpm,
    meter: plan.timeSignature || "4/4",
    beatsPerBar: beats,
    loopBars: bars,
    form: "mock loop",
    dynamicArc: "steady",
    harmony: {
      harmonicRhythm: "one chord for the whole loop",
      progression: [{ bars: `0-${bars - 1}`, roman: "i", chord: `${root}m`, tones: [root] }],
    },
    lowRegisterOwner: "bass",
    parts: [
      {
        name: "kick",
        role: "rhythm",
        instrumentCharacter: "tight kick",
        space: "close and dry",
        register: "low",
        events: [{ bar: 0, t: 0, dur: 0.25, pitch: "kick", vel: 1, art: "accent" }],
        repeat: `bars 1-${bars - 1} are identical to bar 0`,
      },
      {
        name: "bass",
        role: "bass",
        instrumentCharacter: "sine sub",
        space: "close and dry",
        register: "low",
        events: [{ bar: 0, t: 0, dur: 1, pitch: `${root}2`, vel: 0.8, art: "tenuto" }],
      },
    ],
  };
}

function mockLoop(score: LoopScore, picks: SoundPick[]): string {
  return score.parts
    .map((p, i) => {
      const pick = picks.find((x) => x.name === p.name) ?? picks[i] ?? { name: p.name };
      return pick.bank
        ? `$: s("bd*4").bank("${pick.bank}").gain(${pick.gain ?? 0.8})`
        : `$: note("${score.tonic.toLowerCase()}2").s("${pick.sound ?? "sine"}").gain(${pick.gain ?? 0.7})`;
    })
    .join("\n");
}

function stripFences(s: string): string {
  // Defensive: the prompts forbid fences, but strip them if a model adds them.
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/;
  const m = s.trim().match(fence);
  return (m ? m[1] : s).trim();
}

/** Robust JSON model call: up to `tries` attempts, returning the first parsed
 *  object that passes `ok`. Returns null if EVERY attempt fails (unparseable,
 *  empty content, transport error, or a rate-limit that outlasted complete()'s own
 *  retry) — so callers keep their existing safe fallback instead of silently
 *  degrading on a single transient hiccup. */
async function completeJson<T>(
  system: string,
  user: string,
  cfg: ClaudeConfig | undefined,
  route: CompleteOpts,
  ok: (j: T) => boolean,
  tries = 2,
): Promise<T | null> {
  let lastErr: unknown;
  let lastRaw = "";
  for (let i = 0; i < tries; i++) {
    try {
      lastRaw = await complete(system, user, cfg, route);
      const j = parseJson<T>(lastRaw);
      if (j && ok(j)) return j;
    } catch (e) {
      lastErr = e;
    }
  }
  // Log WHY we fall back (this is what silently produces "Untitled" defaults), tagged
  // with the model so a toggle-specific failure (e.g. GLM) is obvious in the logs: a
  // thrown error (empty reply / HTTP), or a reply that came back but didn't parse/validate.
  const tag = `model=${cfg?.model ?? "default"}`;
  if (lastErr) console.error(`[klappn] completeJson exhausted ${tries} tries (${tag}):`, lastErr);
  else
    console.error(
      `[klappn] completeJson exhausted ${tries} tries (${tag}): reply parsed/validated empty. Head: ${lastRaw.slice(0, 200)}`,
    );
  return null;
}

function parseJson<T>(s: string): T | null {
  const cleaned = stripFences(s);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-resort: grab the outermost {...} in case of stray prose.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
