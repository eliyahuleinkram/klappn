// GOLDEN: C phase vocoder (pv_test_* exports) vs the JS phaze reference
// (superdough worklets.mjs PhaseVocoderProcessor + ola-processor.js + fft.js),
// run headless on the same deterministic input, compared block by block.
import { readFileSync } from "node:fs";
import FFT from "superdough/fft.js";

const HOP = 128, N = 2048, OVER = N / HOP;
const TWO_PI = 2 * Math.PI;
const ffloor = Math.floor;
const fround = (x) => ffloor(x + 0.5);
const fceil = (x) => ffloor(x + 1);

// ---- JS reference: phaze, single channel, headless OLA ----
class RefPV {
  constructor() {
    this.timeCursor = 0;
    this.fft = new FFT(N);
    this.freq = this.fft.createComplexArray();
    this.freqShifted = this.fft.createComplexArray();
    this.timeC = this.fft.createComplexArray();
    this.mags = new Float32Array(N / 2 + 1);
    this.peaks = new Int32Array(this.mags.length);
    this.nbPeaks = 0;
    this.hann = new Float32Array(N);
    for (let i = 0; i < N; i++) this.hann[i] = 0.5 * (1 - Math.cos((TWO_PI * i) / N));
    this.inBuf = new Float32Array(N + HOP); // ola input ring
    this.outBuf = new Float32Array(N);      // ola accumulator
    this.toSend = new Float32Array(N);
    this.retr = new Float32Array(N);
  }
  hop(input128, out128, stretch) {
    // ola-processor: readInputs → shift → prepare → processOLA → accumulate → write → shift
    this.inBuf.set(input128, N);
    this.inBuf.copyWithin(0, HOP);
    this.toSend.set(this.inBuf.subarray(0, N));
    this.processOLA(this.toSend, this.retr, stretch);
    for (let k = 0; k < N; k++) this.outBuf[k] += this.retr[k] / OVER;
    out128.set(this.outBuf.subarray(0, HOP));
    this.outBuf.copyWithin(0, HOP);
    this.outBuf.subarray(N - HOP).fill(0);
  }
  processOLA(input, output, stretch) {
    let pitchFactor = stretch;
    if (pitchFactor < 0) pitchFactor = pitchFactor * 0.25;
    pitchFactor = Math.max(0, pitchFactor + 1);
    this.applyHann(input);
    this.fft.realTransform(this.freq, input);
    this.computeMagnitudes();
    this.findPeaks();
    this.shiftPeaks(pitchFactor);
    this.fft.completeSpectrum(this.freqShifted);
    this.fft.inverseTransform(this.timeC, this.freqShifted);
    this.fft.fromComplexArray(this.timeC, output);
    this.applyHann(output);
    this.timeCursor += HOP;
  }
  applyHann(b) { for (let i = 0; i < N; i++) b[i] *= this.hann[i] * 1.62; }
  computeMagnitudes() {
    let i = 0, j = 0;
    while (i < this.mags.length) {
      const re = this.freq[j], im = this.freq[j + 1];
      this.mags[i] = re ** 2 + im ** 2;
      i += 1; j += 2;
    }
  }
  findPeaks() {
    this.nbPeaks = 0;
    let i = 2;
    const end = this.mags.length - 2;
    while (i < end) {
      const m = this.mags[i];
      if (this.mags[i - 1] >= m || this.mags[i - 2] >= m) { i++; continue; }
      if (this.mags[i + 1] >= m || this.mags[i + 2] >= m) { i++; continue; }
      this.peaks[this.nbPeaks] = i; this.nbPeaks++; i += 2;
    }
  }
  shiftPeaks(pitchFactor) {
    this.freqShifted.fill(0);
    for (let i = 0; i < this.nbPeaks; i++) {
      const peakIndex = this.peaks[i];
      const peakIndexShifted = fround(peakIndex * pitchFactor);
      if (peakIndexShifted > this.mags.length) break;
      let startIndex = 0, endIndex = N;
      if (i > 0) startIndex = peakIndex - fround((peakIndex - this.peaks[i - 1]) / 2);
      if (i < this.nbPeaks - 1) endIndex = peakIndex + fceil((this.peaks[i + 1] - peakIndex) / 2);
      const startOffset = startIndex - peakIndex, endOffset = endIndex - peakIndex;
      const omegaDelta = TWO_PI * (1 / N) * (peakIndexShifted - peakIndex);
      const psr = Math.cos(omegaDelta * this.timeCursor);
      const psi = Math.sin(omegaDelta * this.timeCursor);
      for (let j = startOffset; j < endOffset; j++) {
        const binIndex = peakIndex + j;
        const binIndexShifted = peakIndexShifted + j;
        if (binIndexShifted >= this.mags.length) break;
        const ir = 2 * binIndex, ii = ir + 1;
        const vr = this.freq[ir] ?? 0, vi = this.freq[ii] ?? 0;
        const sr = vr * psr - vi * psi;
        const si = vr * psi + vi * psr;
        const isr = 2 * binIndexShifted, isi = isr + 1;
        this.freqShifted[isr] += sr;
        this.freqShifted[isi] += si;
      }
    }
  }
}

