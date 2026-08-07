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
  "@tonaljs/tonal",
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
// Opaque CLIENT chunk names. The top-level `build.rolldownOptions.output`
// below only reaches the RSC/SSR environments — the client build gets its
// filenames from the framework, so a hash-only pattern set there never lands
// and the browser was served `SongClient-…`, `ZaltzIDE-…`, `strudel-engine-…`,
// `fontloader-…`: our product surfaces AND the audio library, named in the
// network tab. This runs as a `post` plugin so it is the LAST word on the
// client environment's output, whatever the framework asked for.
const opaqueClientChunks = (): Plugin => ({
  name: "klappn-opaque-client-chunks",
  enforce: "post",
  configEnvironment(name) {
    if (name !== "client") return;
    return {
      build: {
        rolldownOptions: {
          output: {
            entryFileNames: "_next/static/chunks/e.[hash].js",
            chunkFileNames: "_next/static/chunks/c.[hash].js",
          },
        },
      },
    };
  },
});

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
      opaqueClientChunks(),
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
          output: {
            // Opaque chunk filenames: the default [name]-[hash] pattern leaks
            // module names ("strudel-engine-…", "hydra-synth-…") straight into
            // the network tab. Hash-only names carry no vocabulary.
            // (This branch reaches the RSC/SSR environments; the CLIENT build is
            // configured separately below — vinext sets its own filenames there
            // and a top-level setting never reaches it. See that note.)
            chunkFileNames: "_next/static/c.[hash].js",
            // (The `advancedChunks` group that used to sit here is GONE —
            //  2026-08-05. It was silently IGNORED: rolldown drops it whenever
            //  `codeSplitting` is set, and vinext sets `codeSplitting` on both
            //  the client and RSC builds (its own "framework" group, for
            //  cloudflare/vinext#1549). It had therefore been doing nothing for
            //  some time, on shipped builds too.
            //
            //  It is not being ported, because it was never what made the
            //  guarantee. Verified against the emitted bundle: superdough is
            //  bundled ONCE (into the soundfont-loader chunk) and the engine
            //  chunk IMPORTS `soundMap` from it — a single instance across the
            //  chunk boundary. What actually enforces that is
            //  `resolve.dedupe: STRUDEL_DEDUPE` above (one resolved path per
            //  package) plus lib/strudel-engine.ts, the barrel that
            //  co-imports @strudel/web AND @strudel/soundfonts in one dynamic
            //  import. Re-adding a chunk group would mean overwriting vinext's
            //  `codeSplitting` and taking its framework-chunk fix down with it.
            //  If gm_* ever goes silent again, look at those two — not here.) */
          },
        },
      },
      // (The client environment's own filenames are set by the
      //  `opaqueClientChunks` post-plugin above — a plain `environments.client`
      //  block here is overwritten by the framework's config and was measured
      //  to have no effect.)
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
