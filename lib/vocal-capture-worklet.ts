/**
 * SAMPLE-LOCKED capture for the voice studio — one AudioWorkletProcessor with
 * TWO inputs (0 = mic, 1 = the engine's own output) on the ENGINE's
 * AudioContext, so both signals ride the SAME clock and the same 128-frame
 * quanta. This is the fix for the dual-MediaRecorder scheme: two recorders =
 * two clocks + lossy Opus/AAC, and a few hundred ppm of drift walks the echo
 * path out from under a fixed-delay canceller within seconds (the adaptation
 * flutter chasing it was the audible chop). Here the browser's input bridging
 * absorbs the mic device's clock drift into the context clock, so mic[i] and
 * ref[i] are simultaneous BY CONSTRUCTION — the echo delay is a constant.
 *
 * The processor mixes each input to mono in-processor, accumulates ~8192
 * samples per side, and posts { mic, ref } pairs of equal length (transferred,
 * never copied). "flush" → posts the partial tail, acks "flushed", and goes
 * inert — so the last fraction of a take is never dropped.
 *
 * Registered via a data: URL with a Blob-URL fallback (the repo's worklet
 * pattern — see lib/worklet-pin.ts, whose registerProcessor pin also covers
 * this class on Safari 18.0.x).
 */

export const VOCAL_CAPTURE_PROCESSOR = "klappn-vocal-capture";

/** One posted chunk: equal-length, same-quanta — sample-locked. `start` is a
 *  RUNNING SAMPLE COUNTER (total samples emitted before this chunk), so the
 *  receiver can assert the take is gapless — a dropped chunk is a click. */
export interface VocalCaptureChunk {
  mic: Float32Array;
  ref: Float32Array;
  start: number;
}

/** The flush acknowledgement, ordered AFTER the final partial chunk.
 *  `gapFrames` = render-quantum frames the ENGINE skipped mid-capture
 *  (currentFrame jumped between process() calls) — each one is a hole in the
 *  take, i.e. a click, so the client logs it loudly. */
export interface VocalCaptureFlushAck {
  flushed: true;
  gapFrames: number;
}

/** The processor source is exported ONLY for the offline bench: node eval's
 *  it against stub AudioWorklet globals to prove the continuity ledger counts
 *  engine-skipped frames and that chunk `start` offsets are gapless. */
export const PROCESSOR_SOURCE = `
class KlappnVocalCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._size = 8192;
    this._mic = new Float32Array(this._size);
    this._ref = new Float32Array(this._size);
    this._fill = 0;
    this._done = false;
    this._start = 0;       // samples emitted so far (chunk continuity counter)
    this._expectFrame = -1; // next currentFrame we expect process() to see
    this._gapFrames = 0;    // engine-skipped frames (holes in the capture)
    this.port.onmessage = (e) => {
      if (e.data === "flush") {
        this._emit();
        this._done = true;
        this.port.postMessage({ flushed: true, gapFrames: this._gapFrames });
      }
    };
  }
  _emit() {
    if (!this._fill) return;
    const mic = this._mic.slice(0, this._fill);
    const ref = this._ref.slice(0, this._fill);
    this._fill = 0;
    this.port.postMessage(
      { mic, ref, start: this._start },
      [mic.buffer, ref.buffer],
    );
    this._start += mic.length;
  }
  process(inputs) {
    if (this._done) return false;
    const mi = inputs[0];
    const ri = inputs[1];
    // A disconnected/still-warming input has zero channels; it contributes
    // silence but MUST still advance in lockstep with the other side.
    const mc = mi ? mi.length : 0;
    const rc = ri ? ri.length : 0;
    const n = (mc ? mi[0].length : 0) || (rc ? ri[0].length : 0) || 128;
    // CONTINUITY: consecutive process() calls must be consecutive quanta. If
    // the engine skipped rendering, currentFrame jumps — count the hole.
    if (this._expectFrame >= 0 && currentFrame > this._expectFrame)
      this._gapFrames += currentFrame - this._expectFrame;
    this._expectFrame = currentFrame + n;
    for (let j = 0; j < n; j++) {
      let m = 0;
      for (let c = 0; c < mc; c++) m += mi[c][j];
      if (mc > 1) m /= mc;
      let r = 0;
      for (let c = 0; c < rc; c++) r += ri[c][j];
      if (rc > 1) r /= rc;
      this._mic[this._fill] = m;
      this._ref[this._fill] = r;
      if (++this._fill === this._size) this._emit();
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(VOCAL_CAPTURE_PROCESSOR)}, KlappnVocalCapture);
`;

/** In-flight + completed dedupe per context (addModule twice would throw on
 *  the duplicate registerProcessor name). Never cleared on success. */
const loading = new WeakMap<AudioWorklet, Promise<void>>();

async function addProcessorModule(worklet: AudioWorklet): Promise<void> {
  try {
    await worklet.addModule(
      `data:text/javascript;base64,${btoa(PROCESSOR_SOURCE)}`,
    );
    return;
  } catch {
    // Some engines / CSPs refuse data: worklet modules — blob URL fallback.
  }
  const url = URL.createObjectURL(
    new Blob([PROCESSOR_SOURCE], { type: "text/javascript" }),
  );
  try {
    await worklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Load (once) the capture processor on `ac`. Throws when the context has no
 *  AudioWorklet at all — the caller falls back to MediaRecorder capture. */
export function loadVocalCaptureWorklet(ac: AudioContext): Promise<void> {
  const worklet = ac.audioWorklet;
  if (!worklet || typeof worklet.addModule !== "function")
    return Promise.reject(new Error("AudioWorklet unavailable"));
  let p = loading.get(worklet);
  if (!p) {
    p = addProcessorModule(worklet).catch((e) => {
      loading.delete(worklet); // a failed load may be retried
      throw e;
    });
    loading.set(worklet, p);
  }
  return p;
}
