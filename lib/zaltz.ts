/**
 * ZALTZ bridge — the main-thread half of Klappn's own WASM engine.
 *
 * Flag-gated (`?engine=zaltz`): when active, lib/strudel-client's
 * evalProgram hands programs HERE instead of the superdough repl. We
 * transpile + query the pattern ourselves and feed haps to the AudioWorklet
 * host (engine/zaltz.worklet.js) through a LOOKAHEAD loop — main-thread
 * jank can delay a message (the lookahead absorbs it) but can never glitch
 * the render, which lives on the audio thread.
 *
 * v1 scope (the A/B experiment):
 *  - synths (sine/saw/square/triangle/supersaw) + samples via bank/n maps
 *  - amp ADSR, lpf/hpf(+q), lpenv family, vib, pan, gain staging
 *  - DROPPED (counted, logged once): gm_* soundfonts (M3), orbit/room/delay/
 *    duck/shape (M4), visuals (audio-only A/B)
 *  - pause = scheduling stops (tails ring out); rebuilds swap the pattern in
 *    place with the cycle cursor kept — same seamlessness contract as the repl.
 */
// NO top-level @strudel imports — those modules touch browser globals at
// import time and this file sits in the page's SSR module graph (the whole
// engine loads DYNAMICALLY on first use, same invariant as strudel-engine).
type StrudelCore = {
  evalScope: (...m: unknown[]) => Promise<unknown>;
  evaluate: (code: string, t?: unknown) => Promise<unknown>;
  Pattern: { prototype: Record<string, unknown> };
  stack: (...p: never[]) => unknown;
  silence: unknown;
};
let coreMod: StrudelCore | null = null;
let transpilerFn: unknown = null;

const LOOKAHEAD = 0.35; // seconds of haps kept scheduled ahead
const TICK_MS = 120;

type HapValue = Record<string, unknown>;
interface Hap {
  value: HapValue;
  hasOnset(): boolean;
  ensureObjectValue(): void;
  whole: { begin: { valueOf(): number } };
  duration: { valueOf(): number };
}
interface Pat {
  queryArc(a: number, b: number, ctx?: Record<string, unknown>): Hap[];
}

import { ENGINE_V } from "./engine-version";
import { pinWorkletConstructors } from "./worklet-pin";

// Set when the engine cannot BOOT on this browser (wasm instantiate/addModule
// failure — e.g. a Safari too old for the wasm features we compile with, or
// no AudioWorklet at all). isZaltz() then reports false for the session and
// every play path lands on superdough — old browsers get music, not silence.
let bootFailed = false;
export function zaltzBootFailed(): boolean {
  return bootFailed;
}

let scopeReady: Promise<void> | null = null;
let node: AudioWorkletNode | null = null;
let nodeReady: Promise<void> | null = null;
let ctxRef: AudioContext | null = null;
let outRef: AudioNode | null = null; // where the engine pours — the app's MASTER

let pattern: Pat | null = null;
let cps = 0.5;
let t0 = 0; // ctx time where cycle 0 sits
let cursor = 0; // cycles queried so far
let timer: ReturnType<typeof setInterval> | null = null;
// ONE owner for the scheduling interval. The old code let hush leave an
// interval alive and the next evaluate stack a second one — the leaked
// ticker kept scheduling audio THROUGH a pause, and resume then shifted t0
// by the pause length anyway, leaving the UI position clock permanently
// BEHIND the audio (the "visual stuck on an earlier loop" bug).
function startTimer(): void {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
}
function stopTimer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

// gm soundfonts — the VENDORED loader (lib/vendor/soundfonts: loop-seam
// crossfade included) resolves zones; each decoded zone uploads once and
// plays through the engine's looping sample voice.
type FontMod = {
  getFontPitch: (
    name: string,
    midi: number,
    ac: AudioContext,
  ) => Promise<{
    buffer: AudioBuffer;
    zone: {
      originalPitch: number;
      coarseTune?: number;
      fineTune?: number;
      loopStart: number;
      loopEnd: number;
      sampleRate: number;
    };
  }>;
  setSoundfontUrl: (u: string) => void;
};
let fontMod: FontMod | null = null;
let gmMap: Record<string, string[]> | null = null;
let fontLoading: Promise<void> | null = null;
async function ensureFonts(): Promise<void> {
  if (fontMod) return;
  if (!fontLoading)
    fontLoading = (async () => {
      const [loader, gm] = await Promise.all([
        import("./vendor/soundfonts/fontloader.mjs"),
        import("./vendor/soundfonts/gm.mjs"),
      ]);
      const mod = loader as unknown as FontMod;
      mod.setSoundfontUrl("/api/snd/f");
      fontMod = mod;
      gmMap = (gm as { default: Record<string, string[]> }).default;
    })();
  return fontLoading;
}

