/**
 * Tests for the dough bridge (lib/dough-bridge.ts) — the ONE seam between
 * superdough hap values and the WASM engine's events.
 * Run: node_modules/.bin/esbuild lib/dough-bridge.test.ts --bundle --format=esm --platform=node --outfile=/tmp/db.mjs && node --test /tmp/db.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeDoughEvent, hapToDoughEvent, noteToFreq } from "./dough-bridge";

test("a waveform hap maps completely — nothing dropped", () => {
  const { event, dropped, approximated } = hapToDoughEvent(
    {
      s: "sawtooth",
      note: 57, // a3
      gain: 0.8,
      attack: 0.01,
      release: 0.2,
      lpf: 3000,
      lpq: 4,
      pan: 0.4,
      vib: 4,
      vibmod: 0.1,
      delay: 0.3,
      delaytime: 0.25,
      delayfeedback: 0.4,
    },
    1.5,
    0.5,
  );
  assert.ok(event);
  assert.equal(event.sound, "sawtooth");
  assert.equal(event.time, 1.5);
  assert.equal(event.duration, 0.5);
  assert.ok(Math.abs((event.freq as number) - 220) < 0.001, "a3 = 220Hz");
  assert.equal(event.lpf, 3000);
  assert.equal(event.pan, 0.4);
  assert.equal(event.gain, 0.8);
  assert.deepEqual(dropped, []);
  assert.deepEqual(approximated, []);
});

test("gain composes from gain × postgain × velocity", () => {
  const { event } = hapToDoughEvent(
    { s: "sine", note: 69, gain: 0.5, postgain: 0.8, velocity: 0.5 },
    0,
    1,
  );
  assert.ok(event);
  assert.ok(Math.abs((event.gain as number) - 0.2) < 1e-9);
});

test("stand-ins are reported, not hidden", () => {
  const { event, approximated } = hapToDoughEvent(
    { s: "supersaw", note: 69, shape: 0.3, room: 0.5 },
    0,
    1,
  );
  assert.ok(event);
  assert.equal(event.sound, "sawtooth");
  assert.equal(event.distort, 0.3);
  assert.equal(event.verb, 0.5);
  assert.ok(approximated.includes("supersaw→sawtooth"));
  assert.ok(approximated.includes("shape→distort"));
});

test("unsupported sources return no event and name themselves", () => {
  const { event, dropped } = hapToDoughEvent(
    { s: "gm_violin", note: 69 },
    0,
    1,
  );
  assert.equal(event, null);
  assert.deepEqual(dropped, ["s:gm_violin"]);
});

test("unknown controls land in dropped", () => {
  const { event, dropped } = hapToDoughEvent(
    { s: "sine", note: 69, size: 4, duckdepth: 0.6 },
    0,
    1,
  );
  assert.ok(event);
  assert.ok(dropped.includes("size"));
  assert.ok(dropped.includes("duckdepth"));
});

test("wire form is key/value/… with a NUL tail", () => {
  const s = encodeDoughEvent({ dough: "play", time: 0, duration: 1, sound: "sine", freq: 440 });
  assert.ok(s.startsWith("dough/play/"));
  assert.ok(s.endsWith("\0"));
  assert.ok(s.includes("/freq/440"));
});

test("noteToFreq: 69 = 440, 57 = 220", () => {
  assert.equal(noteToFreq(69), 440);
  assert.ok(Math.abs(noteToFreq(57) - 220) < 1e-9);
});
