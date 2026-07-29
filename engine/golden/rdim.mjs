// ROOMDIM calibration harness v2 — band-limited Schroeder EDC decay fits
// (the single-bin DFT estimator saturated on the noise floor and lied).
import { readFileSync } from "node:fs";

const SR = 48000, BLOCK = 128;
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));

async function renderIR(extraKv) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(SR);
  const NF = 960;
  const ptr = ex.sd_sample_alloc(0, NF, 1);
  const pcm = new Float32Array(ex.memory.buffer, ptr, NF);
  let seed = 123456789 >>> 0;
  for (let i = 0; i < NF; i++) {
    seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0;
    pcm[i] = (seed / 4294967296) * 2 - 1;
  }
  const enc = new TextEncoder();
  const kv = `time/0/s/sample/sample/0/gain/1/orbit/2/room/1/roomsize/2${extraKv}/duration/0.05`;
  const p = ex.sd_event_ptr();
  const b = enc.encode(kv + "\0");
  new Uint8Array(ex.memory.buffer, p, b.length).set(b);
  if (ex.sd_event() !== 0) throw new Error("event rejected: " + kv);
  const total = Math.floor(3.0 * SR / BLOCK);
  const out = new Float32Array(total * BLOCK);
  for (let i = 0; i < total; i++) {
    ex.sd_dsp();
    const o = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), BLOCK * 2);
    for (let j = 0; j < BLOCK; j++) out[i * BLOCK + j] = o[j * 2];
  }
  return out;
}

// RBJ bandpass (constant peak gain), Q chosen narrow-ish
function bandpass(x, f0, Q = 2) {
  const w0 = (2 * Math.PI * f0) / SR, alpha = Math.sin(w0) / (2 * Q);
  const b0 = alpha, b1 = 0, b2 = -alpha;
  const a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const yy = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = yy; y[i] = yy;
  }
  return y;
}

// Schroeder EDC → T60 from the −5..−25 dB stretch
function t60(x, f0) {
  const b = bandpass(x, f0);
  const start = Math.floor(0.12 * SR); // past the dry burst
  let total = 0;
  const n = b.length;
  const edc = new Float64Array(n - start);
  for (let i = n - 1; i >= start; i--) { total += b[i] * b[i]; edc[i - start] = total; }
  const e0 = edc[0] || 1e-20;
  let iA = -1, iB = -1;
  for (let i = 0; i < edc.length; i++) {
    const db = 10 * Math.log10(edc[i] / e0 + 1e-20);
    if (iA < 0 && db <= -5) iA = i;
    if (iB < 0 && db <= -25) { iB = i; break; }
  }
  if (iA < 0 || iB < 0 || iB <= iA) return NaN;
  const dt = (iB - iA) / SR;
  return (60 / 20) * dt; // 20 dB span → ×3 for T60
}

const cases = [
  ["lp15k dim unset ", "/roomlp/15000"],
  ["lp15k dim 8000  ", "/roomlp/15000/roomdim/8000"],
  ["lp15k dim 1000  ", "/roomlp/15000/roomdim/1000"],
  ["lp15k dim 0.5   ", "/roomlp/15000/roomdim/0.5"],
  ["lp5000 (sanity) ", "/roomlp/5000"],
];
const lp = 15000;
for (const [name, kv] of cases) {
  const x = await renderIR(kv);
  const hi = t60(x, 5000), lo = t60(x, 500);
  const dim = /roomdim\/([\d.]+)/.exec(kv)?.[1];
  const ref = dim ? Math.min(1, (lp - 5000) / (lp - parseFloat(dim))) : null;
  console.log(`${name} T60@5k=${hi.toFixed(2)}s  T60@500=${lo.toFixed(2)}s  ratio=${(hi / lo).toFixed(2)}${ref != null ? `  (convolver ref ${ref.toFixed(2)})` : ""}`);
}