// sample registry: "name:n:midi" → worklet sample id (or "loading")
const sampleIds = new Map<string, number | "loading">();
// per-key semitone repitch for pitched (note-keyed) sample maps — superdough
// picks the nearest-pitch zone and repitches the residual (util.mjs
// getCommonSampleInfo); without this a piano map plays its FIRST zone (A0)
// at recorded pitch for every note
const sampleTrans = new Map<string, number>();
// url → uploaded id: neighbouring notes share a zone; upload the PCM once
const urlIds = new Map<string, Promise<number | null>>();
// in-flight load promises — a fresh play WARMS the first cycle's sounds and
// waits (bounded) for these, so the downbeat starts COMPLETE instead of
// layers popping in as decodes land (the "trips out then gets normal" start)
const pendingLoads = new Set<Promise<void>>();
function trackLoad(p: Promise<void>): void {
  pendingLoads.add(p);
  void p.finally(() => pendingLoads.delete(p));
}
const sampleDur = new Map<number, number>();
let nextSampleId = 0;
// a map entry is either a plain url list (drums: indexed by n) or pitched
// zones (note-keyed maps like piano/steinway: nearest-midi + repitch)
type PitchedZone = { midi: number; urls: string[] };
let maps: Record<string, string[] | PitchedZone[]> | null = null;
let mapsLoading: Promise<void> | null = null;
const droppedOnce = new Set<string>();

/** Which engine takes the NEXT evaluate. M6: zaltz is the DEFAULT for
 *  songs/home; `?engine=superdough` is the kill switch; Sets/live keep the
 *  repl (the deck's channel kills reach into superdough's orbit buses). */
export function isZaltz(): boolean {
  try {
    if (typeof location === "undefined") return false; // SSR
    if (bootFailed) return false; // engine can't boot here — superdough takes over
    const q = location.search;
    if (q.includes("engine=superdough")) return false; // opt-out
    // explicit opt-in; "sourdough" honored forever — pre-rename links keep working
    if (q.includes("engine=zaltz") || q.includes("engine=sourdough")) return true;
    return true; // sets + live ride zaltz too (deck kills = sd_orbit_gain)
  } catch {
    return false;
  }
}

/** Deck channel kills: per-orbit OUTPUT gains, engine-side glide (~10ms).
 *  Mirrors applyOrbitGains' contract: gainFor(orbit) → target or undefined
 *  to leave the orbit alone. Deduped — the deck enforces 5×/s. */
const lastOrbitGain = new Map<number, number>();
export function zaltzApplyOrbitGains(gainFor: (orbit: number) => number | undefined): void {
  if (!node) return;
  const batch: { o: number; g: number }[] = [];
  for (let o = 0; o < 40; o++) {
    const g = gainFor(o);
    if (g === undefined) continue;
    const prev = lastOrbitGain.get(o);
    if (prev !== undefined && Math.abs(prev - g) < 0.001) continue;
    lastOrbitGain.set(o, g);
    batch.push({ o, g });
  }
  if (batch.length) node.port.postMessage({ orbitGains: batch });
}

/** Debug read of the orbit gains last sent to the engine (the dedupe cache) —
 *  lets the console verify a kill/release actually reached the worklet. */
export function zaltzOrbitGains(): [number, number][] {
  return [...lastOrbitGain];
}

/** Fire ONE voice through the engine right now — the live MIDI path. Returns
 *  false when the engine isn't ready or the sound is still loading (caller
 *  falls back to superdough for that press). */
export function zaltzLiveNote(opts: { s: string; note: number; gain: number; duration?: number }): boolean {
  if (!node || !ctxRef || ctxRef.state !== "running") return false;
  const duration = opts.duration ?? 0.8;
  const kv = hapKv(
    { s: opts.s, note: opts.note, gain: opts.gain, release: 0.2, orbit: 1 },
    duration,
  );
  if (!kv) return false; // zone still decoding — superdough covers this press
  node.port.postMessage({ ev: kv, t: ctxRef.currentTime + 0.012 });
  return true;
}

/** Live tempo change (the deck's NUDGE): keep the CYCLE position, re-anchor
 *  the clock — the same math as zaltzEvaluate's tempo pivot. */
export function zaltzSetCps(newCps: number): void {
  if (!(newCps > 0) || !ctxRef || !pattern || newCps === cps) return;
  const at = pausedAt ?? ctxRef.currentTime;
  const cyclesNow = (at - t0) * cps;
  t0 = at - cyclesNow / newCps;
  cps = newCps;
}

