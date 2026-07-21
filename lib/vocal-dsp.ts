/**
 * vocal-dsp: clean, pitch-correct and time-align a sung take recorded over a
 * backing track. Pure math on Float32Array — no DOM, no WebAudio, no imports —
 * so it runs on the main thread or in a Worker. Inputs are never mutated;
 * every pass returns a new buffer. Positions are in samples unless noted.
 */

// ---------------------------------------------------------------------------
// shared helpers

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Median of the first `len` entries of `scratch`. Sorts that prefix in place. */
function medianInPlace(scratch: Float32Array, len: number): number {
  if (len <= 0) return 0;
  const s = scratch.subarray(0, len);
  s.sort(); // TypedArray sort is numeric
  const mid = len >> 1;
  return len % 2 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
}

/** Symmetric Hann (half-sample offset — no dead zero endpoints). */
function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
  return w;
}

/**
 * Iterative radix-2 complex FFT, cached twiddles + bit-reversal. Correctness
 * over speed; the per-call transform allocates nothing so it can sit inside a
 * frame loop.
 */
class Fft {
  readonly n: number;
  private readonly rev: Uint32Array;
  private readonly cosT: Float32Array;
  private readonly sinT: Float32Array;

  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error("fft size must be a power of 2");
    this.n = n;
    this.rev = new Uint32Array(n);
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
      this.rev[i] = r;
    }
    this.cosT = new Float32Array(n / 2);
    this.sinT = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      this.cosT[k] = Math.cos((-2 * Math.PI * k) / n);
      this.sinT[k] = Math.sin((-2 * Math.PI * k) / n);
    }
  }

  /** In-place transform; inverse includes the 1/n scale. */
  transform(re: Float32Array, im: Float32Array, inverse: boolean): void {
    const { n, rev, cosT, sinT } = this;
    for (let i = 0; i < n; i++) {
      const r = rev[i];
      if (r > i) {
        const tr = re[i]; re[i] = re[r]; re[r] = tr;
        const ti = im[i]; im[i] = im[r]; im[r] = ti;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const stride = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += stride) {
          const c = cosT[k];
          const s = inverse ? -sinT[k] : sinT[k];
          const a = i + j;
          const b = a + half;
          const tr = re[b] * c - im[b] * s;
          const ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    if (inverse) {
      const inv = 1 / n;
      for (let i = 0; i < n; i++) {
        re[i] *= inv;
        im[i] *= inv;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 1. high-pass

/**
 * 2nd-order RBJ cookbook high-pass (Q = 1/√2), default 80 Hz — kills rumble
 * and plosive thumps. Single forward pass: this is cleanup, not mastering, so
 * phase linearity doesn't matter.
 */
export function highpass(x: Float32Array, sampleRate: number, cutoffHz = 80): Float32Array {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cw = Math.cos(w0);
  const alpha = Math.sin(w0) / Math.SQRT2; // sin(w0) / (2Q), Q = 1/√2
  const a0 = 1 + alpha;
  const b0 = (1 + cw) / 2 / a0;
  const b1 = -(1 + cw) / a0;
  const b2 = b0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let z1 = 0;
  let z2 = 0; // direct form II transposed
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = b0 * v + z1;
    z1 = b1 * v - a1 * o + z2;
    z2 = b2 * v - a2 * o;
    y[i] = o;
  }
  return y;
}

// ---------------------------------------------------------------------------
// 2. MMSE-LSA denoise (Ephraim–Malah)

/**
 * MMSE log-spectral-amplitude enhancer (Ephraim & Malah 1985) — replaces the
 * old spectral subtraction. STFT 1024/256 Hann analysis+synthesis with
 * envelope-normalized overlap-add; the voice's phase is kept untouched.
 *
 *   noise PSD    — IMCRA-lite: minima-controlled recursive averaging. A
 *                  smoothed periodogram's running MINIMUM over ~1.5 s windows
 *                  (sub-window minima, so the tracker turns over) marks where
 *                  speech is absent; a per-bin speech-presence probability
 *                  gates the recursive noise update, and a rise clamp
 *                  (~4 dB/s) keeps a held note from ever being absorbed into
 *                  the noise floor. Offline luxury: the floor is SEEDED from
 *                  the first window's minima, so the head of the take is
 *                  estimated as well as the tail.
 *   a-priori SNR — decision-directed (α = 0.98): ξ = α·A²ₚᵣₑᵥ/λ +
 *                  (1−α)·max(γ−1, 0) — the classic musical-noise killer.
 *   gain         — LSA: G = ξ/(1+ξ) · exp(½·E₁(v)), v = ξγ/(1+ξ), floored by
 *                  the Clean knob: strength .5 → −12 dB, 1 → −22 dB (never
 *                  below — the room gets QUIETER, the voice never gated).
 *                  strength 0 is a true bypass (the pipeline already skips
 *                  below 0.01; this function returns a copy regardless).
 *   smoothing    — gains one-pole smoothed ~30 ms across frames and averaged
 *                  over ±2 bins across frequency: isolated time-frequency
 *                  cells can't flicker, which is where musical noise lives.
 *
 * VOICE FULLY RETAINED BY CONSTRUCTION: in voiced bins ξ is huge, G ≈ 1 and
 * the signal passes bit-faithfully up to the window round-trip; only bins the
 * noise tracker has EARNED (minima + presence gate) are pulled toward the
 * floor. The music-bleed story is the reference canceller's job — this stage
 * handles the room/noise residual.
 */
export function denoise(x: Float32Array, sampleRate: number, strength: number): Float32Array {
  const N = 1024;
  const HOP = 256;
  const BINS = N / 2 + 1;
  const len = x.length;
  if (len === 0) return new Float32Array(0);
  const st = clamp01(strength);
  if (st < 0.01) return new Float32Array(x); // bypass — nothing asked for

  // Gain floor from the Clean knob, piecewise-linear in dB through the
  // calibrated points: 0 → 0 dB (bypass), 0.5 → −12 dB, 1 → −22 dB.
  const floorDb = st <= 0.5 ? -24 * st : -12 - 20 * (st - 0.5);
  const gFloor = Math.pow(10, floorDb / 20);

  const hopSec = HOP / sampleRate;
  const ALPHA_DD = 0.98; // decision-directed a-priori SNR
  const AS = 0.85; // periodogram smoothing (IMCRA αs)
  const AD = 0.95; // noise recursion base (≈ 110 ms when speech is absent)
  const AP = 0.6; // speech-presence probability smoothing
  const BMIN = 1.66; // minimum-statistics bias compensation
  const DELTA_SP = 5; // speech-presence threshold on P/Pmin
  const RISE = Math.pow(10, (4 * hopSec) / 10); // slow-rise fallback ≤ 4 dB/s
  const CEIL = 3; // λ may jump freely up to CEIL·BMIN·Pmin (noise evidence)
  const XI_MIN = Math.pow(10, -25 / 10);
  // ~1.5 s minima window as U sub-windows of V frames.
  const U = 8;
  const V = Math.max(4, Math.round(1.5 / hopSec / U));
  // Gain time-smoothing at ~30 ms — on the RELEASE only (falling gain =
  // voice trailing off into noise; smoothing there is what kills gate
  // flutter). The ATTACK is fast (~3 ms): a rising gain is a voice ONSET,
  // and a slow attack shaves every burst's first syllable into an audible
  // dip (measured as seam events on the bench). Musical noise — isolated
  // upward flickers in noise-only bins — is already suppressed by the
  // decision-directed ξ (the Ephraim–Malah property), so the fast attack
  // doesn't reopen that door.
  const SM_DN = 1 - Math.exp(-hopSec / 0.03);
  const SM_UP = 1 - Math.exp(-hopSec / 0.003);

  const win = hannWindow(N);
  const fft = new Fft(N);
  const t0 = -(N - HOP); // sample 0 gets full window coverage
  const nFrames = Math.floor((len - 1 - t0) / HOP) + 1;

  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const loadFrame = (t: number): void => {
    for (let j = 0; j < N; j++) {
      const i = t + j;
      re[j] = i >= 0 && i < len ? x[i] * win[j] : 0;
      im[j] = 0;
    }
  };

  // --- pass 1: smoothed periodogram P(k,f) — the minima tracker's food, and
  // the seed for the noise floor (min over the FIRST window, per bin).
  // The leading EDGE frames (t < 0) are mostly zero-padding: their "energy"
  // is an artifact of the window sliding in, and letting them into the
  // minimum statistics seeds a near-zero floor that locks λ down for the
  // whole first minima window (measured: the first second of a take came
  // back essentially un-denoised). They're excluded everywhere below, and
  // the smoothing recursion restarts at the first interior frame so their
  // low values don't bleed forward.
  const EDGE = Math.ceil((N - HOP) / HOP);
  const P = new Float32Array(nFrames * BINS);
  for (let f = 0; f < nFrames; f++) {
    loadFrame(t0 + f * HOP);
    fft.transform(re, im, false);
    const o = f * BINS;
    const po = o - BINS;
    for (let k = 0; k < BINS; k++) {
      const per = re[k] * re[k] + im[k] * im[k];
      P[o + k] = f <= EDGE ? per : AS * P[po + k] + (1 - AS) * per;
    }
  }

  // --- pass 2: noise tracking + LSA gains + overlap-add, fused per frame.
  const acc = new Float32Array(len);
  const norm = new Float32Array(len);
  const lambda = new Float32Array(BINS); // noise PSD estimate
  const phat = new Float32Array(BINS); // speech-presence probability
  const aPrev = new Float32Array(BINS); // A² of the previous frame's estimate
  const gains = new Float32Array(BINS).fill(1); // time-smoothed state
  const gApply = new Float32Array(BINS);
  // sub-window minima ring per bin: ring[u*BINS + k]
  const ring = new Float32Array(U * BINS).fill(Infinity);
  const cur = new Float32Array(BINS).fill(Infinity);
  let ringHead = 0;

  // Seed λ from the first ~1.5 s window's per-bin minimum (bias-compensated,
  // interior frames only): even a take that starts mid-phrase gets a sane
  // floor at frame 0.
  {
    const seedFrames = Math.min(nFrames, EDGE + U * V);
    for (let k = 0; k < BINS; k++) {
      let mn = Infinity;
      for (let f = EDGE; f < seedFrames; f++) mn = Math.min(mn, P[f * BINS + k]);
      lambda[k] = Number.isFinite(mn) ? Math.max(1e-12, BMIN * mn) : 1e-12;
    }
  }

  // E₁(v), the exponential integral — Abramowitz & Stegun 5.1.53 / 5.1.56.
  const expint = (v: number): number => {
    if (v <= 0) return 0;
    if (v < 1) {
      return (
        -Math.log(v) -
        0.57721566 +
        v * (0.99999193 + v * (-0.24991055 + v * (0.05519968 + v * (-0.00976004 + v * 0.00107857))))
      );
    }
    if (v > 30) return 0; // exp(−30)/30 — nothing left
    const num = v * v + 2.334733 * v + 0.250621;
    const den = v * v + 3.330657 * v + 1.681534;
    return (Math.exp(-v) / v) * (num / den);
  };

  // --- pass 2: per-frame gains for the WHOLE take (no synthesis yet — the
  // application pass below reads one frame AHEAD, an offline lookahead a
  // real-time enhancer can't have).
  const G = new Float32Array(nFrames * BINS);
  for (let f = 0; f < nFrames; f++) {
    loadFrame(t0 + f * HOP);
    fft.transform(re, im, false);
    const o = f * BINS;
    for (let k = 0; k < BINS; k++) {
      const per = re[k] * re[k] + im[k] * im[k];
      const ps = P[o + k];
      // minima tracking: current sub-window min + the U ring entries
      // (edge frames stay out — see the EDGE note above)
      if (f >= EDGE && ps < cur[k]) cur[k] = ps;
      let pmin = cur[k];
      for (let u = 0; u < U; u++) {
        const r = ring[u * BINS + k];
        if (r < pmin) pmin = r;
      }
      // speech presence: the smoothed periodogram stands clear of the
      // (bias-compensated) minimum → a voice is on in this bin
      const present = ps > DELTA_SP * BMIN * Math.max(1e-12, pmin) ? 1 : 0;
      phat[k] = AP * phat[k] + (1 - AP) * present;
      // minima-controlled recursive averaging, presence-gated + rise-limited.
      // The rise limit must not BIAS the estimate (an up-clamped, down-free
      // recursion sinks toward the noise's low percentiles and under-cleans):
      // λ may move freely below CEIL·BMIN·Pmin — a level the minima tracker
      // itself vouches for as noise — and only rises ABOVE that ceiling are
      // held to ~4 dB/s, which is what keeps a held note (whose energy the
      // minima do NOT vouch for) from being absorbed into the floor.
      const ad = AD + (1 - AD) * phat[k];
      let lam = ad * lambda[k] + (1 - ad) * per;
      const cap = Math.max(lambda[k] * RISE, CEIL * BMIN * pmin);
      if (lam > cap) lam = cap;
      lambda[k] = Math.max(1e-12, lam);

      // decision-directed a-priori SNR → LSA gain
      const gamma = per / lambda[k];
      let xi = ALPHA_DD * (aPrev[k] / lambda[k]) + (1 - ALPHA_DD) * Math.max(gamma - 1, 0);
      if (xi < XI_MIN) xi = XI_MIN;
      const v = (xi / (1 + xi)) * gamma;
      const g = (xi / (1 + xi)) * Math.exp(0.5 * expint(v));
      aPrev[k] = g * g * per; // A² for the next frame's ξ
      // floor, then the asymmetric one-pole across frames (fast attack,
      // ~30 ms release — see SM_UP/SM_DN above)
      const gf = g > gFloor ? (g > 1 ? 1 : g) : gFloor;
      gains[k] += (gf > gains[k] ? SM_UP : SM_DN) * (gf - gains[k]);
    }
    // rotate the sub-window ring every V frames
    if ((f + 1) % V === 0) {
      ring.set(cur, ringHead * BINS);
      ringHead = (ringHead + 1) % U;
      cur.fill(Infinity);
    }
    // ±2-bin frequency smoothing — no isolated flickering cells
    for (let k = 0; k < BINS; k++) {
      let s = 0;
      let n = 0;
      for (let d = -2; d <= 2; d++) {
        const kk = k + d;
        if (kk < 0 || kk >= BINS) continue;
        s += gains[kk];
        n++;
      }
      G[o + k] = s / n;
    }
  }

  // --- pass 3: apply and overlap-add. Each frame wears max(G[f], G[f+1]) —
  // a one-hop (~6 ms) LOOKAHEAD: a voice onset OPENS the gain in the frame
  // just before it, so the attack can never shave the first syllable into a
  // dip (the last measured seam source; a causal enhancer can't do this —
  // offline, it's free). Cost: noise regains ~1 dB in the silent spans (max
  // over two smoothed, correlated gains), well inside the reduction gate.
  for (let f = 0; f < nFrames; f++) {
    const t = t0 + f * HOP;
    loadFrame(t);
    fft.transform(re, im, false);
    const o = f * BINS;
    const o1 = f + 1 < nFrames ? o + BINS : o;
    for (let k = 0; k < BINS; k++) gApply[k] = Math.max(G[o + k], G[o1 + k]);
    for (let k = 0; k < N; k++) {
      const bin = k < BINS ? k : N - k; // conjugate-symmetric — output stays real
      re[k] *= gApply[bin];
      im[k] *= gApply[bin];
    }
    fft.transform(re, im, true);
    for (let j = 0; j < N; j++) {
      const i = t + j;
      if (i < 0 || i >= len) continue;
      acc[i] += re[j] * win[j];
      norm[i] += win[j] * win[j];
    }
  }
  const y = new Float32Array(len);
  for (let i = 0; i < len; i++) y[i] = norm[i] > 1e-6 ? acc[i] / norm[i] : x[i];
  return y;
}

// ---------------------------------------------------------------------------
// 2b. reference echo cancellation (the song bleeding into the mic)
//
// The take is recorded RAW (no browser AEC — its half-duplex gating is the
// "underwater" voice) while a second recorder captures the engine's own
// output. Given both, the music in the mic is a linearly-filtered, delayed
// copy of a signal we KNOW exactly — the textbook acoustic-echo-cancellation
// setup, minus the real-time constraint. Offline we can afford a convergence
// pass, so even the first second of the take comes out clean.

/** FFT cross-correlation argmax: the m ∈ [0, maxLag] maximizing
 *  c[m] = Σₚ a[p+m]·b[p] over the first `win` samples of each. */
function xcorrArgmax(
  a: Float32Array,
  b: Float32Array,
  win: number,
  maxLag: number,
): number {
  let N = 1;
  while (N < win + maxLag) N <<= 1;
  const fft = new Fft(N);
  const aRe = new Float32Array(N);
  const aIm = new Float32Array(N);
  const bRe = new Float32Array(N);
  const bIm = new Float32Array(N);
  aRe.set(a.subarray(0, win));
  bRe.set(b.subarray(0, win));
  fft.transform(aRe, aIm, false);
  fft.transform(bRe, bIm, false);
  // c = IFFT(FFT(a) · conj(FFT(b))): c[m] = Σₚ a[p+m]·b[p], which peaks at
  // m = d when a ≈ b delayed by d.
  for (let k = 0; k < N; k++) {
    const re = aRe[k] * bRe[k] + aIm[k] * bIm[k];
    const im = aIm[k] * bRe[k] - aRe[k] * bIm[k];
    aRe[k] = re;
    aIm[k] = im;
  }
  fft.transform(aRe, aIm, true);
  let best = 0;
  let bestV = -Infinity;
  for (let m = 0; m <= maxLag; m++) {
    if (aRe[m] > bestV) {
      bestV = aRe[m];
      best = m;
    }
  }
  return best;
}

/**
 * Speaker→mic delay: argmax of the cross-correlation between up to
 * `windowSec` of mic and reference, searched over lag ∈ [0, maxLagMs].
 * 1500 ms default reach — Bluetooth speakers sit anywhere from 200 to
 * 600+ ms of output latency, and the old 500 ms window silently missed
 * them (a misaligned reference converges to junk → no cancellation).
 * Two stages keep the wider search cheap: a coarse FFT xcorr on ~8 kHz
 * box-decimated copies finds the neighbourhood, then a direct full-rate
 * pass refines within ± one decimation step. Returns the lag in samples
 * (0 when the signals don't correlate at all — the adaptive filter's
 * leading taps then just do the aligning).
 */
export function estimateDelay(
  mic: Float32Array,
  ref: Float32Array,
  sampleRate: number,
  maxLagMs = 1500,
  windowSec = 4,
): number {
  const win = Math.min(mic.length, ref.length, Math.round(windowSec * sampleRate));
  const maxLag = Math.min(win - 1, Math.round((maxLagMs / 1000) * sampleRate));
  if (win < 1024 || maxLag <= 0) return 0;
  // Coarse: box-average decimate to ~8 kHz (the argmax rides envelope-scale
  // structure, so a crude anti-alias is plenty) and search the full range.
  const D = Math.max(1, Math.floor(sampleRate / 8000));
  if (D === 1) return xcorrArgmax(mic, ref, win, maxLag);
  const decimate = (x: Float32Array): Float32Array => {
    const n = Math.floor(win / D);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const o = i * D;
      for (let j = 0; j < D; j++) s += x[o + j];
      out[i] = s / D;
    }
    return out;
  };
  const dWin = Math.floor(win / D);
  const dLag = Math.min(dWin - 1, Math.ceil(maxLag / D));
  if (dWin < 256 || dLag <= 0) return xcorrArgmax(mic, ref, win, maxLag);
  const coarse = xcorrArgmax(decimate(mic), decimate(ref), dWin, dLag) * D;
  // Refine at full rate: direct dot products over coarse ± 2 decimation steps.
  const lo = Math.max(0, coarse - 2 * D);
  const hi = Math.min(maxLag, coarse + 2 * D);
  let best = coarse;
  let bestV = -Infinity;
  for (let m = lo; m <= hi; m++) {
    let s = 0;
    const end = win - m;
    for (let p = 0; p < end; p++) s += mic[p + m] * ref[p];
    if (s > bestV) {
      bestV = s;
      best = m;
    }
  }
  return best;
}

/**
 * Reference echo cancellation: subtract the (delayed, speaker/room-filtered)
 * playback `ref` from the mic signal `x`. Both at `sampleRate`.
 *
 * 1. Cross-correlation delay estimate (above); the reference is shifted so
 *    the echo path starts near tap 0, minus one block of guard for estimate
 *    error.
 * 2. Partitioned-block frequency-domain NLMS (PBFDAF, overlap-save):
 *    FFT N = 2048, block/hop B = 1024, P = 16 partitions → 16·1024 = 16384
 *    taps ≈ 370 ms echo tail at 44.1 kHz. Per block m and bin k:
 *      echo estimate  Ŷ[k]   = Σₚ Wₚ[k] · X[m−p][k]
 *      error          e      = mic block − last B of IFFT(Ŷ)
 *      NLMS update    Wₚ[k] += μ · conj(X[m−p][k]) · E[k] / (Σₚ|X[m−p][k]|² + δ)
 *    with E = FFT([0…0, e]), μ = 0.5, δ = regularization tied to the mean
 *    reference power (the standard unconstrained PBFDAF / multidelay filter
 *    update — Soo & Pang 1990). Offline luxury: a first pass only ADAPTS;
 *    the second pass adapts again from the converged weights and writes the
 *    output, so the head of the take is as clean as the tail.
 * 3. A gentle Wiener post-filter keyed on the PREDICTED echo spectrum eats
 *    the nonlinear residual (speaker distortion the linear filter can't
 *    model): per STFT bin, gain = |E|²/(|E|² + 4·|Ŷ|²) floored at 0.316
 *    (suppression capped at 10 dB; spec floor 0.3 — the cap binds first),
 *    so it can never hollow the voice out the way blind suppression does.
 *
 * NEVER CHOPPIER THAN THE INPUT — three guards:
 *  - Reference near-silence (headphones: nothing to cancel) → the mic comes
 *    back UNTOUCHED, sample for sample.
 *  - Wiener gains are one-pole smoothed over time (~50 ms), so gain flutter
 *    can't chop syllables; when the frame's predicted-echo coherence is low
 *    (the prediction isn't trustworthy — e.g. voice dominates, or the filter
 *    lost the path) the gain floor rises from 0.316 to 0.5.
 *  - The output BLENDS back toward the raw mic when the linear canceller
 *    didn't earn its keep (β = the take-wide regression of mic on predicted
 *    echo): a diverged filter (clock drift, moved mic) degrades to "music
 *    still audible", never to a mangled voice.
 *
 * `statsOut`, when given, is filled for observability: whether cancellation
 * ran, how much overall energy it removed (dB), the estimated speaker→mic
 * delay (ms) and the trust blend β — exactly the numbers needed to diagnose
 * a field take that came back with the music still in it.
 */
export function cancelEchoReference(
  x: Float32Array,
  ref: Float32Array,
  sampleRate: number,
  statsOut?: {
    applied: boolean;
    attenuationDb: number;
    beta?: number;
    delayMs?: number;
  },
): Float32Array {
  if (statsOut) {
    statsOut.applied = false;
    statsOut.attenuationDb = 0;
    statsOut.beta = 0;
    statsOut.delayMs = 0;
  }
  const n = x.length;
  if (n === 0 || ref.length === 0) return new Float32Array(x);

  // Headphones (or a muted mix): the reference is silence — there is no echo
  // to cancel, and running the machinery anyway can only add artifacts.
  {
    let s = 0;
    for (let i = 0; i < ref.length; i++) s += ref[i] * ref[i];
    if (Math.sqrt(s / ref.length) < 1e-4) return new Float32Array(x);
  }
  const B = 1024; // block / hop
  const N = 2048; // FFT size (2 blocks, overlap-save)
  const P = 16; // partitions → P·B taps ≈ 370 ms at 44.1 kHz
  const MU = 0.5;

  // --- align: shift ref so the echo path lands in the filter's early taps,
  // one block early as guard against estimate error (the filter absorbs it).
  const dEst = estimateDelay(x, ref, sampleRate);
  if (statsOut) statsOut.delayMs = Math.round((dEst / sampleRate) * 1000);
  const d = Math.max(0, dEst - B);
  const r = new Float32Array(n);
  for (let i = d; i < n; i++) {
    const j = i - d;
    if (j < ref.length) r[i] = ref[j];
  }

  const nBlocks = Math.ceil(n / B);
  const fft = new Fft(N);

  // Reference block spectra X[m] (FFT of [prev block, this block]) — computed
  // once, reused by both passes. Two Float32Arrays per block; ~350 KB per
  // minute of take at 44.1 kHz — fine for a worker.
  const xRe: Float32Array[] = new Array(nBlocks);
  const xIm: Float32Array[] = new Array(nBlocks);
  let refPower = 0;
  {
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let m = 0; m < nBlocks; m++) {
      re.fill(0);
      im.fill(0);
      const t0 = (m - 1) * B;
      for (let j = 0; j < N; j++) {
        const i = t0 + j;
        if (i >= 0 && i < n) re[j] = r[i];
      }
      fft.transform(re, im, false);
      xRe[m] = re.slice();
      xIm[m] = im.slice();
      for (let k = 0; k < N; k++) refPower += re[k] * re[k] + im[k] * im[k];
    }
    refPower /= nBlocks * N;
  }
  const DELTA = Math.max(1e-6, 1e-3 * refPower);

  // Filter weights per partition (frequency domain).
  const wRe: Float32Array[] = [];
  const wIm: Float32Array[] = [];
  for (let p = 0; p < P; p++) {
    wRe.push(new Float32Array(N));
    wIm.push(new Float32Array(N));
  }

  const yRe = new Float32Array(N);
  const yIm = new Float32Array(N);
  const eRe = new Float32Array(N);
  const eIm = new Float32Array(N);
  const pow = new Float32Array(N);
  const e = new Float32Array(n); // error signal (mic − predicted echo)
  const yhat = new Float32Array(n); // predicted echo (Wiener key)

  // Median mic block energy — the crude-VAD baseline for the pass-1
  // double-talk gate below (quiet blocks are echo-only or silence: always
  // safe to adapt on, which is how a cold filter bootstraps even when the
  // singer starts on beat one).
  let medMicE = 0;
  {
    const blockE = new Float32Array(nBlocks);
    for (let m = 0; m < nBlocks; m++) {
      const t = m * B;
      const end = Math.min(n, t + B);
      let s = 0;
      for (let i = t; i < end; i++) s += x[i] * x[i];
      blockE[m] = s;
    }
    medMicE = medianInPlace(blockE, nBlocks);
  }

  const runPass = (write: boolean): void => {
    // Step size per pass. Pass 1 adapts hard (μ 0.5) to converge from zero —
    // its ŷ is junk during voice bursts (NLMS chases the singer as "error"),
    // but nothing is written. Pass 2 starts CONVERGED, so it only needs to
    // track slow path movement: a small μ barely reacts to voice bursts
    // (10× less junk injected into ŷ under every phrase — measured: at μ 0.5
    // the pass-2 ŷ carried ~2× the echo's energy in voice-chasing garbage),
    // while a few-hundred-ppm clock drift (fractions of a sample per block)
    // still tracks with time constants well under a second.
    const mu = write ? 0.08 : MU;
    for (let m = 0; m < nBlocks; m++) {
      // Ŷ = Σₚ Wₚ · X[m−p]; Σ|X|² for the normalized step size.
      yRe.fill(0);
      yIm.fill(0);
      pow.fill(0);
      for (let p = 0; p < P; p++) {
        const mb = m - p;
        if (mb < 0) break;
        const xr = xRe[mb];
        const xi = xIm[mb];
        const wr = wRe[p];
        const wi = wIm[p];
        for (let k = 0; k < N; k++) {
          yRe[k] += wr[k] * xr[k] - wi[k] * xi[k];
          yIm[k] += wr[k] * xi[k] + wi[k] * xr[k];
          pow[k] += xr[k] * xr[k] + xi[k] * xi[k];
        }
      }
      eRe.set(yRe);
      eIm.set(yIm);
      fft.transform(eRe, eIm, true); // time-domain Ŷ; last B samples are valid
      const t = m * B;
      const valid = Math.min(B, n - t);
      let micE = 0;
      let yhatE = 0;
      for (let j = 0; j < valid; j++) {
        const i = t + j;
        const yv = eRe[B + j];
        const ev = x[i] - yv;
        micE += x[i] * x[i];
        yhatE += yv * yv;
        if (write) {
          e[i] = ev;
          yhat[i] = yv;
        }
        eRe[B + j] = ev; // reuse eRe as the zero-padded error block
      }
      // DOUBLE-TALK GATE (pass 1 only). Pass 1's job is to converge on the
      // ECHO PATH, but at μ 0.5 every voice burst reads as error and yanks
      // the weights toward "predict the singer" — measured as junk in ŷ under
      // every phrase and, on takes that are mostly singing, a filter that
      // never converges at all. Crude VAD: skip the update on blocks whose
      // mic energy dwarfs the predicted echo (>12 dB over ŷ — the singer is
      // on) UNLESS the block is quiet overall (≤ the take's median block
      // energy: echo-only or silence, always safe — this is how a cold filter
      // with ŷ ≈ 0 bootstraps). Pass 2 stays ungated: it starts converged and
      // its small μ (0.08) barely reacts to voice.
      if (!write && micE > 16 * yhatE && micE > medMicE) continue;
      eRe.fill(0, 0, B); // E = FFT([0…0, e block]) — leading zeros
      eRe.fill(0, B + Math.max(0, valid)); // stale IFFT tail past the signal end
      eIm.fill(0);
      fft.transform(eRe, eIm, false); // E[k]
      // NLMS update: Wₚ += μ · conj(X[m−p]) · E / (Σ|X|² + δ)
      for (let p = 0; p < P; p++) {
        const mb = m - p;
        if (mb < 0) break;
        const xr = xRe[mb];
        const xi = xIm[mb];
        const wr = wRe[p];
        const wi = wIm[p];
        for (let k = 0; k < N; k++) {
          const g = mu / (pow[k] + DELTA);
          // conj(X)·E = (xr − i·xi)(er + i·ei)
          wr[k] += g * (xr[k] * eRe[k] + xi[k] * eIm[k]);
          wi[k] += g * (xr[k] * eIm[k] - xi[k] * eRe[k]);
        }
      }
    }
  };
  runPass(false); // convergence pass — adapt only
  runPass(true); // production pass — adapt from converged weights, write out

  // Global cancellation trust β: the regression coefficient of the mic on
  // the predicted echo, b = Σx·ŷ / Σŷ². When ŷ really is a component of x,
  // b ≈ 1 no matter how loud the voice is (voice is uncorrelated with ŷ over
  // a whole take); when the filter diverged into junk, b ≈ 0. The output
  // blends toward the RAW mic by 1−β below — a lost filter degrades to
  // "music still audible", never to a fluttering, mangled voice. (A per-frame
  // trust was measurably WORSE: voice-heavy frames read as "untrusted" and
  // re-added predicted echo under every phrase.)
  let bXY = 0;
  let bYY = 0;
  for (let i = 0; i < n; i++) {
    bXY += x[i] * yhat[i];
    bYY += yhat[i] * yhat[i];
  }
  const bReg = bYY > 1e-12 ? bXY / bYY : 0;
  const beta = Math.max(0, Math.min(1, (bReg - 0.25) / 0.5));
  const dry = 1 - beta;
  if (statsOut) statsOut.beta = beta;

  // --- Wiener post-filter on the residual, keyed on the PREDICTED echo.
  // STFT 2048/512 Hann; gain floored at 10^(-10/20) ≈ 0.316 — at most 10 dB
  // of suppression, so the voice is never gated, only the residual dimmed.
  //
  // ANTI-CHOP: the raw per-bin Wiener gain flickers frame to frame wherever
  // the echo estimate is shaky, and flickering gain IS the chop. So (1) every
  // bin's gain runs through a one-pole (~50 ms) across frames; (2) the gain
  // floor rises to 0.5 on frames whose predicted echo is incoherent with the
  // mic (untrustworthy prediction — suppress gently or not at all); and
  // (3) every frame's output blends toward the RAW MIC (X = E + Ŷ, free — no
  // extra FFT) by 1−β, the take-wide trust computed above. A converged filter
  // earns β ≈ 1 and full cancellation; a diverged one decays to the untouched
  // mic instead of a fluttering residual.
  const HOP = 512;
  const G_FLOOR = 0.316;
  const G_FLOOR_LO = 0.5; // floor when the echo prediction isn't trustworthy
  const OVER = 4; // echo-spectrum overestimate (nonlinear residual headroom)
  // One-pole coefficient for a ~50 ms time constant at the STFT hop rate.
  const SMOOTH = 1 - Math.exp(-HOP / (0.05 * sampleRate));
  const win = hannWindow(N);
  const acc = new Float32Array(n);
  const norm = new Float32Array(n);
  const fRe = new Float32Array(N);
  const fIm = new Float32Array(N);
  const gRe = new Float32Array(N);
  const gIm = new Float32Array(N);
  const t0 = -(N - HOP);
  const nFrames = Math.floor((n - 1 - t0) / HOP) + 1;
  const BINS = N / 2 + 1;
  const gains = new Float32Array(BINS).fill(1); // smoothed state, carried across frames
  for (let f = 0; f < nFrames; f++) {
    const t = t0 + f * HOP;
    for (let j = 0; j < N; j++) {
      const i = t + j;
      const inside = i >= 0 && i < n;
      fRe[j] = inside ? e[i] * win[j] : 0;
      fIm[j] = 0;
      gRe[j] = inside ? yhat[i] * win[j] : 0;
      gIm[j] = 0;
    }
    fft.transform(fRe, fIm, false);
    fft.transform(gRe, gIm, false);
    // Per-frame coherence between the mic spectrum X = E + Ŷ (free — no
    // extra FFT) and the predicted echo Ŷ: does the mic actually contain
    // what we predicted, RIGHT NOW? Voice-dominated frames read low — which
    // is exactly when suppression should tread lightly.
    let xyRe = 0;
    let xyIm = 0;
    let xx = 0;
    let yy = 0;
    for (let k = 0; k < BINS; k++) {
      const xr = fRe[k] + gRe[k];
      const xi = fIm[k] + gIm[k];
      xyRe += xr * gRe[k] + xi * gIm[k];
      xyIm += xi * gRe[k] - xr * gIm[k];
      xx += xr * xr + xi * xi;
      yy += gRe[k] * gRe[k] + gIm[k] * gIm[k];
    }
    const coh = xx > 1e-12 && yy > 1e-12 ? (xyRe * xyRe + xyIm * xyIm) / (xx * yy) : 0;
    // Floor: full 10 dB reach only when the prediction is coherent with the
    // mic; fades to −6 dB (0.5) as coherence drops.
    const cohMix = Math.min(1, coh / 0.6);
    const floor = G_FLOOR_LO + (G_FLOOR - G_FLOOR_LO) * cohMix;
    for (let k = 0; k < BINS; k++) {
      const pe = fRe[k] * fRe[k] + fIm[k] * fIm[k];
      const py = gRe[k] * gRe[k] + gIm[k] * gIm[k];
      let g = pe / (pe + OVER * py + 1e-12);
      if (g < floor) g = floor;
      gains[k] += SMOOTH * (g - gains[k]);
    }
    // Frame spectrum out = β·(g·E) + (1−β)·X = (β·g + 1−β)·E + (1−β)·Ŷ.
    for (let k = 0; k < N; k++) {
      const bin = k < BINS ? k : N - k; // conjugate-symmetric — output stays real
      const c1 = beta * gains[bin] + dry;
      fRe[k] = c1 * fRe[k] + dry * gRe[k];
      fIm[k] = c1 * fIm[k] + dry * gIm[k];
    }
    fft.transform(fRe, fIm, true);
    for (let j = 0; j < N; j++) {
      const i = t + j;
      if (i < 0 || i >= n) continue;
      acc[i] += fRe[j] * win[j];
      norm[i] += win[j] * win[j];
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = norm[i] > 1e-6 ? acc[i] / norm[i] : e[i];
  if (statsOut) {
    statsOut.applied = true;
    let px = 0;
    let po = 0;
    for (let i = 0; i < n; i++) {
      px += x[i] * x[i];
      po += out[i] * out[i];
    }
    statsOut.attenuationDb =
      po > 1e-12 && px > 1e-12
        ? Math.max(0, 10 * Math.log10(px / po))
        : 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. YIN pitch tracking

/**
 * YIN (difference fn → cumulative-mean-normalized → absolute threshold 0.15 →
 * parabolic interpolation), window 1024. f0[i] = 0 where unvoiced. A 3-frame
 * median on the track kills single-frame octave blips; voicing follows the
 * filtered track.
 */
export function yinTrack(
  x: Float32Array,
  sampleRate: number,
  opts?: { hop?: number; fMin?: number; fMax?: number },
): { f0: Float32Array; voiced: Uint8Array; hop: number } {
  const hop = opts?.hop ?? 256;
  const fMin = opts?.fMin ?? 70;
  const fMax = opts?.fMax ?? 800;
  const W = 1024;
  const THRESH = 0.15;
  const tauMin = Math.max(2, Math.floor(sampleRate / fMax));
  const tauMax = Math.min(W, Math.ceil(sampleRate / fMin));
  const span = W + tauMax;
  const nFrames = x.length >= span ? Math.floor((x.length - span) / hop) + 1 : 0;
  const raw = new Float32Array(nFrames);
  const voiced = new Uint8Array(nFrames);
  if (nFrames === 0 || tauMax <= tauMin) return { f0: raw, voiced, hop };

  const cmnd = new Float32Array(tauMax + 1);
  for (let fi = 0; fi < nFrames; fi++) {
    const t = fi * hop;
    // difference function + cumulative-mean normalization in one sweep
    let runningSum = 0;
    cmnd[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      let d = 0;
      for (let j = 0; j < W; j++) {
        const diff = x[t + j] - x[t + j + tau];
        d += diff * diff;
      }
      runningSum += d;
      cmnd[tau] = runningSum > 0 ? (d * tau) / runningSum : 1;
    }
    // absolute threshold: first dip under it, then ride down to the local min
    let tau = -1;
    for (let k = tauMin; k <= tauMax; k++) {
      if (cmnd[k] < THRESH) {
        while (k + 1 <= tauMax && cmnd[k + 1] < cmnd[k]) k++;
        tau = k;
        break;
      }
    }
    if (tau < 0) continue;
    // parabolic interpolation for a sub-sample period
    let shift = 0;
    if (tau > 1 && tau < tauMax) {
      const a = cmnd[tau - 1];
      const b = cmnd[tau];
      const c = cmnd[tau + 1];
      const denom = a - 2 * b + c;
      if (denom !== 0) shift = Math.max(-1, Math.min(1, (0.5 * (a - c)) / denom));
    }
    const hz = sampleRate / (tau + shift);
    if (hz >= fMin && hz <= fMax) raw[fi] = hz;
  }

  const f0 = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(nFrames - 1, i + 1)];
    f0[i] = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c)); // median of 3
    voiced[i] = f0[i] > 0 ? 1 : 0;
  }
  return { f0, voiced, hop };
}

// ---------------------------------------------------------------------------
// 4. voiced segments

/**
 * Contiguous voiced runs ≥ 60 ms, start/end in samples, padded 20 ms each side.
 * Padding is clamped so segments never overlap (overlaps split at the midpoint
 * of the original gap) and never leave [0, nFrames·hop].
 */
export function segmentsFromVoicing(
  f0: Float32Array,
  voiced: Uint8Array,
  hop: number,
  sampleRate: number,
): { start: number; end: number; medianF0: number }[] {
  const minLen = Math.round(0.06 * sampleRate);
  const pad = Math.round(0.02 * sampleRate);
  const total = f0.length * hop;
  const raw: { start: number; end: number; medianF0: number }[] = [];
  const scratch = new Float32Array(f0.length);
  let i = 0;
  while (i < voiced.length) {
    if (!voiced[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < voiced.length && voiced[j + 1]) j++;
    const start = i * hop;
    const end = Math.min(total, (j + 1) * hop);
    if (end - start >= minLen) {
      let n = 0;
      for (let k = i; k <= j; k++) if (f0[k] > 0) scratch[n++] = f0[k];
      raw.push({ start, end, medianF0: medianInPlace(scratch, n) });
    }
    i = j + 1;
  }
  const out = raw.map((r) => ({
    start: Math.max(0, r.start - pad),
    end: Math.min(total, r.end + pad),
    medianF0: r.medianF0,
  }));
  for (let k = 1; k < out.length; k++) {
    if (out[k].start < out[k - 1].end) {
      const mid = Math.round((raw[k - 1].end + raw[k].start) / 2);
      out[k - 1].end = Math.min(out[k - 1].end, mid);
      out[k].start = Math.max(out[k].start, mid);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. TD-PSOLA

/**
 * TD-PSOLA monophonic pitch shifter with a per-frame ratio (1 = unchanged).
 * Time base is preserved — only pitch moves. Analysis marks walk each voiced
 * region at the local period, snapped to the nearest waveform peak (±20% of a
 * period) for phase coherence; output epochs are spaced inputPeriod/ratio and
 * take a 2-period Hann grain from the nearest mark. OLA is normalized by the
 * accumulated window envelope where it exceeds ~1e-3. Unvoiced material copies
 * through unchanged, with 5 ms equal-power crossfades at region boundaries.
 *
 * `formantRatio` (default 1 = neutral) resamples each grain around its center
 * during OLA — the grain is READ at rate formantRatio while output epochs keep
 * their spacing, so the spectral envelope scales without touching the pitch
 * the epoch spacing sets. >1 shifts formants UP (chipmunk timbre), <1 down
 * (giant). Clamped to [0.5, 2]; existing callers (no arg) are unchanged.
 */
export function psolaShift(
  x: Float32Array,
  sampleRate: number,
  track: { f0: Float32Array; voiced: Uint8Array; hop: number },
  ratioForFrame: (frameIndex: number) => number,
  formantRatio = 1,
): Float32Array {
  const { f0, voiced, hop } = track;
  const n = x.length;
  const y = new Float32Array(n);
  y.set(x); // unvoiced base
  const nFrames = f0.length;
  if (n === 0 || nFrames === 0) return y;
  const fr =
    Number.isFinite(formantRatio) && formantRatio > 0
      ? Math.min(2, Math.max(0.5, formantRatio))
      : 1;

  const frameAt = (pos: number): number => {
    const i = Math.round(pos / hop);
    return i < 0 ? 0 : i >= nFrames ? nFrames - 1 : i;
  };

  const synth = new Float32Array(n);
  const envAcc = new Float32Array(n);
  const fadeLen = Math.max(1, Math.round(0.005 * sampleRate));

  // MARK-PICKING SIGNAL: an 800 Hz zero-phase lowpass of the input. Peaks of
  // the RAW waveform belong to whichever harmonic is loudest at that instant,
  // so raw-peak marks jitter against the true glottal period — and when the
  // synthesis epoch's nearest mark switches, that jitter becomes a phase jump
  // between overlapping grains: partial cancellation, an amplitude dip, the
  // "smear". The lowpassed copy keeps only the fundamental's shape (voice f0
  // lives under ~800 Hz), so marks land one clean period apart. Grains still
  // READ from the raw x — this only steers WHERE they're cut.
  const xlp = (() => {
    const out = new Float32Array(n);
    const a = Math.exp((-2 * Math.PI * 800) / sampleRate);
    let s = 0;
    for (let i = 0; i < n; i++) {
      s = (1 - a) * x[i] + a * s;
      out[i] = s;
    }
    s = 0; // backward pass — zero phase, so marks don't shift against x
    for (let i = n - 1; i >= 0; i--) {
      s = (1 - a) * out[i] + a * s;
      out[i] = s;
    }
    return out;
  })();

  const processRegion = (s: number, e: number): void => {
    // analysis pitch marks: walk at the local period, snap to a local peak
    // of the LOWPASSED copy (see xlp above)
    const marks: number[] = [];
    const periods: number[] = [];
    let p = s;
    while (p < e) {
      const f = f0[frameAt(p)];
      if (f <= 0) break;
      const T = sampleRate / f;
      const r = Math.max(1, Math.round(0.2 * T));
      let m = Math.round(p);
      const lo = Math.max(s, m - r);
      const hi = Math.min(e - 1, m + r);
      let best = -1;
      for (let k = lo; k <= hi; k++) {
        const a = Math.abs(xlp[k]);
        if (a > best) {
          best = a;
          m = k;
        }
      }
      marks.push(m);
      periods.push(T);
      p = Math.max(m + T, p + 1);
    }
    if (marks.length === 0) return;

    // synthesis: epochs spaced inputPeriod/ratio, grain from the nearest mark
    let q = marks[0];
    let guard = 0;
    while (q < e && guard++ < 1_000_000) {
      const fIdx = frameAt(q);
      const f = f0[fIdx] > 0 ? f0[fIdx] : sampleRate / periods[periods.length - 1];
      const T = sampleRate / f;
      let ratio = ratioForFrame(fIdx);
      if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1;
      ratio = Math.min(4, Math.max(0.25, ratio));

      let loI = 0;
      let hiI = marks.length - 1;
      while (loI < hiI) {
        const midI = (loI + hiI) >> 1;
        if (marks[midI] < q) loI = midI + 1;
        else hiI = midI;
      }
      let mi = loI;
      if (mi > 0 && Math.abs(marks[mi - 1] - q) <= Math.abs(marks[mi] - q)) mi--;

      const m = marks[mi];
      const L = Math.max(4, Math.round(2 * periods[mi]));
      const half = L >> 1;
      const qi = Math.round(q);
      for (let j = 0; j < L; j++) {
        const oi = qi - half + j;
        // clamp writes to this region so grain tails never pollute a neighbour
        if (oi < s || oi >= e) continue;
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (j + 0.5)) / L);
        let v: number;
        if (fr === 1) {
          const ii = m - half + j;
          if (ii < 0 || ii >= n) continue;
          v = x[ii];
        } else {
          // formant shift: read the grain resampled by fr about its center —
          // linear interpolation is plenty under a Hann window this short.
          const pos = m + (j - half) * fr;
          const i0 = Math.floor(pos);
          if (i0 < 0 || i0 + 1 >= n) continue;
          v = x[i0] + (x[i0 + 1] - x[i0]) * (pos - i0);
        }
        synth[oi] += v * w;
        envAcc[oi] += w;
      }
      q += Math.max(1, T / ratio);
    }

    // normalize by the OLA envelope, equal-power blend into the dry take
    const F = Math.min(fadeLen, Math.max(1, (e - s) >> 1));
    for (let i = s; i < e; i++) {
      const env = envAcc[i];
      const v = env > 1e-3 ? synth[i] / env : x[i];
      const dl = i - s;
      const dr = e - 1 - i;
      let g = 1;
      if (dl < F) g = Math.sin(((dl + 0.5) / F) * (Math.PI / 2));
      if (dr < F) g = Math.min(g, Math.sin(((dr + 0.5) / F) * (Math.PI / 2)));
      y[i] = v * g + x[i] * Math.sqrt(Math.max(0, 1 - g * g));
    }
  };

  let fi = 0;
  while (fi < nFrames) {
    if (!voiced[fi] || f0[fi] <= 0) {
      fi++;
      continue;
    }
    let fj = fi;
    while (fj + 1 < nFrames && voiced[fj + 1] && f0[fj + 1] > 0) fj++;
    const s = Math.min(n, fi * hop);
    const e = Math.min(n, (fj + 1) * hop);
    if (e > s) processRegion(s, e);
    fi = fj + 1;
  }
  return y;
}

// ---------------------------------------------------------------------------
// 6. scale snap

/**
 * Ratio that moves f0 toward the nearest scale pitch class (minimal cents
 * distance across all octaves). strength ∈ [0,1] scales the correction in
 * cents (geometric in ratio — the musically even interpolation). The full-snap
 * correction is clamped to ±250 cents so a badly missed note is nudged, not
 * yanked a fifth.
 */
export function snapRatioToScale(f0Hz: number, scalePcs: number[], strength: number): number {
  if (!(f0Hz > 0) || scalePcs.length === 0) return 1;
  const midi = 69 + 12 * Math.log2(f0Hz / 440);
  let best = Infinity;
  for (const pc of scalePcs) {
    const cand = pc + 12 * Math.round((midi - pc) / 12); // nearest octave of this pc
    const cents = (cand - midi) * 100;
    if (Math.abs(cents) < Math.abs(best)) best = cents;
  }
  if (!Number.isFinite(best)) return 1;
  const clamped = Math.max(-250, Math.min(250, best));
  return Math.pow(2, (clamped * clamp01(strength)) / 1200);
}

// ---------------------------------------------------------------------------
// 7. energy onsets

/**
 * Onset sample positions from a 10 ms-hop RMS envelope: trigger where the
 * envelope crosses above 1.6× its 400 ms trailing median AND an absolute
 * floor (~-60 dBFS), with a 120 ms refractory.
 */
export function onsetsEnergy(x: Float32Array, sampleRate: number): number[] {
  const hop = Math.max(1, Math.round(0.01 * sampleRate));
  const win = hop * 2;
  const nFrames = Math.max(0, Math.ceil(x.length / hop));
  const env = new Float32Array(nFrames);
  for (let k = 0; k < nFrames; k++) {
    const a = k * hop;
    const b = Math.min(x.length, a + win);
    let sum = 0;
    for (let i = a; i < b; i++) sum += x[i] * x[i];
    env[k] = b > a ? Math.sqrt(sum / (b - a)) : 0;
  }

  const MED_FRAMES = 40; // 400 ms of trailing context
  const FLOOR = 1e-3;
  const refractory = Math.round(0.12 * sampleRate);
  const scratch = new Float32Array(MED_FRAMES);
  const onsets: number[] = [];
  let last = -Infinity;
  let prevAbove = false;
  for (let k = 0; k < nFrames; k++) {
    const m0 = Math.max(0, k - MED_FRAMES);
    const len = k - m0;
    let above = false;
    if (len > 0) {
      for (let i = 0; i < len; i++) scratch[i] = env[m0 + i];
      const med = medianInPlace(scratch, len);
      above = env[k] > 1.6 * med && env[k] > FLOOR;
    }
    if (above && !prevAbove) {
      const pos = k * hop;
      if (pos - last >= refractory) {
        onsets.push(pos);
        last = pos;
      }
    }
    prevAbove = above;
  }
  return onsets;
}

// ---------------------------------------------------------------------------
// 8. timing quantize

/**
 * Move each segment toward the nearest grid line (step = 60/bpm/subdivision s,
 * offset by offsetSec), scaled by strength and clamped to ±maxShiftMs. The
 * output is rebuilt from the shifted segments plus the ORIGINAL signal in
 * every unclaimed gap (never silence-gapped), with 20 ms equal-power
 * crossfades at every junction. Overlapping pieces (a shifted segment over the
 * gap filler, or two segments shifted into each other) sum their ENVELOPED
 * signals, then a final pass normalizes anywhere the accumulated fade
 * envelope exceeds unity — an overlap can therefore never read louder than
 * the take itself (summed full-gain overlaps were an audible chop/doubling
 * source at every moved phrase edge).
 */
export function quantizeSegments(
  x: Float32Array,
  sampleRate: number,
  segments: { start: number; end: number }[],
  grid: { bpm: number; subdivision: number; offsetSec?: number },
  strength: number,
  maxShiftMs = 90,
): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  const step = (60 / grid.bpm / grid.subdivision) * sampleRate;
  const offset = (grid.offsetSec ?? 0) * sampleRate;
  const maxShift = Math.round((maxShiftMs / 1000) * sampleRate);
  const st = clamp01(strength);
  const F = Math.max(1, Math.round(0.02 * sampleRate));
  // Fade-envelope accumulator: every write below adds its gain here too, and
  // the final pass divides out anything above 1.
  const env = new Float32Array(n);

  const placed: { src0: number; len: number; dst0: number }[] = [];
  for (const seg of segments) {
    const src0 = Math.max(0, Math.round(seg.start));
    const src1 = Math.min(n, Math.round(seg.end));
    if (src1 <= src0) continue;
    const target = offset + Math.round((seg.start - offset) / step) * step;
    let shift = Math.round((target - seg.start) * st);
    shift = Math.max(-maxShift, Math.min(maxShift, shift));
    placed.push({ src0, len: src1 - src0, dst0: src0 + shift });
  }

  // shifted segments, equal-power fades at both ends
  for (const p of placed) {
    const f = Math.min(F, p.len >> 1);
    for (let j = 0; j < p.len; j++) {
      const di = p.dst0 + j;
      if (di < 0 || di >= n) continue;
      let g = 1;
      if (f > 0) {
        if (j < f) g = Math.sin(((j + 0.5) / f) * (Math.PI / 2));
        const jr = p.len - 1 - j;
        if (jr < f) g *= Math.sin(((jr + 0.5) / f) * (Math.PI / 2));
      }
      out[di] += x[p.src0 + j] * g;
      env[di] += g;
    }
  }

  // gap filler: original signal over the complement of the claimed union,
  // reaching F samples into each claimed neighbour with the complementary fade
  const iv = placed
    .map((p) => ({ a: Math.max(0, p.dst0), b: Math.min(n, p.dst0 + p.len) }))
    .filter((v) => v.b > v.a)
    .sort((u, v) => u.a - v.a);
  const merged: { a: number; b: number }[] = [];
  for (const v of iv) {
    const tail = merged[merged.length - 1];
    if (tail && v.a <= tail.b) tail.b = Math.max(tail.b, v.b);
    else merged.push({ a: v.a, b: v.b });
  }
  const gaps: { a: number; b: number }[] = [];
  let cursor = 0;
  for (const v of merged) {
    if (v.a > cursor) gaps.push({ a: cursor, b: v.a });
    cursor = Math.max(cursor, v.b);
  }
  if (cursor < n) gaps.push({ a: cursor, b: n });

  for (const gp of gaps) {
    const fl = gp.a > 0 ? F : 0; // no fade against the signal edge
    const fr = gp.b < n ? F : 0;
    const a = Math.max(0, gp.a - fl);
    const b = Math.min(n, gp.b + fr);
    for (let i = a; i < b; i++) {
      let g = 1;
      if (i < gp.a) g = Math.sin(((i - a + 0.5) / fl) * (Math.PI / 2));
      else if (i >= gp.b) g = Math.cos(((i - gp.b + 0.5) / fr) * (Math.PI / 2));
      out[i] += x[i] * g;
      env[i] += g;
    }
  }

  // Unity guard: at an equal-power junction the AMPLITUDE envelope peaks at
  // √2 on correlated material (and a segment shifted onto its neighbour sums
  // two full-gain copies = 2×). Dividing by the accumulated envelope wherever
  // it exceeds 1 caps every overlap at the take's own level — fades where the
  // pieces are the same audio (the common case: small shifts) become exactly
  // seamless, and nothing can double.
  for (let i = 0; i < n; i++) if (env[i] > 1) out[i] /= env[i];
  return out;
}

// ---------------------------------------------------------------------------
// 9. WAV encoder

/** RIFF/WAVE PCM16 interleaved. Hard clamp to [-1, 1], no dither. */
export function encodeWavPcm16(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const nCh = channels.length;
  if (nCh === 0) throw new Error("encodeWavPcm16: need at least one channel");
  let nSamples = 0;
  for (const ch of channels) nSamples = Math.max(nSamples, ch.length);
  const dataBytes = nSamples * nCh * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, nCh, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * nCh * 2, true);
  dv.setUint16(32, nCh * 2, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < nSamples; i++) {
    for (let c = 0; c < nCh; c++) {
      const ch = channels[c];
      let v = i < ch.length ? ch[i] : 0;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      dv.setInt16(o, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true);
      o += 2;
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// 10. mono mix

/** Equal-gain mono fold. A missing/short right channel contributes silence. */
export function mixToMono(l: Float32Array, r?: Float32Array): Float32Array {
  if (!r) return new Float32Array(l);
  const n = Math.max(l.length, r.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i < l.length ? l[i] : 0;
    const b = i < r.length ? r[i] : 0;
    out[i] = 0.5 * (a + b);
  }
  return out;
}
