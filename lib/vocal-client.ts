import {
  scaleFromKey,
  shiftScale,
  type ProcessInput,
  type ProcessOutput,
} from "./vocal-pipeline";
import { getBroadcastStream, getEngineAudioContext } from "./strudel-client";
import {
  loadVocalCaptureWorklet,
  VOCAL_CAPTURE_PROCESSOR,
  type VocalCaptureChunk,
  type VocalCaptureFlushAck,
} from "./vocal-capture-worklet";

/**
 * VOICE — browser-side orchestration: capture the take, run the pipeline in a
 * Worker (inline fallback). Playback of the finished vocal belongs to
 * lib/vocal-layer (the voice is a LAYER of the song, on the engine's clock).
 *
 * CAPTURE IS RAW — AND SAMPLE-LOCKED. Browser echo cancellation over a
 * playing song behaves like a speakerphone — half-duplex gating plus spectral
 * suppression is exactly the warbly "underwater" voice. We can beat it
 * because we HAVE the far end: the song is synthesized in this same page, so
 * one AudioWorklet on the ENGINE's context (lib/vocal-capture-worklet)
 * captures the raw mic AND the engine's own output (getBroadcastStream taps
 * the master) in the same 128-frame quanta — one clock, PCM, no lossy codec —
 * and the pipeline subtracts the actual music offline (lib/vocal-dsp
 * cancelEchoReference) against a delay that is a CONSTANT by construction.
 * (The old scheme — two MediaRecorders — meant two clocks; a few hundred ppm
 * of drift broke the fixed-delay canceller within seconds.) Only when the
 * engine context/tap is unavailable do we fall back to one MediaRecorder
 * with the browser AEC — better than nothing, never better than us.
 */

// --- recording ---------------------------------------------------------------

export type Recording =
  | {
      kind: "pcm";
      /** The raw microphone take, mono PCM on the engine clock. */
      mic: Float32Array;
      /** The engine's own output over the SAME quanta — the echo-cancel
       *  reference. Sample-locked: mic[i] and ref[i] are simultaneous. */
      ref: Float32Array | null;
      sampleRate: number;
    }
  | {
      /** Fallback capture (no engine context / worklet failed): one
       *  MediaRecorder with the browser AEC on, no reference. */
      kind: "blob";
      mic: Blob;
    };

export interface Recorder {
  /** Resolves once audio is actually flowing (mic granted + capture running).
   *  `deviceId` picks the input device (deviceId:{exact}); when that exact
   *  device is gone (unplugged since the choice was saved) the default mic is
   *  opened instead — a stale preference must never brick recording. */
  start(deviceId?: string): Promise<void>;
  stop(): Promise<Recording>;
  cancel(): void;
  /** The live capture stream while recording (null otherwise) — read-only tap
   *  for a level meter; never stop its tracks from outside. */
  stream(): MediaStream | null;
  /** Which capture path start() actually took: "locked" = sample-locked
   *  worklet on the engine's context (echo-cancel reference rides along),
   *  "fallback" = one MediaRecorder with the browser AEC (no reference —
   *  the UI must say so instead of degrading silently), null = not started. */
  mode(): "locked" | "fallback" | null;
}

function pickMime(): string | undefined {
  // Chrome/Firefox: webm/opus. Safari's MediaRecorder doesn't do webm — it
  // records AAC-in-MP4, so "audio/mp4" is the explicit second choice. If
  // neither matches, the browser picks its default; downstream is agnostic
  // because decodeAudioData sniffs the BYTES, not the blob's MIME label.
  return ["audio/webm;codecs=opus", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function concatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** getUserMedia with an exact device preference that DEGRADES: a saved device
 *  that no longer exists throws OverconstrainedError — retry with the default
 *  mic rather than failing the take. */
async function openMic(
  base: MediaTrackConstraints,
  deviceId?: string,
): Promise<MediaStream> {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { ...base, deviceId: { exact: deviceId } },
      });
    } catch {
      /* device unplugged/renamed — fall through to the default */
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: base });
}

