/**
 * strudel-track-spec.ts — the generation prompts for the DIRECT-STRUDEL path.
 *
 * Premise (2026-07-01, the user; born on Sonnet 5, now Fable 5): write Strudel DIRECTLY, one playable `$:` line at a
 * time — no TidalCycles, no compile step. The model is fluent enough in Strudel that the deterministic
 * Tidal→Strudel compiler buys us nothing here; we trade it for a simpler, lossless pipeline (what the
 * model writes IS what plays).
 *
 * These prompts state ONLY the task + the output contract — no dialect reference and no sound menu are
 * attached (2026-07-01, the user: "assume the model has this understanding"). The model already knows
 * Strudel and the sound names; the compose retry + the play-time gate + the console self-heal catch the
 * rare miss. One layer per call.
 *
 * 2026-07-13 (the user, twice): NO nannying — task + output contract + only the constraints that
 * prevent an observed mistake, each ONE terse clause. A restored "creative bar" paragraph was
 * rejected same day ("why are you putting up barriers for no reason?"). The one-shot-tail clause
 * stays: a reversed crash re-triggered every bar washed over a whole song (afc88060).
 */

/** CALL 1..N — compose ONE track's Strudel directly, locked to the tracks already placed. The model
 *  also CHOOSES this track's sound and names it in the line (no separate pick call) — compose-strudel
 *  reads the instrument back from the code. Says WHAT to add + the output contract only; no reference. */
export const STRUDEL_TRACK_SYSTEM = `You write ONE track of an instrumental Strudel loop — a single \`$: …\` line — choosing its sound and naming it in the line.

You're given the brief, the key, tempo and meter, and the Strudel of the tracks already placed. Add the one voice the loop is missing next, locked to what's already there and in key — no microtonal detune drift on \`note\`, and a found-object sample bank (metal, glass, coins, bottle…) rings at its OWN pitch: tune it into the key (note/speed) or keep it too short and dark to ring. \`.clip(…)\` on a sustained voice needs a \`.release(…)\` — the default 10ms cut clicks. ONE cycle = ONE bar of the given meter.

One \`$:\` line, one voice. It LOOPS, often for long stretches: the line plays at its full level every cycle — no multi-cycle fade-in from silence (that resets each time the loop repeats) — and stays alive across cycles (\`<…>\` alternation, sometimes, degradeBy). A long one-shot (reversed cymbal, riser) plays once per phrase and its tail resolves inside the loop — not every bar. In a genre that pumps, \`.duck(1)\` on the kick line sidechains the sustained voices against it (the engine wires the routing; shape with .duckdepth 0-1 and .duckattack seconds). Don't write \`setcpm(…)\` or set \`.orbit(…)\` — the merge adds those. Output the raw line only — no comments, no prose, no fences.`;

/** After each layer — a CHEAP (no-thinking) yes/no: is the loop complete, or does it still need a part?
 *  Run BETWEEN layers so the expensive compose call only ever WRITES, never decides whether to continue. */
export const STRUDEL_DONE_SYSTEM = `You decide whether a looping instrumental section is COMPLETE FOR ITS BRIEF, or still needs one more part. You are given the brief and the parts already in the loop (their Strudel).

The finished loop is then ARRANGED across many bars — layers enter and leave, and only a voice that exists in the loop can ever enter. The loop is the arrangement's PALETTE: rich, carrying every voice the section could want. Sparseness is the arrangement's job, not the loop's.

Reply MORE while the brief calls for something still missing, a role nothing covers, or the palette is thin. Reply DONE only once the next part would just DOUBLE a voice already there.

Output ONLY one word: DONE or MORE.`;

/** EDIT ONE LAYER (one call) — change a single layer WITH the whole loop in view, so the rewritten line
 *  stays locked to the others (rhythm, harmony, register). Output is just that one line — the full-context
 *  version of the fast single-layer edit. */
export const EDIT_STRUDEL_LAYER_SYSTEM = `You are editing ONE layer of an instrumental Strudel loop. You're given the whole loop — one \`$: …\` line per layer, numbered — which layer to change, and the change. Rewrite that layer with the change applied, locked to the other layers and in key; the others stay as they are. Don't write \`setcpm(…)\` or set \`.orbit(…)\`. Output EXACTLY ONE \`$:\` line — the changed layer — raw, no prose, no fences.`;

/** EDIT (one call) — apply the user's change to the loop's Strudel (one \`$: …\` line per layer). Returns
 *  the edited lines (same count/order) so the caller swaps them in 1:1. */
export const EDIT_STRUDEL_SYSTEM = `You are editing an instrumental Strudel loop — one \`$: …\` line per layer (the header says which is which). Apply the user's change, and only that change; leave the rest of the loop as it was. Keep the same number of \`$:\` lines in the same order. Don't write \`setcpm(…)\` or set \`.orbit(…)\`. Output the same number of \`$:\` lines, in order — raw, no prose, no fences.`;

/** EDIT, WHOLE LOOP, FREE SHAPE (one call) — the direct edit path (2026-07-03, the user): code in →
 *  code out, no routing. The change can rewrite, add or remove layers; untouched layers come back
 *  byte-identical (they carry the user's saved tweaks — a gratuitous rewrite loses them). */
export const EDIT_STRUDEL_WHOLE_SYSTEM = `You are editing an instrumental Strudel loop — one \`$: …\` line per layer (the header says which is which). Apply the change the user asked for: that can mean rewriting layers, adding new ones, or removing some — whatever the change needs, and nothing more. Every layer the change does not touch comes back BYTE-IDENTICAL. Don't write \`setcpm(…)\` or set \`.orbit(…)\`. Output the full revised loop: only \`$:\` lines, one per layer, raw, no prose, no fences. When the message carries THIS SECTION'S BRIEF, add ONE final line \`BRIEF: …\` — the brief word-for-word if it still describes the revised music, minimally revised where it no longer does; it stays a musical description of the section, never a mention of the edit. When the message carries THE TRACK'S DIRECTION NOTE and the change speaks to the WHOLE track's identity — a genre, era, style or energy steer, not just this loop — add ONE final line \`DIRECTION: …\`: the note rewritten whole to absorb the steer, at most 160 characters of purely musical terms (no quoted request, no artist names; the newest steer wins a conflict). A change that only touches this loop adds no DIRECTION line — when unsure, omit it.`;

/** RE-BAR (one call) — rewrite the loop's Strudel into a NEW time signature at the same tempo. */
export const METER_STRUDEL_SYSTEM = `You re-bar an instrumental Strudel loop — one \`$: …\` line per layer — into a new time signature at the same tempo, keeping it the same loop (same voices, sounds and character) re-phrased so one cycle is one bar of the new meter. Keep the same number of \`$:\` lines in the same order. Don't write \`setcpm(…)\` or set \`.orbit(…)\`. Output the same number of \`$:\` lines, in order — raw, no prose, no fences.`;

/** REPAIR (one call) — the loop threw an error in the browser at playback; fix ONLY what's broken.
 *  Given the loop's Strudel + the exact console error, return the corrected `$:` lines (same count/order)
 *  so the caller swaps them in 1:1. Runs when the in-app player reports a runtime error (auto self-heal). */
export const EDIT_STRUDEL_REPAIR_SYSTEM = `An instrumental Strudel loop — one \`$: …\` line per layer — threw an error in the browser at playback. You're given the loop and the exact console error. Fix what the error is about so it plays cleanly, and change nothing else. Keep the same number of \`$:\` lines in the same order. Don't write \`setcpm(…)\` or set \`.orbit(…)\`. Output the same number of \`$:\` lines, in order — raw, no prose, no fences.`;
