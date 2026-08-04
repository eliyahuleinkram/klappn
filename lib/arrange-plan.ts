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

Name every sweep for what's HEARD, never its parameters. Layer numbers refer to the numbering given. A section you omit plays whole for its natural length. "stop" plays the song once and ends; "loop" wraps forever. A gain sweep never rises above 1 — a peak is made by layers entering, never by pushing the whole mix over unity into the limiter.
A LAYER'S OWN SETTINGS ALWAYS WIN: a sweep only sounds on layers that don't set that param themselves (each layer's chain is shown — read it). A bass voiced dark at lpf 200 keeps its darkness through your lpf sweep; a layer with authored gain accents keeps them through your gain ride. Sweep the dimensions the layers leave free; shape the authored ones with moves.

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
              // THE GAIN CEILING (2026-08-04, song db62451f: a section-level
              // gain ride to 1.05 over a full 10-layer stack drove the whole
              // mix into the limiter — heard as "crazy"). A master gain sweep
              // multiplies EVERY layer; over unity it only buys crush. The
              // prompt says it; this makes it true regardless.
              if (w.param === "gain") {
                if (Number.isFinite(w.from)) w.from = Math.min(1, w.from);
                if (Number.isFinite(w.to)) w.to = Math.min(1, w.to);
              }
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
    // The gain ceiling holds for the KNOB too — the enrich once offered an
    // "Overdrive push" range up to 1.2 on a master gain sweep, a hand-cranked
    // route to the same limiter crush the sweep itself is clamped against.
    if (w.param === "gain") {
      min = Math.min(1, min);
      max = Math.min(1, max);
      if (min >= max) continue;
    }
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
      const param = typeof e.param === "string" ? e.param.trim() : "";
      // same gain ceiling as the arrangement's sweeps — a glide is a master
      // ride over every layer at once; over unity it only buys limiter crush
      const cap = (n: number) => (param === "gain" ? Math.min(1, n) : n);
      return {
        name: cleanFeel(e.name),
        param,
        from: cap(Number(e.from)),
        to: cap(Number(e.to)),
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
// ── THE SWEEP, IN TWO SHAPES — BOTH WHOLE-SONG NOW (2026-08-04, the user) ────
// An EFFECT spans the piece and always needed the whole arc. The turns were
// authored one call each for a while (2026-08-02, "a break is local") — and
// the blind calls proved the premise wrong by example: three near-identical
// seams got three identical tom cascades, because each call reached for the
// same obvious answer with nobody in the room to say "we've done that twice".
// A fill is partly defined by NOT being the previous fill, and its size only
// means anything against the arc — variety and escalation are song properties.
// So the turns are ONE call again, on the same tier as the effects.
//
// The 2026-07-22 lesson is still honoured: that failure was two whole-song
// calls with OVERLAPPING authority, each freezing the other's category and
// arguing over material. Here each category keeps ONE author and information
// flows one way — effects land first, the turns are told what glides across
// them, and neither rewrites the other.

const PAGE_EFFECTS_SYSTEM = `You shape a finished instrumental piece's EFFECTS — parameter glides living OUTSIDE its loops, each spanning a range of them. You're given the song's identity and its loops in play order, each with its layers and how long it runs.

Respond with ONLY a JSON object, no markdown:
{"effects": [{"name": "2-4 words for the MOVE a listener feels", "param": "<control>", "from": n, "to": n, "curve": "linear"|"sine", "fromLoop": first loop it rides (1-based), "toLoop": last loop it rides}, …]}

Each glide runs ONCE across its whole range — from the first bar of fromLoop to the last bar of toLoop. Loop numbers refer to the play order given. Glidable params: lpf, hpf, gain, room, delay, delayfeedback, resonance, shape, phaserrate. Params that rebuild a shared bus (roomsize, delaytime) cannot glide. A gain glide never rises above 1 — peaks come from the music, never from pushing the mix over unity. A glide OVERRIDES each layer's own setting of its param for every loop it covers — a bass voiced dark at lpf 200 would be torn open, authored accents flattened. So NEVER glide a param a covered loop's layers author (each loop lists its authored params), and never one a loop's own arrangement already rides (also listed). Glide the dimensions the music leaves free. An empty list is a valid answer — a piece can want no glides at all.`;

const PAGE_BREAKS_SYSTEM = `You decide EVERY TURN of an instrumental piece in one sitting — each moment the music leaves one section and arrives in the next. You're given the song's identity, its loops in play order, and the turns: what each leaves, what it arrives in, and anything gliding across it.

For each turn, choose the drum fill that breaks the outgoing section into the next — or NOTHING: a bare turn is a real answer, and a long rise often wants one.

Respond with ONLY a JSON object, no markdown:
{"turns": [{"atLoop": the outgoing loop's number, "tpl": "<template key>" | null, "bank": "<kit>", "bars": how many CLOSING bars of the outgoing section the fill occupies (1-8), "gain": 0..1.2, "heat": 0..0.6, "tone": 0..1, "space": 0..0.8, "tune": -12..12 semitones, "pan": 0..1}, …]}
One entry per turn, in order; "tpl": null leaves that turn bare.

THE TURNS ARE HEARD AS A SET — that is why you see them together. A fill is partly defined by not being the previous fill: vary the template and the length across the piece, and GRADE them with the arc — small early (one bar, a tick), the largest gesture into the peak, the last turn settling into the ending (or landing the wrap back onto the top). The same cascade three seams running is a stuck machine, not a drummer.
THE KIT belongs to the SONG, not the turn: pick the one this genre would own and keep it across the turns — vary the pattern, not the drums — switching only when the music truly changes register. Kits: RolandTR909 (hard techno/house), RolandTR808 (deep, booming, hip-hop), RolandTR707 (dry, plain, pop), RolandTR606 (thin, wiry, punk-electro), LinnDrum (80s, gated), AkaiMPC60 (sampled boom-bap), OberheimDMX (early electro), AlesisHR16 (clean late-80s), EmuSP12 (gritty 12-bit), BossDR550 (soft, polite).
Templates: roll (snare roll) · run (tom run) · build (doubling roll) · stutter (kick stutter) · lift (rising hats) · clap (doubling claps) · crash (push into a ringing crash) · tumble (tom cascade).
"bars" belongs to the SECTION, not the template: a section playing once wants a single closing bar, while one that runs sixteen or thirty-two can carry a four- or eight-bar turn without losing the thread — each section's span is given, read it before choosing. The fill is ONE GESTURE stretched over the bars you give it — its intensity climbs across the whole length, it does not restart each bar — and it always ENDS on the change; that is what makes it a turn.
Knobs: gain = level, heat = drive, tone = how open the top is (1 = fully open), space = room send, tune = the whole kit up or down in semitones (up also shortens the hits — tighter, snappier), pan = where it sits across the stereo (0.5 = centre). A fill is a point of RELEASE, not a running beat.`;

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
 * EVERY TURN OF THE SONG, ONE SITTING (2026-08-04, the user: "breaks just like
 * the effects should be done song wide in one call").
 *
 * The catalog is closed and the knobs are few, but WHICH fill belongs at a
 * turn is an arc question — variety and escalation only exist across the set.
 * Same tier and effort as the effects half (ROUTE.shape: Opus 5, high): both
 * halves of the sweep are now the same kind of judgment over the same span.
 *
 * Returns the chosen fills in turn order (a bare turn simply has no entry);
 * null = the whole call whiffed and the caller leaves what rides untouched —
 * distinguishable, with one call, from "every turn chose bare" ([]).
 */
export async function composePageBreaks(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    /** Every loop in play order — spans given so a fill is sized to its
     *  section (`bars` = the SPAN, `loopBars` = the natural loop length). */
    loops: TurnLoop[];
    /** The turns, in order. `toLoop` = 1-based arrival loop, null = the
     *  song's ending. `crossing` = glides landing in THIS sweep's answer
     *  (the 07-22 coupling — never the outgoing state). */
    turns: {
      atLoop: number;
      toLoop: number | null;
      crossing?: { name?: string; param: string; from: number; to: number }[];
    }[];
  },
  cfg?: LlmConfig,
): Promise<PageBreak[] | null> {
  if (!args.loops.length || !args.turns.length) return [];
  const loopLine = (l: TurnLoop, i: number) => {
    const reps = l.bars && l.loopBars ? Math.round(l.bars / l.loopBars) : 1;
    const span = l.bars
      ? reps > 1
        ? ` (${l.bars} bars — its ${l.loopBars}-bar loop ×${reps})`
        : ` (${l.bars} bars)`
      : "";
    return `${i + 1}. "${l.name}"${span}${l.intent?.trim() ? ` — ${l.intent.trim()}` : ""}${
      l.layers.length ? ` [layers: ${l.layers.join(", ")}]` : ""
    }`;
  };
  const turnLine = (t: (typeof args.turns)[number]) => {
    const from = args.loops[t.atLoop - 1];
    const to = t.toLoop ? args.loops[t.toLoop - 1] : null;
    const arrive = to
      ? t.toLoop === 1 && t.atLoop !== 1
        ? `back to "${to.name}" — the wrap onto the top`
        : `"${to.name}"`
      : "the song's ending — the last turn the piece takes";
    const crossing = t.crossing?.length
      ? ` — crossing: ${t.crossing
          .map((c) => `${c.name ? `"${c.name}" — ` : ""}${c.param} ${c.from}→${c.to}`)
          .join(" · ")}`
      : "";
    return `${t.atLoop}. "${from?.name ?? "?"}" → ${arrive}${crossing}`;
  };
  let user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    args.summary ? `The song: ${args.summary}` : "",
    "THE LOOPS (in play order):",
    ...args.loops.map(loopLine),
    "THE TURNS (in order):",
    ...args.turns.map(turnLine),
    // No "riding now" — a sweep is a fresh take (see composePageEffects):
    // showing the outgoing fills anchored the model into re-choosing them.
    `The turns. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  const wanted = new Set(args.turns.map((t) => t.atLoop));
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(PAGE_BREAKS_SYSTEM, user, cfg, {
        ...ROUTE.shape,
        trace: { kind: "page-breaks", attempt },
      })
    ).trim();
    const raw = firstJsonObject(reply) as { turns?: unknown } | null;
    if (raw && Array.isArray(raw.turns)) return sanitizePageBreaks(raw.turns, wanted);
    user += `\n\nThat reply was not usable. Resend ONLY the JSON object with a "turns" array.`;
  }
  return null;
}

/** The turns array, seat-checked: only turns the song actually has, one entry
 *  per seat (first claim wins), bare turns simply absent, in play order. */
export function sanitizePageBreaks(items: unknown[], wanted: Set<number>): PageBreak[] {
  const seen = new Set<number>();
  const out: PageBreak[] = [];
  for (const item of items) {
    const at = Math.floor(Number((item as { atLoop?: unknown })?.atLoop));
    if (!wanted.has(at) || seen.has(at)) continue; // unknown/duplicate seat
    seen.add(at);
    const b = sanitizeTurnBreak(item, at);
    if (b) out.push(b);
  }
  return out.sort((a, b) => a.atLoop - b.atLoop);
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
    loops: {
      name: string;
      intent?: string;
      layers: string[];
      bars?: number;
      loopBars?: number;
      /** Params this loop's OWN arrangement already sweeps — a glide wrapped
       *  outside would override those moves where they overlap, so the model
       *  is told to steer around them (the same-pass coupling: arrange lands
       *  first, effects second, one answer aware of the other). */
      rides?: string[];
      /** Params this loop's LAYERS set themselves (lpf, gain, room, …) — a
       *  glide on one of these would override the composed sound; the model
       *  is told never to, and the caller drops any that slip through. */
      authors?: string[];
    }[];
  },
  cfg?: LlmConfig,
): Promise<UnfoldFx[] | null> {
  if (!args.loops.length) return null;
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
      }${c.rides?.length ? ` [already rides: ${c.rides.join(", ")}]` : ""}${
        c.authors?.length ? ` [authored: ${c.authors.join(", ")}]` : ""
      }`;
    }),
    // One loop still has motion — it glides across itself. Say so, or the
    // model reads "no next section" as "no shape".
    args.loops.length === 1
      ? "This piece is ONE loop that repeats: a glide rides once across it."
      : "",
    // A SWEEP IS A FRESH TAKE (2026-08-03, prod song db62451f). The outgoing
    // effects used to ride in here labelled "replaced by your answer" — and
    // the model, anchored, re-emitted them verbatim on top of its new ones.
    // On that song the old set was authored against a starved 2-of-5-loop
    // context (the replay bug), so every re-sweep faithfully re-crammed the
    // poison it was meant to wash out. The write replaces wholesale; the
    // model composes from the song alone.
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
