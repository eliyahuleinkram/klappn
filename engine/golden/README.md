# The golden harness

Acceptance tests for the engine: the same events rendered through ZALTZ and
through real superdough, and the audio compared — envelope correlation,
level, brightness, per case. The story (and the bugs it caught) lives in
[docs/wasm-engine.md](../../docs/wasm-engine.md).

What's here:

- `run.mjs` — the gate: each case through both engines, diffed.
- `corpus.mjs` / `click-hunt.mjs` — sweeps over real-song material.
- `sd-gm.src.mjs`, `gm-zones.src.mjs`, `hap-dump.src.mjs` — sources for the
  committed bundles beside them (`hap-dump.build.mjs` shows the esbuild
  invocation; the other bundles were built the same way).
- `_sd-child.mjs` — the superdough child process (its caches bind to one
  context per process, so the reference side always forks).

The ZALTZ side runs from this repo alone. The superdough **reference** side
predates the public history: it rendered through `node-web-audio-api` inside
a `render-service/` directory that no longer exists, and the imports still
say `../../render-service/node_modules/node-web-audio-api/…`. To re-run it,
supply that package at that path (`npm install node-web-audio-api` in a
scratch `render-service/`, or edit the imports), run on macOS/Linux (scratch
files go to `/tmp/klt/`), and be online — sample maps are fetched from
`klappn.com/api/snd`.
