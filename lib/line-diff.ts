/**
 * A line diff, for showing what the machine just did to your code.
 *
 * The room writes WHOLE panes (see the conversation, lib/zaltz-assist), which
 * is the right thing to send over the wire and the wrong thing to look at: a
 * two-character change inside forty lines lands invisibly, and an edit you
 * cannot see is an edit you did not make. So the client diffs the pane it had
 * against the pane it got, and shows the difference — in the answer, and on the
 * lines themselves.
 *
 * Plain LCS over lines. Panes here are tens of lines, so the O(n·m) table is
 * microseconds; anything pathological falls back to "all of it changed" rather
 * than freezing the room mid-set.
 */

export type DiffKind = "ctx" | "add" | "del" | "gap";

export interface DiffRow {
  kind: DiffKind;
  text: string;
  /** How many lines the gap swallowed (kind "gap" only). */
  skipped?: number;
}

export interface LineDiff {
  /** Changed lines with a little context, gaps collapsed. */
  rows: DiffRow[];
  added: number;
  removed: number;
  /** 1-based line numbers IN THE NEW TEXT that are new — what the pane marks. */
  addedLines: number[];
}

const MAX_LINES = 600; // past this the table is not worth building mid-set

export function diffLines(before: string, after: string, context = 1): LineDiff {
  const a = before.split("\n");
  const b = after.split("\n");
  if (before === after) return { rows: [], added: 0, removed: 0, addedLines: [] };
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return {
      rows: [
        ...a.map((text) => ({ kind: "del" as const, text })),
        ...b.map((text) => ({ kind: "add" as const, text })),
      ],
      added: b.length,
      removed: a.length,
      addedLines: b.map((_, i) => i + 1),
    };
  }

  // LCS lengths — lcs[i][j] = longest common run of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const full: DiffRow[] = [];
  const addedLines: number[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      full.push({ kind: "ctx", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      full.push({ kind: "del", text: a[i] });
      removed++;
      i++;
    } else {
      full.push({ kind: "add", text: b[j] });
      addedLines.push(j + 1);
      added++;
      j++;
    }
  }
  for (; i < a.length; i++) {
    full.push({ kind: "del", text: a[i] });
    removed++;
  }
  for (; j < b.length; j++) {
    full.push({ kind: "add", text: b[j] });
    addedLines.push(j + 1);
    added++;
  }

  // Keep what changed, plus a breath either side; everything else becomes one
  // "···" row, so a one-line fix reads as a one-line fix.
  const keep = new Array<boolean>(full.length).fill(false);
  full.forEach((r, k) => {
    if (r.kind === "ctx") return;
    for (let n = Math.max(0, k - context); n <= Math.min(full.length - 1, k + context); n++)
      keep[n] = true;
  });
  const rows: DiffRow[] = [];
  let skipped = 0;
  for (let k = 0; k < full.length; k++) {
    if (keep[k]) {
      if (skipped) {
        rows.push({ kind: "gap", text: "", skipped });
        skipped = 0;
      }
      rows.push(full[k]);
    } else skipped++;
  }
  if (skipped) rows.push({ kind: "gap", text: "", skipped });

  return { rows, added, removed, addedLines };
}
