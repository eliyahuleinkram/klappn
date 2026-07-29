// ROOM DECAY — does the FDN actually decay in `roomsize` seconds?
//
// superdough's reverb is a generated IR whose amplitude is decayBase^n with
// decayBase = (1/1000)^(1/(decayTime·sr)) — i.e. EXACTLY −60 dB at roomsize
// seconds. zaltz's FDN sets each line's feedback to 10^(−3·lineSeconds/T60),
// which is the same law per line — but the network also loses energy in the
// input diffusion allpasses, the in-loop damping one-pole and the modulated
// reads, so the REALISED decay is shorter than the nominal one. Measured, that
// was ~1.6s for a nominal 2s: the room died early and the product sounded drier
// and shorter than strudel.cc ("it just feels like it sustains a little more
// on superdough").
//
// This measures the realised broadband T60 by Schroeder backward integration
// and asserts it lands within tolerance of the nominal roomsize.
import { readFileSync } from "node:fs";

const SR = 48000, BLOCK = 128;
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));

async function renderTail(roomsize) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(SR);
  // 20ms broadband burst (a 1-frame click dies inside the sampler's attack)
  const NF = 960;
  const ptr = ex.sd_sample_alloc(0, NF, 1);
  const pcm = new Float32Array(ex.memory.buffer, ptr, NF);
  let seed = 123456789 >>> 0;
  for (let i = 0; i < NF; i++) {
    seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0;
    pcm[i] = (seed / 4294967296) * 2 - 1;
  }
  const enc = new TextEncoder();
  const kv = `time/0/s/sample/sample/0/gain/1/orbit/2/room/1/roomsize/${roomsize}/roomlp/15000/duration/0.05`;
  const p = ex.sd_event_ptr();
  const b = enc.encode(kv + "\0");
  new Uint8Array(ex.memory.buffer, p, b.length).set(b);
  if (ex.sd_event() !== 0) throw new Error("event rejected");
  const seconds = roomsize * 2 + 1;
  const total = Math.floor((seconds * SR) / BLOCK);
  const out = new Float32Array(total * BLOCK);
  for (let i = 0; i < total; i++) {
    ex.sd_dsp();
    const o = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), BLOCK * 2);
    for (let j = 0; j < BLOCK; j++) out[i * BLOCK + j] = o[j * 2];
  }
  return out;
}

/** Schroeder EDC → T60 from the −5…−25 dB stretch (×3). */
function t60(x, startSec = 0.15) {
  const start = Math.floor(startSec * SR);
  let total = 0;
  const edc = new Float64Array(x.length - start);
  for (let i = x.length - 1; i >= start; i--) { total += x[i] * x[i]; edc[i - start] = total; }
  const e0 = edc[0] || 1e-20;
  let iA = -1, iB = -1;
  for (let i = 0; i < edc.length; i++) {
    const db = 10 * Math.log10(edc[i] / e0 + 1e-20);
    if (iA < 0 && db <= -5) iA = i;
    if (iB < 0 && db <= -25) { iB = i; break; }
  }
  if (iA < 0 || iB < 0 || iB <= iA) return NaN;
  return 3 * ((iB - iA) / SR);
}

let bad = 0;
console.log("roomsize  nominal T60   realised T60   error");
for (const size of [1, 2, 4, 8]) {
  const measured = t60(await renderTail(size));
  const err = (measured - size) / size;
  const ok = Math.abs(err) <= 0.12; // within 12% — inaudible against a convolver
  if (!ok) bad++;
  console.log(
    `${String(size).padStart(6)}  ${String(size).padStart(9)}s  ${measured.toFixed(2).padStart(11)}s  ` +
      `${(err * 100 >= 0 ? "+" : "") + (err * 100).toFixed(1)}%  ${ok ? "ok" : "TOO " + (err < 0 ? "SHORT" : "LONG")}`,
  );
}
console.log(bad === 0 ? "PASS room decay matches roomsize" : `FAIL ${bad} roomsize(s) off`);
process.exit(bad === 0 ? 0 : 1);
