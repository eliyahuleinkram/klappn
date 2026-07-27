"use client";

/**
 * THE TAKE — live WAV rendering with track separation. Press ● and the room
 * is taped AS IT PLAYS: the master (post-limiter, post-perf-FX — byte-for-byte
 * what the listener hears, via lib/take-capture) plus ONE 24-BIT WAV PER ORBIT
 * from the engine's own stem tap (engine/zaltz.c sd_stems). No offline render,
 * ever — the render IS the performance, so a take can't lag behind or cap out:
 * length is bounded by disk, not by graph weight.
 *
 * Alignment: master chunks and stem batches are both stamped with the SAME
 * context frame clock (AudioWorkletGlobalScope currentFrame); the writer pads
 * every file from the arm instant by frame arithmetic, and pads all files to
 * one shared length at stop — stems drop into a DAW already aligned.
 *
 * Storage: a Worker streams 24-bit PCM into OPFS via sync access handles
 * (nothing accumulates in memory — an hour-long set is fine); browsers
 * without OPFS fall back to in-memory chunks. Silent stems (peak ≈ 0) are
 * deleted at finalize, never offered. Nothing uploads, nothing is kept beyond
 * the take card — stale take dirs sweep on the next arm.
 */

import {
  ensureEngineStarted,
  getEngineAudioContext,
  getTakeTap,
} from "@/lib/strudel-client";
import { loadTakeTapWorklet, TAKE_TAP_PROCESSOR, type TakeTapChunk, type TakeTapFlushAck } from "@/lib/take-capture";
import {
  zaltzBeginOrbitLog,
  zaltzStemRecycle,
  zaltzStemsStart,
  zaltzStemsStop,
  zaltzTakeOrbitLog,
  type StemBatch,
} from "@/lib/zaltz";

export interface TakeFile {
  /** "master" | "o<orbit>" — the writer's key. */
  name: string;
  kind: "master" | "stem";
  /** Disk-backed File (OPFS) or assembled Blob — lazy either way. */
  blob: Blob;
  /** Human label: "MASTER", or the sounds that played the orbit ("bd·hh"). */
  label: string;
  /** Download filename, ready to use. */
  filename: string;
  seconds: number;
  bytes: number;
  orbit?: number;
}

export interface TakeResult {
  files: TakeFile[];
  seconds: number;
  /** True when the engine stems rode along (zaltz session); false = master only. */
  stems: boolean;
}

