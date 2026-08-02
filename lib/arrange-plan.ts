/**
 * arrange-plan.ts — the song's ARRANGEMENT COMPOSER (2026-07-13).
 *
 * One Opus-5 HIGH call turns a finished set of section loops into a full song:
 * the model decides when each layer enters and leaves, how long each section
 * unfolds, what sweeps ride which bars, what one-way material (risers, fills,
 * impacts) straddles the seams, and how the song ends. The output is pure DATA
 * (plan.arrangement — a SongArrangement) rendered deterministically by
 * lib/arrange.ts at play/export time; no arrangement decision lives in code.
 *
 * This is CAPABILITY, not policy: the prompt states the contract (what is
 * expressible) and nothing about how songs are meant to go. Every field is
 * optional — a section the model leaves out simply plays whole, an absent
 * ending keeps the classic wrap-forever loop.
 *
 * Loops stay position-independent atoms (they never write hand-off material —
 * see the loop contract in strudel-track-spec); one-way gestures live HERE, in
 * overlays and the ending, whose contract is the mirror image: they play once
 * and may point somewhere.
 */
import { complete, ROUTE, type LlmConfig } from "./llm";
import { BREAK_BANKS } from "./breaks-catalog";
import { endingMoveOf } from "./endings-catalog";
import { sentenceLabel } from "./labels";
import {
  sectionParts,
  type SectionArrange,
  type SectionSweep,
  type SongArrangement,
  type SweepControl,
} from "./arrange";

/** One section as the composer sees it. */
export interface ArrangeInputSection {
  id: string;
  label: string;
  intent: string;
  /** Natural loop length in bars. */
  bars: number;
  /** The USER's dialled length for this section (repeat latch × natural bars)
   *  — the arrangement must fill exactly this span; playback only applies the
   *  section's arrangement when its bars match this dial. */
  heldBars?: number | null;
  /** The part's stored strudel (mergeTracks output — one `$:` line per layer). */
  strudel: string;
  /** Per-layer instrument labels, aligned with the `$:` lines when available. */
  instruments?: (string | null)[];
  kind?: "loop" | "bridge" | "break" | null;
}

const ARRANGE_SYSTEM = `You arrange a finished multi-section instrumental song for playback using ONLY the layers already in each section — never new sounds. You decide when each layer is audible, how many bars the section occupies (its loop unfolds across them), the filter/level moves that ride the existing layers, and how the song ends. You're given the song's identity and its sections in order — each with its natural loop length and its numbered layers' Strudel.

Respond with ONLY a JSON object, no markdown:
{
 "sections": { "<section id>": {
  "bars": total bars this section plays (omit = its natural length),
  "moves": [{"bar": 0-based bar within the section, "layers": [1-based layer numbers audible FROM that bar]}] (omit = all layers throughout; [] = silence),
  "sweeps": [{"name": "2-4 words for the MOVE a listener feels, e.g. \"swelling from the dark\"", "param": "<control, e.g. lpf|hpf|gain>", "from": n, "to": n, "bar": start, "bars": length, "curve": "linear"|"sine"}]
 } },
 "ending": {"mode": "stop"|"loop", "tpl": "<ending template>", "start": bars before the song's last bar that the tail comes in (0 = after the song), "bars": n, "gain": 0..1.2, "tone": 0..1, "space": 0..1}
}

Name every sweep for what's HEARD, never its parameters. Sweeps ride the whole section's existing sound. Layer numbers refer to the numbering given. A section you omit plays whole for its natural length. "stop" plays the song once and ends; "loop" wraps forever.

HOW IT ENDS — choose a template, never write the tail yourself (it is built in the song's key and always falls to silence): ring (the last chord struck once and left to decay) · fall (the tonic walks down and thins out) · crash (one last hit, ringing until it's gone) · dim (the filter shuts as it fades) · breath (nothing new — the room empties and the tails fall away) · cut (it stops on the beat, nothing after). "start" is where the tail comes in: 0 lets the song finish first, higher reaches back into the final loop so the piece resolves INTO its ending. "bars" is how long the tail takes, "gain" its level, "tone" how open it stays (1 = fully open), "space" how much room it rings into. With "loop" the ending fields are ignored.`;

