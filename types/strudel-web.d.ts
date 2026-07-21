// @strudel/web ships no type declarations. We only use a tiny slice of its API.
declare module "@strudel/web" {
  /** Initialise the Strudel REPL: installs pattern functions on the global
   *  scope and wires Web Audio output. Must run after a user gesture. */
  export function initStrudel(opts?: Record<string, unknown>): Promise<void>;
  /** Load a sample bank (a URL to a sample map JSON, or "github:org/repo"). */
  export function samples(...args: unknown[]): Promise<unknown>;
  /** Evaluate and (by default) start a pattern from a code string. */
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;
  /** Stop all running patterns. */
  export function hush(): void;
  /** Look up a registered sound by name (re-exported from superdough). */
  export function getSound(name: string): unknown;
  /** Load bank aliases (e.g. tr909 -> RolandTR909) from a JSON map. */
  export function aliasBank(url: string): Promise<unknown>;
  /** The shared Web Audio context. */
  export function getAudioContext(): AudioContext;
}

// Source entry of @strudel/web (un-bundled — shares core/webaudio with
// @strudel/soundfonts). Same surface as "@strudel/web".
declare module "@strudel/web/web.mjs" {
  export function initStrudel(opts?: Record<string, unknown>): Promise<void>;
  export function samples(...args: unknown[]): Promise<unknown>;
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;
  export function hush(): void;
  export function getSound(name: string): unknown;
  /** Load bank aliases (e.g. tr909 -> RolandTR909) from a JSON map. */
  export function aliasBank(url: string): Promise<unknown>;
  /** The shared Web Audio context. */
  export function getAudioContext(): AudioContext;
}

// @strudel/soundfonts ships no type declarations either.
declare module "@strudel/soundfonts" {
  /** Register the General MIDI soundfont instruments (gm_*). */
  export function registerSoundfonts(): Promise<unknown>;
  /** Pre-load a soundfont instrument's font (cached) — used to warm gm_* ahead
   *  of the first Play so it doesn't fetch/parse on the click. */
  export function loadSoundfont(name: string): Promise<unknown>;
  /** Override the base URL soundfont data files (<name>.js) load from — we
   *  point it at our same-origin proxy (/api/snd/f). */
  export function setSoundfontUrl(value: string): void;
}

// @strudel/hydra ships no type declarations. We use the tiny public surface.
declare module "@strudel/hydra" {
  /** Initialise Hydra on a fullscreen #hydra-canvas. Pass `src` to load
   *  hydra-synth from a specific URL (we hand it a no-op + bundle locally). */
  export function initHydra(opts?: Record<string, unknown>): Promise<unknown>;
  /** Bridge a Strudel pattern into Hydra as a live clock-sampled value. */
  export function H(pattern: unknown): () => number;
  /** Hush the Hydra output and remove the canvas. */
  export function clearHydra(): void;
}

// hydra-synth ships no usable type declarations for our purposes.
declare module "hydra-synth";
// NB: no `declare module "superdough"` on purpose — importing it directly can
// bind a SECOND bundled engine copy (different-audio-context crashes). Reach
// its API through the `web` namespace re-export (lib/strudel-engine.ts).

// Engine packages used headless by lib/strudel-eval.ts to validate code. Untyped.
declare module "@strudel/core";
declare module "@strudel/mini";
declare module "@strudel/tonal";
declare module "@strudel/transpiler";