// ---- the writer worker (inline — no bundler worker plumbing) ----------------
// Messages in:  {init:{sampleRate,takeStart,dir,keep[]}} → {ready,opfs}
//               {pcm:name, startFrame, il}   (interleaved stereo, transferred)
//               {pcm:name, startFrame, l, r} (planar, transferred)
//               {stop:true} → {done, files:[{name, blob, frames, peak, bytes}]}
// All handling rides ONE promise chain — message order is the alignment
// contract and file opens are async.
const WORKER_SRC = `
let dir = null, sr = 48000, takeStart = 0, useOpfs = false;
const files = new Map();

// The master is 24-bit PCM (post-limiter — it cannot exceed 0dBFS). Stems are
// 32-BIT FLOAT (format 3): they're PRE-limiter, and a hot kick past 1.0 must
// land in the DAW intact, never clamped into clipping the master didn't have.
// NO fact CHUNK, deliberately (2026-07-27, "stems are deafening white noise"):
// the spec asks non-PCM WAVs to carry one, but real chunk-walkers — Chrome's
// decodeAudioData among them, MEASURED — misparse a float WAV with a fact
// chunk and read the samples off-alignment: misaligned float32 IS that noise.
// The plain 44-byte header (format 3, bits 32) decodes exactly everywhere we
// can test; interoperability outranks the letter of the spec.
function header(frames, float) {
  const bpf = float ? 8 : 6;
  const data = frames * bpf;
  const b = new ArrayBuffer(44), v = new DataView(b);
  const w4 = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w4(0, "RIFF"); v.setUint32(4, 36 + data, true); w4(8, "WAVE");
  w4(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, float ? 3 : 1, true);
  v.setUint16(22, 2, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * bpf, true); v.setUint16(32, bpf, true);
  v.setUint16(34, float ? 32 : 24, true);
  w4(36, "data"); v.setUint32(40, data, true);
  return new Uint8Array(b);
}

async function init(d) {
  sr = d.sampleRate; takeStart = d.takeStart;
  try {
    const root = await navigator.storage.getDirectory();
    const takes = await root.getDirectoryHandle("klappn-takes", { create: true });
    try { // sweep takes from dead sessions; this session's live cards stay
      for await (const name of takes.keys())
        if (!d.keep.includes(name) && name !== d.dir)
          await takes.removeEntry(name, { recursive: true }).catch(() => {});
    } catch {}
    dir = await takes.getDirectoryHandle(d.dir, { create: true });
    useOpfs = true;
  } catch { useOpfs = false; } // no OPFS — in-memory chunks (short takes still work)
  postMessage({ ready: true, opfs: useOpfs });
}

async function fileState(name) {
  let st = files.get(name);
  if (!st) {
    const float = name !== "master";
    st = {
      frames: 0, peak: 0, chunks: [], access: null, fname: name + ".wav",
      float, bpf: float ? 8 : 6, hlen: 44,
    };
    files.set(name, st);
    if (useOpfs) {
      const fh = await dir.getFileHandle(st.fname, { create: true });
      st.access = await fh.createSyncAccessHandle();
      st.access.truncate(0);
      st.access.write(header(0, st.float), { at: 0 }); // placeholder — patched at stop
    }
  }
  return st;
}

function writeBytes(st, bytes) {
  if (st.access) st.access.write(bytes, { at: st.hlen + st.frames * st.bpf });
  else st.chunks.push(bytes);
}

function padSilence(st, frames) {
  while (frames > 0) {
    const n = Math.min(frames, 96000);
    writeBytes(st, new Uint8Array(n * st.bpf)); // zeroed = silence, PCM or float
    st.frames += n;
    frames -= n;
  }
}

function writePcm(st, il) {
  const n = il.length >> 1;
  const out = new Uint8Array(il.length * (st.bpf >> 1));
  let peak = st.peak;
  if (st.float) {
    const dv = new DataView(out.buffer);
    for (let i = 0; i < il.length; i++) {
      const v = il[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      dv.setFloat32(i * 4, v, true); // untouched — past-1.0 peaks survive
    }
  } else {
    for (let i = 0; i < il.length; i++) {
      let v = il[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      if (v > 1) v = 1; else if (v < -1) v = -1;
      const x = Math.round(v * 8388607) | 0;
      out[i * 3] = x & 255;
      out[i * 3 + 1] = (x >>> 8) & 255;
      out[i * 3 + 2] = (x >>> 16) & 255;
    }
  }
  st.peak = peak;
  writeBytes(st, out);
  st.frames += n;
}

async function pcm(d) {
  const st = await fileState(d.pcm);
  let il = d.il;
  if (!il) { // planar master chunk → interleave once, here off the UI thread
    il = new Float32Array(d.l.length * 2);
    for (let i = 0; i < d.l.length; i++) { il[i * 2] = d.l[i]; il[i * 2 + 1] = d.r[i]; }
  }
  let pos = d.startFrame - takeStart;
  let frames = il.length >> 1;
  if (pos < 0) { // content from before the arm instant — trim the head
    const drop = Math.min(frames, -pos);
    il = il.subarray(drop * 2); frames -= drop; pos = 0;
  }
  if (!frames) return;
  if (pos > st.frames) padSilence(st, pos - st.frames);
  else if (pos < st.frames) { // overlap guard — never write backwards
    const drop = Math.min(frames, st.frames - pos);
    il = il.subarray(drop * 2); frames -= drop;
  }
  if (frames) writePcm(st, il);
}

async function stop() {
  let max = 0;
  for (const st of files.values()) if (st.frames > max) max = st.frames;
  const list = [];
  for (const [name, st] of files) {
    if (st.frames && st.frames < max) padSilence(st, max - st.frames); // shared length: DAW-aligned
    const silent = !st.frames || st.peak < 1e-6;
    if (st.access) {
      st.access.write(header(st.frames, st.float), { at: 0 });
      st.access.flush(); st.access.close();
      if (silent) { await dir.removeEntry(st.fname).catch(() => {}); continue; }
      const fh = await dir.getFileHandle(st.fname);
      list.push({ name, blob: await fh.getFile(), frames: st.frames, peak: st.peak });
    } else {
      if (silent) continue;
      const blob = new Blob([header(st.frames, st.float), ...st.chunks], { type: "audio/wav" });
      list.push({ name, blob, frames: st.frames, peak: st.peak });
    }
  }
  postMessage({ done: true, files: list, sampleRate: sr });
}

let q = Promise.resolve();
onmessage = (e) => {
  const d = e.data;
  q = q.then(() => {
    if (d.init) return init(d.init);
    if (d.pcm != null) return pcm(d);
    if (d.stop) return stop();
  }).catch((err) => postMessage({ error: String(err) }));
};
`;

