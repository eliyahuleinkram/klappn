/**
 * compose-strudel.ts — the DIRECT-STRUDEL generation core (2026-07-01, the user; born on Sonnet 5, now Fable 5).
 *
 * The model writes Strudel DIRECTLY, one playable `$:` line at a time — no intermediate notation, no
 * compile step. `notation` holds the layer's STRUDEL body — what the model wrote IS what plays, so the
 * same string is carried forward as prior context AND is what edits rewrite (editStrudelLoop).
 *
 * (One-shot whole-loop generation was tried 2026-07-03 and reverted the same day — cheaper and
 * faster, but it sounded worse by ear than the per-layer walk. Git history has it.)
 *
 * Per layer:
 *   1. loopComplete — a CHEAP no-thinking check (STRUDEL_DONE_SYSTEM) BETWEEN layers (skipped below the
 *      thin-stack floor). If done → return null (stop).
 *   2. composeStagedStrudelLayer — WRITE the next `$:` line directly (STRUDEL_TRACK_SYSTEM, HIGH effort);
 *      it ALWAYS writes a layer + NAMES its own sound. We validate it as Strudel (validateStrudel) and
 *      read the instrument back from the line (instrumentOf). No instrument-pick call, no sound menu pick.
 *      ONE HIGH call per layer — the separate polish pass was removed 2026-07-01 (the user).
 *
 * The deeper play-time gate (lib/jobs.ts layerGateErrors) still runs on the merged line and re-rolls a
 * broken layer once — so this module's validation only needs to catch the clear, feedback-able mistakes
 * (bad sound/bank, syntax, a chord that collapses) and hand them back as retry text.
 *
 * (A TidalCycles path — the model writing Tidal, deterministically compiled to Strudel — preceded this
 * module and lived behind a STRUDEL_DIRECT switch; it was removed 2026-07-21. Git history has it.)
 */
import { complete, ROUTE, type LlmConfig } from './llm';
import {
  STRUDEL_TRACK_SYSTEM,
  STRUDEL_DONE_SYSTEM,
  EDIT_STRUDEL_SYSTEM,
  EDIT_STRUDEL_LAYER_SYSTEM,
  EDIT_STRUDEL_WHOLE_SYSTEM,
  METER_STRUDEL_SYSTEM,
  EDIT_STRUDEL_REPAIR_SYSTEM,
} from './strudel-track-spec';

/** A layer already placed in the loop, carried forward so each NEW layer reasons against the prior
 *  ones' musical intent (instrument + role + notation), not just their dense code. `notation` is the
 *  layer's Strudel body; `code` is the same line with the `$:` prefix. */
export interface PriorLayer {
  instrument: string;
  role: string;
  notation: string;
  code: string;
}

/** One freshly composed layer — the playable line plus the intent that produced it, so the caller can
 *  carry it forward as the next PriorLayer. */
export interface StagedLayer {
  code: string; // the Strudel "$:" line, ready to play
  instrument: string; // the sound/kit name the model wrote into the line
  role: string; // the kit voice (drums) or the sound (melodic)
  notation: string; // the layer's Strudel body (carried forward + edited)
}

/** Leaf words of a mini-notation string, minus rests/numbers/ops. */
const voiceTokens = (mini: string) => mini.match(/[A-Za-z_][\w]*/g) ?? [];

/**
 * Read the instrument the model wrote into the line — what it wrote IS the instrument (no pick, no
 * binding). A `.bank("…")` line is DRUMS: the bank is the instrument, the kit voices ride on `s`. Else
 * it's MELODIC: the sound on `.s("…")`. A note line with no sound plays the engine's default (triangle).
 */
