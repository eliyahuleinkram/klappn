"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";

/**
 * THE PANE — a hand-rolled code editor for the zaltz IDE: a transparent
 * <textarea> (real caret, real selection, native undo) over a highlighted
 * <pre> twin, kept byte-aligned by sharing font, padding and soft-wrap. No
 * editor dependency.
 *
 * THE COPILOT'S GHOST (2026-07-26): a completion renders as grey ghost text at
 * the caret — ⇥ takes it, Esc (or just typing on) dismisses it. The ghost
 * lives only in the <pre>, never in the textarea, so alignment law: a ghost is
 * only shown where it can't shift real text under the caret — the parent
 * truncates to one line unless the caret sits at the end of the file.
 *
 * The palette is the house monochrome + one pink: pattern STRINGS carry the
 * accent (they are the music), methods and numbers sit quiet, comments recede.
 */

// One pass, ordered by precedence: comment | string | label | method | number.
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(^[ \t]*_?\$:)|(\.[A-Za-z_$][\w$]*)|(\b\d+(?:\.\d+)?\b)/gm;

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

export interface CaretContext {
  before: string;
  after: string;
  /** Caret sits at the very end of the file (a multi-line ghost is safe). */
  atEnd: boolean;
  /** An explicit summon (✦ complete / ⌥\) — overrules the parent's
   *  "this spot already came back empty" dedupe. */
  forced?: boolean;
}

/** The parent's handle on a pane — one verb: summon a ghost right now. */
export interface CodePaneHandle {
  summon: () => void;
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
    /** Increment to fire the eval flash (live-coding convention: you SEE the send). */
    flash?: number;
    autoFocus?: boolean;
    /** A completion is in flight — the caret wears a breathing ✦. */
    pondering?: boolean;
    /** The copilot's suggestion, rendered at the caret. Parent owns its lifecycle. */
    ghost?: string | null;
    onGhostAccept?: () => void;
    onGhostDismiss?: () => void;
    /** Fired when the caret PARKS (typing pause or a click that settles) and by
     *  summon()/⌥\ — the copilot's cue. */
    onCaretIdle?: (ctx: CaretContext) => void;
  }
>(function CodePane(
  {
    value,
    onChange,
    onRun,
    onSave,
    placeholder,
    flash,
    autoFocus,
    pondering,
    ghost,
    onGhostAccept,
    onGhostDismiss,
    onCaretIdle,
  },
  handleRef,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostCaretRef = useRef<number>(-1);

  // With a ghost up, the twin renders before + ghost + after; the textarea
  // knows nothing about it (alignment guaranteed by the parent's truncation
  // rule — see the header note).
  const html = useMemo(() => {
    if (ghost || pondering) {
      const at =
        ghostCaretRef.current >= 0 ? ghostCaretRef.current : value.length;
      const marker = ghost
        ? `<span class="tok-ghost">${esc(ghost)}</span>`
        : `<span class="tok-pondering">✦</span>`;
      return (
        highlightCore(value.slice(0, at)) +
        marker +
        highlightCore(value.slice(at)) +
        "\n"
      );
    }
    return highlightCore(value) + "\n";
  }, [value, ghost, pondering]);

  // Eval flash — a quick pink wash over the pane when its code is sent.
  const flashRef = useRef<HTMLDivElement>(null);
  const lastFlash = useRef(flash ?? 0);
  useEffect(() => {
    if (flash === undefined || flash === lastFlash.current) return;
    lastFlash.current = flash;
    const el = flashRef.current;
    if (!el) return;
    el.classList.remove("pane-flash");
    void el.offsetWidth; // reflow so re-adding restarts the animation
    el.classList.add("pane-flash");
  }, [flash]);

  // Keep the caret's line inside the scroll viewport while typing.
  const followCaret = useCallback(() => {
    const ta = taRef.current;
    const sc = scrollRef.current;
    if (!ta || !sc) return;
    const line = value.slice(0, ta.selectionStart ?? 0).split("\n").length;
    const lineH = 21; // 13px mono × 1.6 leading — matches the CSS
    const y = line * lineH;
    if (y - sc.scrollTop > sc.clientHeight - lineH * 2)
      sc.scrollTop = y - sc.clientHeight + lineH * 2;
    else if (y - lineH * 2 < sc.scrollTop) sc.scrollTop = Math.max(0, y - lineH * 2);
  }, [value]);
  useEffect(followCaret, [followCaret]);

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
  // Any caret activity — typing, a click, an arrow — re-arms one timer; 600ms
  // of stillness with focus and the copilot looks over your shoulder. 450ms —
  // Copilot-eager; the parent's per-spot dedupe + LRU keep the spend sane. This is
  // what makes "just complete what's sitting there" work: click at the end,
  // wait a beat, the ghost arrives. The parent dedupes repeat cues per spot.
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleCue = useCallback(() => {
    if (cueTimer.current) clearTimeout(cueTimer.current);
    cueTimer.current = setTimeout(() => {
      if (document.activeElement === taRef.current) summonGhost();
    }, 450);
  }, [summonGhost]);
  useEffect(
    () => () => {
      if (cueTimer.current) clearTimeout(cueTimer.current);
    },
    [],
  );

  // The one-verb handle — the ✦ complete button (the ONLY path on phones,
  // where no ⌥\ exists) lands here. Unfocused pane → caret to the end first.
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
    }),
    [summonGhost],
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
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
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
    if (e.key === "Escape" && ghost) {
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
      <div ref={scrollRef} className="code-pane relative flex-1 overflow-y-auto overscroll-contain">
        <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 z-[2]" />
        <div className="relative min-h-full">
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
            onBlur={() => ghost && onGhostDismiss?.()}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            autoFocus={autoFocus}
            className="code-layer code-input absolute inset-0 h-full w-full"
          />
        </div>
      </div>
      {/* The ghost's handle — a real button, because phones have no ⇥.
          pointerDown (not click) so the textarea never blurs first, which
          would dismiss the very ghost being taken. */}
      {ghost && (
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            insertText(ghost);
            onGhostAccept?.();
          }}
          className="absolute bottom-2.5 right-2.5 z-[3] rounded-full border border-accent/40 bg-black/70 px-3 py-1.5 text-[12.5px] text-accent-strong shadow-[0_0_30px_-10px_rgba(224,49,156,.7)] backdrop-blur-xl transition active:scale-[.96]"
        >
          ⇥ take
        </button>
      )}
    </div>
  );
});

export default CodePane;
