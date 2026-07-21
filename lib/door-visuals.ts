/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE DOOR'S OWN LIGHT — a self-contained, self-healing visual engine,
 * rebuilt from first principles for the signed-out page.
 *
 * WHY IT EXISTS: the app's music-engine hydra path shares globals, a clock
 * bridge (H()), and an unstoppable library rAF loop with the strudel world —
 * and on some machines the picture died at play and could never come back.
 * This engine shares NOTHING:
 *
 *   - `makeGlobal: false` — hydra's vocabulary lives on OUR instance, so the
 *     strudel-collision law (bare noise()/shape()/src() silently killing a
 *     program) cannot exist here. Feedback trails, noise, shape — all back.
 *   - OUR render loop (`autoLoop: false`) — every frame is wrapped in
 *     try/catch, so a throwing sketch can never kill rendering.
 *   - A WATCHDOG — if frames stop advancing while the page is visible, the
 *     whole instance (canvas, context, loop) is torn down and rebuilt.
 *   - PURE TIME — the art runs on hydra's own clock. No strudel time source,
 *     no pattern queries per frame. The music's bpm is baked into each piece
 *     as a number; play/pause only changes the SPEED of light.
 *
 * The pieces themselves are hand-authored: bold, kaleidoscopic, trailing —
 * art first, wallpaper never.
 */

export interface DoorLook {
  name: string;
  /** The orb's own colour on the deck. */
  tint: string;
  /** The duotone ink — multiplied over grayscale geometry; components above 1
   *  push the hottest highlights toward white. */
  rgb: [number, number, number];
  /** Motion multiplier — how hard the piece moves under this light. */
  energy: number;
}

interface Piece {
  name: string;
  match: RegExp;
  looks: [DoorLook, DoorLook, DoorLook];
  paint(s: any, L: DoorLook, bpm: number, seed: number): void;
}

/** SIX PIECES — one per mood, matched on the song's genre line. The palette
 *  law: geometry is built GRAYSCALE (osc offset 0, voronoi/noise/shape), with
 *  real black negative space, then inked by the look's duotone — dark stays
 *  ink-black, midtones take the colour, the hottest highlights bloom toward
 *  white (rgb components above 1). Every piece moves visibly within a second
 *  and feeds back on itself — art, never wallpaper, never a rainbow. */
