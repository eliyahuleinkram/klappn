/**
 * Tests for the direct-Strudel pipeline (lib/compose-strudel.ts): the model writes one playable `$:`
 * line per layer, we detect a layer line (hasStrudelLine — the "done" signal is its absence), and the
 * shared static validator (validateStrudel) is what gates a bare line. saysDone parses the between-layer
 * check. The async LLM compose/edit calls aren't exercised here (no network).
 * Run: node_modules/.bin/esbuild lib/compose-strudel.test.ts --bundle --format=esm --platform=node --outfile=/tmp/cs.mjs && node --test /tmp/cs.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasStrudelLine, saysDone } from './compose-strudel';
import { validateStrudel } from './strudel-validate';

test('hasStrudelLine detects a real layer line (the "done" signal is its absence)', () => {
  assert.equal(hasStrudelLine('$: s("bd*4").bank("RolandTR909").gain(0.9)'), true);
  assert.equal(hasStrudelLine('```\n$: note("a2 c3").s("sawtooth")\n```'), true);
  // a bare source line (no $:) still counts — the model occasionally drops the label
  assert.equal(hasStrudelLine('note("c e g").s("piano")'), true);
  // DONE / prose / a stray setcpm = NO layer = the loop is complete
  assert.equal(hasStrudelLine('DONE'), false);
  assert.equal(hasStrudelLine('The loop is complete and banging.'), false);
  assert.equal(hasStrudelLine('setcpm(120/4)'), false);
});

test('saysDone parses the between-layer "are we done?" reply', () => {
  assert.equal(saysDone('DONE'), true);
  assert.equal(saysDone('MORE'), false);
  assert.equal(saysDone('done, but add more'), false); // ambiguous → keep going
});

test('validateStrudel gates a bare layer line (no setcpm, no bpm ctx)', () => {
  // a good melodic + a good drum line pass clean
  assert.equal(validateStrudel('$: chord("<Am7 Dm7>").voicing().s("gm_epiano1").clip(0.9)').errors.length, 0);
  assert.equal(validateStrudel('$: s("bd*4").bank("RolandTR909").gain(0.9)').errors.length, 0);
  // a hallucinated gm_ sound is silent → an error the compose retry feeds back
  assert.ok(validateStrudel('$: note("c2").s("gm_not_a_real_sound")').errors.length > 0);
  // a bogus drum bank is silent → error
  assert.ok(validateStrudel('$: s("bd*4").bank("NotARealMachine")').errors.length > 0);
});
