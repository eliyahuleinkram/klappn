// GOLDEN GATE v0.1 — one synth note through BOTH engines, compared.
// superdough side runs via render-service in a CHILD PROCESS (its caches bind
// to one context per process); zaltz side runs in-process.
// NOTE: render-service left the tree with stem rendering — restore it from
// git history (see docs/wasm-engine.md, "The golden gate") to run the
// superdough reference side.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));

const CASES = [
  { name: "saw-adsr-lpf", code: `setcpm(240/4)\n$: note("a4").s("sawtooth").attack(.01).decay(.1).sustain(.5).release(.2).gain(.8).lpf(2000).pan(.5)`,
    ev: { note: 69, s: "sawtooth", duration: 1, attack: .01, decay: .1, sustain: .5, release: .2, gain: .8, lpf: 2000, pan: .5 } },
  { name: "saw-adsr-NOlpf", code: `setcpm(240/4)
$: note("a4").s("sawtooth").attack(.01).decay(.1).sustain(.5).release(.2).gain(.8).pan(.5)`,
    ev: { note: 69, s: "sawtooth", duration: 1, attack: .01, decay: .1, sustain: .5, release: .2, gain: .8, pan: .5 } },
  { name: "saw-lpf-NOadsr", code: `setcpm(240/4)
$: note("a4").s("sawtooth").gain(.8).lpf(2000).pan(.5)`,
    ev: { note: 69, s: "sawtooth", duration: 1, gain: .8, lpf: 2000, pan: .5 } },
  { name: "sine-defaults", code: `setcpm(240/4)\n$: note("c3").s("sine").gain(.6)`,
    ev: { note: 48, s: "sine", duration: 1, gain: .6 } },
  { name: "square-panned", code: `setcpm(240/4)\n$: note("e4").s("square").sustain(.3).release(.4).gain(.5).pan(.2)`,
    ev: { note: 64, s: "square", duration: 1, sustain: .3, release: .4, gain: .5, pan: .2 } },
  { name: "triangle-defaults", code: `setcpm(240/4)\n$: note("g3").s("triangle").gain(.7)`,
    ev: { note: 55, s: "triangle", duration: 1, gain: .7 } },
  { name: "saw-hpf", code: `setcpm(240/4)\n$: note("a3").s("sawtooth").hpf(500).sustain(.4).gain(.7)`,
    ev: { note: 57, s: "sawtooth", duration: 1, hpf: 500, sustain: .4, gain: .7 } },
  // ⚠ nwaa's supersaw worklet is NOT a faithful reference (measured 2026-07-14:
  // phase-COHERENT voices + missing 1/√unison — rms 0.250 vs 0.058 saw, fitting
  // coherent-no-adjust math within 9%; real browsers run the JS semantics we
  // implement: random phases, env max 0.3/√u). Gate on envelope SHAPE only;
  // level/brightness reported, final judge = the ear in a real browser.
  { name: "supersaw-corpus", code: `setcpm(240/4)\n$: note("e5").s("supersaw").detune(.25).attack(.12).release(1.1).gain(.5).lpf(1900).pan(.5)`,
    ev: { note: 76, s: "supersaw", duration: 1, detune: .25, attack: .12, release: 1.1, gain: .5, lpf: 1900, pan: .5 },
    nwaaUnreliable: true },
  // PATTERN-DRIVEN — haps queried from the real pattern engine (the bridge
  // prototype: string notes, chords, time offsets, alternation)
  { name: "chord-pattern", code: `setcpm(240/4)\n$: note("[e3,b3,e4]").s("sawtooth").attack(.05).release(.3).gain(.4)`, pattern: true, cycles: 1 },
  { name: "lpenv-sweep", code: `setcpm(240/4)\n$: note("a3").s("sawtooth").lpf(800).lpenv(2).lpd(.3).gain(.7)`,
    ev: { note: 57, s: "sawtooth", duration: 1, lpf: 800, lpenv: 2, lpdecay: .3, gain: .7 } },
  { name: "sine-vib", code: `setcpm(240/4)\n$: note("a4").s("sine").vib(5).vibmod(.5).gain(.6)`,
    ev: { note: 69, s: "sine", duration: 1, vib: 5, vibmod: .5, gain: .6 } },
  { name: "sample-808bd", code: `setcpm(240/4)\n$: s("RolandTR808_bd").gain(.8)`,
    sample: "RolandTR808_bd", ev: { s: "sample", sample: 0, duration: 0 /* slice, filled after decode */, gain: .8 } },
  { name: "delay-echo", code: `setcpm(240/4)\n$: note("a4").s("sawtooth").sustain(.2).release(.1).delay(.6).delaytime(.25).delayfeedback(.5).gain(.7)`,
    ev: { note: 69, s: "sawtooth", duration: 1, sustain: .2, release: .1, delay: .6, delaytime: .25, delayfeedback: .5, gain: .7 } },
  { name: "shape-drive", code: `setcpm(240/4)\n$: note("a3").s("sawtooth").shape(.6).sustain(.5).gain(.6)`,
    ev: { note: 57, s: "sawtooth", duration: 1, shape: .6, sustain: .5, gain: .6 } },
  { name: "room-wet", code: `setcpm(240/4)\n$: note("a4").s("sine").sustain(.8).release(.05).room(.8).roomsize(2).gain(.7)`,
    ev: { note: 69, s: "sine", duration: 1, sustain: .8, release: .05, room: .8, roomsize: 2, gain: .7 },
    roomFeature: true },
  { name: "duck-pump", code: `setcpm(240/4)
$: s("RolandTR808_bd").duck("2").duckdepth(.6).gain(.9)
$: note("a3").s("sawtooth").sustain(1).gain(.5).orbit(2)`,
    pattern: true, cycles: 2 },
  { name: "gm-pad-chord", code: `setcpm(240/4)\n$: note("[e3,b3,e4]").s("gm_pad_warm").attack(.9).release(1.4).gain(.5)`,
    gm: { s: "gm_pad_warm", midis: [52, 59, 64] },
    ev: { duration: 1, attack: .9, release: 1.4, gain: .5 } },
  // sawtooth on purpose: this case gates the PATTERN machinery (string notes,
  // time offsets, alternation) — supersaw has its own (nwaa-caveated) case
  { name: "melody-pattern", code: `setcpm(240/4)\n$: note("<[a3 e4] [c4 g4]>").s("sawtooth").attack(.02).release(.25).gain(.5).pan(.5)`, pattern: true, cycles: 2 },
];

