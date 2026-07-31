"use client";

/**
 * LIVE HYDRA ON THE LISTENER — the DJ streams only AUDIO; every phone renders the
 * visuals NATIVELY, at full GPU quality, from a few lines of text.
 *
 * Why this works: klappn's visuals take ALL their motion from `H(signal)` — the
 * Strudel→Hydra bridge that samples a continuous signal (saw/sine/tri/perlin) on
 * the transport clock, `getTime()`, measured in CYCLES (Hydra's own wall-clock is
 * frozen; see HYDRA_SPEC). So if we feed `getTime()` a cycle position reconstructed
 * from the live state (sectionStartedAt + tempo), the EXACT same code the DJ wrote
 * renders here in lockstep with the streamed sound — no video frames, no bandwidth,
 * no compression, no glitching. A picture that is generated, not transmitted.
 *
 * This module is deliberately independent of the audio engine (lib/strudel-client):
 * it pulls only @strudel/hydra + hydra-synth + @strudel/core's signal math, so the
 * listener bundle never loads superdough / Web Audio. The one shared global is the
 * @strudel/core time source, which we own via setTime().
 *
 * EVERYTHING is dynamically imported inside initLiveHydra (browser-only): the /live
 * route is server-rendered on the Cloudflare Worker, and a STATIC import of any
 * @strudel/* here would evaluate at SSR and crash the page (matches the rest of the
 * codebase — Strudel is never in the SSR graph).
 */

// The evaluated Hydra chains need H() + the continuous signals in scope; the
// hydra-synth sources (osc/noise/…) arrive as globals via makeGlobal.
const SIGNAL_KEYS = [
  "saw", "saw2", "isaw", "isaw2", "sine", "sine2", "cosine", "cosine2",
  "tri", "tri2", "square", "square2", "perlin", "time", "reify", "mul", "add",
] as const;

let inited = false;
let anchored = false;
// The reconstructed transport: cycle = baseCycle + (now − t0) · cps.
let cps = 0.5;
let baseCycle = 0;
let t0 = 0;

const nowSec = () => performance.now() / 1000;
const currentCycle = () => baseCycle + (nowSec() - t0) * cps;

/** Stream latency estimate (s): the audio a listener hears now was produced by
 *  the DJ this long ago, so the visuals lag the DJ's transport by the same amount
 *  to line up with the SOUND (not the DJ's screen). Phase-only — tempo is exact
 *  regardless. Roughly the jitter buffer (300ms) + a little network. */
const STREAM_LATENCY_S = 0.45;

/** Boot Hydra on the listener (idempotent). Creates the shared #hydra-canvas
 *  (fixed, full-screen, styled by globals.css) and installs OUR transport clock
 *  as the @strudel/core time source. Returns false if WebGL/Hydra can't run. */
export async function initLiveHydra(pixelRatio = 1): Promise<boolean> {
  if (inited) return true;
  if (typeof window === "undefined") return false;

  // ZISSL-FIRST (WebGPU): our own engine speaks the same language on the same
  // canvas id — the DJ's exact code renders here too, just on the new machine.
  // hydra-synth below stays as the WebGL fallback (?zissl=0 forces it).
  try {
    const { zisslAllowed, ensureVisualCanvas } = await import("./zissl-boot");
    if (zisslAllowed()) {
      const g = globalThis as Record<string, unknown>;
      const [{ default: Zissl }, core] = await Promise.all([
        import("zissl"),
        import("@strudel/core") as Promise<Record<string, unknown>>,
      ]);
      const canvas = ensureVisualCanvas("hydra-canvas", pixelRatio);
      const z = await Zissl.create({
        canvas,
        width: Math.max(1, Math.floor(window.innerWidth * pixelRatio)),
        height: Math.max(1, Math.floor(window.innerHeight * pixelRatio)),
        makeGlobal: true,
      });
      for (const k of SIGNAL_KEYS) if (core[k] !== undefined) g[k] = core[k];
      await registerMiniNotation(core);
      // BOTH clocks point at the reconstructed transport: zissl's H samples it
      // directly, and @strudel/core's getTime() serves any code reading it raw.
      z.setTime(() => currentCycle());
      (z as unknown as { setReify?: (fn: unknown) => void }).setReify?.(core.reify);
      (core.setTime as (fn: () => number) => void)(() => currentCycle());
      // Total H — a sick clock instant must hold the last frame, never throw.
      // Strings reify first: mini-notation ("<0!4 1!8>") is half the vocabulary,
      // and zissl's own H only accepts pattern objects (a bare string read 0
      // forever — a silently black picture).
      const rawH = z.H;
      const reify = core.reify as ((x: unknown) => unknown) | undefined;
      g.H = (p: unknown) => {
        const arg = typeof p === "string" || typeof p === "number" ? (reify?.(p) ?? p) : p;
        const inner = rawH(arg as never);
        let last = 0;
        return () => {
          try {
            const v = inner();
            if (typeof v === "number" && Number.isFinite(v)) last = v;
          } catch {
            /* hold the last good value */
          }
          return last;
        };
      };
      inited = true;
      return true;
    }
  } catch (e) {
    console.warn("[klappn] zissl live boot failed — falling back to hydra", e);
  }

  try {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.global === "undefined") g.global = globalThis;
    // hydra-synth is authored for Node (references `global`); alias it first.
    const core = (await import("@strudel/core")) as Record<string, unknown>;
    const hydraMod = (await import("@strudel/hydra")) as {
      H: (p: unknown) => () => unknown;
      initHydra: (o: Record<string, unknown>) => Promise<unknown>;
    };
    const synth = (await import("hydra-synth")) as { default?: unknown };
    g.Hydra = synth.default ?? synth;
    g.H = hydraMod.H;
    for (const k of SIGNAL_KEYS) if (core[k] !== undefined) g[k] = core[k];

    // getTime() → our synced cycle position. Set BEFORE init so the first frame
    // the render loop draws already samples the right transport moment.
    (core.setTime as (fn: () => number) => void)(() => currentCycle());

    // initHydra imports its synth from `src`; hand it a no-op blob so there's no
    // CDN fetch (g.Hydra above is the real one).
    const noop = URL.createObjectURL(
      new Blob(["export default {}"], { type: "text/javascript" }),
    );
    await hydraMod.initHydra({
      src: noop,
      detectAudio: false, // visuals are H-driven, not FFT-reactive
      pixelated: false,
      pixelRatio,
    });
    inited = true;
    return true;
  } catch {
    return false;
  }
}

