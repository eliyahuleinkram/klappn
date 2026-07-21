// CLICK HUNT (zaltz-only): the Halo-pad recipe through the wasm, outlier
// click-scan on the output. Matrix isolates room / lpenv / loop.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const wasm = readFileSync(join(here, "..", "zaltz.wasm"));
const sr = 48000;

// gm zones for the two pads' chords
function zones(name, midis) {
  execFileSync(process.execPath, [join(here, "gm-zones.mjs")], {
    env: { ...process.env, GM_NAME: name, GM_MIDIS: midis.join(",") }, maxBuffer: 1 << 24 });
  const meta = JSON.parse(
    execFileSync(process.execPath, [join(here, "gm-zones.mjs")], {
      env: { ...process.env, GM_NAME: name, GM_MIDIS: midis.join(",") }, maxBuffer: 1 << 24,
    }).toString().trim().split("\n").pop(),
  );
  const bin = readFileSync("/tmp/klt/gmzones.bin");
  return meta.map((m) => ({ ...m, bin, }));
}

async function render(events, uploads, seconds) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(sr);
  uploads.forEach((z, id) => {
    const ptr = ex.sd_sample_alloc(id, z.frames, z.channels);
    if (!ptr) throw new Error("alloc failed");
    const src = new Float32Array(z.bin.buffer, z.bin.byteOffset + z.off * 4, z.frames * z.channels);
    new Float32Array(ex.memory.buffer, ptr, z.frames * z.channels).set(src);
  });
  const mem = new Uint8Array(ex.memory.buffer);
  for (const ev of events) {
    const str = Object.entries(ev).map(([k, v]) => `${k}/${v}`).join("/") + "\0";
    const b = new TextEncoder().encode(str);
    mem.set(b, ex.sd_event_ptr());
    const rc = ex.sd_event();
    if (rc !== 0) throw new Error("rc " + rc);
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

function scanClicks(L, label) {
  const dd = new Float32Array(L.length);
  for (let i = 1; i < L.length; i++) dd[i] = Math.abs(L[i] - L[i - 1]);
  const win = Math.round(sr * 0.02);
  const found = [];
  for (let i = win; i < L.length - win; i++) {
    if (dd[i] < 0.01) continue;
    const seg = [];
    for (let k = i - win; k < i + win; k += 7) if (k !== i) seg.push(dd[k]);
    seg.sort((a, b) => a - b);
    const med = seg[Math.floor(seg.length / 2)] || 1e-6;
    if (dd[i] / Math.max(med, 1e-5) > 8) found.push({ t: i / sr, d: dd[i] });
  }
  const top = [];
  for (const f of found.sort((a, b) => b.d - a.d)) {
    if (top.some((m) => Math.abs(m.t - f.t) < 0.03)) continue;
    top.push(f);
    if (top.length >= 6) break;
  }
  top.sort((a, b) => a.t - b.t);
  let rms = 0; for (let i = 0; i < L.length; i++) rms += L[i] * L[i];
  rms = Math.sqrt(rms / L.length);
  console.log(`${label}: rms=${rms.toFixed(4)} clicks=${found.length}${top.length ? " @ " + top.map((m) => m.t.toFixed(2)).join(", ") : ""}`);
  return found.length;
}

const warm = zones("gm_pad_warm", [52, 59, 64, 67]); // e3 b3 e4 g4
const bar = 3.5294;
const mk = (opts) => {
  const evs = [];
  for (let barN = 0; barN < 2; barN++) {
    warm.forEach((z, id) => {
      const e = {
        time: (barN * bar).toFixed(4), s: "sample", sample: id, speed: z.rate,
        duration: bar, attack: 0.9, decay: 0.6, sustain: 0.75, release: 1.4,
        gain: 0.15, orbit: 1,
      };
      if (opts.loop && z.loop) { e.loop = 1; e.loopBegin = z.loopBegin; e.loopEnd = z.loopEnd; }
      if (opts.room) { e.room = 0.65; e.roomsize = 7; }
      if (opts.lpenv) { e.lpf = 1300; e.lpenv = 0.4; e.lpdecay = 0.5; }
      evs.push(e);
    });
  }
  return evs;
};
for (const [label, opts] of [
  ["full (loop+room+lpenv)", { loop: 1, room: 1, lpenv: 1 }],
  ["no-room", { loop: 1, lpenv: 1 }],
  ["no-lpenv", { loop: 1, room: 1 }],
  ["no-loop", { room: 1, lpenv: 1 }],
  ["bare", { loop: 1 }],
]) {
  const L = await render(mk(opts), warm, 2 * bar + 2);
  const n = scanClicks(L, label);
  if (label === "bare" && n) {
    const at = Math.round(0.81 * sr);
    console.log("[zoom @0.81] " + [...L.slice(at - 10, at + 10)].map((v) => v.toFixed(4)).join(" "));
  }
}
// A/B the bare pad against SUPERDOUGH (same scan) — is the grit the font's own?
process.env.CODE = 'setcpm(68/4)\n$: note("[e3,b3,e4,g4]").s("gm_pad_warm").attack(.9).decay(.6).sustain(.75).release(1.4).gain(.6)';
process.env.CYCLES = "2";
execFileSync(process.execPath, [join(here, "sd-gm.mjs")], { env: process.env, maxBuffer: 1 << 24 });
const binA = readFileSync("/tmp/klt/sdgm.bin");
const A = new Float32Array(binA.buffer, binA.byteOffset, binA.length / 4);
scanClicks(A, "superdough bare (reference)");

process.exit(0);