/** True while OUR engine owns the playing session — state calls (pause,
 *  resume, hush, stop, the position clock) must follow the SESSION's engine,
 *  not the current URL (persistent playback survives navigation). */
export function zaltzActive(): boolean {
  return pattern != null || timer != null;
}

function dropOnce(what: string): void {
  if (droppedOnce.has(what)) return;
  droppedOnce.add(what);
  console.info(`[zaltz] not yet ported, dropped: ${what}`);
}

async function ensureNode(ac: AudioContext, out?: AudioNode | null): Promise<void> {
  if (node && ctxRef === ac && nodeReady) {
    try {
      await nodeReady;
      if (out && out !== outRef) {
        // the master appeared/changed — re-pour through it
        try { node.disconnect(); } catch { /* first connect */ }
        node.connect(out);
        outRef = out;
      }
      return;
    } catch {
      node.disconnect();
      node = null; // failed init — rebuild from scratch
    }
  }
  ctxRef = ac;
  outRef = out ?? null;
  nodeReady = (async () => {
    // Safari 18.0.x GC-reaps unpinned AudioWorkletProcessor constructors
    // (WebKit 279537) — ours included. Idempotent, no-op everywhere else;
    // usually ensureStarted already pinned this context, this is the backstop.
    await pinWorkletConstructors(ac);
    // VERSIONED URLS (content hash, stamped at build): the bare paths let a
    // stale etag 304 returning browsers onto an OLD engine forever — days of
    // fixes never reached the user's machine. A new hash = a new URL = the
    // fresh engine, unconditionally.
    await ac.audioWorklet.addModule(`/zaltz.worklet.js?v=${ENGINE_V}`);
    const [wasm] = await Promise.all([
      fetch(`/zaltz?v=${ENGINE_V}`).then((r) => r.arrayBuffer()),
    ]);
    node = new AudioWorkletNode(ac, "zaltz", { outputChannelCount: [2] });
    // pour through the app's MASTER (limiter chain + swallow/release gain +
    // the mobile background <audio> sink), NEVER straight into the DAC — a
    // dense wash past 1.0 hard-clips the destination: the "muddy, block your
    // ears" build-up. Fallback to destination only if no master exists.
    node.connect(outRef ?? ac.destination);
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error("zaltz worklet never became ready")),
        8000,
      );
      node!.port.onmessage = (e) => {
        if (e.data?.ready) {
          clearTimeout(to);
          resolve();
        } else if (e.data?.error) {
          clearTimeout(to);
          console.error("[zaltz] worklet:", e.data.error);
          reject(new Error(e.data.error));
        }
      };
      node!.port.postMessage({ wasm });
    });
    // steady-state messages: errors + the AUDIO-THREAD CLOCK. The clock is
    // what keeps background playback alive — hidden tabs clamp setInterval
    // to ≥1s (Safari especially), starving the lookahead into silence, but
    // MessagePort delivery from the running worklet is never throttled.
    node.port.onmessage = (e) => {
      if (e.data?.error) console.error("[zaltz] worklet:", e.data.error);
      else if (e.data?.eventError) console.warn("[zaltz] event rc", e.data.eventError);
      else if (e.data?.scrubbed != null)
        // the worklet zeroed non-finite output samples (lifetime count) —
        // audible as at worst a click, but real engine corruption upstream
        console.warn("[zaltz] scrubbed non-finite samples:", e.data.scrubbed);
      else if (e.data?.clock != null) {
        if (timer) tick(); // timer doubles as the "playing" flag — paused stays paused
      }
    };
  })();
  nodeReady = nodeReady.catch((e) => {
    // BOOT failure: this browser can't run the engine (no AudioWorklet, or
    // wasm features it doesn't support) — or the assets didn't load. Flip
    // the session to superdough (isZaltz() → false) instead of dying mute.
    bootFailed = true;
    try {
      node?.disconnect();
    } catch {
      /* never connected */
    }
    node = null;
    throw e;
  });
  return nodeReady;
}

