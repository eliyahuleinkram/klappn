/**
 * THE COVERAGE GATE.
 *
 * Every one of these tests exists because a real bug shipped past a green
 * suite. The suite was green because it only tested behaviour we had already
 * thought of; the bugs were all controls the bridge never looked at.
 *
 * So this file does not assert a list WE wrote. It asks STRUDEL what controls
 * exist — calling each one and reading the key it actually writes onto the hap
 * — and demands that every single one is classified in lib/zaltz-controls.ts.
 * Forget to wire a control, or upgrade Strudel and gain a new one, and this
 * fails by name.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DERIVED,
  NUM_KEYS,
  PATTERN_LEVEL,
  RENAME,
  UNSUPPORTED,
  isClassified,
} from "./zaltz-controls";

/** Ask Strudel for the canonical hap key of every control it exposes.
 *  `.duck(2)` writes `{duckorbit: 2}` — reading the KEY, not the alias, is the
 *  whole point: the 07-29 duck bug was the bridge trusting the alias. */
async function canonicalKeys(): Promise<Map<string, string[]>> {
  const mod = await import("@strudel/core/controls.mjs");
  const controls = ((mod as Record<string, unknown>).controls ?? mod) as Record<string, unknown>;
  const keys = new Map<string, string[]>();
  for (const name of Object.keys(controls)) {
    const fn = controls[name];
    if (typeof fn !== "function") continue;
    try {
      const pat = (fn as (v: number) => { queryArc(a: number, b: number): { value: unknown }[] })(1);
      const haps = pat.queryArc(0, 1);
      if (!haps.length || typeof haps[0].value !== "object" || haps[0].value == null) continue;
      for (const k of Object.keys(haps[0].value as Record<string, unknown>)) {
        const arr = keys.get(k) ?? [];
        arr.push(name);
        keys.set(k, arr);
      }
    } catch {
      /* a control that needs more than a bare number can't be probed this way */
    }
  }
  return keys;
}

test("every Strudel control is classified by the bridge", async () => {
  const keys = await canonicalKeys();
  assert.ok(keys.size > 300, `expected Strudel's full control surface, got ${keys.size}`);
  const unclassified = [...keys.keys()].filter((k) => !isClassified(k)).sort();
  assert.deepEqual(
    unclassified,
    [],
    `${unclassified.length} control(s) reach the hap with no entry in lib/zaltz-controls.ts.\n` +
      `Wire them into NUM_KEYS/RENAME/DERIVED, or declare the gap in UNSUPPORTED:\n  ` +
      unclassified.map((k) => `${k} (from .${(keys.get(k) ?? []).join("/.")}())`).join("\n  "),
  );
});

test("a control is classified exactly once", async () => {
  const keys = await canonicalKeys();
  const bucketsOf = (k: string) =>
    [
      (NUM_KEYS as readonly string[]).includes(k) && "NUM_KEYS",
      Object.values(RENAME).includes(k) && "RENAME",
      DERIVED.has(k) && "DERIVED",
      PATTERN_LEVEL.has(k) && "PATTERN_LEVEL",
      k in UNSUPPORTED && "UNSUPPORTED",
    ].filter(Boolean);
  for (const k of keys.keys()) {
    // RENAME sources legitimately also appear as their own target (lpf → lpf)
    if (k in RENAME) continue;
    assert.equal(bucketsOf(k).length, 1, `"${k}" is in ${bucketsOf(k).join(" + ")} — pick one`);
  }
});

/** The three that actually shipped broken, plus the families around them. A
 *  regression here means a supported effect went silent again. */
test("effects the engine implements are never declared unsupported", async () => {
  const keys = await canonicalKeys();
  const mustWork = [
    "duckorbit", "duckattack", "duckdepth", "duckonset", // .duck() never reached the engine
    "stretch",                                            // phase vocoder was dropped
    "roomdim", "roomlp", "roomsize", "room",              // rdim was dropped
    "distort", "distortvol", "distorttype",
    "tremolo", "tremolodepth", "tremoloskew", "tremolophase", "tremolosync",
    "penv", "pattack", "pdecay", "psustain", "prelease", "panchor",
    "shape", "shapevol", "crush", "coarse", "postgain", "gain", "velocity",
    "note", "freq", "s", "n", "bank", "orbit", "speed", "cut", "pan",
  ];
  for (const k of mustWork) {
    assert.ok(
      !(k in UNSUPPORTED),
      `"${k}" is implemented in engine/zaltz.c but declared UNSUPPORTED — it will warn and confuse`,
    );
    assert.ok(isClassified(k), `"${k}" fell out of the contract entirely`);
  }
  // `keys` is only probed with a bare number, so colon-argument controls
  // (.shape("drive:vol") → shapevol) don't appear in it; the staleness check
  // for the declared gaps lives in its own test below.
  assert.ok(keys.size > 300);
});

test("aliases resolve to the key the bridge reads, not the name in the code", async () => {
  const keys = await canonicalKeys();
  // Each pair is a trap the bridge fell into (or could): the method a coder
  // writes vs the key that lands on the hap.
  const traps: [string, string][] = [
    ["duck", "duckorbit"],
    ["vel", "velocity"],
    ["rdim", "roomdim"],
    ["patt", "pattack"],
    ["dec", "decay"],
    ["rel", "release"],
    ["att", "attack"],
  ];
  for (const [alias, key] of traps) {
    const sources = keys.get(key) ?? [];
    assert.ok(
      sources.includes(alias),
      `.${alias}() no longer writes "${key}" — the bridge reads "${key}"`,
    );
    assert.ok(isClassified(key), `"${key}" (written by .${alias}()) is unclassified`);
  }
});

test("UNSUPPORTED entries carry a reason and name a real control", async () => {
  const keys = await canonicalKeys();
  for (const [k, why] of Object.entries(UNSUPPORTED)) {
    assert.ok(why && why.length > 10, `UNSUPPORTED["${k}"] needs a real reason, got "${why}"`);
    assert.ok(keys.has(k), `UNSUPPORTED["${k}"] is not a control Strudel emits — stale`);
  }
});
