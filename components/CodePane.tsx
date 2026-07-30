"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/**
 * THE PANE — a hand-rolled code editor for the zaltz IDE: a transparent
 * <textarea> (real caret, real selection, native undo) over a highlighted
 * <pre> twin, kept byte-aligned by sharing font, padding and soft-wrap. No
 * editor dependency.
 *
 * THE COPILOT'S GHOST (2026-07-26): a completion renders as grey ghost text at
 * the caret — ⇥ takes it, Esc (or just typing on) dismisses it. Ghosts may be
 * MULTI-LINE anywhere in the file: the ghost lives only in the <pre>, and
 * since the <pre> is ALL the visible text (the textarea's own text is
 * transparent), a mid-file ghost pushes the picture down exactly like VS Code
 * — while the caret and clicks keep answering to the real buffer, and any
 * keystroke or caret move dismisses the ghost and snaps the picture back.
 * On an EMPTY pane, ⇥ takes the placeholder hint instead (onTakeHint) — grey
 * text is grey text: ⇥ always means "make what's grey mine".
 *
 * The palette is the house monochrome + one pink: pattern STRINGS carry the
 * accent (they are the music), methods and numbers sit quiet, comments recede.
 */

// One pass, ordered by precedence: comment | string | label | method | number.
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(^[ \t]*_?\$:)|(\.[A-Za-z_$][\w$]*)|(\b\d+(?:\.\d+)?\b)/gm;

/** A SILENCED layer — line-anchored, always (the `$:` grammar's standing law:
 *  a `$:` inside a comment or a string is not a layer). */
const MUTED_LINE = /^[ \t]*_\$:/;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightCore(code: string): string {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    out += esc(code.slice(last, i));
    const [whole, comment, str, label, method, num] = m;
    if (comment !== undefined) out += `<span class="tok-c">${esc(whole)}</span>`;
    else if (str !== undefined) out += `<span class="tok-s">${esc(whole)}</span>`;
    else if (label !== undefined) out += `<span class="tok-l">${esc(whole)}</span>`;
    else if (method !== undefined) out += `<span class="tok-m">${esc(whole)}</span>`;
    else if (num !== undefined) out += `<span class="tok-n">${esc(whole)}</span>`;
    else out += esc(whole);
    last = i + whole.length;
  }
  out += esc(code.slice(last));
  return out;
}

/**
 * A SILENT LAYER MUST LOOK SILENT. Highlight line-by-line so a muted layer can
 * be wrapped whole in `.tok-off` — the eye should find what is sleeping without
 * reading a single character, the way a muted channel on a desk is dark.
 *
 * Wrapping per LINE (not per token) is what makes the whole statement recede:
 * the accent on its pattern strings, the numbers, all of it goes quiet together.
 * The `_$:` label keeps its own token colour underneath so the idiom stays
 * legible to anyone reading the code as code.
 */
function highlightLines(code: string): string {
  // Split-and-rejoin on "\n" only: highlightCore is line-anchored for labels
  // (^ with /m), so feeding it one line at a time preserves every token class.
  return code
    .split("\n")
    .map((line) =>
      MUTED_LINE.test(line)
        ? `<span class="tok-off">${highlightCore(line)}</span>`
        : highlightCore(line),
    )
    .join("\n");
}

export interface CaretContext {
  before: string;
  after: string;
  /** Caret sits at the very end of the file (a multi-line ghost is safe). */
  atEnd: boolean;
  /** An explicit summon (✦ complete / ⌥\) — overrules the parent's
   *  "this spot already came back empty" dedupe. */
  forced?: boolean;
}

/** The parent's handle on a pane: summon a whisper, or take what's grey. */
export interface CodePaneHandle {
  summon: () => void;
  /** Accept the standing whisper (or, on an empty pane, the hint) — the same
   *  act as ⇥, callable from furniture outside the pane. */
  take: () => void;
  /** Silence (or wake) every layer the selection touches — the same act as ⌘/
   *  and as tapping a layer's own `$:`, callable from furniture outside. */
  toggleMute: () => void;
}

