/**
 * THE TRANSFORM GATE — the code a coder types vs the code that reaches the
 * engine.
 *
 * The 07-29 octave bug lived here, not in the DSP: clampAudioParams strips a
 * `.voicing()` that has no `chord()` to voice, and it judged each PHYSICAL
 * LINE. Hand-written layers wrap, so `chord("<AbM13>")` sat on line 1 and
 * `.voicing()` on line 2 — the strip ate the voicing from every harmonic layer
 * of a real patch, the haps lost their notes, and both engines fell back to
 * their own default pitch (an octave apart). Nothing failed, because every
 * test fed the sanitizer a ONE-LINE layer.
 *
 * So these tests use REALISTIC input: multi-line, wrapped, commented, mixed
 * layers — and assert on MEANING (does the layer still voice its chord, does
 * the duck still name a live orbit) rather than on string shape.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampAudioParams, transformForPlayback } from "./playback";
import { assignChannelOrbits } from "./set-live";

/** The user's own strudel.cc patch — the one that exposed the bug. */
const WRAPPED_PATCH = `setcpm(109/4)
$: s("gm_fiddle").chord("<AbM13>").offset("< 4 4 8 5 >")
  .voicing().arp("<0 2 1>".fast(8)).room(.5).dec("<.9 .7 .9 .8>".fast(8))
  .rdim(.5).diode("2.9:.2").orbit(2).vel(.2).mask("<0!4 1!8 0!4>")

$: s("gm_contrabass").chord("<AbM7 Bb13>").offset("< -1 1 >")
  .tremdepth(1).trem("<3.5 7 5 2.5>").mask("<1!14 0!2>")
  .tremoloskew(.5).voicing().room(.5).rdim(.5).diode("1.3:.63").orbit(2).vel(.3)

$: s("bd:2!4").soft(.6).duckatt(.2).duckorbit(2).postgain(1.2)

$: s("hh:<2 4 5 6>".fast(8)).vel(.9).mask("<1!14 0!2>")

$: s("~ akailinn_oh".fast(4)).stretch(.1).vel(.9).mask("<1!14 0!2>")

$: s("~ mfb512_cp, ~ circuitstom_sd ".fast(2)).stretch(.1).early(.006).vel(.6).mask("<1!14 0!2>")

$: s("gm_fretless_bass").chord("<AbM13 Bb13>").offset("< -12 -10 >")
  .voicing().arp("<3!3 <7 1>>".fast(4)).diode("2.1:.4").orbit(2).vel(.8)
  .struct("x ~ x ~ x ~ x ~ x ~ x x ~ x ~ ~").lpf(245).mask("<1!16 0!8>")`;

const layersOf = (code: string) =>
  code.split(/^(?=[ \t]*_?\$:)/m).filter((s) => /\$:/.test(s));