// ---- mini-bridge: hap value → zaltz event (the real bridge's prototype) --
const NOTE_SEM = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function noteToMidi(n) {
  if (typeof n === "number") return n;
  const m = /^([a-g])([#bs]*)(-?\d+)$/.exec(String(n).toLowerCase());
  if (!m) throw new Error("bad note " + n);
  let sem = NOTE_SEM[m[1]];
  for (const acc of m[2]) sem += acc === "#" || acc === "s" ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + sem;
}
const HARNESS_SYNTHS = new Set(["sine", "sawtooth", "saw", "square", "triangle", "tri", "supersaw", "white", "pink", "brown", "crackle"]);
function hapToEvent(h, sampleMap) {
  const v = h.value;
  const ev = { time: h.begin, duration: h.duration };
  let s = v.s ?? "triangle";
  if (v.bank) s = `${v.bank}_${s}`;
  for (const k of ["attack", "decay", "sustain", "release", "gain", "velocity", "postgain", "pan",
    "unison", "spread", "detune", "orbit", "room", "roomlp", "delay", "delaytime", "delayfeedback",
    "shape", "shapevol", "duckonset", "duckattack", "duckdepth", "speed"]) if (v[k] != null) ev[k] = v[k];
  if (v.duck != null) ev.duck = String(v.duck);
  if (v.cutoff != null) ev.lpf = v.cutoff;
  if (v.lpf != null) ev.lpf = v.lpf;
  if (v.resonance != null) ev.lpq = v.resonance;
  if (v.hcutoff != null) ev.hpf = v.hcutoff;
  if (v.hpf != null) ev.hpf = v.hpf;
  if (v.size != null || v.roomsize != null) ev.roomsize = v.roomsize ?? v.size;
  if (HARNESS_SYNTHS.has(s)) {
    ev.s = s === "saw" ? "sawtooth" : s === "tri" ? "triangle" : s;
    if (v.freq != null) ev.freq = v.freq;
    else if (v.note != null) ev.note = noteToMidi(v.note);
  } else {
    const entry = sampleMap?.get(s);
    if (!entry) return null; // unknown sample in harness
    ev.s = "sample";
    ev.sample = entry.id;
    if (v.clip == null && v.loop == null && v.release == null)
      ev.duration = entry.duration / Math.abs(v.speed ?? 1);
  }
  return ev;
}

// ---- superdough reference (child process per case) ----
const sdChild = join(here, "_sd-child.mjs");
writeFileSync(sdChild, `
import { renderLoop } from "../../render-service/dist/engine.mjs";
const code = process.env.CODE;
const out = await renderLoop(code, { cycles: Number(process.env.CYCLES || 1), wrapTail: false, limiter: false, format: "float32", tailSec: 0.6 });
process.stdout.write(Buffer.from(out.audio));
process.exit(0);
`);

function decodeWavF32(buf) {
  const off = buf.indexOf(Buffer.from("data")) + 8;
  const n = Math.floor((buf.length - off) / 8);
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = buf.readFloatLE(off + i * 8);
  return L;
}

// ---- sample loading (real Dirt/808 audio via the app's own proxy) ----
import * as nwaa from "../../render-service/node_modules/node-web-audio-api/index.js";
const sampleCache = new Map();
async function fetchSamplePCM(name) {
  if (sampleCache.has(name)) return sampleCache.get(name);
  let url = null;
  for (const m of ["d0", "d1", "d2", "d3", "d4", "d5"]) {
    const map = await fetch(`https://klappn.com/api/snd/m/${m}.json`).then((r) => r.json()).catch(() => null);
    if (!map) continue;
    const base = typeof map._base === "string" ? map._base : "";
    const entry = map[name];
    if (entry) {
      const first = Array.isArray(entry) ? entry[0] : Object.values(entry).flat()[0];
      url = first.startsWith("http") ? first : base + first;
      if (url.startsWith("/")) url = "https://klappn.com" + url; // origin-relative proxy paths
      break;
    }
  }
  if (!url) throw new Error("sample not found in maps: " + name);
  const bytes = await fetch(url).then((r) => r.arrayBuffer());
  const ctx = new nwaa.OfflineAudioContext(2, 48000, 48000);
  const buf = await ctx.decodeAudioData(bytes.slice(0));
  const channels = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) channels.push(buf.getChannelData(c));
  const out = { channels, frames: buf.length, duration: buf.duration };
  sampleCache.set(name, out);
  return out;
}

// ---- gm zones via the vendored (crossfaded) loader — bundled child ----
async function fetchGmZones(name, midis) {
  const meta = JSON.parse(
    execFileSync(process.execPath, [join(here, "gm-zones.mjs")], {
      env: { ...process.env, GM_NAME: name, GM_MIDIS: midis.join(",") },
      maxBuffer: 1 << 24,
    }).toString().trim().split("\n").pop(),
  );
  const bin = readFileSync("/tmp/klt/gmzones.bin");
  return meta.map((m) => {
    const floats = new Float32Array(bin.buffer, bin.byteOffset + m.off * 4, m.frames * m.channels);
    const channels = [];
    for (let c = 0; c < m.channels; c++) {
      const ch = new Float32Array(m.frames);
      for (let i = 0; i < m.frames; i++) ch[i] = floats[i * m.channels + c];
      channels.push(ch);
    }
    return { ...m, channels };
  });
}

// ---- zaltz ----
const wasm = readFileSync(join(here, "..", "zaltz.wasm"));
async function renderZaltz(evs, seconds, sample) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(48000);
  const uploads = Array.isArray(sample) ? sample : sample ? [sample] : [];
  uploads.forEach((sm, id) => {
    const ch = sm.channels.length >= 2 ? 2 : 1;
    const ptr = ex.sd_sample_alloc(id, sm.frames, ch);
    if (!ptr) throw new Error("sample alloc failed");
    const dst = new Float32Array(ex.memory.buffer, ptr, sm.frames * ch);
    for (let i = 0; i < sm.frames; i++)
      for (let c = 0; c < ch; c++) dst[i * ch + c] = sm.channels[c][i];
  });
  for (const ev of Array.isArray(evs) ? evs : [evs]) {
    const s = Object.entries(ev).map(([k, v]) => `${k}/${v}`).join("/") + "\0";
    const bytes = new TextEncoder().encode(s);
    // fresh view per write: sd_sample_alloc memory.grow's, detaching old views
    new Uint8Array(ex.memory.buffer).set(bytes, ex.sd_event_ptr());
    const rc = ex.sd_event();
    if (rc !== 0) throw new Error("sd_event rc=" + rc);
  }
  const blocks = Math.ceil((seconds * 48000) / 128);
  const L = new Float32Array(blocks * 128);
  for (let b = 0; b < blocks; b++) {
    ex.sd_dsp();
    const out = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), 128 * 2);
    for (let i = 0; i < 128; i++) L[b * 128 + i] = out[i * 2];
  }
  return L;
}