function sectionBlock(s: ArrangeInputSection, beats: number): string {
  const parts = sectionParts(`${s.strudel}\nsetcpm(120/${beats})`);
  const lines = parts
    ? parts.layers.map((l, i) => {
        const name = s.instruments?.[i];
        return `${i + 1}.${name ? ` [${name}]` : ""} $: ${l.replace(/\n\s*/g, " ")}`;
      })
    : [];
  const held =
    s.heldBars && s.heldBars !== s.bars
      ? ` — the user chose ${s.heldBars} bars; set "bars": ${s.heldBars} and arrange within them`
      : "";
  return [
    `### SECTION ${s.id} — "${s.label}" (${s.bars}-bar loop${s.kind === "bridge" ? ", bridge — plays once" : s.kind === "break" ? ", break — a short transition" : ""}${held}): ${s.intent}`,
    ...lines,
  ].join("\n");
}

/** An effect's feel as the chip wears it: short, sentence-cased, or absent. */
export function cleanFeel(v: unknown): string | undefined {
  return typeof v === "string" && v.trim()
    ? sentenceLabel(v.trim().slice(0, 40))
    : undefined;
}

/** The first balanced {...} in a reply (fences stripped), parsed — or null. */
function firstJsonObject(reply: string): Record<string, unknown> | null {
  const clean = reply.replace(/```[a-z]*\n?/gi, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

/**
 * The ending, kept honest (2026-08-02). The model picks a TEMPLATE and its
 * knobs — it no longer writes the tail, because when it did it wrote a chord
 * with `sustain(0.7)` that held at one level and then stopped dead, which is
 * not a ring-out. An unknown template falls back to `ring` rather than leaving
 * the song to cut: "stop" promises a tail, so a tail is what it gets.
 */
function sanitizeEnding(raw: unknown): SongArrangement["ending"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const e = raw as Record<string, unknown>;
  const mode = e.mode === "stop" ? "stop" : e.mode === "loop" ? "loop" : undefined;
  if (!mode) return undefined;
  if (mode === "loop") return { mode };
  const knob = (v: unknown, min: number, max: number, def: number) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : def;
  const tpl = endingMoveOf(String(e.tpl ?? "")) ? String(e.tpl) : "ring";
  const move = endingMoveOf(tpl)!;
  return {
    mode,
    tpl,
    start: Math.max(0, Math.min(16, Math.floor(knob(e.start, 0, 16, 0)))),
    bars: Math.max(1, Math.min(16, Math.floor(knob(e.bars, 1, 16, move.bars)))),
    gain: knob(e.gain, 0, 1.2, move.gain),
    tone: knob(e.tone, 0, 1, 1),
    space: knob(e.space, 0, 1, 0.35),
  };
}

/** Pull the JSON object out of a reply (fences stripped, first {...} balanced). */
export function parseArrangementReply(reply: string): SongArrangement | null {
  const obj = firstJsonObject(reply);
  if (!obj) return null;
  const sections =
    obj.sections && typeof obj.sections === "object" && !Array.isArray(obj.sections)
      ? (obj.sections as Record<string, SectionArrange>)
      : undefined;
  const ending = sanitizeEnding(obj.ending);
  if (!sections && !ending) return null;
  return { sections, ending };
}

/**
 * Compose the song's arrangement — ONE HIGH call, JSON out, one guided retry.
 * Returns null when nothing usable came back (the song keeps playing classic).
 * Deep validation happens at RENDER time (sectionEntries); here we only stamp
 * each section's layerCount so later mutes/edits skip stale moves safely.
 */
export async function composeSongArrangement(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    sections: ArrangeInputSection[];
    /** The user's own words for how the song should move (the ✎ re-roll). */
    direction?: string;
  },
  cfg?: LlmConfig,
): Promise<SongArrangement | null> {
  const { sections } = args;
  if (!sections.length) return null;
  const beats = Number(args.timeSignature.split("/")[0]) || 4;
  const direction = (args.direction ?? "").trim().slice(0, 500);
  let user =
    [
      `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
      args.summary ? `The song: ${args.summary}` : "",
      "",
      ...sections.map((s) => sectionBlock(s, beats)),
      "",
      direction ? `THE USER'S DIRECTION for the arrangement: ${direction}` : "",
      `Arrange the song now — JSON only.`,
    ]
      .filter((l) => l !== "")
      .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(ARRANGE_SYSTEM, user, cfg, {
        ...ROUTE.arrange,
        trace: { kind: "arrange", attempt },
      })
    ).trim();
    const parsed = parseArrangementReply(reply);
    if (parsed) {
      // Stamp the layer count each section's moves were authored against —
      // the renderer skips moves wholesale when the live count differs. A
      // user-dialled length is FORCED onto bars (it's the user's setting, and
      // playback's authored-for-this-dial check keys on exact equality).
      if (parsed.sections)
        for (const s of sections) {
          const spec = parsed.sections[s.id];
          if (!spec || typeof spec !== "object") continue;
          const parts = sectionParts(`${s.strudel}\nsetcpm(120/${beats})`);
          if (parts) spec.layerCount = parts.layers.length;
          if (s.heldBars && s.heldBars > 0) spec.bars = s.heldBars;
          // Every effect wears its FEEL, sentence-cased (or drops the name),
          // and remembers its HOME (the authored from/to) so a ridden knob can
          // always snap back to where the model set it.
          for (const w of spec.sweeps ?? [])
            if (w) {
              w.name = cleanFeel(w.name);
              if (Number.isFinite(w.from) && Number.isFinite(w.to))
                w.home = { from: w.from, to: w.to };
            }
          // No new instruments: the unfold works the layers it has. Drop any
          // overlay the model emits anyway (it plays a sound not in the loop).
          delete spec.overlays;
        }
      return parsed;
    }
    user += `\n\nThat reply was not a valid JSON object. Resend ONLY the JSON.`;
  }
  return null;
}