// ---- C side ----
const wasm = readFileSync(new URL("../zaltz.wasm", import.meta.url));
const { instance } = await WebAssembly.instantiate(wasm, {});
const ex = instance.exports;
ex.sd_init(44100);
ex.pv_test_reset();
const ioPtr = ex.pv_test_io();
const mem = () => new Float32Array(ex.memory.buffer, ioPtr, 256);

// ---- drive both with the same signal: two sines + a click train + noise ----
function sig(n) {
  // deterministic (no Math.random): xorshift
  let s = 123456789 >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s / 4294967296) * 2 - 1; };
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = 0.5 * Math.sin((TWO_PI * 440 * i) / 44100) + 0.25 * Math.sin((TWO_PI * 977 * i) / 44100) + 0.05 * rnd();
    if (i % 5000 === 0) x[i] += 0.8;
  }
  return Math.fround ? x : x;
}

const BLOCKS = 200;
const STRETCH = 0.1; // the patch's value
const x = sig(BLOCKS * HOP);
const ref = new RefPV();
const refOut = new Float32Array(BLOCKS * HOP);
const cOut = new Float32Array(BLOCKS * HOP);
const tmpO = new Float32Array(HOP);
for (let b = 0; b < BLOCKS; b++) {
  const inBlk = x.subarray(b * HOP, (b + 1) * HOP);
  ref.hop(inBlk, tmpO, STRETCH);
  refOut.set(tmpO, b * HOP);
  const io = mem();
  io.set(inBlk, 0);
  io.set(inBlk, 128); // stereo: same signal both channels
  ex.pv_test_block(STRETCH);
  const io2 = mem();
  cOut.set(io2.subarray(0, HOP), b * HOP);
  // also check L == R (identical inputs must give identical outputs)
  for (let i = 0; i < HOP; i++) {
    if (io2[i] !== io2[128 + i]) { console.log("FAIL stereo mismatch at block", b, i); process.exit(1); }
  }
}

let maxAbs = 0, sumSq = 0, refSq = 0, nan = 0;
for (let i = 0; i < refOut.length; i++) {
  const d = Math.abs(refOut[i] - cOut[i]);
  if (Number.isNaN(cOut[i])) nan++;
  if (d > maxAbs) maxAbs = d;
  sumSq += d * d; refSq += refOut[i] * refOut[i];
}
const relRms = Math.sqrt(sumSq / (refSq || 1));
const refRms = Math.sqrt(refSq / refOut.length);
console.log(`ref rms=${refRms.toFixed(5)} maxAbsDiff=${maxAbs.toExponential(3)} relRMS=${relRms.toExponential(3)} NaN=${nan}`);
const ok = nan === 0 && relRms < 5e-3 && refRms > 0.01;
console.log(ok ? "PASS phase vocoder matches phaze reference" : "FAIL");
process.exit(ok ? 0 : 1);
