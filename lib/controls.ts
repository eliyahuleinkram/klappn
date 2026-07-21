/**
 * Loop controls — the labeled sliders a user tweaks on a loop.
 *
 * A parameterize pass (a 2nd model call, see lib/anthropic.ts) rewrites a
 * finished loop so its key numbers are top-level `const`s, and prepends a spec
 * as a block comment:
 *
 *   /* @controls
 *   [{"name":"brightness","label":"Brightness","desc":"How open the filter is",
 *     "min":300,"max":9000,"step":50}]
 *   *\/
 *   const brightness = 1800
 *   setcpm(90/4)
 *   $: s("hh*8").lpf(brightness)
 *
 * The control's CURRENT value is read straight from its `const` line (the single
 * source of truth); moving a slider rewrites only that line — deterministic, no
 * AI, can't corrupt the rest of the program. The comment is plain JS, ignored at
 * playback. If the spec is missing or malformed, parseControls returns [] and
 * the loop simply has no sliders.
 */

export interface LoopControl {
  name: string;
  label: string;
  desc: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** The original generated value (spec.default) — what "Reset" restores. Falls
   *  back to the current value for older loops whose spec lacks it. */
  def: number;
  /** Whether the spec actually STORED a default (vs the fallback above). When
   *  false the UI can't know the original from the code alone — it remembers
   *  the first value it saw instead. */
  hasDef: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NUM = "-?\\d*\\.?\\d+";

/** Read a const's numeric value from the code, or null if absent/non-numeric. */
function readConst(code: string, name: string): number | null {
  const m = code.match(
    new RegExp(`(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*(${NUM})`),
  );
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** Parse a `@controls`-style spec block + each control's live value from its const
 *  line. `marker` is @controls (audio sliders) or @vcontrols (visual sliders) — the
 *  machinery is identical (both are named numeric consts the UI rewrites live).
 *  Controls whose name isn't a valid numeric const are dropped. */
function parseBlock(code: string, marker: string): LoopControl[] {
  if (!code) return [];
  const block = code.match(
    new RegExp(`\\/\\*\\s*${marker}\\b([\\s\\S]*?)\\*\\/`),
  );
  if (!block) return [];
  let spec: unknown;
  try {
    spec = JSON.parse(block[1].trim());
  } catch {
    return [];
  }
  if (!Array.isArray(spec)) return [];

  const out: LoopControl[] = [];
  const seen = new Set<string>();
  for (const raw of spec) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const name = typeof s.name === "string" ? s.name : "";
    if (!name || seen.has(name) || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
    const value = readConst(code, name);
    if (value === null) continue;

    let min = Number(s.min);
    let max = Number(s.max);
    if (!Number.isFinite(min)) min = Math.min(0, value);
    if (!Number.isFinite(max)) max = Math.max(value * 2 || 1, value);
    if (max <= min) max = min + 1;
    let step = Number(s.step);
    if (!Number.isFinite(step) || step <= 0) {
      // pick a sane step from the range magnitude
      step = (max - min) / 100;
      if (step > 1) step = Math.round(step);
    }
    // Don't let the stored value fall outside the advertised range.
    const clamped = Math.min(max, Math.max(min, value));
    // Original generated value, for Reset (fall back to current if not stored).
    const rawDef = Number(s.default);
    const hasDef = Number.isFinite(rawDef);
    const def = hasDef ? Math.min(max, Math.max(min, rawDef)) : clamped;

    seen.add(name);
    out.push({
      name,
      label: typeof s.label === "string" && s.label.trim() ? s.label : name,
      desc: typeof s.desc === "string" ? s.desc : "",
      min,
      max,
      step,
      value: clamped,
      def,
      hasDef,
    });
  }
  return out;
}

/** The AUDIO sliders (the `@controls` block parameterize adds to the music). */
export function parseControls(code: string): LoopControl[] {
  return parseBlock(code, "@controls");
}

/** The VISUAL sliders (the `@vcontrols` block parameterizeVisuals adds to the
 *  Hydra). Same machinery — named numeric consts the UI rewrites live. */
export function parseVControls(code: string): LoopControl[] {
  return parseBlock(code, "@vcontrols");
}

/** One-tap visual LOOK: a named set of grade-control values, proposed by the AI for THIS
 *  visual (the visual twin of a layer's pills). Stored as an `@vlooks` block beside
 *  `@vcontrols`; the Visuals panel renders them as chips. */
export interface VisualLook {
  name: string;
  set: Record<string, number>;
}

/** The `@vlooks` block — AI-proposed one-tap looks for the piece's visual, plus the AI's name
 *  for the DEFAULT grade. Empty looks/"" when absent or unparsable (the panel then falls back
 *  to its fixed presets and a plain "Default" chip). Accepts the legacy bare-array shape too. */
export function parseVLooks(code: string): { defaultName: string; looks: VisualLook[] } {
  const none = { defaultName: "", looks: [] as VisualLook[] };
  const m = (code || "").match(/\/\*\s*@vlooks\b([\s\S]*?)\*\//);
  if (!m) return none;
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch {
    return none;
  }
  const obj = parsed as { default?: unknown; looks?: unknown };
  const arr = Array.isArray(parsed) ? parsed : obj?.looks;
  const defaultName =
    !Array.isArray(parsed) && typeof obj?.default === "string"
      ? obj.default.trim().slice(0, 18)
      : "";
  if (!Array.isArray(arr)) return none;
  const out: VisualLook[] = [];
  for (const l of arr as { name?: unknown; set?: Record<string, unknown> }[]) {
    const name = typeof l?.name === "string" ? l.name.trim().slice(0, 18) : "";
    const set: Record<string, number> = {};
    for (const [k, v] of Object.entries(l?.set ?? {})) {
      const n = Number(v);
      if (k && Number.isFinite(n)) set[k] = n;
    }
    if (name && Object.keys(set).length) out.push({ name, set });
  }
  return { defaultName, looks: out.slice(0, 5) };
}

/** Bake each control's CURRENT const value into the spec as its "default" (where
 *  the spec doesn't already store one). Run at WRITE time — right after a loop is
 *  composed or reworked, when current value === original value — so "Reset" always
 *  knows the original, forever, no matter how the sliders move later. */
export function bakeControlDefaults(code: string): string {
  if (!code) return code;
  let out = code;
  for (const marker of ["@controls", "@vcontrols"]) {
    const m = out.match(new RegExp(`\\/\\*\\s*${marker}\\b([\\s\\S]*?)\\*\\/`));
    if (!m) continue;
    let spec: unknown;
    try {
      spec = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    if (!Array.isArray(spec)) continue;
    const baked = spec.map((s) => {
      if (!s || typeof s !== "object") return s;
      let e = s as Record<string, unknown>;
      if (!Number.isFinite(Number(e.default))) {
        const v = typeof e.name === "string" ? readConst(out, e.name) : null;
        if (v !== null) e = { ...e, default: v };
      }
      // THE LEAD MUST REACH SILENCE: people mute the melody to sing over the
      // band live. Enforced here — deterministic, on every code path (compose,
      // variants, meter changes) — so no AI-chosen range can pin it above 0.
      if (marker === "@controls" && e.name === "lead" && Number(e.min) > 0) {
        e = { ...e, min: 0 };
      }
      return e;
    });
    out = out.replace(m[0], `/* ${marker}\n${JSON.stringify(baked)}\n*/`);
  }
  return out;
}

/** Rewrite a control's const line to a new value. Returns the code unchanged if
 *  the const isn't found. */
export function setControlValue(
  code: string,
  name: string,
  value: number,
): string {
  const re = new RegExp(
    `((?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*)(${NUM})`,
  );
  if (!re.test(code)) return code;
  // Trim float noise but keep integers clean.
  const v = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return code.replace(re, `$1${v}`);
}

// --- per-track knobs ---------------------------------------------------------
// The layer engine gives each track its OWN tweak panel (track.controls: a real
// Strudel method + range). A knob drives a method argument on that track's "$:" line
// directly — no @controls consts. These read/write that arg surgically, counting only
// "$:" lines (setcpm and blanks are skipped). A BARE scalar is replaced outright; a
// QUOTED NUMERIC PATTERN ("<0.42 0.6 0.75>", "0.5 0.7") is SCALED as a whole (the
// staged pipeline writes expressive per-bar gain/lpf/lpq patterns, and a knob over one
// used to be a silent no-op). A non-numeric arg (note names) or an unquoted modulator
// (sine.range()) is still refused, so a slider can never corrupt those.

function layerLineIndex(lines: string[], layerIndex: number): number {
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\$:/.test(lines[i]) && ++seen === layerIndex) return i;
  }
  return -1;
}

/** The representative value of a QUOTED mini-notation pattern made ONLY of numbers
 *  (e.g. "<0.42 0.44 [0.8 0.5]>" → 0.42). Returns null for note names / words (letters)
 *  so a knob never mangles a `note(...)`-style pattern, and 0 only when every token is 0.
 *  Read returns this; write scales the whole pattern so this value becomes the target. */
function numericPatternRef(inner: string): number | null {
  if (!/[0-9]/.test(inner) || /[a-zA-Z]/.test(inner)) return null;
  const nums = (inner.match(new RegExp(NUM, "g")) || []).map(Number);
  if (!nums.length) return null;
  const first = nums[0];
  return first > 0 ? first : Math.max(0, ...nums);
}

/** Set the SCALAR argument of `param` on the Nth (0-based) "$:" layer, e.g. set
 *  layer 3's .lpf(...) to 820. Returns the code unchanged if the layer/method
 *  isn't found or its current arg isn't a bare number. */
export function setLayerMethodArg(
  code: string,
  layerIndex: number,
  param: string,
  value: number,
): string {
  const lines = code.split("\n");
  const idx = layerLineIndex(lines, layerIndex);
  if (idx < 0) return code;
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(4))));
  // Match a QUOTED scalar too — .gain("0.4") — and normalize it to a bare number on write,
  // so the slider can actually move it (the quotes used to make this regex miss → no-op write).
  const re = new RegExp(
    `(\\.${escapeRegExp(param)}\\(\\s*)["']?(${NUM})["']?(\\s*\\))`,
  );
  if (re.test(lines[idx])) {
    lines[idx] = lines[idx].replace(re, `$1${fmt(value)}$3`);
    return lines.join("\n");
  }
  // A QUOTED NUMERIC PATTERN — .gain("<0.42 0.6 0.75>"), .lpf("<500 900>"). SCALE the whole
  // pattern so its representative value becomes `value`, preserving the per-bar shape.
  const patRe = new RegExp(
    `(\\.${escapeRegExp(param)}\\(\\s*)(["'\`])([^"'\`]*)\\2(\\s*\\))`,
  );
  const pm = lines[idx].match(patRe);
  if (pm) {
    const ref = numericPatternRef(pm[3]);
    if (ref && ref > 0) {
      const k = value / ref;
      const scaled = pm[3].replace(new RegExp(NUM, "g"), (n) => fmt(Number(n) * k));
      lines[idx] = lines[idx].replace(patRe, `$1$2${scaled}$2$4`);
      return lines.join("\n");
    }
    if (ref === 0) {
      // every token is 0 — nothing to scale; collapse to the bare scalar.
      lines[idx] = lines[idx].replace(patRe, `$1${fmt(value)}$4`);
      return lines.join("\n");
    }
  }
  return code;
}