// ── the effect KNOB enrich (the layers' tweak-panel pattern, for the unfold) ──
// ONE low-effort call NAMES each effect's knobs in the music's own language
// ("Darkness floor", "Bloom") and frames the range worth exploring; riding a
// knob is then pure math — real-time, zero AI. Runs at birth beside the unfold
// (jobs.arrangeSong) with a lazy on-open fallback (the arrange route's
// enrichSweeps op), mirroring enrichPartLayer exactly — including its model:
// SONNET 5, thinking off (2026-07-22, the user) — pure naming needs no Opus.

const FX_ENRICH_SYSTEM = `Each effect below is a parameter glide riding one loop of a song. For each, in the order given: name up to 2 knobs a musician would ride on it — one per glide end (field "from" = where it starts, "to" = where it lands) — each with a 1-3 word musical name (never the parameter's name) and the min..max range worth exploring, current value inside it.

Respond with ONLY a JSON array, one item per effect, aligned by order:
[{"controls":[{"name":"...","field":"from"|"to","min":n,"max":n}]}]`;

/** Dress a section's sweeps with named knobs — ONE low-effort call, JSON out.
 *  Returns the SAME sweeps array with `controls` filled (input untouched), or
 *  null when nothing usable came back (the panel lazily retries on open). */
export async function enrichSweepControls(
  args: {
    genre?: string;
    /** The loop as one line ("Neon dusk — hazy synthwave loop"). */
    section: string;
    sweeps: SectionSweep[];
  },
  cfg?: LlmConfig,
): Promise<SectionSweep[] | null> {
  const { sweeps } = args;
  if (!sweeps.length) return null;
  const user = [
    [args.genre, args.section].filter(Boolean).join(" — "),
    ...sweeps.map(
      (w, i) =>
        `${i + 1}. ${w.param} ${w.from}→${w.to} over ${w.bars} bars${w.name ? ` — "${w.name}"` : ""}`,
    ),
  ].join("\n");
  const reply = (
    await complete(FX_ENRICH_SYSTEM, user, cfg, {
      ...ROUTE.copy,
      trace: { kind: "fx-enrich" },
    })
  ).trim();
  const clean = reply.replace(/```[a-z]*\n?/gi, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  let any = false;
  const dressed = sweeps.map((w, i) => {
    const item = raw[i] as { controls?: unknown } | undefined;
    const controls = sanitizeSweepControls(
      Array.isArray(item?.controls) ? item!.controls : [],
      w,
    );
    if (!controls.length) return w;
    any = true;
    return { ...w, controls };
  });
  return any ? dressed : null;
}

/** A usable knob: a clean name, a real field, a finite range that CONTAINS the
 *  sweep's current value there (widened if the model framed it out). ≤2, one
 *  per field. */
export function sanitizeSweepControls(
  raw: unknown[],
  w: SectionSweep,
): SweepControl[] {
  const out: SweepControl[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const k = c as Partial<SweepControl>;
    const field = k.field === "from" || k.field === "to" ? k.field : null;
    const name = cleanFeel(k.name);
    if (!field || !name || seen.has(field)) continue;
    let min = Number(k.min);
    let max = Number(k.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) continue;
    const cur = field === "from" ? w.from : w.to;
    if (Number.isFinite(cur)) {
      min = Math.min(min, cur);
      max = Math.max(max, cur);
    }
    seen.add(field);
    out.push({ name, field, min, max });
    if (out.length >= 2) break;
  }
  return out;
}

// ── CHAPTERS (2026-07-14) — the unfold, materialized as REAL LOOPS ───────────
// "Everything is just a loop." A chapter is one pass of a finished loop built
// from a subset of its layers. Chapters are asked for ONE AT A TIME (the user
// wishes each next one — never a batch built on their behalf): each call sees
// the palette and the chapters already made, writes the single next pass, and
// may start ONE effect gliding into it. Materialization is pure code
// (jobs.composeNextChapterFor duplicates the track subset).
// TWO CALLS PER CHAPTER (2026-07-30, the user: "each AI call to focus on one
// task"). Choosing which of the palette's voices this pass holds is a STRUCTURAL
// decision over a short numbered list — Opus 5 at medium, cheap and fast. Writing
// what a voice now SAYS is composition, judged by ear — Fable 5 at high. Fused,
// the second job was being done inside a JSON string field by whichever model the
// first job justified, with Strudel's quotes fighting JSON's escaping the whole
// way. Split, the write call gets plain text and the whole loop in view.
// ── THE EFFECTS PASS — motion authored over the FINISHED sequence ────────────
// An effect is a cross-loop object; authored from inside one loop's call it
// could never see the distance (observed live: every glide came back span 1).
// So it gets its own moment: after the unfold's loops exist, ONE call looks at
// the whole sequence and writes the glides across it — anchored by loop range,
// free to start at the very first bar and ride to the very last.

export interface UnfoldFx {
  name?: string;
  param: string;
  from: number;
  to: number;
  curve?: "linear" | "sine";
  /** 1-based loop range the glide rides, inclusive. */
  fromLoop: number;
  toLoop: number;
}
/** Effect params whose change REGENERATES a shared orbit bus (reverb impulse
 *  rebuild / delay-line length) — gliding them per event is a click factory. */
export const BUS_REBUILD_PARAMS =
  /^(roomsize|rsize|size|sz|roomfade|fade|roomlp|roomdim|delaytime|delayt|dt|ir|irspeed|irbegin)$/i;

/** Parse + clamp the effects-pass reply against the real loop count. */
export function sanitizeUnfoldFx(
  raw: Record<string, unknown> | null,
  loopCount: number,
): UnfoldFx[] {
  if (!raw || !Array.isArray(raw.effects)) return [];
  return (raw.effects as unknown[])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => {
      const fromLoop = Math.max(1, Math.min(loopCount, Math.floor(Number(e.fromLoop)) || 1));
      const toLoop = Math.max(fromLoop, Math.min(loopCount, Math.floor(Number(e.toLoop)) || fromLoop));
      return {
        name: cleanFeel(e.name),
        param: typeof e.param === "string" ? e.param.trim() : "",
        from: Number(e.from),
        to: Number(e.to),
        curve: e.curve === "sine" ? ("sine" as const) : ("linear" as const),
        fromLoop,
        toLoop,
      };
    })
    .filter(
      (e) =>
        /^[a-zA-Z][a-zA-Z0-9]*$/.test(e.param) &&
        // params that REBUILD a shared bus per event (reverb impulse, delay
        // buffer length) are a crackle machine as glides — never author them.
        !BUS_REBUILD_PARAMS.test(e.param) &&
        Number.isFinite(e.from) &&
        Number.isFinite(e.to),
    )
    .slice(0, 8); // safety net only — the model decides how much motion the piece wants
}
// ── THE SWEEP, IN TWO SHAPES (2026-08-02, the user) ──────────────────────────
// An EFFECT spans the piece — it needs the whole arc, so it stays ONE call over
// every loop. A BREAK is LOCAL: it lives at one turn, between two loops, and
// nothing three sections away changes what belongs there. So the turns are
// authored ONE CALL EACH, in parallel, each seeing only its two loops, their
// spans, and the glide crossing it — small context, decisive answer, and a
// cheaper tier (ROUTE.turn: Sonnet 5, a closed catalog and four knobs).
//
// The 2026-07-22 merge is honoured, not undone: it fixed two WHOLE-SONG calls
// that each held the other's category fixed and argued over material the next
// call deleted. Here the effects land FIRST and every turn call is told what
// glides through it — the coupling survives at a fraction of the context.

const PAGE_EFFECTS_SYSTEM = `You shape a finished instrumental piece's EFFECTS — parameter glides living OUTSIDE its loops, each spanning a range of them. You're given the song's identity and its loops in play order, each with its layers and how long it runs.

Respond with ONLY a JSON object, no markdown:
{"effects": [{"name": "2-4 words for the MOVE a listener feels", "param": "<control>", "from": n, "to": n, "curve": "linear"|"sine", "fromLoop": first loop it rides (1-based), "toLoop": last loop it rides}, …]}

Each glide runs ONCE across its whole range — from the first bar of fromLoop to the last bar of toLoop. Loop numbers refer to the play order given. Glidable params: lpf, hpf, gain, room, delay, delayfeedback, resonance, shape, phaserrate. Params that rebuild a shared bus (roomsize, delaytime) cannot glide. An empty list is a valid answer — a piece can want no glides at all.`;

const TURN_BREAK_SYSTEM = `You decide ONE TURN in an instrumental song: the moment the music leaves one section and arrives in the next. You're given both sections — what they are, what layers they carry, how long each runs — and anything already gliding across the turn.

Choose the drum fill that breaks the first section into the second, or NOTHING: a bare turn is a real answer, and a long rise often wants one.

Respond with ONLY a JSON object, no markdown:
{"tpl": "<template key>", "bank": "<kit>", "bars": how many CLOSING bars of the outgoing section the fill occupies (1-8), "gain": 0..1.2, "heat": 0..0.6, "tone": 0..1, "space": 0..0.8, "tune": -12..12 semitones, "pan": 0..1}
or exactly {"tpl": null} for a bare turn.

Templates: roll (snare roll) · run (tom run) · build (doubling roll) · stutter (kick stutter) · lift (rising hats) · clap (doubling claps) · crash (push into a ringing crash) · tumble (tom cascade).
"bars" belongs to the SECTION, not the template: a section playing once wants a single closing bar, while one that runs sixteen or thirty-two bars can carry a four- or eight-bar turn without losing the thread. The outgoing section's span is given — read it before choosing. The fill is ONE GESTURE stretched over the bars you give it — its intensity climbs across the whole length, it does not restart each bar — so ask for the length the turn actually wants.
The fill always ENDS on the change — that is what makes it a turn. Its length is the only thing you choose.
THE KIT matters as much as the pattern — a lo-fi turn and a techno turn are not the same drums. Choose one: RolandTR909 (hard techno/house), RolandTR808 (deep, booming, hip-hop), RolandTR707 (dry, plain, pop), RolandTR606 (thin, wiry, punk-electro), LinnDrum (80s, gated), AkaiMPC60 (sampled boom-bap), OberheimDMX (early electro), AlesisHR16 (clean late-80s), EmuSP12 (gritty 12-bit), BossDR550 (soft, polite). Pick the one this song's genre would actually own.
Knobs: gain = level, heat = drive, tone = how open the top is (1 = fully open), space = room send, tune = the whole kit up or down in semitones (up also shortens the hits — a tighter, snappier fill), pan = where it sits across the stereo (0.5 = centre). The fill is a point of RELEASE, not a running beat.`;

export interface PageBreak {
  tpl: string;
  atLoop: number;
  /** How many CLOSING bars of the loop the fill occupies (2026-08-02). A turn
   *  is a proportion of the section, not a property of the template: sixteen
   *  bars of one loop earn a longer break than a single pass. Absent = the
   *  template's own length. */
  bars?: number;
  /** The kit — a verified bank name, or absent for the default. */
  bank?: string;
  gain: number;
  heat: number;
  tone: number;
  space: number;
  tune?: number;
  pan?: number;
}

const BREAK_TPLS = new Set(["roll", "run", "build", "stutter", "lift", "clap", "crash", "tumble"]);

/** One turn's answer, sanitized. null = a bare turn (the model's real answer,
 *  or an unusable reply — both leave the turn empty, which is safe). */
function sanitizeTurnBreak(raw: unknown, atLoop: number): PageBreak | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const tpl = String(e.tpl ?? "");
  if (!BREAK_TPLS.has(tpl)) return null; // includes the explicit {"tpl": null}
  const knob = (v: unknown, min: number, max: number, def: number) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : def;
  return {
    tpl,
    atLoop,
    // 1-8 closing bars — the SAME range the Length knob offers (2026-08-02:
    // the model was capped at 4 while a hand could dial 8, so a long section
    // could be given a turn by hand that the AI was never allowed to author).
    // Omitted (or unusable) = the template's own length; the renderer clamps
    // again to the section's real span.
    ...(Number.isFinite(Number(e.bars))
      ? { bars: Math.max(1, Math.min(8, Math.floor(Number(e.bars)))) }
      : {}),
    // Only a kit the palette really has — an unknown bank plays silence.
    ...(typeof e.bank === "string" && BREAK_BANKS.includes(e.bank as (typeof BREAK_BANKS)[number])
      ? { bank: e.bank }
      : {}),
    gain: knob(e.gain, 0, 1.2, 0.8),
    heat: knob(e.heat, 0, 0.6, 0),
    tone: knob(e.tone, 0, 1, 1),
    space: knob(e.space, 0, 0.8, 0),
    tune: Math.round(knob(e.tune, -12, 12, 0)),
    pan: knob(e.pan, 0, 1, 0.5),
  };
}

/** One loop as a turn call sees it. */
export interface TurnLoop {
  name: string;
  intent?: string;
  layers: string[];
  /** The section's SPAN — how long it actually runs. */
  bars?: number;
  /** Its natural loop length, so a repeat reads as a repeat. */
  loopBars?: number;
}

/**
 * ONE TURN — the fill (or the bare turn) between two sections.
 *
 * Local by nature, so local in context: two loops, their spans, and whatever
 * glides across the seam. Runs on ROUTE.turn (Sonnet 5, medium) — a closed
 * catalog of eight templates, four knobs and a length is a decision, not an
 * invention. Callers run these CONCURRENTLY: no turn depends on another.
 *
 * null = leave this turn bare (a real answer, and the safe failure).
 */
export async function composeTurnBreak(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    /** The section the music is LEAVING — the fill rides its closing bars. */
    from: TurnLoop;
    /** What it arrives in. null = the song's ending (the last turn of a piece
     *  that stops rather than wraps). */
    to: TurnLoop | null;
    /** 1-based index of the outgoing loop, echoed back on the result. */
    atLoop: number;
    /** Glides crossing this turn — the fill is chosen with them, not against
     *  them (the 07-22 coupling, kept). */
    crossing?: { name?: string; param: string; from: number; to: number }[];
    /** What rides this turn now — replaced by whatever comes back. */
    riding?: { tpl: string; bars?: number; bank?: string };
  },
  cfg?: LlmConfig,
): Promise<PageBreak | null> {
  const line = (l: TurnLoop, role: string) => {
    const reps = l.bars && l.loopBars ? Math.round(l.bars / l.loopBars) : 1;
    const span = l.bars
      ? reps > 1
        ? ` — ${l.bars} bars (its ${l.loopBars}-bar loop ×${reps})`
        : ` — ${l.bars} bars`
      : "";
    return [
      `${role}: "${l.name}"${span}${l.intent?.trim() ? ` — ${l.intent.trim()}` : ""}`,
      l.layers.length ? `  layers: ${l.layers.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };
  const user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    line(args.from, "LEAVING"),
    args.to
      ? line(args.to, "ARRIVING IN")
      : `ARRIVING IN: the song's ending — this is the last turn the piece takes.`,
    args.crossing?.length
      ? `CROSSING THIS TURN: ${args.crossing
          .map((c) => `${c.name ? `"${c.name}" — ` : ""}${c.param} ${c.from}→${c.to}`)
          .join(" · ")}`
      : "",
    args.riding
      ? `RIDING NOW (replaced by your answer): ${args.riding.tpl}${args.riding.bars ? ` over ${args.riding.bars} bars` : ""}${args.riding.bank ? ` on ${args.riding.bank}` : ""}`
      : "",
    `The turn. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  const reply = (
    await complete(TURN_BREAK_SYSTEM, user, cfg, {
      ...ROUTE.turn,
      trace: { kind: "turn-break" },
    })
  ).trim();
  return sanitizeTurnBreak(firstJsonObject(reply), args.atLoop);
}

/** THE WHOLE-SONG HALF OF THE SWEEP: the effect glides, which span loops and
 *  so need the whole arc. null = the model whiffed (the caller changes
 *  nothing); an empty list is a real answer (a piece can want no glides), not
 *  a failure. The turns are authored separately — see composeTurnBreak. */
export async function composePageEffects(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    /** Every loop on the page, in play order. `bars` is the section's SPAN —
     *  how long it actually runs — and `loopBars` its natural loop length, so
     *  the model can see a repeat for what it is (32 bars = an 8-bar loop four
     *  times) and size the turn to it. */
    loops: { name: string; intent?: string; layers: string[]; bars?: number; loopBars?: number }[];
    /** The effects riding NOW — replaced wholesale. */
    ridingEffects?: { name?: string; param: string; from: number; to: number; fromLoop: number; toLoop: number }[];
  },
  cfg?: LlmConfig,
): Promise<UnfoldFx[] | null> {
  if (!args.loops.length) return null;
  const riding = (args.ridingEffects ?? []).map(
    (r) => `- ${r.name ? `"${r.name}" — ` : ""}${r.param} ${r.from}→${r.to}, loops ${r.fromLoop}–${r.toLoop}`,
  );
  let user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    args.summary ? `The song: ${args.summary}` : "",
    "THE LOOPS (in play order):",
    ...args.loops.map((c, i) => {
      // "(32 bars — its 8-bar loop ×4)" when the section repeats; plain bars
      // otherwise. The turn's length is chosen against THIS number.
      const reps = c.bars && c.loopBars ? Math.round(c.bars / c.loopBars) : 1;
      const span = c.bars
        ? reps > 1
          ? ` (${c.bars} bars — its ${c.loopBars}-bar loop ×${reps})`
          : ` (${c.bars} bars)`
        : "";
      return `${i + 1}. "${c.name}"${span}${c.intent?.trim() ? ` — ${c.intent.trim()}` : ""}${
        c.layers.length ? ` [layers: ${c.layers.join(", ")}]` : ""
      }`;
    }),
    // One loop still has motion — it glides across itself. Say so, or the
    // model reads "no next section" as "no shape".
    args.loops.length === 1
      ? "This piece is ONE loop that repeats: a glide rides once across it."
      : "",
    riding.length
      ? ["RIDING NOW (your set replaces ALL of this):", ...riding].join("\n")
      : "Nothing rides yet.",
    `The effects. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(PAGE_EFFECTS_SYSTEM, user, cfg, {
        ...ROUTE.shape,
        trace: { kind: "page-effects", attempt },
      })
    ).trim();
    const raw = firstJsonObject(reply) as { effects?: unknown } | null;
    if (raw && Array.isArray(raw.effects))
      return sanitizeUnfoldFx({ effects: raw.effects }, args.loops.length);
    user += `\n\nThat reply was not usable. Resend ONLY the JSON object with an "effects" array.`;
  }
  return null;
}
