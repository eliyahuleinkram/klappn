/**
 * Misc USAGE validity — deterministic "parses fine but is silent or breaks at
 * play time" traps not covered by the other gates (arg-check, mini-check,
 * chord-check, audibility, sound-palette). All HARD errors: provable, not fuzzy.
 *
 *  1. DEGENERATE TIME FACTORS — .fast(0)/.slow(0)/.ply(0)/.chop(0)/.striate(0)/
 *     .segment(0). A factor of 0 divides the cycle by zero (NaN/Infinity timing)
 *     or yields zero events: the layer goes silent or destabilises the scheduler.
 *
 *  2. CHORD SYMBOL INSIDE note() — note("Cm7"/"Dmaj7"/"F^7"/"Gsus"). note() parses
 *     NOTE names (c, e, g, c4…); a chord-quality token is not a note, so it's NaN
 *     → silent. The fix is chord("<…>").voicing(). (We only flag UNAMBIGUOUS
 *     qualities — maj/min/dim/aug/sus/add/^ and m before a digit — never bare
 *     "C7"/"D9", which are valid notes: C in octave 7, D in octave 9.)
 */

export interface UsageIssues {
  errors: string[];
  warnings: string[];
}

const ZERO_TIME_RE =
  /\.(fast|slow|ply|chop|striate|segment)\s*\(\s*0+(?:\.0+)?\s*\)/g;

// note("…") / n("…") string arguments.
const NOTE_ARG_RE = /\bnote\s*\(\s*(['"`])([^'"`]+)\1/g;

// A token that is clearly a CHORD quality, not a note name. Root + an
// unambiguous quality marker (maj/min/dim/aug/sus/add/^, or m followed by a
// digit/b like m7, m7b5). Deliberately excludes C7/D9 etc. (valid note+octave).
const CHORD_IN_NOTE_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|\^|m(?=[0-9b]))/;

function tokens(s: string): string[] {
  return s
    .replace(/[[\]<>{}(),]/g, " ")
    .replace(/[*/!@%][0-9.]+/g, "")
    .replace(/\?[0-9.]*/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

export function checkUsage(code: string): UsageIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const m of code.matchAll(ZERO_TIME_RE)) {
    const key = `t:${m[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(
      `.${m[1]}(0) is degenerate — a factor of 0 divides the cycle by zero (silent / breaks timing). Use a positive number, e.g. .${m[1]}(2).`,
    );
  }

  for (const m of code.matchAll(NOTE_ARG_RE)) {
    for (const tok of tokens(m[2])) {
      if (!CHORD_IN_NOTE_RE.test(tok)) continue;
      if (seen.has(`n:${tok}`)) continue;
      seen.add(`n:${tok}`);
      errors.push(
        `note("${tok}") — "${tok}" is a CHORD symbol, but note() only parses note names (c e g, c4…), so it falls silent. Use chord("<${tok} …>").voicing() for chords, or write plain note names.`,
      );
    }
  }

  return { errors, warnings };
}
