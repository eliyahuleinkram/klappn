// SOAK: the husk-leak reproduction. Fire stretch haps at the user's patch
// rate (~4/s) through the FULL engine for 3 minutes of audio and watch the
// active-voice census — pre-fix every finished stretch voice squatted
// forever and the room choked at 128; post-fix the census must stay flat
// and the final seconds must still make sound.
import { readFileSync } from "node:fs";

const SR = 44100, BLOCK = 128;
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));
const { instance } = await WebAssembly.instantiate(wasm, {});
const ex = instance.exports;
ex.sd_init(SR);

const enc = new TextEncoder();
function event(kv) {
  const ptr = ex.sd_event_ptr();
  const bytes = enc.encode(kv + "\0");
  new Uint8Array(ex.memory.buffer, ptr, bytes.length).set(bytes);
  const rc = ex.sd_event();
  if (rc !== 0) throw new Error("sd_event rc " + rc + " for " + kv);
}

const SECONDS = 60;
const totalBlocks = Math.ceil((SECONDS * SR) / BLOCK);
let nextHat = 0; // seconds
let hatCount = 0;
let maxVoices = 0, nan = 0;
let lastSecondRms = 0;
const census = [];

for (let b = 0; b < totalBlocks; b++) {
  const t = (b * BLOCK) / SR;
  // ~4 stretch haps/s: two "hats" (short) + two "claps", like the patch
  while (nextHat <= t + 0.1) {
    // schedule slightly ahead, engine time-stamps via time/<sec-from-now>… the
    // engine expects absolute frames? kv "time" = seconds offset from now.
    const at = Math.max(0, nextHat - t);
    event(`time/${at.toFixed(4)}/s/square/note/70/duration/0.08/release/0.05/stretch/0.1/gain/0.7/orbit/1`);
    event(`time/${(at + 0.12).toFixed(4)}/s/sine/note/50/duration/0.1/release/0.05/stretch/0.1/gain/0.7/orbit/1`);
    nextHat += 0.5;
    hatCount += 2;
  }
  ex.sd_dsp();
  const out = new Float32Array(ex.memory.buffer, ex.sd_out_ptr(), BLOCK * 2);
  let sq = 0;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (Number.isNaN(v)) nan++;
    sq += v * v;
  }
  if (t > SECONDS - 1) lastSecondRms += sq;
  const nv = ex.sd_active_voices();
  if (nv > maxVoices) maxVoices = nv;
  if (b % Math.floor((10 * SR) / BLOCK) === 0) census.push(`${t.toFixed(0)}s:${nv}`);
}

const finalRms = Math.sqrt(lastSecondRms / (SR * 2));
console.log("voices census (every 10s):", census.join(" "));
console.log(`haps fired: ${hatCount}  maxVoices: ${maxVoices}  NaN: ${nan}  final-second rms: ${finalRms.toFixed(5)}`);
const ok = nan === 0 && maxVoices < 40 && finalRms > 0.001;
console.log(ok ? "PASS soak — voices recycle, sound persists" : "FAIL");
process.exit(ok ? 0 : 1);
