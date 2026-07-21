// The krill PEG parser is generated JS with no type declarations.
// @ts-expect-error — no types shipped for this deep import
import * as krill from "@strudel/mini/krill-parser.js";

/**
 * Mini-notation validity — the "valid JavaScript, invalid in the browser" class.
 * A string like `.struct("<x ~ | x*16>")` is a fine JS string (acorn passes it),
 * but at play time Strudel parses the CONTENTS with its own mini parser, which
 * throws (e.g. "|" used as a bar separator inside <...> — mini has no bar lines;
 * "|" is only random-choice inside [a | b]).
 *
 * We run Strudel's ACTUAL mini grammar (the krill PEG parser — pure JS, no audio,
 * no @strudel/core) over every mini string, exactly as the engine does
 * (`krill.parse('"<...>"')`). If it throws, that loop would error in the browser,
 * so it's a HARD failure → the loop regenerates.
 */

const parse = (krill as { parse: (s: string) => unknown }).parse;

// String args to functions that ALWAYS take mini-notation.
const MINI_FN_RE =
  /\b(?:s|sound|note|n|struct|mask|euclid|euclidLegato|euclidRot)\s*\(\s*(['"`])([^'"`]*)\1/g;
// Any quoted string (we only parse the ones that LOOK like a real pattern).
const ANY_STR_RE = /(['"`])([^'"`]*)\1/g;
const HAS_MINI_STRUCT = /[<[{|]/;

function miniError(str: string): string | null {
  try {
    parse(JSON.stringify(str)); // engine wraps the mini string in quotes
    return null;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return m.split("\n")[0].slice(0, 160);
  }
}

export function checkMini(code: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  const consider = (str: string, force: boolean) => {
    if (!str || seen.has(str)) return;
    // Only parse strings that are clearly mini: a known mini-fn arg (force) or
    // one containing mini structural chars. Plain words/numbers/names are skipped.
    if (!force && !HAS_MINI_STRUCT.test(str)) return;
    seen.add(str);
    const err = miniError(str);
    if (err) {
      const shown = str.length > 60 ? `${str.slice(0, 60)}…` : str;
      errors.push(
        `mini-notation "${shown}" won't parse in Strudel: ${err}. Note: mini has NO bar lines — never use "|" as a bar separator; sequence bars with <[…] […] …>. "|" is only random-choice inside [a | b].`,
      );
    }
  };

  const fnRe = new RegExp(MINI_FN_RE.source, "g");
  while ((m = fnRe.exec(code))) consider(m[2], true);
  const anyRe = new RegExp(ANY_STR_RE.source, "g");
  while ((m = anyRe.exec(code))) consider(m[2], false);

  return errors;
}