// ---- metrics ----
const winMs = 10, sr = 48000, W = (sr * winMs) / 1000;
function envelope(L) {
  const out = [];
  for (let c = 0; c + W <= L.length; c += W) {
    let e = 0;
    for (let i = c; i < c + W; i++) e += L[i] * L[i];
    out.push(Math.sqrt(e / W));
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
    da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2;
  }
  return num / Math.max(Math.sqrt(da * db), 1e-12);
}
const rms = (L) => Math.sqrt(L.reduce((a, x) => a + x * x, 0) / L.length);
// ADAPTIVE hysteresis (2% of RMS): spiky content (highpassed saws) rings
// near zero constantly — a fixed tiny band counted hash as brightness.
const zc = (L) => {
  const th = Math.max(1e-4, 0.02 * rms(L));
  let z = 0, sign = 1;
  for (let i = 0; i < L.length; i++) {
    if (L[i] > th && sign < 0) { sign = 1; z++; }
    else if (L[i] < -th && sign > 0) { sign = -1; z++; }
  }
  return z / (L.length / sr);
};

let allPass = true;
for (const c of CASES) {
  let A;
  if (c.gm) {
    // gm reference: probe-recipe child (main-repo stack + vendored fonts —
    // render-service never registers soundfonts)
    execFileSync(process.execPath, [join(here, "sd-gm.mjs")], { env: { ...process.env, CODE: c.code, CYCLES: String(c.cycles ?? 1) }, maxBuffer: 1 << 24 });
    const bin = readFileSync("/tmp/klt/sdgm.bin");
    A = new Float32Array(bin.buffer, bin.byteOffset, bin.length / 4);
  } else {
    const sdWav = execFileSync(process.execPath, [sdChild], { env: { ...process.env, CODE: c.code, CYCLES: String(c.cycles ?? 1) }, maxBuffer: 1 << 28 });
    A = decodeWavF32(sdWav);
  }
  let evs = c.ev;
  let smp = null;
  if (c.sample) {
    smp = await fetchSamplePCM(c.sample);
    // duration = sliceDuration when clip/loop/release absent (sampler.mjs:314)
    evs = { ...c.ev, duration: smp.duration };
  }
  if (c.gm) {
    const zones = await fetchGmZones(c.gm.s, c.gm.midis);
    smp = zones;
    evs = zones.map((z, id) => ({
      ...c.ev,
      s: "sample",
      sample: id,
      speed: z.rate,
      ...(z.loop ? { loop: 1, loopBegin: z.loopBegin, loopEnd: z.loopEnd } : {}),
      gain: 0.3 * (c.ev.gain ?? 1), // fontloader env max 0.3
    }));
  }
  if (c.pattern) {
    const dumpRaw = execFileSync(process.execPath, [join(here, "hap-dump.mjs")], { env: { ...process.env, CODE: c.code, CYCLES: String(c.cycles ?? 1) }, maxBuffer: 1 << 24 })
      .toString().trim().split("\n").pop(); // strudel banner precedes the JSON
    const dump = JSON.parse(dumpRaw);
    // prefetch any sample sounds the pattern uses
    const names = new Set();
    for (const h of dump.haps) {
      let sName = h.value.s ?? "triangle";
      if (h.value.bank) sName = `${h.value.bank}_${sName}`;
      if (!HARNESS_SYNTHS.has(sName) && !String(sName).startsWith("gm_")) names.add(sName);
    }
    const sampleMap = new Map();
    const uploads = [];
    for (const nm of names) {
      const pcm = await fetchSamplePCM(nm);
      sampleMap.set(nm, { id: uploads.length, duration: pcm.duration });
      uploads.push(pcm);
    }
    if (uploads.length) smp = uploads;
    evs = dump.haps.map((h) => hapToEvent(h, sampleMap)).filter(Boolean);
  }
  const B = await renderZaltz(evs, A.length / sr, smp);
  const n = Math.min(A.length, B.length);
  const eA = envelope(A.subarray(0, n)), eB = envelope(B.subarray(0, n));
  let cr = corr(eA, eB);
  let bestLag = 0;
  for (let lag = -4; lag <= 4; lag++) {
    const a2 = lag >= 0 ? eA.slice(lag) : eA.slice(0, eA.length + lag);
    const b2 = lag >= 0 ? eB.slice(0, eB.length - lag) : eB.slice(-lag);
    const c2 = corr(a2, b2);
    if (c2 > cr) { cr = c2; bestLag = lag; }
  }
  if (bestLag !== 0) console.log(`   best alignment: zaltz ${bestLag > 0 ? "lags" : "leads"} by ${Math.abs(bestLag) * 10}ms (corr there ${cr.toFixed(4)})`);
  const lvl = 20 * Math.log10(rms(B.subarray(0, n)) / Math.max(rms(A.subarray(0, n)), 1e-9));
  const zcA = zc(A.subarray(0, n)), zcB = zc(B.subarray(0, n));
  // BRIGHTNESS = spectral tilt via first-difference energy ratio — robust for
  // filtered content (zero-crossing counts flip on which harmonic dominates
  // near zero; rms(diff)/rms measures actual HF weight)
  const tilt = (L) => {
    let ed = 0, e = 0;
    for (let i = 1; i < L.length; i++) { const d = L[i] - L[i - 1]; ed += d * d; e += L[i] * L[i]; }
    return Math.sqrt(ed / Math.max(e, 1e-12));
  };
  const tA = tilt(A.subarray(0, n)), tB = tilt(B.subarray(0, n));
  const br = Math.abs(tB - tA) / Math.max(tA, 1e-6);
  console.log(`   zcA(superdough)=${zcA.toFixed(0)}/s zcB(zaltz)=${zcB.toFixed(0)}/s`);
  const dbg = `rmsA=${rms(A.subarray(0,n)).toFixed(4)} rmsB=${rms(B.subarray(0,n)).toFixed(4)} zcA=${zcA.toFixed(0)} zcB=${zcB.toFixed(0)}`;
  let pass;
  if (c.roomFeature) {
    // nwaa's convolver carries a 31Hz block artifact — corr is meaningless
    // there. Gate on FEATURES: overall wet level ±3dB and a real tail
    // (energy at 1.2-1.6s after the note, > −40dB rel. the loud region).
    const seg = (L, a, b) => {
      const x = L.subarray(Math.floor(a * sr), Math.min(Math.floor(b * sr), L.length));
      if (!x.length) return 1e-9;
      let e = 0;
      for (let i = 0; i < x.length; i++) e += x[i] * x[i];
      return Math.sqrt(e / x.length);
    };
    const tailA = 20 * Math.log10(seg(A, 1.2, 1.6) / Math.max(seg(A, 0.2, 0.8), 1e-9));
    const tailB = 20 * Math.log10(seg(B, 1.2, 1.6) / Math.max(seg(B, 0.2, 0.8), 1e-9));
    pass = Math.abs(lvl) < 3.0 && tailB > -40 && Math.abs(tailA - tailB) < 9;
    console.log(`   room tails: sd=${tailA.toFixed(1)}dB ours=${tailB.toFixed(1)}dB (rel. body)`);
  } else if (c.nwaaUnreliable) {
    pass = cr > 0.95;
  } else {
    pass = cr > 0.97 && Math.abs(lvl) < 1.0 && br < 0.05;
  }
  allPass = allPass && pass;
  console.log(`${pass ? "✓" : "✗"} ${c.name}: env-corr=${cr.toFixed(4)} level=${lvl.toFixed(2)}dB brightness-drift=${(br * 100).toFixed(1)}% [${dbg}]`);
}
console.log(allPass ? "GOLDEN GATE ✓ (corr>0.97, |level|<1dB, brightness<5%)" : "GOLDEN GATE ✗");
process.exit(allPass ? 0 : 1);