test("a wrapped chord layer keeps its .voicing() (the 07-29 octave bug)", () => {
  const out = clampAudioParams(WRAPPED_PATCH);
  const chordLayers = layersOf(out).filter((l) => /\bchord\(/.test(l));
  assert.equal(chordLayers.length, 3, "expected the three harmonic layers");
  for (const layer of chordLayers) {
    assert.ok(
      /\.voicing\(/.test(layer),
      `a chord layer lost its .voicing() — its haps carry no note and the ` +
        `engine falls back to a default pitch:\n${layer}`,
    );
  }
});

test("the same holds through the whole play-time transform", () => {
  const out = transformForPlayback(WRAPPED_PATCH, { transpose: 0 });
  const voicings = (out.match(/\.voicing\(/g) ?? []).length;
  const chords = (out.match(/\bchord\(/g) ?? []).length;
  assert.equal(voicings, chords, "every chord() must still be paired with a voicing()");
});

test(".voicing() is still stripped when there is genuinely no chord", () => {
  // The strip earns its keep: .voicing() with no chord field logs
  // "unknown chord undefined" and kills the harmony.
  const code = `$: note("<d3 e3>").add(note("0,7,12"))\n  .voicing().s("sawtooth")`;
  assert.ok(!/\.voicing\(/.test(clampAudioParams(code)));
});

test("a wrapped melodic layer keeps its notes and loses only .bank()", () => {
  const code = `$: note("c3 e3")\n  .bank("RolandTR909")\n  .s("sawtooth").gain(.7)`;
  const out = clampAudioParams(code);
  assert.ok(!/\.bank\(/.test(out), ".bank() on a melodic layer makes it silent");
  assert.ok(/note\("c3 e3"\)/.test(out), "the notes must survive");
  assert.ok(/\.s\("sawtooth"\)/.test(out));
});

test("a drum layer's .bank() is never stripped, even wrapped", () => {
  const code = `$: s("bd sd")\n  .bank("RolandTR909")\n  .gain(.9)`;
  assert.ok(/\.bank\("RolandTR909"\)/.test(clampAudioParams(code)));
});

test("no layer is ever dropped by the transform", () => {
  const before = layersOf(WRAPPED_PATCH).length;
  assert.equal(layersOf(clampAudioParams(WRAPPED_PATCH)).length, before);
  assert.equal(layersOf(transformForPlayback(WRAPPED_PATCH, {})).length, before);
  assert.equal(layersOf(assignChannelOrbits(WRAPPED_PATCH)).length, before);
});

test("the boiler room REMAPS duck targets onto the re-bused orbits", () => {
  const out = assignChannelOrbits(WRAPPED_PATCH, undefined, { ducks: "remap" });
  const duck = out.match(/\.duck\("([\d:]+)"\)/);
  assert.ok(duck, "the kick's sidechain vanished — the strings stop pumping");
  const targets = duck[1].split(":").map(Number);
  const orbits = new Set([...out.matchAll(/\.orbit\((\d+)\)/g)].map((m) => Number(m[1])));
  for (const t of targets) {
    assert.ok(orbits.has(t), `duck target ${t} is not an orbit any layer plays on`);
  }
  // the layers it originally named (.orbit(2)) are the harmonic ones
  assert.ok(targets.length >= 1);
});

test("Sets still STRIP the duck family (the deck owns dynamics there)", () => {
  const out = assignChannelOrbits(WRAPPED_PATCH);
  assert.ok(!/\.duck/.test(out), "Sets must not carry per-layer ducking");
});

test("every layer lands on its channel's orbit decade", () => {
  const out = assignChannelOrbits(WRAPPED_PATCH, undefined, { ducks: "remap" });
  for (const layer of layersOf(out)) {
    const orbit = Number(layer.match(/\.orbit\((\d+)\)/)?.[1]);
    assert.ok(Number.isFinite(orbit), `a layer got no orbit:\n${layer}`);
    assert.ok(
      (orbit >= 10 && orbit < 20) || (orbit >= 20 && orbit < 30) || (orbit >= 30 && orbit < 40),
      `orbit ${orbit} is outside the drums/bass/melody decades`,
    );
  }
});

test("a commented-out layer never steals the next layer's routing", () => {
  // A real prod bug: `// $: …` matched a bare /\$:/ scan and swallowed setcpm.
  const code = `setcpm(120/4)\n// $: s("old").gain(.5)\n$: s("bd*4").gain(.9)`;
  const out = assignChannelOrbits(code, undefined, { ducks: "remap" });
  assert.ok(/setcpm\(120\/4\)/.test(out), "setcpm must survive intact");
  assert.ok(!/setcpm\([^)]*\)\.orbit/.test(out), "orbit landed on setcpm");
});

test("transformForPlayback keeps exactly one setcpm", () => {
  const out = transformForPlayback(WRAPPED_PATCH, { bpm: 120, timeSignature: "4/4" });
  assert.equal((out.match(/setcpm\(/g) ?? []).length, 1);
});

test("machine-prefixed drums route to the KIT, not the melody bus", () => {
  // 2026-07-29, the user's fiddle: `akailinn_oh`, `mfb512_cp` and
  // `circuitstom_sd` carry their drum machine's name in the token, and the
  // catalog only knows the bare `oh`/`cp`/`sd` — so all three classified as
  // MELODY and landed on the melodic orbit, where the kick's sidechain ducked
  // them. On strudel.cc they have no .orbit() at all and are never ducked.
  const out = assignChannelOrbits(WRAPPED_PATCH, undefined, { ducks: "remap" });
  const orbitOf = (needle: string) => {
    const layer = layersOf(out).find((l) => l.includes(needle));
    assert.ok(layer, `layer ${needle} vanished`);
    return Number(layer.match(/\.orbit\((\d+)\)/)?.[1]);
  };
  const duck = out.match(/\.duck\("([\d:]+)"\)/);
  assert.ok(duck, "the kick lost its sidechain");
  const ducked = new Set(duck[1].split(":").map(Number));

  for (const perc of ["akailinn_oh", "mfb512_cp"]) {
    const o = orbitOf(perc);
    assert.ok(o >= 10 && o < 20, `${perc} sits on orbit ${o} — that is not the kit`);
    assert.ok(!ducked.has(o), `${perc} is being ducked by the kick; strudel.cc never ducks it`);
  }
  // and the melodic layers ARE still ducked — the patch asks for that
  const fiddle = orbitOf("gm_fiddle");
  assert.ok(ducked.has(fiddle), "the melodic bus must still pump — the patch says so");
  // the kick shares the kit's decade with the hats, never the melody's
  assert.ok(orbitOf("bd:2!4") >= 10 && orbitOf("bd:2!4") < 20);
});
