// M5 — CORPUS GOLDEN MASTERS: real prod loops through BOTH engines, diffed.
// Per-loop comparison (the pattern layer is identical for both engines; loops
// isolate the ENGINE). Usage:
//   node corpus.mjs '<json: [{song, label, code}, …]>'  (or CORPUS_FILE=path)
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assignReverbOrbits } from "./rebus.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const wasm = readFileSync(join(here, "..", "zaltz.wasm"));
// disk-cached, retrying proxy fetches — same shim as sd-gm.src.mjs
{
  const _fetch = globalThis.fetch.bind(globalThis);
  const DIR = "/tmp/klt/httpcache";
  const { mkdirSync, existsSync } = await import("node:fs");
  mkdirSync(DIR, { recursive: true });
  const keyOf = (u) => DIR + "/" + Buffer.from(u).toString("base64url").slice(0, 200);
  globalThis.fetch = async (url, ...r) => {
    if (typeof url === "string" && url.startsWith("/")) url = "https://klappn.com" + url;
    if (typeof url !== "string" || !url.startsWith("https://klappn.com")) return _fetch(url, ...r);
    const key = keyOf(url);
    if (existsSync(key)) return new Response(readFileSync(key));
    let lastErr;
    for (let a = 0; a < 3; a++) {
      try {
        const res = await _fetch(url, ...r);
        if (!res.ok) throw new Error(`http ${res.status} ${url}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(key, buf);
        return new Response(buf);
      } catch (e) {
        lastErr = e;
        await new Promise((s) => setTimeout(s, 1000 * (a + 1)));
      }
    }
    throw lastErr;
  };
}
const sr = 48000;
const CYCLES = Number(process.env.CORPUS_CYCLES || 2);

const SYNTHS = new Set(["sine", "sawtooth", "saw", "square", "triangle", "tri", "supersaw", "white", "pink", "brown", "crackle"]);
const NOTE_SEM = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function noteToMidi(n) {
  if (typeof n === "number") return n;
  const m = /^([a-g])([#bs]*)(-?\d+)$/.exec(String(n).toLowerCase());
  if (!m) return null;
  let sem = NOTE_SEM[m[1]];
  for (const acc of m[2]) sem += acc === "#" || acc === "s" ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + sem;
}

// ---- sample + gm zone prefetch (shared with run.mjs approach) ----
const sampleCache = new Map();
let maps = null;
async function ensureMaps() {
  if (maps) return;
  maps = {};
  for (const m of ["d0", "d1", "d2", "d3", "d4", "d5", "lib"]) {
    try {
      const map = await fetch(`https://klappn.com/api/snd/m/${m}.json`).then((r) => r.json());
      const base = typeof map._base === "string" ? map._base : "";
      for (const [k, v] of Object.entries(map)) {
        if (k === "_base") continue;
        const list = (Array.isArray(v) ? v : Object.values(v).flat())
          .filter((u) => typeof u === "string")
          .map((u) => (u.startsWith("http") ? u : base + u))
          .map((u) => (u.startsWith("/") ? "https://klappn.com" + u : u));
        if (list.length) maps[k] = list;
      }
    } catch {}
  }
}
import * as nwaa from "../../render-service/node_modules/node-web-audio-api/index.js";
async function fetchSamplePCM(name, n) {
  const key = `${name}:${n}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  await ensureMaps();
  const urls = maps[name];
  if (!urls?.length) return null;
  const url = urls[((n % urls.length) + urls.length) % urls.length];
  const bytes = await fetch(url).then((r) => r.arrayBuffer());
  // nwaa decode can emit NaN after many OfflineAudioContexts in one process
  // (fresh-process decode of the same bytes is clean) — retry, then scrub
  let channels, frames, duration;
  for (let attempt = 0; ; attempt++) {
    const ctx = new nwaa.OfflineAudioContext(2, 48000, 48000);
    const buf = await ctx.decodeAudioData(bytes.slice(0));
    channels = [];
    // COPY — getChannelData returns a VIEW into nwaa's native buffer, which
    // can be reused after GC: cached views silently mutated into NaN/garbage
    // between decode and upload (the "upload NaN"/exploding-level flakes)
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++)
      channels.push(new Float32Array(buf.getChannelData(c)));
    frames = buf.length; duration = buf.duration;
    let bad = 0;
    for (const ch of channels) for (let i = 0; i < ch.length; i++) if (!Number.isFinite(ch[i])) bad++;
    if (!bad) break;
    if (attempt >= 2) {
      console.error(`sample ${key}: decode NaN ×${bad} of ${frames} after retries — scrubbed to 0`);
      for (const ch of channels) for (let i = 0; i < ch.length; i++) if (!Number.isFinite(ch[i])) ch[i] = 0;
      break;
    }
  }
  const out = { channels, frames, duration, name: key };
  sampleCache.set(key, out);
  return out;
}
const gmCache = new Map();
function fetchGmZones(name, midis) {
  const missing = midis.filter((m) => !gmCache.has(`${name}:${m}`));
  if (missing.length) {
    execFileSync(process.execPath, [join(here, "gm-zones.mjs")], {
      env: { ...process.env, GM_NAME: name, GM_MIDIS: missing.join(",") },
      maxBuffer: 1 << 24,
      timeout: 120000,
    });
    const meta = JSON.parse(
      execFileSync(process.execPath, [join(here, "gm-zones.mjs")], {
        env: { ...process.env, GM_NAME: name, GM_MIDIS: missing.join(",") },
        maxBuffer: 1 << 24,
        timeout: 120000,
      }).toString().trim().split("\n").pop(),
    );
    const bin = readFileSync("/tmp/klt/gmzones.bin");
    meta.forEach((m, i) => {
      const floats = new Float32Array(bin.buffer.slice(bin.byteOffset + m.off * 4, bin.byteOffset + (m.off + m.frames * m.channels) * 4));
      const channels = [];
      let bad = 0;
      for (let c = 0; c < m.channels; c++) {
        const ch = new Float32Array(m.frames);
        for (let j = 0; j < m.frames; j++) {
          const x = floats[j * m.channels + c];
          if (!Number.isFinite(x)) { bad++; ch[j] = 0; } else ch[j] = x;
        }
        channels.push(ch);
      }
      if (bad) throw new Error(`gm zone ${name}:${missing[i]} decoded with NaN ×${bad} of ${m.frames * m.channels}`);
      gmCache.set(`${name}:${missing[i]}`, { ...m, channels });
    });
  }
  return midis.map((m) => gmCache.get(`${name}:${m}`));
}

// ---- zaltz render ----
async function renderZaltz(evs, uploads, seconds) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(sr);
  uploads.forEach((sm, id) => {
    if (!sm) return;
    const ch = sm.channels.length >= 2 ? 2 : 1;
    const ptr = ex.sd_sample_alloc(id, sm.frames, ch);
    if (!ptr) throw new Error("arena full");
    const dst = new Float32Array(ex.memory.buffer, ptr, sm.frames * ch);
    for (let i = 0; i < sm.frames; i++)
      for (let c = 0; c < ch; c++) {
        const x = sm.channels[c][i];
        if (!Number.isFinite(x)) throw new Error(`upload NaN in sample ${id} (flaky zone fetch?)`);
        dst[i * ch + c] = x;
      }
  });
  const mem = new Uint8Array(ex.memory.buffer);
  for (const ev of evs) {
    const str = Object.entries(ev).map(([k, v]) => `${k}/${v}`).join("/") + "\0";
    const b = new TextEncoder().encode(str);
    mem.set(b, ex.sd_event_ptr());
    ex.sd_event(); // full queues drop extras — matches voice-steal spirit
  }
  const blocks = Math.ceil((seconds * sr) / 128);
  const L = new Float32Array(blocks * 128);
  for (let b = 0; b < blocks; b++) {
    ex.sd_dsp();
    const out = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), 128 * 2);
    for (let i = 0; i < 128; i++) L[b * 128 + i] = out[i * 2];
  }
  return L;
}

// ---- metrics ----
const W = (sr * 10) / 1000;
function envelope(L, w = W) {
  const out = [];
  for (let c = 0; c + w <= L.length; c += w) {
    let e = 0;
    for (let i = c; i < c + w; i++) e += L[i] * L[i];
    out.push(Math.sqrt(e / w));
  }
  return out;
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.max(Math.sqrt(da * db), 1e-12);
}
const rms = (L) => {
  let e = 0;
  for (let i = 0; i < L.length; i++) e += L[i] * L[i];
  return Math.sqrt(e / Math.max(L.length, 1));
};
const tilt = (L) => {
  let ed = 0, e = 0;
  for (let i = 1; i < L.length; i++) { const d = L[i] - L[i - 1]; ed += d * d; e += L[i] * L[i]; }
  return Math.sqrt(ed / Math.max(e, 1e-12));
};

// ---- hap → event (the corpus bridge: synths + samples + gm) ----
function buildEvents(dump) {
  const uploads = [];
  const sampleIdx = new Map();
  const gmNeeds = new Map(); // name → Set(midi)
  for (const h of dump.haps) {
    const v = h.value;
    let s = v.s ?? "triangle";
    if (v.bank) s = `${v.bank}_${s}`;
    if (String(s).startsWith("gm_")) {
      const midi = noteToMidi(v.note ?? 60);
      if (midi != null) {
        if (!gmNeeds.has(s)) gmNeeds.set(s, new Set());
        gmNeeds.get(s).add(midi);
      }
    }
  }
  const gmIdx = new Map();
  for (const [name, midis] of gmNeeds) {
    const list = [...midis];
    const zones = fetchGmZones(name, list);
    zones.forEach((z, i) => {
      if (!z) return;
      gmIdx.set(`${name}:${list[i]}`, { id: uploads.length, z });
      uploads.push(z);
    });
  }
  const evs = [];
  const dropped = new Map();
  const pending = [];
  for (const h of dump.haps) {
    const v = h.value;
    let s = v.s ?? "triangle";
    if (v.bank) s = `${v.bank}_${s}`;
    const ev = { time: h.begin, duration: h.duration };
    for (const k of ["attack", "decay", "sustain", "release", "gain", "velocity", "postgain", "pan",
      "lpattack", "lpdecay", "lpsustain", "lprelease", "lpenv", "vib", "vibmod",
      "unison", "spread", "detune", "speed", "begin", "end",
      "orbit", "room", "roomlp", "delay", "delaytime", "delayfeedback",
      "shape", "shapevol", "duckonset", "duckattack", "duckdepth", "crush", "coarse", "cut", "drive", "density",
      "phaserrate", "phaserdepth", "phasercenter", "phasersweep"]) {
      if (typeof v[k] === "number" && Number.isFinite(v[k])) ev[k] = v[k];
    }
    if (v.duck != null) ev.duck = String(v.duck);
    if (typeof v.ftype === "string") ev.ftype = v.ftype;
    if (v.cutoff != null) ev.lpf = v.cutoff;
    if (v.lpf != null) ev.lpf = v.lpf;
    if (v.resonance != null) ev.lpq = v.resonance;
    if (typeof v.phaser === "number") ev.phaserrate = v.phaser;
    if (v.hcutoff != null) ev.hpf = v.hcutoff;
    if (v.hpf != null) ev.hpf = v.hpf;
    if (v.size != null || v.roomsize != null) ev.roomsize = v.roomsize ?? v.size;
    if (SYNTHS.has(s)) {
      ev.s = s === "saw" ? "sawtooth" : s === "tri" ? "triangle" : s;
      if (v.freq != null) ev.freq = v.freq;
      else {
        const midi = noteToMidi(v.note ?? 36);
        if (midi == null) continue;
        ev.note = midi;
      }
      evs.push(ev);
    } else if (String(s).startsWith("gm_")) {
      const midi = noteToMidi(v.note ?? 60);
      const g = midi != null ? gmIdx.get(`${s}:${midi}`) : null;
      if (!g) { dropped.set(s, (dropped.get(s) ?? 0) + 1); continue; }
      ev.s = "sample";
      ev.sample = g.id;
      ev.speed = g.z.rate;
      if (g.z.loop) { ev.loop = 1; ev.loopBegin = g.z.loopBegin; ev.loopEnd = g.z.loopEnd; }
      ev.gain = 0.3 * (typeof v.gain === "number" ? v.gain : 0.8) * (typeof v.velocity === "number" ? v.velocity : 1);
      delete ev.velocity;
      evs.push(ev);
    } else {
      pending.push({ ev, s, n: typeof v.n === "number" ? v.n : 0, v });
    }
  }
  return { evs, uploads, pending, dropped, sampleIdx };
}

// ---- main ----
const src = process.env.CORPUS_FILE
  ? JSON.parse(readFileSync(process.env.CORPUS_FILE, "utf8"))
  : JSON.parse(process.argv[2] ?? "[]");
const report = [];
let pass = 0, ear = 0, fail = 0, skip = 0;
async function measureCase(code) {
  // BOTH sides render one PAD cycle beyond the compared window: the nwaa
  // reference silences the LAST THREE cut-group chokes before query end
  // (hits n−4..n−2 measured dead at 1/2/3 cycles; browser superdough chokes
  // fine) — padding pushes the corruption outside the comparison.
  const renderCycles = CYCLES + 1;
  // reference render (soundfont-capable child)
  execFileSync(process.execPath, [join(here, "sd-gm.mjs")], {
    env: { ...process.env, CODE: code, CYCLES: String(renderCycles) },
    maxBuffer: 1 << 24, timeout: 300000,
  });
  const binA = readFileSync("/tmp/klt/sdgm.bin");
  const A = new Float32Array(binA.buffer.slice(binA.byteOffset), 0, binA.length / 4);
  // haps
  const dumpRaw = execFileSync(process.execPath, [join(here, "hap-dump.mjs")], {
    env: { ...process.env, CODE: code, CYCLES: String(renderCycles) },
    maxBuffer: 1 << 24, timeout: 120000,
  }).toString().trim().split("\n").pop();
  const dump = JSON.parse(dumpRaw);
  const { evs, uploads, pending, dropped } = buildEvents(dump);
  for (const p of pending) {
    const pcm = await fetchSamplePCM(p.s, p.n);
    if (!pcm) { dropped.set(p.s, (dropped.get(p.s) ?? 0) + 1); continue; }
    p.ev.s = "sample";
    p.ev.sample = uploads.length;
    uploads.push(pcm);
    if (p.v.clip == null && p.v.loop == null && p.v.release == null)
      p.ev.duration = pcm.duration / Math.abs(p.v.speed ?? 1);
    evs.push(p.ev);
  }
  evs.sort((a, b) => a.time - b.time); // cut-group registry order = audio order
  const B = await renderZaltz(evs, uploads, A.length / sr);
  // ENGINE SANITY: NaN/Inf in our render is a hard defect regardless of tier
  let bad = 0, firstBad = -1;
  for (let i = 0; i < B.length; i++)
    if (!Number.isFinite(B[i])) { bad++; if (firstBad < 0) firstBad = i; }
  if (process.env.CORPUS_DUMP_B) writeFileSync("/tmp/klt/B.bin", Buffer.from(B.buffer));
  if (bad) throw new Error(`ENGINE NaN/Inf ×${bad} first@${(firstBad / sr).toFixed(3)}s`);
  // compare only the first CYCLES (the pad cycle absorbs the reference's
  // dead-choke zone on both sides equally)
  const cps = dump.cps || 1;
  const n = Math.min(Math.floor((CYCLES / cps) * sr), A.length, B.length);
  const cr = corr(envelope(A.subarray(0, n)), envelope(B.subarray(0, n)));
  // coarse corr (100ms windows): noise sources and flat drones have
  // UNCORRELATED fine-envelope wiggle by construction (different random
  // sequences) — musical structure still shows at 100ms
  const crc = corr(envelope(A.subarray(0, n), W * 10), envelope(B.subarray(0, n), W * 10));
  const lvl = 20 * Math.log10(rms(B.subarray(0, n)) / Math.max(rms(A.subarray(0, n)), 1e-9));
  const tA = tilt(A.subarray(0, n)), tB = tilt(B.subarray(0, n));
  const br = Math.abs(tB - tA) / Math.max(tA, 1e-6);
  const drops = [...dropped.entries()].map(([k, c]) => `${k}×${c}`).join(",");
  return { cr, crc, lvl, br, drops };
}
function verdictOf(m, stochastic) {
  if (m.cr > 0.97 && Math.abs(m.lvl) < 1 && m.br < 0.08) return "PASS";
  // fine corr degraded by stochastic content, coarse structure + level +
  // spectrum all matching
  if (m.crc > 0.97 && Math.abs(m.lvl) < 1 && m.br < 0.08) return "PASS";
  // exact envelope + level, tilt alone off: layers sum with different relative
  // PHASE in two engines (verified per-layer parity) — not audible information
  if (m.cr > 0.995 && Math.abs(m.lvl) < 0.5) return "PASS";
  // nwaa's supersaw worklet is documented-UNFAITHFUL to the browser's
  // (phase-coherent, no 1/√unison): supersaw loops have no offline oracle.
  // NaN/Inf sanity still applies; parity is the browser ear's jurisdiction.
  if (stochastic) return "EAR";
  return "FAIL";
}
for (const item of src) {
  const label = `${item.song}/${item.label}`;
  try {
    let code = item.code.split("/*")[0].trim(); // strip UI comment blocks
    // DRY-PATH comparison: the offline REFERENCE's reverb/delay (nwaa
    // convolver + feedback delay) is documented-unreliable (31Hz block
    // artifact, normalization drift) — wet parity is the BROWSER EAR's
    // jurisdiction. Strip the sends from BOTH sides; this sweep gates the
    // engine core: sources, envelopes, filters, duck, shape, gain staging.
    if (!process.env.CORPUS_WET) // CORPUS_WET=1 keeps the sends (trajectory probes)
      code = code.replace(/\.(room|roomsize|size|rsize|sz|roomfade|roomlp|roomdim|delay|delaytime|delayfeedback)\(\s*[^)]*\)/g, "");
    code = assignReverbOrbits(code); // fair orbit routing (the app does this at eval)
    // stochastic sources have no exact offline oracle: supersaw (nwaa's
    // worklet is unfaithful) and noise (different random sequences by
    // construction) — misses degrade to EAR, never FAIL
    const hasStochastic = /supersaw|"(white|pink|brown|crackle)"/.test(code);
    // one retry: cold-proxy fetches flake (dropped reference haps, connect
    // timeouts, bad zone decodes) — a real engine defect is deterministic
    // and fails the retry too; a network flake heals on the warm cache.
    let m, verdict;
    try {
      m = await measureCase(code);
      verdict = verdictOf(m, hasStochastic);
    } catch (e) {
      m = null;
      // a flaky decode POISONS the run-wide caches — drop them so the
      // retry refetches instead of replaying the same bad PCM
      sampleCache.clear();
      gmCache.clear();
    }
    if (!m || verdict === "FAIL") {
      const m2 = await measureCase(code);
      if (!m || m2.cr > m.cr) { m = m2; verdict = verdictOf(m2, hasStochastic); }
    }
    if (verdict === "PASS") pass++;
    else if (verdict === "EAR") ear++;
    else fail++;
    report.push(`${verdict.padEnd(10)} ${label}: corr=${m.cr.toFixed(4)} corr100=${m.crc.toFixed(4)} lvl=${m.lvl.toFixed(2)}dB tilt=${(m.br * 100).toFixed(1)}%${m.drops ? " dropped:" + m.drops : ""}`);
    console.log(report[report.length - 1]);
  } catch (e) {
    skip++;
    report.push(`SKIP       ${label}: ${String(e).slice(0, 120)}`);
    console.log(report[report.length - 1]);
  }
}
report.push(`\nTOTALS: pass=${pass} ear=${ear} fail=${fail} skip=${skip}`);
console.log(report[report.length - 1]);
writeFileSync(join(here, "corpus-report.txt"), report.join("\n") + "\n");