// ---- orchestration ----------------------------------------------------------

interface ActiveTake {
  worker: Worker;
  node: AudioWorkletNode;
  sink: GainNode;
  tap: AudioNode;
  ac: AudioContext;
  dir: string;
  startedAt: number;
  stemsArmed: boolean;
  stemEnd: Promise<void>;
  masterFlush: Promise<void>;
  resolveMasterFlush: () => void;
  workerDone: Promise<{ files: WorkerFile[]; sampleRate: number }>;
}

interface WorkerFile {
  name: string;
  blob: Blob;
  frames: number;
  peak: number;
}

let active: ActiveTake | null = null;
const sessionDirs: string[] = []; // this session's takes — spared by the sweep

/** Whether a take is rolling, and since when (ms epoch) — poll for the mm:ss. */
export function takeRecordingState(): { recording: boolean; startedAt: number | null } {
  return active
    ? { recording: true, startedAt: active.startedAt }
    : { recording: false, startedAt: null };
}

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
}

/** Start taping. The take begins at THIS instant (silence until sound, like a
 *  tape deck). True when rolling (idempotent); false when the engine can't
 *  come up or capture isn't possible here. */
export async function startTake(): Promise<boolean> {
  if (active) return true;
  try {
    await ensureEngineStarted();
    const ac = getEngineAudioContext();
    const tap = getTakeTap();
    if (!ac || !tap) return false;
    const takeStart = Math.round(ac.currentTime * ac.sampleRate);
    const dir = `take-${Date.now()}`;

    const worker = new Worker(
      URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })),
    );
    const ready = new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("take writer never became ready")), 5000);
      worker.onmessage = (e) => {
        if (e.data?.ready) { clearTimeout(to); resolve(); }
        else if (e.data?.error) { clearTimeout(to); reject(new Error(e.data.error)); }
      };
    });
    worker.postMessage({
      init: { sampleRate: ac.sampleRate, takeStart, dir, keep: [...sessionDirs] },
    });
    await ready;

    await loadTakeTapWorklet(ac);
    const node = new AudioWorkletNode(ac, TAKE_TAP_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    let resolveMasterFlush = () => {};
    const masterFlush = new Promise<void>((r) => { resolveMasterFlush = r; });
    node.port.onmessage = (e) => {
      const d = e.data as TakeTapChunk | TakeTapFlushAck;
      if ("flushed" in d) { resolveMasterFlush(); return; }
      if (d && d.l instanceof Float32Array)
        worker.postMessage(
          { pcm: "master", startFrame: d.startFrame, l: d.l, r: d.r },
          [d.l.buffer, d.r.buffer],
        );
    };
    tap.connect(node);
    // A worklet only runs when something downstream pulls it: a muted gain to
    // the destination keeps it processing, never audible (vocal-client's law).
    const sink = ac.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(ac.destination);

    // Engine stems — sticky-armed: they flow the moment the zaltz worklet is
    // up (even when ● beat the first evaluate to it); a session whose engine
    // never boots (superdough fallback) just yields a master-only take.
    let resolveStemEnd = () => {};
    const stemEnd = new Promise<void>((r) => { resolveStemEnd = r; });
    zaltzStemsStart(
      (b: StemBatch) => {
        for (let s = 0; s < b.orbits.length; s++) {
          const il = b.pcm.slice(s * b.slotFloats, s * b.slotFloats + b.quanta * 256);
          worker.postMessage(
            { pcm: `o${b.orbits[s]}`, startFrame: b.startFrame, il },
            [il.buffer],
          );
        }
        zaltzStemRecycle(b.pcm); // the batch buffer goes home to the pool
      },
      () => resolveStemEnd(),
    );
    zaltzBeginOrbitLog();
    const stemsArmed = true;

    // No timeout HERE — this promise lives as long as the take rolls; the
    // deadline belongs to stopTake, where the {stop} is actually posted.
    const workerDone = new Promise<{ files: WorkerFile[]; sampleRate: number }>(
      (resolve) => {
        worker.addEventListener("message", (e) => {
          if (e.data?.done) resolve(e.data);
        });
      },
    );

    sessionDirs.push(dir);
    active = {
      worker, node, sink, tap, ac, dir,
      startedAt: Date.now(),
      stemsArmed, stemEnd, masterFlush, resolveMasterFlush, workerDone,
    };
    return true;
  } catch (e) {
    console.warn("[klappn] take failed to start", e);
    return false;
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/** Stop the tape and finalize the WAVs. Null when nothing was rolling. */
export async function stopTake(): Promise<TakeResult | null> {
  const a = active;
  if (!a) return null;
  active = null; // the UI flips immediately; finalize continues below
  try {
    if (a.stemsArmed) {
      zaltzStemsStop(); // tail batches flush through the port before the end mark
      await withTimeout(a.stemEnd, 2000);
    }
    a.node.port.postMessage("flush");
    await withTimeout(a.masterFlush, 2000);
    try { a.tap.disconnect(a.node); } catch { /* context died mid-take */ }
    try { a.node.disconnect(); a.sink.disconnect(); } catch { /* already down */ }

    a.worker.postMessage({ stop: true });
    const { files: raw, sampleRate } = await Promise.race([
      a.workerDone,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("take finalize timed out")), 15000),
      ),
    ]);

    const orbitLog = a.stemsArmed ? zaltzTakeOrbitLog() : new Map<number, Set<string>>();
    const d = new Date(a.startedAt);
    const stampStr = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const stems = raw
      .filter((f) => f.name !== "master")
      .sort((x, y) => Number(x.name.slice(1)) - Number(y.name.slice(1)));

    // HUMAN NAMES (user 07-27: "gm_pad_halo does not mean anything to
    // anyone") — one cheap Sonnet call turns each stem's raw sound ids into
    // a producer's word ("halo pad", "909 drums"). Cosmetic by contract:
    // any failure, timeout or spent machine falls back to the bare ids. The
    // cut already shows "printing…", so the wait is allowed 10s — the first
    // ship's 3.5s abort lost to a cold prod worker + the model's own
    // latency, and every take came back with bare ids.
    let aiNames: string[] | null = null;
    if (stems.length) {
      try {
        const lists = stems.map((f) => [...(orbitLog.get(Number(f.name.slice(1))) ?? [])]);
        if (lists.some((l) => l.length)) {
          const ctl = new AbortController();
          const to = setTimeout(() => ctl.abort(), 10000);
          const res = await fetch("/api/take-names", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ stems: lists }),
            signal: ctl.signal,
          });
          clearTimeout(to);
          if (res.ok) {
            const j = (await res.json()) as { names?: unknown };
            if (
              Array.isArray(j.names) &&
              j.names.length === stems.length &&
              j.names.every((n) => typeof n === "string" && (n as string).trim())
            )
              aiNames = (j.names as string[]).map((n) => n.trim());
            else console.info("[klappn] take-names: no usable names — bare ids stand in");
          } else console.info(`[klappn] take-names: ${res.status} — bare ids stand in`);
        }
      } catch (e) {
        console.info("[klappn] take-names unreachable — bare ids stand in", e);
      }
    }
    const files: TakeFile[] = [];
    const master = raw.find((f) => f.name === "master");
    if (master)
      files.push({
        name: "master", kind: "master", blob: master.blob, label: "MASTER",
        filename: `zaltz-${stampStr}-master.wav`,
        seconds: master.frames / sampleRate, bytes: master.blob.size,
      });
    stems.forEach((f, i) => {
      const orbit = Number(f.name.slice(1));
      const sounds = [...(orbitLog.get(orbit) ?? [])];
      const label =
        aiNames?.[i]?.slice(0, 28) || (sounds.length ? sounds.join("·") : `orbit ${orbit}`);
      files.push({
        name: f.name, kind: "stem", blob: f.blob, label,
        filename: `zaltz-${stampStr}-${pad2(i + 1)}-${slug(label) || `orbit-${orbit}`}.wav`,
        seconds: f.frames / sampleRate, bytes: f.blob.size, orbit,
      });
    });
    const seconds = files.reduce((m, f) => Math.max(m, f.seconds), 0);
    return { files, seconds, stems: a.stemsArmed && stems.length > 0 };
  } catch (e) {
    console.warn("[klappn] take finalize failed", e);
    return null;
  } finally {
    a.worker.terminate();
  }
}

/** Drop a finished take's disk footprint (the ✕ on the take card). Downloads
 *  already saved are files on the user's machine — untouched. */
export async function discardTake(): Promise<void> {
  // The OPFS sweep at the next arm clears old dirs; this just forgets the
  // session guard so the sweep is allowed to take them.
  sessionDirs.length = 0;
}