const CodePane = forwardRef<
  CodePaneHandle,
  {
    value: string;
    onChange: (v: string) => void;
    /** ⌘↵ / ctrl↵ — evaluate THIS pane. */
    onRun: () => void;
    /** ⌘S — bubble up so the browser save dialog never appears. */
    onSave?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    /** A completion is in flight — the NATIVE caret breathes pink
     *  (caret-color on the textarea; nothing is ever drawn in the twin, so
     *  there is exactly one cursor on screen). */
    pondering?: boolean;
    /** The copilot's suggestion, rendered at the caret. Parent owns its lifecycle. */
    ghost?: string | null;
    /** THE TRIM WHISPER (07-28) — the copilot offers SUBTRACTION the way it
     *  offers addition: an existing line wears a quiet strike, its gentler
     *  rewrite floats in ghost grey beneath ("" = let the line go). Same ⇥,
     *  same Esc, same lifecycle as a ghost. */
    trim?: { find: string; replace: string } | null;
    onGhostAccept?: () => void;
    onGhostDismiss?: () => void;
    /** ⇥ on an EMPTY pane takes the placeholder hint (parent seeds the code —
     *  free, deterministic — then lets the copilot carry on). */
    onTakeHint?: () => void;
    /** Fired when the caret PARKS (typing pause or a click that settles) and by
     *  summon()/⌥\ — the copilot's cue. */
    onCaretIdle?: (ctx: CaretContext) => void;
    /** ✦ explain — select a stretch of code and a quiet chip floats past it;
     *  one tap asks the machine to teach that fragment (strictly on-demand). */
    onExplain?: (sel: string) => void;
    /** Selection EDIT — the copilot rewrites exactly the selected span
     *  (07-28): the chip's second segment hands the span up. */
    onEditSel?: (sel: { text: string; start: number; end: number }) => void;
    /** A layer was just silenced or woken. The edit is COMPLETE by definition,
     *  so the room lands it without the composing debounce (see landNow). */
    onMuteToggle?: () => void;
  }
