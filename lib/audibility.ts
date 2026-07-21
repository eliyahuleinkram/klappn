/**
 * Per-layer "will this actually be HEARD?" analysis — the signal the generation
 * loop can't get from its ears (it has none) and the UI uses to flag silent
 * layers right on the part card.
 *
 * We can't render audio server-side (no WebAudio in Workers) and we won't render
 * it client-side casually (Strudel's only offline-render path closes/hijacks the
 * GLOBAL audio context that live playback shares — see renderPatternAudio — so
 * running it mid-session would destabilise the core play feature). Instead we
 * read the code: the loudest causes of "I literally cannot hear that layer" are
 * visible in it. Heuristic for the fuzzy cases (severity "warn"), but exact for
 * the deterministic ones (severity "error" → the loop hard-fails and regenerates).
 *
 * Dependency-light on purpose (no acorn / no Node) so it bundles cleanly into the
 * browser for the part-card readout AND runs in the Workflow validator.
 */

export type Severity = "error" | "warn";

export interface LayerAudibility {
  /** 1-based index of the active `$:` layer in the part. */
  layer: number;
  /** The layer's first source line, trimmed (and clipped) for display. */
  code: string;
  /** Plain-English reason this layer is / may be inaudible. */
  issue: string;
  /** "error" = deterministically silent (hard-fail); "warn" = likely inaudible. */
  severity: Severity;
}

const MUSICAL = /\b(?:chord|note|n)\s*\(|\bvoicing\b|\bpiano\b/;
const TEXTURE = /\b(?:crackle|noise|white|pink|brown|wind|vinyl|hiss)\b/;

// Voicing dictionaries that define ONLY seventh/extended chords. Feeding them a
// bare triad voices to nothing → the layer is dead silent. (Verified against
// @strudel/tonal voicings.mjs: lefthand/guidetones have no triad keys.)
const SEVENTH_ONLY_DICT = /\.dict\(\s*["'`](lefthand|guidetones)["'`]\s*\)/;

/** A chord quality with no 7th/extension — a bare triad (silent under lefthand). */
function isTriadQuality(q: string): boolean {
  return /^(?:|m|M|maj|min|o|dim|aug|\+|-)$/.test(q);
}

/**
 * The reported bug: chord("<Am F G>").dict('lefthand').voicing() is SILENT because
 * 'lefthand' has no triad voicings. Catch that family exactly.
 */
function triadWithSeventhDict(text: string): { issue: string; severity: Severity } | null {
  const dm = text.match(SEVENTH_ONLY_DICT);
  if (!dm) return null;
  const cm = text.match(/\bchord\(\s*["'`]([^"'`]+)["'`]/);
  if (!cm) return null;
  const triads: string[] = [];
  for (const tok of cm[1].replace(/[<>[\]{}(),~|]/g, " ").split(/\s+/)) {
    const m = tok.match(/^([A-G][b#]*)(.*)$/);
    if (m && isTriadQuality(m[2])) triads.push(tok);
  }
  if (!triads.length) return null;
  const shown = [...new Set(triads)].slice(0, 3).join(", ");
  return {
    severity: "error",
    issue: `.dict('${dm[1]}') with bare triad${triads.length > 1 ? "s" : ""} ${shown} — '${dm[1]}' only voices 7th/extended chords, so this layer is SILENT; use sevenths (e.g. ${triads[0]}7) or drop .dict()`,
  };
}

/**
 * Diagnose ONE layer's full text (it may span several physical lines, since a
 * method chain is often broken across lines). Returns the first real problem, or
 * null if it looks audible. Deterministic causes first, then fuzzy ones.
 */
function diagnoseLayer(text: string): { issue: string; severity: Severity } | null {
  const triad = triadWithSeventhDict(text);
  if (triad) return triad;
  // Reversed sample playback — negative .speed()/.fast() on a one-shot/pitched
  // sample very often plays near-silent. Number or "<-1 ...>".
  if (/\.(?:speed|fast)\s*\(\s*["'`<]?\s*-/.test(text))
    return {
      severity: "warn",
      issue: "reversed playback (negative .speed) — reversed one-shots are often inaudible",
    };
  if (/\.gain\s*\(\s*0(?:\.0+)?\s*\)/.test(text))
    return { severity: "warn", issue: "gain is 0 — silent" };
  // Near-silent gain on a MUSICAL line (texture like crackle/noise is meant to be
  // quiet, so don't flag it).
  const g = text.match(/\.gain\s*\(\s*(0?\.0[0-4]\d*)\s*\)/);
  if (g && MUSICAL.test(text) && !TEXTURE.test(text))
    return { severity: "warn", issue: `gain ${g[1]} is near-silent for a melodic layer` };
  // Choked low-pass on a melodic line — below ~250Hz it's mud you can't make out.
  const f = text.match(/\.(?:lpf|cutoff)\s*\(\s*["'`<]?\s*(\d{2,3})\b/);
  if (f && MUSICAL.test(text) && Number(f[1]) < 250)
    return { severity: "warn", issue: `low-passed to ${f[1]}Hz — muffled past recognition` };
  return null;
}

/** Group a part into labelled layers. Each starts at a line beginning with `$:`
 *  (or `_$:` for muted) and absorbs continuation lines (`.method(...)` chains). */
function splitLayers(code: string): { muted: boolean; text: string }[] {
  const layers: { muted: boolean; text: string }[] = [];
  let cur: { muted: boolean; text: string } | null = null;
  for (const raw of (code || "").split("\n")) {
    const t = raw.trim();
    const muted = /^_\s*\$\s*:/.test(t);
    const active = /^\$\s*:/.test(t);
    if (muted || active) {
      if (cur) layers.push(cur);
      cur = { muted, text: raw };
    } else if (cur) {
      cur.text += "\n" + raw;
    }
  }
  if (cur) layers.push(cur);
  return layers;
}

/** Walk a part's code and return one entry per ACTIVE `$:` layer that looks
 *  inaudible. Muted layers (`_$:`) are intentional silence and skipped. */
export function analyzeAudibility(code: string): LayerAudibility[] {
  const out: LayerAudibility[] = [];
  let idx = 0;
  for (const L of splitLayers(code)) {
    if (L.muted) continue;
    idx++;
    const d = diagnoseLayer(L.text);
    if (!d) continue;
    const first = L.text.split("\n")[0].trim();
    out.push({
      layer: idx,
      code: first.length > 90 ? first.slice(0, 89) + "…" : first,
      issue: d.issue,
      severity: d.severity,
    });
  }
  return out;
}
