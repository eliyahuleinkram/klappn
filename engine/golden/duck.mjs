// THE SIDECHAIN — does a ducked orbit follow superdough's curve?
//
// superdough (superdoughoutput.mjs Orbit.duck): the orbit's OUTPUT gain is
// ramped to clamp(1 − √depth, 0.01, current) over `onset`, then exponentially
// back to 1 over `attack` (min 0.002). With the default depth 1 that is a dip
// to 0.01 — a near-mute — and the recovery is the whole audible shape.
//
// This renders a steady tone on a ducked orbit, fires one duck, and reports
// the realised gain envelope against that curve.
import { readFileSync } from "node:fs";

const SR = 48000, BLOCK = 128;
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));
const enc = new TextEncoder();

const { instance } = await WebAssembly.instantiate(wasm, {});
const ex = instance.exports;
ex.sd_init(SR);

function event(kv) {
  const p = ex.sd_event_ptr();
  const b = enc.encode(kv + "\0");
  new Uint8Array(ex.memory.buffer, p, b.length).set(b);
  const rc = ex.sd_event();
  if (rc !== 0) throw new Error("sd_event rc " + rc + " :: " + kv);
}

const ATTACK = 0.2, DEPTH = 1;
// a long steady tone on orbit 2 — the thing being ducked
event(`time/0/s/sine/freq/440/gain/0.8/duration/3/attack/0.001/sustain/1/release/0.01/orbit/2`);
// the kick that ducks it, 1s in (well after the tone is steady)
event(`time/1/s/sine/freq/60/gain/0.9/duration/0.1/orbit/1/duck/2/duckattack/${ATTACK}/duckdepth/${DEPTH}`);

const total = Math.floor((2.2 * SR) / BLOCK);
const out = new Float32Array(total * BLOCK);
for (let i = 0; i < total; i++) {
  ex.sd_dsp();
  const o = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), BLOCK * 2);
  for (let j = 0; j < BLOCK; j++) out[i * BLOCK + j] = o[j * 2];
}

// BAND-LIMIT TO THE TONE FIRST. The kick is 60Hz and rings for 100ms — on a
// raw peak reading it simply drowns the thing being measured, which made the
// first version of this harness report a duck that "faded in" over 100ms when
// it was really the kick decaying. Measure 440Hz only.
const bp = (f0, Q) => {
  const w0 = (2 * Math.PI * f0) / SR, al = Math.sin(w0) / (2 * Q);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * Math.cos(w0), a2 = 1 - al;
  const y = new Float32Array(out.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < out.length; i++) {
    const yy = (b0 * out[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = out[i]; y2 = y1; y1 = yy; y[i] = yy;
  }
  return y;
};
const tone = bp(440, 8);
const W = 240; // 5ms
const env = [];
for (let o = 0; o + W < tone.length; o += W) {
  let pk = 0;
  for (let i = 0; i < W; i++) pk = Math.max(pk, Math.abs(tone[o + i]));
  env.push(pk);
}
const at = (sec) => env[Math.floor((sec * SR) / W)] ?? 0;
const base = at(0.8); // steady, pre-duck
const g = (sec) => (base > 1e-6 ? at(sec) / base : 0);

// superdough's curve: dip to 0.01 at t=1, exponential back to 1 by t=1+attack
const want = (dt) => (dt <= 0 ? 1 : dt >= ATTACK ? 1 : 0.01 * Math.pow(1 / 0.01, dt / ATTACK));

console.log("t-after-kick   realised   superdough   ratio");
let worst = 0;
for (const dt of [0.005, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3]) {
  // measured a touch late so the 60Hz kick body is gone from the peak reading
  const got = g(1 + dt);
  const exp = want(dt);
  const ratio = exp > 1e-6 ? got / exp : 0;
  if (dt >= 0.02 && dt <= 0.2) worst = Math.max(worst, Math.abs(20 * Math.log10(Math.max(ratio, 1e-6))));
  console.log(
    `${String(dt).padEnd(13)} ${got.toFixed(3).padStart(8)} ${exp.toFixed(3).padStart(12)} ${ratio.toFixed(2).padStart(8)}`,
  );
}
// WHAT IS ACTUALLY MEASURABLE HERE. The dip is instantaneous, but a Q=8
// bandpass rings for ~6ms and the window is 5ms, so the first two readings
// cannot resolve it — they are filter tails, not engine behaviour. Assert on
// the stretch where the measurement is honest: the tone is deeply ducked
// shortly after the kick, the CLIMB tracks superdough's exponential, and the
// bus is back by the end of `duckattack`.
const ducked = g(1.03);
const recovered = g(1 + ATTACK);
let shape = 0;
for (const dt of [0.05, 0.1, 0.15]) {
  const r = g(1 + dt) / want(dt);
  shape = Math.max(shape, Math.abs(20 * Math.log10(Math.max(r, 1e-6))));
}
console.log(`\nducked 30ms after the kick: ${ducked.toFixed(3)} (superdough ≈ 0.013)`);
console.log(`recovered by ${ATTACK}s:        ${recovered.toFixed(3)} (superdough: 1.000)`);
console.log(`worst climb deviation:      ${shape.toFixed(1)} dB`);
const ok = ducked < 0.25 && recovered > 0.8 && shape < 6;
console.log(
  ok
    ? "PASS duck dips and CLIMBS BACK like superdough"
    : `FAIL ducked=${ducked.toFixed(3)} recovered=${recovered.toFixed(3)} shape=${shape.toFixed(1)}dB`,
);
process.exit(ok ? 0 : 1);
