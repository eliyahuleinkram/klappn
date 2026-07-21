/**
 * Mock Claude responses for testing without spending API credits.
 *
 * Enabled when KLAPPN_MOCK_LLM is "1"/"true" (a wrangler var on the app and/or
 * workflows worker) or when a caller passes { mock: true }. The mock returns
 * VALID, varied, playable Strudel so the full pipeline — generation Workflow,
 * DB writes, per-part playback, and "play whole song" — can be exercised end to
 * end without calling the real model. Keep production with the var unset.
 */

import type {
  EditedPart,
  PlanPart,
  SongPlan,
} from "./anthropic";

export function mockEnabled(explicit?: boolean): boolean {
  if (explicit) return true;
  const v = process.env.KLAPPN_MOCK_LLM;
  return v === "1" || v === "true";
}

/** Strudel `scale` name like "a:minor" from a plan key like "A minor". */
function scaleName(key: string): string {
  const m = key.match(/\b([A-G][#b]?)\b/i);
  const root = (m ? m[1] : "C").toLowerCase();
  const mode = /maj/i.test(key) ? "major" : "minor";
  return `${root}:${mode}`;
}

// A few distinct, valid layered patterns. Each is a complete program (sets
// tempo, stacks layers via `$:`) so it plays on its own AND in the song
// scheduler. They differ audibly so transitions between sections are obvious.
const VARIANTS: ((scale: string) => string)[] = [
  (scale) =>
    `$: note("0 ~ 2 ~").scale("${scale}").s("piano").room(0.6).gain(0.7)
$: s("~ hh ~ hh").gain(0.35)`,
  (scale) =>
    `$: s("bd*2 sd").bank("RolandTR909").gain(0.9)
$: s("hh*8").gain(0.4)
$: n("0 2 4 <6 5>").scale("${scale}").s("sawtooth").lpf(900).gain(0.5)
$: n("<0 -3>").scale("${scale}").sub(note(12)).s("sine").gain(0.8)`,
  (scale) =>
    `$: s("bd ~ ~ bd").bank("RolandTR808").gain(0.85)
$: note("0 4 2 5").scale("${scale}").s("piano").delay(0.4).gain(0.6)`,
  (scale) =>
    `$: note("<0 2 4 7>").scale("${scale}").s("piano").slow(2).room(0.8).gain(0.6)
$: s("~ ~ ~ rim").bank("RolandTR707").gain(0.3)`,
];

export function mockPart(plan: SongPlan, target: PlanPart, index: number): string {
  const scale = scaleName(plan.key);
  const bpc = 4;
  const body = VARIANTS[index % VARIANTS.length](scale);
  return `// [MOCK] ${target.label}\nsetcpm(${plan.bpm}/${bpc})\n${body}`;
}

export function mockEdit(
  parts: { id: string; label: string | null; strudel: string | null }[],
  changeRequest: string,
): EditedPart[] {
  // Echo every part back unchanged except a marker comment so the edit is
  // observable in tests without the model.
  return parts.map((p) => ({
    id: p.id,
    strudel: `// [MOCK edit] ${changeRequest.slice(0, 60)}\n${p.strudel ?? ""}`,
  }));
}
