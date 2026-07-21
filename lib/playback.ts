/**
 * Manual, deterministic playback transforms — NO AI. Applied to a loop's
 * Strudel code at play/export time (the stored code is never mutated):
 *
 *  - transpose: shift the music by N semitones with `all(x => x.add(note(N)))`,
 *    which adds N to every layer's note NUMERICALLY. That transposes plain notes
 *    AND voiced chords alike — unlike `.transpose()`, whose tonal note-NAME parser
 *    silently skips chord-voicing haps (leaving the chords out of tune vs the rest,
 *    plus a "[tonal] transpose: not a note" warning). It also nudges drum pitch a
 *    touch, which reads as transposing the whole track.
 *  - tempo: re-`setcpm()` overrides whatever tempo the loop baked in. The last
 *    setcpm wins, so appending ours takes effect.
 *
 * Both are appended (never edited inline) so the transform is reversible and
 * can't corrupt the source. If a transform line fails to evaluate, the
 * whole-song sequencer try/catches per section (→ that section is skipped).
 */

import { assignReverbOrbits } from "./reverb-orbits";
import { sanitizeDuckTargets } from "./reverb-orbits";

export interface PlaybackSettings {
  transpose?: number;
  bpm?: number;
  /** e.g. "4/4", "3/4", "7/8". The numerator = beats per bar; we map 1 CYCLE = 1
   *  BAR via setcpm(bpm / beats). Defaults to 4/4. */
  timeSignature?: string | null;
  /** Song-wide SOUND dials (see MixSound) — the mix-bus performance layer. */
  sound?: MixSound | null;
  /** This section is a one-bar BREAK. Pins a short roomsize on its reverbed layers so they
   *  can't inherit a long per-orbit reverb tail from an earlier section (see
   *  sanitizeBreakReverb). Loops never set this — their tails carry across joins by design. */
  isBreak?: boolean;
}

/** Song-wide SOUND dials — a PERFORMANCE layer applied at play time to every
 *  loop AND break identically. The stored code is never touched, so solo and
 *  mix can never drift apart and nothing is ever regenerated; at the default
 *  values NO transform is appended at all (bit-identical playback). */
export interface MixSound {
  /** Master low-pass cutoff (Hz). 12000 = wide open (off). */
  brightness?: number;
  /** Master high-pass cutoff (Hz) — the OTHER half of a DJ filter (bass cut).
   *  0/absent = off. Used by the live set deck; the song page never sets it. */
  edge?: number;
  /** Master delay send (0..1) — the dub echo throw. 0/absent = off. */
  echo?: number;
  /** Master drive/saturation. 0 = off. */
  punch?: number;
  /** Master reverb amount layered over everything. 0 = off. */
  space?: number;
}
export const MIX_SOUND_DEFAULTS = { brightness: 12000, punch: 0, space: 0 };

function applyMixSound(code: string, sound?: MixSound | null): string {
  if (!sound) return code;
  const lines: string[] = [];
  const b = Number(sound.brightness);
  if (Number.isFinite(b) && b > 0 && b < MIX_SOUND_DEFAULTS.brightness) {
    lines.push(`all(x => x.lpf(${Math.round(b)}))`);
  }
  const e = Number(sound.edge);
  if (Number.isFinite(e) && e > 0) {
    lines.push(`all(x => x.hpf(${Math.round(e)}))`);
  }
  const d = Number(sound.echo);
  if (Number.isFinite(d) && d > 0) {
    lines.push(`all(x => x.delay(${Math.min(0.8, d).toFixed(2)}))`);
  }
  const p = Number(sound.punch);
  if (Number.isFinite(p) && p > 0) {
    lines.push(`all(x => x.shape(${Math.min(0.6, p).toFixed(2)}))`);
  }
  const s = Number(sound.space);
  if (Number.isFinite(s) && s > 0) {
    lines.push(`all(x => x.room(${Math.min(0.8, s).toFixed(2)}))`);
  }
  return lines.length ? `${code}\n${lines.join("\n")}` : code;
}

/** Beats per bar from a time-signature string ("7/8" → 7). Defaults to 4 (4/4),
 *  so every existing 4/4 loop behaves exactly as before. */
export function beatsPerBar(timeSignature?: string | null): number {
  const n = Number(String(timeSignature ?? "").split("/")[0]);
  return Number.isFinite(n) && n >= 1 && n <= 16 ? Math.round(n) : 4;
}

/** Where to append to a layer's chain: just after its last `)`, skipping any
 *  trailing blank/comment lines (so we never write inside a comment). */
