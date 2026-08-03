import test from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MOVES,
  TRANSITION_SOUNDS,
  transitionKnobText,
  transitionKnobsOf,
  transitionPlan,
  sanitizeTransition,
} from "./transitions-catalog";
import { GM_SOUNDS } from "./sound-palette";

/**
 * THE ONE LAW A TRANSITION CANNOT BREAK: it ends with every dial exactly where
 * it found it. The gesture borrows the master, the filter, the echo and the
 * tape speed for a few bars — if any of them is still leaning when the move is
 * over, the room is quietly broken for the rest of the night and nobody knows
 * why. (Same instinct as the endings' "every tail reaches zero by
 * construction": prove it in the catalog, never trust the runner to tidy up.)
 */
test("every transition begins and ends at rest", () => {
  for (const m of TRANSITION_MOVES) {
    const plan = transitionPlan({ tpl: m.tpl }, 0.5);
    for (const ms of [0, plan.totalMs]) {
      const f = plan.frameAt(ms);
      // `===`, not deepEqual: a curve that lands on -0 is at rest like any
      // other zero, and failing on the sign of nothing helps nobody.
      assert.ok(f.master === 1, `${m.tpl} master at ${ms}ms: ${f.master}`);
      assert.ok(f.filter === 0, `${m.tpl} filter at ${ms}ms: ${f.filter}`);
      assert.ok(f.echo === 0, `${m.tpl} echo at ${ms}ms: ${f.echo}`);
      assert.ok(f.space === 0, `${m.tpl} space at ${ms}ms: ${f.space}`);
      assert.ok(f.rate === 1, `${m.tpl} rate at ${ms}ms: ${f.rate}`);
    }
  }
});

test("no frame can ever leave the engine's ranges", () => {
  for (const m of TRANSITION_MOVES) {
    // the extremes of every knob, not just the defaults
    for (const depth of [0, 1]) {
      for (const tone of [0, 0.5, 1]) {
        for (const space of [0, 1]) {
          const plan = transitionPlan({ tpl: m.tpl, depth, tone, space, bars: 8 }, 0.5);
          for (let i = 0; i <= 40; i++) {
            const f = plan.frameAt((plan.totalMs * i) / 40);
            const where = `${m.tpl} d${depth} t${tone} s${space} @${i}`;
            assert.ok(f.master >= 0 && f.master <= 1, `${where} master ${f.master}`);
            assert.ok(f.filter >= -100 && f.filter <= 100, `${where} filter ${f.filter}`);
            assert.ok(f.echo >= 0 && f.echo <= 1, `${where} echo ${f.echo}`);
            assert.ok(f.space >= 0 && f.space <= 1, `${where} space ${f.space}`);
            // a rate of zero is a stopped scheduler, not a tape stop
            assert.ok(f.rate > 0.05 && f.rate <= 1, `${where} rate ${f.rate}`);
            if (f.echoTime !== undefined)
              assert.ok(f.echoTime >= 0.05 && f.echoTime <= 1.4, `${where} echoTime`);
            if (f.echoTail !== undefined)
              assert.ok(f.echoTail >= 0 && f.echoTail <= 0.85, `${where} echoTail`);
          }
        }
      }
    }
  }
});

test("the swap lands inside the move, and every one-shot with it", () => {
  for (const m of TRANSITION_MOVES) {
    const plan = transitionPlan({ tpl: m.tpl }, 0.5);
    assert.ok(plan.swapMs >= 0 && plan.swapMs <= plan.totalMs, `${m.tpl} swap`);
    for (const h of plan.hits) {
      assert.ok(h.ms >= 0 && h.ms <= plan.totalMs, `${m.tpl} hit at ${h.ms}`);
      assert.ok(h.gain > 0 && h.gain <= 1, `${m.tpl} hit gain`);
      assert.ok(h.duration > 0, `${m.tpl} hit duration`);
    }
  }
});

/** A gm_ name that isn't registered loads NOTHING — a silent riser is worse
 *  than no riser, and it would only ever be discovered by ear, on stage. */
test("every sound a transition throws is a real soundfont", () => {
  assert.ok(TRANSITION_SOUNDS.length > 0);
  for (const s of TRANSITION_SOUNDS) assert.ok(GM_SOUNDS.has(s), `${s} is not registered`);
});

test("bars and tempo set the length; a cut is instant", () => {
  const four = transitionPlan({ tpl: "blend", bars: 4 }, 0.5); // 0.5 cps = a 2s bar
  assert.equal(four.totalMs, 8000);
  assert.equal(four.swapMs, 4000);
  const fast = transitionPlan({ tpl: "blend", bars: 4 }, 1);
  assert.equal(fast.totalMs, 4000);
  const cut = transitionPlan({ tpl: "cut" }, 0.5);
  assert.equal(cut.totalMs, 0);
  assert.equal(cut.swapMs, 0);
  assert.deepEqual(cut.frameAt(0).master, 1);
});

test("a missing or bogus shape becomes the house blend, in range", () => {
  assert.equal(transitionKnobsOf(undefined).move.tpl, "blend");
  assert.equal(transitionKnobsOf({ tpl: "wobble" }).move.tpl, "blend");
  const s = sanitizeTransition({ tpl: "sweep", depth: 9, bars: -3, lands: 99, tone: "hot" });
  assert.equal(s.tpl, "sweep");
  assert.equal(s.depth, 1);
  assert.equal(s.bars, 1);
  assert.equal(s.lands, 8);
  assert.equal(s.tone, transitionKnobsOf({ tpl: "sweep" }).knobs.tone);
});

test("the knob words read like a sentence", () => {
  assert.equal(transitionKnobText("lands", 0), "the second you say so");
  assert.equal(transitionKnobText("lands", 1), "the next bar");
  assert.equal(transitionKnobText("lands", 4), "the next 4-bar line");
  assert.equal(transitionKnobText("bars", 1), "1 bar");
  assert.equal(transitionKnobText("bars", 3), "3 bars");
  assert.equal(transitionKnobText("depth", 0.5), "50%");
});

/** The sweep is the one template whose TONE changes direction, not amount —
 *  below halfway the room shuts down, above it thins out. */
test("tone steers the sweep both ways", () => {
  const shut = transitionPlan({ tpl: "sweep", tone: 0 }, 0.5);
  const thin = transitionPlan({ tpl: "sweep", tone: 1 }, 0.5);
  assert.ok(shut.frameAt(shut.swapMs * 0.9).filter < -40);
  assert.ok(thin.frameAt(thin.swapMs * 0.9).filter > 40);
});
