// The fixed set of section labels a loop can carry. The AI picks one when a loop
// is created/placed (snapped to this list), and the user can re-assign it. Labels
// are how you filter/audition the track — "play just the drops", "just the
// verses" — and they replace the old explicit bridge feature (a "bridge" is now
// simply a loop labelled Bridge).
export const LABELS = [
  "Intro",
  "Build",
  "Drop",
  "Verse",
  "Chorus",
  "Hook",
  "Bridge",
  "Breakdown",
  "Fill",
  "Outro",
] as const;

export type Label = (typeof LABELS)[number];

/** ONE display form for every AI-given word/phrase (genres, break and hand-off names,
 *  layer names, preset/look chips): ENFORCED sentence case — lowercase everything,
 *  then first letter up ("Hard Techno" → "Hard techno", "dub techno" → "Dub techno").
 *  The model cases these however it fancies; casing must never depend on its mood, so
 *  normalize at generation AND at render (already-saved labels read the same). The one
 *  exception: an all-caps token with 2+ letters is an acronym (EDM, UK, R&B) — kept. */
export function sentenceLabel(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return s;
  const lowered = s
    .split(" ")
    .map((w) =>
      !/[a-z]/.test(w) && (w.match(/[A-Z]/g)?.length ?? 0) >= 2 ? w : w.toLowerCase(),
    )
    .join(" ");
  return lowered[0].toUpperCase() + lowered.slice(1);
}

/** Clean a free-text section label: trim, collapse whitespace, cap the length. Labels are
 *  DESCRIPTIVE free text (2026-07-02, the user: two sections both called "Intro" is useless) —
 *  the fixed LABELS vocabulary above is legacy; `kind` (loop/bridge) is its own column. */
export function cleanLabel(raw: string | null | undefined): string {
  const s = (raw || "").trim().replace(/\s+/g, " ").slice(0, 24).trim();
  return s || "Section";
}
