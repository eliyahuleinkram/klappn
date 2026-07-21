import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from "vite";

// Tailwind v4 via its official Vite plugin (resolves `@import "tailwindcss"`
// reliably in both dev and the Workers build — the postcss path fails to
// resolve it under the rolldown build).
//
// `vinext build` / `vinext deploy` target Cloudflare Workers and require the
// cloudflare() plugin; local `vinext dev` runs on Node, so it's added only for
// the build command (keeping the local dev flow binding-free).
// Force a SINGLE instance of each Strudel package. @strudel/web and
// @strudel/soundfonts both depend on @strudel/core / @strudel/webaudio /
// superdough; without deduping, the bundler can instantiate them twice, so
// registerSoundfonts() registers gm_* sounds into a different soundMap than the
// REPL plays from → "sound not found" for every gm_* instrument.
const STRUDEL_DEDUPE = [
  "@strudel/core",
  "@strudel/webaudio",
  "@strudel/mini",
  "@strudel/tonal",
  "@strudel/transpiler",
  "@strudel/soundfonts",
  "@strudel/draw",
  "superdough",
];

// Build-only scrub of library fingerprints from the emitted chunks (part of the
// stealth layer — see lib/seal.ts, /api/snd). Two literals identify the engine
// at runtime and are safe to rename CONSISTENTLY across the whole bundle:
//   'strudel.log'  — the engine's DOM log-event name (dispatch AND our listener
//                    both live in bundled code, so one rename keeps them agreed;
//                    dev is untouched and keeps the original on both sides).
//   'hydra-canvas' — the visuals canvas DOM id (creator, lookups, and our video
//                    export all reference it from bundled code; globals.css
//                    carries BOTH ids so dev and prod both style it).
// Do NOT blanket-replace brand words: server chunks hold real upstream URLs
// (the /api/snd registry) and semantic keys that must not change.
const scrubFingerprints = (): Plugin => ({
  name: "klappn-scrub-fingerprints",
  renderChunk(code: string) {
    if (!code.includes("strudel.log") && !code.includes("hydra-canvas")) return null;
    return {
      code: code.replaceAll("strudel.log", "k1.log").replaceAll("hydra-canvas", "k1-canvas"),
      map: null,
    };
  },
});

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const plugins: PluginOption[] = [tailwindcss(), vinext()];
  if (command === "build") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      }),
      scrubFingerprints(),
    );
    // `cloudflare:workers` is provided by the Worker runtime — leave the import
    // in place rather than trying to bundle it (lib/db.ts reads env.HYPERDRIVE).
    return {
      plugins,
      resolve: {
        dedupe: STRUDEL_DEDUPE,
        // PATCHED soundfont loader (loop-seam crossfade — the clicking-violin
        // fix; see lib/vendor/soundfonts/fontloader.mjs).
        alias: {
          "@strudel/soundfonts": fileURLToPath(
            new URL("./lib/vendor/soundfonts/index.mjs", import.meta.url),
          ),
        },
      },
      build: {
        rolldownOptions: {
          external: ["cloudflare:workers"],
          // Force ALL Strudel-related packages into ONE output chunk. Otherwise
          // the client build duplicates @strudel/core / @strudel/webaudio across
          // chunks (one for @strudel/web, one for @strudel/soundfonts), giving
          // two `soundMap`s — registerSoundfonts() then writes gm_* into a map
          // the REPL never reads → every gm_* instrument is silent. One chunk =
          // one instance.
          output: {
            // Opaque chunk filenames: the default [name]-[hash] pattern leaks
            // module names ("strudel-engine-…", "hydra-synth-…") straight into
            // the network tab. Hash-only names carry no vocabulary.
            chunkFileNames: "_next/static/c.[hash].js",
            advancedChunks: {
              groups: [
                {
                  name: "engine", // neutral — feeds [name] nowhere now, but stays unbranded
                  test: /[\\/](node_modules[\\/](@strudel[\\/]|superdough|sfumato|soundfont2|webaudiofont)|lib[\\/]vendor[\\/]soundfonts[\\/])/,
                },
              ],
            },
          },
        },
      },
    };
  }
  // Dev runs on Node, where the workerd-only `cloudflare:workers` module
  // doesn't exist. Alias it to a stub so `import { env } from "cloudflare:workers"`
  // resolves (env is empty → lib/db.ts falls back to DATABASE_URL). In the build
  // above, no alias is set and the real module is provided by the worker runtime.
  return {
    plugins,
    resolve: {
      dedupe: STRUDEL_DEDUPE,
      alias: {
        "cloudflare:workers": fileURLToPath(
          new URL("./vite-stubs/cloudflare-workers.js", import.meta.url),
        ),
        // PATCHED soundfont loader (loop-seam crossfade — the clicking-violin
        // fix; see lib/vendor/soundfonts/fontloader.mjs). Same package,
        // one function added; STRUDEL_DEDUPE still unifies its @strudel deps.
        "@strudel/soundfonts": fileURLToPath(
          new URL("./lib/vendor/soundfonts/index.mjs", import.meta.url),
        ),
      },
    },
  };
});