const PIECES: Piece[] = [
  {
    // spinning crystalline mandala, shattering and re-forming
    name: "Mandala",
    match: /techno|trance|edm|electro|rave/i,
    looks: [
      { name: "Ember", tint: "#ff63c1", rgb: [1.35, 0.35, 0.95], energy: 1 },
      { name: "Ice", tint: "#5fc9ff", rgb: [0.5, 0.95, 1.35], energy: 0.75 },
      { name: "Ultraviolet", tint: "#9b5cff", rgb: [0.95, 0.45, 1.4], energy: 1.3 },
    ],
    paint(s, L, bpm, seed) {
      s.voronoi(5 + seed * 4, 1.1 * L.energy, 0.6)
        .kaleid(6)
        .modulateRotate(s.osc(2 + seed * 2, 0.1 * L.energy, 0), 0.5)
        .modulateScale(s.osc(0.4, 0.05, 0), 0.2)
        .rotate(({ time }: any) => time * 0.05 * L.energy)
        .blend(s.src(s.o0).scale(1.01).rotate(0.003), 0.45)
        .contrast(1.6)
        .color(...L.rgb)
        .brightness(-0.03)
        .out(s.o0);
    },
  },
  {
    // silk smoke curling over itself, slow and heavy
    name: "Smoke",
    match: /jazz|hop|lo-?fi|soul|r&b|funk/i,
    looks: [
      { name: "Velvet", tint: "#e0319c", rgb: [1.3, 0.35, 0.9], energy: 1 },
      { name: "Brass", tint: "#ffb15c", rgb: [1.35, 0.85, 0.45], energy: 0.8 },
      { name: "Midnight", tint: "#5c74ff", rgb: [0.45, 0.6, 1.3], energy: 0.65 },
    ],
    paint(s, L, bpm, seed) {
      s.osc(3 + seed * 1.5, 0.07 * L.energy, 0)
        .modulate(s.noise(2.4 + seed, 0.12 * L.energy).scale(1.3), 0.6)
        .rotate(({ time }: any) => time * 0.012 * L.energy)
        .contrast(1.7)
        .blend(s.src(s.o0).scale(1.015).scrollY(0, -0.0015), 0.55)
        .color(...L.rgb)
        .brightness(-0.06)
        .out(s.o0);
    },
  },
  {
    // fast liquid ribbons tearing through cells
    name: "Tides",
    match: /drum|dnb|d&b|liquid|jungle|break/i,
    looks: [
      { name: "Tideline", tint: "#4fd8e8", rgb: [0.4, 1.15, 1.3], energy: 1 },
      { name: "Rose", tint: "#ff63c1", rgb: [1.35, 0.4, 0.95], energy: 1.2 },
      { name: "Abyss", tint: "#4a5cff", rgb: [0.45, 0.55, 1.35], energy: 0.85 },
    ],
    paint(s, L, bpm, seed) {
      s.osc(9 + seed * 3, 0.12 * L.energy, 0)
        .modulateScale(s.osc(1.5, 0.09 * L.energy, 0).rotate(1.57), 0.5)
        .diff(s.voronoi(5 + seed * 3, 2, 0.3))
        .modulate(s.src(s.o0).scale(1.04), 0.18)
        .contrast(1.6)
        .color(...L.rgb)
        .out(s.o0);
    },
  },
  {
    // an infinite tunnel that BREATHES AT THE SONG'S TEMPO
    name: "Tunnel",
    match: /house|disco|garage|club/i,
    looks: [
      { name: "Heat", tint: "#ff8a5c", rgb: [1.4, 0.65, 0.4], energy: 1 },
      { name: "Neon", tint: "#ff63c1", rgb: [1.35, 0.35, 1.05], energy: 1.25 },
      { name: "Mint", tint: "#5cffb1", rgb: [0.45, 1.3, 0.85], energy: 0.8 },
    ],
    paint(s, L, bpm, seed) {
      const beat = ((bpm || 120) / 60) * Math.PI;
      s.shape(64, 0.3 + seed * 0.1, 0.5)
        .scale(({ time }: any) => 1 + 0.14 * L.energy * Math.sin(time * beat))
        .diff(s.osc(6, 0.08 * L.energy, 0))
        .blend(s.src(s.o0).scale(0.93), 0.55)
        .kaleid(4)
        .contrast(1.5)
        .color(...L.rgb)
        .brightness(-0.04)
        .out(s.o0);
    },
  },
  {
    // dark ink blooming into petals, closing, blooming again
    name: "Bloom",
    match: /trip|down|dub|chill|ambient hop/i,
    looks: [
      { name: "Nightshade", tint: "#b3126f", rgb: [1.2, 0.25, 0.75], energy: 1 },
      { name: "Ashes", tint: "#a9b4c9", rgb: [0.85, 0.9, 1.0], energy: 0.7 },
      { name: "Absinthe", tint: "#9fff5c", rgb: [0.75, 1.3, 0.45], energy: 1.15 },
    ],
    paint(s, L, bpm, seed) {
      s.noise(1.7 + seed, 0.09 * L.energy)
        .thresh(0.5, 0.3)
        .kaleid(8)
        .modulateRotate(s.osc(0.7, 0.04 * L.energy, 0), 0.8)
        .blend(s.src(s.o0).scale(1.012).rotate(-0.003), 0.55)
        .contrast(1.4)
        .color(...L.rgb)
        .brightness(-0.05)
        .out(s.o0);
    },
  },
  {
    // slow constellations of soft cells, drifting upward forever
    name: "Lanterns",
    match: /ambient|waltz|drone|cinemat|classical|piano/i,
    looks: [
      { name: "Lantern", tint: "#ffc75c", rgb: [1.35, 0.95, 0.5], energy: 1 },
      { name: "Moonpaper", tint: "#c9d4ff", rgb: [0.8, 0.9, 1.25], energy: 0.7 },
      { name: "Festival", tint: "#ff63c1", rgb: [1.3, 0.45, 1.0], energy: 1.2 },
    ],
    paint(s, L, bpm, seed) {
      s.voronoi(4 + seed * 2, 0.45 * L.energy, 1.8)
        .modulateScale(s.osc(0.5, 0.04, 0), 0.35)
        .blend(s.src(s.o0).scale(1.006).scrollY(0, -0.004), 0.6)
        .contrast(1.35)
        .color(...L.rgb)
        .brightness(-0.02)
        .out(s.o0);
    },
  },
];

/** Which piece a song wears: genre match first, stable id-hash otherwise. */
export function pieceFor(song: { id: string; plan?: { genre?: string } }): number {
  const g = song.plan?.genre ?? "";
  const hit = PIECES.findIndex((p) => p.match.test(g));
  if (hit >= 0) return hit;
  let h = 0;
  for (let i = 0; i < song.id.length; i++) h = (h * 31 + song.id.charCodeAt(i)) >>> 0;
  return h % PIECES.length;
}

export function looksFor(piece: number): DoorLook[] {
  return PIECES[piece]?.looks ?? PIECES[0].looks;
}

/** A stable 0..1 seed from a section id — each section reshapes the piece. */
export function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// --- the engine --------------------------------------------------------------

const CANVAS_ID = "door-visual";
const IDLE_SPEED = 0.8;
const PLAY_SPEED = 1.3;
const RUSH_SPEED = 3.2;

let hydra: any = null;
let canvas: HTMLCanvasElement | null = null;
let raf = 0;
let lastFrameAt = 0;
let frames = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;
let resizeBound = false;
let sounding = false;
let rushing = false;
let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let current: { piece: number; look: number; bpm: number; seed: number } | null =
  null;

