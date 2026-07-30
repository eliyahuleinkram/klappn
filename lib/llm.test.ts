/**
 * Tests for THE AGENT TABLE (lib/llm.ts ROUTE) — the invariants that decide
 * whether a call reaches the API at all.
 *
 * Every row here is a live request shape. Two of these rules are 400s, not
 * style: Claude Fable 5 rejects disabled thinking at ANY effort, and Opus 5
 * rejects disabled thinking above effort "high". The third catches a silent
 * lie — a maxTokens above its effort's tier is clamped down by completeAnthropic,
 * so the number in the table would not be the number in the request.
 *
 * Run: npm test (tsx --test lib/*.test.ts)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTE, resolveTier, type CompleteOpts } from "./llm";

const rows = Object.entries(ROUTE) as [string, CompleteOpts][];

/** completeAnthropic's own tier map — thinking:false collapses effort to "low". */
function tierTokens(o: CompleteOpts): number {
  const effort = o.thinking === false ? "low" : (o.effort ?? "high");
  if (effort === "max" || effort === "xhigh") return 64000;
  if (effort === "high") return 24000;
  if (effort === "medium") return 16000;
  return 8000;
}

test("every ROUTE row names a model", () => {
  assert.ok(rows.length > 0);
  for (const [name, o] of rows) {
    assert.ok(
      o.model === "fable" || o.model === "opus" || o.model === "sonnet",
      `ROUTE.${name} has no model — it would fall back to the song's stored tag`,
    );
  }
});

test("no fable row disables thinking (Fable 5 400s on {type:'disabled'})", () => {
  for (const [name, o] of rows) {
    if (o.model !== "fable") continue;
    assert.notEqual(
      o.thinking,
      false,
      `ROUTE.${name} is fable + thinking:false — the API rejects that pairing`,
    );
  }
});

test("no thinking-off row asks for xhigh/max (Opus 5 400s on disabled + xhigh)", () => {
  for (const [name, o] of rows) {
    if (o.thinking !== false) continue;
    assert.ok(
      o.effort !== "xhigh" && o.effort !== "max",
      `ROUTE.${name} pairs thinking:false with effort ${o.effort}`,
    );
  }
});

test("no row's maxTokens exceeds its effort tier (it would be silently clamped)", () => {
  for (const [name, o] of rows) {
    if (o.maxTokens == null) continue;
    const tier = tierTokens(o);
    assert.ok(
      o.maxTokens <= tier,
      `ROUTE.${name} asks for ${o.maxTokens} tokens but its tier caps at ${tier}`,
    );
  }
});

test("every row leaves room to answer (a budget under 100 can only be a typo)", () => {
  for (const [name, o] of rows) {
    if (o.maxTokens == null) continue;
    assert.ok(o.maxTokens >= 100, `ROUTE.${name} budgets only ${o.maxTokens} tokens`);
  }
});

test("the ear-critical calls are the ones on fable, and only those", () => {
  // Guards the INVENT/TRANSFORM line the whole table is built on: if a call
  // moves tier, this list moves with it deliberately — never by accident.
  const onFable = rows.filter(([, o]) => o.model === "fable").map(([n]) => n).sort();
  assert.deepEqual(onFable, ["breaks", "compose"]);
});

// ── THE QUALITY DIAL ─────────────────────────────────────────────────────────
// resolveTier is the only place the dial turns into a model id, and the failure
// mode of getting it wrong is a bill, so every branch is pinned here.

test("only a Studio song reaches the fable tier", () => {
  const invent = ROUTE.compose; // model: "fable"
  assert.equal(resolveTier({ model: "studio" }, invent), "fable");
  // Standard, unset, and every legacy tag resolve DOWN to Opus. "fable" is in
  // that list on purpose: bake-off-era rows carry it literally in songs.model
  // and must not silently become the expensive tier.
  for (const tag of ["opus", undefined, "fable", "anthropic", "glm", "kimi"])
    assert.equal(resolveTier({ model: tag }, invent), "opus", `song tag ${tag}`);
});

test("the dial moves NOTHING except the fable rows", () => {
  for (const song of ["studio", "opus", undefined]) {
    assert.equal(resolveTier({ model: song }, ROUTE.edit), "opus", "opus row");
    assert.equal(resolveTier({ model: song }, ROUTE.copy), "sonnet", "sonnet row");
    assert.equal(resolveTier({ model: song }, ROUTE.ghost), "opus", "no-think row");
  }
});

test("a call with no ROUTE entry still resolves sanely", () => {
  assert.equal(resolveTier(undefined, undefined), "opus");
  assert.equal(resolveTier({ model: "sonnet" }, undefined), "sonnet");
  // …and a Studio song does NOT get fable by accident when no row asked for it
  assert.equal(resolveTier({ model: "studio" }, undefined), "opus");
});
