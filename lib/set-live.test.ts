/**
 * Tests for the live-set channel classifier (lib/set-live.ts): every layer must land on
 * exactly one of the three kill switches (drums / bass / melody). The sound knowledge is
 * derived from SOUND_CATALOG, so the sweep below proves EVERY loadable sound classifies
 * sanely — no name in the library can fall through a hand-written token list.
 * Run: node_modules/.bin/esbuild lib/set-live.test.ts --bundle --format=esm --platform=node --outfile=/tmp/sl.mjs && node --test /tmp/sl.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLayer, assignChannelOrbits } from "./set-live";
import { SOUND_CATALOG, BANK_CATALOG } from "./sound-catalog";
import { PALETTE_SOUNDS, GM_SOUNDS, WT_SOUNDS, PALETTE_BANKS } from "./sound-palette";

const DRUM_ROLES = new Set(["kick", "snare", "clap", "hat", "cymbal", "tom", "perc"]);

test("the catalog covers EVERY loadable sound and bank — no classifier blind spots", () => {
  // The validator (isKnownSound) hard-fails generated code on anything outside the
  // palette, so palette ⊆ catalog means no sound that can reach a set is unknown here.
  const catalog = new Set(SOUND_CATALOG.map((s) => s.name));
  for (const n of [...PALETTE_SOUNDS, ...GM_SOUNDS, ...WT_SOUNDS])
    if (n) assert.ok(catalog.has(n), `loadable sound "${n}" missing from SOUND_CATALOG`);
  const banks = new Set(BANK_CATALOG.map((b) => b.name));
  for (const n of PALETTE_BANKS)
    assert.ok(banks.has(n), `loadable bank "${n}" missing from BANK_CATALOG`);
});

test("catalog sweep: every drum-role sound → drums, every bass-role sound → bass", () => {
  for (const s of SOUND_CATALOG) {
    if (!s.name) continue;
    const ch = classifyLayer(`$: s("${s.name}*4").gain(0.9)`);
    if (DRUM_ROLES.has(s.role)) assert.equal(ch, "drums", `${s.name} (${s.role})`);
    else if (s.role === "bass") assert.equal(ch, "bass", `${s.name} (${s.role})`);
  }
});

test("kit folders and breaks classify as drums", () => {
  for (const code of [
    '$: s("house:3 ~ house:1 ~")',
    '$: s("amencutup:1 amencutup:5")',
    '$: s("<breaks165:0 breaks165:2>").fit()',
    '$: s("jungle:0*4")',
    '$: s("linnhats*8")',
    '$: s("909:1 ~ 909:3 ~")',
    '$: s("808oh ~ 808hc ~")',
    '$: s("gretsch:2 gretsch:5")',
  ]) assert.equal(classifyLayer(code), "drums", code);
});

test("mridangam strokes and the world grab-bag are drums; melodic world stays melody", () => {
  assert.equal(classifyLayer('$: s("ta na dhi ~ thom")'), "drums");
  assert.equal(classifyLayer('$: s("mridangam_ka*4")'), "drums");
  assert.equal(classifyLayer('$: s("world:5 ~ world:2 ~")'), "drums");
  assert.equal(classifyLayer('$: note("c4 e4").s("sitar")'), "melody");
  assert.equal(classifyLayer('$: n("0 2 4").scale("C4:minor").s("gm_koto")'), "melody");
});

test("non-GM basses classify as bass", () => {
  for (const code of [
    '$: s("jvbass:3").note("c2 ~ eb2 ~")',
    '$: s("jungbass:2*2")',
    '$: note("c3 g3").s("moog")',
    '$: s("wobble").note("e3")',
    '$: s("bass3:1 ~")',
  ]) assert.equal(classifyLayer(code), "bass", code);
});

test("misfiled Dirt folders reclassified by their real contents", () => {
  // roles verified against the upstream sample file names (2026-07-05)
  for (const code of [
    '$: s("bassdm:5 ~ bassdm ~")', // BT*.WAV = 808-family kicks, not "bass tones"
    '$: s("future:3*2")', // 808KICK*.wav
    '$: s("glitch:1 glitch:4")', // BD/CB/HH/OH/P1 kit
    '$: s("hc*8")', // HHCD*.wav closed hats
    '$: s("rm ~ rm")', // RIM*.wav rimshots
    '$: s("foo:2 foo:11")', // *brk.wav drum breaks
    '$: s("peri:0 ~ peri:5 ~")', // bd/hh/sd kit
    '$: s("haw:1 haw:3")', // hawaiian-kick/sd/hh kit
  ]) assert.equal(classifyLayer(code), "drums", code);
});

test("bass register by pitch: letters, scale root, all-numeric MIDI", () => {
  assert.equal(classifyLayer('$: note("c2 ~ g1 ~").s("sawtooth")'), "bass");
  assert.equal(classifyLayer('$: note("cs2 ~ fs1 ~").s("square")'), "bass"); // s-sharps
  assert.equal(classifyLayer('$: n("0 2 3").scale("E1:minor").s("supersaw")'), "bass");
  assert.equal(classifyLayer('$: n("0 2").scale("<e1:minor e1:phrygian>").s("sawtooth")'), "bass");
  assert.equal(classifyLayer('$: note("36 ~ 43 ~").s("gm_piano")'), "bass");
  // a *16 multiplier alongside letter pitches is NOT a MIDI number
  assert.equal(classifyLayer('$: note("[c4 e4]*16").s("gm_piano")'), "melody");
  // re-pitched 808 kick used as the bassline
  assert.equal(classifyLayer('$: s("808bd").note("c1*4")'), "bass");
});

test("n() without scale picks sample variants — drum samples stay drums", () => {
  assert.equal(classifyLayer('$: n("0 2 5").s("tabla2")'), "drums");
  assert.equal(classifyLayer('$: n("<0 3>").s("drumtraks")'), "drums");
  // pitched drum sample above the bass register is still percussion
  assert.equal(classifyLayer('$: note("c4 e4").s("tabla")'), "drums");
});

test(".bank() routes to drums", () => {
  assert.equal(classifyLayer('$: s("bd*4").bank("RolandTR909")'), "drums");
  assert.equal(classifyLayer('$: s("perc:2").bank("RolandTR727")'), "drums");
});

test("labels win, with word boundaries (no substring bites)", () => {
  assert.equal(classifyLayer('$: note("c4")', "Dusty Kick"), "drums");
  assert.equal(classifyLayer('$: note("c4")', "Low Tom"), "drums");
  assert.equal(classifyLayer('$: note("c4")', "Hi-Hats"), "drums");
  assert.equal(classifyLayer('$: note("c4")', "Rolling Sub"), "bass");
  assert.equal(classifyLayer('$: note("c4")', "808s"), "bass");
  // substring traps from the old regexes:
  assert.equal(classifyLayer('$: note("c4 e4").s("gm_pad_warm")', "Slow Pad"), "melody");
  assert.equal(classifyLayer('$: note("c4 e4").s("gm_epiano1")', "Subtle Keys"), "melody");
  assert.equal(classifyLayer('$: note("c4 e4").s("gm_pad_halo")', "That Shimmer"), "melody");
  assert.equal(classifyLayer('$: note("c4 e4").s("gm_pad_sweep")', "Tomorrow Glow"), "melody");
});

test("melodic fallback", () => {
  assert.equal(classifyLayer('$: s("arpy:3 arpy:1")'), "melody");
  assert.equal(classifyLayer('$: note("c4 e4 g4").s("gm_pad_warm")'), "melody");
  assert.equal(classifyLayer('$: s("hoover:1")'), "melody");
  assert.equal(classifyLayer('$: s("birds:2")'), "melody");
});

test("assignChannelOrbits re-buses layers onto their channel decades", () => {
  const code = '$: s("bd*4").gain(0.9)\n$: note("c2 g1").s("sawtooth")\n$: note("c4 e4").s("gm_pad_warm")';
  const out = assignChannelOrbits(code);
  assert.match(out, /s\("bd\*4"\)\.gain\(0\.9\)\.orbit\(10\)/);
  assert.match(out, /note\("c2 g1"\)\.s\("sawtooth"\)\.orbit\(20\)/);
  assert.match(out, /note\("c4 e4"\)\.s\("gm_pad_warm"\)\.orbit\(30\)/);
});