// ---- sample resolution (same proxy manifests superdough loads) --------------
async function ensureMaps(): Promise<void> {
  if (maps) return;
  if (!mapsLoading) {
    mapsLoading = (async () => {
      const merged: Record<string, string[] | PitchedZone[]> = {};
      for (const m of ["d0", "d1", "d2", "d3", "d4", "d5", "lib"]) {
        try {
          const map = (await fetch(`/api/snd/m/${m}.json`).then((r) => r.json())) as Record<
            string,
            unknown
          >;
          const base = typeof map._base === "string" ? (map._base as string) : "";
          const abs = (u: unknown): string[] =>
            (Array.isArray(u) ? u : [u])
              .filter((x): x is string => typeof x === "string")
              .map((x) => (x.startsWith("http") ? x : base + x));
          for (const [k, v] of Object.entries(map)) {
            if (k === "_base") continue;
            if (Array.isArray(v)) {
              const list = abs(v);
              if (list.length) merged[k] = list;
              continue;
            }
            // object entry: note-keyed multisample map (strudel.json format,
            // e.g. piano {"A0": "A0v8.mp3", ...}) — KEEP the pitch structure;
            // flattening it makes every note play the first (lowest) zone
            const entries = Object.entries(v as Record<string, unknown>).filter(
              ([zk]) => !zk.startsWith("_"),
            );
            const zones: PitchedZone[] = [];
            for (const [zk, zv] of entries) {
              const midi = noteToMidi(zk);
              if (midi == null) break; // a non-note key → not a pitched map
              const urls = abs(zv);
              if (urls.length) zones.push({ midi, urls });
            }
            if (zones.length === entries.length && zones.length) merged[k] = zones;
            else {
              const list = entries.flatMap(([, zv]) => abs(zv));
              if (list.length) merged[k] = list;
            }
          }
        } catch {
          /* a missing manifest just narrows the palette */
        }
      }
      maps = merged;
    })();
  }
  return mapsLoading;
}

const UPLOAD_CHUNK = 65536; // floats (~256KB) — small enough per audio-thread message
function uploadPcm(id: number, frames: number, ch: number, pcm: Float32Array): void {
  if (!node) return;
  node.port.postMessage({ sampleAlloc: id, frames, channels: ch });
  for (let off = 0; off < pcm.length; off += UPLOAD_CHUNK) {
    const slice = pcm.slice(off, Math.min(off + UPLOAD_CHUNK, pcm.length));
    node.port.postMessage({ sampleChunk: id, offset: off, pcm: slice.buffer }, [slice.buffer]);
  }
}

const modIdx = (n: number, len: number): number => ((Math.round(n) % len) + len) % len;

// Older Safari implements only the callback form of decodeAudioData; wrap
// both shapes so every browser decodes the same way.
function decodeCompat(ac: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const p = ac.decodeAudioData(bytes, resolve, reject) as unknown as
        | Promise<AudioBuffer>
        | undefined;
      if (p && typeof p.then === "function") p.then(resolve, reject); // duplicate settle is a no-op
    } catch (e) {
      reject(e);
    }
  });
}

function loadUrl(url: string): Promise<number | null> {
  let p = urlIds.get(url);
  if (!p) {
    p = (async () => {
      if (!ctxRef || !node) return null;
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      const buf = await decodeCompat(ctxRef, bytes);
      const ch = Math.min(2, buf.numberOfChannels);
      const pcm = new Float32Array(buf.length * ch);
      for (let c = 0; c < ch; c++) {
        const data = buf.getChannelData(c); // GC-mutable view — copy out
        for (let i = 0; i < buf.length; i++) pcm[i * ch + c] = data[i];
      }
      const id = nextSampleId++;
      uploadPcm(id, buf.length, ch, pcm);
      sampleDur.set(id, buf.duration);
      return id;
    })();
    urlIds.set(url, p);
    p.catch(() => urlIds.delete(url)); // a failed fetch/decode may retry
  }
  return p;
}

function startSampleLoad(key: string, name: string, n: number, midi: number): void {
  sampleIds.set(key, "loading");
  trackLoad((async () => {
    try {
      await ensureMaps();
      const entry = maps?.[name];
      let url: string | undefined;
      let trans = 0;
      if (entry?.length && typeof entry[0] === "object") {
        // pitched map: nearest zone by midi, repitch the residual
        // (superdough util.mjs getCommonSampleInfo)
        const zones = entry as PitchedZone[];
        let best = zones[0];
        for (const z of zones) if (Math.abs(z.midi - midi) < Math.abs(best.midi - midi)) best = z;
        trans = midi - best.midi;
        url = best.urls[modIdx(n, best.urls.length)];
      } else if (entry?.length) {
        const urls = entry as string[];
        url = urls[modIdx(n, urls.length)];
        trans = midi - 36; // superdough repitches plain banks relative to 36
      }
      if (!url || !ctxRef || !node) {
        dropOnce(`sample ${name}`);
        sampleIds.delete(key);
        return;
      }
      const id = await loadUrl(url);
      if (id == null) {
        sampleIds.delete(key);
        return;
      }
      sampleTrans.set(key, trans);
      sampleIds.set(key, id);
    } catch {
      sampleIds.delete(key); // retried on the next hap
    }
  })());
}

