/**
 * THE BRIDGE GATE — does a control a coder wrote actually REACH the engine?
 *
 * lib/zaltz-controls.test.ts proves every control is classified. This file
 * proves the classification is honest: it drives Strudel for real (building a
 * pattern with the same control methods a coder types), reads the haps, runs
 * them through the bridge's own hapKv, and asserts the engine event carries
 * the control.
 *
 * `.duck()` shipped broken for weeks because Strudel writes it to the hap as
 * `duckorbit` while the bridge read `duck` — no test compared the two ends.
 * These do.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hapKv } from "./zaltz";

type Ctl = (v: unknown) => { queryArc(a: number, b: number): { value: Record<string, unknown> }[] };

/** Build a hap the way Strudel really does — chaining the control METHODS a
 *  coder writes, then reading whatever keys Strudel decided to use. */
async function hapFor(chain: (c: Record<string, Ctl>) => unknown): Promise<Record<string, unknown>> {
  const mod = await import("@strudel/core/controls.mjs");
  const controls = ((mod as Record<string, unknown>).controls ?? mod) as Record<string, Ctl>;
  const pat = chain(controls) as { queryArc(a: number, b: number): { value: Record<string, unknown> }[] };
  const haps = pat.queryArc(0, 1);
  assert.ok(haps.length, "the pattern produced no haps");
  return haps[0].value;
}

/** kv strings are "k/v/k/v/…" — pull a value back out. */
function kvGet(kv: string, key: string): string | null {
  const parts = kv.split("/");
  for (let i = 0; i < parts.length - 1; i += 2) if (parts[i] === key) return parts[i + 1];
  return null;
}

test(".duck() reaches the engine as a duck target list", async () => {
  // Strudel writes BOTH .duck() and .duckorbit() to the hap key `duckorbit`.
  const v = await hapFor((c) => (c.s("sawtooth") as never as { duck(x: unknown): unknown }).duck("20:30"));
  // Strudel stores it as an array or a colon string depending on how it was
  // written — the bridge must read the KEY (`duckorbit`) and accept both.
  assert.ok(v.duckorbit != null, "Strudel changed how .duck() is stored");
  const kv = hapKv(v, 0.5);
  assert.ok(kv, "the bridge produced no event");
  assert.equal(kvGet(kv, "duck"), "20:30", `the sidechain never reached the engine: ${kv}`);
});

test(".duckorbit() with a single target reaches the engine", async () => {
  const v = await hapFor((c) => (c.s("sawtooth") as never as { duckorbit(x: unknown): unknown }).duckorbit(2));
  const kv = hapKv(v, 0.5);
  assert.equal(kvGet(kv!, "duck"), "2");
});

test(".stretch() reaches the engine", async () => {
  const v = await hapFor((c) => (c.s("sawtooth") as never as { stretch(x: unknown): unknown }).stretch(0.1));
  const kv = hapKv(v, 0.5);
  assert.equal(kvGet(kv!, "stretch"), "0.1", `stretch was dropped: ${kv}`);
});

test(".rdim() reaches the engine as roomdim", async () => {
  const v = await hapFor((c) =>
    ((c.s("sawtooth") as never as { room(x: unknown): { rdim(x: unknown): unknown } }).room(0.5)).rdim(0.5),
  );
  assert.equal(v.roomdim, 0.5, "Strudel changed how .rdim() is stored");
  const kv = hapKv(v, 0.5);
  assert.equal(kvGet(kv!, "roomdim"), "0.5", `rdim was dropped: ${kv}`);
});

test("the pitch-envelope family reaches the engine", async () => {
  const v = await hapFor((c) =>
    ((c.s("sawtooth") as never as { penv(x: unknown): { patt(x: unknown): unknown } }).penv(1)).patt(0.1),
  );
  const kv = hapKv(v, 0.5)!;
  assert.equal(kvGet(kv, "penv"), "1");
  assert.equal(kvGet(kv, "pattack"), "0.1", ".patt() writes pattack — the bridge must read pattack");
});

test("the tremolo family reaches the engine", async () => {
  const v = await hapFor((c) =>
    ((c.s("sawtooth") as never as { trem(x: unknown): { tremdepth(x: unknown): unknown } }).trem(4)).tremdepth(0.8),
  );
  const kv = hapKv(v, 0.5)!;
  assert.equal(kvGet(kv, "tremolo"), "4");
  assert.equal(kvGet(kv, "tremolodepth"), "0.8");
});

test("a distortion shorthand reaches the engine with its algorithm", async () => {
  // .soft(.6) → distort([.6, 1, 'soft']) → distort + distortvol + distorttype
  const mod = await import("@strudel/core/pattern.mjs");
  const ctl = await import("@strudel/core/controls.mjs");
  const controls = ((ctl as Record<string, unknown>).controls ?? ctl) as Record<string, Ctl>;
  void mod; // importing pattern.mjs registers the distortion shorthands
  const pat = (controls.s("sawtooth") as never as { soft(x: unknown): unknown }).soft(0.6) as {
    queryArc(a: number, b: number): { value: Record<string, unknown> }[];
  };
  const v = pat.queryArc(0, 1)[0].value;
  const kv = hapKv(v, 0.5)!;
  assert.equal(kvGet(kv, "distort"), "0.6");
  assert.equal(kvGet(kv, "distorttype"), "soft", `the algorithm was lost: ${kv}`);
});

test("aliases the user actually types land on the engine's keys", async () => {
  const v = await hapFor((c) =>
    (
      (c.s("sawtooth") as never as { vel(x: unknown): { dec(x: unknown): { rel(x: unknown): unknown } } }).vel(0.9)
    )
      .dec(0.3)
      .rel(0.2),
  );
  const kv = hapKv(v, 0.5)!;
  assert.equal(kvGet(kv, "velocity"), "0.9", ".vel() must arrive as velocity");
  assert.equal(kvGet(kv, "decay"), "0.3");
  assert.equal(kvGet(kv, "release"), "0.2");
});

test("a control the engine does not implement is never emitted as a fake", async () => {
  const v = await hapFor((c) => (c.s("sawtooth") as never as { vowel(x: unknown): unknown }).vowel("a"));
  const kv = hapKv(v, 0.5)!;
  assert.equal(kvGet(kv, "vowel"), null, "an unported control must not be forwarded as if it worked");
});

test("no event is ever emitted with a NaN or exponent-notation value", async () => {
  // parse_f in the engine reads plain decimals; "3e-9" would land as 3.
  const v = await hapFor((c) =>
    ((c.s("sawtooth") as never as { gain(x: unknown): { pan(x: unknown): unknown } }).gain(0.8)).pan(0.5),
  );
  const kv = hapKv(v, 0.000000003)!;
  const parts = kv.split("/");
  for (let i = 1; i < parts.length; i += 2) {
    assert.ok(!/e[-+]/i.test(parts[i]), `exponent notation reached the engine: ${parts[i - 1]}/${parts[i]}`);
    assert.ok(parts[i] !== "NaN", `NaN reached the engine at ${parts[i - 1]}`);
  }
});
