/**
 * arrange-plan.ts — the song's ARRANGEMENT COMPOSER (2026-07-13).
 *
 * One Fable-5 HIGH call turns a finished set of section loops into a full song:
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
 "ending": {"mode": "stop"|"loop", "bars": n, "code": "$: <one Strudel line>"}
}

Name every sweep for what's HEARD, never its parameters. Sweeps ride the whole section's existing sound. The ending line follows the layer rules (in key, name a sound in the line, no setcpm/orbit) but plays ONCE and may ring past the last section. Layer numbers refer to the numbering given. A section you omit plays whole for its natural length. "stop" plays the song once and ends; "loop" wraps forever.`;

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

/** Pull the JSON object out of a reply (fences stripped, first {...} balanced). */
export function parseArrangementReply(reply: string): SongArrangement | null {
  const obj = firstJsonObject(reply);
  if (!obj) return null;
  const sections =
    obj.sections && typeof obj.sections === "object" && !Array.isArray(obj.sections)
      ? (obj.sections as Record<string, SectionArrange>)
      : undefined;
  const ending =
    obj.ending && typeof obj.ending === "object" && !Array.isArray(obj.ending)
      ? (obj.ending as SongArrangement["ending"])
      : undefined;
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
        ...ROUTE.compose,
        effort: "high",
        maxTokens: 14000,
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
// enrichSweeps op), mirroring enrichPartLayer exactly.

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
      ...ROUTE.transform,
      maxTokens: 1500,
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

export interface LoopChapter {
  /** What this pass IS ("First embers") — becomes the chapter's loop label. */
  name?: string;
  /** 1-based indices into the palette's layers, in their original order. */
  layers: number[];
}

export interface NextChapter extends LoopChapter {
  /** Revised Strudel per varied layer (1-based root index → line). The same
   *  voice saying something new; every line is gated before it plays and
   *  falls back to the original on failure. */
  vary?: Record<number, string>;
}

const NEXT_CHAPTER_SYSTEM = `You unfold the RAW LAYERS of an instrumental piece into its sequence of loops. The layers are the material — never heard all-together on their own; each loop is built from a subset of them, and the listener hears the loops in order. You're given the song's identity, the numbered layers, and the loops already made.

Respond with ONLY a JSON object, no markdown — either the next loop:
{
 "name": "2-4 words for what this loop IS",
 "layers": [1-based layer numbers audible in it],
 "vary": {"<layer number>": "$: <that layer's revised Strudel line>"} — the layers whose statement CHANGES in this loop; omit those playing as written
}
or, once the unfolding is complete, exactly: {"done": true}

A varied line is the same voice saying something new — same sound, in key, one line, no setcpm/orbit, the pulse never speeds up. Each loop is DIFFERENT from the ones already made. Layer numbers refer to the numbering given.`;

/** Parse + clamp a next-pass reply. "done" = the unfolding is complete;
 *  null = nothing usable (the caller stops either way). */
export function sanitizeNextChapter(
  raw: Record<string, unknown> | null,
  layerCount: number,
  chaptersSoFar: number,
): NextChapter | "done" | null {
  if (!raw) return null;
  if (raw.done === true) return "done";
  const layers = [
    ...new Set(
      (Array.isArray(raw.layers) ? raw.layers : [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= layerCount),
    ),
  ].sort((a, b) => a - b);
  if (!layers.length) return null;
  void chaptersSoFar;
  const out: NextChapter = { name: cleanFeel(raw.name), layers };
  if (raw.vary && typeof raw.vary === "object" && !Array.isArray(raw.vary)) {
    const vary: Record<number, string> = {};
    for (const [k, v] of Object.entries(raw.vary as Record<string, unknown>)) {
      const idx = Math.floor(Number(k));
      if (!layers.includes(idx)) continue;
      if (typeof v !== "string") continue;
      const line = v.trim();
      if (!line || /setcpm\s*\(/.test(line)) continue;
      vary[idx] = line;
    }
    if (Object.keys(vary).length) out.vary = vary;
  }
  return out;
}

/** ONE call: the loop + its chapters so far → the single next loop.
 *  One guided retry; null = nothing usable; "done" = the unfolding is over. */
export async function composeNextChapter(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    /** The PALETTE loop (its full layers — chapters draw from these). */
    section: ArrangeInputSection;
    /** Chapters already made from it, in play order (name + layer subset). */
    made: { name: string; layers: number[] }[];
    /** The song loop playing IMMEDIATELY BEFORE this material's first loop —
     *  the seam the first pass enters from (null when nothing precedes). */
    before?: { label: string; strudel: string } | null;
  },
  cfg?: LlmConfig,
): Promise<NextChapter | "done" | null> {
  const beats = Number(args.timeSignature.split("/")[0]) || 4;
  const parts = sectionParts(`${args.section.strudel}\nsetcpm(120/${beats})`);
  const layerCount = parts?.layers.length ?? 0;
  if (layerCount < 2) return null;
  const madeLines = args.made.length
    ? [
        "LOOPS ALREADY MADE (in play order):",
        ...args.made.map(
          (c, i) => `${i + 1}. "${c.name}" — layers ${c.layers.join(",")}`,
        ),
      ].join("\n")
    : args.before
      ? "LOOPS ALREADY MADE: none — the one you write ENTERS the song from the loop below."
      : "LOOPS ALREADY MADE: none — the one you write is the FIRST thing the listener hears.";
  let user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    args.summary ? `The song: ${args.summary}` : "",
    sectionBlock(args.section, beats),
    args.before && !args.made.length
      ? `THE LOOP PLAYING JUST BEFORE — the seam you take over from:\n${args.before.strudel}`
      : "",
    madeLines,
    `Write the next loop now — JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(NEXT_CHAPTER_SYSTEM, user, cfg, {
        ...ROUTE.compose,
        effort: "high",
        maxTokens: 2000,
        trace: { kind: "chapter", attempt },
      })
    ).trim();
    const parsed = sanitizeNextChapter(
      firstJsonObject(reply),
      layerCount,
      args.made.length,
    );
    if (parsed) return parsed;
    user += `\n\nThat reply was not usable. Resend ONLY the JSON object (layer numbers within 1..${layerCount}).`;
  }
  return null;
}


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

const NEXT_FX_SYSTEM = `You write the EFFECTS that ride a finished instrumental piece — parameter glides living OUTSIDE its loops, each spanning a range of them, added ONE AT A TIME. You're given the song's identity, the numbered layers the loops draw from, the loops in play order, and the glides already riding.

Respond with ONLY a JSON object, no markdown — the next glide:
{"name": "2-4 words for the MOVE a listener feels", "param": "<control, e.g. lpf|hpf|gain>", "from": n, "to": n, "curve": "linear"|"sine", "fromLoop": first loop it rides (1-based), "toLoop": last loop it rides}
or, when the piece has all the motion it wants: {"done": true}

Each glide runs ONCE across its whole range — from the first bar of fromLoop to the last bar of toLoop. Loop numbers refer to the play order given. Params that rebuild a shared bus (roomsize, delaytime) can't glide — ride lpf/hpf/gain/room/delayfeedback/resonance instead.`;

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

/** One reply of the effects walk → the next glide, "done", or null (unusable). */
export function sanitizeNextFx(
  raw: Record<string, unknown> | null,
  loopCount: number,
): UnfoldFx | "done" | null {
  if (!raw) return null;
  if (raw.done === true) return "done";
  const [fx] = sanitizeUnfoldFx({ effects: [raw] }, loopCount);
  return fx ?? null;
}

/** ONE pass of the effects walk over the finished unfold: sees every glide
 *  already riding, answers with the next one — or "done" when the piece has
 *  all the motion it wants. One guided retry; null = treat as done. */
export async function composeNextUnfoldFx(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    /** The blueprint's material (its numbered layers). */
    section: ArrangeInputSection;
    /** The finished loops, in play order. */
    loops: { name: string; layers: number[] }[];
    /** The glides already riding (this walk's earlier passes, or the user's own). */
    riding: { name?: string; param: string; fromLoop: number; toLoop: number }[];
  },
  cfg?: LlmConfig,
): Promise<UnfoldFx | "done" | null> {
  if (!args.loops.length) return "done";
  const beats = Number(args.timeSignature.split("/")[0]) || 4;
  let user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    args.summary ? `The song: ${args.summary}` : "",
    sectionBlock(args.section, beats),
    "THE LOOPS (in play order):",
    ...args.loops.map(
      (c, i) => `${i + 1}. "${c.name}" — layers ${c.layers.join(",")}`,
    ),
    args.riding.length
      ? [
          "RIDING ALREADY:",
          ...args.riding.map(
            (r) =>
              `- ${r.name ? `"${r.name}" — ` : ""}${r.param}, loops ${r.fromLoop}–${r.toLoop}`,
          ),
        ].join("\n")
      : "No effects yet.",
    `The next glide — or done. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(NEXT_FX_SYSTEM, user, cfg, {
        ...ROUTE.compose,
        effort: "high",
        maxTokens: 1200,
        trace: { kind: "unfold-fx", attempt },
      })
    ).trim();
    const parsed = sanitizeNextFx(firstJsonObject(reply), args.loops.length);
    if (parsed) return parsed;
    user += `\n\nThat reply was not usable. Resend ONLY the JSON object.`;
  }
  return null;
}


// ── PAGE SHAPE — the whole song's motion AND its turns, in ONE call ──────────
// The Sweep: effect glides and break fills are one gesture — the glide and the
// fill at the same turn are one decision — so a single call authors BOTH
// complete sets, told plainly that everything riding (both kinds) is replaced.
// (The old shape ran two sequential calls, each told the other category
// "stays": the effects argued around fills that the very next call deleted.
// Merged 2026-07-22 — the user: let it do whatever it thinks best.)

const PAGE_SHAPE_SYSTEM = `You shape a finished instrumental piece: its EFFECTS — parameter glides living OUTSIDE its loops, each spanning a range of them — and its BREAKS — short drum fills at its turns. You're given the song's identity and its loops in play order, each with its layers. Author BOTH complete sets together, as one gesture: a glide and a fill at the same turn are one decision — a long rise may want its turn bare, a hard cut may want the fill to carry it alone.

Respond with ONLY a JSON object, no markdown:
{"effects": [{"name": "2-4 words for the MOVE a listener feels", "param": "<control>", "from": n, "to": n, "curve": "linear"|"sine", "fromLoop": first loop it rides (1-based), "toLoop": last loop it rides}, …],
 "breaks": [{"tpl": "<template key>", "atLoop": the loop whose ending it rides (1-based), "gain": 0..1.2, "heat": 0..0.6, "tone": 0..1, "space": 0..0.8}, …]}

Each glide runs ONCE across its whole range — from the first bar of fromLoop to the last bar of toLoop. Loop numbers refer to the play order given. Glidable params: lpf, hpf, gain, room, delay, delayfeedback, resonance, shape, phaserrate. Params that rebuild a shared bus (roomsize, delaytime) cannot glide.
A break rides the closing bar(s) of one loop so the music breaks into the next: a point of release, not a running beat. Templates: roll (snare roll, last bar) · run (tom run, last bar) · build (doubling roll, last four bars) · stutter (kick stutter, last bar) · lift (rising hats, last bar) · clap (doubling claps, last two bars) · crash (push into a ringing crash, last bar) · tumble (tom cascade, last two bars). Knobs: gain = level, heat = drive, tone = how open the top is (1 = fully open), space = room send. At most one break per turn. An empty list is a valid answer for either.`;

export interface PageBreak {
  tpl: string;
  atLoop: number;
  gain: number;
  heat: number;
  tone: number;
  space: number;
}

const BREAK_TPLS = new Set(["roll", "run", "build", "stutter", "lift", "clap", "crash", "tumble"]);

function sanitizePageBreaks(list: unknown[], loopCount: number): PageBreak[] {
  const knob = (v: unknown, min: number, max: number, def: number) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : def;
  return list
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      tpl: String(e.tpl ?? ""),
      atLoop: Math.max(1, Math.min(loopCount, Math.floor(Number(e.atLoop)) || 1)),
      gain: knob(e.gain, 0, 1.2, 0.8),
      heat: knob(e.heat, 0, 0.6, 0),
      tone: knob(e.tone, 0, 1, 1),
      space: knob(e.space, 0, 0.8, 0),
    }))
    .filter((e) => BREAK_TPLS.has(e.tpl))
    // one break per turn — the first placement at a loop wins
    .filter((e, i, all) => all.findIndex((x) => x.atLoop === e.atLoop) === i)
    .slice(0, 8);
}

/** The Sweep's one call: the complete shape — effects AND breaks — for the
 *  piece. null = the model whiffed (caller changes nothing); a successful
 *  parse REPLACES both sets, and an empty list is a real answer (a piece can
 *  want bare turns), not a failure. */
export async function composePageShape(
  args: {
    genre?: string;
    key: string;
    bpm: number;
    timeSignature: string;
    summary?: string;
    /** Every loop on the page, in play order. */
    loops: { name: string; intent?: string; layers: string[]; bars?: number }[];
    /** The effects riding NOW — replaced wholesale. */
    ridingEffects?: { name?: string; param: string; from: number; to: number; fromLoop: number; toLoop: number }[];
    /** The break fills riding NOW — replaced wholesale. */
    ridingBreaks?: { tpl: string; atLoop: number; gain?: number; heat?: number; tone?: number; space?: number }[];
  },
  cfg?: LlmConfig,
): Promise<{ effects: UnfoldFx[]; breaks: PageBreak[] } | null> {
  if (!args.loops.length) return null;
  const riding = [
    ...(args.ridingEffects ?? []).map(
      (r) => `- effect: ${r.name ? `"${r.name}" — ` : ""}${r.param} ${r.from}→${r.to}, loops ${r.fromLoop}–${r.toLoop}`,
    ),
    ...(args.ridingBreaks ?? []).map(
      (r) => `- break: ${r.tpl}, the turn out of loop ${r.atLoop} (gain ${r.gain ?? 0.8}, heat ${r.heat ?? 0}, tone ${r.tone ?? 1}, space ${r.space ?? 0})`,
    ),
  ];
  let user = [
    `${args.genre ? `${args.genre} — ` : ""}key of ${args.key}, ${args.bpm} BPM, ${args.timeSignature}.`,
    args.summary ? `The song: ${args.summary}` : "",
    "THE LOOPS (in play order):",
    ...args.loops.map(
      (c, i) =>
        `${i + 1}. "${c.name}"${c.bars ? ` (${c.bars} bars)` : ""}${c.intent?.trim() ? ` — ${c.intent.trim()}` : ""}${
          c.layers.length ? ` [layers: ${c.layers.join(", ")}]` : ""
        }`,
    ),
    riding.length
      ? ["RIDING NOW (your sets replace ALL of this — both kinds):", ...riding].join("\n")
      : "Nothing rides yet.",
    `The complete shape — effects and breaks. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (
      await complete(PAGE_SHAPE_SYSTEM, user, cfg, {
        ...ROUTE.compose,
        effort: "high",
        maxTokens: 4000,
        trace: { kind: "page-shape", attempt },
      })
    ).trim();
    const raw = firstJsonObject(reply) as { effects?: unknown; breaks?: unknown } | null;
    const fxList = raw && Array.isArray(raw.effects) ? raw.effects : null;
    const brList = raw && Array.isArray(raw.breaks) ? raw.breaks : null;
    // At least one array must be present to count as an answer; a missing
    // sibling reads as an intentional empty (the contract asks for both).
    if (fxList || brList) {
      return {
        effects: fxList ? sanitizeUnfoldFx({ effects: fxList }, args.loops.length) : [],
        breaks: brList ? sanitizePageBreaks(brList, args.loops.length) : [],
      };
    }
    user += `\n\nThat reply was not usable. Resend ONLY the JSON object with "effects" and "breaks" arrays.`;
  }
  return null;
}
