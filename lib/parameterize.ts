/**
 * DETERMINISTIC tweak parameterization (no AI). Runs once AFTER the agents finish
 * a loop and turns it into a simple MIXER + per-track EFFECT knobs — WITHOUT
 * changing the music. For every `$:` track it exposes:
 *
 *  - LEVEL: a plain numeric `.gain(0.9)` is hoisted to a top-level `const` (the
 *    fader moves the exact same value → audio identical); a pattern/absent gain
 *    gets an appended `.postgain(level)` (×1 no-op multiplier).
 *  - ECHO (`.delay`) and REVERB (`.room`): if the track already has a NUMERIC
 *    one, the value is hoisted to a `const` (default = the current value → no
 *    change); if it has NONE, we append `.delay(0)` / `.room(0)` — a true no-op
 *    send (silent until raised). A track whose delay/room is a PATTERN (not a
 *    plain number) is left untouched (no knob) so we never clobber it.
 *
 * Everything is hoist-or-append (the proven Gain pattern), so at the defaults the
 * program is byte-for-byte the same loop, and a global override can never strip
 * the composer's effects. Emits `/* @controls *\/`.
 */

function roleOf(layer: string): string {
  const s = (layer.match(/\bs(?:ound)?\(\s*['"`]([^'"`]+)/) || [])[1] || "";
  const inst = (layer.match(/\.s\(\s*['"`]([^'"`]+)/) || [])[1] || "";
  const name = `${s} ${inst}`.toLowerCase();
  if (/\bbd\b|kick/.test(name)) return "Kick";
  if (/\bsd\b|snare/.test(name)) return "Snare";
  if (/\bcp\b|clap/.test(name)) return "Clap";
  if (/\brim\b/.test(name)) return "Rim";
  if (/\b(hh|oh|sh)\b|hat/.test(name)) return "Hats";
  if (/bass|sub/.test(name)) return "Bass";
  if (/\bchord\b/.test(layer) || /organ|pad|string|choir|piano|rhodes|epiano/.test(name))
    return "Chords";
  if (/lead|saw|square|supersaw|pluck|arp|trumpet|sax|brass|flute|guitar|nylon/.test(name))
    return "Lead";
  if (/white|pink|noise|vinyl|wind|crackle/.test(name)) return "Texture";
  if (/\bnote\(|\bn\(/.test(layer)) {
    // low-octave melodic line → it's the bass
    const octs = [...layer.matchAll(/[a-gA-G][#b]?(\d)/g)].map((x) => +x[1]);
    return octs.length && Math.max(...octs) <= 3 ? "Bass" : "Melody";
  }
  const bare = (s || inst).replace(/^gm_/, "").replace(/_/g, " ").trim();
  return bare ? bare[0].toUpperCase() + bare.slice(1) : "Layer";
}

const ident = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "") || "p";

interface Control {
  name: string;
  label: string;
  desc: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
interface Edit {
  index: number;
  length: number; // 0 = pure insertion
  text: string;
}

/** Where to append to a layer's chain: just after its last `)`, skipping any
 *  trailing blank/comment lines (so we never write inside a comment). */
function appendPos(layer: string): number {
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

const round2 = (n: number) => Math.round(n * 100) / 100;
const LAYER_CAP = 12; // a mixer rarely needs more than this many tracks

/** Add DJ + effect controls to a finished loop. Idempotent; never alters the
 *  music at the default values. */
export function parameterize(code: string): string {
  if (!code || /\/\*\s*@controls\b/.test(code)) return code;

  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code;

  const used = new Set<string>();
  const uniq = (base: string): string => {
    let n = ident(base);
    const b = n;
    let i = 2;
    while (used.has(n)) n = `${b}${i++}`;
    used.add(n);
    return n;
  };

  // Grouped so the panel reads cleanly: all Levels, then all Echoes, then Reverbs.
  const levels: Control[] = [];
  const echoes: Control[] = [];
  const reverbs: Control[] = [];
  const edits: Edit[] = [];

  for (let li = 0; li < Math.min(starts.length, LAYER_CAP); li++) {
    const start = starts[li];
    const end = li + 1 < starts.length ? starts[li + 1] : code.length;
    const layer = code.slice(start, end);
    const role = roleOf(layer);
    const appends: string[] = []; // no-op methods to add to tracks that lack them

    // LEVEL — hoist a literal gain, else append a postgain multiplier (×1).
    const gm = layer.match(/\.gain\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
    if (gm && gm.index !== undefined) {
      const value = Number(gm[1]);
      const name = uniq(`${role}level`);
      levels.push({
        name,
        label: `${role} level`,
        desc: `Level of the ${role.toLowerCase()} in the mix`,
        min: 0,
        max: Math.max(1.3, round2(value * 1.6)),
        step: 0.05,
        default: value,
      });
      edits.push({ index: start + gm.index, length: gm[0].length, text: `.gain(${name})` });
    } else {
      const name = uniq(`${role}level`);
      levels.push({
        name,
        label: `${role} level`,
        desc: `Level of the ${role.toLowerCase()} in the mix`,
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      });
      appends.push(`.postgain(${name})`);
    }

    // ECHO (delay) + REVERB (room): hoist a numeric value, or append a 0 no-op.
    // A PATTERN-valued effect is left alone (no knob) so we never clobber it.
    for (const fx of [
      { method: "delay", arr: echoes, word: "echo", max: 0.8, maxFloor: 0.8 },
      { method: "room", arr: reverbs, word: "reverb", max: 0.9, maxFloor: 0.9 },
    ] as const) {
      const numeric = layer.match(
        new RegExp(`\\.${fx.method}\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)`),
      );
      const hasAny = new RegExp(`\\.${fx.method}\\(`).test(layer);
      const name = uniq(`${role}${fx.word}`);
      const ctrl = (def: number, max: number): Control => ({
        name,
        label: `${role} ${fx.word}`,
        desc: `${fx.word === "echo" ? "Delay/echo" : "Reverb/space"} on the ${role.toLowerCase()}`,
        min: 0,
        max,
        step: 0.02,
        default: def,
      });
      if (numeric && numeric.index !== undefined) {
        const value = Number(numeric[1]);
        fx.arr.push(ctrl(value, Math.max(fx.maxFloor, round2(value * 1.5))));
        edits.push({
          index: start + numeric.index,
          length: numeric[0].length,
          text: `.${fx.method}(${name})`,
        });
      } else if (hasAny) {
        // pattern-valued effect — leave it untouched; don't free the name.
        used.delete(name);
      } else {
        fx.arr.push(ctrl(0, fx.max));
        appends.push(`.${fx.method}(${name})`);
      }
    }

    if (appends.length) {
      edits.push({ index: start + appendPos(layer), length: 0, text: appends.join("") });
    }
  }

  const controls = [...levels, ...echoes, ...reverbs];
  if (controls.length === 0) return code;

  let out = code;
  for (const e of edits.sort((a, b) => b.index - a.index)) {
    out = out.slice(0, e.index) + e.text + out.slice(e.index + e.length);
  }

  const decls = controls.map((c) => `const ${c.name} = ${c.default}`).join("\n");
  return `/* @controls\n${JSON.stringify(controls)}\n*/\n${decls}\n\n${out}`;
}
