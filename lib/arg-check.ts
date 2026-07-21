/**
 * Argument-TYPE validity — the "parses fine, valid mini-notation, but the values
 * are the wrong KIND, so it makes no sound" class.
 *
 * The mini grammar (lib/mini-check.ts) happily parses `arp("up down")` — "up"
 * and "down" are perfectly valid pattern leaves. But `arp` does NOT take mode
 * words: in @strudel/core it is
 *
 *     arp: (t, e) => e.arpWith((n) => reify(t).fmap((s) => n[s % n.length]))
 *
 * i.e. each leaf `s` is used as a NUMERIC INDEX into the chord's stacked notes
 * (`n[s % n.length]`). A word becomes `n["up" % len]` = `n[NaN]` = `undefined`,
 * so the arpeggio is silent — it compiles, parses, and makes no sound. That's
 * exactly the bug class we want caught deterministically, before play time.
 *
 * The same trap applies to the numeric control methods (gain, lpf, pan, speed…):
 * a STRING pattern there must be numbers, never words — a word is NaN at play
 * time. (Number-literal args like `.gain(0.8)` and signals like `.lpf(sine…)`
 * are always fine, and skipped — we only inspect STRING arguments.)
 *
 * Methods that legitimately take NAMES — s/sound, note, n, chord, scale, bank —
 * are deliberately NOT here.
 */

// Methods whose string/pattern argument must be NUMERIC (indices or values).
const NUMERIC_METHODS = [
  "arp",
  "gain",
  "velocity",
  "vel",
  "amp",
  "postgain",
  "pan",
  "speed",
  "accelerate",
  "lpf",
  "cutoff",
  "hpf",
  "lpq",
  "hpq",
  "resonance",
  "room",
  "size",
  "orbit",
  "delay",
  "delaytime",
  "delayfeedback",
  "shape",
  "distort",
  "crush",
  "coarse",
  "attack",
  "decay",
  "sustain",
  "release",
  "hold",
  "begin",
  "end",
  "legato",
  "clip",
];

// .method('  …string…  ') — capture the method name and the raw string contents.
const NUMERIC_ARG_RE = new RegExp(
  `\\.(${NUMERIC_METHODS.join("|")})\\s*\\(\\s*(['"\`])([^'"\`]*)\\2`,
  "g",
);

export interface ArgCheckResult {
  errors: string[]; // hard — provably NaN / silent at play time
  warnings: string[];
}

/**
 * A numeric-pattern string may only contain numbers and mini-notation structure.
 * Any ASCII letter means a word slipped into a numeric slot (e.g. arp("up down"),
 * gain("loud")) → NaN at play time. We don't tokenise — in a numeric pattern there
 * should be NO letters at all, so a single letter is enough to fail.
 */
/**
 * Arithmetic (.add/.sub/.mul/.div) applied to a NOTE/CHORD (control) pattern with
 * a BARE number/string argument throws "Can't do arithmetic on control pattern"
 * at play time, and the operation is silently dropped (e.g. a transpose that never
 * happens). The fix is to WRAP the argument so it targets the note field:
 *   note("c2").add("<0 -4>")        ✗  control + number → error
 *   note("c2").add(note("<0 -4>"))  ✓  note + note → transposes
 * We only flag layers that START with a control constructor (note/chord/n) and
 * whose arithmetic arg is a literal (quote / number / < / [ / ~), never a wrapped
 * note(...)/n(...) (those start with a letter, so they don't match).
 */
const ARITH_BARE_RE = /\.(add|sub|mul|div)\s*\(\s*(?:['"`<[~]|-?\d)/g;

function checkControlArithmetic(code: string): string[] {
  const errors: string[] = [];
  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (!starts.length) return errors;
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i + 1 < starts.length ? starts[i + 1] : code.length;
    const layer = code.slice(s, e);
    if (!/^\$:\s*(?:note|chord|n)\s*\(/.test(layer)) continue; // not a control source
    for (const m of layer.matchAll(ARITH_BARE_RE)) {
      const method = m[1];
      if (seen.has(method)) continue;
      seen.add(method);
      errors.push(
        `.${method}(...) is applied to a note/chord (control) pattern with a bare number/string — this throws "Can't do arithmetic on control pattern" and the change is silently dropped. WRAP the argument so it targets the note field: .${method}(note("…")) (or n("…")). e.g. note("c2").add(note("<0 -4 -2>")) to transpose.`,
      );
    }
  }
  return errors;
}

export function checkArgs(code: string): ArgCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  errors.push(...checkControlArithmetic(code));

  for (const m of code.matchAll(NUMERIC_ARG_RE)) {
    const method = m[1];
    const arg = m[3];
    const key = `${method}:${arg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!/[a-zA-Z]/.test(arg)) continue; // pure numeric pattern — fine

    const shown = arg.length > 50 ? `${arg.slice(0, 50)}…` : arg;
    if (method === "arp") {
      errors.push(
        `arp("${shown}") is invalid — arp() takes NOTE INDICES (numbers) into the chord's stacked notes, e.g. .arp("0 [0,2] 1 2") or .arp("0 2 1 3"), NOT mode words like "up"/"down"/"updown". A word becomes a NaN index, so the arpeggio is completely silent.`,
      );
    } else {
      errors.push(
        `.${method}("${shown}") must be a NUMERIC pattern (numbers only, e.g. "0.5 0.8" or "<200 2000>"), not words — a non-number becomes NaN at play time. Use numbers, or an unquoted signal like sine/saw/perlin.`,
      );
    }
  }

  return { errors, warnings };
}