const gmMeta = new Map<number, { rate: number; loop: boolean; loopBegin: number; loopEnd: number }>();
function startGmLoad(key: string, s: string, n: number, midi: number): void {
  sampleIds.set(key, "loading");
  trackLoad((async () => {
    try {
      await ensureFonts();
      const fonts = gmMap?.[s];
      if (!fonts?.length || !ctxRef || !node || !fontMod) {
        dropOnce(`gm ${s}`);
        sampleIds.delete(key);
        return;
      }
      const font = fonts[n % fonts.length];
      const { buffer, zone } = await fontMod.getFontPitch(font, midi, ctxRef);
      const ch = Math.min(2, buffer.numberOfChannels);
      const pcm = new Float32Array(buffer.length * ch);
      for (let c = 0; c < ch; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < buffer.length; i++) pcm[i * ch + c] = data[i];
      }
      const id = nextSampleId++;
      uploadPcm(id, buffer.length, ch, pcm);
      // fontloader.mjs:53-56: rate = 2^((100·midi − baseDetune)/1200)
      const baseDetune =
        zone.originalPitch - 100 * (zone.coarseTune ?? 0) - (zone.fineTune ?? 0);
      const rate = Math.pow(2, (100 * midi - baseDetune) / 1200);
      const loop = zone.loopStart > 1 && zone.loopStart < zone.loopEnd;
      gmMeta.set(id, {
        rate,
        loop,
        loopBegin: loop ? zone.loopStart / zone.sampleRate / buffer.duration : 0,
        loopEnd: loop ? zone.loopEnd / zone.sampleRate / buffer.duration : 1,
      });
      sampleIds.set(key, id);
    } catch (e) {
      console.warn("[zaltz] gm zone load failed", s, midi, e);
      sampleIds.delete(key);
    }
  })());
}

