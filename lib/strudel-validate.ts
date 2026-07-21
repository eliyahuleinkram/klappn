import { parse } from "acorn";
import { analyzeAudibility } from "./audibility";
import { beatsPerBar } from "./playback";
import {
  GM_SOUNDS,
  PALETTE_BANKS,
  PALETTE_SOUNDS,
  WT_SOUNDS,
} from "./sound-palette";
import { GM_RANGES } from "./gm-ranges";
import { checkChords } from "./chord-check";
import { checkMini } from "./mini-check";
import { checkArgs } from "./arg-check";
import { checkUsage } from "./usage-check";

/**
 * Server-side, dependency-light Strudel validator — the "does it actually run,
 * and will it be heard?" gate in the generation loop (lib/jobs.ts). The real
 * Strudel engine needs a browser/AudioContext, so we can't render audio in the
 * Workflow; but Strudel code is (almost) valid JS — `$:` lines are labeled
 * statements, mini strings are just strings — so `acorn` catches syntax errors
 * and a static scan catches tempo drift, unloaded sounds, and silent layers.
 *
 * HARD vs SOFT — the single rule the refine loop relies on, applied consistently
 * here, in strudel-eval.ts, and in audibility.ts:
 *
 *  - errors[]  = HARD: the check is CERTAIN the draft is broken. It won't parse
 *    or build, sections would drift (wrong/missing tempo), or it is PROVABLY
 *    silent by a deterministic rule (a sound/bank NOT in the EXACT loaded palette
 *    snapshot loads nothing; a ZzFX `z_` sound isn't loaded; the lefthand/
 *    guidetones voicing dict on a bare triad voices to nothing). The loop ALWAYS
 *    regenerates on a hard issue — such a draft is never shipped (it can't even
 *    become the "best" candidate, which only holds clean-running code).
 *
 *  - warnings[] = SOFT: the check is UNCERTAIN — a heuristic we can't prove without
 *    rendering audio. A layer that MIGHT be inaudible (reversed / near-silent /
 *    over-filtered), a mix that LOOKS flat. These never block shipping a
 *    high-scoring draft; they're fed into the refine feedback AND backstopped by
 *    the critic jury, which scores blend + audibility independently.
 *
 * The guiding line: only HARD-FAIL what we can prove; when unsure, WARN and let
 * the critic (and the score bar) decide. The loop never grinds on a false alarm,
 * and never ships something we KNOW is broken.
 */

// The loaded sound set + bank names live in lib/sound-palette.ts (an exact
// snapshot of what lib/strudel-client.ts loads). A sound that isn't loaded loads
// NOTHING — it is provably silent — so it's a HARD error, not a guess. gm_* and
// wt_* are checked against the EXACT registered instrument/wavetable names (we
// used to blanket-trust those prefixes, which let hallucinations like
// "gm_pad_2_warm" through → silent + "sound not found" at play).
function classify(name: string): "ok" | "z" | "unknown" {
  if (/^z_/.test(name) || name === "zzfx") return "z";
  if (/^gm_/.test(name)) return GM_SOUNDS.has(name) ? "ok" : "unknown";
  if (/^wt_/.test(name)) return WT_SOUNDS.has(name) ? "ok" : "unknown";
  return PALETTE_SOUNDS.has(name) ? "ok" : "unknown";
}

// Strip mini-notation modifiers to bare sound names.
function miniTokens(s: string): string[] {
  return s
    .replace(/[[\]<>{}(),~]/g, " ")
    .replace(/[*/:!@%][0-9.]+/g, "")
    .replace(/\?[0-9.]*/g, "")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((t) => t && t !== "x" && !/^[0-9.]+$/.test(t));
}

