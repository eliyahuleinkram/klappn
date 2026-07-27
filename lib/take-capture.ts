/**
 * MASTER tap for the take (lib/take-record) — a stereo capture
 * AudioWorkletProcessor on the ENGINE's context, fed by the post-limiter,
 * post-perf-FX node (strudel-client getTakeTap), so the master WAV is
 * byte-for-byte what the listener hears. Same clock and quanta as the zaltz
 * engine worklet, so `startFrame` stamps here and on stem batches are the SAME
 * timeline — the writer aligns master and stems to the sample.
 *
 * Chunks are planar L/R, ~8192 frames, transferred never copied. An engine
 * frame skip (device sleep) emits the partial chunk first — every chunk is
 * internally gapless, and the writer pads holes by frame arithmetic. "flush"
 * posts the tail, acks { flushed }, and the processor goes inert.
 *
 * Registered via a data: URL with a Blob-URL fallback (the repo's worklet
 * pattern — lib/vocal-capture-worklet.ts; worklet-pin covers Safari 18.0.x).
 */

export const TAKE_TAP_PROCESSOR = "klappn-take-tap";

/** One posted chunk: gapless planar stereo starting at context frame
 *  `startFrame` (AudioWorkletGlobalScope currentFrame — the engine clock). */
export interface TakeTapChunk {
  l: Float32Array;
  r: Float32Array;
  startFrame: number;
}

export interface TakeTapFlushAck {
  flushed: true;
}

export const PROCESSOR_SOURCE = `
class KlappnTakeTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this._size = 8192;
    this._l = new Float32Array(this._size);
    this._r = new Float32Array(this._size);
    this._fill = 0;
    this._start = -1;  // currentFrame of _l[0]
    this._expect = -1; // continuity ledger: next currentFrame we expect
    this._done = false;
    this.port.onmessage = (e) => {
      if (e.data === "flush") {
        this._emit();
        this._done = true;
        this.port.postMessage({ flushed: true });
      }
    };
  }
  _emit() {
    if (!this._fill) return;
    const l = this._l.slice(0, this._fill);
    const r = this._r.slice(0, this._fill);
    this.port.postMessage({ l, r, startFrame: this._start }, [l.buffer, r.buffer]);
    this._fill = 0;
    this._start = -1;
  }
  process(inputs) {
    if (this._done) return false;
    const inp = inputs[0];
    const ch = inp ? inp.length : 0;
    const n = (ch ? inp[0].length : 0) || 128;
    // engine skipped frames since the last quantum: close the gapless chunk
    // so the hole lives BETWEEN chunks, where the writer pads it
    if (this._expect >= 0 && currentFrame !== this._expect) this._emit();
    this._expect = currentFrame + n;
    const L = ch ? inp[0] : null;
    const R = ch > 1 ? inp[1] : L;
    for (let j = 0; j < n; j++) {
      if (this._start < 0) this._start = currentFrame + j;
      this._l[this._fill] = L ? L[j] : 0;
      this._r[this._fill] = R ? R[j] : 0;
      if (++this._fill === this._size) this._emit();
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(TAKE_TAP_PROCESSOR)}, KlappnTakeTap);
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
 *  AudioWorklet at all — the recorder then records nothing (no tap, no take). */
export function loadTakeTapWorklet(ac: AudioContext): Promise<void> {
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