// ---- hap → engine event ------------------------------------------------------
const SYNTHS = new Set(["sine", "sawtooth", "saw", "square", "triangle", "tri", "supersaw", "white", "pink", "brown", "crackle"]);
const NOTE_SEM: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function noteToMidi(n: unknown): number | null {
  if (typeof n === "number") return n;
  // octave optional — strudel's note("c e g") defaults to octave 3 (c3 = 48)
  const m = /^([a-g])([#bs]*)(-?\d+)?$/.exec(String(n).toLowerCase());
  if (!m) return null;
  let sem = NOTE_SEM[m[1]];
  for (const acc of m[2]) sem += acc === "#" || acc === "s" ? 1 : -1;
  return (Number(m[3] ?? 3) + 1) * 12 + sem;
}

// JS Number→string uses scientific notation outside ~[1e-6, 1e21) — the
// engine's parser reads plain decimals, so "3e-9" would land as 3. Every
// value that enters an event string goes through here.
function fnum(x: number): string {
  if (!Number.isFinite(x)) return "0";
  const s = String(x);
  if (!s.includes("e") && !s.includes("E")) return s;
  if (Math.abs(x) >= 1e15) x = Math.sign(x) * 1e15; // toFixed re-exponentiates ≥1e21; nothing audible lives up there
  const fixed = x.toFixed(12); // 1e-12 resolution — below anything audible
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return trimmed === "" || trimmed === "-" ? "0" : trimmed;
}

const NUM_KEYS = [
  "attack", "decay", "sustain", "release", "gain", "velocity", "postgain", "pan",
  "lpattack", "lpdecay", "lpsustain", "lprelease", "lpenv", "vib", "vibmod",
  "unison", "spread", "detune", "speed", "begin", "end", "loop", "loopBegin", "loopEnd",
  "orbit", "room", "roomlp", "delay", "delaytime", "delayfeedback",
  "shape", "shapevol", "duckonset", "duckattack", "duckdepth",
  "crush", "coarse", "cut", "drive", "density", "phaserrate", "phaserdepth", "phasercenter", "phasersweep",
] as const;
const RENAME: Record<string, string> = {
  cutoff: "lpf", lpf: "lpf", resonance: "lpq", lpq: "lpq",
  hcutoff: "hpf", hpf: "hpf", hresonance: "hpq", hpq: "hpq",
  size: "roomsize", roomsize: "roomsize", rsize: "roomsize", sz: "roomsize",
};

function hapKv(v: HapValue, durationSec: number): string | null {
  let s = typeof v.s === "string" ? v.s : "triangle";
  if (v.bank && typeof v.bank === "string" && v.s) s = `${v.bank}_${v.s}`;
  const parts: string[] = [];
  let duration = durationSec;
  let repitched = false;

  if (s.startsWith("gm_")) {
    // gm zones: resolve (font, midi) → decoded, crossfaded buffer, uploaded
    // once; play through the LOOPING sample voice at the zone's playbackRate
    // (fontloader.mjs:53-68 math), env max 0.3 (fontloader getParamADSR).
    const midi = noteToMidi(v.note ?? 60);
    if (midi == null) return null;
    const n = typeof v.n === "number" ? v.n : 0;
    const key = `gm:${s}:${n}:${midi}`;
    const entry = sampleIds.get(key);
    if (entry === undefined) {
      startGmLoad(key, s, n, midi);
      return null; // skip while the zone decodes — superdough does the same
    }
    if (entry === "loading") return null;
    const meta = gmMeta.get(entry);
    if (!meta) return null;
    parts.push(`s/sample`, `sample/${entry}`, `speed/${fnum(meta.rate)}`);
    if (meta.loop) parts.push(`loop/1`, `loopBegin/${fnum(meta.loopBegin)}`, `loopEnd/${fnum(meta.loopEnd)}`);
    // fontloader's env peaks at 0.3 (getParamADSR max, fontloader.mjs:165);
    // gain default is 0.8 like every superdough source (superdough.mjs:182)
    const g = typeof v.gain === "number" ? v.gain : 0.8;
    const vel = typeof v.velocity === "number" ? v.velocity : 1;
    parts.push(`gain/${fnum(0.3 * g * vel)}`);
    for (const k of NUM_KEYS) {
      if (k === "gain" || k === "velocity" || k === "speed" || k === "loop" || k === "loopBegin" || k === "loopEnd") continue;
      const val = v[k];
      if (typeof val === "number" && Number.isFinite(val)) parts.push(`${k}/${fnum(val)}`);
    }
    for (const [from, to] of Object.entries(RENAME)) {
      const val = v[from];
      if (typeof val === "number" && Number.isFinite(val)) parts.push(`${to}/${fnum(val)}`);
    }
    if (v.duck != null) parts.push(`duck/${String(v.duck)}`);
    if (typeof v.ftype === "string") parts.push(`ftype/${v.ftype}`);
    parts.push(`duration/${fnum(duration)}`);
    return parts.join("/");
  }
  if (SYNTHS.has(s)) {
    parts.push(`s/${s === "saw" ? "sawtooth" : s === "tri" ? "triangle" : s}`);
    if (v.freq != null) parts.push(`freq/${fnum(Number(v.freq))}`);
    else {
      const midi = noteToMidi(v.note ?? 36);
      if (midi == null) return null;
      parts.push(`note/${midi}`);
    }
  } else {
    const n = typeof v.n === "number" ? v.n : 0;
    // superdough valueToMidi: freq wins, then note, fallback 36 — the default
    // that leaves unpitched banks unrepitched; pitched maps pick their zone
    const midi =
      typeof v.freq === "number" && Number.isFinite(v.freq)
        ? 69 + 12 * Math.log2(v.freq / 440)
        : (noteToMidi(v.note ?? 36) ?? 36);
    const key = `${s}:${n}:${midi}`;
    const id = sampleIds.get(key);
    if (id === undefined) {
      startSampleLoad(key, s, n, midi);
      return null; // superdough also skips while a sample decodes
    }
    if (id === "loading") return null;
    parts.push(`s/sample`, `sample/${id}`);
    const trans = sampleTrans.get(key) ?? 0;
    const speed = Number(v.speed ?? 1) * Math.pow(2, trans / 12);
    if (trans !== 0) {
      parts.push(`speed/${fnum(speed)}`);
      repitched = true; // the NUM_KEYS pass must not re-emit the raw speed
    }
    // duration = sliceDuration when clip/loop/release absent (sampler.mjs:314)
    if (v.clip == null && v.loop == null && v.release == null) {
      duration = (sampleDur.get(id) ?? durationSec) / (Math.abs(speed) || 1);
    }
  }

  for (const k of NUM_KEYS) {
    if (k === "speed" && repitched) continue; // combined value already pushed
    const val = v[k];
    if (typeof val === "number" && Number.isFinite(val)) parts.push(`${k}/${fnum(val)}`);
  }
  for (const [from, to] of Object.entries(RENAME)) {
    const val = v[from];
    if (typeof val === "number" && Number.isFinite(val)) parts.push(`${to}/${fnum(val)}`);
  }
  if (v.duck != null) parts.push(`duck/${String(v.duck)}`); // "2:3" target list
  if (typeof v.ftype === "string") parts.push(`ftype/${v.ftype}`); // ladder | 24db
  if (typeof v.phaser === "number" && Number.isFinite(v.phaser)) parts.push(`phaserrate/${fnum(v.phaser)}`);
  for (const heavy of ["chorus"]) {
    if (v[heavy] != null) dropOnce(`${heavy} (superdough has no chorus either)`);
  }
  parts.push(`duration/${fnum(duration)}`);
  return parts.join("/");
}

// ---- the lookahead loop -------------------------------------------------------
function tick(): void {
  if (!pattern || !node || !ctxRef) return;
  const now = ctxRef.currentTime;
  const target = (now - t0 + LOOKAHEAD) * cps;
  if (target <= cursor) return;
  let haps: Hap[] = [];
  try {
    haps = pattern.queryArc(cursor, target, { _cps: cps }).filter((h) => h.hasOnset());
  } catch (e) {
    console.error("[zaltz] query failed", e);
    cursor = target;
    return;
  }
  const batch: { ev: string; t: number }[] = [];
  for (const h of haps) {
    try {
      h.ensureObjectValue();
      const beginCycles = h.whole.begin.valueOf();
      const tAbs = t0 + beginCycles / cps;
      const kv = hapKv(h.value, h.duration.valueOf() / cps);
      if (kv) batch.push({ ev: kv, t: tAbs });
    } catch {
      /* one bad hap must not kill the walk */
    }
  }
  // ONE message per tick: a dense section start posts ~100 haps, and 100
  // structured clones landing on the audio thread in one gap is GC chum —
  // WebKit's worklet GC pauses are audible (the Safari-only ticks)
  if (batch.length) node.port.postMessage({ evs: batch });
  cursor = target;
}

// ---- public surface (called from lib/strudel-client) --------------------------
let collectorInstalled = false;
let pPatterns: Record<string, unknown> = {};
let anonIndex = 0;
let capturedCpm: number | null = null;

async function ensureScope(): Promise<void> {
  if (!scopeReady)
    scopeReady = (async () => {
      const [core, mini, tonal, trans] = await Promise.all([
        import("@strudel/core"),
        import("@strudel/mini"),
        import("@strudel/tonal"),
        import("@strudel/transpiler"),
      ]);
      coreMod = core as unknown as StrudelCore;
      transpilerFn = (trans as { transpiler: unknown }).transpiler;
      await coreMod.evalScope(core, mini, tonal);
    })();
  await scopeReady;
}

/** Evaluate a program for ZALTZ: transpile + collect the pattern, swap it
 *  into the running loop (cycle cursor kept — rebuild semantics), and make
 *  sure the worklet is up. Visuals are not run (audio-only A/B). */
export async function zaltzEvaluate(
  code: string,
  ac: AudioContext,
  out?: AudioNode | null,
  /** CROSSFADE TAKEOVER: a new loop over a LIVE session — the old music
   *  retires (1.2s engine-side fade, tails ring) under the new downbeat
   *  instead of being hushed into a silence hole. */
  takeover = false,
): Promise<void> {
  await ensureScope();
  await ensureNode(ac, out);
  // collect `$:` lines through OUR prototype hook for the duration of the eval
  const Pattern = coreMod!.Pattern;
  const prevP = (Pattern.prototype as unknown as { p?: unknown }).p;
  const prevCpm = (globalThis as Record<string, unknown>).setcpm;
  pPatterns = {};
  anonIndex = 0;
  capturedCpm = null;
  (Pattern.prototype as unknown as Record<string, unknown>).p = function (id: unknown) {
    if (typeof id === "string" && (id.startsWith("_") || id.endsWith("_"))) return coreMod!.silence;
    let key = String(id);
    if (key.includes("$")) key = `${key}${anonIndex++}`;
    pPatterns[key] = this;
    return this;
  };
  (globalThis as Record<string, unknown>).setcpm = (x: number) => {
    capturedCpm = x;
  };
  collectorInstalled = true;
  try {
    const evaled = (await coreMod!.evaluate(code, transpilerFn)) as { pattern?: Pat } | Pat | null;
    const collected = Object.values(pPatterns);
    const pat = collected.length
      ? (coreMod!.stack(...(collected as never[])) as unknown as Pat)
      : (((evaled as { pattern?: Pat })?.pattern ?? evaled) as Pat | null);
    if (!pat || typeof pat.queryArc !== "function") throw new Error("no pattern in program");
    const newCps = (capturedCpm ?? 30) / 60;
    if (takeover && timer && pattern) {
      sdTrace("evaluate TAKEOVER");
      // warm the incoming loop's sounds while the OLD one keeps playing —
      // the takeover waits for loads with music, not silence
      try {
        for (const h of pat.queryArc(0, 1, { _cps: newCps })) {
          if (!h.hasOnset()) continue;
          try {
            h.ensureObjectValue();
            hapKv(h.value, h.duration.valueOf() / newCps);
          } catch {
            /* one odd hap must not block the warm-up */
          }
        }
        const cap = new Promise<void>((r) => setTimeout(r, 1500));
        while (pendingLoads.size) {
          const settled = Promise.allSettled([...pendingLoads]).then(() => undefined);
          if ((await Promise.race([settled, cap.then(() => "cap" as const)])) === "cap") break;
        }
      } catch {
        /* warm-up is best-effort */
      }
      node?.port.postMessage({ retire: 1.2 }); // old music fades under the new
      t0 = ac.currentTime + 0.2;
      cursor = 0;
      pausedAt = null;
      cps = newCps;
      pattern = pat;
      tick();
      return;
    }
    if (!timer || !pattern) {
      sdTrace("evaluate FRESH");
      // WARM THE FIRST CYCLE before the downbeat exists: fire every sample/
      // zone load the opening bar needs (hapKv starts loads and returns null
      // while they're in flight) and wait for them — BOUNDED, so a slow
      // network delays the start slightly instead of stalling it. Without
      // this a fresh play began with layers MISSING and popping in as
      // decodes landed ("trips out for a moment, then gets normal"); the
      // first-ever play masked it only because engine boot took longer than
      // the loads.
      try {
        for (const h of pat.queryArc(0, 1, { _cps: newCps })) {
          if (!h.hasOnset()) continue;
          try {
            h.ensureObjectValue();
            hapKv(h.value, h.duration.valueOf() / newCps); // fires the loads
          } catch {
            /* one odd hap must not block the warm-up */
          }
        }
        const cap = new Promise<void>((r) => setTimeout(r, 1500));
        while (pendingLoads.size) {
          const settled = Promise.allSettled([...pendingLoads]).then(() => undefined);
          if ((await Promise.race([settled, cap.then(() => "cap" as const)])) === "cap") break;
        }
      } catch {
        /* warm-up is best-effort — the load-then-skip fallback still applies */
      }
      // fresh start: cycle 0 lands slightly ahead so the first haps schedule cleanly
      t0 = ac.currentTime + 0.15;
      cursor = 0;
      pausedAt = null;
      startTimer();
    } else if (newCps !== cps && cps > 0) {
      sdTrace("evaluate TEMPO-PIVOT");
      // tempo change mid-flight: keep the CYCLE position, re-anchor the clock
      const cyclesNow = (ac.currentTime - t0) * cps;
      t0 = ac.currentTime - cyclesNow / newCps;
    }
    cps = newCps;
    if (timer && pattern) sdTrace("evaluate SWAP");
    pattern = pat; // swap in place — the cursor keeps counting (repl semantics)
    tick(); // fill the lookahead immediately
  } finally {
    if (collectorInstalled) {
      (Pattern.prototype as unknown as Record<string, unknown>).p = prevP;
      (globalThis as Record<string, unknown>).setcpm = prevCpm;
      collectorInstalled = false;
    }
  }
}

/** The repl's hush analog: next evaluate starts from cycle 0's downbeat. */
function sdTrace(what: string): void {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("klappnDebug"))
      console.log(`[klappn/zaltz] ${what} @${ctxRef ? ctxRef.currentTime.toFixed(2) : "?"}s`);
  } catch {
    /* trace only */
  }
}