export function createVoiceRecorder(): Recorder {
  let media: MediaStream | null = null;
  let captureMode: "locked" | "fallback" | null = null;

  // Worklet (sample-locked PCM) path.
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let micSrc: MediaStreamAudioSourceNode | null = null;
  let refSrc: MediaStreamAudioSourceNode | null = null;
  let sink: GainNode | null = null;
  let micChunks: Float32Array[] = [];
  let refChunks: Float32Array[] = [];
  let onFlushed: ((ack: VocalCaptureFlushAck | null) => void) | null = null;
  // CONTINUITY LEDGER — every chunk carries its running sample offset; any
  // mismatch means a dropped chunk, and a dropped chunk is a click in the
  // take. Asserted (logged) at stop; zero is the only healthy value.
  let nextStart = 0;
  let gapSamples = 0;

  // Fallback (single MediaRecorder, browser AEC) path.
  let rec: MediaRecorder | null = null;
  const blobChunks: Blob[] = [];

  const teardownGraph = (): void => {
    // Disconnect OUR nodes only. Never stop the ref stream's tracks: they
    // belong to the engine's broadcast tap (live sets ride the same node).
    for (const n of [micSrc, refSrc, node, sink]) {
      try {
        n?.disconnect();
      } catch {
        /* already gone */
      }
    }
    if (node) node.port.onmessage = null;
    micSrc = null;
    refSrc = null;
    node = null;
    sink = null;
    ctx = null;
    onFlushed = null;
  };

  const stopTracks = (): void => {
    media?.getTracks().forEach((t) => t.stop());
    media = null;
  };

  const startFallback = async (deviceId?: string): Promise<void> => {
    media = await openMic(
      {
        channelCount: 1,
        // No reference to subtract — let the browser AEC eat the song
        // (better than printing the whole mix into the take).
        echoCancellation: true,
        // Browser noise suppression OFF always — it's tuned for SPEECH and
        // dulls/pumps SUNG vocals (sustained tones read as noise). The
        // pipeline's spectral gate (the Clean knob) does this transparently.
        noiseSuppression: false,
        // AGC OFF — it hunts BETWEEN phrases over music: gain rides up in
        // the gaps and clamps held notes (pumping baked into the take).
        // The pipeline peak-normalizes and the FX compressor evens phrases.
        autoGainControl: false,
      },
      deviceId,
    );
    const mime = pickMime();
    rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => {
      if (e.data.size) blobChunks.push(e.data);
    };
    await new Promise<void>((resolve) => {
      rec!.onstart = () => resolve();
      rec!.start(250);
    });
    captureMode = "fallback";
  };

  return {
    async start(deviceId?: string) {
      captureMode = null;
      nextStart = 0;
      gapSamples = 0;
      // The engine context + its broadcast tap decide the path. The tap works
      // even before the song starts (silent until playback begins; the
      // pipeline's delay estimate doesn't care). The caller is responsible
      // for booting the engine FIRST (ensureEngineStarted) — a null here on
      // a fresh page was exactly the silent fallback that recorded a take
      // with the whole song in it and no reference to cancel it with.
      ctx = getEngineAudioContext();
      const refStream = ctx ? getBroadcastStream() : null;
      if (!ctx || !refStream) {
        ctx = null;
        await startFallback(deviceId);
        return;
      }
      media = await openMic(
        {
          // One channel: every phone/laptop capsule is mono anyway and the
          // worklet folds each input to mono first thing.
          channelCount: 1,
          // RAW: our offline canceller subtracts the ACTUAL music; the
          // browser AEC would gate and warble the voice first.
          echoCancellation: false,
          noiseSuppression: false, // see startFallback for the whys
          autoGainControl: false,
          // sampleRate: intentionally NOT hinted — the input bridges onto the
          // engine context's clock/rate regardless, which is the whole point.
        },
        deviceId,
      );
      try {
        await loadVocalCaptureWorklet(ctx);
        node = new AudioWorkletNode(ctx, VOCAL_CAPTURE_PROCESSOR, {
          numberOfInputs: 2,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        node.port.onmessage = (e) => {
          const d = e.data as VocalCaptureChunk | VocalCaptureFlushAck;
          if ("flushed" in d) {
            onFlushed?.(d);
            return;
          }
          if (d && d.mic instanceof Float32Array) {
            // Continuity assert: this chunk must start exactly where the last
            // one ended. Port messages are ordered, so any mismatch means a
            // chunk was LOST — a hard splice (= click) in the take.
            if (d.start !== nextStart)
              gapSamples += Math.abs(d.start - nextStart);
            nextStart = d.start + d.mic.length;
            micChunks.push(d.mic);
            refChunks.push(d.ref);
          }
        };
        micSrc = ctx.createMediaStreamSource(media);
        micSrc.connect(node, 0, 0);
        refSrc = ctx.createMediaStreamSource(refStream);
        refSrc.connect(node, 0, 1);
        // A worklet only runs when something downstream pulls it: a muted
        // gain to the destination keeps it processing, never audible.
        sink = ctx.createGain();
        sink.gain.value = 0;
        node.connect(sink).connect(ctx.destination);
        // Capture flows only while the context runs — resume NOW so "start"
        // means started (playFromTop resumes it anyway a beat later).
        if (ctx.state !== "running") await ctx.resume();
        captureMode = "locked";
      } catch {
        // Worklet setup failed — tear down and take the AEC fallback.
        teardownGraph();
        stopTracks();
        micChunks = [];
        refChunks = [];
        await startFallback(deviceId);
      }
    },
    stop() {
      if (node && ctx) {
        const port = node.port;
        const sampleRate = ctx.sampleRate;
        return new Promise<Recording>((resolve) => {
          let settled = false;
          let timer: ReturnType<typeof setTimeout> | null = null;
          const finish = (ack: VocalCaptureFlushAck | null): void => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            teardownGraph();
            stopTracks();
            const mic = concatChunks(micChunks);
            const ref = concatChunks(refChunks);
            micChunks = [];
            refChunks = [];
            // ZERO-GAP ASSERT. Both ledgers must read clean: chunk continuity
            // (lost port messages) and the worklet's own engine-frame count
            // (skipped render quanta). Any hole is an audible click — say so.
            const engineGaps = ack?.gapFrames ?? 0;
            if (gapSamples > 0 || engineGaps > 0) {
              console.warn(
                `[klappn] vocal capture NOT gapless: ` +
                  `${gapSamples} samples lost between chunks, ` +
                  `${engineGaps} engine frames skipped — clicks are possible in this take`,
              );
            }
            resolve({ kind: "pcm", mic, ref, sampleRate });
          };
          // Ask the processor to post its partial tail; the ack is ordered
          // AFTER that chunk. Best-effort — never hang the take on it.
          onFlushed = finish;
          timer = setTimeout(() => finish(null), 500);
          try {
            port.postMessage("flush");
          } catch {
            finish(null);
          }
        });
      }
      return new Promise<Recording>((resolve, reject) => {
        if (!rec) return reject(new Error("not recording"));
        rec.onstop = () => {
          // rec.mimeType reflects what the recorder ACTUALLY produced (Safari
          // reports "audio/mp4" here) — the label is cosmetic since decoding
          // reads bytes, not type.
          const mic = new Blob(blobChunks, {
            type: rec?.mimeType || "audio/webm",
          });
          stopTracks();
          rec = null;
          blobChunks.length = 0;
          resolve({ kind: "blob", mic });
        };
        rec.stop();
      });
    },
    cancel() {
      captureMode = null;
      try {
        node?.port.postMessage("flush"); // stops the processor's work
      } catch {
        /* already gone */
      }
      teardownGraph();
      try {
        rec?.stop();
      } catch {
        /* already stopped */
      }
      stopTracks();
      rec = null;
      micChunks = [];
      refChunks = [];
      blobChunks.length = 0;
    },
    stream() {
      return media;
    },
    mode() {
      return captureMode;
    },
  };
}

/** Decode a recording/upload into raw channel data (any AudioContext works —
 *  decode is offline). */
export async function decodeToRaw(
  blob: Blob,
  ac: AudioContext,
): Promise<{ left: Float32Array; right?: Float32Array; sampleRate: number }> {
  const buf = await blob.arrayBuffer();
  const audio = await ac.decodeAudioData(buf);
  return {
    left: audio.getChannelData(0).slice(),
    right: audio.numberOfChannels > 1 ? audio.getChannelData(1).slice() : undefined,
    sampleRate: audio.sampleRate,
  };
}

// --- processing (worker with inline fallback) --------------------------------

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (o: ProcessOutput) => void; reject: (e: Error) => void }
>();

function ensureWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./vocal-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const d = e.data as ({ ok: true } & ProcessOutput & { seq: number }) | {
        ok: false;
        seq: number;
        error: string;
      };
      const p = pending.get(d.seq);
      if (!p) return;
      pending.delete(d.seq);
      if (d.ok) p.resolve(d);
      else p.reject(new Error(d.error));
    };
    worker.onerror = () => {
      // A dead worker fails every waiter; the caller falls back inline.
      for (const [, p] of pending) p.reject(new Error("vocal worker crashed"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

export async function processTake(input: ProcessInput): Promise<ProcessOutput> {
  const w = ensureWorker();
  if (w) {
    try {
      return await new Promise<ProcessOutput>((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        // Copy the channel buffers — the caller keeps the raw take (and its
        // reference) for re-runs (a knob change re-processes from the
        // original, never from an output).
        const left = input.left.slice();
        const right = input.right?.slice();
        const ref = input.ref?.slice();
        const transfer: ArrayBuffer[] = [left.buffer as ArrayBuffer];
        if (right) transfer.push(right.buffer as ArrayBuffer);
        if (ref) transfer.push(ref.buffer as ArrayBuffer);
        w.postMessage({ ...input, left, right, ref, seq: id }, transfer);
      });
    } catch {
      /* fall through to inline */
    }
  }
  const { processTakeBuffers } = await import("./vocal-pipeline");
  return processTakeBuffers(input);
}

// --- key/transpose follows the song ------------------------------------------

/** Parse the PCM16 WAV we write ourselves (encodeWavPcm16) back to mono
 *  float — no AudioContext needed, so the retune below runs even when the
 *  engine never booted on this page. Multi-channel folds to mono. */
function decodeWavPcm16(buf: ArrayBuffer): { pcm: Float32Array; sampleRate: number } {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x52494646 /* RIFF */)
    throw new Error("not a WAV");
  let sampleRate = 44100;
  let channels = 1;
  let o = 12;
  while (o + 8 <= dv.byteLength) {
    const id = dv.getUint32(o, false);
    const size = dv.getUint32(o + 4, true);
    if (id === 0x666d7420 /* fmt  */) {
      channels = dv.getUint16(o + 10, true) || 1;
      sampleRate = dv.getUint32(o + 12, true) || 44100;
    } else if (id === 0x64617461 /* data */) {
      const n = Math.floor(size / (2 * channels));
      const pcm = new Float32Array(n);
      let p = o + 8;
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          sum += dv.getInt16(p, true) / 32768;
          p += 2;
        }
        pcm[i] = sum / channels;
      }
      return { pcm, sampleRate };
    }
    o += 8 + size + (size & 1);
  }
  throw new Error("WAV data chunk missing");
}