export function instrumentOf(expr: string): { instrument: string; role: string; kind: 'sound' | 'bank' } {
  const bank = expr.match(/\.bank\("([^"]+)"\)/);
  if (bank) {
    const voice = [...expr.matchAll(/\bs(?:ound)?\("([^"]*)"\)/g)].flatMap((m) => voiceTokens(m[1]))[0];
    return { instrument: bank[1], role: voice ?? 'drums', kind: 'bank' };
  }
  const snd = expr.match(/\bs(?:ound)?\("([^"]+)"\)/);
  return snd
    ? { instrument: snd[1], role: snd[1], kind: 'sound' }
    : { instrument: 'triangle', role: 'triangle', kind: 'sound' };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Source functions a layer line legitimately starts from (a `$:` line must contain one). */
const SOURCE_RE = /\b(?:note|n|s|sound|chord|stack|seq|cat|arrange|run|silence)\s*\(/;

/** Strip a leading `$:` (and stray fence/backtick/angle wrappers) → the bare playable expression. */
function stripDollar(line: string): string {
  let body = line.replace(/```[a-z]*\n?/gi, '').trim();
  body = body.replace(/^\$:\s*/, '').trim();
  body = body.replace(/^`+/, '').replace(/`+$/, '').trim();
  if (body.startsWith('<') && body.endsWith('>')) body = body.slice(1, -1).trim();
  return body;
}

/** Pull the single layer expression out of a reply: prefer a `$:` line, else the first line that reads
 *  as a Strudel source expression. Returns the bare body (no `$:`). */
function extractStrudelLine(reply: string): string {
  const clean = reply.replace(/```[a-z]*\n?/gi, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const dollar = lines.find((l) => /^\$:/.test(l));
  if (dollar) return stripDollar(dollar);
  const src = lines.find((l) => SOURCE_RE.test(l) && !/^setcpm/.test(l));
  return src ? stripDollar(src) : stripDollar(lines[0] ?? clean);
}

/** True if the reply carries a usable layer line. No line → the model is signalling the loop is done
 *  (it replied DONE / prose instead of a layer). */
export function hasStrudelLine(reply: string): boolean {
  const clean = reply.replace(/```[a-z]*\n?/gi, '');
  return clean
    .split('\n')
    .map((l) => l.trim())
    .some((l) => (/^\$:/.test(l) && SOURCE_RE.test(l)) || (SOURCE_RE.test(l) && !/^setcpm/.test(l)));
}

/** Render the placed layers as the model's context — their Strudel (the `notation`, == the body of
 *  `code`), so the next layer locks to what's already there. */
function priorContext(prior: PriorLayer[]): string {
  return prior.length
    ? prior.map((p) => `$: ${p.notation || stripDollar(p.code)}`).join('\n')
    : '(none yet — you are the foundation)';
}

// ── validate ONE written line into a finished layer (shared by compose + the polish pass) ──

/**
 * Validate ONE extracted Strudel expression into a StagedLayer. Confirms it has a sound source, runs the
 * shared static validator (validateStrudel — sound/bank/chord/mini/arg checks; tempo is skipped since a
 * bare layer has no setcpm), and reads the model's own sound back (instrumentOf). Returns the finished
 * StagedLayer, or a `why` string the caller uses as retry feedback (compose) or a fall-back signal
 * (polish). `notation` is the Strudel body itself — carried forward + what edits rewrite.
 */
function buildStrudelLayer(body: string): { layer: StagedLayer } | { why: string } {
  const expr = body.trim();
  if (!expr) return { why: 'empty line' };
  if (!SOURCE_RE.test(expr))
    return { why: 'no sound source — start with s("…"), note("…"), n("…").scale(…) or chord("…").voicing()' };
  // No static validation (the user's doctrine): the engine's real headless COMPILE (layerGateErrors →
  // strudelBuildErrors) is the only server gate, and the browser's console self-heal covers the rest.
  const { instrument, role } = instrumentOf(expr);
  return { layer: { code: `$: ${expr}`, instrument, role, notation: expr } };
}

// ── between layers: a cheap (no-thinking) "are we done?" check ────────────────
// LIVE (the one-shot experiment was reverted 2026-07-03): runs before every
// non-insisted layer. The add-one-layer edit op passes insist=true and skips it.

/** Parse the done-check reply: DONE = stop building, anything else (MORE / ambiguous) = keep going. */
export function saysDone(reply: string): boolean {
  return /\bdone\b/i.test(reply) && !/\bmore\b/i.test(reply);
}

/** With the parts placed, a CHEAP no-thinking call decides if the loop is complete — so the expensive
 *  HIGH compose call stays focused purely on WRITING the next layer. Run BETWEEN layers; the engine skips
 *  it below the thin-stack floor. Runs on SONNET 5, thinking off (2026-07-22, the user — same rule as the
 *  enrich naming calls: a thinking-off call needs no Fable). */
async function loopComplete(brief: string, prior: PriorLayer[], cfg?: LlmConfig): Promise<boolean> {
  const user = `The loop so far (each layer's Strudel):\n${priorContext(prior)}\n\nIs this loop complete, or does it still need a part?`;
  const reply = await complete(STRUDEL_DONE_SYSTEM, user, { ...cfg, model: 'sonnet' }, { ...ROUTE.pick, thinking: false, cacheStable: `Brief: ${brief}\n\n`, trace: { kind: 'done' } });
  return saysDone(reply);
}

// ── compose ONE layer: write its Strudel directly → validate → the layer ──

/**
 * The per-layer core: WRITE the next layer's Strudel directly (STRUDEL_TRACK_SYSTEM, HIGH effort) — it
 * decides what the loop needs AND names its own sound — then validate, read the instrument back, and retry
 * with feedback on a clear error. On a clean line it returns that StagedLayer (`notation` = the Strudel
 * body, carried forward + edited; `code` = the playable `$:` line). null = the loop is complete (the model
 * wrote no line) / failed to validate after retries. `insist` is the engine's thin-stack floor: don't stop
 * yet. ONE HIGH call per layer — the separate polish pass was removed 2026-07-01 (the user).
 */
export async function composeStagedStrudelLayer(
  brief: string,
  prior: PriorLayer[],
  cfg?: LlmConfig,
  insist = false,
): Promise<StagedLayer | null> {
  if (!insist && (await loopComplete(brief, prior, cfg))) return null;
  const system = STRUDEL_TRACK_SYSTEM;
  // The brief is the STABLE prefix across the whole loop's layer calls — it
  // rides as cacheStable so every layer/retry hits [system + brief] in the
  // prompt cache while the prior-tracks tail below grows call to call.
  const stable = `Brief: ${brief}\n\n`;
  let user =
    `TRACKS ALREADY PLACED (their Strudel — lock to them):\n${priorContext(prior)}\n\n` +
    `Write the next $: line now (name its sound in the line) — the part the loop most needs next.`;
  for (let attempt = 0; attempt < 3; attempt++) {
    // HIGH thinking for the Strudel MUSIC composition (the user's explicit ask). It ALWAYS writes a
    // layer (the "are we done?" decision lives in loopComplete, above). ONE call — no polish pass.
    const reply = (await complete(system, user, cfg, { ...ROUTE.compose, effort: 'high', cacheStable: stable, trace: { kind: 'compose', attempt } })).trim();
    if (!hasStrudelLine(reply)) { user += `\n\nWrite the $: line itself — one raw Strudel line, no prose.`; continue; }
    const built = buildStrudelLayer(extractStrudelLine(reply));
    if ('layer' in built) return built.layer; // valid line → ship it
    user += `\n\nThat line did not work: ${built.why}\nResend ONE corrected $: line.`;
  }
  return null; // couldn't produce a valid line after retries — the engine re-rolls below the floor, else stops
}

// ── edit: rewrite the loop's Strudel in one call (parallel of editTidalLoop) ──

/**
 * Edit a loop in Strudel: given each layer's Strudel (the `notation`) + label + a change, return EVERY
 * layer's edited Strudel body (SAME count + order) so the caller swaps them in 1:1. Returns null when the
 * model drops/adds a line (shape change) so the caller keeps the original loop. HIGH effort.
 */
export async function editStrudelLoop(
  layers: { label: string; notation: string }[],
  brief: string,
  change: string,
  cfg?: LlmConfig,
): Promise<string[] | null> {
  if (!layers.length) return null;
  const labels = layers.map((l, i) => `line ${i + 1}=${l.label || `layer ${i + 1}`}`).join(', ');
  const loop = layers.map((l) => `$: ${l.notation}`).join('\n');
  const user = `Brief: ${brief}\n\nThe loop in Strudel (${labels}):\n${loop}\n\nCHANGE TO APPLY: ${change}`;
  const reply = (await complete(EDIT_STRUDEL_SYSTEM, user, cfg, { ...ROUTE.compose, trace: { kind: 'edit' } })).trim();
  const lines = reply
    .replace(/```[a-z]*\n?/gi, '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\$:/.test(s));
  if (lines.length !== layers.length) return null; // shape changed → caller keeps the original loop
  return lines.map(stripDollar);
}

/**
 * THE DIRECT EDIT (2026-07-03, the user): ONE call, code in → code out. The model sees the whole loop
 * (labelled `$:` lines), the song-aware brief and the request, and returns the COMPLETE revised loop —
 * free shape: it may rewrite, add or remove layers (unlike editStrudelLoop, a count change here is the
 * point, not a failure). Untouched layers come back byte-identical (the caller reconciles by exact
 * match). When `sectionBrief` (the card's description) is given, the SAME call also returns it revised
 * to match the new music — word-for-word when the edit didn't invalidate it, so unchanged briefs stay
 * byte-identical and the caller can skip the write. Fable 5, effort HIGH.
 */
export async function editStrudelWholeLoop(
  layers: { label: string; body: string }[],
  brief: string,
  change: string,
  cfg?: LlmConfig,
  sectionBrief?: string,
  /** The track's current direction note (plan.direction) — offering it invites
   *  the SAME call to return a `DIRECTION:` rewrite when the change steers the
   *  whole track (the song-README update rides the edit, no extra call). */
  directionNote?: string | null,
): Promise<{ bodies: string[]; brief?: string; direction?: string } | null> {
  if (!layers.length) return null;
  const labels = layers.map((l, i) => `line ${i + 1}=${l.label || `layer ${i + 1}`}`).join(', ');
  const loop = layers.map((l) => `$: ${l.body}`).join('\n');
  const user =
    `Brief: ${brief}\n\nThe loop in Strudel (${labels}):\n${loop}\n\n` +
    (sectionBrief ? `THIS SECTION'S BRIEF: ${sectionBrief}\n\n` : '') +
    `THE TRACK'S DIRECTION NOTE: ${(directionNote ?? '').trim() || '(none yet)'}\n\n` +
    `CHANGE TO APPLY: ${change}`;
  const reply = (
    await complete(EDIT_STRUDEL_WHOLE_SYSTEM, user, cfg, { ...ROUTE.compose, effort: 'high', trace: { kind: 'edit' } })
  ).trim();
  const rows = reply
    .replace(/```[a-z]*\n?/gi, '')
    .split('\n')
    .map((s) => s.trim());
  const lines = rows.filter((s) => /^\$:/.test(s));
  const revised = rows
    .filter((s) => /^BRIEF:/i.test(s))
    .pop()
    ?.replace(/^BRIEF:\s*/i, '')
    .trim();
  const direction = rows
    .filter((s) => /^DIRECTION:/i.test(s))
    .pop()
    ?.replace(/^DIRECTION:\s*/i, '')
    .trim();
  return lines.length
    ? { bodies: lines.map(stripDollar), brief: revised || undefined, direction: direction || undefined }
    : null;
}

/**
 * Edit ONE layer with the WHOLE loop in view: the model sees every layer (numbered, labelled) so the
 * rewritten line stays locked to its siblings — but outputs ONLY the target line (small, fast). Returns
 * the edited body, or null when nothing usable came back. HIGH effort (it's real music work).
 */
export async function editStrudelLayer(
  layers: { label: string; notation: string }[],
  targetIndex: number,
  brief: string,
  change: string,
  cfg?: LlmConfig,
): Promise<string | null> {
  const target = layers[targetIndex];
  if (!target) return null;
  const loop = layers
    .map((l, i) => `${i + 1}. ${l.label || `layer ${i + 1}`}: $: ${l.notation}`)
    .join('\n');
  const user =
    `Brief: ${brief}\n\nThe loop (numbered layers):\n${loop}\n\n` +
    `CHANGE LAYER ${targetIndex + 1} (${target.label || `layer ${targetIndex + 1}`}): ${change}`;
  const reply = (await complete(EDIT_STRUDEL_LAYER_SYSTEM, user, cfg, { ...ROUTE.compose, trace: { kind: 'edit' } })).trim();
  if (!hasStrudelLine(reply)) return null;
  const body = extractStrudelLine(reply);
  return body || null;
}

/**
 * Re-bar a loop into a NEW time signature: rewrite every layer's Strudel into the new beats-per-bar
 * (METER_STRUDEL_SYSTEM). Returns EVERY layer's re-barred Strudel body (SAME count + order) so the caller
 * swaps them in 1:1; null when the model drops/adds a line.
 */
export async function convertStrudelMeter(
  layers: { label: string; notation: string }[],
  fromTs: string,
  toTs: string,
  toBeats: number,
  cfg?: LlmConfig,
): Promise<string[] | null> {
  if (!layers.length) return null;
  const labels = layers.map((l, i) => `line ${i + 1}=${l.label || `layer ${i + 1}`}`).join(', ');
  const loop = layers.map((l) => `$: ${l.notation}`).join('\n');
  const user = `The loop in Strudel (${labels}):\n${loop}\n\nRE-BAR from ${fromTs} to ${toTs} — every cycle is now ${toBeats} beats (one bar of ${toTs}).`;
  const reply = (await complete(METER_STRUDEL_SYSTEM, user, cfg, { ...ROUTE.compose, trace: { kind: 'meter' } })).trim();
  const lines = reply
    .replace(/```[a-z]*\n?/gi, '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\$:/.test(s));
  if (lines.length !== layers.length) return null; // shape changed → caller keeps the original loop
  return lines.map(stripDollar);
}

// ── repair: fix a loop that threw a runtime error in the browser (auto self-heal) ──

/**
 * Repair a loop that errored at playback in the browser: given the loop's Strudel + the exact console
 * error, fix ONLY what's broken (EDIT_STRUDEL_REPAIR_SYSTEM, HIGH effort) and return the corrected `$:`
 * line bodies (the caller re-validates + swaps them in). null when the model returns nothing usable.
 * `frame` is just the key/tempo/meter for musical context.
 */
export async function repairStrudelLoop(
  code: string,
  consoleError: string,
  frame: { bpm: number; key: string; timeSignature: string },
  cfg?: LlmConfig,
): Promise<string[] | null> {
  const music = code.trim();
  if (!music) return null;
  const system = EDIT_STRUDEL_REPAIR_SYSTEM;
  const user =
    `Frame: key ${frame.key}, ${frame.bpm} BPM, ${frame.timeSignature}.\n\n` +
    `THE LOOP (Strudel) that errored at playback:\n${music}\n\n` +
    `THE BROWSER CONSOLE ERROR:\n${consoleError.slice(0, 800)}\n\n` +
    `Return the corrected loop — one $: line per layer, fixing ONLY what the error is about.`;
  const reply = (await complete(system, user, cfg, { ...ROUTE.compose, effort: 'high', trace: { kind: 'repair' } })).trim();
  const lines = reply
    .replace(/```[a-z]*\n?/gi, '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\$:/.test(s));
  if (!lines.length) return null;
  return lines.map(stripDollar);
}
