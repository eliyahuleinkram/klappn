// lib/reverb-orbits.ts
var EFFECT_RE = /\.(?:room|roomsize|roomfade|roomlp|roomdim|delay|delaytime|delayfeedback)\s*\(/;
function arg(layer, methods) {
  const m = layer.match(new RegExp(`\\.(?:${methods})\\(\\s*([^)]*?)\\s*\\)`));
  return m ? m[1].trim() : "";
}
function layerSignature(layer) {
  return [
    arg(layer, "roomsize|rsize|size|sz"),
    arg(layer, "roomfade|fade"),
    arg(layer, "roomlp"),
    arg(layer, "roomdim"),
    arg(layer, "delaytime|delayt|dt"),
    arg(layer, "delayfeedback|delayfb|dfb")
  ].join("|");
}
function layerAppendPos(layer) {
  const cut = layer.indexOf("/*");
  const lines = (cut >= 0 ? layer.slice(0, cut) : layer).split("\n");
  while (lines.length && (/^\s*$/.test(lines[lines.length - 1]) || /^\s*\/\//.test(lines[lines.length - 1])))
    lines.pop();
  const codeOnly = lines.join("\n");
  const lp = codeOnly.lastIndexOf(")");
  return lp >= 0 ? lp + 1 : codeOnly.replace(/\s+$/, "").length;
}
function sanitizeDuckTargets(code) {
  if (!code || !/\.duck(?:orbit)?\s*\(/.test(code)) return code;
  const orbits = /* @__PURE__ */ new Set();
  const starts = [];
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
    (full, _q, list) => {
      const kept = list.split(":").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && Number.isInteger(n) && orbits.has(n));
      if (kept.length === 0) return "";
      return `.duck("${kept.join(":")}")`;
    }
  );
}
function stripDuckFamily(code) {
  return code.replace(
    /\.duck(?:orbit|attack|att|depth|onset|ons)?\((?:[^()]|\([^()]*\))*\)/g,
    ""
  );
}
function wireSidechain(code) {
  if (!code) return code;
  if (!/\.duck(?:orbit)?\s*\(/.test(code)) return code;
  const starts = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code;
  const layers = starts.map((s, i) => ({
    start: s,
    text: code.slice(s, i + 1 < starts.length ? starts[i + 1] : code.length)
  }));
  const isDucker = (t) => /\.duck(?:orbit)?\s*\(/.test(t);
  const isTonal = (t) => /\b(?:note|chord|n)\s*\(/.test(t);
  const duckers = layers.filter((l) => isDucker(l.text));
  const targets = layers.filter((l) => !isDucker(l.text) && isTonal(l.text));
  if (duckers.length === 0) return sanitizeDuckTargets(code);
  if (targets.length === 0) return stripDuckFamily(code);
  let maxOrbit = 1;
  for (const l of layers) {
    const m = l.text.match(/\.orbit\(\s*(\d+)\s*\)/);
    if (m) maxOrbit = Math.max(maxOrbit, Number(m[1]));
  }
  const sigOrbit = /* @__PURE__ */ new Map();
  let next = maxOrbit + 1;
  const targetOrbits = /* @__PURE__ */ new Set();
  const rewritten = /* @__PURE__ */ new Map();
  for (const tl of targets) {
    const sig = layerSignature(tl.text);
    let o = sigOrbit.get(sig);
    if (o === void 0) {
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
    t = t.replace(
      /\.duck(?:orbit)?\(\s*(?:"[^"]*"|'[^']*'|[^()]*)\s*\)/g,
      `.duck("${list}")`
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
function assignReverbOrbits(code) {
  if (!code) return code;
  if (/\.orbit\s*\(/.test(code)) return code;
  const starts = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code;
  const orbitOf = /* @__PURE__ */ new Map();
  let next = 1;
  const inserts = [];
  for (let li = 0; li < starts.length; li++) {
    const start = starts[li];
    const end = li + 1 < starts.length ? starts[li + 1] : code.length;
    const layer = code.slice(start, end);
    if (!EFFECT_RE.test(layer)) continue;
    const sig = layerSignature(layer);
    let orbit = orbitOf.get(sig);
    if (orbit === void 0) {
      orbit = next++;
      orbitOf.set(sig, orbit);
    }
    inserts.push({ index: start + layerAppendPos(layer), text: `.orbit(${orbit})` });
  }
  if (orbitOf.size <= 1) return code;
  let out = code;
  for (const ins of inserts.sort((a, b) => b.index - a.index)) {
    out = out.slice(0, ins.index) + ins.text + out.slice(ins.index);
  }
  return out;
}
function rebusArrangement(codes) {
  const globalOrbit = /* @__PURE__ */ new Map();
  let next = 1;
  const orbitFor = (sig) => {
    let o = globalOrbit.get(sig);
    if (o === void 0) {
      o = next++;
      globalOrbit.set(sig, o);
    }
    return o;
  };
  return codes.map((code) => {
    if (!code) return code;
    const starts = [];
    for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
    if (!starts.length) return code;
    const remap = /* @__PURE__ */ new Map();
    const edits = [];
    for (let li = 0; li < starts.length; li++) {
      const start = starts[li];
      const end = li + 1 < starts.length ? starts[li + 1] : code.length;
      const layer = code.slice(start, end);
      const old = layer.match(/\.orbit\(\s*(\d+)\s*\)/);
      if (!old && !EFFECT_RE.test(layer)) continue;
      const target = orbitFor(layerSignature(layer));
      if (old) {
        remap.set(Number(old[1]), target);
        if (Number(old[1]) !== target)
          edits.push({
            index: start + (old.index ?? 0),
            remove: old[0].length,
            text: `.orbit(${target})`
          });
      } else {
        edits.push({ index: start + layerAppendPos(layer), remove: 0, text: `.orbit(${target})` });
      }
    }
    let out = code;
    for (const e of edits.sort((a, b) => b.index - a.index))
      out = out.slice(0, e.index) + e.text + out.slice(e.index + e.remove);
    out = out.replace(/\.duck(orbit)?\(\s*"([\d:\s]*)"\s*\)/g, (m, orb, list) => {
      const mapped = list.split(":").map((n) => n.trim()).filter(Boolean).map((n) => String(remap.get(Number(n)) ?? n));
      return `.duck${orb ?? ""}("${[...new Set(mapped)].join(":")}")`;
    });
    return out;
  });
}
export {
  assignReverbOrbits,
  layerAppendPos,
  layerSignature,
  rebusArrangement,
  sanitizeDuckTargets,
  stripDuckFamily,
  wireSidechain
};
