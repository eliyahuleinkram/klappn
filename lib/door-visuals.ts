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

/** ONE ink trio for the whole door — fuchsia, violet, ice. One material,
 *  three temperatures; the deck's orbs read as jewellery, never candy. */
const INKS: [DoorLook, DoorLook, DoorLook] = [
  { name: "Neon", tint: "#ff3fb1", rgb: [1.5, 0.32, 1.02], energy: 1 },
  { name: "Violet", tint: "#a55cff", rgb: [0.95, 0.45, 1.5], energy: 0.85 },
  { name: "Ice", tint: "#7fb7ff", rgb: [0.5, 0.75, 1.5], energy: 0.7 },
];

/** SIX PIECES — one per mood, matched on the song's genre line.
 *
 *  TWO LAWS, learned the hard way:
 *  1. THE ROOM STAYS BLACK — every piece is a form living inside a soft
 *     circular mask (`.mult(shape(999,…))`), so the edges are black FOREVER
 *     and the light is a contained, breathing thing — never a paint fill.
 *  2. FEEDBACK NEVER ADDS LIGHT — `src(o0)` may only MODULATE (bend
 *     coordinates); additive/blend trails with the amplifying grade inside
 *     the loop compound every frame until the whole screen clips to a flat
 *     wash (the solid-red-screen bug, seen live on prod 07-22). */