const NOTE_BASE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function noteToMidi(tok: string): number | null {
  if (/^-?\d+$/.test(tok)) return Number(tok); // numeric note() tokens ARE midi numbers
  const m = tok.toLowerCase().match(/^([a-g])([#b]?)(-?\d)$/);
  if (!m) return null; // no explicit octave / not a note name → don't guess
  return (Number(m[3]) + 1) * 12 + NOTE_BASE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

function midiToName(p: number): string {
  const names = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  return `${names[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`;
}

/** Per layer: every explicit note() pitch must sit inside its gm_ sound's font zones. */
function gmRangeErrors(code: string): string[] {
  const out: string[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\$:/.test(line)) continue;
    // A pitch shift after note() makes the sounding pitch uncertain — skip, don't guess.
    if (/\.(transpose|add|sub|scale|arp)\s*\(/.test(line)) continue;
    const sounds = new Set<string>();
    for (const sm of line.matchAll(/\bs(?:ound)?\s*\(\s*(['"`])([^'"`]+)\1/g))
      for (const t of miniTokens(sm[2])) if (/^gm_/.test(t)) sounds.add(t);
    if (sounds.size !== 1) continue; // no gm font, or several (can't attribute notes)
    const sound = [...sounds][0];
    const range = GM_RANGES[sound];
    if (!range) continue;
    const [lo, hi] = range;
    const bad = new Map<string, number>();
    for (const nm of line.matchAll(/\bnote\s*\(\s*(['"`])([^'"`]+)\1/g)) {
      for (const t of miniTokens(nm[2])) {
        const p = noteToMidi(t);
        // findZone (fontloader.mjs) accepts keyRangeLow <= pitch <= keyRangeHigh + 1.
        if (p !== null && (p < lo || p > hi + 1)) bad.set(t, p);
      }
    }
    if (bad.size)
      out.push(
        `layer ${i}: note ${[...bad.keys()].join(", ")} is OUTSIDE ${sound}'s playable range (${midiToName(lo)}..${midiToName(hi + 1)}) — the soundfont has no zone there, so the browser throws "no soundfont zone found for preset" every time it triggers. Keep this layer's notes within ${midiToName(lo)}..${midiToName(hi + 1)}, or move the phrase to an instrument that covers them`,
      );
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[]; // hard — the draft must be regenerated
  warnings: string[]; // soft — fed back to refine, not a hard fail
}

export interface ValidateContext {
  /** The song's bpm — every section must declare this tempo so they align. */
  bpm?: number;
  /** The song's time signature ("4/4", "7/8"); numerator = beats per bar. The
   *  expected clock is bpm/beats cpm (1 cycle = 1 bar). Defaults to 4/4. */
  timeSignature?: string | null;
}

export function validateStrudel(
  code: string,
  ctx?: ValidateContext,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmed = (code || "").trim();
  if (!trimmed) return { ok: false, errors: ["empty output"], warnings };

  // 1. Syntax — Strudel code is essentially JS once you accept `$:` labels.
  try {
    parse(trimmed, { ecmaVersion: 2022, sourceType: "module" });
  } catch (e) {
    errors.push(`syntax error: ${String((e as Error).message)}`);
  }

  // 1b. TEMPO ALIGNMENT — each part is played standalone (and stitched into the
  // song), so it MUST set the song's tempo, or sections drift out of time. The
  // expected clock is bpm/4 cpm (4 beats per bar). setcpm("a/b") → a/b cpm;
  // setcpm(a) → a; setcps(x) → x*60 cpm.
  if (ctx?.bpm) {
    const beats = beatsPerBar(ctx.timeSignature);
    const expectedCpm = ctx.bpm / beats;
    const cpms: number[] = [];
    for (const m of code.matchAll(
      /\bsetcpm\s*\(\s*([0-9.]+)\s*(?:\/\s*([0-9.]+))?\s*\)/g,
    )) {
      cpms.push(Number(m[1]) / (m[2] ? Number(m[2]) : 1));
    }
    for (const m of code.matchAll(/\bsetcps\s*\(\s*([0-9.]+)\s*\)/g)) {
      cpms.push(Number(m[1]) * 60);
    }
    if (cpms.length === 0) {
      errors.push(
        `no tempo set — begin the part with setcpm(${ctx.bpm}/${beats}) so it plays at ${ctx.bpm} BPM (${beats} beats/bar) and locks with the other sections`,
      );
    } else {
      const bad = cpms.filter((c) => Math.abs(c - expectedCpm) > 0.3);
      if (bad.length) {
        errors.push(
          `wrong tempo — every section must run at ${ctx.bpm} BPM in ${beats} beats/bar: use setcpm(${ctx.bpm}/${beats}) (= ${expectedCpm.toFixed(2)} cpm), not ${bad.map((b) => b.toFixed(2)).join("/")} cpm`,
        );
      }
    }
  }

  // 2. Sounds from s("...") / sound("...") — flag silent layers.
  const seen = new Set<string>();
  const soundRe = /\bs(?:ound)?\s*\(\s*(['"`])([^'"`]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = soundRe.exec(code))) {
    for (const t of miniTokens(m[2])) {
      if (seen.has(t)) continue;
      seen.add(t);
      const c = classify(t);
      if (c === "z")
        errors.push(`sound "${t}" is a ZzFX z_ sound — NOT loaded (silent); use a real loaded sound`);
      else if (c === "unknown" && /^gm_/.test(t))
        errors.push(
          `gm_ instrument "${t}" does NOT exist (silent). Use an EXACT GM name — e.g. for pads: gm_pad_warm, gm_pad_new_age, gm_pad_halo, gm_pad_bowed, gm_pad_choir, gm_pad_sweep; pianos: gm_piano, gm_epiano1, gm_epiano2; also gm_acoustic_guitar_nylon, gm_acoustic_bass, gm_string_ensemble_1, gm_choir_aahs, gm_flute, gm_ocarina. No numeric variants like gm_pad_2_warm.`,
        );
      else if (c === "unknown")
        errors.push(
          `sound "${t}" is NOT in the loaded palette — it loads nothing (silent). Use a real sound: a drum (bd sd hh oh cp rim cr rd …), a gm_* instrument (gm_epiano1, gm_acoustic_bass…), piano, a synth (sawtooth square triangle sine supersaw), or a named sample (jazz casio …).`,
        );
    }
  }

  // 2b. GM SOUNDFONT RANGE — a gm_* font only has zones for part of the keyboard
  // (lib/gm-ranges.ts, read from the real font files). A note outside it throws
  // "no soundfont zone found for preset" at EVERY trigger — and upstream swallows
  // the sound name + pitch from that error, so this is the only place it gets named.
  errors.push(...gmRangeErrors(code));

  // 3. .bank("...") names are case-sensitive and must be a real machine; a wrong
  // name resolves to nothing → silent drums.
  const bankRe = /\.bank\s*\(\s*(['"`])([^'"`]+)\1/g;
  while ((m = bankRe.exec(code))) {
    for (const b of m[2].trim().split(/\s+/)) {
      if (b && !PALETTE_BANKS.has(b))
        errors.push(
          `bank "${b}" is not a loaded drum machine (case-sensitive) — its drums will be silent. Use an exact name like RolandTR808, RolandTR909, RolandTR707, LinnLM2, AkaiMPC60.`,
        );
    }
  }

  // 4. AUDIBILITY — we can't render audio server-side, but the loudest causes of
  // a "layer I literally cannot hear" are visible in the code (lib/audibility.ts,
  // shared with the UI readout). Deterministic silence (e.g. a triad under the
  // lefthand voicing dict) HARD-FAILS so the loop regenerates; fuzzy cases are
  // warnings the model verifies/fixes.
  for (const a of analyzeAudibility(code)) {
    const msg = `layer ${a.layer}: ${a.issue}`;
    if (a.severity === "error") errors.push(msg);
    else warnings.push(msg);
  }

  // 5. CHORDS & HARMONIC ALIGNMENT — "parses but plays silence/one note": a
  // note(...).voicing() (voicing reads the chord control), an unrecognised chord
  // symbol that collapses to one note, or harmonic layers whose progressions are
  // different lengths and drift out of sync. (lib/chord-check.ts)
  const chords = checkChords(code);
  errors.push(...chords.errors);
  warnings.push(...chords.warnings);

  // 6. MINI-NOTATION — run Strudel's real mini grammar over every pattern string
  // so a string that's valid JS but throws in the browser (e.g. "|" as a bar
  // line) is caught here instead of at play time.
  errors.push(...checkMini(code));

  // 7. ARGUMENT TYPES — methods whose pattern must be NUMERIC (arp note indices,
  // gain/lpf/pan/speed…). Word leaves parse as valid mini-notation but are NaN
  // at play time → silent. The clearest case: arp("up down") (arp wants indices
  // like "0 [0,2] 1 2", not mode words). (lib/arg-check.ts)
  const argv = checkArgs(code);
  errors.push(...argv.errors);
  warnings.push(...argv.warnings);

  // 8. MISC USAGE — degenerate time factors (.fast(0)/.slow(0)…) and chord
  // symbols mistakenly placed inside note() (silent). (lib/usage-check.ts)
  const usage = checkUsage(code);
  errors.push(...usage.errors);
  warnings.push(...usage.warnings);

  return { ok: errors.length === 0, errors, warnings };
}
