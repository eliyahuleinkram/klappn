/**
 * Tests for the room conversation's stream splitter (lib/zaltz-assist
 * makeChatSplitter) — the piece that decides, delta by delta, what is a WORD
 * and what is a PANE while the answer is still being written.
 *
 * It is tested rather than trusted because both of its failure modes are
 * silent: half a marker leaking into the chat as prose ("[sou"), or a pane
 * whose first bytes were already spoken and can never be un-spoken. The
 * chunkings below are the ones the wire actually produces — one character at a
 * time, and splits landing INSIDE a marker.
 * Run: tsx --test lib/room-chat.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChatSplitter, chatUserText } from "./zaltz-assist";

interface Caught {
  said: string;
  opened: string[];
  closed: { pane: string; code: string }[];
}

/** Feed one answer through the splitter in the given chunk sizes. */
function run(answer: string, chunk: number): Caught {
  const got: Caught = { said: "", opened: [], closed: [] };
  const s = makeChatSplitter({
    say: (t) => {
      got.said += t;
    },
    open: (p) => got.opened.push(p),
    close: (p, code) => got.closed.push({ pane: p, code }),
  });
  for (let i = 0; i < answer.length; i += chunk) s.push(answer.slice(i, i + chunk));
  s.end();
  return got;
}

const ANSWER = `Dirtier, and the hats get out of the way.

[sound]
setcpm(128/4)
$: s("bd*4").bank("RolandTR909")
$: note("c2 [eb2 g2]").s("sawtooth").lpf(600)
[/sound]
[picture]
osc(6, .1, .8).out()
[/picture]`;

const SOUND = `setcpm(128/4)
$: s("bd*4").bank("RolandTR909")
$: note("c2 [eb2 g2]").s("sawtooth").lpf(600)`;

test("words and panes separate identically at every chunking — including one byte at a time", () => {
  for (const chunk of [1, 2, 3, 7, 13, 64, 10_000]) {
    const got = run(ANSWER, chunk);
    assert.equal(
      got.said.trim(),
      "Dirtier, and the hats get out of the way.",
      `chunk ${chunk}: prose leaked or was truncated`,
    );
    // NOTHING resembling a marker may ever reach the chat as words.
    assert.ok(!/\[\/?(s|p)/.test(got.said), `chunk ${chunk}: a marker leaked into the words`);
    assert.deepEqual(got.opened, ["strudel", "hydra"], `chunk ${chunk}: wrong panes opened`);
    assert.equal(got.closed.length, 2, `chunk ${chunk}: wrong number of panes`);
    assert.equal(got.closed[0].pane, "strudel");
    assert.equal(got.closed[0].code.trim(), SOUND, `chunk ${chunk}: the sound pane came back wrong`);
    assert.equal(got.closed[1].pane, "hydra");
    assert.equal(got.closed[1].code.trim(), "osc(6, .1, .8).out()");
  }
});

test("a pure conversation answer writes nothing", () => {
  const got = run("`.ply(2)` repeats each event twice — it is a stutter, not a speed-up.", 5);
  assert.equal(got.opened.length, 0);
  assert.equal(got.closed.length, 0);
  assert.ok(got.said.includes("stutter"));
});

test("an answer cut off mid-pane still closes it — the gate gets to refuse it", () => {
  // A cap-truncated reply: the model ran out of tokens inside the block. The
  // half-pane must arrive at the gate, not vanish (and not land).
  const got = run("here you go\n[sound]\nsetcpm(128/4)\n$: s(\"bd*4", 6);
  assert.deepEqual(got.opened, ["strudel"]);
  assert.equal(got.closed.length, 1);
  assert.ok(got.closed[0].code.includes("setcpm(128/4)"));
});

test("words that follow a pane are still words", () => {
  const got = run("one sec\n[sound]\n$: s(\"hh*8\")\n[/sound]\nthat is the hats.", 4);
  assert.equal(got.closed.length, 1);
  assert.ok(got.said.includes("one sec"));
  assert.ok(got.said.includes("that is the hats."));
});

test("the transcript carries the panes, the hit and the words — and nothing else", () => {
  const text = chatUserText({
    strudel: '$: s("bd*4")',
    hydra: "",
    hit: { title: "Voltage", program: "$: arrange(…)" },
    playing: true,
    selection: { pane: "strudel", text: '.lpf(600)' },
    history: [{ role: "them", text: "louder" }],
    message: "now halve the tempo",
  });
  assert.ok(text.includes('$: s("bd*4")'));
  assert.ok(text.includes("(empty)"), "an empty pane must say so, not go missing");
  assert.ok(text.includes("Voltage"));
  assert.ok(text.includes("THE ROOM IS PLAYING"));
  assert.ok(text.includes(".lpf(600)"));
  assert.ok(text.includes("them: louder"));
  assert.ok(text.trimEnd().endsWith("now halve the tempo"), "the ask must land last");
});