export function zaltzHush(): void {
  sdTrace("hush");
  stopTimer(); // the next evaluate restarts scheduling from ITS downbeat
  pattern = null;
  cursor = 0;
  lastOrbitGain.clear(); // hush resets engine gains to 1 — don't dedupe against stale values
  if (ctxRef) t0 = ctxRef.currentTime + 0.15;
  node?.port.postMessage({ hush: true });
}

/** The engine's cycle clock — same semantics as the repl's scheduler.now():
 *  cycles since the last downbeat (hush/eval), frozen across pause. The UI's
 *  playhead, section highlight and watcher all read position through this. */
export function zaltzCycleNow(): number {
  if (!ctxRef || !pattern) return 0;
  const at = pausedAt ?? ctxRef.currentTime;
  return (at - t0) * cps;
}

let pausedAt: number | null = null;
/** Pause = the lookahead stops feeding (scheduled tails ring out). */
export function zaltzPause(): void {
  stopTimer();
  if (pausedAt == null) pausedAt = ctxRef?.currentTime ?? null; // double-pause keeps the FIRST freeze point
}
/** Resume = shift the cycle clock by the pause length and keep counting. */
export function zaltzResume(): void {
  if (timer || !pattern) return;
  if (pausedAt != null && ctxRef) t0 += ctxRef.currentTime - pausedAt;
  pausedAt = null;
  startTimer();
  tick();
}

/** Full stop: scheduling ends, ringing voices are cleared, samples kept. */
export function zaltzStop(): void {
  sdTrace("stop");
  stopTimer();
  pattern = null;
  cursor = 0;
  pausedAt = null;
  lastOrbitGain.clear();
  node?.port.postMessage({ hush: true });
}