/** True once Hydra is up. */
export function liveHydraReady(): boolean {
  return inited;
}

/** Change TEMPO without moving position — pin the current cycle, change only the
 *  slope. A tempo change (a new song's bpm) stays perfectly continuous: no jump. */
function retempo(cpsNext: number): void {
  if (!(cpsNext > 0) || cpsNext === cps) return;
  if (anchored) {
    baseCycle = currentCycle(); // hold where we are…
    t0 = nowSec();
  }
  cps = cpsNext; // …only the rate changes
}

/** ANCHOR the initial phase — the first time we see the stream, or after a session
 *  reset (the DJ restarted). cycleTarget = cycles-since-heard, latency-corrected. */
function anchorPhase(cycleTarget: number, cpsNext: number): void {
  cps = cpsNext > 0 ? cpsNext : cps;
  baseCycle = Math.max(0, cycleTarget);
  t0 = nowSec();
  anchored = true;
}

/** Drop the anchor so the NEXT sync re-seeds the phase — call when the broadcast
 *  session changes (a fresh transport). */
export function resetLiveTransport(): void {
  anchored = false;
}

/** Keep the listener's transport CONTINUOUS — the source of "no jolts between
 *  loops". The DJ plays the whole set as ONE arrange: getTime() never resets at a
 *  loop boundary, so the single visual flows seamlessly. We mirror that exactly —
 *  anchor the phase ONCE (from the section-start the first time we see the stream),
 *  then just KEEP FLOWING at cps. We deliberately do NOT re-seed the position each
 *  section (that per-section reset WAS the jolt); only the tempo tracks the DJ, and
 *  it re-tempos seamlessly. Phase re-aligns only on a session reset. */
export function syncFromState(
  sectionStartedAt: number,
  serverSkewMs: number,
  cpsNext: number,
): void {
  if (!anchored) {
    const heardMs =
      Date.now() + serverSkewMs - sectionStartedAt - STREAM_LATENCY_S * 1000;
    anchorPhase(Math.max(0, heardMs / 1000) * cpsNext, cpsNext);
  } else {
    retempo(cpsNext);
  }
}

/** The listener page boots the picture WITHOUT the strudel repl, so nothing has
 *  taught @strudel/core how to read a string. Teach it here, or every
 *  `H("<0!4 1!8>")` in the DJ's sketch reads a flat 0 on the listener's screen
 *  while it gates properly on the DJ's. Best-effort and idempotent. */
async function registerMiniNotation(core: Record<string, unknown>): Promise<void> {
  try {
    const setStringParser = core.setStringParser as ((p: unknown) => void) | undefined;
    const reify = core.reify as
      | ((x: unknown) => { queryArc?: (a: number, b: number) => Array<{ value: unknown }> })
      | undefined;
    if (!setStringParser || !reify) return;
    // An untaught core still returns a Pattern for a string — pure("<1 2>") —
    // so the honest probe is the VALUE: taught, it's the number 1.
    if (typeof reify("<1 2>")?.queryArc?.(0, 0)?.[0]?.value === "number") return;
    const mini = (await import("@strudel/mini")) as { mini?: unknown };
    if (mini.mini) setStringParser(mini.mini);
  } catch {
    /* no mini bundle — H(string) falls back to a plain number, never a throw */
  }
}

/** Run a Hydra program (one chain ending in .out()). Swallows errors — a bad
 *  visual must never take down the listener's audio. */
export function runLiveHydra(code: string | null | undefined): void {
  if (!inited || !code) return;
  try {
    // AsyncFunction: the dialect's own openers (`await initHydra()`, `await
    // s0.initCam()`) are top-level awaits — a plain Function throws on them
    // before the first chain is built. Same code, one more legal shape.
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
      body: string,
    ) => () => Promise<void>;
    void new AsyncFunction(code)().catch(() => {
      /* malformed chain — keep the last good picture */
    });
  } catch {
    /* malformed chain — keep the last good picture */
  }
}

/** Silence the picture (DJ ended / listener left). */
export function clearLiveHydra(): void {
  try {
    (globalThis as { hush?: () => void }).hush?.();
  } catch {
    /* ignore */
  }
}
