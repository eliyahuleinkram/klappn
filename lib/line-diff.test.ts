/**
 * Tests for the line diff (lib/line-diff.ts) — what the room shows you after
 * the machine writes a pane. Two things must be exactly right or the feature
 * lies: the `addedLines` numbers (they mark lines in the LIVE editor, so an
 * off-by-one paints the wrong line) and the "unchanged lines stay unchanged"
 * property (a whole-pane rewrite that reports every line as new tells you
 * nothing).
 * Run: tsx --test lib/line-diff.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines } from "./line-diff";

const PANE = `setcpm(128/4)
$: s("bd*4").bank("RolandTR909")
$: s("[~ hh]*4").gain(.4)
$: note("a1").s("sine")`;

test("a one-method change reads as one line in, one line out", () => {
  const after = PANE.replace('.gain(.4)', '.gain(.25)');
  const d = diffLines(PANE, after);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.deepEqual(d.addedLines, [3], "the changed line is the third one");
  assert.ok(
    d.rows.every((r) => r.kind !== "ctx" || PANE.includes(r.text)),
    "context rows must be real lines",
  );
});

test("the added-line numbers index the NEW text, so the pane marks the right rows", () => {
  const after = `setcpm(128/4)
$: s("bd*4").bank("RolandTR909")
$: s("cp").struct("~ x")
$: s("[~ hh]*4").gain(.4)
$: note("a1").s("sine")`;
  const d = diffLines(PANE, after);
  assert.deepEqual(d.addedLines, [3]);
  assert.equal(after.split("\n")[d.addedLines[0] - 1], '$: s("cp").struct("~ x")');
  assert.equal(d.removed, 0);
});

test("a mute is one line replaced, and the rest is left alone", () => {
  const after = PANE.replace('$: s("[~ hh]*4")', '_$: s("[~ hh]*4")');
  const d = diffLines(PANE, after);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  // Two untouched lines top and bottom: at most one of each survives as context.
  assert.ok(d.rows.filter((r) => r.kind === "ctx").length <= 2);
});

test("identical panes produce nothing at all", () => {
  const d = diffLines(PANE, PANE);
  assert.deepEqual(d.rows, []);
  assert.equal(d.added + d.removed, 0);
});

test("long untouched stretches collapse into one gap row", () => {
  const before = Array.from({ length: 40 }, (_, i) => `$: line${i}`).join("\n");
  const after = before.replace("$: line20", "$: line20.gain(.5)");
  const d = diffLines(before, after);
  const gaps = d.rows.filter((r) => r.kind === "gap");
  assert.equal(gaps.length, 2, "one gap above, one below");
  assert.ok(d.rows.length < 10, "a one-line change must not print forty lines");
  // 41 rows in full (39 untouched + one del + one add); four survive — the
  // changed pair and one line of breath either side.
  assert.equal(gaps.reduce((n, g) => n + (g.skipped ?? 0), 0), 37);
});

test("an emptied pane is all removal", () => {
  const d = diffLines(PANE, "");
  assert.equal(d.added, 1); // the one empty line
  assert.equal(d.removed, 4);
  assert.deepEqual(d.addedLines, [1]);
});
