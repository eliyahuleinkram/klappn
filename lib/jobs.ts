import type { Sql } from "postgres";
import { db } from "./db";
import {
  type ArrangementItem,
  type ClaudeConfig,
  type GeneratedPartRef,
  type PlanPart,
  convertPartMeter,
  deriveWorkspaceFromLoop,
  editLoopScore,
  editPart,
  editSong,
  enrichTrack,
  generateHydra,
  repairHydra,
  composeLayerStaged,
  type PriorLayer,
  labelControls,
  parameterizePart,
  pickSounds,
  suggestLooks,
  suggestSounds,
  translateLoop,
} from "./anthropic";
import type { LoopScore, LoopTrack, SoundPick, TrackControl } from "./score";
import { editStrudelLoop, editStrudelWholeLoop, convertStrudelMeter, repairStrudelLoop } from "./compose-strudel";
import type { StagedLayer } from "./compose-strudel";
import { parameterize } from "./parameterize";
import { assignReverbOrbits, wireSidechain } from "./reverb-orbits";
import {
  loopCycles,
  unknownStrudelMethods,
  unplayableNoteLayers,
  strudelBuildErrors,
  strudelServerErrors,
} from "./strudel-interp";
import { beatsPerBar, clampAudioParams } from "./playback";
import {
  attachHydraBlock,
  attachVisualBlocks,
  extractHydra,
  hasHydra,
  stripHydraBlock,
  type SongVisual,
} from "./hydra-embed";
import { hydraServerErrors } from "./hydra-eval";
import { flagIssue } from "./issues";
import {
  bakeControlDefaults,
  carryControlValues,
  parameterizeVisuals,
  parseEdits,
  setLayerInstrument,
  setLayerMethodArg,
  stripMetaBlocks,
  stripVisualGrade,
} from "./controls";
import {
  appendSongEffects,
  getPartsOrdered,
  injectPart,
  replaceSongEffects,
  replaceSongOverlays,
  saveSongArrangement,
  saveSongDirection,
  saveSongSectionSpec,
  saveSongVisual,
  setSongSectionSweeps,
  syncSectionSpecLayers,
  saveVariantSnapshot,
  rebasePartStrudel,
  rebasePartComposition,
  setPartEditChoice,
  setPartMessage,
  setPartStatus,
  setPartStrudelOwned,
  setSongStatus,
  snapshotPartOriginal,
  writePartComposition,
  writePartProgress,
  writePartStrudel,
  type BreakSet,
  type PartRow,
  type PartStatus,
  type SongRow,
} from "./songs";
import type { SongPlan } from "./anthropic";
import { DEFAULT_MODEL } from "./models";
import type { ModelId } from "./models";
import {
  composeNextChapter,
  composeSongArrangement,
  composeNextUnfoldFx,
  composePageShape,
  enrichSweepControls,
} from "./arrange-plan";
import { sentenceLabel } from "./labels";
import type { SectionArrange, SectionSweep, SectionTake, SongArrangement, SongFx } from "./arrange";
import { computeLoopBars } from "./loop-length";
import { breakMoveOf, type BreakOverlay } from "./breaks-catalog";

// --- composing a loop -------------------------------------------------------
// PIPELINE: construct an explicit music-theory SCORE (per-layer event lists +
// one shared progression) → PICK a real instrument / drum kit per layer → in
// parallel, TRANSLATE each layer's events into one Strudel "$:" line → MERGE.
// The deterministic gates (parse / tempo / real sounds / no object-notes) run on
// each layer with ONE guided repair; no LLM jury. Each model call is its own
// durable step. All on Opus 4.8.

/**
 * Wraps one unit of long work. In the Workflow this is `step.do(...)` so EACH
 * model call becomes its own durable step — critical because a single Cloudflare
 * Workflow step is killed at ~5 min wall-time, and the whole refine loop (several
 * slow pro-model calls) blows past that. As separate steps, each call (~1-3 min)
 * is comfortably under the cap AND is checkpointed/resumable. In local dev it's
 * just an inline pass-through.
 */
export type StepRunner = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
export const inlineRunner: StepRunner = (_name, fn) => fn();

/** Best-effort sink for the live "what's happening now" line: the Workflow writes
 *  it to the composing part's row (the client polls it); dev writes it inline. */
export type Report = (message: string) => Promise<void> | void;

/** What composePart returns: the merged Strudel code (the playable loop) plus the
 *  per-track breakdown the layer engine produced (each "$:" line + its tweak panel),
 *  persisted by the caller. `score`/`sounds` are legacy (null on the layer engine,
 *  still set by the score-based edit paths). */
interface ComposedLoop {
  code: string;
  score: LoopScore | null;
  sounds: SoundPick[] | null;
  /** The ordered tracks (layer engine) — null on the legacy score path. */
  tracks: LoopTrack[] | null;
}

/**
 * The score → code CORE, shared by compose AND every edit path: pick the
 * instruments for a (possibly edited) score, translate EVERY layer track-by-track
 * (parallel, each its own step, gated with one guided repair), then merge +
 * deconflict. Kimi therefore only ever sees ONE track at a time, always downstream
 * of a score + instrument pick — the house invariant. `sounds` is reused when it
 * already covers every part (so a note/arrangement edit keeps its instruments);
 * otherwise the picker runs. Returns the merged, crackle-deconflicted Strudel
 * (pre-finalize) plus the picks used — the caller does its own finalize.
 */

// ── EXACT ONSET-GRID VERIFIER ───────────────────────────────────────────────
// Strudel timing is exact rationals (Fraction.js — no float drift), so "off the
// beat" never means imprecision; it means a note landed on the WRONG grid fraction
// (a bar split into 15 not 16, or a nested subgroup placing a note on 1/9). This
// computes the EXACT onset fraction of every note in a layer and flags any whose
// denominator doesn't divide 48 = lcm(16,3) — i.e. anything off the shared 16th /
// triplet grid. It descends through *, /, !, @, (p,k), [..], <..>, {..} and commas,
// so it catches nested + compound cases a slot-counter cannot. Verified against the
// full live arrangement (incl. triplet-flams and @-weighted phrases): zero false flags.
type Frac = [number, number];
const ogGcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
};
const ogFr = (n: number, d: number): Frac => {
  if (d < 0) { n = -n; d = -d; }
  const g = ogGcd(n, d);
  return [n / g, d / g];
};
const ogAdd = (a: Frac, b: Frac): Frac => ogFr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const ogMul = (a: Frac, b: Frac): Frac => ogFr(a[0] * b[0], a[1] * b[1]);

/** Split a mini-notation string on TOP-LEVEL whitespace (nesting-aware). */
function ogSplitWS(s: string): string[] {
  const o: string[] = [];
  let d = 0, c = "";
  for (const ch of s) {
    if (ch === "[" || ch === "<" || ch === "(" || ch === "{") d++;
    else if (ch === "]" || ch === ">" || ch === ")" || ch === "}") d--;
    if (/\s/.test(ch) && d <= 0) { if (c) o.push(c); c = ""; } else c += ch;
  }
  if (c) o.push(c);
  return o;
}
/** Split on TOP-LEVEL commas — a stack of parallel sub-patterns, each filling the span. */
function ogSplitComma(s: string): string[] {
  const o: string[] = [];
  let d = 0, c = "";
  for (const ch of s) {
    if (ch === "[" || ch === "<" || ch === "(" || ch === "{") d++;
    else if (ch === "]" || ch === ">" || ch === ")" || ch === "}") d--;
    if (ch === "," && d <= 0) { o.push(c); c = ""; } else c += ch;
  }
  o.push(c);
  return o;
}
function ogEuclid(p: number, k: number): boolean[] {
  if (p <= 0) return new Array(k).fill(false);
  if (p >= k) return new Array(k).fill(true);
  const out: boolean[] = [];
  let b = 0;
  for (let i = 0; i < k; i++) { b += p; if (b >= k) { b -= k; out.push(true); } else out.push(false); }
  return out;
}
/** Onsets of a SEQUENCE (whitespace items; !n replicate, @n weight) over [start, start+span). */
function ogSeq(str: string, start: Frac, span: Frac, out: Frac[]): void {
  str = str.trim();
  if (!str) return;
  const parts = ogSplitComma(str);
  if (parts.length > 1) { for (const p of parts) ogSeq(p.trim(), start, span, out); return; }
  const items: string[] = [];
  for (const it of ogSplitWS(str)) {
    const m = it.match(/^(.*)!(\d+)$/);
    if (m) for (let k = 0; k < +m[2]; k++) items.push(m[1]);
    else items.push(it);
  }
  const w = items.map((it) => { const m = it.match(/@([\d.]+)$/); return m ? parseFloat(m[1]) : 1; });
  const W = w.reduce((a, b) => a + b, 0) || 1;
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i].replace(/@[\d.]+$/, "");
    ogItem(it, ogAdd(start, ogMul(span, ogFr(cum, W))), ogMul(span, ogFr(w[i], W)), out);
    cum += w[i];
  }
}
/** Onsets of ONE item over its span (handles *n, /n, (p,k), [..], <..>, {..}, or a note). */
function ogItem(it: string, start: Frac, span: Frac, out: Frac[]): void {
  it = it.trim();
  if (!it || it === "~" || it === "-") return;
  let m = it.match(/^(.*)\*(\d+)$/);
  if (m) { const n = +m[2]; for (let k = 0; k < n; k++) ogItem(m[1], ogAdd(start, ogMul(span, ogFr(k, n))), ogMul(span, ogFr(1, n)), out); return; }
  m = it.match(/^(.*)\/(\d+)$/);
  if (m) { ogItem(m[1], start, span, out); return; }
  m = it.match(/^(.*)\((\d+),(\d+)(?:,(\d+))?\)$/);
  if (m) { const p = +m[2], k = +m[3]; const h = ogEuclid(p, k); for (let j = 0; j < k; j++) if (h[j]) ogItem(m[1] || "x", ogAdd(start, ogMul(span, ogFr(j, k))), ogMul(span, ogFr(1, k)), out); return; }
  if (it.startsWith("[") && it.endsWith("]")) { ogSeq(it.slice(1, -1), start, span, out); return; }
  if (it.startsWith("<") && it.endsWith(">")) { for (const b of ogSplitWS(it.slice(1, -1))) ogItem(b, start, span, out); return; }
  if (it.startsWith("{")) { ogSeq(it.replace(/^\{|\}(%\d+)?$/g, ""), start, span, out); return; }
  out.push(start); // a single event (note / drum / number / chord-stack) strikes here
}

// offGridBars — the on-grid / uniform-length DRIFT gate — was REMOVED (2026-06-21).
// It was a guardrail for the old weak models; Opus is on-grid and self-aligns natively
// (the prompt still says straight & in-key). Its onset helpers above are now unused/inert.

/** FREE deterministic auto-fixes for the two mechanical slips the render occasionally
 *  makes — applied in code so we never spend a model "repair" call on them:
 *  1. A value pattern (gain/clip/vel/lpf…) writing "0.1*10" means SUBDIVIDE a slot 10×
 *     (→ off-grid 1/30 positions); the intent is REPLICATE → "0.1!10". `*` is only valid
 *     inside the NOTE pattern (hh*16), so we only touch the numeric-control args.
 *  2. A raw `delaytime(0.1875)` is SECONDS, off-tempo; snap it to a dotted-8th at this bpm
 *     so the echoes land on the grid (an expression like (60/bpm)*0.75 carries no bare
 *     number and is left alone). */
/** Remove a trailing `// …` line comment, respecting quotes (a `//` inside a mini-notation
 *  string is pattern text, not a comment). Returns the line unchanged when there is none. */
function stripLineComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "/" && line[i + 1] === "/") return line.slice(0, i).trimEnd();
  }
  return line;
}

