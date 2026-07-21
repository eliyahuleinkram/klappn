/**
 * DETERMINISTIC reverb/delay orbit deconfliction (no AI) — a crackle guard.
 *
 * superdough shares ONE reverb and ONE delay per "orbit", and every layer
 * defaults to orbit 1. If two layers on the same orbit ask for DIFFERENT reverb
 * settings (roomsize/fade/lp/dim) or DIFFERENT delay settings (time/feedback),
 * the engine rebuilds the multi-second reverb impulse — or re-times the delay —
 * over and over mid-playback. That rebuild, on the live audio path, is audible as
 * crackle/ticks (superdough's own code comments warn about it).
 *
 * This pass guarantees it can't happen: every layer that uses a reverb/delay gets
 * its OWN orbit, so each effect bus is built exactly once. Layers with the SAME
 * effect signature share an orbit (no need to separate identical settings).
 * .orbit() only separates the EFFECT buses — it does NOT change the stereo output.
 *
 * Runs on the finished music BEFORE parameterize adds its @controls block. Audio
 * is otherwise untouched. If the author already manages orbits (any `.orbit(` in
 * the code), we trust them and do nothing.
 */

const EFFECT_RE = /\.(?:room|roomsize|roomfade|roomlp|roomdim|delay|delaytime|delayfeedback)\s*\(/;

/** Pull a numeric/literal arg for a method (first alias that appears), or "". */
function arg(layer: string, methods: string): string {
  const m = layer.match(new RegExp(`\\.(?:${methods})\\(\\s*([^)]*?)\\s*\\)`));
  return m ? m[1].trim() : "";
}

/** The effect-bus signature: two layers conflict iff these differ. Exported for
 *  the set deck's channel-orbit assignment (lib/set-live.ts), which re-buses
 *  layers by performance channel while honouring the same crackle rule.
 *  ALIASES MATTER (2026-07-14, the clicking-violin bug): the model writes
 *  `.size(4)`, not `.roomsize(4)` — a signature blind to the alias saw every
 *  layer as identical, assigned no orbits, and superdough regenerated the ONE
 *  shared reverb on every size alternation (a click per rebuild, mid-ring). */
export function layerSignature(layer: string): string {
  return [
    arg(layer, "roomsize|rsize|size|sz"),
    arg(layer, "roomfade|fade"),
    arg(layer, "roomlp"),
    arg(layer, "roomdim"),
    arg(layer, "delaytime|delayt|dt"),
    arg(layer, "delayfeedback|delayfb|dfb"),
  ].join("|");
}

/** Append point: just after the layer's last `)`, skipping trailing blank/comment
 *  lines so we never write inside a comment. (Mirrors parameterize.appendPos.) */
export function layerAppendPos(layer: string): number {
  // NEVER write inside a comment: the stored loop carries trailing block
  // comments (/* @vcontrols */, /* @hydra */ …) whose code the app EXTRACTS
  // and runs for real — an .orbit() appended after the hydra block's last ")"
  // became `.out().orbit(2)` at visuals eval → "Cannot read properties of
  // undefined (reading 'orbit')" and playback died (2026-07-14, prod).
  const cut = layer.indexOf("/*");
  const lines = (cut >= 0 ? layer.slice(0, cut) : layer).split("\n");
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

/**
 * DETERMINISTIC duck-target repair (no AI). Sidechain ducking (`.duck("1:2")`)
 * names the orbit(s) to duck — and a model sometimes names an orbit NO layer
 * lives on, which superdough reports every cycle ("duck target orbit 8 does not
 * exist"). Keep only targets that exist: orbit 1 if any layer runs on the
 * default bus, plus every literal `.orbit(n)`. A duck left with no valid target
 * is dropped entirely (its duckdepth/duckattack params are inert without it).
 */
export function sanitizeDuckTargets(code: string): string {
  if (!code || !/\.duck(?:orbit)?\s*\(/.test(code)) return code;
  const orbits = new Set<number>();
  // Any `$:` layer WITHOUT an explicit .orbit() runs on the default bus (1).
  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  for (let li = 0; li < starts.length; li++) {
    const end = li + 1 < starts.length ? starts[li + 1] : code.length;
    const layer = code.slice(starts[li], end);
    const o = layer.match(/\.orbit\(\s*(\d+)\s*\)/);
    orbits.add(o ? Number(o[1]) : 1);
  }
  if (orbits.size === 0) return code;
  return code.replace(
    /\.duck(?:orbit)?\(\s*(["']?)([\d:\s]+)\1\s*\)/g,
    (full, _q: string, list: string) => {
      const kept = list
        .split(":")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && Number.isInteger(n) && orbits.has(n));
      if (kept.length === 0) return "";
      return `.duck("${kept.join(":")}")`;
    },
  );
}

/** The whole duck family off a stretch of code (misuse cleanup — same family
 *  list playback used to strip wholesale). */
export function stripDuckFamily(code: string): string {
  return code.replace(
    /\.duck(?:orbit|attack|att|depth|onset|ons)?\((?:[^()]|\([^()]*\))*\)/g,
    "",
  );
}

/**
 * DETERMINISTIC sidechain WIRING (no AI) — makes `.duck` honest. superdough
 * ducks a whole ORBIT's output, and every dry layer defaults to orbit 1 — so a
 * model-written duck either ducked ITSELF or named an orbit that didn't exist
 * (which is why playback stripped the family and no song ever pumped).
 *
 * The contract now: `.duck(…)` on a rhythmic layer means "pump the sustained
 * tonal voices against me". This pass does the routing the model can't see:
 *  - targets = every layer with tonal material (note/chord/n) that isn't
 *    itself ducking, moved onto fresh orbits (one per effect signature — the
 *    crackle rule holds: each new bus carries exactly one reverb/delay setup);
 *  - every ducker's `.duck(…)` arg is rewritten to exactly those orbits;
 *  - an unset `.duckdepth` gets .6 (the engine default of 1 pumps to silence).
 * No `.duck` in the code = nothing changes (legacy repair only). Duck with no
 * tonal target (a drums-only loop) = the family is dropped.
 */
export function wireSidechain(code: string): string {
  if (!code) return code;
  if (!/\.duck(?:orbit)?\s*\(/.test(code)) return code;
  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code;
  const layers = starts.map((s, i) => ({
    start: s,
    text: code.slice(s, i + 1 < starts.length ? starts[i + 1] : code.length),
  }));
  const isDucker = (t: string) => /\.duck(?:orbit)?\s*\(/.test(t);
  const isTonal = (t: string) => /\b(?:note|chord|n)\s*\(/.test(t);
  const duckers = layers.filter((l) => isDucker(l.text));
  const targets = layers.filter((l) => !isDucker(l.text) && isTonal(l.text));
  if (duckers.length === 0) return sanitizeDuckTargets(code);
  if (targets.length === 0) return stripDuckFamily(code);
  let maxOrbit = 1;
  for (const l of layers) {
    const m = l.text.match(/\.orbit\(\s*(\d+)\s*\)/);
    if (m) maxOrbit = Math.max(maxOrbit, Number(m[1]));
  }
  // Fresh orbit per target effect-signature: identical settings share one bus
  // (they duck together anyway); distinct settings never collide (crackle rule).
  const sigOrbit = new Map<string, number>();
  let next = maxOrbit + 1;
  const targetOrbits = new Set<number>();
  const rewritten = new Map<(typeof layers)[number], string>();
  for (const tl of targets) {
    const sig = layerSignature(tl.text);
    let o = sigOrbit.get(sig);
    if (o === undefined) {
      o = next++;
      sigOrbit.set(sig, o);
    }
    targetOrbits.add(o);
    let t = tl.text;
    if (/\.orbit\(\s*\d+\s*\)/.test(t)) t = t.replace(/\.orbit\(\s*\d+\s*\)/, `.orbit(${o})`);
    else {
      const p = layerAppendPos(t);
      t = `${t.slice(0, p)}.orbit(${o})${t.slice(p)}`;
    }
    rewritten.set(tl, t);
  }
  const list = [...targetOrbits].sort((a, b) => a - b).join(":");
  for (const dl of duckers) {
    let t = dl.text;
    // Whatever the model wrote as the arg (an orbit guess, a bare amount), the
    // REAL targets are the wired ones.
    t = t.replace(
      /\.duck(?:orbit)?\(\s*(?:"[^"]*"|'[^']*'|[^()]*)\s*\)/g,
      `.duck("${list}")`,
    );
    if (!/\.duckdepth\s*\(/.test(t)) {
      const p = layerAppendPos(t);
      t = `${t.slice(0, p)}.duckdepth(.6)${t.slice(p)}`;
    }
    rewritten.set(dl, t);
  }
  let out = code.slice(0, layers[0].start);
  for (const l of layers) out += rewritten.get(l) ?? l.text;
  return out;
}

export function assignReverbOrbits(code: string): string {
  if (!code) return code;
  if (/\.orbit\s*\(/.test(code)) return code; // author manages orbits — trust them

  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code;

  // Map each distinct effect signature → a stable orbit number (1,2,3,…).
  const orbitOf = new Map<string, number>();
  let next = 1;
  interface Ins {
    index: number;
    text: string;
  }
  const inserts: Ins[] = [];

  for (let li = 0; li < starts.length; li++) {
    const start = starts[li];
    const end = li + 1 < starts.length ? starts[li + 1] : code.length;
    const layer = code.slice(start, end);
    if (!EFFECT_RE.test(layer)) continue; // no reverb/delay → no bus conflict

    const sig = layerSignature(layer);
    let orbit = orbitOf.get(sig);
    if (orbit === undefined) {
      orbit = next++;
      orbitOf.set(sig, orbit);
    }
    inserts.push({ index: start + layerAppendPos(layer), text: `.orbit(${orbit})` });
  }

  // Only one effect signature in the whole loop → everything already shares one
  // bus that's built once. Nothing to deconflict.
  if (orbitOf.size <= 1) return code;

  let out = code;
  for (const ins of inserts.sort((a, b) => b.index - a.index)) {
    out = out.slice(0, ins.index) + ins.text + out.slice(ins.index);
  }
  return out;
}

/**
 * SONG-WIDE re-bus (2026-07-14, "clicks in many loops"): per-loop orbit
 * assignment numbers orbits independently per loop — orbit 1 carries size 7 in
 * one loop and size 3 in the next, so at every section seam superdough
 * REGENERATES that orbit's reverb/delay mid-ring (a click per rebuild; a real
 * song showed 3-5 conflicting signatures on almost every orbit). This pass
 * runs at ARRANGEMENT BUILD over all sections at once: ONE signature→orbit map
 * for the whole song, every effect-carrying (or already-bused) layer moved to
 * its global bus, and each section's `.duck("a:b")` targets remapped through
 * that section's old→new orbit map so sidechains keep pumping the same voices.
 * Idempotent — running it on its own output changes nothing.
 */
export function rebusArrangement(codes: string[]): string[] {
  const globalOrbit = new Map<string, number>();
  let next = 1;
  const orbitFor = (sig: string): number => {
    let o = globalOrbit.get(sig);
    if (o === undefined) {
      o = next++;
      globalOrbit.set(sig, o);
    }
    return o;
  };
  return codes.map((code) => {
    if (!code) return code;
    const starts: number[] = [];
    for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
    if (!starts.length) return code;
    const remap = new Map<number, number>(); // this section's old orbit → global
    interface Edit {
      index: number;
      remove: number;
      text: string;
    }
    const edits: Edit[] = [];
    for (let li = 0; li < starts.length; li++) {
      const start = starts[li];
      const end = li + 1 < starts.length ? starts[li + 1] : code.length;
      const layer = code.slice(start, end);
      const old = layer.match(/\.orbit\(\s*(\d+)\s*\)/);
      if (!old && !EFFECT_RE.test(layer)) continue; // dry, unbused — the default bus is fine
      const target = orbitFor(layerSignature(layer));
      if (old) {
        remap.set(Number(old[1]), target);
        if (Number(old[1]) !== target)
          edits.push({
            index: start + (old.index ?? 0),
            remove: old[0].length,
            text: `.orbit(${target})`,
          });
      } else {
        edits.push({ index: start + layerAppendPos(layer), remove: 0, text: `.orbit(${target})` });
      }
    }
    let out = code;
    for (const e of edits.sort((a, b) => b.index - a.index))
      out = out.slice(0, e.index) + e.text + out.slice(e.index + e.remove);
    // sidechain targets follow their voices onto the new buses
    out = out.replace(/\.duck(orbit)?\(\s*"([\d:\s]*)"\s*\)/g, (m, orb, list: string) => {
      const mapped = list
        .split(":")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => String(remap.get(Number(n)) ?? n));
      return `.duck${orb ?? ""}("${[...new Set(mapped)].join(":")}")`;
    });
    return out;
  });
}

