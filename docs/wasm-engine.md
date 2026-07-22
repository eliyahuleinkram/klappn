# ZALTZ — Klappn's audio engine

ZALTZ is the synthesizer under every Klappn song: one file of freestanding C
([engine/zaltz.c](../engine/zaltz.c), ~1,600 lines), compiled to ~165 KB of
WebAssembly, rendering inside an AudioWorklet. The UI thread can jank, GC, or
sleep — the render physically cannot glitch, because it never runs there.

It is a clean-room re-implementation of the parts of
[superdough](https://github.com/tidalcycles/strudel) (Strudel's sampler/synth
layer) that Klappn songs actually use, measured against the real thing until
the two were indistinguishable — then pushed past it wherever superdough's
Web-Audio-graph architecture couldn't go. The pattern layer (@strudel/core,
mini, tonal, transpiler) is untouched upstream code; ZALTZ replaces only the
sound.

## Why not just superdough?

Superdough synthesizes by building Web Audio node graphs from the main thread.
That works — Klappn shipped on it — but it puts the music at the mercy of the
busiest thread in the browser: one long React commit, one GC pause, one
background-tab timer clamp, and the audio crackles. The fixes (bigger buffers,
low-CPU "twin" rewrites of every song for phones, reverb capping on mobile)
were all payments on that architectural debt.

ZALTZ moves the entire render to the audio thread and retires the debt: phones
play the same full mix as desktops, backgrounded tabs keep playing, and the
twin pipeline was deleted outright.

## Architecture

Three pieces, smallest possible seams:

- **[lib/zaltz.ts](../lib/zaltz.ts)** — the main-thread bridge. Transpiles the
  program with Strudel's own transpiler, queries the pattern for haps in a
  lookahead loop (~350 ms ahead), serializes each hap to a flat
  `key/value/key/value` string, and posts batches to the worklet. Also owns
  asset resolution: sample-map manifests, pitched multisample zones
  (nearest-MIDI + residual repitch, superdough's exact math), GM soundfont
  zones through the vendored loop-seam-crossfading loader, and paced PCM
  upload. If the engine cannot boot (a browser too old for its wasm features),
  the session falls back to superdough automatically — old devices get music,
  not silence.
- **[engine/zaltz.worklet.js](../engine/zaltz.worklet.js)** — the AudioWorklet
  host. Instantiates the wasm, writes event strings straight into engine
  memory (no per-hap allocation — worklet-thread GC pauses are audible),
  drains PCM uploads with a strict per-quantum budget, and posts an
  audio-thread clock outward so scheduling survives background-tab timer
  clamps. Memory views are rebuilt only when the sample store actually grows.
- **[engine/zaltz.c](../engine/zaltz.c)** — the engine. No libc, no
  SharedArrayBuffer, no imports; the worklet owns the memory, so it runs on
  every device with no cross-origin-isolation requirements. Oscillators
  (band-limited wavetables, triangle at sample-exact 90° phase), noise
  sources, ADSR + filter envelopes, ladder/12dB/24dB filters, a sample store
  and looping soundfont voices, and per-orbit buses: FDN reverb, delay lines,
  sidechain duck, phaser, waveshaping. A single growable arena (memory.grow,
  claimed at the end of linear memory) holds all PCM and delay lines — the
  engine's baseline footprint is a few MB and grows only with what a song
  actually loads.

## The laws

Rules that hold everywhere in the engine, learned the hard way:

- **Buses ramp, never step** — including feedback-network coefficients. A
  retuned reverb glides its damping and size *while the tail rings*; zeroing
  or stepping any live coefficient is a click by construction.
- **Nothing unbounded on the audio thread.** Event writes are length-guarded,
  uploads are budgeted per quantum, memory growth is chunked and rare.
- **Quality over superdough-faithfulness.** Parity is the floor, not the
  ceiling: where the reference glitches (regenerating a shared convolver
  mid-ring, per-hap GC churn), ZALTZ deliberately diverges.
- **The ear is the acceptance test.** Metrics gate regressions; a human
  listening decides quality.

## The golden gate

[engine/golden/run.mjs](../engine/golden/run.mjs) renders the same programs
through superdough (offline, via node-web-audio-api) and through ZALTZ, and
compares envelope correlation, level, and brightness per case — synths, ADSR,
filters, samples, GM zones, delay, reverb, ducking, real pattern queries. It
caught, among others: a mono-pan stereo law 3.6 dB off, phase-blind envelope
metrics hiding a triangle-phase error, and an oracle whose `getChannelData`
returns a GC-mutable view (always copy). Beyond the gate, an 8-song / 70-loop
corpus of real Klappn music was A/B'd by ear before the engine became the
default.

The superdough side of the comparison ran through the render service, which
has since left the tree (it went with stem rendering). To re-run the
reference side, restore `render-service/` from git history — it was removed
in the commit "One engine, one model, doors open: ZALTZ ships standalone" —
and `npm install` inside it. The ZALTZ side needs only this repo.

## Building

```sh
cd engine && ./build.sh   # zig cc → wasm32-freestanding, no SIMD (Safari ≥15)
```

The build copies `zaltz.wasm` to `public/zaltz` (served extensionless);
`scripts/stamp-engine.mjs` content-hashes both engine assets into the asset
URLs at deploy time, so a new engine build is a new URL — no stale-cache trap
can strand a browser on an old engine.
