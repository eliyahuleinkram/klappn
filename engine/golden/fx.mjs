import { readFileSync } from "node:fs";
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));
const SR = 48000;

async function render(evs, seconds) {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports;
  ex.sd_init(SR);
  for (const ev of evs) {
    const s = Object.entries(ev).map(([k, v]) => `${k}/${v}`).join("/") + "\0";
    const bytes = new TextEncoder().encode(s);
    new Uint8Array(ex.memory.buffer).set(bytes, ex.sd_event_ptr());
    const rc = ex.sd_event();
    if (rc !== 0) throw new Error("sd_event rc=" + rc);
  }
  const blocks = Math.ceil((seconds * SR) / 128);
  const L = new Float32Array(blocks * 128);
  for (let b = 0; b < blocks; b++) {
    ex.sd_dsp();
    const out = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), 128 * 2);
    for (let i = 0; i < 128; i++) L[b * 128 + i] = out[i * 2];
  }
  return L;
}
const rms = (L, a = 0, b = L.length) => {
  let e = 0; for (let i = a; i < b; i++) e += L[i] * L[i];
  return Math.sqrt(e / (b - a));
};
const hasNaN = (L) => { for (const x of L) if (Number.isNaN(x)) return true; return false; };
const peak = (L) => { let p = 0; for (const x of L) { const a = Math.abs(x); if (a > p) p = a; } return p; };
// zero-crossing estimate of frequency in a window
const zcr = (L, a, b) => {
  let c = 0; for (let i = a + 1; i < b; i++) if ((L[i - 1] < 0) !== (L[i] < 0)) c++;
  return (c / 2) / ((b - a) / SR);
};

const base = { note: 69, s: "sine", duration: 1.0, sustain: 1, gain: 0.6, time: 0 };
let fail = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) fail++;
};

// 1. regression: plain sine untouched by the new fields
{
  const L = await render([base], 1.2);
  check("plain sine renders", !hasNaN(L) && rms(L) > 0.1, `rms=${rms(L).toFixed(3)}`);
}
// 2. every distortion algorithm: renders, differs from clean, bounded, NaN-free
{
  const clean = await render([{ ...base, s: "sawtooth" }], 1.0);
  const algos = ["scurve","soft","hard","cubic","diode","asym","fold","sinefold","chebyshev"];
  for (const a of algos) {
    const L = await render([{ ...base, s: "sawtooth", distort: 2.9, distortvol: 0.2, distorttype: a }], 1.0);
    let diff = 0; for (let i = 0; i < clean.length; i++) diff += Math.abs(L[i] - clean[i]);
    check(`distort:${a}`, !hasNaN(L) && rms(L) > 0.001 && diff / clean.length > 1e-4 && peak(L) < 2.0,
      `rms=${rms(L).toFixed(3)} peak=${peak(L).toFixed(2)}`);
  }
  // postgain clamp direction: distortvol .2 must be much quieter than 1
  const loud = await render([{ ...base, s: "sawtooth", distort: 2.9, distortvol: 1, distorttype: "diode" }], 1.0);
  const quiet = await render([{ ...base, s: "sawtooth", distort: 2.9, distortvol: 0.2, distorttype: "diode" }], 1.0);
  check("distortvol scales", rms(quiet) < rms(loud) * 0.4, `${rms(quiet).toFixed(3)} vs ${rms(loud).toFixed(3)}`);
}
// 3. tremolo: depth 1, 4 Hz → envelope dips ~4×/s; without → flat
{
  const L = await render([{ ...base, tremolo: 4, tremolodepth: 1 }], 1.0);
  check("tremolo NaN-free", !hasNaN(L));
  // 10ms RMS envelope; count minima under 30% of max
  const W = 480, env = [];
  for (let c = 0; c + W <= L.length; c += W) env.push(rms(L, c, c + W));
  const mx = Math.max(...env);
  let dips = 0, inDip = false;
  for (const e of env.slice(5)) { // skip attack
    if (e < 0.3 * mx && !inDip) { dips++; inDip = true; }
    if (e > 0.5 * mx) inDip = false;
  }
  check("tremolo modulates ~4x/s", dips >= 3 && dips <= 5, `dips=${dips}`);
}
// 4. penv: 12 semitones, attack .5, anchor 1 (default sustain) → starts an
//    octave low, rises to the note (min=-1200c → 0c)
{
  const L = await render([{ ...base, penv: 12, pattack: 0.5, pdecay: 0.001 }], 1.2);
  const early = zcr(L, Math.floor(0.02 * SR), Math.floor(0.12 * SR));
  const late = zcr(L, Math.floor(0.7 * SR), Math.floor(0.9 * SR));
  check("penv pitch rises", !hasNaN(L) && late > early * 1.5, `early=${early.toFixed(0)}Hz late=${late.toFixed(0)}Hz`);
  check("penv lands on the note", Math.abs(late - 440) < 25, `late=${late.toFixed(0)}Hz (target 440)`);
}
process.exit(fail ? 1 : 0);