>(function CodePane(
  {
    value,
    onChange,
    onRun,
    onSave,
    placeholder,
    autoFocus,
    pondering,
    ghost,
    trim,
    onGhostAccept,
    onGhostDismiss,
    onTakeHint,
    onCaretIdle,
    onExplain,
    onEditSel,
    onMuteToggle,
  },
  handleRef,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * THE LABEL IS THE SWITCH. Every `$:` in the picture gets an invisible hit
   * rect, so tapping a layer's own label silences it (and tapping the dimmed
   * `_$:` wakes it). No chord to know, no furniture to find, and the thing you
   * touch is the thing that means "this one sounds" — one glyph, one meaning.
   *
   * Measured off the twin's `.tok-l` spans exactly like the whisper's hit rects
   * (the proven pattern), re-measured whenever the picture or the box changes.
   * A whisper is up ⇒ no switches: the twin holds extra text then and the rects
   * would point at the wrong lines.
   */
  const [labelHits, setLabelHits] = useState<
    { top: number; left: number; width: number; height: number; at: number }[]
  >([]);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || ghost || trim || !value) {
      setLabelHits([]);
      return;
    }
    const measure = () => {
      const box = content.getBoundingClientRect();
      // Walk the labels in document order and pair each with its buffer offset
      // — the Nth `.tok-l` in the twin is the Nth line-anchored label in the
      // text, because highlightLines emits them in order and nothing else
      // wears that class.
      const offsets: number[] = [];
      const RE = /^[ \t]*_?\$:/gm;
      for (const m of value.matchAll(RE)) offsets.push(m.index ?? 0);
      const els = [...content.querySelectorAll("pre .tok-l")];
      const out: typeof labelHits = [];
      els.forEach((el, i) => {
        if (offsets[i] == null) return;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return;
        out.push({
          // A comfortable target on a finger without covering the code: the
          // label's own box, padded a few px, never wider than the label.
          top: r.top - box.top - 3,
          left: r.left - box.left - 4,
          width: r.width + 8,
          height: r.height + 6,
          at: offsets[i],
        });
      });
      setLabelHits(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, [value, ghost, trim]);
  const ghostCaretRef = useRef<number>(-1);
  // SCROLL FADES — each edge melts only when code continues past it (the
  // CSS masks live in globals; this is just the truth of the scroll).
  const [fades, setFades] = useState({ top: false, bottom: false });
  const updateFades = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const top = sc.scrollTop > 4;
    const bottom = sc.scrollTop + sc.clientHeight < sc.scrollHeight - 4;
    setFades((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }));
  }, []);
  // Coarse pointer = a thumb, no ⇥ — the grey hint gets a tap target.
  const coarse = useMemo(
    () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches,
    [],
  );

  // THE TAKE PILL SITS AT THE GHOST (user 07-27, twice): measured off the
  // ghost's LAST rendered line and placed in the empty air just PAST its end
  // — never below it, where it sat on top of the real code underneath. Only
  // when the line runs out of room does it drop under, hugging the left.
  const [pillPos, setPillPos] = useState<{ top: number; left: number } | null>(null);
  // THE GHOST ITSELF IS THE BUTTON (user 07-27, mobile: "if you tap the
  // hinted code it should work too") — every rendered line of grey text gets
  // an invisible hit area that takes it, so a thumb lands on the words, not
  // on a 28px pill. Clicking ghost text has no caret meaning anyway: those
  // lines aren't in the buffer yet.
  const [ghostRects, setGhostRects] = useState<
    { top: number; left: number; width: number; height: number }[]
  >([]);
  useLayoutEffect(() => {
    if (!ghost && !trim) {
      setPillPos(null);
      setGhostRects([]);
      return;
    }
    const content = contentRef.current;
    // A trim with a rewrite pins the pill at the GREY line (the offer); a
    // pure removal pins it at the STRUCK line — the grey is the button either
    // way, one law.
    const el =
      content?.querySelector(".tok-ghost") ?? content?.querySelector(".tok-trim");
    if (!content || !el) {
      setPillPos(null);
      setGhostRects([]);
      return;
    }
    const rects = el.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) {
      setPillPos(null);
      setGhostRects([]);
      return;
    }
    const box = content.getBoundingClientRect();
    setGhostRects(
      [...rects]
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({
          top: r.top - box.top,
          left: r.left - box.left,
          width: r.width,
          height: r.height,
        })),
    );
    const PILL_W = 88;
    const PILL_H = 28;
    const fitsBeside = last.right - box.left + 10 + PILL_W <= content.clientWidth - 4;
    setPillPos(
      fitsBeside
        ? {
            top: last.top - box.top + (last.height - PILL_H) / 2,
            left: last.right - box.left + 10,
          }
        : {
            top: last.bottom - box.top + 4,
            left: Math.max(8, Math.min(last.left - box.left, content.clientWidth - PILL_W - 8)),
          },
    );
  }, [ghost, trim, value]);

  // ✦ EXPLAIN AT THE SELECTION — the take pill's own geometry trick, turned
  // on the coder's selection: buffer offsets are walked onto the highlight
  // twin's text nodes (byte-aligned by law), a Range measures where the
  // selection ENDS, and a quiet chip floats just past it. With a ghost up the
  // twin holds text the buffer doesn't — the chip stands down.
  const [selChip, setSelChip] = useState<{
    top: number;
    left: number;
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const measureSelection = useCallback(() => {
    const ta = taRef.current;
    const content = contentRef.current;
    if (!ta || !content || (!onExplain && !onEditSel) || ghost || trim) return setSelChip(null);
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end - start < 4) return setSelChip(null);
    const pre = content.querySelector("pre");
    if (!pre) return setSelChip(null);
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let sNode: Text | null = null;
    let sOff = 0;
    let eNode: Text | null = null;
    let eOff = 0;
    while (walker.nextNode()) {
      const n = walker.currentNode as Text;
      const len = n.data.length;
      if (!sNode && acc + len >= start) {
        sNode = n;
        sOff = start - acc;
      }
      if (acc + len >= end) {
        eNode = n;
        eOff = end - acc;
        break;
      }
      acc += len;
    }
    if (!sNode || !eNode) return setSelChip(null);
    const range = document.createRange();
    range.setStart(sNode, sOff);
    range.setEnd(eNode, eOff);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) return setSelChip(null);
    const box = content.getBoundingClientRect();
    const CHIP_W = onEditSel ? 168 : 96;
    const CHIP_H = 28;
    const fitsBeside =
      last.right - box.left + 10 + CHIP_W <= content.clientWidth - 4;
    setSelChip({
      text: ta.value.slice(start, end),
      start,
      end,
      ...(fitsBeside
        ? {
            top: last.top - box.top + (last.height - CHIP_H) / 2,
            left: last.right - box.left + 10,
          }
        : {
            top: last.bottom - box.top + 4,
            left: Math.max(
              8,
              Math.min(last.left - box.left, content.clientWidth - CHIP_W - 8),
            ),
          }),
    });
  }, [ghost, trim, onExplain, onEditSel]);

  // With a ghost up, the twin renders before + ghost + after; the textarea
  // knows nothing about it (alignment guaranteed by the parent's truncation
  // rule — see the header note). Pondering never touches the twin — it tints
  // the NATIVE caret instead (ONE cursor on screen, ever; a second bar in the
  // twin read as two cursors — user 2026-07-26).
  const html = useMemo(() => {
    if (trim && !ghost) {
      const idx = value.indexOf(trim.find);
      if (idx >= 0) {
        const end = idx + trim.find.length;
        return (
          highlightCore(value.slice(0, idx)) +
          `<span class="tok-trim">${esc(trim.find)}</span>` +
          (trim.replace ? `\n<span class="tok-ghost">${esc(trim.replace)}</span>` : "") +
          highlightCore(value.slice(end)) +
          "\n"
        );
      }
    }
    if (ghost) {
      const at =
        ghostCaretRef.current >= 0 ? ghostCaretRef.current : value.length;
      return (
        highlightCore(value.slice(0, at)) +
        `<span class="tok-ghost">${esc(ghost)}</span>` +
        highlightCore(value.slice(at)) +
        "\n"
      );
    }
    // The resting picture dims silenced layers. The whisper paths above stay on
    // highlightCore deliberately: they slice the buffer MID-LINE to seat the
    // grey, and the take-pill / explain-chip geometry walks those exact text
    // nodes — the dimming resumes the moment the whisper retires.
    return highlightLines(value) + "\n";
  }, [value, ghost, trim]);

  // Keep the caret's line inside the scroll viewport while typing. Reads the
  // DOM, never the prop — a stale closure value here computed the caret's
  // line against the PREVIOUS buffer.
  const followCaret = useCallback(() => {
    const ta = taRef.current;
    const sc = scrollRef.current;
    if (!ta || !sc) return;
    const line = ta.value.slice(0, ta.selectionStart ?? 0).split("\n").length;
    const lineH = 21; // 13px mono × 1.6 leading — matches the CSS
    const y = line * lineH;
    if (y - sc.scrollTop > sc.clientHeight - lineH * 2)
      sc.scrollTop = y - sc.clientHeight + lineH * 2;
    else if (y - lineH * 2 < sc.scrollTop) sc.scrollTop = Math.max(0, y - lineH * 2);
  }, []);
  useEffect(followCaret, [followCaret, value]);
  useEffect(updateFades, [updateFades, value, ghost]);

  // ── UNDO / REDO — the pane's own history (user 07-28: ⌘Z must work like a
  // code editor's). The textarea is controlled, and every programmatic
  // rewrite (a ✦ fix, a seeded starter, a restored draft) resets the
  // browser's native stack — so the pane keeps its own: every state lands
  // here, quick keystrokes coalesce into one step, bulk moves (paste, take,
  // fix) each stand alone, and ⌘Z/⇧⌘Z walk it in both directions — through
  // the machine's moves too.
  const hist = useRef<{ v: string; caret: number }[]>([]);
  const histIdx = useRef(0);
  const histAt = useRef(0);
  const histKind = useRef<"type" | "bulk">("bulk");
  const restoring = useRef(false);
  if (hist.current.length === 0) hist.current = [{ v: value, caret: value.length }];
  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    const cur = hist.current[histIdx.current];
    if (!cur || cur.v === value) return;
    const caret = taRef.current?.selectionStart ?? value.length;
    const now = Date.now();
    const typing = Math.abs(value.length - cur.v.length) <= 2;
    hist.current.length = histIdx.current + 1; // a new edit burns the redo branch
    if (
      typing &&
      histKind.current === "type" &&
      now - histAt.current < 700 &&
      histIdx.current > 0
    ) {
      hist.current[histIdx.current] = { v: value, caret };
    } else {
      hist.current.push({ v: value, caret });
      histIdx.current++;
      if (hist.current.length > 200) {
        hist.current.shift();
        histIdx.current--;
      }
    }
    histKind.current = typing ? "type" : "bulk";
    histAt.current = now;
  }, [value]);
  const timeTravel = useCallback(
    (dir: -1 | 1) => {
      const entry = hist.current[histIdx.current + dir];
      if (!entry) return;
      histIdx.current += dir;
      histKind.current = "bulk"; // the next keystroke starts a fresh step
      restoring.current = true;
      onGhostDismiss?.();
      onChange(entry.v);
      requestAnimationFrame(() => {
        const t = taRef.current;
        if (!t) return;
        const c = Math.min(entry.caret, entry.v.length);
        t.setSelectionRange(c, c);
        followCaret();
      });
    },
    [onChange, onGhostDismiss, followCaret],
  );
  // PHONES HAVE NO ⌘Z — iOS says undo with a shake or a three-finger swipe
  // (and desktop context menus say it with "Undo"); all of them arrive as
  // beforeinput historyUndo/historyRedo. Route those into the pane's own
  // history too, so the OS's word for undo and ours are the same act.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const on = (e: Event) => {
      const t = (e as InputEvent).inputType;
      if (t === "historyUndo") {
        e.preventDefault();
        timeTravel(-1);
      } else if (t === "historyRedo") {
        e.preventDefault();
        timeTravel(1);
      }
    };
    ta.addEventListener("beforeinput", on);
    return () => ta.removeEventListener("beforeinput", on);
  }, [timeTravel]);

  // ── the copilot's cue: typing pauses (anywhere), or a summon ─────────────
  // READ THE DOM, NEVER THE PROP: the cue timer is armed inside onChange,
  // whose closure still holds the PREVIOUS render's `value` — one character
  // stale. That off-by-one made every typing-cued caret look mid-line, the
  // single-line truncation then emptied every "\n"-leading completion, and
  // the comment-to-code case (the copilot's signature move) silently never
  // fired. ta.value is always the truth.
  const summonGhost = useCallback(
    (forced = false) => {
      const ta = taRef.current;
      if (!ta || !onCaretIdle) return;
      const v = ta.value;
      const caret = ta.selectionStart ?? 0;
      if (caret !== (ta.selectionEnd ?? 0)) return; // a selection, not a caret
      ghostCaretRef.current = caret;
      onCaretIdle({
        before: v.slice(0, caret),
        after: v.slice(caret),
        atEnd: caret === v.length,
        forced,
      });
    },
    [onCaretIdle],
  );
  // Any caret activity — typing, a click, an arrow — re-arms one timer; a
  // beat of stillness with focus and the copilot looks over your shoulder.
  // THE BEAT IS ADAPTIVE (user 07-27: "not taking any longer than necessary
  // — know when someone probably wants the help"): what the hand just
  // finished tells us how badly the whisper is wanted. A comment is an ASK —
  // near-instant. An expression that just closed at line end is an
  // invitation — quick. A caret mid-word or mid-chain is still typing —
  // patient, so the machine never interrupts a thought (and never spends a
  // call it would only abort). The parent's per-spot dedupe + LRU keep the
  // spend sane either way.
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleCue = useCallback(() => {
    if (cueTimer.current) clearTimeout(cueTimer.current);
    let delay = 450;
    const ta = taRef.current;
    if (ta) {
      const caret = ta.selectionStart ?? 0;
      const v = ta.value;
      const lineStart = v.lastIndexOf("\n", caret - 1) + 1;
      const line = v.slice(lineStart, caret);
      const atLineEnd = caret >= v.length || v[caret] === "\n";
      if (atLineEnd && /^\s*\/\/\s*\S/.test(line)) delay = 220; // a comment is an ask
      else if (atLineEnd && /[)\]}"']$/.test(line.trimEnd())) delay = 300; // just closed — invite
      else if (/[A-Za-z_$.([{,]$/.test(line)) delay = 700; // mid-word/chain — patient
    }
    cueTimer.current = setTimeout(() => {
      if (document.activeElement === taRef.current) summonGhost();
    }, delay);
  }, [summonGhost]);
  useEffect(
    () => () => {
      if (cueTimer.current) clearTimeout(cueTimer.current);
    },
    [],
  );

  // Take the TRIM: splice the quieter line over the doomed one (or lift the
  // line out entirely), park the caret at the seam, hand the accept up (the
  // parent re-evals the live room + files the moment). One history step.
  const applyTrim = useCallback(() => {
    if (!trim) return;
    const idx = value.indexOf(trim.find);
    if (idx < 0) {
      onGhostDismiss?.();
      return;
    }
    const end = idx + trim.find.length;
    const next = trim.replace
      ? value.slice(0, idx) + trim.replace + value.slice(end)
      : value.slice(0, idx) + value.slice(end + (value[end] === "\n" ? 1 : 0));
    onChange(next);
    const pos = Math.min(idx + trim.replace.length, next.length);
    requestAnimationFrame(() => {
      const t = taRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(pos, pos);
      followCaret();
    });
    onGhostAccept?.();
  }, [trim, value, onChange, onGhostAccept, onGhostDismiss, followCaret]);


  // The one-verb handle — the ✦ complete button (the ONLY path on phones,
  // where no ⌥\ exists) lands here. Unfocused pane → caret to the end first.
  /**
   * THE MUTE — flip every layer the selection touches on or off.
   *
   * The idiom was always `_$:` (the transpiler skips it, the deck's re-busing
   * segments it like any other line). What was missing was a way to reach it
   * that isn't typing an underscore in exactly the right column, which is not a
   * thing anyone does mid-set.
   *
   * ALL-OR-NOTHING, like every editor's comment toggle: if ANY touched layer is
   * still sounding, the gesture silences them all; only when they are already
   * silent does it bring them back. So a multi-line selection is one decision —
   * which is what makes "write the next part below, then swap" a two-keystroke
   * move instead of a dozen.
   *
   * One history step (the value lands through onChange, and CodePane's own
   * undo coalescing treats a bulk change as its own entry), so ⌘Z takes the
   * whole part back at once.
   */
  const toggleMute = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const text = ta.value;
    const selStart = ta.selectionStart ?? 0;
    const selEnd = ta.selectionEnd ?? selStart;
    // Grow the selection to whole lines — you mute layers, not characters.
    const from = text.lastIndexOf("\n", selStart - 1) + 1;
    const nlAfter = text.indexOf("\n", selEnd);
    const to = nlAfter === -1 ? text.length : nlAfter;
    const lines = text.slice(from, to).split("\n");
    // LINE-ANCHORED, always (the setcpm-swallowing bug's law): only a real
    // layer label counts, never a `$:` sitting inside a string or a comment.
    const LAYER = /^([ \t]*)(_?)(\$:)/;
    const touched = lines.filter((l) => LAYER.test(l));
    if (!touched.length) return; // nothing here sounds — nothing to silence
    const anyLive = touched.some((l) => LAYER.exec(l)![2] === "");
    const next = lines
      .map((l) => {
        const m = LAYER.exec(l);
        if (!m) return l;
        const rest = l.slice(m[0].length);
        return `${m[1]}${anyLive ? "_" : ""}$:${rest}`;
      })
      .join("\n");
    if (next === text.slice(from, to)) return;
    const value2 = text.slice(0, from) + next + text.slice(to);
    // Keep the selection over the same layers so a second ⌘/ undoes the first
    // (the underscore shifts every line by one char — count them).
    const growth = anyLive ? touched.length : -touched.length;
    onChange(value2);
    onMuteToggle?.();
    requestAnimationFrame(() => {
      const t = taRef.current;
      if (!t) return;
      const s = selStart === selEnd ? selStart + (anyLive ? 1 : -1) : from;
      const e2 = selStart === selEnd ? s : to + growth;
      t.setSelectionRange(Math.max(from, s), Math.max(from, e2));
      followCaret();
    });
  }, [onChange, followCaret, onMuteToggle]);


  useImperativeHandle(
    handleRef,
    () => ({
      summon: () => {
        const ta = taRef.current;
        if (!ta) return;
        if (document.activeElement !== ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
        summonGhost(true);
      },
      take: () => {
        // The same act as ⇥ — grey text is grey text, wherever the tap lands.
        if (ghost) {
          insertText(ghost);
          onGhostAccept?.();
        } else if (trim) {
          applyTrim();
        } else if (!value.trim() && placeholder && onTakeHint) {
          onTakeHint();
        }
      },
      toggleMute,
    }),
    [summonGhost, ghost, trim, applyTrim, value, placeholder, onTakeHint, onGhostAccept, toggleMute],
  );

  // Any caret drift away from where the ghost was minted kills it.
  const checkGhostStale = useCallback(() => {
    if (!ghost) return;
    const caret = taRef.current?.selectionStart ?? -1;
    if (caret !== ghostCaretRef.current) onGhostDismiss?.();
  }, [ghost, onGhostDismiss]);

  function insertText(text: string) {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    // execCommand keeps the native undo stack alive; the manual fallback loses
    // undo for that one edit but never the text.
    if (!document.execCommand?.("insertText", false, text)) {
      const s = ta.selectionStart ?? 0;
      const e = ta.selectionEnd ?? 0;
      onChange(value.slice(0, s) + text + value.slice(e));
      // THE CARET MUST FOLLOW THE INSERT (user 07-27, mobile: "it scrolls all
      // the way up") — this fallback path replaces the value through React
      // and the browser parks the caret at 0; followCaret then dutifully
      // scrolled to the TOP of the file. Pin the caret to the end of the
      // inserted text after the commit, and the view stays at the work.
      const pos = s + text.length;
      requestAnimationFrame(() => {
        const t = taRef.current;
        if (!t) return;
        t.setSelectionRange(pos, pos);
        followCaret();
      });
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    // ⌘/ — silence (or wake) the layers under the selection. The universal
    // "switch this line off" chord, doing the one thing it means here.
    if (mod && e.key === "/") {
      e.preventDefault();
      toggleMute();
      return;
    }
    // ⌘Z / ⇧⌘Z (and ⌘Y) — the pane's own history; native undo is dead the
    // moment the buffer is rewritten programmatically, so ours answers.
    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      timeTravel(e.shiftKey ? 1 : -1);
      return;
    }
    if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      timeTravel(1);
      return;
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      onRun();
      return;
    }
    // ⌥\ or ⌃Space — summon a ghost on demand (the copilot's doorbell).
    // Both listed because macOS itself often eats ⌃Space (input sources).
    if (
      (e.altKey && e.code === "Backslash") ||
      (e.ctrlKey && !e.metaKey && (e.key === " " || e.code === "Space"))
    ) {
      e.preventDefault();
      summonGhost(true);
      return;
    }
    if (mod && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      onSave?.();
      return;
    }
    if (e.key === "Escape" && (ghost || trim)) {
      e.preventDefault();
      e.stopPropagation(); // the ghost eats this Esc; sheets keep theirs
      onGhostDismiss?.();
      return;
    }
    if (e.key === "Tab" && !mod) {
      e.preventDefault();
      if (ghost) {
        insertText(ghost);
        onGhostAccept?.();
      } else if (trim) {
        applyTrim();
      } else if (!value.trim() && placeholder && onTakeHint) {
        // Grey text is grey text: on an empty pane, ⇥ takes the hint the same
        // way it takes a ghost — the placeholder's code becomes the buffer.
        onTakeHint();
      } else {
        insertText("  ");
      }
      return;
    }
    // Enter keeps the current line's indentation — the one nicety a pattern
    // stack actually needs.
    if (e.key === "Enter" && !mod) {
      const ta = e.currentTarget;
      const s = ta.selectionStart ?? 0;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const indent = /^[ \t]*/.exec(value.slice(lineStart, s))?.[0] ?? "";
      if (indent) {
        e.preventDefault();
        insertText("\n" + indent);
      }
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={updateFades}
        className={`code-pane relative flex-1 overflow-y-auto overscroll-contain${
          fades.top ? " fade-top" : ""
        }${fades.bottom ? " fade-bottom" : ""}`}
      >
        <div ref={contentRef} className="relative min-h-full">
          <pre
            aria-hidden
            className="code-layer pointer-events-none relative"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {!value && placeholder && (
            <pre className="code-layer pointer-events-none absolute inset-0 text-muted/35">
              {placeholder}
            </pre>
          )}
          {/* GREY IS TAPPABLE ON TOUCH (user 07-27: "on mobile the person does
              not have a tab button") — the hint block itself takes the hint,
              exactly like ⇥ does on keys. Only the hint's own lines: the rest
              of the empty pane still focuses the keyboard for typing. */}
          {!value && placeholder && onTakeHint && coarse && (
            <button
              aria-label="Take the starter"
              onPointerDown={(e) => {
                e.preventDefault();
                onTakeHint();
              }}
              style={{ height: placeholder.split("\n").length * 21 + 14 }}
              className="absolute inset-x-0 top-0 z-[3] cursor-pointer bg-transparent"
            />
          )}
          {/* THE LAYER'S OWN LABEL, as its switch. Sits under the textarea in
              stacking terms but wins the pointer (z-[4]) because it is a tiny,
              deliberate target; everywhere else the caret still lands. */}
          {labelHits.map((h) => (
            <button
              key={h.at}
              aria-label="Silence or wake this layer"
              title="Silence this layer (⌘/)"
              onPointerDown={(e) => {
                e.preventDefault(); // keep focus + selection; never blur the pane
                const ta = taRef.current;
                if (!ta) return;
                ta.setSelectionRange(h.at, h.at);
                toggleMute();
              }}
              style={{ top: h.top, left: h.left, width: h.width, height: h.height }}
              className="absolute z-[4] cursor-pointer rounded bg-transparent transition hover:bg-accent/[0.14]"
            />
          ))}
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              scheduleCue();
            }}
            onKeyDown={onKeyDown}
            onKeyUp={() => {
              checkGhostStale();
              scheduleCue();
            }}
            onClick={() => {
              followCaret();
              checkGhostStale();
              scheduleCue();
            }}
            onSelect={measureSelection}
            onBlur={() => {
              if (ghost) onGhostDismiss?.();
              setSelChip(null);
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            autoFocus={autoFocus}
            className={`code-layer code-input absolute inset-0 h-full w-full${
              pondering ? " caret-thinking" : ""
            }`}
          />
          {/* The ghost's handle — a real button, because phones have no ⇥.
              It sits AT the ghost (measured off its last line) so it visibly
              belongs to the grey text it takes, and scrolls with the code.
              pointerDown (not click) so the textarea never blurs first, which
              would dismiss the very ghost being taken. */}
          {(ghost || trim) &&
            ghostRects.map((r, i) => (
              <button
                key={i}
                aria-label="Take the suggestion"
                onPointerDown={(e) => {
                  e.preventDefault(); // the textarea must not blur — that kills the ghost
                  if (ghost) {
                    insertText(ghost);
                    onGhostAccept?.();
                  } else {
                    applyTrim();
                  }
                }}
                style={{
                  top: r.top - 4,
                  left: r.left - 4,
                  width: r.width + 8,
                  height: r.height + 8,
                }}
                className="absolute z-[3] cursor-pointer bg-transparent"
              />
            ))}
          {/* The pill is a DROP of the brand — the one hot gradient poured
              into machined glass: a lit crown, a grounded underside, a rim,
              and an aura that breathes off the picture. It pops in with the
              whisper (pill-pop) so every arrival is felt. */}
          {(ghost || trim) && pillPos && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (ghost) {
                  insertText(ghost);
                  onGhostAccept?.();
                } else {
                  applyTrim();
                }
              }}
              style={{
                top: pillPos.top,
                left: pillPos.left,
                backgroundImage:
                  "linear-gradient(165deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)",
              }}
              className="pill-pop absolute z-[3] rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-white ring-1 ring-white/25 shadow-[0_2px_10px_-2px_rgba(179,18,111,.85),0_0_38px_-6px_rgba(224,49,156,.85),inset_0_1px_0_rgba(255,255,255,.4),inset_0_-1px_2px_rgba(0,0,0,.3)] transition hover:brightness-[1.08] hover:shadow-[0_3px_14px_-2px_rgba(179,18,111,.9),0_0_48px_-6px_rgba(224,49,156,.95),inset_0_1px_0_rgba(255,255,255,.45),inset_0_-1px_2px_rgba(0,0,0,.3)] active:scale-[.94]"
            >
              <span className="[@media(pointer:coarse)]:hidden">⇥ </span>
              {trim && !ghost ? (trim.replace ? "quiet it" : "let it go") : "take"}
            </button>
          )}
          {/* ✦ explain — quiet glass past the selection: the AI-spend orb and
              one word, nothing shouting. pointerDown so the selection (and
              the pane's focus) survives the tap. */}
          {selChip && !ghost && !trim && (
            /* ONE machined capsule, hairline seam (the seam law): the
               selection's two verbs — understand it, or change it. */
            <span
              style={{ top: selChip.top, left: selChip.left }}
              className="pill-pop absolute z-[3] flex items-stretch overflow-hidden whitespace-nowrap rounded-full border border-white/[0.16] bg-black/55 text-[12px] font-medium text-foreground/85 shadow-[0_2px_14px_-4px_rgba(0,0,0,.6)] backdrop-blur-xl"
            >
              {onExplain && (
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const t = selChip.text;
                    setSelChip(null);
                    onExplain(t);
                  }}
                  className="px-3 py-1.5 transition hover:bg-white/[0.06] hover:text-accent-strong active:scale-[.96]"
                >
                  ✦ explain
                </button>
              )}
              {onExplain && onEditSel && (
                <span className="w-px bg-white/[0.14]" aria-hidden />
              )}
              {onEditSel && (
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const c = selChip;
                    setSelChip(null);
                    onEditSel({ text: c.text, start: c.start, end: c.end });
                  }}
                  className="px-3 py-1.5 transition hover:bg-white/[0.06] hover:text-accent-strong active:scale-[.96]"
                >
                  ✎ edit
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default CodePane;