const numOr = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

/**
 * RE-TUNE THE SONG'S VOICE for a new key/transpose — from the stored RAW take
 * (vocals/<song>/<take>.raw.wav), the full pipeline with the take's own saved
 * knobs/cuts/character, targets shifted so the singer is pulled to the
 * TRANSPOSED scale — then save the render in place (same row, same R2 key).
 *
 * Works with the studio closed: no React, no AudioContext. Returns the new
 * render (the caller hot-swaps the live layer / cache), or null when there is
 * nothing to do (already in this key), no raw exists (legacy take), or the
 * save failed. Fire-and-forget safe — throws nothing.
 */
export async function retuneVoiceForSong(
  songId: string,
  take: { id: string; fx: Record<string, unknown> },
  params: { keyName: string | null; transpose: number; bpm: number },
): Promise<{ fx: Record<string, unknown>; durationMs: number; wav: ArrayBuffer } | null> {
  try {
    const fx = take.fx ?? {};
    // The scale the take was SUNG in = the song's key shifted by the
    // transpose that was active at record time; targetSemis moves the voice
    // by however far the song has moved since.
    const recorded = Math.round(numOr(fx.recordedTranspose, 0));
    const semis = Math.round(params.transpose) - recorded;
    if (semis === Math.round(numOr(fx.targetSemis, 0))) return null; // already there
    const rr = await fetch(`/api/songs/${songId}/vocal/${take.id}/raw`);
    if (!rr.ok) return null; // legacy take — no raw source to re-tune from
    const { pcm, sampleRate } = decodeWavPcm16(await rr.arrayBuffer());
    if (!pcm.length) return null;
    const cuts = Array.isArray(fx.cuts)
      ? (fx.cuts as { start: number; end: number }[]).filter(
          (c) => c && Number.isFinite(c.start) && Number.isFinite(c.end),
        )
      : undefined;
    const out = await processTake({
      left: pcm,
      sampleRate,
      trimMs: numOr(fx.trimMs, 0),
      bpm: params.bpm,
      subdivision: 2,
      scalePcs: shiftScale(scaleFromKey(params.keyName), recorded),
      tune: numOr(fx.tune, 0.65),
      timing: numOr(fx.timing, 0.3),
      denoiseAmt: numOr(fx.clean, 0.25),
      cuts,
      character: (fx.character ?? undefined) as ProcessInput["character"],
      targetSemis: semis,
    });
    const newFx = { ...fx, targetSemis: semis };
    const res = await fetch(`/api/songs/${songId}/vocal/${take.id}`, {
      method: "PUT",
      headers: {
        "content-type": "audio/wav",
        "x-klappn-duration": String(out.durationMs),
        "x-klappn-fx": JSON.stringify(newFx),
      },
      body: out.wav,
    });
    if (!res.ok) return null;
    return { fx: newFx, durationMs: out.durationMs, wav: out.wav };
  } catch {
    return null;
  }
}
