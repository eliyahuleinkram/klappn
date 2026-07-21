/**
 * Pure key / pitch-class helpers for harmony analysis on RESOLVED notes (from the
 * eval-free interpreter). The symbol-based chord checker only sees chord("…")
 * spellings; this works on the ACTUAL pitches every layer plays, so it can catch
 * a bassline or melody note that's out of the stated key — something no static
 * symbol scan can. Browser-free, dependency-free.
 *
 * Scope: only the unambiguous major/natural-minor keys (the keys the planner
 * emits). For modal/exotic keys we return null and skip the check rather than
 * risk false positives.
 */

const LETTER_PC: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};
const PC_NAME = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10]; // natural minor

export const pcName = (pc: number): string => PC_NAME[((pc % 12) + 12) % 12];

/** A note (MIDI number or name like "c3", "Bb4", "f#2") → pitch class 0-11. */
export function noteToPc(note: string | number): number | null {
  if (typeof note === "number" && Number.isFinite(note))
    return ((Math.round(note) % 12) + 12) % 12;
  if (typeof note !== "string") return null;
  const m = note.trim().match(/^([a-gA-G])([#bsf]*)/);
  if (!m) return null;
  let pc = LETTER_PC[m[1].toLowerCase()];
  for (const c of m[2]) pc += c === "#" || c === "s" ? 1 : -1; // b/f → flat
  return ((pc % 12) + 12) % 12;
}

export interface KeyInfo {
  pcs: Set<number>;
  name: string;
}

/** Parse "A minor" / "F# major" / "Bb minor" → its in-key pitch classes. Returns
 *  null for modal/exotic/unknown keys (we then skip out-of-key flagging). */
export function keyPitchClasses(key: string): KeyInfo | null {
  if (!key) return null;
  const m = key.trim().match(/^([a-gA-G][#bsf]?)\s*(.*)$/);
  if (!m) return null;
  const root = noteToPc(m[1]);
  if (root == null) return null;
  const q = m[2].toLowerCase().trim();
  let intervals: number[] | null = null;
  if (q === "" || /^(major|maj|ionian)\b/.test(q)) intervals = MAJOR;
  else if (/^(minor|min|m|aeolian)\b/.test(q)) intervals = MINOR;
  if (!intervals) return null; // unknown/modal → skip
  const pcs = new Set(intervals.map((i) => (root + i) % 12));
  // In minor, allow the raised 7th (harmonic-minor leading tone) — every V chord
  // uses it, so it's not "out of key". Keeps the check from flagging dominants.
  if (intervals === MINOR) pcs.add((root + 11) % 12);
  return {
    pcs,
    name: `${pcName(root)} ${intervals === MINOR ? "minor" : "major"}`,
  };
}