function autoFixRender(line: string, bpm: number): string {
  // STRIP any trailing line comment (quote-aware). The composer sometimes labels a line with
  // `// name` — and every method we append later (the Volume `.postgain`, mute/solo `.gain(0)`,
  // `.orbit(N)`) lands AFTER that comment, inside it, silently dead. A real prod bug: a kick's
  // volume knob at 2× sat in the comment moving nothing. Comments are inert — nothing is lost.
  let s = stripLineComment(line);
  s = s.replace(
    /\.(gain|velocity|clip|lpf|hpf|lpq|bpf|pan|room|roomsize|shape|crush|coarse)\(\s*"([^"]*)"\s*\)/g,
    (_m, ctrl: string, pat: string) =>
      `.${ctrl}("${pat.replace(/([\d.]+)\*(\d+)/g, "$1!$2")}")`,
  );
  const beat = 60 / bpm;
  s = s.replace(/\.delaytime\(\s*([\d.]+)\s*\)/g, (m, num: string) => {
    const beats = parseFloat(num) / beat;
    const onGrid = (step: number) =>
      Math.abs(beats / step - Math.round(beats / step)) < 0.01;
    return beats > 0 && !onGrid(0.25) && !onGrid(1 / 3)
      ? `.delaytime(${(beat * 0.75).toFixed(4)})`
      : m;
  });
  // REGISTER FLOOR: octave-0 pitches (a0 ≈ 27 Hz, c0 ≈ 16 Hz) are sub-audible mud —
  // bump any note name + "0" up to octave 1. (Bare numbers / params never match the
  // letter-then-0 shape, so this only touches real pitch tokens.)
  s = s.replace(/\b([a-gA-G](?:#|b|s|f)?)0\b/g, "$11");
  // Clamp every audio param into its valid range (pan 0–1, etc.) so generated +
  // stored code is in-range, not just at play time.
  return clampAudioParams(s);
}

// ── LAYER-BY-LAYER ENGINE ─────────────────────────────────────────────────────
// The doc-free pipeline that replaces score→pick→render: build the loop one "$:"
// line at a time (each call sees the layers so far) until the model returns empty,
// enriching every layer with its own tweak panel the moment it lands. The same
// deterministic gate as before is the safety net — but now per layer, and since
// each line is cheap a failed one is regenerated once, then skipped.

/** The deterministic correctness gate for ONE "$:" line: parse / real methods /
 *  playable notes / build-crash / bank samples / on-grid onsets / delay tempo-sync.
 *  Returns the list of problems ([] = clean). The model never sees Strudel docs, so
 *  this code IS the spec check. */
async function layerGateErrors(
  line: string,
  bpm: number,
  beats: number,
  timeSignature: string,
): Promise<string[]> {
  // THE SERVER-SIDE EVAL EQUIVALENT (2026-07-02, the user: too many errors were reaching the
  // browser — catch them here): the real headless BUILD plus the browser-resolution checks
  // (sounds/banks that load nothing, mini grammar, silent chords, NaN args). What passes here
  // plays there; the browser self-heal remains the net for what only a real browser can see.
  return strudelServerErrors(`setcpm(${bpm}/${beats})\n${line}`, { bpm, timeSignature });
}

/** Build the playable Strudel from an ordered list of tracks: one setcpm + every track's "$:" line, then
 *  the deterministic crackle guard (distinct orbits per effect bus) and .duck() target repair. */
export function mergeTracks(tracks: LoopTrack[], bpm: number, beats: number): string {
  // Keep EVERY track's line so a track's index ALWAYS equals its "$:" line index —
  // stable for per-track edits even with mutes. A muted track is silenced in place
  // with a trailing .gain(0) (last gain wins), never dropped (which would shift
  // every later track's line and make its knobs edit the wrong layer).
  const lines = tracks.map((t) => (t.muted ? `${t.code}.gain(0)` : t.code));
  const merged = `setcpm(${bpm}/${beats})\n${lines.join("\n")}`;
  return wireSidechain(assignReverbOrbits(merged));
}

/** Re-merge the tracks into playable code, PRESERVING the part's song-level visual. The @hydra
 *  sketch + @vcontrols grade live ONLY in the merged strudel, NEVER in `tracks` — so a bare
 *  mergeTracks() would STRIP the visual on every per-track edit (mute / delete / knob / preset /
 *  swap / add / apply-to-all), leaving that loop "unpainted". Carry it over from prevStrudel. */
function mergeTracksKeepVisual(
  tracks: LoopTrack[],
  bpm: number,
  beats: number,
  prevStrudel: string | null | undefined,
): string {
  let code = mergeTracks(tracks, bpm, beats);
  const hydra = prevStrudel ? extractHydra(prevStrudel) : null;
  if (hydra) {
    code = attachHydraBlock(code, hydra);
    // Carry the visual's UI metadata across the edit: the grade spec AND its one-tap looks.
    const vc = prevStrudel!.match(/\/\*\s*@vcontrols\b[\s\S]*?\*\//);
    if (vc) code = code.replace("/* @hydra", `${vc[0]}\n\n/* @hydra`);
    const vl = prevStrudel!.match(/\/\*\s*@vlooks\b[\s\S]*?\*\//);
    if (vl) code = code.replace("/* @hydra", `${vl[0]}\n\n/* @hydra`);
  }
  return code;
}

/** The engine: generate the loop layer by layer from a plain-language BRIEF (no
 *  score, no API docs). Each iteration adds one gated "$:" line + its tweak panel,
 *  streaming it through `onTrack` so the UI can show tracks as they land; stops
 *  when the model returns empty (the done signal) or the safety cap is hit.
 *  (LIVE again since the 2026-07-03 one-shot revert — the user preferred its sound.) */
export async function composeLoopByLayers(
  brief: string,
  bpm: number,
  beats: number,
  timeSignature: string,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner,
  stepKey: string,
  onTrack?: (track: LoopTrack, all: LoopTrack[]) => Promise<void>,
  /** The insist floor — the caller sets it by KIND: a real loop is the unfold's
   *  palette and wants a full one; a break/bridge is a deliberate thinning. */
  minLayers = 8,
): Promise<{ tracks: LoopTrack[]; code: string }> {
  const MAX_LAYERS = 16; // safety cap — the empty-reply stop signal normally ends it first
  const MIN_LAYERS = minLayers; // floor: the loop is the unfold's PALETTE. 3→6→8 (2026-07-14):
  // headroom comes from the UNFOLD now (layers enter and leave across the span), so composing
  // thin just starves the arrangement of material — a 6-voice techno drop (song 46498b1a) still
  // read EMPTY by ear. Sparseness is the arrangement's job, not the loop's. Above the floor the
  // DONE call decides; it still stops the moment the next layer would just DOUBLE a voice.
  const tracks: LoopTrack[] = [];
  // Each placed layer's musical INTENT (instrument + role + the notation behind it) + its final
  // code, carried forward so the NEXT layer is composed against what the others MEAN musically,
  // not just their dense Strudel. In-memory only (notation isn't persisted on tracks).
  const prior: PriorLayer[] = [];
  // The per-layer compose error is otherwise swallowed by the `.catch(() => null)` below
  // (null doubles as the legit "loop done" signal). Capture it so a TOTAL wipe surfaces the
  // real cause in the thrown message — e.g. a GLM high-effort "returned no text".
  let lastLayerErr: unknown;
  for (let i = 0; i < MAX_LAYERS; i++) {
    // While the stack is still thin, INSIST on more (don't accept an early "done");
    // once it's full, a normal "add or stop" — so we never force filler past that.
    const insist = tracks.length < MIN_LAYERS;
    const gen = () => composeLayerStaged(brief, prior, cfg, insist);
    let staged = await runStep(`layer-${i + 1}-${stepKey}`, gen).catch((e) => {
      lastLayerErr = e;
      return null;
    });
    // null = the loop is genuinely done — UNLESS we're still insisting (below MIN_LAYERS), where
    // it's almost always a model hiccup (a parse/transcribe slip, a timeout, or — on GLM/Kimi — a
    // budget-exhausted "returned no text"), NOT a real "done". One flaky call must not end the
    // loop below the floor, so re-roll up to 3× before giving up.
    for (let r = 0; !staged && insist && r < 3; r++)
      staged = await runStep(`layer-${i + 1}r${r}-${stepKey}`, gen).catch((e) => {
        lastLayerErr = e;
        return null;
      });
    if (!staged) break;

    // Deterministic cleanup (audio-param clamps, octave floor, delay tempo-sync).
    let line = autoFixRender(staged.code, bpm);
    // The staged path ends in a SEPARATE transcription call, so a layer can occasionally render
    // unplayable Strudel. One gated retry (regenerate the whole staged layer) so a broken line
    // never crashes the loop — the old one-hit engine wrote valid Strudel directly and skipped this.
    const gateErrs = await layerGateErrors(line, bpm, beats, timeSignature);
    if (gateErrs.length) {
      const retry = await runStep(`layer-${i + 1}b-${stepKey}`, gen).catch((e) => {
        lastLayerErr = e;
        return null;
      });
      const retryLine = retry ? autoFixRender(retry.code, bpm) : "";
      const retryErrs =
        retry && retryLine ? await layerGateErrors(retryLine, bpm, beats, timeSignature) : ["no retry"];
      if (retryErrs.length === 0) {
        line = retryLine;
        staged = retry!; // carry the RETRY's intent forward (it's the layer that shipped)
      } else {
        // NEVER ship a layer that fails the gate (it used to fall through and crash in the
        // browser) — drop it, flag it, keep composing the rest of the loop.
        await flagIssue(
          "compose-layer-gate",
          `dropped layer after retry [${stepKey}]: ${gateErrs.join("; ")} | retry: ${retryErrs.join("; ")} :: ${line.slice(0, 160)}`,
        );
        continue;
      }
    }

    // PANELS ARE LAZY (2026-07-13, the user): no enrich call here — a layer's knobs/pills/
    // instrument swaps are generated the FIRST time its card is opened (the "track-enrich"
    // op → enrichPartLayer), so a layer nobody opens never spends those tokens. Each layer
    // streams with its deterministic quick label + the canonical Volume knob.
    const idx = tracks.length;
    const track = ensureVolumeKnob({
      code: line,
      label: quickTrackLabel(line, idx),
      controls: [],
      pills: [],
      // Persist the composer's plain-language intent so the add-track path can carry this
      // layer's MEANING forward (not just its dense Strudel) when composing a new voice.
      notation: staged.notation,
    });
    tracks.push(track);
    prior.push({
      instrument: staged.instrument,
      role: staged.role,
      notation: staged.notation,
      code: line,
    });
    if (onTrack) await onTrack(track, tracks).catch(() => {});
  }
  if (!tracks.length) {
    const why =
      lastLayerErr instanceof Error
        ? lastLayerErr.message
        : lastLayerErr
          ? String(lastLayerErr)
          : "every layer call returned empty (no instrument/line produced)";
    throw new Error(`layer engine produced no tracks — ${why}`);
  }

  // (No auto-review pass — removed per the user. Each layer is composed at high effort with thinking
  // on and shipped as-is; the user polishes via per-layer edits, which run the same layer path.)

  // Each layer was enriched + Volume-knobbed inline as it landed (above), so its panel already
  // streamed to the UI the moment that layer finished. Re-run the idempotent Volume pass as a
  // safety net, then merge into the playable loop.
  const withVol = tracks.map(ensureVolumeKnob);
  return { tracks: withVol, code: mergeTracks(withVol, bpm, beats) };
}

/**
 * Persist partial generation progress, PRESERVING any layer the user tweaked mid-build (volume/feel/sound).
 * The generator keeps composing the NEXT layer from its own in-memory ORIGINAL `prior` list — user tweaks
 * NEVER feed back into composition — so this is purely about what's STORED + PLAYED. For each layer already
 * in the DB, prefer the DB version (the user's tweak, or the identical original); the NEW layer comes from
 * the generator. `genTracks` is the generator's FULL layer set, so a layer a racing user-PATCH may have
 * transiently dropped is re-asserted on the next progress write (self-healing). Re-merge so the playable
 * strudel reflects the edits. Status stays "generating".
 */
export async function mergeGenWithUserEdits(
  partId: string,
  genTracks: LoopTrack[],
  bpm: number,
  timeSignature: string,
  sql: Sql,
  /** Code carrying the song visual to keep on the merged output (the composed code with
   *  its inherited/auto-painted @hydra) — a bare mergeTracks would strip the blocks,
   *  which is how a new section's inherited visual used to vanish at its ready write. */
  visualFrom?: string | null,
): Promise<{ tracks: LoopTrack[]; code: string }> {
  const [cur] = await sql<{ tracks: LoopTrack[] | null }[]>`select tracks from parts where id = ${partId}`;
  const dbTracks = (cur?.tracks ?? []) as LoopTrack[];
  const merged = genTracks.map((t, i) => dbTracks[i] ?? t);
  const beats = beatsPerBar(timeSignature);
  return {
    tracks: merged,
    code: visualFrom
      ? mergeTracksKeepVisual(merged, bpm, beats, visualFrom)
      : mergeTracks(merged, bpm, beats),
  };
}

export async function writePartProgressMerged(
  partId: string,
  genTracks: LoopTrack[],
  bpm: number,
  timeSignature: string,
  sql: Sql = db(),
): Promise<void> {
  const { tracks, code } = await mergeGenWithUserEdits(partId, genTracks, bpm, timeSignature, sql);
  await writePartProgress(partId, code, tracks, sql);
}

/** A quick deterministic name for a track's "$:" line — shown while the loop streams
 *  in, before the model's enrich label lands. Reads the sound/role from the line. */
function quickTrackLabel(line: string, i: number): string {
  // Match s("…") OR sound("…") (Opus prefers the long form) — the first sound token.
  const tok = line
    .match(/\b(?:sound|s)\(\s*["'`]([^"'`]+)/)?.[1]
    ?.match(/[a-z]+/i)?.[0]
    ?.toLowerCase();
  const drums: Record<string, string> = {
    bd: "Kick", kick: "Kick", sd: "Snare", sn: "Snare", cp: "Clap",
    hh: "Hi-Hats", ch: "Hi-Hats", oh: "Open Hat", rd: "Ride", cr: "Crash",
    rim: "Rim", perc: "Perc",
    lt: "Low Tom", mt: "Mid Tom", ht: "High Tom", cb: "Cowbell", sh: "Shaker",
    tb: "Tambourine", co: "Conga",
  };
  if (tok && drums[tok]) return drums[tok];
  // Pitched layer (note/n) → a generic synth name until enrich lands the real one.
  if (/\bnote\(|\bn\(/.test(line)) return "Synth";
  const wave: Record<string, string> = {
    sawtooth: "Saw", saw: "Saw", square: "Square", sine: "Sine",
    triangle: "Triangle", white: "Noise", pink: "Noise", brown: "Noise",
  };
  if (tok && wave[tok]) return wave[tok];
  return tok ? tok[0].toUpperCase() + tok.slice(1) : `Layer ${i + 1}`;
}

// ── per-track mutations (mute / delete / add) ─────────────────────────────────
// Everything now operates on individual tracks. These read the song tempo + the
// part's tracks, change the LIST (not a whole-loop rewrite), re-merge, and save.

/** Read the song tempo + a part's tracks, transform the list, re-merge, save
 *  (strudel + tracks, status ready). Shared core for mute + delete. */
async function applyTrackChange(
  songId: string,
  partId: string,
  transform: (tracks: LoopTrack[]) => LoopTrack[],
  sql: Sql,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  const plan = planOf(song);
  const beats = beatsPerBar(plan.timeSignature);
  // Scope the part to THIS song — a partId from another song must never be
  // reachable via a song the caller happens to own (cross-song write / IDOR).
  const [part] = await sql<PartRow[]>`select * from parts where id = ${partId} and song_id = ${songId}`;
  if (!part) throw new Error(`part ${partId} not found`);
  const next = transform([...((part.tracks as LoopTrack[] | null) ?? [])]);
  const code = mergeTracksKeepVisual(next, plan.bpm, beats, part.strudel);
  // A tweak made WHILE the loop is still composing must not flip it to "ready" — that would end the
  // loading state and fight the generator (whose next progress write re-asserts "generating" anyway).
  // Keep the current status; the generator's final write sets "ready" when the whole stack is done.
  const status = part.status === "generating" ? "generating" : "ready";
  await writePartComposition(partId, code, null, null, next, status, sql);
}

/** Mute / unmute one track — drops it from the playable mix, still shown so it can
 *  be brought back (normies get a real mute button, not "set gain to 0"). */
export async function setTrackMuted(
  songId: string,
  partId: string,
  layer: number,
  muted: boolean,
  sql: Sql = db(),
): Promise<void> {
  await applyTrackChange(
    songId,
    partId,
    (tracks) => {
      if (tracks[layer]) tracks[layer] = { ...tracks[layer], muted };
      return tracks;
    },
    sql,
  );
}

/** Delete one track from the loop entirely. The unfold FOLLOWS: the section's
 *  moves re-point around the removed layer (exact mapping, zero AI) instead of
 *  going stale and being skipped wholesale. */
export async function deleteTrack(
  songId: string,
  partId: string,
  layer: number,
  sql: Sql = db(),
): Promise<void> {
  let oldCount = 0;
  await applyTrackChange(
    songId,
    partId,
    (tracks) => {
      oldCount = tracks.length;
      return tracks.filter((_, i) => i !== layer);
    },
    sql,
  );
  if (oldCount > 0 && layer >= 0 && layer < oldCount) {
    const mapping = Array.from({ length: oldCount }, (_, i) => i).filter(
      (i) => i !== layer,
    );
    await syncSectionSpecLayers(songId, partId, mapping, sql).catch(() => {});
  }
}

/** LAZY ENRICH (2026-07-13, the user): generation no longer builds tweak panels — tokens were
 *  being spent on layers nobody ever opened. The FIRST time a layer card is expanded the client
 *  sends "track-enrich" and this runs ONE cheap panel call for THAT layer, persisting it onto
 *  parts.tracks[layer] alone via jsonb_set — never a whole-row write, so a mid-generation
 *  progress write or a racing knob PATCH can't be clobbered, and the code/strudel/twin are
 *  untouched (the panel is pure metadata). Idempotent: an already-enriched layer returns as-is
 *  with no model call. Returns null when the model produced nothing usable — the card keeps its
 *  Volume knob and the next open retries. */
export async function enrichPartLayer(
  songId: string,
  partId: string,
  layer: number,
  cfg?: ClaudeConfig,
  sql: Sql = db(),
): Promise<LoopTrack | null> {
  const [part] = await sql<PartRow[]>`
    select * from parts where id = ${partId} and song_id = ${songId}`;
  const tracks = (part?.tracks as LoopTrack[] | null) ?? [];
  const t = tracks[layer];
  if (!t) return null;
  if (t.enriched) return t; // double-tap / second tab — never re-spend the call
  const panel = await enrichTrack(t.notation ?? t.code, t.code, cfg).catch(() => null);
  if (!panel || !(panel.label || panel.controls.length || panel.pills.length || panel.swap))
    return null;
  const next = {
    ...ensureVolumeKnob({
      ...t,
      label: panel.label || t.label,
      signature: panel.signature || t.signature,
      controls: panel.controls,
      pills: panel.pills,
      swap: panel.swap,
      enriched: true,
    }),
    // The DB line is canonical (it may carry knob tweaks newer than our read) — the panel is
    // metadata only, so never write code from here.
    code: t.code,
  };
  await sql`
    update parts
    set tracks = jsonb_set(tracks, array[${String(layer)}], ${sql.json(next as unknown as Parameters<typeof sql.json>[0])})
    where id = ${partId} and song_id = ${songId}
      and jsonb_array_length(tracks) > ${layer}`;
  return next;
}

/** ENRICH AT BIRTH (2026-07-13, the user — reverses the lazy-only default): right after a
 *  part's ready write, build EVERY still-bare layer's tweak panel in parallel, so a card is
 *  live the moment anyone taps it. Reuses enrichPartLayer per index (same per-layer jsonb_set
 *  write, same idempotence); the on-open lazy path stays as the fallback for panels an edit
 *  clears. Best-effort: a failed layer keeps its Volume knob and lazy-enriches on first open. */
export async function enrichPartTracks(
  songId: string,
  partId: string,
  cfg: ClaudeConfig | undefined,
  sql: Sql,
): Promise<void> {
  const [part] = await sql<{ tracks: LoopTrack[] | null }[]>`
    select tracks from parts where id = ${partId} and song_id = ${songId}`;
  const tracks = (part?.tracks ?? []) as LoopTrack[];
  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i]?.enriched) continue;
    jobs.push(enrichPartLayer(songId, partId, i, cfg, sql).catch(() => null));
  }
  await Promise.allSettled(jobs);
}

/** THE WHOLE-SONG SWEEP (2026-07-21, the user — an at-birth auto-run lived for a few
 *  hours and was reversed same day): ONE tap re-hears the entire song — effects first,
 *  so the fills land inside the fresh arcs, then breaks — REPLACING each list wholesale;
 *  whatever rode before (hand-born glides and fills included) is passed as context so
 *  the model keeps what works. Never runs on its own: the song page OFFERS it in a pill
 *  after a new loop lands, and /api/songs/:id/shape runs it only when tapped. Needs two
 *  ready loops (one loop has no turns). Best-effort: an unusable reply leaves that list
 *  exactly as it was. */
export async function autoShapeSong(
  songId: string,
  cfg: ClaudeConfig | undefined,
  sql: Sql,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) return;
  const plan = song.plan as SongPlan;
  // playable loops in order — blueprints (legacy chapter parents) excluded, like playback
  const bpIds = new Set(
    Object.values((plan as { chapters?: Record<string, string> }).chapters ?? {}),
  );
  const parts = await getPartsOrdered(songId, sql);
  const loops = parts
    .filter((p) => p.strudel?.trim() && p.status === "ready" && !bpIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.label ?? "untitled",
      intent: p.intent ?? undefined,
      bars: computeLoopBars(p.strudel ?? "") || p.bars || 4,
      layers: (p.tracks ?? []).map((t) => t.label ?? "").filter(Boolean),
    }));
  if (loops.length < 2) return;
  const identity = {
    genre: plan.genre,
    key: plan.key,
    bpm: plan.bpm,
    timeSignature: plan.timeSignature ?? "4/4",
    summary: plan.summary,
  };
  const loopNo = (id: string): number => loops.findIndex((l) => l.id === id) + 1;
  const overlaysNow = ((plan as { overlays?: BreakOverlay[] }).overlays ?? []).flatMap((o) => {
    const at = loopNo(o.fromId);
    return at >= 1
      ? [{ tpl: o.tpl, atLoop: at, gain: o.gain, heat: o.heat, tone: o.tone, space: o.space }]
      : [];
  });
  const fxContext = (list: SongFx[]) =>
    list.flatMap((e) => {
      const fl = loopNo(e.fromId);
      const tl = loopNo(e.toId);
      if (fl < 1 || tl < 1) return [];
      return [{ name: e.name, param: e.param, from: e.from, to: e.to, fromLoop: fl, toLoop: tl }];
    });
  // ONE call authors the whole shape — glides AND fills together, both told
  // "replaced wholesale" (merged 2026-07-22, the user: two sequential calls
  // each held the other category fixed, and the effects argued around fills
  // the next call deleted). null = the model whiffed → leave what rides.
  // A successful answer REPLACES both sets even when a list is empty — bare
  // turns are a real answer, not a failure.
  const effectsNow = ((plan.effects ?? []) as SongFx[]);
  const shape = await composePageShape(
    {
      ...identity,
      loops: loops.map(({ name, intent, layers, bars }) => ({ name, intent, layers, bars })),
      ridingEffects: fxContext(effectsNow),
      ridingBreaks: overlaysNow,
    },
    cfg,
  ).catch(() => null);
  if (!shape) return;
  const effects = shape.effects.map((e) => ({
    id: crypto.randomUUID(),
    param: e.param,
    from: e.from,
    to: e.to,
    curve: e.curve ?? "linear",
    ...(e.name ? { name: e.name } : {}),
    home: { from: e.from, to: e.to },
    fromId: loops[Math.min(loops.length, Math.max(1, e.fromLoop)) - 1].id,
    toId: loops[Math.min(loops.length, Math.max(1, e.toLoop)) - 1].id,
  }));
  await replaceSongEffects(songId, song.user_id, effects, sql);
  const overlays = shape.breaks.flatMap((b) => {
    const move = breakMoveOf(b.tpl);
    if (!move) return [];
    const anchor = loops[b.atLoop - 1].id;
    return [
      {
        id: crypto.randomUUID(),
        tpl: b.tpl,
        name: move.word,
        gain: b.gain,
        heat: b.heat,
        tone: b.tone,
        space: b.space,
        fromId: anchor,
        toId: anchor,
      } satisfies BreakOverlay,
    ];
  });
  // Unconditional — the shape call answered, so an empty list CLEARS old fills
  // (the piece may want its turns bare).
  await replaceSongOverlays(songId, song.user_id, overlays, sql);
}

// ── NATURAL-LANGUAGE LOOP EDIT: route one request → ordered ops → apply, in memory ──



/** The loops on either side of the one being edited (that already have music), so the edit composes with
 *  the sections around it and the song stays cohesive. Side matches buildBrief: the previous loop → "after"
 *  (this one comes out of it); the next loop → "before" (this one runs into it). Each neighbour also
 *  carries the seam's CHOSEN one-bar break (plan.breaks, keyed by the LEADING loop's part id) — when one
 *  plays there, the sections meet THROUGH it, so an edit must see that bar too. */
function editNeighbours(
  parts: PartRow[],
  idx: number,
  breaks?: Record<string, BreakSet>,
): { label: string; side: "before" | "after"; strudel?: string | null; breakStrudel?: string | null }[] {
  const chosenBreak = (fromPartId: string | undefined): string | null => {
    if (!fromPartId) return null;
    const set = breaks?.[fromPartId];
    const br = set && set.chosen !== null && set.chosen !== undefined ? set.options[set.chosen] : null;
    return br?.strudel ?? null;
  };
  const out: { label: string; side: "before" | "after"; strudel?: string | null; breakStrudel?: string | null }[] = [];
  const prev = parts[idx - 1];
  const next = parts[idx + 1];
  if (prev?.strudel?.trim())
    out.push({
      label: prev.label ?? "the previous section",
      side: "after",
      strudel: prev.strudel,
      breakStrudel: chosenBreak(prev.id), // the break leaving the previous loop INTO this one
    });
  if (next?.strudel?.trim())
    out.push({
      label: next.label ?? "the next section",
      side: "before",
      strudel: next.strudel,
      breakStrudel: chosenBreak(parts[idx]?.id), // the break leaving THIS loop into the next
    });
  return out;
}

/** The song's chosen one-bar breaks, straight off the raw plan JSON (SongPlan doesn't type them). */
function planBreaksOf(song: SongRow): Record<string, BreakSet> | undefined {
  return (song.plan as { breaks?: Record<string, BreakSet> } | null)?.breaks;
}


// ── THE DIRECT EDIT (2026-07-03, the user): one call, code in → code out — no router, no ops ──

/**
 * NATURAL-LANGUAGE EDIT of one loop, DIRECT: ONE Fable-5 HIGH call sees the loop's code, the song-aware
 * brief (neighbouring loops included) and the request, and returns the complete revised loop — free
 * shape (it may rewrite, add or remove layers). We then reconcile the returned lines against the
 * existing tracks (byte-identical line → that track survives untouched, knobs/labels/mutes and all),
 * gate every CHANGED line, retry ONCE with the real build errors as feedback, and keep the old line for
 * anything that still fails (an edit can never break a playing loop). Only THIS loop changes.
 * (An earlier op-router path — classify the request into add/remove/modify ops,
 * apply per-op — lost to this by ear and was removed 2026-07-20.)
 */
export async function editLoopDirect(
  songId: string,
  partId: string,
  request: string,
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  const plan = planOf(song);
  const parts = await getPartsOrdered(songId, sql);
  const idx = parts.findIndex((p) => p.id === partId);
  const part = parts[idx];
  if (!part?.strudel?.trim()) throw new Error(`part ${partId} has no music`);

  await snapshotPartOriginal(partId, sql);
  await setPartStatus(partId, "generating", sql);
  await setPartMessage(partId, "Reworking this loop…", sql);
  const settleSong = async () => {
    const [c] = await sql<{ live: number }[]>`
      select count(*) filter (where status = 'generating')::int as live
      from parts where song_id = ${songId}`;
    if (!Number(c?.live))
      await sql`update songs set status = 'ready' where id = ${songId} and status = 'generating'`;
  };
  const settle = async () => {
    await setPartMessage(partId, "", sql);
    await setPartStatus(partId, "ready", sql);
    await settleSong();
  };

  try {
    const tracks0 = (part.tracks as LoopTrack[] | null) ?? [];
    if (!tracks0.length) return void (await settle()); // nothing editable (legacy shape)

    const beats = beatsPerBar(plan.timeSignature);
    const ts = plan.timeSignature ?? "4/4";
    const bodyOf = (t: LoopTrack) => t.code.replace(/^\$:\s*/, "").trim();
    const layers = tracks0.map((t) => ({ label: t.label ?? "", body: bodyOf(t) }));
    // SONG-AWARE brief: this loop's own intent + the neighbouring loops' actual music.
    const target: PlanPart = {
      label: part.label ?? "",
      intent: part.intent ?? "",
      bars: part.bars ?? 8,
      kind: part.kind as PlanPart["kind"],
    };
    let brief = buildBrief(plan, target, editNeighbours(parts, idx, planBreaksOf(song)));
    // The song-level effects riding THIS loop (they live OUTSIDE it and the
    // edit can't touch them) — but the model must know the lens the listener
    // hears this loop through (2026-07-14, the user).
    {
      const fx = ((plan as { effects?: SongFx[] }).effects ?? []) as SongFx[];
      const posOf = (id: string) => parts.findIndex((p) => p.id === id);
      const riding = fx.filter((e) => {
        const a = posOf(e.fromId);
        const b = posOf(e.toId);
        return a >= 0 && b >= a && idx >= a && idx <= b;
      });
      if (riding.length)
        brief += `\nEffects riding this loop from OUTSIDE it (playback-level — you cannot change them, only know they're there): ${riding
          .map((e) => `${e.name ? `"${e.name}" — ` : ""}${e.param} ${e.from}→${e.to}`)
          .join("; ")}.`;
      const fills = (
        ((plan as { overlays?: { tpl: string; fromId: string }[] }).overlays ?? [])
      ).flatMap((o) => {
        if (o.fromId !== partId) return [];
        const m = breakMoveOf(o.tpl);
        return m ? [`${m.word} (${m.hint}, last ${m.bars} bar${m.bars === 1 ? "" : "s"})`] : [];
      });
      if (fills.length)
        brief += `\nA drum fill rides this loop's closing bars from OUTSIDE it (playback-level, same — unchangeable): ${fills.join("; ")}.`;
    }
    const intent0 = (part.intent ?? "").trim();

    // ONE call → the whole revised loop; reconcile + gate. `failures` carries the real build
    // errors of changed lines, for the single retry. The same call revises the section's brief
    // (the card description) when the edit invalidates it — see `intent` on the result.
    const attempt = async (
      change: string,
    ): Promise<{
      tracks: LoopTrack[];
      failures: string[];
      changed: number;
      intent?: string;
      /** The track's direction note, rewritten by the SAME call when the
       *  request steered the whole track (absent for loop-local changes). */
      direction?: string;
      /** origin[newIndex] = old 0-based track index (null = brand-new layer) —
       *  the exact mapping the unfold re-points itself with after the write. */
      origin: (number | null)[];
    } | null> => {
      const reply = await editStrudelWholeLoop(
        layers,
        brief,
        change,
        cfg,
        intent0 || undefined,
        plan.direction,
      ).catch(() => null);
      const bodies = reply?.bodies;
      if (!bodies?.length) return null;
      // Match each returned line to a surviving track: byte-identical first (that track carries
      // over untouched), then a modified line pairs with the leftover playing the SAME SOUND (so
      // "remove the pad, brighten the keys" can't hand the keys the pad's identity), then leftovers
      // in order. Extra lines become brand-new layers; unpaired old tracks are the removed ones.
      const soundKey = (b: string) =>
        b.match(/\.bank\(\s*["'`]([^"'`]+)/)?.[1] ??
        // the bare sound NAME only — "hh*8" and "hh*16" are the same voice re-patterned
        b.match(/\b(?:s|sound)\(\s*["'`]\s*([A-Za-z_][\w]*)/)?.[1] ??
        "";
      const used = new Set<number>();
      const pairs: (number | null)[] = bodies.map((b) => {
        const j = tracks0.findIndex((t, ti) => !used.has(ti) && bodyOf(t) === b);
        if (j >= 0) used.add(j);
        return j >= 0 ? j : null;
      });
      for (let i = 0; i < pairs.length; i++) {
        if (pairs[i] !== null) continue;
        const key = soundKey(bodies[i]);
        const j = key
          ? tracks0.findIndex((t, ti) => !used.has(ti) && soundKey(bodyOf(t)) === key)
          : -1;
        if (j >= 0) {
          used.add(j);
          pairs[i] = j;
        }
      }
      const leftovers = tracks0.map((_, ti) => ti).filter((ti) => !used.has(ti));
      let li = 0;
      for (let i = 0; i < pairs.length; i++)
        if (pairs[i] === null && li < leftovers.length) pairs[i] = leftovers[li++];

      const out: LoopTrack[] = [];
      const origin: (number | null)[] = [];
      const failures: string[] = [];
      let changed = 0;
      for (let i = 0; i < bodies.length; i++) {
        const old = pairs[i] !== null ? tracks0[pairs[i] as number] : undefined;
        if (old && bodyOf(old) === bodies[i]) {
          out.push({ ...old }); // untouched — knobs, label, mute, everything survives
          origin.push(pairs[i]);
          continue;
        }
        let fixed = autoFixRender(`$: ${bodies[i]}`, plan.bpm);
        const errors = await layerGateErrors(fixed, plan.bpm, beats, ts);
        if (errors.length) {
          failures.push(`line ${i + 1}${old ? ` (${old.label})` : ""}: ${errors.join("; ")}`);
          if (old) {
            out.push({ ...old }); // a broken rewrite keeps the old line; a broken NEW layer is dropped
            origin.push(pairs[i]);
          }
          continue;
        }
        changed++;
        origin.push(pairs[i]);
        if (old) {
          const pg = old.code.match(/\.postgain\(\s*([\d.]+)\s*\)/)?.[1]; // the user's Volume carries across
          if (pg && !/\.postgain\(/.test(fixed)) fixed = `${fixed}.postgain(${pg})`;
          // The rewrite may have dropped/renamed the methods the old panel drove — clear the
          // stale panel (keep label + Volume) and let the card re-enrich on its next open.
          out.push({
            ...old,
            code: fixed,
            notation: bodies[i],
            signature: undefined,
            controls: [],
            pills: [],
            swap: undefined,
            enriched: false,
          });
        } else {
          out.push(
            ensureVolumeKnob({
              code: fixed,
              label: quickTrackLabel(fixed, out.length),
              controls: [],
              pills: [],
              notation: bodies[i],
            }),
          );
        }
      }
      return {
        tracks: out.map(ensureVolumeKnob),
        failures,
        changed,
        intent: reply?.brief,
        direction: reply?.direction,
        origin,
      };
    };

    let res = await attempt(request);
    if (res?.failures.length) {
      const retry = await attempt(
        `${request}\nYOUR PREVIOUS REWRITE FAILED TO BUILD on these lines — fix exactly these, keep the musical change:\n${res.failures.join("\n")}`,
      );
      if (retry && retry.failures.length < res.failures.length) res = retry;
    }
    // Model gave nothing usable, or the change would empty the loop → leave it exactly as it was.
    if (!res || !res.tracks.length) return void (await settle());
    if (res.failures.length)
      await flagIssue("edit-direct-failed-lines", `"${request}" → ${res.failures.join(" | ")}`, { songId, partId });
    if (!res.changed && res.tracks.length === tracks0.length)
      await flagIssue("edit-direct-noop", `"${request}" changed nothing`, { songId, partId });

    // No enrich sweep — panels are LAZY (created/rewritten layers had theirs cleared above,
    // so each rebuilds on the card's next open via enrichPartLayer).
    const code = mergeTracksKeepVisual(res.tracks, plan.bpm, beats, part.strudel);
    await writePartComposition(partId, code, null, null, res.tracks, "ready", sql);
    // The unfold FOLLOWS the edit: when the layer shape changed (added/removed
    // lines), re-point the section's moves with the exact mapping (zero AI).
    const identity =
      res.origin.length === tracks0.length && res.origin.every((o, i) => o === i);
    if (!identity)
      await syncSectionSpecLayers(songId, partId, res.origin, sql).catch(() => {});
    // The section's brief follows the music: the edit call returns it word-for-word when it
    // still fits (no write), revised when the change invalidated it — so the card description,
    // future edit briefs and the regenerate seed all describe what actually plays now.
    const intent1 = (res.intent ?? "").trim();
    if (intent0 && intent1 && intent1 !== intent0)
      await sql`update parts set intent = ${intent1.slice(0, 600)} where id = ${partId}`;
    // THE SONG'S DIRECTION NOTE follows the edit: when the same call judged the
    // request a whole-track steer, its rewritten note lands on plan.direction —
    // every later compose/extend/edit reads it from the brief. Best-effort.
    const direction1 = (res.direction ?? "").trim();
    if (direction1 && direction1 !== (plan.direction ?? "").trim())
      await saveSongDirection(songId, direction1, sql).catch(() => {});
    await setPartMessage(partId, "", sql);
    await settleSong();
  } catch (e) {
    console.error(`[klappn] direct loop edit failed for ${partId}:`, e);
    await flagIssue("edit-failed", String(e instanceof Error ? e.message : e), { songId, partId });
    await settle(); // leave the loop exactly as it was
  }
}

/** Set one or more knob values on a track (sliders / preset chips): rewrite the
 *  track's OWN line, re-merge, save. Multi-value so a preset — or several knobs moved
 *  together — applies atomically (no lost-update race between params), and crucially
 *  it updates parts.tracks[].code too, so a later mute/delete/add re-merge keeps the
 *  tweak instead of regenerating from a stale line. */
export async function setTrackControl(
  songId: string,
  partId: string,
  layer: number,
  values: Record<string, number>,
  sql: Sql = db(),
): Promise<void> {
  await applyTrackChange(
    songId,
    partId,
    (tracks) => {
      const t = tracks[layer];
      if (!t) return tracks;
      let code = t.code;
      for (const [param, value] of Object.entries(values)) {
        if (Number.isFinite(value)) code = setLayerMethodArg(code, 0, param, value);
      }
      if (code !== t.code) tracks[layer] = { ...t, code };
      return tracks;
    },
    sql,
  );
}

/** Swap a layer's INSTRUMENT (the sound/kit) — rewrite `.sound()`/`.s()` (via "sound")
 *  or `.bank()` (via "bank") on that track's line, re-merge, save. Deterministic (the
 *  alternatives were proposed by enrich); mirrors setTrackControl. */
export async function setTrackInstrument(
  songId: string,
  partId: string,
  layer: number,
  via: "sound" | "bank",
  value: string,
  sql: Sql = db(),
): Promise<void> {
  await applyTrackChange(
    songId,
    partId,
    (tracks) => {
      const t = tracks[layer];
      if (!t) return tracks;
      const code = setLayerInstrument(t.code, 0, via, value);
      if (code !== t.code) {
        // Remember what the layer STARTED on, the first time it's swapped — the token
        // being replaced right now IS the original. Lets the card's ⟲ restore it later.
        const cur =
          via === "bank"
            ? t.code.match(/\.bank\(\s*["'`]([^"'`]+)/)?.[1]
            : // name only — leading `s("sine*8")` (no dot) or chained `.s("gm_pad")`
              t.code.match(/\bs(?:ound)?\(\s*["'`]([A-Za-z_][\w:]*)/)?.[1];
        tracks[layer] = {
          ...t,
          code,
          ...(t.origSound == null && cur ? { origSound: cur } : {}),
        };
      }
      return tracks;
    },
    sql,
  );
}

/** A stable identity for "the same instrument across loops": a drum bank + its sample
 *  tokens ("bank:RolandTR909:bd,oh"), or a synth + its label ("synth:sawtooth:sub bass").
 *  Matches the actual sound, not just whatever the model named it. */
async function composeFromScore(
  plan: SongPlan,
  score: LoopScore,
  sounds: SoundPick[] | null,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner,
  stepKey: string,
  narrate?: (phase: string) => Promise<void>,
): Promise<{ code: string; sounds: SoundPick[] }> {
  const bpm = plan.bpm;
  const beats = beatsPerBar(plan.timeSignature);

  // STAGE 2 — PICK THE SOUNDS. Reuse the given picks when they already cover every
  // part (a note/arrangement edit keeps its instruments); otherwise pick fresh
  // (a structural change — added/renamed layer — warrants a re-pick for coverage).
  const reuse =
    !!sounds && score.parts.every((p) => sounds.some((s) => s.name === p.name));
  const picks: SoundPick[] = reuse
    ? (sounds as SoundPick[])
    : (
        await Promise.all([
          runStep(`pick-${stepKey}`, () =>
            pickSounds({ score, genre: plan.genre }, cfg),
          ),
          narrate?.("palette") ?? Promise.resolve(),
        ])
      )[0];

  // STAGE 3 helper — translate ONE layer into a single "$:" line, deterministically
  // gated (parse / tempo / real sounds / no object-notes) with ONE guided repair.
  // Returns null if it still won't validate — that layer is dropped and the loop
  // ships with the rest, rather than erroring the whole part.
  const gateLayer = async (line: string): Promise<string[]> => {
    return strudelServerErrors(`setcpm(${bpm}/${beats})\n${line}`, {
      bpm,
      timeSignature: plan.timeSignature,
    });
  };
  // STAGE 3 — RENDER THE WHOLE LOOP IN ONE CALL. Kimi turns the entire score (all parts'
  // events + their assigned sounds + routing) into every "$:" line at once, so it writes
  // them as a coherent MIX. The explicit on-grid score makes the render mechanical, so the
  // FIRST render is clean by construction — NO model repair pass (we never pay for a second
  // call). We only (a) deterministically auto-fix the two known mechanical slips for FREE
  // (value-pattern x*n→x!n, un-synced delaytime→tempo), then (b) drop any layer that STILL
  // won't pass the gate (rare).
  const renderOnce = async (): Promise<string[]> =>
    (await translateLoop({ score, picks }, cfg))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("$:"));
  await (narrate?.("refining") ?? Promise.resolve());
  // Kimi FORCES thinking and can rarely burn its whole budget reasoning and emit nothing
  // ("returned no text") — so retry once if the render comes back empty/throws.
  let lines = await runStep(`render-${stepKey}`, () => renderOnce()).catch(() => null);
  if (!lines || !lines.length)
    lines = await runStep(`render-2-${stepKey}`, () => renderOnce()).catch(() => null);
  if (!lines || !lines.length) throw new Error("render: the model returned no usable loop");
  const goodLayers: string[] = [];
  for (const raw of lines) {
    const line = autoFixRender(raw, bpm);
    const errs = await gateLayer(line);
    if (errs.length) {
      console.warn(`[klappn] dropping layer (gate): ${errs.join("; ")} :: ${line.slice(0, 60)}`);
      await flagIssue("render-layer-gate", `${errs.join("; ")} :: ${line.slice(0, 160)}`);
    } else goodLayers.push(line);
  }
  // Don't ship a GUTTED loop — if too many layers dropped it lost its backbone (kick/bass/
  // lead). Fail so the caller surfaces a clean retry.
  if (goodLayers.length * 2 < score.parts.length)
    throw new Error(
      `render produced only ${goodLayers.length}/${score.parts.length} usable layers — too incomplete to ship`,
    );

  // MERGE — one setcpm + the rendered lines; then the DETERMINISTIC crackle guard
  // (each distinct-effect layer gets its own orbit so superdough builds each reverb/
  // delay bus once) and a .duck()-target repair.
  const merged = `setcpm(${bpm}/${beats})\n${goodLayers.join("\n")}`;
  const deconflicted = wireSidechain(assignReverbOrbits(merged));
  return { code: deconflicted, sounds: picks };
}

/** The plain-language BRIEF the layer engine composes from — the spiritual successor
 *  to the old Fable-5 prompt: genre, key, tempo, this section's vibe, and how it must
 *  sit beside its written neighbours. No music theory, no API reference — just what to
 *  make, in words the model turns straight into Strudel. */
function buildBrief(
  plan: SongPlan,
  target: PlanPart,
  neighbours: {
    label: string;
    side: "before" | "after";
    strudel?: string | null;
    /** The chosen one-bar BREAK at the seam between this section and the neighbour, if one plays. */
    breakStrudel?: string | null;
  }[],
  /** THE REST OF THE TRACK — every other loop, as DESCRIPTIONS only (label +
   *  intent). Direct neighbours carry their full Strudel below; the rest give
   *  the new loop the track's shape without flooding the context. */
  others: { label: string; intent?: string }[] = [],
  /** WHERE this section sits when it's an EDGE against a finished neighbour
   *  (2026-07-22, the user: a section composed before/after the track must
   *  know it IS the opening/last section — and an opening arrives UNDER the
   *  section it leads into, never over it). `label` = that neighbour. */
  place?: { kind: "opening" | "last"; label: string },
): string {
  const bits: string[] = [];
  if (plan.genre?.trim()) bits.push(`${plan.genre.trim()}.`);
  bits.push(`Key of ${plan.key}.`);
  bits.push(`${plan.bpm} BPM.`);
  // THE SONG'S DIRECTION NOTE — the maker's accumulated whole-track steer
  // (distilled from their own edit/extend words). Rides every brief so each
  // later loop, extend and edit pulls the same way.
  if (plan.direction?.trim())
    bits.push(`The maker's steer for the whole track: ${plan.direction.trim()}.`);
  const ts = plan.timeSignature ?? "4/4";
  if (ts !== "4/4") bits.push(`Time signature ${ts}.`);
  // HARMONY IS EMERGENT (2026-07-01, the user): we no longer dictate an explicit chord grid —
  // over-specifying the chords was constraining the model. Give it only the key and let the harmony
  // emerge: the first harmonic voice sets the changes, and every later layer already SEES the placed
  // layers' Strudel (priorContext), so it locks to the real notes there. One soft cue, no fixed chords.
  bits.push(
    "Let the harmony emerge — the first harmonic voice sets the changes; every later voice stays in key and sits with the notes already placed.",
  );
  // This section's specific role — the DERIVED musical intent only. The user's raw
  // words are translated into the genre/key/progression/intent above at derive time;
  // re-injecting the literal request here just muddies each layer's focused task.
  const intent = (target.intent || target.label || plan.summary || "").trim();
  if (intent)
    bits.push(`This section: ${intent.endsWith(".") ? intent : `${intent}.`}`);
  // EDGE FACTS (2026-07-22, the user): a loop landing at the track's edge must
  // know it. The opening carries the one hard weight rule — it sits UNDER the
  // section it leads into (drums before a drumless intro was the bug).
  if (place?.kind === "opening")
    bits.push(
      `This is the track's OPENING — the first thing heard, playing immediately before "${place.label}". Arrive UNDER "${place.label}": fewer and quieter voices, nothing heavier than it carries — if "${place.label}" has no drums, the opening has none.`,
    );
  if (place?.kind === "last")
    bits.push(
      `This is the track's LAST section — it takes the hand-off from "${place.label}" (the track wraps back to its start after it).`,
    );
  if (target.kind === "bridge")
    bits.push("This is a short BRIDGE — a one-time transition, not a repeating loop.");
  if (target.kind === "break")
    bits.push(
      "This is a short BREAK — a transitional loop between its neighbours: sparser than they are, tension into release.",
    );
  if (others.length)
    bits.push(
      `The track's other sections, in order: ${others
        .map((o) => `"${o.label}"${o.intent?.trim() ? ` (${o.intent.trim()})` : ""}`)
        .join(" · ")}.`,
    );
  for (const n of neighbours) {
    // OBJECTIVE adjacency (2026-07-16, the user): state what plays next to
    // what and hand over the actual code — no method prescribed. The loop may
    // resolve the seam however the music calls for, INCLUDING its own break
    // or transition material inside the loop.
    const br = (n.breakStrudel || "")
      .split("\n")
      .filter((l) => l.trim().startsWith("$:"))
      .join("\n");
    bits.push(
      n.side === "after"
        ? `It plays immediately after "${n.label}".`
        : `It plays immediately before "${n.label}".`,
    );
    if (br) bits.push(`A one-bar break plays at that seam. Its Strudel:\n${br}\n`);
    const music = (n.strudel || "")
      .split("\n")
      .filter((l) => l.trim().startsWith("$:"))
      .join("\n");
    if (music) bits.push(`The "${n.label}" section's Strudel:\n${music}\n`);
  }
  if (neighbours.length)
    bits.push(
      "Sections play back to back with no gap — connect naturally with them. This section is its own statement, not a restatement of a neighbour.",
    );
  if (target.kind !== "bridge") {
    // ONE looping SECTION, not the whole song (2026-07-01, the user). State the FACTS only — what it is
    // (a looping section carrying that section's full arrangement) + the one contrast (not a whole song).
    // No hype ("make it slap" / "let it breathe" cut) — the prompts guide with facts, not opinion.
    bits.push(
      "One looping section of a larger track, with the full arrangement that section needs — not a whole song on its own.",
    );
  }
  return bits.join(" ");
}

/**
 * Compose one loop, LAYER BY LAYER: build a plain brief from the plan + this
 * section's intent, then add one gated "$:" line at a time (each with its own tweak
 * panel) until the model returns empty. Every model call is wrapped in `runStep` so
 * each is its own durable Workflow step (resumable, under the per-step wall-clock).
 */
async function composePart(
  plan: SongPlan,
  priorParts: GeneratedPartRef[],
  target: PlanPart,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner,
  stepKey: string,
  arrangement?: ArrangementItem[],
  report?: Report,
  /** STREAMING sink: called after each track lands with the tracks so far + the
   *  merged playable code, so the caller can persist partial progress and the UI
   *  can show/play tracks as they arrive. */
  onProgress?: (tracks: LoopTrack[], code: string) => Promise<void>,
): Promise<ComposedLoop> {
  const bpm = plan.bpm;
  const beats = beatsPerBar(plan.timeSignature);

  // Every FINISHED adjacent neighbour, found once from the arrangement — the
  // blend critic judges the hand-off on EACH side (a bridge between two written
  // loops must flow with both). `side` is THIS part's position relative to the
  // neighbour: "after" = it follows the neighbour; "before" = it leads into it.
  const neighbours: { label: string; side: "before" | "after"; strudel?: string | null }[] = [];
  if (arrangement && arrangement.length) {
    const ti = arrangement.findIndex((a) => a.isTarget);
    const before = ti > 0 ? arrangement[ti - 1] : undefined;
    const after =
      ti >= 0 && ti + 1 < arrangement.length ? arrangement[ti + 1] : undefined;
    if (before?.done && before.strudel)
      neighbours.push({ label: before.label, side: "after", strudel: before.strudel });
    if (after?.done && after.strudel)
      neighbours.push({ label: after.label, side: "before", strudel: after.strudel });
  }

  // BUILD THE LOOP, LAYER BY LAYER. No score, no API docs — just a plain-language
  // brief (genre / key / tempo / this section's intent + how it sits beside its
  // neighbours). The model adds one gated "$:" line at a time, each carrying its own
  // tweak panel, until it returns empty. Streamed through `onTrack` so the part's
  // progress updates live as tracks land.
  // (One-shot whole-loop generation was tried + reverted 2026-07-03 — it sounded
  //  better layer by layer. Git history has the experiment.)
  // THE REST OF THE TRACK as descriptions: every other section (not the
  // target, not a direct neighbour — those carry full Strudel) rides along as
  // label + intent, so the new loop knows the track's shape. ONLY while the
  // song is still being born: a SOLO compose (extend / regenerate into an
  // otherwise-finished song) sees its DIRECT NEIGHBOURS and nothing further
  // (2026-07-22, the user) — the far sections' energy has no business pulling
  // on a loop that only ever touches its neighbours.
  const solo = (arrangement ?? []).length > 0 && arrangement!.every((a) => a.isTarget || a.done);
  const neighbourLabels = new Set(neighbours.map((n) => n.label));
  const others = solo
    ? []
    : (arrangement ?? [])
        .filter((a) => !a.isTarget && !neighbourLabels.has(a.label))
        .map((a) => ({ label: a.label, intent: a.intent }));
  // EDGE PLACE: the target sits at the track's edge against a FINISHED
  // neighbour → the brief says so (opening = the weight rule; last = the fact).
  // During the song's initial sequential birth the next section has no code
  // yet, so an opening-in-progress never gets a rule it can't ground.
  const ti = (arrangement ?? []).findIndex((a) => a.isTarget);
  const nextA = ti >= 0 ? arrangement![ti + 1] : undefined;
  const prevA = ti > 0 ? arrangement![ti - 1] : undefined;
  const place =
    ti === 0 && nextA?.done && nextA.strudel
      ? ({ kind: "opening", label: nextA.label } as const)
      : ti >= 0 && ti === arrangement!.length - 1 && prevA?.done && prevA.strudel
        ? ({ kind: "last", label: prevA.label } as const)
        : undefined;
  const brief = buildBrief(plan, target, neighbours, others, place);
  // Each landed track → narrate progress AND stream the partial loop to the caller
  // (which persists it), so the UI shows + plays tracks the moment they arrive.
  const onTrack = async (t: LoopTrack, all: LoopTrack[]) => {
    if (report) await report(`Laid down the ${(t.label || "next layer").toLowerCase()}…`);
    if (onProgress) await onProgress(all, mergeTracks(all, bpm, beats));
  };
  // Seed the first status immediately so the (longest) opening layer isn't a blank wait.
  if (report) await report("Laying the foundation…");
  const { tracks, code: deconflicted } = await composeLoopByLayers(
    brief,
    bpm,
    beats,
    plan.timeSignature ?? "4/4",
    cfg,
    runStep,
    stepKey,
    onTrack,
    // Floor by KIND: a loop is the unfold's palette (full); a break/bridge is
    // a deliberate thinning — forcing 8 voices into a 2-bar vacuum breaks it.
    target.kind === "break" || target.kind === "bridge" ? 2 : 8,
  );

  // The playable loop IS the merged tracks — no merged @controls pass. Each track
  // carries its OWN tweak panel (track.controls, model-generated) which the per-track
  // UI reads + edits via the "track-control" delta op, so part.strudel stays exactly
  // mergeTracks(tracks): one source of truth, consistent for per-track editing and
  // for the streaming partial writes.
  let out = deconflicted;

  // VISUALS FOLLOW THE SONG. Visuals are ONE aesthetic for the whole piece,
  // auto-painted in parallel with the first loop's composition (see
  // GenerationWorkflow) — a newly composed section must arrive WITH the song's
  // visual, continuing the one look (never a dead section in immersive view).
  // Prefer a painted NEIGHBOUR's blocks (they carry any browser self-heals) over
  // the plan's canonical copy. Graded deterministically so the song-wide knobs
  // move this section too. Best-effort: a failure just leaves this section for
  // the workflow's closing sweep or a manual Repaint.
  const visualNb = arrangement?.find(
    (a) => !a.isTarget && a.done && a.strudel && extractHydra(a.strudel),
  );
  if (!visualNb && plan.visual?.hydra) {
    // AUTO-VISUALS: no painted neighbour, but the song's canonical visual exists (or just
    // landed — it's painted in parallel with this very composition and the shared plan
    // object is updated the moment it resolves). Attach it so the loop goes ready already
    // dressed. If the paint is still in flight, the workflow's closing sweep dresses this
    // part instead — no step here may WAIT on it.
    out = attachVisualBlocks(out, plan.visual);
  } else if (visualNb?.strudel) {
    // ONE visual for the WHOLE piece: COPY the neighbour's existing visual onto the new
    // section VERBATIM — its @hydra sketch AND the @vcontrols grade spec — never a freshly
    // GENERATED sketch (that diverges per loop and leaves a "remaining loop to paint"). A new
    // loop simply INHERITS the song's single visual: identical sketch, no extra paint, no
    // per-section difference. (Its H() state still advances live via the shared visual clock.)
    const hydra = extractHydra(visualNb.strudel);
    if (hydra) {
      out = attachHydraBlock(out, hydra);
      const vc = visualNb.strudel.match(/\/\*\s*@vcontrols\b[\s\S]*?\*\//);
      if (vc) out = out.replace("/* @hydra", `${vc[0]}\n\n/* @hydra`);
      const vl = visualNb.strudel.match(/\/\*\s*@vlooks\b[\s\S]*?\*\//);
      if (vl) out = out.replace("/* @hydra", `${vl[0]}\n\n/* @hydra`);
    }
  }
  // score/sounds are legacy (null on the layer engine); `tracks` is the per-track truth.
  return { code: out, score: null, sounds: null, tracks };
}

/** Generate the AI Hydra visual for a part's music (finished, or streaming-partial once
 *  the foundation layers are in). Measures the loop's true cycle-length for lockstep sync,
 *  hands the model a neighbour's visuals for continuity in multi-part songs, and
 *  returns the raw visual string ("" on failure — the caller surfaces an error). */
export async function genHydraFor(
  music: string,
  plan: SongPlan,
  intent: string | undefined,
  cfg: ClaudeConfig | undefined,
  priorHydra?: string,
  neighbourLabel?: string,
  runStep?: StepRunner,
  stepKey?: string,
): Promise<string> {
  // Measure the loop's TRUE length in cycles so the visual can be made to loop in
  // lockstep with it (the generator gets N + the loop-sync gate enforces it).
  let loopCyclesN: number | undefined;
  try {
    loopCyclesN = (await loopCycles(music)) ?? undefined;
  } catch {
    /* non-fatal — visuals just won't be loop-gated */
  }
  try {
    const visual = await generateHydra(
      {
        strudel: music,
        genre: plan.genre,
        intent,
        key: plan.key,
        bpm: plan.bpm,
        loopCycles: loopCyclesN,
        priorHydra,
        neighbourLabel,
      },
      cfg,
      runStep,
      stepKey,
    );
    if (!visual)
      await flagIssue("hydra-compose-failed", "no visual passed the eval gate after 2 gen+repair attempts");
    return visual;
  } catch (e) {
    console.error("[klappn] hydra generation failed", e);
    await flagIssue("hydra-compose-failed", String(e instanceof Error ? e.message : e));
    return "";
  }
}

/** Generate the song's ONE visual from a loop's music (full, or streaming-partial once
 *  the foundation layers have fixed the cycle length): the graded @hydra sketch, its
 *  deterministic @vcontrols grade and the AI-named @vlooks. Shared by the AUTO paint
 *  (GenerationWorkflow fires it in parallel with composition) and the manual Repaint
 *  route. Returns null when nothing passed the gate — visuals never block a song. */
export async function paintSongVisual(
  music: string,
  plan: SongPlan,
  intent: string | undefined,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner = inlineRunner,
  stepKey = "v",
): Promise<SongVisual | null> {
  const raw = await genHydraFor(music, plan, intent, cfg, undefined, undefined, runStep, stepKey);
  // Strip any machine grade the model may have ECHOED — grading it again would
  // declare the v* consts twice (a play-time SyntaxError).
  const hydra = stripVisualGrade(raw);
  if (!hydra) return null;
  const { hydra: graded, vcontrols } = parameterizeVisuals(hydra);
  const vlooks = vcontrols
    ? await runStep(`vlooks-${stepKey}`, () => suggestLooks(graded, vcontrols, cfg)).catch(() => "")
    : "";
  return { hydra: graded, vcontrols: vcontrols || undefined, vlooks: vlooks || undefined };
}

/** Attach the song's canonical visual to every part that has music but no @hydra yet —
 *  the AUTO paint's closing sweep, covering any part whose ready write beat the visual. */
export async function attachSongVisualEverywhere(
  songId: string,
  v: SongVisual,
  sql: Sql,
): Promise<void> {
  const parts = await getPartsOrdered(songId, sql);
  for (const p of parts) {
    if (!p.strudel?.trim() || hasHydra(p.strudel)) continue;
    await writePartStrudel(p.id, attachVisualBlocks(p.strudel, v), p.status as PartStatus, sql);
  }
}

/** Build the full-arrangement context (every loop, in order, with role + done
 *  flag) so a loop is composed knowing its neighbours and where it sits. */
export function buildArrangement(
  parts: {
    id?: string;
    label: string | null;
    intent: string | null;
    bars: number;
    position: number;
    status: string;
    strudel: string | null;
    kind?: string | null;
  }[],
  targetPosition: number,
): ArrangementItem[] {
  return [...parts]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.id,
      label: p.label ?? "untitled",
      intent: p.intent ?? "",
      bars: p.bars ?? 8,
      position: p.position,
      isTarget: p.position === targetPosition,
      done: p.status === "ready" && !!p.strudel,
      strudel: p.status === "ready" ? p.strudel : null,
      kind:
        p.kind === "bridge" || p.kind === "break"
          ? p.kind
          : ("loop" as const),
    }));
}

/** Read the song's plan + parts — used by the Workflow to set up per-part steps. */
export async function loadSongContext(
  songId: string,
  sql: Sql = db(),
): Promise<{ plan: SongPlan; parts: PartRow[]; userId: string; model: ModelId }> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  return {
    plan: planOf(song),
    parts: await getPartsOrdered(songId, sql),
    userId: song.user_id,
    model: song.model ?? DEFAULT_MODEL,
  };
}

/**
 * Compose one part using an arbitrary StepRunner — the shared entry the Workflow
 * uses (with `step.do` so each model call is durable) and dev uses (inline).
 * Returns the final code; the caller persists it.
 */
export async function composePartWith(
  plan: SongPlan,
  priorParts: GeneratedPartRef[],
  target: PlanPart,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner,
  stepKey: string,
  arrangement?: ArrangementItem[],
  report?: Report,
  onProgress?: (tracks: LoopTrack[], code: string) => Promise<void>,
): Promise<ComposedLoop> {
  return composePart(
    plan,
    priorParts,
    target,
    cfg,
    runStep,
    stepKey,
    arrangement,
    report,
    onProgress,
  );
}

/**
 * ARRANGE THE SONG (2026-07-13): one HIGH call (lib/arrange-plan) writes the
 * whole song's arrangement — per-section layer moves/sweeps/overlays + the
 * ending — persisted as plan.arrangement and rendered at play/export time by
 * lib/arrange. Runs post-finalize in the generation workflow (best-effort,
 * behind an already-playable song) and from the manual re-arrange route.
 * Overlay/ending lines pass the SAME deterministic gate as composed layers;
 * a line that fails is dropped, never repaired here (the rest of the
 * arrangement stands). Returns the saved arrangement, or null when the model
 * gave nothing usable (the song keeps classic whole-loop playback).
 */
export async function arrangeSong(
  songId: string,
  cfg: ClaudeConfig | undefined,
  sql: Sql,
  /** The user's own words for how the song should move (the ✎ re-roll). */
  direction?: string,
  /** When set, the model still sees the WHOLE song (coherence) but only THIS
   *  section's spec is written — the per-loop unfold. Others untouched. */
  onlySectionId?: string,
  /** With onlySectionId: the bar length the user picked from the loop's
   *  options — the model arranges exactly this many bars. */
  targetBars?: number,
  /** Fill mode (the post-finalize sweep): write only sections that have NO
   *  unfold yet, and the ending only when absent — the per-loop unfolds that
   *  landed at birth (and anything the user shaped) stand. */
  fill?: boolean,
): Promise<SongArrangement | null> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  const plan = song?.plan as SongPlan | undefined;
  if (!plan || !Array.isArray(plan.parts)) return null;
  const existing =
    ((plan as { arrangement?: SongArrangement | null }).arrangement ?? null) as
      | SongArrangement
      | null;
  const rows = await sql<PartRow[]>`
    select * from parts where song_id = ${songId} order by position asc`;
  const ready = rows.filter((p) => p.status === "ready" && p.strudel?.trim());
  if (!ready.length) return null;
  // Fill mode with nothing missing = nothing to compose (no model call).
  if (
    fill &&
    existing?.ending &&
    ready.every((p) => !!existing.sections?.[p.id])
  )
    return existing;
  const sections = ready.map((p) => {
    // The REAL loop length, read from the code — the same estimate playback
    // times sections with. plan bars can disagree (a "8 bar" plan whose loop
    // came out 2 bars), and moves authored past the real length just clamp away.
    const bars = Math.max(1, computeLoopBars(p.strudel) || p.bars || 4);
    // The bar length the user picked for THIS loop (per-loop re-roll) — repeats
    // are gone; a loop's span is always one of its unfold's length options.
    const picked =
      onlySectionId === p.id && targetBars && targetBars > 0
        ? Math.min(256, Math.floor(targetBars))
        : null;
    return {
      id: p.id,
      label: p.label ?? "",
      intent: p.intent ?? "",
      bars,
      heldBars: picked,
      strudel: p.strudel!,
      instruments: p.tracks?.map((t) => t.label ?? null),
      kind: p.kind,
    };
  });
  const timeSignature = plan.timeSignature || "4/4";
  const arrangement = await composeSongArrangement(
    {
      genre: plan.genre,
      key: plan.key,
      bpm: plan.bpm,
      timeSignature,
      summary: plan.summary,
      sections,
      direction,
    },
    cfg,
  );
  if (!arrangement) return null;
  // Gate the one-way lines exactly like composed layers — what passes here plays there.
  const beats = beatsPerBar(timeSignature);
  const gate = async (code: string | undefined): Promise<boolean> => {
    const line = (code ?? "").trim();
    if (!line) return false;
    const errs = await layerGateErrors(
      line.startsWith("$") ? line : `$: ${line}`,
      plan.bpm,
      beats,
      timeSignature,
    );
    return errs.length === 0;
  };
  for (const spec of Object.values(arrangement.sections ?? {})) {
    if (!spec || !Array.isArray(spec.overlays)) continue;
    const kept = [];
    for (const o of spec.overlays) if (o && (await gate(o.code))) kept.push(o);
    spec.overlays = kept;
  }
  if (arrangement.ending?.code && !(await gate(arrangement.ending.code)))
    arrangement.ending = { ...arrangement.ending, code: undefined };
  // KNOBS AT BIRTH — one cheap low-effort call per written section names its
  // effects' knobs (the layer tweak-panel pattern); riding them is zero AI.
  // Best-effort: a failed dress lazily retries on the panel's first open.
  const dressSweeps = async (id: string, spec: SectionArrange) => {
    if (!spec.sweeps?.length) return;
    const s = sections.find((x) => x.id === id);
    const dressed = await enrichSweepControls(
      {
        genre: plan.genre,
        section: [s?.label, s?.intent].filter(Boolean).join(" — "),
        sweeps: spec.sweeps,
      },
      cfg,
    ).catch(() => null);
    if (dressed) spec.sweeps = dressed;
  };
  // A freshly composed spec CACHES itself (and carries prior lengths' takes)
  // so every length already heard swaps back instantly, zero AI.
  const withTakes = (id: string, spec: SectionArrange): SectionArrange => {
    const prev = existing?.sections?.[id];
    const natural = sections.find((x) => x.id === id)?.bars ?? 1;
    const takes: Record<string, SectionTake> = { ...(prev?.takes ?? {}) };
    if (prev)
      takes[String(Math.floor(prev.bars ?? natural))] = {
        moves: prev.moves,
        sweeps: prev.sweeps,
        layerCount: prev.layerCount,
      };
    takes[String(Math.floor(spec.bars ?? natural))] = {
      moves: spec.moves,
      sweeps: spec.sweeps,
      layerCount: spec.layerCount,
    };
    return { ...spec, takes };
  };
  // PER-LOOP: write only the target section (merge into the existing unfold),
  // leaving every other section and the ending as they were.
  if (onlySectionId) {
    let spec = arrangement.sections?.[onlySectionId];
    if (!spec) return null;
    await dressSweeps(onlySectionId, spec);
    spec = withTakes(onlySectionId, spec);
    await saveSongSectionSpec(songId, onlySectionId, spec, sql);
    return { sections: { [onlySectionId]: spec } };
  }
  // FILL: only the sections still without an unfold (+ a missing ending) land;
  // everything already shaped — at birth or by hand — stands untouched.
  const specs = arrangement.sections ?? {};
  const written: Record<string, SectionArrange> = {};
  await Promise.all(
    Object.entries(specs).map(async ([id, spec]) => {
      if (!spec) return;
      if (fill && existing?.sections?.[id]) return;
      await dressSweeps(id, spec);
      written[id] = withTakes(id, spec);
    }),
  );
  const merged: SongArrangement = fill
    ? {
        sections: { ...(existing?.sections ?? {}), ...written },
        ending: existing?.ending ?? arrangement.ending,
      }
    : { sections: written, ending: arrangement.ending };
  await saveSongArrangement(songId, merged, sql);
  return merged;
}

/**
 * LAZY KNOB DRESS (the on-open fallback, mirroring enrichPartLayer): a panel
 * opened on an effect that has no controls yet runs ONE low-effort call for
 * the whole section's sweeps and persists them. Idempotent — fully dressed
 * sweeps return as-is with no model call. Null = nothing usable (the next
 * open retries).
 */
export async function dressSectionSweeps(
  songId: string,
  sectionId: string,
  cfg: ClaudeConfig | undefined,
  sql: Sql = db(),
): Promise<SectionSweep[] | null> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  const plan = song?.plan as SongPlan | undefined;
  const spec = (
    (plan as { arrangement?: SongArrangement | null } | undefined)?.arrangement
      ?.sections ?? {}
  )[sectionId];
  if (!spec?.sweeps?.length) return null;
  if (spec.sweeps.every((w) => w?.controls?.length)) return spec.sweeps;
  const [part] = await sql<PartRow[]>`
    select label, intent from parts where id = ${sectionId} and song_id = ${songId}`;
  const dressed = await enrichSweepControls(
    {
      genre: plan?.genre,
      section: [part?.label, part?.intent].filter(Boolean).join(" — "),
      sweeps: spec.sweeps,
    },
    cfg,
  ).catch(() => null);
  if (!dressed) return null;
  await setSongSectionSweeps(songId, sectionId, dressed, sql);
  return dressed;
}

// ── CHAPTERS (2026-07-14) — the unfold, materialized as REAL LOOPS ────────────
// "Everything is just a loop", ONE CHAPTER AT A TIME (the user's design): the
// ✦ Chapter tap asks for the single next pass of a loop — never a batch built
// on the user's behalf. One call plans it (arrange-plan.composeNextChapter);
// materialization is pure code: a new part carrying the DUPLICATED track
// subset (panels ride along), inserted where the user tapped. An optional
// effect glides in with it, anchored to real part ids in plan.effects.
// Lineage lives in plan.chapters ({chapterPartId: rootPartId}) so later taps
// under a chapter continue the SAME loop's story.

/**
 * Compose + materialize the next chapter of `sourceId`'s loop, inserting the
 * new part at `position`. Returns the new part id (+ its effect, if one was
 * authored), or null when nothing usable came back.
 */
export async function composeNextChapterFor(
  songId: string,
  sourceId: string,
  /** Where the new pass lands; omitted = right after the lineage's last pass. */
  position: number | undefined,
  cfg: ClaudeConfig | undefined,
  sql: Sql = db(),
): Promise<{ partId: string } | "done" | null> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  const plan = song?.plan as SongPlan | undefined;
  if (!plan) return null;
  const lineage = (plan as { chapters?: Record<string, string> }).chapters ?? {};
  const rootId = lineage[sourceId] ?? sourceId;
  const parts = await getPartsOrdered(songId, sql);
  const root = parts.find((p) => p.id === rootId);
  if (!root?.strudel?.trim() || root.status !== "ready") return null;
  if (root.kind === "bridge" || root.kind === "break") return null;
  const tracks = root.tracks;
  if (!tracks || tracks.length < 2) return null;
  // The chapters already made from this loop, in play order — the model sees
  // each pass's name + layer subset matched back to the root's numbering.
  // Match by CODE first (chapter tracks are byte-copies of the root's, so this
  // is exact even when two layers share a label like "Synth"); label is the
  // edited-track fallback.
  const rootLabels = tracks.map((t) => (t.label || "").toLowerCase());
  const rootIndexOf = (t: LoopTrack): number => {
    const byCode = tracks.findIndex((rt) => rt.code === t.code);
    if (byCode >= 0) return byCode + 1;
    return rootLabels.indexOf((t.label || "").toLowerCase()) + 1;
  };
  const made = parts
    .filter((p) => lineage[p.id] === rootId && p.strudel?.trim())
    .map((p) => ({
      name: sentenceLabel(p.label || "Chapter"),
      layers: [
        ...new Set((p.tracks ?? []).map(rootIndexOf).filter((i) => i >= 1)),
      ].sort((a, b) => a - b),
    }));

  // ACT TRANSITIONS (2026-07-14, the user: "between blueprints it does not
  // seem like we have the most natural transition"): the FIRST loop of a
  // mid-song blueprint enters straight after another act's loop — give that
  // seam to the model so the entrance answers what's already playing. Later
  // passes follow their own siblings; only the first needs the outside world.
  const rootsSet = new Set(Object.values(lineage));
  const rootAt = parts.findIndex((p) => p.id === rootId);
  let before: { label: string; strudel: string } | null = null;
  if (!made.length && rootAt > 0) {
    for (let i = rootAt - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.strudel?.trim() && p.status === "ready" && !rootsSet.has(p.id)) {
        before = { label: sentenceLabel(p.label || "Loop"), strudel: p.strudel };
        break;
      }
    }
  }

  const composed = await composeNextChapter(
    {
      genre: plan.genre,
      key: plan.key,
      bpm: plan.bpm,
      timeSignature: plan.timeSignature || "4/4",
      summary: plan.summary,
      section: {
        id: root.id,
        label: root.label ?? "",
        intent: root.intent ?? "",
        bars: Math.max(1, computeLoopBars(root.strudel) || root.bars || 4),
        strudel: root.strudel,
        instruments: tracks.map((t) => t.label ?? null),
        kind: root.kind,
      },
      made,
      before,
    },
    cfg,
  ).catch(() => null);
  if (!composed) return null;
  if (composed === "done") return "done";

  const beats = beatsPerBar(plan.timeSignature || "4/4");
  const ts = plan.timeSignature || "4/4";
  const subset: LoopTrack[] = [];
  for (const i of composed.layers) {
    const t = JSON.parse(JSON.stringify(tracks[i - 1])) as LoopTrack;
    // VARIATION — the same voice saying something new in this loop. Every
    // varied line passes the composed-layer gate; a failure keeps the
    // original line (the loop never breaks for a bad variation).
    const v = composed.vary?.[i];
    if (v) {
      const line = v.trim().startsWith("$") ? v.trim() : `$: ${v.trim()}`;
      const errs = await layerGateErrors(line, plan.bpm, beats, ts).catch(() => ["gate failed"]);
      if (errs.length === 0) {
        t.code = line;
        t.notation = line.replace(/^\$\s*:\s*/, "");
      }
    }
    subset.push(t);
  }
  const code = mergeTracksKeepVisual(subset, plan.bpm, beats, root.strudel);
  const label =
    composed.name || `${sentenceLabel(root.label || "Pass")} ${made.length + 2}`;
  // Land right after the lineage's LAST pass (or the root itself) unless the
  // caller pinned a spot — the unfolding reads top-to-bottom, in order.
  const lineageParts = parts.filter((p) => lineage[p.id] === rootId);
  const lastOfLineage = lineageParts.length
    ? lineageParts[lineageParts.length - 1]
    : root;
  const at = position ?? lastOfLineage.position + 1;
  const row = await injectPart(
    songId,
    at,
    label,
    root.intent ?? "",
    root.bars ?? 8,
    "loop",
    sql,
  );
  await sql`
    update parts
    set strudel = ${code},
        tracks = ${sql.json(subset as unknown as Parameters<typeof sql.json>[0])},
        sounds = ${root.sounds ? sql.json(root.sounds as unknown as Parameters<typeof sql.json>[0]) : null},
        status = 'ready'
    where id = ${row.id}`;
  await recordChapterOrigin(songId, row.id, rootId, sql);
  return { partId: row.id };
}

/**
 * THE UNFOLDING (2026-07-14, the user): a finished loop spreads its wings on
 * its own — pass after pass materializing as real loops, watchable in real
 * time (each lands before the next is asked for; the client's generating poll
 * draws them in as they appear). One HIGH call per pass; the model says done
 * (or the cap ends it); a loop that already has passes never re-unfolds.
 */
export async function unfoldLoopParts(
  songId: string,
  rootId: string,
  cfg: ClaudeConfig | undefined,
  runStep: StepRunner,
  /** DB access per unit of work — a durable step can re-run in a different
   *  invocation, so each one must open a FRESH client (the workflow passes
   *  its withSql; dev passes a closure over its local client). */
  withDb: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>,
): Promise<void> {
  const MAX_PASSES = 8; // safety net only — the model's {"done": true} is the real end
  // Idempotence: a regenerated/retried loop that already unfolded stays as
  // the user left it.
  const lineage = await withDb(async (sql) => {
    const [song] = await sql<SongRow[]>`select plan from songs where id = ${songId}`;
    return (
      ((song?.plan as SongPlan | undefined) as
        | { chapters?: Record<string, string> }
        | undefined)?.chapters ?? {}
    );
  });
  if (Object.values(lineage).includes(rootId)) return;
  // Mark the blueprint mid-unfold — the client shows it as raw material, not
  // a loop, from this moment on.
  await withDb((sql) => setSongUnfolding(songId, rootId, true, sql)).catch(() => {});
  const childIds: string[] = [];
  try {
    for (let k = 0; k < MAX_PASSES; k++) {
      const made = await runStep(`unfold-${rootId}-${k + 1}`, () =>
        withDb((sql) => composeNextChapterFor(songId, rootId, undefined, cfg, sql)),
      ).catch(() => null);
      if (!made || made === "done") break;
      childIds.push(made.partId);
    }
    // THE EFFECTS WALK — motion authored over the FINISHED sequence (an
    // effect is a cross-loop object; from inside one loop's call it always
    // came back one loop wide), ONE GLIDE PER PASS like the unfold itself:
    // each pass sees everything already riding and answers with the next
    // glide or {"done": true}. Each lands (knobs dressed) as it's authored —
    // an already-playing song hears it seconds later. Best-effort.
    if (childIds.length > 0) {
      // say so — the page's strip flips to "writing the effects…" live
      await withDb((sql) => setSongUnfolding(songId, rootId, "fx", sql)).catch(() => {});
      for (let k = 0; k < MAX_FX_PASSES; k++) {
        const added = await runStep(`unfold-fx-${rootId}-${k + 1}`, () =>
          withDb((sql) => authorNextUnfoldFx(songId, rootId, childIds, cfg, sql)),
        ).catch(() => null);
        if (added !== "added") break;
      }
    }
  } finally {
    // The blueprint STAYS (2026-07-14, the user): it's the song's raw
    // material, kept visible and inspectable forever — playback simply
    // excludes it once children exist (plan.chapters lineage marks it).
    await withDb((sql) => setSongUnfolding(songId, rootId, false, sql)).catch(
      () => {},
    );
  }
}

/** One pass of the effects walk: read the piece and every glide already
 *  riding it fresh from the DB, ask for the NEXT glide, dress its knobs, land
 *  it. "added" keeps the walk going; "done" ends it (the model's call). */
const MAX_FX_PASSES = 8; // safety net only — the model's {"done": true} is the real end
async function authorNextUnfoldFx(
  songId: string,
  rootId: string,
  childIds: string[],
  cfg: ClaudeConfig | undefined,
  sql: Sql,
): Promise<"added" | "done"> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  const plan = song?.plan as SongPlan | undefined;
  if (!plan) return "done";
  const parts = await getPartsOrdered(songId, sql);
  const root = parts.find((p) => p.id === rootId);
  const tracks = root?.tracks;
  if (!root?.strudel?.trim() || !tracks) return "done";
  const rootLabels = tracks.map((t) => (t.label || "").toLowerCase());
  const rootIndexOf = (t: LoopTrack): number => {
    const byCode = tracks.findIndex((rt) => rt.code === t.code);
    if (byCode >= 0) return byCode + 1;
    return rootLabels.indexOf((t.label || "").toLowerCase()) + 1;
  };
  const children = childIds
    .map((id) => parts.find((p) => p.id === id))
    .filter((p): p is PartRow => !!p?.strudel?.trim());
  if (!children.length) return "done";
  const loops = children.map((p) => ({
    name: sentenceLabel(p.label || "Loop"),
    layers: [
      ...new Set((p.tracks ?? []).map(rootIndexOf).filter((i) => i >= 1)),
    ].sort((x, y) => x - y),
  }));
  // Everything already riding these loops — this walk's earlier passes AND
  // any glide the user has born by hand — in the loop numbers the model sees.
  const loopNo = (id: string): number =>
    children.findIndex((c) => c.id === id) + 1;
  const riding = ((plan.effects ?? []) as SongFx[])
    .filter((e) => loopNo(e.fromId) >= 1 && loopNo(e.toId) >= 1)
    .map((e) => ({
      name: e.name,
      param: e.param,
      fromLoop: loopNo(e.fromId),
      toLoop: loopNo(e.toId),
    }));
  const rootBars = Math.max(1, computeLoopBars(root.strudel) || root.bars || 4);
  const next = await composeNextUnfoldFx(
    {
      genre: plan.genre,
      key: plan.key,
      bpm: plan.bpm,
      timeSignature: plan.timeSignature || "4/4",
      summary: plan.summary,
      section: {
        id: root.id,
        label: root.label ?? "",
        intent: root.intent ?? "",
        bars: rootBars,
        strudel: root.strudel,
        instruments: tracks.map((t) => t.label ?? null),
        kind: root.kind,
      },
      loops,
      riding,
    },
    cfg,
  ).catch(() => null);
  if (!next || next === "done") return "done";
  let fx: SongFx = {
    id: crypto.randomUUID(),
    param: next.param,
    from: next.from,
    to: next.to,
    curve: next.curve,
    ...(next.name ? { name: next.name } : {}),
    home: { from: next.from, to: next.to },
    fromId: children[next.fromLoop - 1].id,
    toId: children[next.toLoop - 1].id,
  };
  // KNOBS AHEAD OF TIME — the glide lands already dressed (best-effort).
  const dressed = await enrichSweepControls(
    {
      genre: plan.genre,
      section: [root.label, root.intent].filter(Boolean).join(" — "),
      sweeps: [
        {
          param: next.param,
          from: next.from,
          to: next.to,
          bar: 0,
          bars: rootBars * (next.toLoop - next.fromLoop + 1),
          curve: next.curve,
          name: next.name,
        },
      ],
    },
    cfg,
  ).catch(() => null);
  if (dressed?.[0]?.controls?.length) fx = { ...fx, controls: dressed[0].controls };
  await appendSongEffects(songId, [fx], sql);
  return "added";
}

/** Flip a blueprint's mid-unfold flag (plan.unfolding[rootId]). */
async function setSongUnfolding(
  songId: string,
  rootId: string,
  on: boolean | "fx", // "fx" = the loops are done, the effects walk is writing
  sql: Sql,
): Promise<void> {
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      '{unfolding}',
      coalesce(plan->'unfolding', '{}'::jsonb) || ${sql.json({ [rootId]: on } as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId}`;
}

/** Record a chapter's lineage (plan.chapters[chapterId] = rootId). */
async function recordChapterOrigin(
  songId: string,
  chapterId: string,
  rootId: string,
  sql: Sql,
): Promise<void> {
  await sql`
    update songs
    set plan = jsonb_set(
      plan,
      '{chapters}',
      coalesce(plan->'chapters', '{}'::jsonb) || ${sql.json({ [chapterId]: rootId } as Parameters<typeof sql.json>[0])}
    )
    where id = ${songId}`;
}

/**
 * Framework-neutral job core. No Cloudflare imports — these plain async
 * functions do the AI + DB work. The Workflows worker wraps each unit in a
 * durable `step.do(...)`; the local-dev fallback awaits them directly.
 */

function planOf(song: SongRow): SongPlan {
  const p = song.plan as SongPlan;
  if (!p || !Array.isArray(p.parts)) {
    throw new Error(`song ${song.id} has no overview plan`);
  }
  return p;
}

/**
 * Generate a single part: set it generating, call Claude with the plan + all
 * already-ready parts (in order) + this part's intent, write the result ready.
 * Idempotent enough to retry as its own durable step.
 */
/**
 * Write a derived workspace identity onto an ALREADY-CREATED song (the async
 * voice flow: the row exists and the user is already on its page while the
 * AI transcribes + plans). Direct writes — saveOverview would DELETE the
 * placeholder part and flip the status mid-flight.
 */
export async function applyDerivedWorkspace(
  songId: string,
  partId: string,
  d: {
    title: string;
    genre: string;
    bpm: number;
    key: string;
    timeSignature: string;
    label: string;
    intent: string;
    bars: number;
  },
  firstLoop: string,
  sql: Sql = db(),
): Promise<void> {
  const plan: SongPlan = {
    summary: "",
    bpm: d.bpm,
    key: d.key,
    genre: d.genre || undefined,
    timeSignature: d.timeSignature,
    parts: [],
  };
  await sql`
    update songs
    set plan = ${sql.json(plan as unknown as Parameters<typeof sql.json>[0])},
        title = ${d.title},
        global_prompt = ${(firstLoop || d.intent).slice(0, 2000)}
    where id = ${songId}`;
  await sql`
    update parts
    set label = ${d.label}, intent = ${d.intent}, bars = ${d.bars}
    where id = ${partId}`;
}

/** RETRY THE IDEA TOO (2026-07-13, the user): when the creation-time derive call failed, the
 *  song was saved with the safe defaults ("Untitled" / 120 / A minor, intent = the raw request)
 *  and flagged plan.underived — and "Try again" only ever re-ran composition against those
 *  defaults, never the idea call. The generate route calls this on any (re)try of an underived
 *  song: re-run the derive from the stored raw request and land the real identity before
 *  composing. Conservative merges — a title or intent the user has since written themselves is
 *  kept, and the rest of the plan (visual, breaks, settings) is untouched. A derive that fails
 *  AGAIN leaves the flag in place so the next retry tries once more. */
export async function rederiveSongIdentity(
  songId: string,
  cfg?: ClaudeConfig,
  sql: Sql = db(),
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) return;
  const plan = planOf(song) as SongPlan & { underived?: boolean };
  if (!plan.underived) return;
  const raw = (song.global_prompt || "").trim();
  if (!raw) return;
  const d = await deriveWorkspaceFromLoop(raw, cfg);
  if (d.fallback) return;
  const { underived: _drop, ...rest } = plan;
  void _drop;
  const next: SongPlan = {
    ...rest,
    bpm: d.bpm,
    key: d.key,
    genre: d.genre || rest.genre,
    timeSignature: d.timeSignature,
  };
  await sql`
    update songs
    set plan = ${sql.json(next as unknown as Parameters<typeof sql.json>[0])},
        title = case when title in ('Untitled', 'untitled') then ${d.title} else title end
    where id = ${songId}`;
  await sql`
    update parts
    set label = case when label is null or label = '' or label = 'Intro' then ${d.label} else label end,
        intent = ${d.intent}
    where song_id = ${songId} and position = 0
      and (intent is null or intent = '' or intent = ${raw})`;
}

export async function generateOnePart(
  songId: string,
  partId: string,
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  const plan = planOf(song);

  const parts = await getPartsOrdered(songId, sql);
  const target = parts.find((p) => p.id === partId);
  if (!target) throw new Error(`part ${partId} not found on song ${songId}`);

  await setPartStatus(partId, "generating", sql);
  // RETRY = A FRESH TAKE (dev parity with the Workflow's mark step): drop the failed run's
  // leftover partial layers so the retry composes — and the page shows — a clean part.
  await sql`update parts set tracks = null, strudel = null, strudel_mobile = null where id = ${partId}`;

  // Prior context = every part before this one that already has code.
  const priorParts: GeneratedPartRef[] = parts
    .filter((p) => p.position < target.position && p.strudel)
    .map((p) => ({ label: p.label ?? "", strudel: p.strudel as string }));

  try {
    const composed = await composePart(
      plan,
      priorParts,
      {
        label: target.label ?? "",
        intent: target.intent ?? "",
        bars: target.bars ?? 8,
        kind:
          target.kind === "bridge" || target.kind === "break"
            ? target.kind
            : "loop",
      },
      cfg,
      inlineRunner, // dev: no Workflow steps, run the loop in-process
      partId,
      buildArrangement(parts, target.position),
      (msg) => setPartMessage(partId, msg, sql), // live narration → the part row
    );
    await writePartComposition(
      partId,
      composed.code,
      composed.score,
      composed.sounds,
      composed.tracks,
      "ready",
      sql,
    );
    // ENRICH AT BIRTH, dev parity — every layer's tweak panel right after the
    // ready write (idempotent per layer; best-effort like the visual below).
    try {
      await enrichPartTracks(songId, partId, cfg, sql);
    } catch (e) {
      console.error("[klappn] dev enrich sweep failed", e);
    }
    // (THE UNFOLDING removed 2026-07-16, the user: one prompt = one loop.)
    // AUTO-VISUALS, dev parity: the Workflow paints in parallel with the first loop's
    // layers; dev has no streaming sink, so paint sequentially AFTER the loop lands
    // when the song has none yet (dev is a preview — wall-clock doesn't matter).
    // Best-effort: the loop is already ready; a visual hiccup must never mark it error.
    try {
      const anyVisual =
        !!plan.visual?.hydra ||
        (await getPartsOrdered(songId, sql)).some((p) => p.strudel && hasHydra(p.strudel));
      if (!anyVisual) {
        const music = stripMetaBlocks(stripHydraBlock(composed.code));
        const v = await paintSongVisual(music, plan, target.intent ?? undefined, cfg);
        if (v) {
          await saveSongVisual(songId, v, sql);
          await attachSongVisualEverywhere(songId, v, sql);
        }
      }
    } catch (e) {
      console.error("[klappn] dev auto-visuals failed", e);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await setPartStatus(partId, "error", sql, `compose failed: ${reason}`.slice(0, 500));
    throw err;
  }
}

/** Guarantee a per-layer VOLUME knob. Every layer's own `gain` is usually a pattern/LFO a slider can't
 *  ride, so we give each track a `.postgain(level)` — a scalar AFTER the layer's gain — and a "Volume"
 *  control bound to it (×1 = unity). Idempotent; carries the layer's current level if it already has one. */
export function ensureVolumeKnob(track: LoopTrack): LoopTrack {
  // Dedupe the panel so a layer never shows two of the same slider (the "two Volume knobs" bug:
  // enrich gave the layer a "Volume" on `gain` while the system adds the canonical one on
  // `postgain`). Drop any `gain` control outright — Volume is canonically POSTGAIN, which rides
  // OVER the layer's PATTERNED gain, so a raw `gain` slider both DUPLICATES the Volume chip and
  // would flatten the gain dynamics if moved — then keep only the FIRST control per param.
  const seen = new Set<string>();
  const cleaned = (track.controls ?? []).filter((c) => {
    if (c.param === "gain") return false;
    if (seen.has(c.param)) return false;
    seen.add(c.param);
    return true;
  });
  const existing = cleaned.find((c) => c.param === "postgain");
  const level = existing?.value ?? 1;
  const code = /\.postgain\(/.test(track.code) ? track.code : `${track.code}.postgain(${level})`;
  if (existing)
    return code === track.code && cleaned.length === (track.controls?.length ?? 0)
      ? track
      : { ...track, code, controls: cleaned };
  const vol: TrackControl = { name: "Volume", param: "postgain", min: 0, max: 2, value: 1 };
  return { ...track, code, controls: [vol, ...cleaned] };
}

/** A part is "engine-native" — built by the current layer engine — if every track carries its source in
 *  `notation` (the layer's Strudel body). Those edit/re-bar the SAME way they were made
 *  (editNativePart / convertNativePartMeter); older parts (score / legacy) do not. */
function engineNativeTracks(part: PartRow): LoopTrack[] | null {
  const tr = (part.tracks as LoopTrack[] | null) ?? [];
  return tr.length && tr.every((t) => t.notation) ? tr : null;
}

/** Edit ONE engine-native part the SAME way it was generated: rewrite the loop's notation with the
 *  change in one call, then apply ONLY the layers whose notation changed (others stay verbatim),
 *  re-merge (keeping visuals), and persist. Returns the new code, or null if the model failed / changed
 *  the shape (caller falls back). Skips the @controls string machinery — a native part's tweak UI is its
 *  tracks. */
async function editNativePart(
  plan: SongPlan,
  part: PartRow,
  tracks0: LoopTrack[],
  change: string,
  pills: string[] | null,
  cfg: ClaudeConfig | undefined,
  sql: Sql,
  neighbours: { label: string; side: "before" | "after"; strudel?: string | null }[] = [],
): Promise<string | null> {
  const target: PlanPart = {
    label: part.label ?? "this section",
    intent: part.intent ?? "",
    bars: part.bars ?? 8,
    kind: part.kind as PlanPart["kind"],
  };
  // SONG-AWARE: the edit is composed with the neighbouring sections in the brief (same as the
  // natural-language edit path), so a reworked loop still flows with the sections around it.
  const editBrief = buildBrief(plan, target, neighbours);
  // 1) Rewrite the whole loop's notation with the change, in ONE call — `notation` IS the playable
  //    Strudel body (no compile step).
  const newNotations = await editStrudelLoop(
    tracks0.map((t) => ({ label: t.label, notation: t.notation ?? "" })),
    editBrief,
    change,
    cfg,
  ).catch(() => null);
  if (!newNotations) return null; // shape changed / model failed → caller keeps the original loop
  const beats = beatsPerBar(plan.timeSignature);
  const ts = plan.timeSignature ?? "4/4";
  // 2) Apply ONLY the layers whose notation changed (the rest stay byte-for-byte); keep prior on failure.
  const out = tracks0.map((t) => ({ ...t }));
  for (let i = 0; i < out.length && i < newNotations.length; i++) {
    if (newNotations[i] === (out[i].notation ?? "")) continue; // unchanged → keep the layer
    let fixed = autoFixRender(`$: ${newNotations[i]}`, plan.bpm);
    if ((await layerGateErrors(fixed, plan.bpm, beats, ts)).length) continue;
    const pg = out[i].code.match(/\.postgain\(\s*([\d.]+)\s*\)/)?.[1]; // carry the user's Volume across the edit
    if (pg && !/\.postgain\(/.test(fixed)) fixed = `${fixed}.postgain(${pg})`;
    out[i] = { ...out[i], code: fixed, notation: newNotations[i] };
  }
  const finalTracks = out.map(ensureVolumeKnob);
  let code = mergeTracksKeepVisual(finalTracks, plan.bpm, beats, part.strudel);
  if (pills?.length) code = `/* @edits\n${JSON.stringify(pills)}\n*/\n${code}`;
  await writePartComposition(part.id, code, null, null, finalTracks, "ready", sql);
  return code;
}

/**
 * Apply ONE tapped edit pill to ONE loop — the variant engine. Pills are
 * SIBLINGS, not a stack: every variant derives from the ORIGINAL composition
 * (snapshotted on first use), so tapping "Darker pads" after "Half-time drums"
 * replaces it rather than piling on. The loop keeps its visuals and its pill
 * list; tweak sliders + instrument swaps are regenerated for the new code so
 * the Tweak panel always matches what's playing. On ANY failure the loop is
 * put back exactly as it was (never an error state that invites a regenerate).
 */
export async function applyPartEdit(
  songId: string,
  partId: string,
  pill: string,
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  const plan = planOf(song);
  const parts = await getPartsOrdered(songId, sql);
  const part = parts.find((p) => p.id === partId);
  if (!part?.strudel?.trim()) throw new Error(`part ${partId} has no music`);

  await snapshotPartOriginal(partId, sql);
  // Re-read so the snapshot is visible (first-ever variant on this part).
  const [fresh] = await sql<PartRow[]>`select * from parts where id = ${partId}`;
  const base = fresh?.original_strudel ?? part.strudel;

  await setPartStatus(partId, "generating", sql);
  await setPartMessage(partId, `Reworking this loop — “${pill}”…`, sql);

  const revert = async () => {
    await setPartMessage(partId, "", sql);
    await setPartStatus(partId, "ready", sql);
  };

  try {
    const hydra = extractHydra(part.strudel); // keep the CURRENT visuals
    const vBlock = part.strudel.match(/\/\*\s*@vcontrols\b[\s\S]*?\*\//)?.[0];
    const vLooks = part.strudel.match(/\/\*\s*@vlooks\b[\s\S]*?\*\//)?.[0];
    // The pill list survives every variant — and a CUSTOM pill the user typed
    // becomes part of this loop's vocabulary (re-tappable forever, cached).
    const pills = parseEdits(base);
    if (!pills.includes(pill)) pills.push(pill);
    const music = stripMetaBlocks(stripHydraBlock(base));

    // NATIVE-FIRST: a part built by the current engine carries each layer's Strudel body in `notation`,
    // so edit it the SAME way it was made — rewrite the notation with the change, re-gate, never
    // hand-patch merged code. Older parts (score / legacy) have no per-track notation and fall through.
    const tnative = engineNativeTracks(part);
    if (tnative) {
      const edited = await editNativePart(
        plan,
        part,
        tnative,
        pill,
        pills,
        cfg,
        sql,
        editNeighbours(parts, parts.findIndex((p) => p.id === partId), planBreaksOf(song)),
      );
      if (edited) {
        await setPartEditChoice(partId, pill, sql);
        await saveVariantSnapshot(partId, pill, edited, sql);
        await setPartMessage(partId, "", sql);
        return;
      }
      // the model changed the shape / failed → fall through to the legacy Strudel edit.
    }

    const check = async (candidate: string) => {
      const problems = await strudelServerErrors(candidate, {
        bpm: plan.bpm,
        timeSignature: plan.timeSignature,
      });
      return { ok: problems.length === 0, problems };
    };

    // SCORE-FIRST: revise the music at the SCORE level (GLM), then re-render every
    // affected track through the shared core (Kimi, one track at a time) — an edit
    // obeys the same plan→instruments→track-by-track invariant as a fresh compose.
    // Variants stay SIBLINGS of the original: we edit the part's ORIGINAL score
    // (never overwritten by a variant) and persist only the strudel. Parts with no
    // saved score (composed before scores were persisted) fall back to the
    // monolithic single-call edit on the same code model.
    let deconflicted: string;
    if (part.score) {
      try {
        const editedScore = await editLoopScore(
          {
            plan,
            score: part.score,
            change: pill,
            sectionLabel: part.label ?? "this section",
          },
          cfg,
        );
        const composed = await composeFromScore(
          plan,
          editedScore,
          part.sounds ?? null,
          cfg,
          inlineRunner,
          `${partId}-edit`,
        );
        deconflicted = composed.code;
      } catch (e) {
        console.error(
          `[klappn] score-first variant “${pill}” for part ${partId} failed — keeping the current version:`,
          e,
        );
        await revert();
        return;
      }
    } else {
      let edited = await editPart(
        { plan, label: part.label ?? "this section", music, change: pill },
        cfg,
      );
      let verdict = await check(edited);
      if (!verdict.ok) {
        // ONE guided repair instead of a silent revert — the model gets told
        // exactly what broke. (Bounded: a second failure still reverts.)
        await setPartMessage(partId, `Polishing “${pill}”…`, sql);
        edited = await editPart(
          {
            plan,
            label: part.label ?? "this section",
            music,
            change: pill,
            previous: edited,
            feedback: verdict.problems.join("; "),
          },
          cfg,
        );
        verdict = await check(edited);
      }
      if (!verdict.ok) {
        console.error(
          `[klappn] variant “${pill}” for part ${partId} failed checks twice — keeping the current version`,
        );
        await revert();
        return;
      }
      deconflicted = wireSidechain(assignReverbOrbits(edited));
    }
    await setPartMessage(partId, "Wiring up the new tweaks…", sql);

    // Fresh sliders + instrument options for the NEW code (LOW thinking,
    // concurrent) — so Tweak always describes the variant you're hearing.
    const [tweaked, swaps] = await Promise.all([
      (async () => {
        const ai = await parameterizePart(deconflicted, cfg).catch(
          () => deconflicted,
        );
        if (ai !== deconflicted) {
          if ((await strudelBuildErrors(ai)).length === 0) return ai;
        }
        // AI pass failed → deterministic mixer so the variant NEVER arrives
        // slider-less; the label pass (best-effort) names the knobs.
        const det = parameterize(deconflicted);
        if (!/@controls/.test(det)) return deconflicted;
        return await labelControls(det, cfg).catch(() => det);
      })(),
      suggestSounds(deconflicted, cfg).catch(() => ""),
    ]);

    // The user's current knob settings ride onto every knob the fresh take
    // shares (tweaks are the USER'S intent — never reset by a style switch).
    let out = carryControlValues(part.strudel, bakeControlDefaults(tweaked));
    if (swaps) out = `/* @swaps\n${swaps}\n*/\n${out}`;
    if (pills.length) out = `/* @edits\n${JSON.stringify(pills)}\n*/\n${out}`;
    if (hydra) {
      out = attachHydraBlock(out, hydra);
      if (vBlock) out = out.replace("/* @hydra", `${vBlock}\n\n/* @hydra`);
      if (vLooks) out = out.replace("/* @hydra", `${vLooks}\n\n/* @hydra`);
    }

    await writePartStrudel(partId, out, "ready", sql);
    await setPartEditChoice(partId, pill, sql);
    // Remember the take — re-tapping this pill restores it instantly, ever
    // after (the model is never asked twice for the same change).
    await saveVariantSnapshot(partId, pill, out, sql);
    await setPartMessage(partId, "", sql);
  } catch (err) {
    await revert();
    throw err;
  }
}

/**
 * Change the song's TIME SIGNATURE — rewrites EVERY loop, strictly IN
 * SEQUENCE (loop 1 from x→y, then loop 2, then 3…), each via a high-effort
 * Fable-5 rewrite exactly like an edit pill. The plan flips first (so section
 * math and every converted loop agree on the new meter), then the loops
 * convert one by one with live per-loop progress. A loop that fails its
 * checks twice keeps its old code (flagged in the log) rather than killing
 * the run. Conversion REBASES each loop: old-meter take caches and Original
 * snapshots are cleared (restoring one would mix meters).
 */
/** Step 1 of a meter change: flip the PLAN (playback bar math + the appended
 *  setcpm follow it, and every loop converted after is written against it) and
 *  return the conversion queue. Returns fromTs === toTs when nothing to do. */
export async function flipSongMeterPlan(
  songId: string,
  toTs: string,
  sql: Sql = db(),
): Promise<{ fromTs: string; partIds: string[] }> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) throw new Error(`song ${songId} not found`);
  const plan = planOf(song);
  const fromTs = plan.timeSignature || "4/4";
  const parts = await getPartsOrdered(songId, sql);
  const partIds = parts.filter((p) => p.strudel?.trim()).map((p) => p.id);
  if (fromTs !== toTs) {
    const rawPlan = (song.plan ?? {}) as Record<string, unknown>;
    await sql`
      update songs
      set plan = ${sql.json({ ...rawPlan, timeSignature: toTs } as unknown as Parameters<typeof sql.json>[0])}
      where id = ${songId}`;
  }
  return { fromTs, partIds };
}

/** Convert ONE loop to the new meter (up to 2 model calls: convert + one
 *  guided repair). NEVER throws — a loop that fails its checks twice keeps its
 *  old code, so one stubborn loop can't kill the sequence. Designed to run as
 *  its OWN Workflow step: a whole-song sequence in one step blows the ~5-min
 *  per-step wall on any song with 3+ loops. */
/** Re-bar an engine-native loop into a new meter the SAME way it was built: rewrite each layer's
 *  notation into the new beats-per-bar (convertStrudelMeter), re-gate with the NEW beats, merge. Returns
 *  the new code, or null (a layer dropped / failed its gate) so the caller falls back to the legacy
 *  convert. Re-bars from the original `notation` — minor per-knob tweaks reset, fine for a re-phrase. */
async function convertNativePartMeter(
  plan: SongPlan,
  part: PartRow,
  tracks0: LoopTrack[],
  fromTs: string,
  toTs: string,
  cfg: ClaudeConfig | undefined,
  sql: Sql,
): Promise<string | null> {
  const toBeats = beatsPerBar(toTs);
  // Re-bar each layer's notation — the new notation IS the line (validate as-is). Whole loop kept
  // together — any one layer failing keeps the original (fallback).
  const newNotations = await convertStrudelMeter(
    tracks0.map((t) => ({ label: t.label, notation: t.notation ?? "" })),
    fromTs,
    toTs,
    toBeats,
    cfg,
  ).catch(() => null);
  if (!newNotations) return null;
  const out = tracks0.map((t) => ({ ...t }));
  for (let i = 0; i < out.length && i < newNotations.length; i++) {
    let fixed = autoFixRender(`$: ${newNotations[i]}`, plan.bpm);
    if ((await layerGateErrors(fixed, plan.bpm, toBeats, toTs)).length)
      return null;
    const pg = out[i].code.match(/\.postgain\(\s*([\d.]+)\s*\)/)?.[1]; // carry the user's Volume across
    if (pg && !/\.postgain\(/.test(fixed)) fixed = `${fixed}.postgain(${pg})`;
    out[i] = { ...out[i], code: fixed, notation: newNotations[i] };
  }
  const finalTracks = out.map(ensureVolumeKnob);
  const code = mergeTracksKeepVisual(finalTracks, plan.bpm, toBeats, part.strudel);
  await writePartComposition(part.id, code, null, null, finalTracks, "ready", sql);
  return code;
}

/**
 * SELF-HEAL — a loop threw a runtime error in the browser player; rectify it. Given the console error,
 * rewrite ONLY what's broken (repairStrudelLoop, HIGH) from the part's CURRENT server code (never trust
 * the client's whole program — see the surgical-edit note on the PATCH route), map the fixed `$:` lines
 * back onto the tracks (keeping each layer's panel + Volume), re-merge (keeping visuals), and — crucially —
 * ONLY persist if the repaired loop actually passes the deterministic play-time gate (real methods / build
 * / silent sounds). Returns the new merged code, or null (nothing usable / still broken → the caller keeps
 * the old loop and surfaces the failure). Inline, ONE model call — fast enough to auto-run on the error.
 */
export async function repairPart(
  songId: string,
  partId: string,
  consoleError: string,
  cfg?: ClaudeConfig,
): Promise<string | null> {
  const sql = db();
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) return null;
  const plan = planOf(song);
  const beats = beatsPerBar(plan.timeSignature);
  const ts = plan.timeSignature ?? "4/4";
  // Scope to THIS song — a foreign partId must not be repairable via an owned song.
  const [part] = await sql<PartRow[]>`select * from parts where id = ${partId} and song_id = ${songId}`;
  if (!part?.strudel?.trim()) return null;
  const tracks0 = (part.tracks as LoopTrack[] | null) ?? [];
  // Repair from the MUSIC only (strip visuals/meta) — mergeTracksKeepVisual re-attaches the hydra.
  const music = stripMetaBlocks(stripHydraBlock(part.strudel));
  // Some browser errors name NOTHING (e.g. "no soundfont zone found for preset" — upstream
  // swallows the sound + pitch from the message). Run the server eval over the current code and
  // hand the model its findings too, so a vague console error still points at the exact fault.
  const known = await strudelServerErrors(music, { bpm: plan.bpm, timeSignature: ts }).catch(
    () => [] as string[],
  );
  const errorContext = known.length
    ? `${consoleError}\n\nSERVER ANALYSIS of the current code — the concrete faults behind the error, fix exactly these:\n${known.join("\n")}`
    : consoleError;
  const fixed = await repairStrudelLoop(
    music,
    errorContext,
    { bpm: plan.bpm, key: plan.key, timeSignature: ts },
    cfg,
  ).catch(() => null);
  if (!fixed?.length) return null;
  // Map the fixed $: lines back onto the tracks when the count matches (keep each layer's panel + Volume);
  // if the model changed the shape, rebuild minimal tracks so parts.tracks stays in sync with parts.strudel.
  let tracks: LoopTrack[];
  if (tracks0.length === fixed.length) {
    tracks = tracks0.map((t, i) => {
      let line = autoFixRender(`$: ${fixed[i]}`, plan.bpm);
      const pg = t.code.match(/\.postgain\(\s*([\d.]+)\s*\)/)?.[1]; // carry the user's Volume across
      if (pg && !/\.postgain\(/.test(line)) line = `${line}.postgain(${pg})`;
      return { ...t, code: line, notation: fixed[i] };
    });
  } else {
    tracks = fixed.map((b, i) =>
      ensureVolumeKnob({
        code: autoFixRender(`$: ${b}`, plan.bpm),
        label: quickTrackLabel(`$: ${b}`, i),
        controls: [],
        pills: [],
        notation: b,
      }),
    );
  }
  const finalTracks = tracks.map(ensureVolumeKnob);
  const merged = mergeTracksKeepVisual(finalTracks, plan.bpm, beats, part.strudel);
  // FINAL GATE — never ship a still-broken loop: only persist a repair that passes the same crash/silent
  // gate the generator uses. If it still fails, keep the old loop (the caller tells the user to regenerate).
  if ((await strudelServerErrors(merged, { bpm: plan.bpm, timeSignature: ts })).length) return null;
  await writePartComposition(partId, merged, null, null, finalTracks, "ready", sql);
  return merged;
}

/**
 * SELF-HEAL for VISUALS — the browser reported that this loop's Hydra visual errored at playback; fix it
 * (parallel of repairPart, but for the @hydra block). Repairs ONLY the visual (repairHydra), re-checks it
 * with the deterministic Hydra gate (never ship a still-broken visual), splices the fix back into the @hydra
 * block (leaving the music + control blocks untouched), and persists. Returns the new full code, or null.
 */
export async function repairPartVisual(
  songId: string,
  partId: string,
  visualError: string,
  cfg?: ClaudeConfig,
): Promise<string | null> {
  const sql = db();
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) return null;
  const plan = planOf(song);
  // Scope to THIS song — a foreign partId must not be repairable via an owned song.
  const [part] = await sql<PartRow[]>`select * from parts where id = ${partId} and song_id = ${songId}`;
  if (!part?.strudel?.trim()) return null;
  const hydra = extractHydra(part.strudel);
  if (!hydra) return null; // no visual to repair
  const loopCyclesN = (await loopCycles(stripHydraBlock(part.strudel)).catch(() => null)) ?? undefined;
  const frame = { genre: plan.genre, intent: part.intent ?? undefined, key: plan.key, bpm: plan.bpm, loopCycles: loopCyclesN };
  let fixed = await repairHydra(hydra, visualError, frame, cfg).catch(() => "");
  // FINAL GATE — never ship a still-broken visual: the repair must pass the server eval equivalent.
  // If it doesn't, ONE more repair pass fed the gate's own errors before giving up.
  if (fixed && hydraServerErrors(fixed).length) {
    fixed = await repairHydra(fixed, hydraServerErrors(fixed).join("\n"), frame, cfg).catch(() => "");
  }
  if (!fixed || hydraServerErrors(fixed).length) return null;
  const code = attachHydraBlock(part.strudel, fixed); // swap ONLY the @hydra block; music + controls stay
  await setPartStrudelOwned(songId, partId, code);
  return code;
}

export async function convertOnePartMeter(
  songId: string,
  partId: string,
  fromTs: string,
  toTs: string,
  position: { index: number; total: number },
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
  if (!song) return; // song deleted mid-sequence — nothing to do
  const plan = planOf(song);
  const [part] = await sql<PartRow[]>`select * from parts where id = ${partId}`;
  const old = part?.strudel;
  if (!old?.trim()) return;

  // The full server eval, judged in the NEW meter.
  const check = async (candidate: string) => {
    const problems = await strudelServerErrors(candidate, {
      bpm: plan.bpm,
      timeSignature: toTs,
    });
    return { ok: problems.length === 0, problems };
  };

  await setPartStatus(partId, "generating", sql);
  await setPartMessage(
    partId,
    `Reworking in ${toTs} — loop ${position.index + 1} of ${position.total}…`,
    sql,
  );
  try {
    // TIDAL-FIRST: a loop built by the current engine carries each layer's Tidal in `notation`, so
    // re-bar it the SAME way it was made — rewrite the Tidal into the new meter + compile 1:1. Older
    // (score / non-Tidal) parts fall through to the legacy converts below.
    const tnative = engineNativeTracks(part);
    if (tnative) {
      const code = await convertNativePartMeter(plan, part, tnative, fromTs, toTs, cfg, sql).catch(
        () => null,
      );
      if (code) {
        await setPartMessage(partId, "", sql);
        return;
      }
    }
    // SCORE-FIRST: re-bar the SCORE into the new meter (GLM), then re-render every
    // track (Kimi, one at a time) — the same plan→instruments→track path as a
    // fresh compose. If anything fails, fall through to the direct convert below.
    if (part?.score) {
      try {
        const editedScore = await editLoopScore(
          {
            plan,
            score: part.score,
            change: `Convert this loop from ${fromTs} to ${toTs} time signature: re-phrase every part's rhythm and pitches into ${beatsPerBar(
              toTs,
            )} beats per bar and update meter, beatsPerBar and loopBars to match — keep the music recognisably the same, STRAIGHT and in key.`,
          },
          cfg,
        );
        const composed = await composeFromScore(
          plan,
          editedScore,
          part.sounds ?? null,
          cfg,
          inlineRunner,
          `${partId}-meter`,
        );
        if ((await check(composed.code)).ok) {
          const out = carryControlValues(old, bakeControlDefaults(composed.code));
          await rebasePartComposition(partId, out, editedScore, composed.sounds, sql);
          await setPartMessage(partId, "", sql);
          return;
        }
      } catch (e) {
        console.error(
          `[klappn] score-first meter for part ${partId} failed — falling back to direct convert:`,
          e,
        );
      }
    }
    let converted = await convertPartMeter(
      { code: old, bpm: plan.bpm, fromTs, toTs },
      cfg,
    );
    let verdict = await check(converted);
    if (!verdict.ok) {
      // ONE guided repair, exactly like the pill flow.
      converted = await convertPartMeter(
        {
          code: old,
          bpm: plan.bpm,
          fromTs,
          toTs,
          previous: converted,
          feedback: verdict.problems.join("; "),
        },
        cfg,
      );
      verdict = await check(converted);
    }
    if (!verdict.ok) {
      console.error(
        `[klappn] meter ${fromTs}→${toTs} failed twice for part ${partId} — keeping its old code`,
      );
      await setPartMessage(partId, "", sql);
      await setPartStatus(partId, "ready", sql);
      return;
    }
    // Crackle guard + keep the user's CURRENT knob values riding on the
    // re-written code (defaults re-baked from the new music).
    const out = carryControlValues(
      old,
      bakeControlDefaults(wireSidechain(assignReverbOrbits(converted))),
    );
    await rebasePartStrudel(partId, out, sql);
  } catch (e) {
    console.error(`[klappn] meter conversion errored for part ${partId}:`, e);
    await setPartMessage(partId, "", sql).catch(() => {});
    await setPartStatus(partId, "ready", sql).catch(() => {});
  }
}

/** Dev-fallback (no Cloudflare): the whole meter change in-process, strictly
 *  in sequence. The Workflow path runs the SAME two functions, but with one
 *  durable step per loop — see workflows/src/index.ts. */
export async function convertSongMeter(
  songId: string,
  toTs: string,
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  const { fromTs, partIds } = await flipSongMeterPlan(songId, toTs, sql);
  if (fromTs === toTs) return;
  for (let i = 0; i < partIds.length; i++) {
    await convertOnePartMeter(
      songId,
      partIds[i],
      fromTs,
      toTs,
      { index: i, total: partIds.length },
      sql,
      cfg,
    );
  }
}

/** Finalize freshly re-rendered loop code for ONE part after a score-first edit:
 *  expose sliders (AI parameterize → deterministic fallback → labels) + fresh
 *  instrument-swap options, carry the user's current knob values, keep the pill
 *  vocabulary, and (only if the loop already had them) regenerate visuals synced
 *  to the new music. The same finalize shape the composer and variant flow use. */
async function finalizeSongEditPart(
  plan: SongPlan,
  part: PartRow,
  deconflicted: string,
  cfg: ClaudeConfig | undefined,
): Promise<string> {
  const [tweaked, swaps] = await Promise.all([
    (async () => {
      const ai = await parameterizePart(deconflicted, cfg).catch(() => deconflicted);
      if (ai !== deconflicted && (await strudelBuildErrors(ai)).length === 0) return ai;
      const det = parameterize(deconflicted);
      if (!/@controls/.test(det)) return deconflicted;
      return await labelControls(det, cfg).catch(() => det);
    })(),
    suggestSounds(deconflicted, cfg).catch(() => ""),
  ]);
  let out = carryControlValues(part.strudel ?? "", bakeControlDefaults(tweaked));
  if (swaps) out = `/* @swaps\n${swaps}\n*/\n${out}`;
  const pills = parseEdits(part.strudel ?? "");
  if (pills.length) out = `/* @edits\n${JSON.stringify(pills)}\n*/\n${out}`;
  if (part.strudel && extractHydra(part.strudel)) {
    const cyc = (await loopCycles(deconflicted).catch(() => null)) ?? undefined;
    const hy = await generateHydra(
      {
        strudel: deconflicted,
        genre: plan.genre,
        intent: part.intent ?? undefined,
        key: plan.key,
        bpm: plan.bpm,
        loopCycles: cyc,
      },
      cfg,
    ).catch(() => "");
    if (hy) out = attachHydraBlock(out, hy);
  }
  return out;
}

/**
 * Apply an edit across the whole song. SCORE-FIRST when every loop has a saved
 * score: each loop edits-or-returns-unchanged at the score level (GLM, parallel),
 * and only the loops whose score actually changed are re-rendered track-by-track
 * (Kimi) + re-finalized. Older songs (any loop without a score) fall back to the
 * monolithic full-song edit, matched back to rows by id.
 */
export async function runEdit(
  songId: string,
  changeRequest: string,
  sql: Sql = db(),
  cfg?: ClaudeConfig,
): Promise<void> {
  // Flip the song to 'generating' so the client's polling kicks in while the
  // edit is in flight, then back to 'ready' when it lands.
  await setSongStatus(songId, "generating", sql);
  try {
    const [song] = await sql<SongRow[]>`select * from songs where id = ${songId}`;
    const plan = song ? planOf(song) : undefined;
    const parts: PartRow[] = await getPartsOrdered(songId, sql);

    // TIDAL-FIRST whole-song edit: if every loop was built by the current engine (each track carries its
    // TidalCycles in `notation`), edit each loop through the SAME Tidal path — rewrite + compile 1:1 — in
    // parallel. A loop the model fails on (or changes the shape of) is left exactly as it was; visuals are
    // kept (mergeTracksKeepVisual), the existing @edits pill history is preserved.
    if (plan && parts.length && parts.every((p) => engineNativeTracks(p))) {
      await Promise.all(
        parts.map(async (part) => {
          const tr = engineNativeTracks(part);
          if (!tr) return;
          try {
            await editNativePart(plan, part, tr, changeRequest, parseEdits(part.strudel ?? ""), cfg, sql);
          } catch (e) {
            console.error(`[klappn] tidal whole-song edit of part ${part.id} failed — keeping it:`, e);
          }
        }),
      );
      await setSongStatus(songId, "ready", sql);
      return;
    }

    // SCORE-FIRST whole-song edit (every loop has a score): each loop edits-or-
    // returns-unchanged at the SCORE level (GLM, in parallel); each loop whose
    // score actually changed is re-rendered track-by-track (Kimi) + re-finalized.
    // Untouched loops are left exactly as they are. Obeys plan→instruments→track.
    const allScored =
      !!plan &&
      parts.length > 0 &&
      parts.every(
        (p) =>
          p.strudel &&
          p.score &&
          Array.isArray(p.score.parts) &&
          p.score.parts.length > 0,
      );
    if (allScored) {
      await Promise.all(
        parts.map(async (part, idx) => {
          try {
            const neighbours: { label: string; side: "before" | "after" }[] = [];
            if (parts[idx - 1]?.label)
              neighbours.push({ label: parts[idx - 1].label as string, side: "after" });
            if (parts[idx + 1]?.label)
              neighbours.push({ label: parts[idx + 1].label as string, side: "before" });
            const editedScore = await editLoopScore(
              {
                plan: plan!,
                score: part.score!,
                change: changeRequest,
                sectionLabel: part.label ?? "this section",
                neighbours,
              },
              cfg,
            );
            // Unchanged → leave this loop (and its visuals) exactly alone.
            if (JSON.stringify(editedScore) === JSON.stringify(part.score)) return;
            const composed = await composeFromScore(
              plan!,
              editedScore,
              part.sounds ?? null,
              cfg,
              inlineRunner,
              `${part.id}-songedit`,
            );
            const out = await finalizeSongEditPart(plan!, part, composed.code, cfg);
            await writePartComposition(
              part.id,
              out,
              editedScore,
              composed.sounds,
              null, // score-path edit — no per-track breakdown
              "ready",
              sql,
            );
          } catch (e) {
            console.error(
              `[klappn] score-first song-edit failed for part ${part.id} — keeping it:`,
              e,
            );
          }
        }),
      );
      await setSongStatus(songId, "ready", sql);
      return;
    }

    const byId = new Map(parts.map((p) => [p.id, p]));

    // Edit the MUSIC only: strip each loop's @hydra block before the model sees
    // it, so the visuals never confuse the edit (and so we compare music-to-music).
    const edited = await editSong(
      {
        parts: parts.map((p) => ({
          id: p.id,
          label: p.label,
          strudel: p.strudel ? stripHydraBlock(p.strudel) : p.strudel,
        })),
        changeRequest,
      },
      cfg,
    );

    // For each loop whose MUSIC actually changed, write the new music AND
    // regenerate Hydra visuals synced to it. Untouched loops keep their code
    // (and existing visuals). Done outside a transaction — the per-loop hydra
    // call is a model request and must not hold a DB tx open for minutes.
    for (const e of edited) {
      const existing = byId.get(e.id);
      if (!existing) continue; // ignore ids that aren't part of this song
      const oldMusic = existing.strudel ? stripHydraBlock(existing.strudel) : "";
      if (oldMusic === e.strudel) continue; // unchanged — leave it alone
      // SAFETY: never let an edit that would crash at play time ship — an invented
      // control/method, or a note that resolves to an object. Keep the previous,
      // working version instead.
      const badEdit = await unknownStrudelMethods(e.strudel);
      const objNotes = await unplayableNoteLayers(e.strudel);
      if (badEdit.length || objNotes.length) {
        console.error(
          `[klappn] edit for part ${e.id} would crash (${[
            badEdit.length ? `non-functions ${badEdit.join(", ")}` : "",
            objNotes.length ? `object-note layers ${objNotes.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("; ")}) — keeping the previous working version`,
        );
        continue;
      }
      // Visuals are OPT-IN: only re-generate them for an edited part that ALREADY
      // had them (so its look tracks the new music) — never add them uninvited.
      const hadHydra = !!(existing.strudel && extractHydra(existing.strudel));
      const editLoopCycles = hadHydra
        ? ((await loopCycles(e.strudel).catch(() => null)) ?? undefined)
        : undefined;
      const hydra =
        hadHydra && plan
          ? await generateHydra(
              {
                strudel: e.strudel,
                genre: plan.genre,
                intent: existing.intent ?? undefined,
                key: plan.key,
                bpm: plan.bpm,
                loopCycles: editLoopCycles,
              },
              cfg,
            ).catch(() => "")
          : "";
      const withHydra = attachHydraBlock(e.strudel, hydra);
      await sql`
        update parts set strudel = ${withHydra}, status = 'ready'
        where id = ${e.id} and song_id = ${songId}`;
    }
    await setSongStatus(songId, "ready", sql);
  } catch (err) {
    await setSongStatus(songId, "error", sql);
    throw err;
  }
}
