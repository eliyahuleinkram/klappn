/**
 * THE SAMPLE PRECEDENCE GATE.
 *
 * Ten sound names are defined by BOTH the bulk Dirt-Samples library and the
 * curated kits klappn loads beside it: bd cb cp cr hh ht lt mt sd, and sax.
 * strudel.cc never loads bulk Dirt for those — its `hh` is uzu-drumkit's five
 * hi-hats — so whichever manifest we let win decides whether the same code
 * plays the same drums here as it does there.
 *
 * It lost for months, silently: Dirt's `hh` list is thirteen files, only the
 * FIRST of which is a closed hat (n=5,6 are hh3kick1/hh3kick2 — kick drums
 * filed under hi-hat). So `s("hh")` sounded right while `s("hh:<2 4 5 6>")`
 * played kicks: "it sounds like a DJ scratching, I hear no hi hat". The bug
 * was invisible to every engine-level test because BOTH engines resolved it
 * the same wrong way.
 *
 * These tests pin the ORDER and the resolution rule with fixtures, so a
 * reordering of the manifest list fails here instead of in someone's ears.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MANIFEST_ORDER, mergeSampleManifests } from "./zaltz";

/** The names both libraries define — the ones precedence actually decides. */
const CONTESTED = ["bd", "cb", "cp", "cr", "hh", "ht", "lt", "mt", "sd"];

test("the curated kits are loaded AFTER the bulk library", () => {
  const order = [...MANIFEST_ORDER];
  assert.equal(order[0], "lib", "the bulk Dirt library must load first (lowest precedence)");
  assert.equal(
    order[order.length - 1],
    "d0",
    "uzu-drumkit must load LAST — it owns the core drum kit on strudel.cc",
  );
});

test("a curated kit wins every contested name", () => {
  // Fixtures shaped like the real manifests: the bulk library defines the
  // contested names with junk at higher indices; the curated kit defines them
  // properly.
  const bulk = { _base: "https://dirt/", ...Object.fromEntries(
    CONTESTED.map((k) => [k, [`${k}/000_ok.wav`, `${k}/001_junk.wav`, `${k}/002_kick.wav`]]),
  ), arpy: ["arpy/000.wav"] };
  const curated = { _base: "https://uzu/", ...Object.fromEntries(
    CONTESTED.map((k) => [k, [`${k}/10_${k}.wav`, `${k}/11_${k}.wav`]]),
  ) };

  const merged = mergeSampleManifests([bulk, curated]);
  for (const k of CONTESTED) {
    const urls = merged[k] as string[];
    assert.ok(Array.isArray(urls), `${k} vanished from the merge`);
    assert.ok(
      urls.every((u) => u.startsWith("https://uzu/")),
      `"${k}" resolved to the bulk library — it will not match strudel.cc:\n  ${urls[0]}`,
    );
  }
  // …and a name only the bulk library has is still there (the 218-category
  // palette the composer writes from must survive).
  assert.deepEqual(merged.arpy, ["https://dirt/arpy/000.wav"]);
});

test("every index of a contested name comes from the same kit", () => {
  // The original bug was index-dependent: n=0 sounded fine, n=5 played a kick.
  // A half-merged name would be worse than either library.
  const bulk = { _base: "https://dirt/", hh: Array.from({ length: 13 }, (_, i) => `hh/${i}_dirt.wav`) };
  const curated = { _base: "https://uzu/", hh: Array.from({ length: 5 }, (_, i) => `hh/${i}_uzu.wav`) };
  const merged = mergeSampleManifests([bulk, curated]) as Record<string, string[]>;
  assert.equal(merged.hh.length, 5, "the curated list must REPLACE, never extend, the bulk one");
  for (const u of merged.hh) assert.ok(u.startsWith("https://uzu/"), `mixed kits: ${u}`);
});

test("names are lowercased so machine spellings resolve", () => {
  // superdough lowercases every key at registration; akailinn_oh must find
  // AkaiLinn_oh.
  const merged = mergeSampleManifests([{ _base: "https://m/", AkaiLinn_oh: ["AkaiLinn/oh.wav"] }]);
  assert.ok(merged["akailinn_oh"], "manifest keys must be normalized to lower case");
});

test("a pitched (note-keyed) map keeps its zones instead of flattening", () => {
  // Flattening a multisample map makes every note play the lowest zone — the
  // 07-20 "same low note over and over" piano bug.
  const merged = mergeSampleManifests([
    { _base: "https://p/", piano: { A0: "A0.wav", C4: "C4.wav" } },
  ]);
  const zones = merged.piano as { midi: number; urls: string[] }[];
  assert.ok(Array.isArray(zones) && typeof zones[0] === "object" && "midi" in zones[0],
    "note-keyed maps must stay pitched zones");
  assert.equal(zones.length, 2);
});