/** Swap a layer's INSTRUMENT — replace the string arg of `.sound(...)` / `.s(...)`
 *  (via "sound", a synth voice) or `.bank(...)` (via "bank", a drum kit) on the Nth
 *  "$:" layer. Deterministic string replace; a leading `s("bd*4")` sample pattern is
 *  left alone (only the dotted method form is a swappable voice). */
export function setLayerInstrument(
  code: string,
  layerIndex: number,
  via: "sound" | "bank",
  value: string,
): string {
  const lines = code.split("\n");
  const idx = layerLineIndex(lines, layerIndex);
  if (idx < 0) return code;
  const v = value.replace(/["'`\\]/g, "").trim();
  if (!v) return code;
  if (via === "bank") {
    const re = /(\.bank\(\s*["'`])([^"'`]*)(["'`]\s*\))/;
    if (!re.test(lines[idx])) return code;
    lines[idx] = lines[idx].replace(re, `$1${v}$3`);
    return lines.join("\n");
  }
  // The sound rides on `s(...)`/`sound(...)` — match it whether it LEADS the line (the pulse idiom
  // `$: s("sine*8").note(...)`, no dot prefix) or is chained (`.s("gm_pad")`). Replace only the sound
  // NAME and KEEP any pattern suffix — the `*8` in `sine*8` is the RHYTHM, not the sound — so a swap
  // never silently drops the pulse and leaves the layer playing a single note.
  const re = /(\bs(?:ound)?\(\s*["'`])([^"'`]*)(["'`]\s*\))/;
  if (!re.test(lines[idx])) return code;
  lines[idx] = lines[idx].replace(
    re,
    (_m: string, pre: string, content: string, post: string) => {
      const swapped = /^[A-Za-z_]/.test(content)
        ? content.replace(/^[A-Za-z_][\w:]*/, v)
        : v;
      return `${pre}${swapped}${post}`;
    },
  );
  return lines.join("\n");
}

// Drum machines don't all carry the same samples. Tokens below are the ACTUAL per-bank
// sample names from the strudel tidal-drum-machines manifest (strudel.b-cdn.net/
// tidal-drum-machines.json — `curl` it + grep "<Bank>_<token>" to re-derive/extend).
// A listed kit exposes ONLY these; any kit not listed is treated as complete. Used by
// bankSupports() to offer ONLY kits that HAVE a layer's drums (so a swap can't 404 a
// missing sample, e.g. "RolandTR606_cp not found"), WITHOUT wrongly hiding kits that
// DO have them — the manifest has 70 machines; ~42 have crash, ~31 have ride.
const DRUM_KIT_SAMPLES: Record<string, Set<string>> = {
  rolandtr909: new Set("bd cp cr hh ht lt mt oh rd rim sd".split(" ")),
  rolandtr808: new Set("bd cb cp cr hh ht lt mt oh perc rim sd sh".split(" ")),
  rolandtr707: new Set("bd cb cp cr hh ht lt mt oh rim sd tb".split(" ")),
  rolandtr606: new Set("bd cr hh ht lt oh sd".split(" ")),
  rolandtr505: new Set("bd cb cp cr hh ht lt mt oh perc rd rim sd".split(" ")),
  linndrum: new Set("bd cb cp cr hh ht lt mt oh perc rd rim sd sh tb".split(" ")),
  akaimpc60: new Set("bd cp cr hh ht lt misc mt oh perc rd rim sd".split(" ")),
  oberheimdmx: new Set("bd cp cr hh ht lt mt oh rd rim sd sh tb".split(" ")),
  rolandr8: new Set("bd cb cp cr hh ht lt mt oh perc rd rim sd sh tb".split(" ")),
  alesissr16: new Set("bd cb cp cr hh misc oh perc rd rim sd sh tb".split(" ")),
  emusp12: new Set("bd cb cp cr hh ht lt misc mt oh perc rd rim sd".split(" ")),
  casiorz1: new Set("bd cb cp cr hh ht lt mt rd rim sd".split(" ")),
  korgm1: new Set("bd cb cp cr hh ht misc mt oh perc rd rim sd sh tb".split(" ")),
  yamahary30: new Set("bd cb cp cr hh ht lt misc mt oh perc rd rim sd sh tb".split(" ")),
};

/** Drum machines, named by the VIBE a non-musician recognises (not the model number —
 *  "TR-909" means nothing to most people, "House" does). Exact bank name + relatable
 *  label. This is the full roster used to NAME whatever kit a layer is on. */
export const DRUM_KITS: { s: string; name: string }[] = [
  { s: "RolandTR909", name: "House" },
  { s: "RolandTR808", name: "Trap" },
  { s: "RolandTR707", name: "Clean" },
  { s: "RolandTR606", name: "Tight" },
  { s: "RolandTR505", name: "Retro" },
  { s: "LinnDrum", name: "Eighties" },
  { s: "AkaiMPC60", name: "Hip-hop" },
  { s: "OberheimDMX", name: "Electro" },
  { s: "RolandR8", name: "Acoustic" },
  { s: "AlesisSR16", name: "Rock" },
  { s: "EmuSP12", name: "Vintage" },
  { s: "CasioRZ1", name: "Lo-fi" },
  { s: "KorgM1", name: "Dance" },
  { s: "YamahaRY30", name: "Modern" },
];

/** The HANDFUL of kits actually OFFERED as swaps on a drum layer — too many choices
 *  overwhelm (the same reason melodic layers only show ~3 alternatives). A tight, maximally
 *  DISTINCT spread of vibes; the UI still filters these by `bankSupports` per layer, and
 *  always keeps whatever kit the layer is currently on. The other kits above are never
 *  offered, but still resolve to a relatable name via `drumKitName`. */
const OFFERED_KITS = new Set([
  "RolandTR909", // House
  "RolandTR808", // Trap
  "LinnDrum", // Eighties
  "AkaiMPC60", // Hip-hop
  "RolandR8", // Acoustic
]);
export const DRUM_KITS_OFFERED: { s: string; name: string }[] = DRUM_KITS.filter(
  (k) => OFFERED_KITS.has(k.s),
);

/** The relatable name for a kit token (e.g. "RolandTR808" → "Trap"); falls back to a
 *  cleaned-up token for anything off-roster. */
export function drumKitName(s: string): string {
  return (
    DRUM_KITS.find((k) => k.s.toLowerCase() === s.toLowerCase())?.name ??
    prettySoundName(s)
  );
}

/** True if `bank` has every drum sample the layer's `s(...)` patterns use, so swapping
 *  to it won't 404 a missing sample. Unknown banks are assumed complete. */
export function bankSupports(bank: string, layerCode: string): boolean {
  const has = DRUM_KIT_SAMPLES[bank.toLowerCase().replace(/[^a-z0-9]/g, "")];
  if (!has) return true;
  for (const m of layerCode.matchAll(/\bs\(\s*["'`]([^"'`]+)/g))
    for (const w of m[1].match(/[a-z][a-z0-9]*/gi) ?? [])
      if (!has.has(w.toLowerCase())) return false;
  return true;
}

/** Read the current SCALAR value of `param` on the Nth "$:" layer, or null when it
 *  isn't a bare number (so the knob shows its spec default instead). */
export function getLayerMethodArg(
  code: string,
  layerIndex: number,
  param: string,
): number | null {
  const lines = code.split("\n");
  const idx = layerLineIndex(lines, layerIndex);
  if (idx < 0) return null;
  // Tolerate a QUOTED scalar too — the AI sometimes writes .gain("0.4") (a string that
  // Strudel still parses as 0.4); without the optional quotes the knob read null and the
  // slider showed a default it couldn't write back to (it looked stuck). [^"'] optional quote.
  const m = lines[idx].match(
    new RegExp(`\\.${escapeRegExp(param)}\\(\\s*["']?(${NUM})["']?\\s*\\)`),
  );
  if (m) return Number(m[1]);
  // Patterned numeric arg → show its representative value so the knob isn't stuck on a
  // default it can't write back to (and so it round-trips with the scaling setter above).
  const pm = lines[idx].match(
    new RegExp(`\\.${escapeRegExp(param)}\\(\\s*(["'\`])([^"'\`]*)\\1\\s*\\)`),
  );
  if (pm) {
    const ref = numericPatternRef(pm[2]);
    if (ref != null) return ref;
  }
  return null;
}

// --- sound swaps -------------------------------------------------------------
// An AI pass proposes ALTERNATIVE instruments per layer (`/* @swaps */` JSON):
// [{ "find": "gm_epiano1", "label": "Lead", "options": [{ "s": "...", "label": "..." }] }]
// "find" is the ORIGINAL sound; applying a swap is a DETERMINISTIC string
// replacement of the currently-active name — the AI only ever suggests.

export interface SoundSwap {
  find: string;
  label: string;
  /** Friendly name of the ORIGINAL sound (what you come back to). Optional —
   *  older swaps lack it; fall back to prettySoundName(find). */
  findLabel?: string;
  /** The 1-based "$:" layer this swap belongs to. With it, the swap touches
   *  ONLY that layer — two instruments sharing one synth sound stay
   *  individually controllable. Absent (older swaps) → whole-loop replace. */
  layer?: number;
  options: { s: string; label: string }[];
}

/** A human-friendly name derived from a raw sound id: "gm_pad_metallic" →
 *  "Pad metallic", "supersaw" → "Supersaw". The deterministic fallback when a
 *  swap doesn't carry a findLabel. */
export function prettySoundName(s: string): string {
  const t = (s || "").replace(/^gm_/, "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : s;
}

export function parseSwaps(code: string | null | undefined): SoundSwap[] {
  if (!code) return [];
  const m = code.match(/\/\*\s*@swaps\b([\s\S]*?)\*\//);
  if (!m) return [];
  try {
    const j = JSON.parse(m[1].trim());
    if (!Array.isArray(j)) return [];
    return j
      .filter(
        (s): s is SoundSwap =>
          !!s &&
          typeof s.find === "string" &&
          typeof s.label === "string" &&
          Array.isArray(s.options),
      )
      .map((s) => ({
        ...s,
        layer:
          Number.isFinite(Number(s.layer)) && Number(s.layer) >= 1
            ? Math.round(Number(s.layer))
            : undefined,
        options: s.options.filter(
          (o) => o && typeof o.s === "string" && typeof o.label === "string",
        ),
      }))
      .filter((s) => s.options.length > 0);
  } catch {
    return [];
  }
}

const SWAPS_BLOCK_RE = /\/\*\s*@swaps\b[\s\S]*?\*\//;

/** The [start, end) span of the 1-based Nth "$:" layer, or null. Operates on
 *  code whose @swaps block the caller already removed/shielded. */
function layerSpan(code: string, layer?: number): [number, number] | null {
  if (!layer || layer < 1) return null;
  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (layer > starts.length) return null;
  return [
    starts[layer - 1],
    layer < starts.length ? starts[layer] : code.length,
  ];
}

/** Whether `sound` is played in the 1-based Nth "$:" layer (used to validate
 *  AI-proposed swaps before they're ever offered). */
export function soundInLayer(code: string, sound: string, layer: number): boolean {
  const music = (code || "").replace(SWAPS_BLOCK_RE, "");
  const span = layerSpan(music, layer);
  if (!span) return false;
  const seg = music.slice(span[0], span[1]);
  return seg.includes(`"${sound}"`) || seg.includes(`'${sound}'`);
}

/** The swap's currently-active sound: whichever of [find, ...options] appears in
 *  the MUSIC right now (the original until a swap is applied) — within the
 *  swap's own layer when it has one. CRITICAL: the @swaps comment itself
 *  contains every name, so it must be excluded from the search — otherwise the
 *  original always "wins" and the ✓ never moves. */
export function activeSwapSound(code: string, swap: SoundSwap): string {
  const music = code.replace(SWAPS_BLOCK_RE, "");
  const span = layerSpan(music, swap.layer);
  const hay = span ? music.slice(span[0], span[1]) : music;
  const names = [swap.find, ...swap.options.map((o) => o.s)];
  return (
    names.find((n) => hay.includes(`"${n}"`) || hay.includes(`'${n}'`)) ??
    swap.find
  );
}

/** The one-tap EDIT PILLS suggested for this loop (`/* @edits *\/` JSON: an
 *  array of short imperative phrases). Empty when absent/malformed. */
export function parseEdits(code: string | null | undefined): string[] {
  if (!code) return [];
  const m = code.match(/\/\*\s*@edits\b([\s\S]*?)\*\//);
  if (!m) return [];
  try {
    const j = JSON.parse(m[1].trim());
    return Array.isArray(j)
      ? j.filter((e): e is string => typeof e === "string" && !!e.trim()).slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

/** The 1-based "$:" layer whose code USES this const (e.g. `.gain(bass)`), or
 *  null. Lets the UI pair a knob with the INSTRUMENT currently playing that
 *  layer — so a knob can read "Chords level · Vibraphone", derived live from
 *  the code (swap the instrument and the name follows, the value stays). */
export function constLayer(code: string, name: string): number | null {
  const music = stripMetaBlocks(code).replace(/\/\*\s*@hydra\b[\s\S]*?\*\//, "");
  const starts: number[] = [];
  for (const m of music.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : music.length;
    if (re.test(music.slice(starts[i], end))) return i + 1;
  }
  return null;
}

/** Carry the user's CURRENT knob values onto a different take: for every
 *  control the new code exposes, keep the value the old code had for that same
 *  name (clamped to the new knob's range). Switching styles never resets the
 *  tweaks that still exist — knob settings are the USER'S intent, not the
 *  take's. Knobs only the new take has keep its own values. */
export function carryControlValues(fromCode: string, toCode: string): string {
  if (!fromCode || !toCode) return toCode;
  let out = toCode;
  for (const c of parseControls(toCode)) {
    const prev = readConst(fromCode, c.name);
    if (prev === null) continue;
    const v = Math.min(c.max, Math.max(c.min, prev));
    if (v !== c.value) out = setControlValue(out, c.name, v);
  }
  return out;
}

/** Remove the machine spec comments (@controls/@vcontrols/@swaps/@edits) from a
 *  loop. What an EDIT model should see — and return — is the music itself; the
 *  specs are regenerated for the new code afterwards. The consts stay (they're
 *  real code the music references). */
export function stripMetaBlocks(code: string): string {
  return (code || "")
    .replace(
      /\/\*\s*@(?:controls|vcontrols|vlooks|swaps|edits)\b[\s\S]*?\*\/\n*/g,
      "",
    )
    .trim();
}

/** Deterministically swap one sound name for another (both quote styles) — in
 *  the MUSIC ONLY, and (when `layer` is given) ONLY inside that "$:" layer, so
 *  two instruments sharing a synth sound stay individually swappable. The
 *  @swaps spec block is shielded first, so applying a swap can never rewrite
 *  the spec itself (which corrupted the "original" and broke switching). */
export function applySwap(
  code: string,
  from: string,
  to: string,
  layer?: number,
): string {
  if (!from || !to || from === to) return code;
  const m = code.match(SWAPS_BLOCK_RE);
  const block = m?.[0] ?? "";
  const SHIELD = "\u0000@SWAPS@\u0000"; // unmatchable sentinel, written as escapes
  const guarded = block ? code.replace(block, SHIELD) : code;
  const replaceIn = (seg: string) =>
    seg.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  const span = layerSpan(guarded, layer);
  const swapped = span
    ? guarded.slice(0, span[0]) +
      replaceIn(guarded.slice(span[0], span[1])) +
      guarded.slice(span[1])
    : replaceIn(guarded);
  return block ? swapped.replace(SHIELD, block) : swapped;
}

/** The visual slider spec (one per knob), with neutral defaults so the look is
 *  unchanged until tweaked. SAFE by construction: a colour-grade tail (saturate/
 *  contrast/brightness/hue) — all real, chained hydra methods that never touch the
 *  loop-sync-critical periods/clocks, so they can't break checkHydra's gates. */
const V_GRADE = ".saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue)";
const V_CONSTS =
  "const vSaturation = 1\nconst vContrast = 1\nconst vBrightness = 0\nconst vHue = 0\n";
const V_SPEC = JSON.stringify(
  [
    { name: "vSaturation", label: "Colour", desc: "Raise for richer, more vivid colour; lower toward greyscale.", min: 0, max: 2, step: 0.05, default: 1 },
    { name: "vContrast", label: "Contrast", desc: "Raise for punchier light and shadow; lower for a flatter, softer image.", min: 0.5, max: 2, step: 0.05, default: 1 },
    { name: "vBrightness", label: "Brightness", desc: "Raise to lift the whole visual brighter; lower to sink it darker.", min: -0.3, max: 0.3, step: 0.02, default: 0 },
    { name: "vHue", label: "Hue shift", desc: "Rotate the entire colour palette around the wheel.", min: 0, max: 1, step: 0.02, default: 0 },
  ],
  null,
  0,
);

/** Remove any pre-existing machine grade (the v* consts + the grade tail) from a
 *  Hydra block. A continuity-prompted model can ECHO a neighbour's graded code —
 *  re-grading that verbatim declared `const vSaturation` twice, a play-time
 *  SyntaxError. Always strip before grading. */
export function stripVisualGrade(hydra: string): string {
  return (hydra || "")
    .replace(/^\s*const\s+v(?:Saturation|Contrast|Brightness|Hue)\s*=[^\n]*\n?/gm, "")
    .split(V_GRADE)
    .join("")
    .trim();
}

/**
 * Deterministically expose live VISUAL knobs on a Hydra block (the visual twin of
 * `parameterize`). Prepends 4 colour-grade consts and chains a neutral grade stage
 * before `.out()`, leaving the look identical until a slider moves. IDEMPOTENT:
 * any existing grade is stripped first, so re-grading can never double-declare.
 * Returns the graded Hydra code + the `@vcontrols` JSON (caller embeds it next to
 * the @hydra block). No-op (vcontrols "") if the code has no `.out()` to attach to.
 */
export function parameterizeVisuals(hydra: string): {
  hydra: string;
  vcontrols: string;
} {
  const clean = stripVisualGrade(hydra);
  const i = clean.lastIndexOf(".out(");
  if (i < 0) return { hydra: hydra || "", vcontrols: "" };
  const graded = `${V_CONSTS}${clean.slice(0, i)}${V_GRADE}${clean.slice(i)}`;
  return { hydra: graded, vcontrols: V_SPEC };
}

// ── canonical control names ──────────────────────────────────────────────────

/** Aliases the model (or an old knob spec) may use for a control, mapped to the
 *  real Strudel method name. */
const CONTROL_REMAP: Record<string, string> = {
  sound: 's', legato: 'clip', size: 'roomsize', up: 'note',
  delayfb: 'delayfeedback', dt: 'delaytime', dfb: 'delayfeedback',
  vel: 'velocity', att: 'attack', dec: 'decay', sus: 'sustain', rel: 'release',
  ctf: 'cutoff', lp: 'cutoff', hp: 'hcutoff', o: 'orbit', sz: 'roomsize', dist: 'distort',
};
const CONTROL_NAMES = [
  // pitch / source
  's', 'n', 'note', 'sound', 'freq', 'up',
  // dynamics / space basics
  'gain', 'pan', 'speed', 'accelerate', 'velocity', 'postgain', 'compressor', 'xfade',
  'dry', 'squiz', 'nudge',
  // shaping
  'crush', 'shape', 'coarse', 'vowel', 'distort', 'stretch',
  // filters
  'lpf', 'lpq', 'hpf', 'hpq', 'bpf', 'bpq', 'cutoff', 'resonance', 'hcutoff', 'hresonance',
  'bandf', 'bandq', 'ftype', 'drive', 'djf', 'fanchor',
  'lpenv', 'hpenv', 'bpenv', 'lpa', 'lpd', 'lps', 'lpr', 'hpa', 'hpd', 'hps', 'hpr', 'bpa', 'bpd', 'bps', 'bpr',
  // envelope
  'attack', 'decay', 'sustain', 'release', 'hold', 'adsr', 'dur', 'clip',
  // sample playback
  'begin', 'end', 'loop', 'cut', 'loopAt', 'unit', 'bank',
  // routing
  'orbit', 'channel', 'duckorbit', 'duckdepth', 'duckattack',
  // reverb / delay
  'room', 'roomsize', 'roomfade', 'roomlp', 'delay', 'delaytime', 'delayfeedback',
  // modulation
  'vib', 'vibmod', 'tremolo', 'tremolosync', 'tremolodepth',
  'phaser', 'phaserdepth', 'phasercenter', 'phasersweep',
  // fm / poly / pulse
  'fm', 'fmh', 'fmattack', 'fmdecay', 'fmrelease', 'fmsustain', 'fmwave', 'fmenv',
  'unison', 'detune', 'spread', 'pw', 'pwrate', 'pwsweep',
  // character / distortion (all verified present in Strudel)
  'amp', 'overgain', 'triode', 'overshape', 'krush', 'kcutoff', 'ring', 'ringf', 'ringdf',
  'octer', 'octersub', 'octersubsub', 'leslie', 'lrate', 'lsize', 'waveloss', 'gate', 'slide', 'voice',
  // spectral
  'comb', 'smear', 'scram', 'binshift', 'freeze', 'enhance', 'partials', 'fshift', 'fshiftnote', 'fshiftphase',
  // structural transforms that Strudel also chains like controls (so `# struct "~ x"` works)
  'struct', 'mask',
];
const CONTROLS: Record<string, string> = {};
for (const name of CONTROL_NAMES) CONTROLS[name] = name;
for (const [k, v] of Object.entries(CONTROL_REMAP)) CONTROLS[k] = v;

/** Canonical Strudel method name for a control / alias (legato→clip, size→roomsize, lpf→lpf, …);
 *  undefined if it isn't a known control. The enrich step uses this to resolve an alias-named knob to
 *  the real Strudel method the slider drives. */
export function strudelControlName(name: string): string | undefined {
  return CONTROLS[name];
}
