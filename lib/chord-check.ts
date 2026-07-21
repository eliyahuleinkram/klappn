import { CHORD_QUALITIES } from "./chord-symbols";

/**
 * Chord/harmony static checks — the "parses fine but the browser plays silence
 * or a single note" class that neither acorn nor a code-reading critic reliably
 * catches. All deterministic.
 *
 *  1. .voicing() fed by note()/n() instead of chord() → voicing reads the CHORD
 *     control, so note names never voice → silent. HARD.
 *  2. an unrecognised chord symbol (maj7, 7sus4, min7, dim…) → the default dict
 *     has no entry, so it collapses to one fallback note. HARD.
 *  3. harmonic layers whose <...> progressions are different lengths → they
 *     PHASE against each other (one layer on Am while another is on F at the
 *     same moment). SOFT (heuristic) — fed to the harmony judge + refine.
 */

export interface ChordIssues {
  errors: string[];
  warnings: string[];
}

// Strip mini-notation modifiers (*2, !3, @2, /2, ?, brackets) to bare tokens.
function tokens(s: string): string[] {
  return s
    .replace(/[[\]<>{}(),]/g, " ")
    .replace(/[*/!@%][0-9.]+/g, "")
    .replace(/\?[0-9.]*/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// A chord token → its quality (everything after the root), or null if it isn't a
// root-led chord attempt (rest, number, lowercase note name…). Handles
// accidentals and slash chords (C/E → validate "C").
function chordQuality(tok: string): string | null {
  if (tok === "~" || /^[0-9.]+$/.test(tok)) return null;
  const main = tok.split("/")[0];
  const m = main.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return null;
  return m[2];
}

function chordStrings(code: string): string[] {
  const out: string[] = [];
  const re = /\bchord\s*\(\s*(['"`])([^'"`]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push(m[2]);
  return out;
}

export function checkChords(code: string): ChordIssues {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. .voicing() needs chord() in the same layer.
  let voicingMisuse = false;
  for (const layer of code.split(/\$:/)) {
    if (/\.voicing\s*\(/.test(layer) && !/\bchord\s*\(/.test(layer)) {
      voicingMisuse = true;
    }
  }
  if (voicingMisuse) {
    errors.push(
      `.voicing() is used without chord() in that layer — voicing reads the CHORD control, so note names never voice (silent). Use chord("<...>").voicing(), NOT note(...).voicing().`,
    );
  }

  // 2. chord symbols must be in the default voicing dictionary.
  const seen = new Set<string>();
  for (const s of chordStrings(code)) {
    for (const tok of tokens(s)) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const q = chordQuality(tok);
      if (q === null) continue;
      if (!CHORD_QUALITIES.has(q)) {
        errors.push(
          `chord "${tok}" — "${q}" isn't a recognised chord symbol; it voices to a single note (silent-ish). Use Strudel spellings: ^7 / M7 (major7), m7 (minor7), 7, 7sus, 6, 9, 13, m7b5, o7, dim→o7, aug → NOT maj7 / min7 / 7sus4 / sus2 / dim7.`,
        );
      }
    }
  }

  // 3. harmonic drift — chord()/note()/n() <...> progressions of mismatched
  //    length phase against one another.
  const lens: number[] = [];
  const seqRe = /\b(?:chord|note|n)\s*\(\s*(['"`])([^'"`]*<[^'"`]*>[^'"`]*)\1/g;
  let mm: RegExpExecArray | null;
  while ((mm = seqRe.exec(code))) {
    const ang = mm[2].match(/<([^>]*)>/);
    if (ang) {
      const n = ang[1].trim().split(/\s+/).filter(Boolean).length;
      if (n > 1) lens.push(n);
    }
  }
  const distinct = [...new Set(lens)].sort((a, b) => a - b);
  const drift = distinct.some((a) =>
    distinct.some((b) => a !== b && a % b !== 0 && b % a !== 0),
  );
  if (drift) {
    warnings.push(
      `harmonic layers may DRIFT out of sync — progressions of different lengths (${distinct.join(", ")} steps) phase against each other, so one layer plays a different chord than another at the same moment. Put every harmonic layer (chords, bass, melody) on the SAME number of changes per cycle, ideally the same progression.`,
    );
  }

  return { errors, warnings };
}