function baseSpeed(): number {
  return rushing ? RUSH_SPEED : sounding ? PLAY_SPEED : IDLE_SPEED;
}

function res(): number {
  if (typeof window === "undefined") return 1;
  return window.matchMedia?.("(pointer: coarse)").matches ? 0.5 : 1;
}

function sizeCanvas(): void {
  if (!canvas || typeof window === "undefined") return;
  const w = Math.max(1, Math.round(window.innerWidth * res()));
  const h = Math.max(1, Math.round(window.innerHeight * res()));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    try {
      hydra?.setResolution?.(w, h);
    } catch {
      /* cosmetic */
    }
  }
}

/** OUR loop — a throwing sketch frame can never kill rendering. */
function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  const dt = lastFrameAt ? Math.min(100, now - lastFrameAt) : 16;
  lastFrameAt = now;
  frames++;
  try {
    hydra?.tick?.(dt);
  } catch {
    /* keep looping — the watchdog rebuilds if it never recovers */
  }
}

async function build(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    // hydra-synth is authored for Node and touches `global` at import time.
    const g = globalThis as Record<string, unknown>;
    if (typeof g.global === "undefined") g.global = globalThis;
    const mod = await import("hydra-synth");
    const Hydra = (mod as { default?: any }).default ?? mod;
    canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;opacity:1;transition:opacity .6s ease";
    document.body.prepend(canvas);
    sizeCanvas();
    hydra = new Hydra({
      canvas,
      makeGlobal: false,
      detectAudio: false,
      autoLoop: false,
      width: canvas.width,
      height: canvas.height,
    });
    hydra.synth.speed = baseSpeed();
    lastFrameAt = 0;
    raf = requestAnimationFrame(frame);
    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener("resize", sizeCanvas);
    }
    return true;
  } catch (e) {
    console.error("[klappn] door visual engine failed to build", e);
    destroyDoorVisual();
    return false;
  }
}

function apply(): void {
  if (!hydra || !current) return;
  const p = PIECES[current.piece] ?? PIECES[0];
  const L = p.looks[current.look] ?? p.looks[0];
  try {
    p.paint(hydra.synth, L, current.bpm, current.seed);
  } catch (e) {
    console.error("[klappn] door piece failed; keeping previous light", e);
  }
}

/** The one entry point: show a piece under a look. Idempotent, self-booting. */
export async function showDoorVisual(
  piece: number,
  opts: { bpm?: number; look?: number; seed?: number } = {},
): Promise<void> {
  current = {
    piece,
    look: opts.look ?? current?.look ?? 0,
    bpm: opts.bpm ?? current?.bpm ?? 120,
    seed: opts.seed ?? 0,
  };
  if (!hydra && !(await build())) return;
  sizeCanvas();
  apply();
  armWatchdog();
}

/** Reshape the current piece (a section boundary) without changing its look. */
export function reseedDoorVisual(seed: number): void {
  if (!current) return;
  current.seed = seed;
  apply();
}

/** Play = the light moves at full tilt; idle/pause = a slow, alive drift. */
export function setDoorEnergy(on: boolean): void {
  sounding = on;
  if (hydra?.synth) hydra.synth.speed = baseSpeed();
}

/** CUT is held: the music leaves, the LIGHT RUSHES — release drops both back. */
export function setDoorRush(on: boolean): void {
  rushing = on;
  if (hydra?.synth) hydra.synth.speed = baseSpeed();
}

/** Every touch on the deck SURGES the light for a beat — the room answers
 *  your finger, every single time. */
export function pulseDoorVisual(): void {
  if (!hydra?.synth) return;
  hydra.synth.speed = baseSpeed() * 2.4;
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => {
    if (hydra?.synth) hydra.synth.speed = baseSpeed();
  }, 280);
}

/** Frames must advance while the page is visible — anything else (context
 *  loss, a dead loop, a 0-sized boot) tears the engine down and rebuilds it. */
function armWatchdog(): void {
  if (watchdog || typeof window === "undefined") return;
  let lastFrames = -1;
  watchdog = setInterval(() => {
    if (document.visibilityState !== "visible" || !current) return;
    const stuck = frames === lastFrames;
    const unsized = !canvas || canvas.width === 0 || !canvas.isConnected;
    lastFrames = frames;
    if (!hydra || stuck || unsized) {
      teardownEngine();
      void showDoorVisual(current.piece, { ...current });
    }
  }, 3000);
}

function teardownEngine(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  try {
    hydra?.synth?.hush?.();
  } catch {
    /* cosmetic */
  }
  try {
    const gl =
      canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    (gl as WebGLRenderingContext | null)
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  } catch {
    /* cosmetic */
  }
  canvas?.remove();
  canvas = null;
  hydra = null;
  lastFrameAt = 0;
}

/** Full stop — leaving the door. */
export function destroyDoorVisual(): void {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
  current = null;
  teardownEngine();
}
