"use client";

import { useEffect, useRef, useState } from "react";
import type { PartRow } from "@/lib/songs";
import { sentenceLabel } from "@/lib/labels";

// THE ARRANGE SURFACE — the song laid bare as objects on a thread: every loop a
// card you can PICK UP, every break a bead you can slide to another seam. All of
// it is instant and deterministic — drag, drop, delete, done. No AI touches an
// arrangement move: a loop carries its trailing break with it, a deleted loop
// leaves a clean on-beat butt-join, a bead dropped on a dressed seam swaps with
// what's there. The only thing that ever composes is a brand-new loop (the + in
// a gap), because new music has to come from somewhere.

type BreakSet = {
  options: { label: string; strudel: string }[];
  chosen: number | null;
};

// The vertical rhythm. The seams are GENEROUS on purpose: a bead is ~30px tall,
// so a 64px gap gives it clear air above and below — objects on the thread must
// FLOAT between the cards, never touch them.
const ROW_H = 60; // one loop row
const GAP_H = 64; // the seam between two rows — beads and + live here
const EDGE_H = 64; // the insert zones above the first and below the last loop
const COMPOSER_H = 96; // a gap grown into the inline composer
const DRAG_START = 6; // px of travel before a press becomes a drag

function fmtLen(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Three breathing bars — the sign that THIS row is where the music is. */
function EqBars() {
  return (
    <span className="flex h-3 items-end gap-[2.5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[2.5px] rounded-full bg-accent-strong"
          style={{ height: "100%", animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

export default function ArrangeSurface({
  parts,
  breaks,
  holds,
  playing,
  paused,
  busy,
  barSeconds,
  barsOf,
  onReorder,
  onDelete,
  onMoveBreak,
  onClearBreak,
  onInsert,
  onPlay,
}: {
  parts: PartRow[];
  breaks?: Record<string, BreakSet>;
  /** Repeat latches — part id and `break:<id>` keys, Infinity = forever. */
  holds: Record<string, number>;
  playing: string | null;
  paused: boolean;
  busy: boolean;
  barSeconds: number;
  barsOf: (p: PartRow) => number;
  onReorder: (partId: string, toIndex: number) => void;
  onDelete: (partId: string) => void;
  onMoveBreak: (fromPartId: string, toPartId: string) => void;
  onClearBreak: (fromPartId: string) => void;
  /** Insert a NEW loop at `position` (0..n). Resolves false if it was refused. */
  onInsert: (position: number, prompt: string) => Promise<boolean>;
  onPlay: (partId: string) => void;
}) {
  const n = parts.length;

  // ── drag state ─────────────────────────────────────────────────────────────
  // One drag at a time: a ROW (loop) or a BEAD (break). `dy` follows the pointer
  // raw; `target` is the slot the pointer is over right now.
  const [rowDrag, setRowDrag] = useState<{ id: string; from: number; target: number; dy: number } | null>(null);
  const [beadDrag, setBeadDrag] = useState<{ fromGap: number; target: number; dy: number } | null>(null);
  // Ref mirrors so a drag's END handler (registered at pointerdown) reads the
  // LATEST drag state — and commits it OUTSIDE any setState updater (updaters
  // must stay pure; calling the parent's setState inside one is a render-phase
  // update, the "sync-in-handler, never in the updater" rule).
  const rowDragRef = useRef(rowDrag);
  rowDragRef.current = rowDrag;
  const beadDragRef = useRef(beadDrag);
  beadDragRef.current = beadDrag;
  // Which insert position (0..n) has its composer open, and which is composing.
  const [composer, setComposer] = useState<number | null>(null);
  const [insertBusy, setInsertBusy] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  // Two-step delete: ✕ arms (rose "sure?"), a second tap within 3s commits.
  const [armed, setArmed] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);
  const arm = (id: string) => {
    setArmed(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(null), 3000);
  };

  // ── layout ─────────────────────────────────────────────────────────────────
  // Absolute slots + transform transitions: everything GLIDES to its place, and
  // drag math stays plain arithmetic. Gap heights vary only while a composer is
  // open (drags close it first, so drag math is always uniform).
  const step = ROW_H + GAP_H;
  const topH = composer === 0 || insertBusy === 0 ? COMPOSER_H : EDGE_H;
  const gapH = (i: number) =>
    composer === i + 1 || insertBusy === i + 1 ? COMPOSER_H : GAP_H; // interior gap i = insert position i+1
  const rowY: number[] = [];
  {
    let y = topH;
    for (let i = 0; i < n; i++) {
      rowY.push(y);
      y += ROW_H + (i < n - 1 ? gapH(i) : 0);
    }
  }
  const gapY = (i: number) => rowY[i] + ROW_H;
  const bottomY = n ? rowY[n - 1] + ROW_H : topH;
  const totalH = bottomY + (composer === n || insertBusy === n ? COMPOSER_H : EDGE_H);

  // The order as the CURRENT drag would leave it — beads glide along with their
  // loop mid-drag, so "the break rides with its loop" is something you SEE.
  const displayed = (() => {
    if (!rowDrag) return parts;
    const arr = parts.filter((_, i) => i !== rowDrag.from);
    arr.splice(rowDrag.target, 0, parts[rowDrag.from]);
    return arr;
  })();
  const displayIndex = new Map(displayed.map((p, i) => [p.id, i]));

  // ── one tiny pointer-drag engine for rows and beads ────────────────────────
  const press = useRef<{ y: number; live: boolean } | null>(null);
  function beginPointer(
    e: React.PointerEvent,
    begin: () => void,
    move: (dy: number) => void,
    end: (moved: boolean) => void,
  ) {
    // Buttons inside keep their own taps; touch drags need a deliberate handle
    // (data-grip / the bead itself) so a swipe on a row still scrolls the page.
    const t = e.target as HTMLElement;
    if (t.closest("button")) return;
    if (e.pointerType === "touch" && !t.closest("[data-grip]")) return;
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is an optimization — the drag still works without it */
    }
    press.current = { y: e.clientY, live: false };
    const onMove = (ev: PointerEvent) => {
      if (!press.current) return;
      const dy = ev.clientY - press.current.y;
      if (!press.current.live && Math.abs(dy) > DRAG_START) {
        press.current.live = true;
        setComposer(null);
        begin();
      }
      if (press.current.live) move(dy);
    };
    const onUp = () => {
      const moved = !!press.current?.live;
      press.current = null;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      end(moved);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const startRowDrag = (e: React.PointerEvent, id: string, from: number) =>
    beginPointer(
      e,
      () => setRowDrag({ id, from, target: from, dy: 0 }),
      (dy) =>
        setRowDrag((d) =>
          d && { ...d, dy, target: Math.max(0, Math.min(n - 1, Math.round(d.from + dy / step))) },
        ),
      (moved) => {
        const d = rowDragRef.current;
        setRowDrag(null);
        if (moved && d && d.target !== d.from) onReorder(d.id, d.target);
      },
    );

  const startBeadDrag = (e: React.PointerEvent, fromGap: number) =>
    beginPointer(
      e,
      () => setBeadDrag({ fromGap, target: fromGap, dy: 0 }),
      (dy) =>
        setBeadDrag((d) =>
          d && { ...d, dy, target: Math.max(0, Math.min(n - 2, Math.round(d.fromGap + dy / step))) },
        ),
      (moved) => {
        const d = beadDragRef.current;
        setBeadDrag(null);
        if (moved && d && d.target !== d.fromGap)
          onMoveBreak(parts[d.fromGap].id, parts[d.target].id);
      },
    );

  async function submitInsert(position: number) {
    const p = prompt.trim();
    setComposer(null);
    setPrompt("");
    setInsertBusy(position);
    try {
      await onInsert(position, p);
    } finally {
      setInsertBusy(null);
    }
  }

  // ── pieces ─────────────────────────────────────────────────────────────────
  const holdBadge = (key: string, accent = false) =>
    holds[key] != null ? (
      <span
        className={`flex items-center gap-1 text-[10px] font-medium tabular-nums ${accent ? "text-accent/80" : "text-muted/60"}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </svg>
        {holds[key] === Infinity ? "∞" : `${holds[key]}×`}
      </span>
    ) : null;

  // The + that grows a new loop into a gap — a quiet node on the thread that
  // blooms on hover, or the inline composer once tapped.
  const insertNode = (position: number, className = "") => {
    if (insertBusy === position)
      return (
        <span className={`relative flex items-center gap-1.5 rounded-full border border-accent/25 bg-[#120a16] px-3.5 py-2 text-[12px] font-medium leading-none ${className}`}>
          <span className="shimmer-text">≋ composing the new loop…</span>
        </span>
      );
    if (composer === position)
      return (
        <div className={`cmdbar cmdbar-in relative z-30 flex w-full max-w-[26rem] items-center gap-2 rounded-full border border-white/[0.09] bg-[#16111c]/95 py-1.5 pl-3 pr-1.5 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl focus-within:border-accent/35 ${className}`}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          <input
            autoFocus
            value={prompt}
            maxLength={200}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              // Enter only builds when there's a direction — an empty field
              // must NEVER generate by surprise.
              if (e.key === "Enter") {
                e.preventDefault();
                if (prompt.trim()) void submitInsert(position);
              } else if (e.key === "Escape") {
                setComposer(null);
                setPrompt("");
              }
            }}
            placeholder="what plays here?…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-foreground placeholder:text-muted/40"
          />
          {/* one button that morphs: quiet ✕ while empty (close, clear — it
              NEVER generates) → gradient ↑ once there's a direction */}
          <button
            type="button"
            onClick={() =>
              prompt.trim() ? void submitInsert(position) : (setComposer(null), setPrompt(""))
            }
            aria-label={prompt.trim() ? "Compose the new loop" : "Close"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-95 ${
              prompt.trim()
                ? "bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] text-white shadow-[0_8px_24px_-6px_rgba(224,49,156,.85)]"
                : "text-muted/50 hover:text-foreground"
            }`}
          >
            {prompt.trim() ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
          </button>
        </div>
      );
    return (
      <button
        onClick={() => {
          setPrompt("");
          setComposer(position);
        }}
        disabled={busy}
        title="A new loop, composed for this exact spot"
        aria-label="Add a loop here"
        className={`group/add relative grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] bg-[#0d0b15] text-muted/50 transition duration-200 hover:scale-110 hover:border-accent/50 hover:text-accent hover:shadow-[0_0_20px_-4px_rgba(224,49,156,.7)] active:scale-95 disabled:cursor-default disabled:opacity-30 ${className}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    );
  };

  return (
    <div className="relative select-none" style={{ height: totalH }}>
      {/* tap anywhere outside the open composer and it folds away. Lives at the
          ROOT because the gap zones are transformed (translateY), which would
          trap a fixed overlay inside their box. */}
      {composer !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setComposer(null);
            setPrompt("");
          }}
          aria-hidden
        />
      )}
      {/* the thread — one luminous strand the whole song hangs on */}
      <span
        aria-hidden
        className={`absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-accent/25 to-transparent transition-opacity duration-300 ${
          beadDrag ? "opacity-100" : "opacity-70"
        }`}
      />

      {/* top insert zone */}
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ top: 0, height: topH }}
      >
        {insertNode(0)}
      </div>

      {/* loop rows */}
      {parts.map((p, i) => {
        const di = displayIndex.get(p.id) ?? i;
        const isDragged = rowDrag?.id === p.id;
        const y = isDragged ? rowY[rowDrag!.from] + rowDrag!.dy : rowY[di];
        const isPlaying = playing === p.id;
        const generating = p.status === "generating" || p.status === "pending";
        const hasCode = !!p.strudel?.trim();
        const bars = hasCode ? barsOf(p) : 0;
        return (
          <div
            key={p.id}
            onPointerDown={(e) => startRowDrag(e, p.id, i)}
            className={`absolute inset-x-0 flex items-center gap-1 rounded-2xl border pl-1 pr-1.5 backdrop-blur-md ${
              isDragged
                ? "z-20 scale-[1.02] cursor-grabbing border-accent/50 bg-[#16111c] shadow-[0_24px_60px_-16px_rgba(0,0,0,.9),0_0_44px_-10px_rgba(224,49,156,.6)]"
                : "cursor-grab border-white/[0.07] bg-[#0d0b15]/95 transition-transform duration-300"
            } ${isPlaying && !isDragged ? "border-accent/40 playing-glow" : ""}`}
            style={{
              height: ROW_H,
              transform: `translateY(${y}px)`,
              transitionTimingFunction: "cubic-bezier(.22,.9,.28,1.15)",
            }}
          >
            {/* grip — the touch handle; on desktop the whole row grabs */}
            <span
              data-grip
              className="grid h-full w-8 shrink-0 cursor-grab place-items-center text-muted/35"
              style={{ touchAction: "none" }}
              aria-hidden
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                {[2, 8].map((x) =>
                  [2, 8, 14].map((cy) => <circle key={`${x}${cy}`} cx={x} cy={cy} r="1.3" />),
                )}
              </svg>
            </span>
            {hasCode && (
              <button
                onClick={() => onPlay(p.id)}
                title={isPlaying ? (paused ? "Resume" : "Pause") : "Play the mix from here"}
                aria-label={
                  isPlaying
                    ? paused
                      ? "Resume"
                      : "Pause"
                    : "Play from this loop"
                }
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${
                  isPlaying
                    ? "text-accent"
                    : "text-muted/70 hover:bg-white/[0.06] hover:text-foreground"
                }`}
              >
                {isPlaying && !paused ? (
                  <EqBars />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                )}
              </button>
            )}
            <div className="min-w-0 flex-1 py-1.5">
              <div className={`truncate text-[13.5px] font-medium leading-tight ${isPlaying ? "text-accent" : "text-foreground/90"}`}>
                {generating ? (
                  <span className="shimmer-text">{p.label?.trim() ? sentenceLabel(p.label) : "New loop"} — composing…</span>
                ) : (
                  sentenceLabel(p.label?.trim() || "Loop")
                )}
              </div>
              {hasCode && (
                <div className="flex items-center gap-2 text-[11px] leading-tight text-muted/55">
                  <span>
                    {bars} {bars === 1 ? "bar" : "bars"} · {fmtLen(bars * barSeconds)}
                  </span>
                  {holdBadge(p.id)}
                </div>
              )}
            </div>
            {n > 1 && (
              <button
                onClick={() => (armed === p.id ? (setArmed(null), onDelete(p.id)) : arm(p.id))}
                disabled={busy}
                title={armed === p.id ? "Tap again — it's gone" : "Delete this loop"}
                aria-label="Delete this loop"
                className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-full transition active:scale-95 ${
                  armed === p.id
                    ? "bg-rose-500/15 px-3 text-[11.5px] font-medium text-rose-300"
                    : "w-8 text-muted/40 hover:bg-white/[0.06] hover:text-rose-300 disabled:opacity-30"
                }`}
              >
                {armed === p.id ? (
                  "sure?"
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      })}

      {/* the seams — beads (worn breaks) + receiving nodes + the gap's own + */}
      {Array.from({ length: Math.max(0, n - 1) }, (_, g) => {
        // Mid row-drag, gap g sits between displayed[g] and displayed[g+1]; its
        // bead belongs to displayed[g] (a break leaves the loop above it).
        const fromPart = displayed[g];
        const set = fromPart ? breaks?.[fromPart.id] : undefined;
        const bead = set && set.chosen !== null && set.chosen !== undefined ? set.options[set.chosen] : null;
        const isBeadSource = beadDrag?.fromGap === g && !rowDrag;
        const beadY = isBeadSource ? beadDrag!.dy : 0;
        const isDropTarget = beadDrag && beadDrag.target === g && beadDrag.fromGap !== g;
        const beadSounding = fromPart && playing === `break:${fromPart.id}`;
        return (
          <div
            key={`gap-${g}`}
            className={`absolute inset-x-0 flex items-center justify-center transition-transform duration-300 ${
              // the zone's translateY makes it a stacking context, so while its
              // composer is open the whole zone must ride above the root overlay
              composer === g + 1 ? "z-20" : ""
            }`}
            style={{ transform: `translateY(${gapY(g)}px)`, height: gapH(g) }}
          >
            {/* receiving node while a bead is in flight */}
            {beadDrag && !bead && (
              <span
                aria-hidden
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-200 ${
                  isDropTarget
                    ? "h-4 w-4 border-accent bg-accent/25 shadow-[0_0_18px_-2px_rgba(224,49,156,.9)]"
                    : "h-2.5 w-2.5 border-accent/40 bg-transparent"
                }`}
              />
            )}
            {bead && composer !== g + 1 && insertBusy !== g + 1 ? (
              <>
                <span
                  onPointerDown={(e) => startBeadDrag(e, g)}
                  data-grip
                  className={`relative flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1 text-[11.5px] font-medium leading-none ${
                    isBeadSource
                      ? "z-30 scale-105 cursor-grabbing border-accent/60 bg-[#1a0d1c] text-accent shadow-[0_12px_40px_-8px_rgba(0,0,0,.8),0_0_26px_-4px_rgba(224,49,156,.8)]"
                      : `cursor-grab transition duration-200 ${
                          beadSounding && !paused
                            ? "border-accent/60 bg-[#1a0d1c] text-accent shadow-[0_0_18px_-4px_rgba(224,49,156,.8)]"
                            : "border-accent/25 bg-[#120a16] text-accent/90 hover:border-accent/45"
                        } ${isDropTarget ? "ring-2 ring-accent/60" : ""}`
                  }`}
                  style={{ touchAction: "none", transform: `translateY(${beadY}px)` }}
                  title="Drag this break to another seam"
                >
                  ≋{fromPart && holdBadge(`break:${fromPart.id}`, true)}
                  <button
                    onClick={() => fromPart && onClearBreak(fromPart.id)}
                    title="Remove — the loops meet directly"
                    aria-label="Remove this break"
                    className="grid h-6 w-6 place-items-center rounded-full text-accent/50 transition hover:bg-white/[0.08] hover:text-foreground active:scale-95"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
                {!rowDrag && !beadDrag && insertNode(g + 1, "ml-2")}
              </>
            ) : (
              !beadDrag && insertNode(g + 1)
            )}
          </div>
        );
      })}

      {/* bottom insert zone */}
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ top: bottomY, height: composer === n || insertBusy === n ? COMPOSER_H : EDGE_H }}
      >
        {insertNode(n)}
      </div>
    </div>
  );
}
