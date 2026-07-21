/// <reference lib="webworker" />
import { processTakeBuffers, type ProcessInput } from "./vocal-pipeline";

/** Worker shell for the vocal pipeline — PSOLA over minutes of audio is
 *  seconds of math, and the song page must keep breathing while it runs. */

self.onmessage = (e: MessageEvent) => {
  const m = e.data as ProcessInput & { seq: number };
  try {
    const out = processTakeBuffers(m);
    const transfer = [out.wav];
    if (out.rawWav) transfer.push(out.rawWav);
    (self as unknown as Worker).postMessage(
      { ok: true, seq: m.seq, ...out },
      transfer,
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      seq: m.seq,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
