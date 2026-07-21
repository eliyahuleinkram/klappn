/**
 * Single module graph for the Strudel engine + GM soundfonts.
 *
 * BROWSER-ONLY — import this lazily (dynamic import), never during SSR.
 *
 * Why co-import here instead of two separate dynamic imports: @strudel/web and
 * @strudel/soundfonts both pull in @strudel/core / @strudel/webaudio /
 * superdough. If they're loaded through two SEPARATE dynamic import()s, the
 * bundler can give each its own copy of those packages, so the soundfont
 * `registerSound()` writes into a different `soundMap` than the REPL plays from
 * — every `gm_*` instrument then reports "sound not found" and is silent (while
 * sample-based sounds, registered on the REPL's own instance, still work).
 * Importing both statically in one module keeps @strudel/core a single instance
 * (the "@strudel/core was loaded more than once" warning is the tell). Paired
 * with resolve.dedupe in vite.config.ts.
 */
import {
  registerSoundfonts,
  loadSoundfont,
  setSoundfontUrl,
} from "@strudel/soundfonts";
// IMPORTANT: import the SOURCE entry (web.mjs), not the package main.
// @strudel/web's published dist/index.mjs is PRE-BUNDLED with its own inlined
// copies of @strudel/core + @strudel/webaudio + superdough — so it owns a
// private `soundMap` that registerSoundfonts() (which writes into the separate
// node_modules @strudel/webaudio copy) can never reach → gm_* silent. The
// source web.mjs instead `import`s @strudel/core / @strudel/webaudio from
// node_modules, the SAME copies @strudel/soundfonts uses, so they share one
// soundMap. (web.mjs has no "exports" restriction, so the deep import resolves.)
import * as web from "@strudel/web/web.mjs";
// NEVER import from 'superdough' directly here: dev-mode dep optimization can
// give that import its OWN bundled copy — setAudioContext then writes a
// different instance than the REPL plays through, and every voice built on the
// second context throws "cannot connect to an AudioNode belonging to a
// different audio context" (reverb sends died at section seams). web.mjs
// re-exports the engine's own superdough — reach everything through `web`.

export { registerSoundfonts, loadSoundfont, setSoundfontUrl, web };