function layerAppendPos(layer: string): number {
  const lines = layer.split("\n");
  while (
    lines.length &&
    (/^\s*$/.test(lines[lines.length - 1]) ||
      /^\s*\/\//.test(lines[lines.length - 1]))
  )
    lines.pop();
  const codeOnly = lines.join("\n");
  const lp = codeOnly.lastIndexOf(")");
  return lp >= 0 ? lp + 1 : codeOnly.replace(/\s+$/, "").length;
}

/** Append `.add(note(semis))` to every PITCHED `$:` layer — notes, chords,
 *  scale-degree melodies — and leave un-pitched layers (drums, textures) alone,
 *  so a transpose never detunes the drum samples. A layer is pitched when it
 *  carries note()/chord()/freq(), or n() WITH .scale() (n() without a scale is a
 *  sample-variant picker — adding to it would swap samples, not pitch). */
function transposePitched(code: string, semis: number): string {
  // Only touch the MUSIC: stop before the embedded comment blocks (@vcontrols /
  // @hydra) so the insert can never land inside the visual code.
  const ends = [code.indexOf("/* @vcontrols"), code.indexOf("/* @hydra")]
    .filter((i) => i >= 0);
  const musicEnd = ends.length ? Math.min(...ends) : code.length;
  const starts: number[] = [];
  for (const m of code.slice(0, musicEnd).matchAll(/\$:/g))
    starts.push(m.index ?? 0);
  if (starts.length === 0) return code; // no layers found — nothing to transpose
  let out = code;
  // Insert back-to-front so earlier indices stay valid.
  for (let li = starts.length - 1; li >= 0; li--) {
    const start = starts[li];
    const end = li + 1 < starts.length ? starts[li + 1] : musicEnd;
    const layer = code.slice(start, end);
    const pitched =
      /\b(?:note|chord|freq)\s*\(/.test(layer) ||
      (/\bn\s*\(/.test(layer) && /\.scale\s*\(/.test(layer));
    if (!pitched) continue;
    const pos = start + layerAppendPos(layer);
    out = `${out.slice(0, pos)}.add(note(${semis}))${out.slice(pos)}`;
  }
  return out;
}

// Web Audio params have HARD ranges (verified against strudel.cc/learn/effects): a
// value outside them is clamped by the browser WITH a console warning (e.g. pan
// −1.9) and can sound wrong. Notably Strudel pan is 0–1 (0 left · 0.5 centre · 1
// right) — a model using the centered −1..1 convention maps past −1. We clamp the
// clearly-bounded params (scalar args AND .range(a,b) sweep bounds) at PLAY time, so
// even already-saved loops stop warning without a regenerate. NOT clamped: speed
// (negative = reverse), attack/decay/release/delaytime (seconds, unbounded), shape.
const PARAM_RANGE: Record<string, [number, number]> = {
  pan: [0, 1],
  room: [0, 1],
  size: [0, 10],
  roomsize: [0, 10],
  delay: [0, 1],
  delayfeedback: [0, 0.95],
  sustain: [0, 1],
  gain: [0, 2],
  velocity: [0, 1],
  resonance: [0, 50],
  lpq: [0, 50],
  hpq: [0, 50],
  crush: [1, 16],
  coarse: [1, 100],
  cutoff: [0, 20000],
  lpf: [0, 20000],
  hpf: [0, 20000],
  hcutoff: [0, 20000],
  bpf: [0, 20000],
};

/** Wrap the bare literal operand of a TOP-LEVEL `.add(...)` in note(). A control
 *  pattern's `.add("12")` / `.add(7)` warns "Can't do arithmetic on control pattern" and
 *  drops the transpose; `.add(note(…))` adds to the note field and transposes for real.
 *  Depth-aware so a NESTED signal add (e.g. `sine.range(0,12).add(3)`, valid value
 *  arithmetic) is left alone, and non-literal operands (`.add(note(…))`, `.add(sine…)`)
 *  are skipped. */
function wrapControlAdd(code: string): string {
  let out = "";
  let depth = 0;
  let i = 0;
  const n = code.length;
  while (i < n) {
    if (depth === 0 && code.startsWith(".add(", i)) {
      let j = i + 5;
      let d = 1;
      const start = j;
      for (; j < n && d > 0; j++) {
        if (code[j] === "(") d++;
        else if (code[j] === ")") {
          d--;
          if (d === 0) break;
        }
      }
      const arg = code.slice(start, j);
      if (/^\s*("[^"]*"|'[^']*'|`[^`]*`|-?\d+(?:\.\d+)?)\s*$/.test(arg)) {
        out += `.add(note(${arg.trim()}))`;
        i = j + 1;
        continue;
      }
    }
    const ch = code[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    out += ch;
    i++;
  }
  return out;
}

/** Normalise the chord symbols inside a chord("…") body so .voicing() recognises them.
 *  The voicing dictionary is iReal/jazz notation (M7/^7, m7/-7, o, sus, 2); Opus writes
 *  STANDARD notation (maj7, min7, dim, sus2), which the dict doesn't know → "[voicing]:
 *  unknown chord" and a silent (near-dead) harmony. Capitalise roots + map the common
 *  standard qualities to the dict's set (maj→M, min→m, dim→o, sus4→sus, sus2→2). */
function normalizeChordBody(body: string): string {
  let b = body.replace(
    /(^|[\s<>\[,])([a-g])/g,
    (_x, pre: string, l: string) => pre + l.toUpperCase(),
  );
  const qmap: [RegExp, string][] = [
    [/maj/g, "M"],
    [/min/g, "m"],
    [/dim/g, "o"],
    [/sus4/g, "sus"],
    [/sus2/g, "2"],
    [/°/g, "o"],
    [/ø/g, "h"],
    [/Δ/g, "M"],
  ];
  for (const [re, to] of qmap) b = b.replace(re, to);
  return b;
}

/** Drum sample names in the tidal banks are ABBREVIATIONS (bd sd hh oh cp cr rd rim lt
 *  mt ht cb sh tb perc). The model sometimes writes the full word ("ride"/"snare"/"clap"),
 *  which no bank has → "[getTrigger] error: sound RolandTR909_ride not found". Map the
 *  common full words back to their token; real abbreviations (not keys) pass through. */
const DRUM_WORD: Record<string, string> = {
  ride: "rd", crash: "cr", snare: "sd", kick: "bd", clap: "cp",
  openhat: "oh", ohat: "oh", openhh: "oh", closedhat: "hh", closehat: "hh",
  closedhh: "hh", hihat: "hh", hat: "hh", rimshot: "rim", cowbell: "cb",
  shaker: "sh", tom: "mt", lowtom: "lt", midtom: "mt", hightom: "ht",
};
function normalizeDrumBody(body: string): string {
  return body.replace(/[a-z]+/g, (w) => DRUM_WORD[w] ?? w);
}

export function clampAudioParams(code: string): string {
  // Strip Strudel REPL VISUALISATION calls (punchcard/pianoroll/scope/spectrum/draw) —
  // they render to a canvas that doesn't exist in our headless AUDIO eval, so one the
  // model emits (it's idiomatic in Strudel examples) throws "._punchcard is not a
  // function" and kills the whole loop. Runs at BOTH play (transformForPlayback) and
  // generation (autoFixRender): existing songs are fixed on play, new ones never store it.
  let s = code.replace(
    /\.\s*_?(punchcard|pianoroll|scope|spectrum|draw|drawLine|claviature)\s*\((?:[^()]|\([^()]*\))*\)/g,
    "",
  );
  // FATAL: a hallucinated BARE method (no parens) like ".sidechain" evaluates to
  // undefined, then the $: transpiler appends ".p('$')" → "Cannot read properties of
  // undefined (reading 'p')" which kills the WHOLE loop. Strip any ".word" that follows
  // a ")" and is NOT itself a call — valid Strudel always CALLS its methods, so a bare
  // trailing property is always a mistake. EXCEPT a ".word." that chains into a call:
  // Strudel's arithmetic-with-structure idiom is `.mul.mix(x)` / `.add.in(x)` etc., where
  // `.mul`/`.add` are bare props and the CALL is on `.mix`/`.in`/… — so the lookahead also
  // rejects a following "." (don't strip a prop that leads into another method). Without
  // this, `range(lo,hi).mul.mix("…")` lost its `.mul` → invalid `.mix("…")`, silently
  // breaking every sidechain/LFO gain envelope (a real prod bug, 2026-06-25).
  s = s.replace(/(\))\s*\.[a-zA-Z_]\w*(?![\w(.]|\s*\()/g, "$1");
  // Sidechain ducking is WIRED at merge time now (wireSidechain: sustained tonal
  // layers get their own orbits, the duck arg names exactly those) — a grounded
  // duck passes through and PUMPS. Legacy code from before the wiring still
  // carries misuse (.duck(amount), phantom orbits): keep only ducks whose
  // integer targets all exist, drop the rest (orphan duckdepth/attack are inert).
  s = sanitizeDuckTargets(s);
  s = s.replace(/\.duck(?:orbit)?\(\s*(?!"?\d[\d\s:]*"?\s*\))(?:[^()]|\([^()]*\))*\)/g, "");
  // A gain "pump" / filter LFO needs a SIGNAL source — sine.range(lo,hi).slow(n). The
  // model sometimes drops the oscillator and writes a BARE slow(n).range(lo,hi) /
  // fast(n).range(…); slow(n) on its own is a curried fn with NO .range → fatal
  // "slow(...).range is not a function" that kills the WHOLE loop (and the layer path
  // has no gate to catch it). Re-add the missing signal as `sine` and put .range BEFORE
  // .slow/.fast (the canonical order). The (^|[^.\w]) boundary leaves a CORRECT
  // signal.range(…).slow(n) / sine.slow(n).range(…) untouched. Runs play+gen → existing
  // songs heal on play, new ones never store it.
  s = s.replace(
    /(^|[^.\w])(slow|fast)\(([^()]*)\)\.range\(([^()]*)\)/g,
    "$1sine.range($4).$2($3)",
  );
  // Drum sample patterns: map full-word names ("ride"/"snare"/"clap") in s("…")/sound("…")
  // to their bank tokens (rd/sd/cp) so they actually load ("RolandTR909_ride not found").
  s = s.replace(
    /\b(s|sound)\(\s*(["'`])([^"'`]*)\2/g,
    (_m, fn: string, q: string, body: string) =>
      `${fn}(${q}${normalizeDrumBody(body)}${q}`,
  );
  // Named chords belong in chord("…").voicing(); the model sometimes puts them in
  // note() ("not a note: em7"), which never voices. Rewrite note(X).chord()/.voicing()
  // → chord(X)[.voicing()] and capitalise the chord roots so they actually sound.
  s = s.replace(/\bnote\((\s*["'`][^"'`]*["'`]\s*)\)\.chord\(\)/g, "chord($1)");
  s = s.replace(/\bnote\((\s*["'`][^"'`]*["'`]\s*)\)(\.voicing\()/g, "chord($1)$2");
  s = s.replace(
    /\bchord\(\s*(["'`])([^"'`]*)\1/g,
    (_m, q: string, body: string) => `chord(${q}${normalizeChordBody(body)}${q}`,
  );
  // `.voicing()` ONLY voices a chord("…") FIELD. The model sometimes builds a chord by
  // interval-stacking — note("<d3 …>").add(note("0,7,12")) — and then ALSO appends
  // `.voicing()`; with no chord field that reads undefined → "[voicing]: unknown chord
  // undefined" + dead harmony. Per LINE: if it has no chord(…), the notes are already set
  // by note()/add — strip the spurious .voicing() (it voices nothing).
  // Also strip a spurious `.bank(...)` on a MELODIC layer: .bank() PREFIXES the sound
  // (`note(...).bank("RolandTR909").s("sawtooth")` → "RolandTR909_sawtooth not found",
  // the layer plays SILENT). .bank() is ONLY for drum sample patterns (s("bd hh")) — a
  // pitched note()/n() layer or a waveform/gm_/wt_ sound must not carry it.
  s = s
    .split("\n")
    .map((ln) => {
      if (!/\bchord\(/.test(ln))
        ln = ln.replace(/\.voicing\((?:[^()]|\([^()]*\))*\)/g, "");
      const melodic =
        /\bnote\(|\bn\(/.test(ln) ||
        /\b(?:s|sound)\(\s*["'`](?:sawtooth|saw|square|sqr|sine|triangle|tri|pulse|supersaw|isaw|white|pink|brown|crackle|gm_|wt_)/.test(
          ln,
        );
      if (melodic) ln = ln.replace(/\.bank\((?:[^()]|\([^()]*\))*\)/g, "");
      return ln;
    })
    .join("\n");
  // Transposition: a TOP-LEVEL `.add("…")` / `.add(N)` on a control pattern logs "Can't
  // do arithmetic on control pattern" — the bare operand becomes {value} with no matching
  // field, so the transpose is silently dropped. Wrap that bare operand in note() so it's
  // a note-field add that actually transposes. Depth-aware: only the layer's own .add,
  // never a nested signal add like sine.range(0,12).add(3); leaves .add(note(…)) alone.
  s = wrapControlAdd(s);
  for (const [param, [lo, hi]] of Object.entries(PARAM_RANGE)) {
    const fix = (n: string) => String(Math.max(lo, Math.min(hi, parseFloat(n))));
    // scalar: .param(NUM)
    s = s.replace(
      new RegExp(`(\\.${param}\\(\\s*)(-?\\d*\\.?\\d+)(\\s*\\))`, "g"),
      (_m, a: string, num: string, c: string) => `${a}${fix(num)}${c}`,
    );
    // sweep bounds: .param( <expr>.range(A, B) ) — one level of nested parens
    // (e.g. sine.slow(8).range(-0.5, 0.5)).
    s = s.replace(
      new RegExp(
        `(\\.${param}\\((?:[^()]|\\([^()]*\\))*\\.range\\(\\s*)(-?\\d*\\.?\\d+)(\\s*,\\s*)(-?\\d*\\.?\\d+)(\\s*\\))`,
        "g",
      ),
      (_m, a: string, n1: string, mid: string, n2: string, c: string) =>
        `${a}${fix(n1)}${mid}${fix(n2)}${c}`,
    );
  }
  return s;
}

/** The valid [min,max] for a bounded audio param (or undefined if unbounded) — used
 *  to keep generated tweak-knob ranges inside the real range too. */
export function paramRange(param: string): [number, number] | undefined {
  return PARAM_RANGE[param];
}

/** Break-only reverb guard. superdough caches ONE reverb node PER ORBIT and only rebuilds it
 *  when roomsize CHANGES — so a layer that sends to reverb (`.room(...)`) but never sets its own
 *  `.roomsize()` reuses whatever decay the PREVIOUS section left on that orbit (e.g. an intro
 *  pad's `roomsize(4)` → a ~6s tail) and that wash rings into the next loop. The break can't
 *  know what played before it, so for every reverbed break layer we PIN a short roomsize
 *  (and clamp any explicit one ≤1). Per-`$:`-layer, bare-number args only, idempotent — and
 *  applied ONLY to break code (loops keep their long, intentional tails). It does NOT touch
 *  envelopes/character; that's the generation prompt's job. */
export function sanitizeBreakReverb(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      if (!/^\s*\$:/.test(line)) return line;
      let s = line.replace(
        /\.(roomsize|rsize|size)\(\s*(\d*\.?\d+)\s*\)/g,
        (m, k: string, n: string) => (parseFloat(n) > 1 ? `.${k}(1)` : m),
      );
      // `.room(` sends to the orbit reverb; `.roomsize(`/`.rsize(`/`.size(` set its decay.
      // (`\.room\(` can't match `.roomsize(` — after "room" comes "s", not "(".)
      if (/\.room\(/.test(s) && !/\.(roomsize|rsize|size)\(/.test(s)) {
        s = `${s.replace(/\s+$/, "")}.roomsize(0.5)`;
      }
      return s;
    })
    .join("\n");
}

export function transformForPlayback(
  code: string,
  { transpose = 0, bpm, timeSignature, sound, isBreak }: PlaybackSettings = {},
): string {
  let out = isBreak ? sanitizeBreakReverb(code) : code;
  // CRACKLE GUARD AT THE LAST GATE (2026-07-14): layers with different reverb
  // signatures must not share an orbit — superdough regenerates a shared
  // reverb mid-ring on every size alternation (an audible click per event
  // seam, worst under a sustained voice). Composition writes orbits too, but
  // this catches every song already born without them. No-op when the code
  // manages its own orbits.
  out = assignReverbOrbits(out);
  if (transpose && transpose !== 0) {
    // Per-layer .add(note(N)) on PITCHED layers only — transposes notes AND
    // voiced chords (numeric add; tonal's .transpose() skips voicing haps),
    // while drums/textures keep their original sample pitch.
    out = transposePitched(out, Math.round(transpose));
  }
  if (typeof bpm === "number" && bpm > 0) {
    // ONE tempo line per program: stored loop code can carry its own baked
    // setcpm — strip it so the appended line is the only source of truth.
    // evaluate() always honoured the LAST line, but the arrangement builder
    // must never see two answers.
    out = out.replace(/^\s*setcpm\([^)]*\)\s*$/gm, "");
    // 1 cycle = 1 bar = `beats` beats → setcpm(bpm / beats). beats = 4 for 4/4.
    out += `\nsetcpm(${bpm}/${beatsPerBar(timeSignature)})`;
  }
  // Mix-bus dials, then CLAMP every audio param into its valid range (last, so it
  // catches values from the mix dials too) — no out-of-range warnings at play.
  return clampAudioParams(applyMixSound(out, sound));
}

/** Seconds one bar lasts at a given tempo, honouring the time signature
 *  (beats-per-bar × 60 / bpm). Defaults to 4 beats. */
export function barSeconds(bpm: number, timeSignature?: string | null): number {
  return (beatsPerBar(timeSignature) * 60) / (bpm > 0 ? bpm : 120);
}