const PIECES: Piece[] = [
  {
    // a crystalline flower that PUMPS AT THE SONG'S TEMPO — shattering,
    // re-forming, breathing with the kick
    name: "Mandala",
    match: /techno|trance|edm|electro|rave/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      const beat = ((bpm || 128) / 60) * Math.PI;
      s.voronoi(6 + seed * 4, 1.4 * L.energy, 0.8)
        .kaleid(8)
        .modulateRotate(s.osc(3 + seed * 2, 0.12 * L.energy, 0), 0.5)
        .modulateScale(s.osc(0.5, 0.05, 0), 0.15)
        .modulate(s.src(s.o0), 0.14)
        .rotate(({ time }: any) => time * 0.06 * L.energy)
        .scale(({ time }: any) => 1 + 0.09 * Math.sin(time * beat))
        .mult(s.shape(999, 0.55, 1))
        .contrast(1.75)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
        .out(s.o0);
    },
  },
  {
    // silk curling over itself inside a pool of light
    name: "Smoke",
    match: /jazz|hop|lo-?fi|soul|r&b|funk/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      s.osc(3 + seed * 1.5, 0.07 * L.energy, 0)
        .modulate(s.noise(2.4 + seed, 0.1 * L.energy).scale(1.3), 0.6)
        .modulate(s.src(s.o0), 0.15)
        .rotate(({ time }: any) => time * 0.012 * L.energy)
        .mult(s.shape(999, 0.6, 1))
        .contrast(1.8)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
        .out(s.o0);
    },
  },
  {
    // fast liquid ribbons tearing through cells, held in the dark
    name: "Tides",
    match: /drum|dnb|d&b|liquid|jungle|break/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      s.osc(9 + seed * 3, 0.12 * L.energy, 0)
        .modulateScale(s.osc(1.5, 0.09 * L.energy, 0).rotate(1.57), 0.5)
        .diff(s.voronoi(5 + seed * 3, 2, 0.3))
        .modulate(s.src(s.o0), 0.1)
        .mult(s.shape(999, 0.55, 1))
        .contrast(1.7)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
        .out(s.o0);
    },
  },
  {
    // rings pumping outward from the centre AT THE SONG'S TEMPO
    name: "Tunnel",
    match: /house|disco|garage|club/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      const beat = ((bpm || 120) / 60) * Math.PI;
      s.shape(64, 0.3 + seed * 0.1, 0.5)
        .scale(({ time }: any) => 1 + 0.14 * L.energy * Math.sin(time * beat))
        .diff(s.osc(6, 0.08 * L.energy, 0))
        .kaleid(4)
        .modulate(s.src(s.o0), 0.1)
        .mult(s.shape(999, 0.55, 1))
        .contrast(1.6)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
        .out(s.o0);
    },
  },
  {
    // ink blooming into petals, closing, blooming again
    name: "Bloom",
    match: /trip|down|dub|chill|ambient hop/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      s.noise(1.7 + seed, 0.09 * L.energy)
        .thresh(0.5, 0.3)
        .kaleid(8)
        .modulateRotate(s.osc(0.7, 0.04 * L.energy, 0), 0.8)
        .modulate(s.src(s.o0), 0.08)
        .mult(s.shape(999, 0.55, 1))
        .contrast(1.5)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
        .out(s.o0);
    },
  },
  {
    // slow constellations of soft cells breathing in a halo
    name: "Lanterns",
    match: /ambient|waltz|drone|cinemat|classical|piano/i,
    looks: INKS,
    paint(s, L, bpm, seed) {
      s.voronoi(4 + seed * 2, 0.45 * L.energy, 1.8)
        .modulateScale(s.osc(0.5, 0.04, 0), 0.35)
        .modulate(s.src(s.o0), 0.1)
        .mult(s.shape(999, 0.6, 1))
        .contrast(1.45)
        .color(() => inkNow[0], () => inkNow[1], () => inkNow[2])
        .hue(() => hueNow)
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
const IDLE_SPEED = 1.0;
const PLAY_SPEED = 1.45;
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
let arrived = false; // the first reveal gets an entrance surge
// LIVE COLOUR — dynamic uniforms every piece samples PER FRAME. Changing the
// ink or turning the hue never re-runs the sketch: the geometry keeps its
// exact position and only the LIGHT slides — ink glides toward its target a
// little every frame, so a look change is a seamless colour crossfade.
let hueNow = 0;
let hueTarget = 0;
const inkNow: [number, number, number] = [
  INKS[0].rgb[0] * 1.12,
  INKS[0].rgb[1] * 1.12,
  INKS[0].rgb[2] * 1.12,
];
const inkTarget: [number, number, number] = [...inkNow];

/** Turn the room's colour live (0..1 wraps the wheel). */
export function setDoorHue(v: number): void {
  hueTarget = ((v % 1) + 1) % 1;
}
export function doorHue(): number {
  return hueTarget;
}

/** Re-ink the room — the geometry never moves, the colour glides over. */
export function setDoorInk(rgb: [number, number, number]): void {
  inkTarget[0] = Math.min(1.6, rgb[0] * 1.12);
  inkTarget[1] = Math.min(1.6, rgb[1] * 1.12);
  inkTarget[2] = Math.min(1.6, rgb[2] * 1.12);
}

/** One lerp step per frame — the colour crossfade. */
function easeInk(): void {
  for (let i = 0; i < 3; i++) inkNow[i] += (inkTarget[i] - inkNow[i]) * 0.045;
  hueNow += (hueTarget - hueNow) * 0.06;
}
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
  easeInk(); // colour glides toward its targets — every change is a crossfade
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
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;opacity:0;transition:opacity .8s ease";
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
  setDoorInk(L.rgb); // colour rides the per-frame uniforms, not the sketch
  try {
    p.paint(hydra.synth, L, current.bpm, current.seed);
  } catch (e) {
    console.error("[klappn] door piece failed; keeping previous light", e);
  }
}

/** The first reveal is an EVENT: the piece blooms in already surging, then
 *  settles into its drift — never a slow fade from black. */
function arrive(): void {
  if (arrived || !hydra?.synth || !canvas) return;
  arrived = true;
  hydra.synth.speed = baseSpeed() * 2.2;
  requestAnimationFrame(() => {
    if (canvas) canvas.style.opacity = "1";
  });
  setTimeout(() => {
    if (hydra?.synth) hydra.synth.speed = baseSpeed();
  }, 1100);
}

/** The one entry point: show a piece under a look. Idempotent, self-booting.
 *  Re-calling with the SAME piece only retargets the colour uniforms — the
 *  geometry keeps its exact position (seamless by construction). */
export async function showDoorVisual(
  piece: number,
  opts: { bpm?: number; look?: number; seed?: number } = {},
): Promise<void> {
  const samePiece = current?.piece === piece && hydra;
  current = {
    piece,
    look: opts.look ?? current?.look ?? 0,
    bpm: opts.bpm ?? current?.bpm ?? 120,
    seed: opts.seed ?? current?.seed ?? 0,
  };
  if (!hydra && !(await build())) return;
  sizeCanvas();
  if (samePiece) {
    const p = PIECES[current.piece] ?? PIECES[0];
    setDoorInk((p.looks[current.look] ?? p.looks[0]).rgb);
  } else {
    apply();
  }
  arrive();
  armWatchdog();
}

/** A section boundary: the geometry NEVER jumps — the light just breathes a
 *  step around the wheel, a seamless drift you feel more than see. */
export function reseedDoorVisual(seed: number): void {
  if (!current) return;
  current.seed = seed; // remembered for the next true rebuild only
  hueTarget += 0.02;
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
  arrived = false; // a rebuilt stage blooms in again
}

/** Full stop — leaving the door. */
export function destroyDoorVisual(): void {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
  current = null;
  teardownEngine();
}
