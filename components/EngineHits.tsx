"use client";

/**
 * YOUR HITS, in the room — the door to everything you've already made.
 *
 * 2026-07-30 (the user: "it should just be that you can choose a song from your
 * hits and then you can just choose it, and then you can ALSO make a list with
 * it… I do not like the word lineup and the pill"). That inverted the old
 * model. It used to be a QUEUE first: to hear anything you had to add it to a
 * night, then play from the night — two steps to do the one thing anybody
 * actually wanted. Now:
 *
 *   · YOUR HITS is the list. Tap one and its code pours into the panes.
 *     One tap, no ceremony, no list to build first.
 *   · THE ORDER is optional and secondary. A quiet ＋ on any row puts it in
 *     one; the section only exists once you've made one, and everything about
 *     ordering (drag, ✕, ✦ arrange, next →) lives inside it.
 *
 * 2026-08-03 — THE NIGHT READS LIKE A SONG. The set was a list of titles with
 * nothing between them, which is exactly what it sounded like. Now it is a
 * THREAD: every pair of songs is separated by a SEAM, and the seam says how the
 * second one arrives ("Blend", "Tape stop") — a WORD, no glyph (the drawn
 * squiggle read as decoration, and the user is right that one more mark in a
 * row of marks is noise). Tap it and the same capsule opens into the move
 * itself — six templates, one line of prose, and the knobs — the song page's
 * ending card, in the room. A transition belongs to the song it BRINGS IN, so
 * it travels with that song when the night is reordered instead of being pruned
 * like the old pair-keyed hand-offs.
 *
 * AND THE SEAM SHOWS ITS OWN MOVE. While a transition is in the air the seam
 * lights and counts the bars down to the drop ("Blend · in 2 bars") — the
 * object that names the move is the object that performs it. (It used to be a
 * word shimmering on the row, which said WHAT was happening but never when or
 * why: "why does it keep saying blend".) The playing row says where the song
 * itself is — the loop's word, the bar inside it, and a hairline filling.
 *
 * Ordering is DIRECT: drag a row where you want it (the grip on touch, anywhere
 * on the row with a mouse) and an accent line shows where it will land. ⌥↑/⌥↓
 * do the same from the keyboard.
 *
 * The word "lineup" is retired from every surface. The storage key it was
 * saved under is NOT — `klappn-lineup-v1` holds people's real orders, and
 * renaming a key silently empties it.
 *
 * Pure view — the room (ZaltzIDE) owns the queue, the pours, the fades.
 */

import { useEffect, useRef, useState } from "react";
import { Scrim } from "@/components/Dismiss";
import {
  TRANSITION_KNOBS,
  TRANSITION_MOVES,
  type TransitionKnobField,
  type TransitionShape,
  transitionKnobText,
  transitionKnobsOf,
} from "@/lib/transitions-catalog";

export interface LineupHit {
  id: string;
  title: string;
  ready: boolean;
}

/** A seat in the night. `t` is how THIS song arrives (undefined = the house blend). */
export interface QueueEntry {
  id: string;
  title: string;
  t?: TransitionShape;
}

export default function EngineHits({
  open,
  onClose,
  queue,
  currentIdx,
  arriving,
  playhead,
  hits,
  onAdd,
  onRemove,
  onReorder,
  onPlay,
  onPlayHit,
  onPrefetch,
  onTransition,
  onNext,
  onArrange,
  arranging,
}: {
  open: boolean;
  onClose: () => void;
  /** The SET, when one exists. Empty is the normal, expected state. */
  queue: QueueEntry[];
  /** The row whose song is in the panes right now (null = free play). */
  currentIdx: number | null;
  /** A move already in the air: the row it brings in, its name, and WHEN the
   *  drop lands — the seam counts the bars down to it. */
  arriving: { to: number; word: string; dropAt: number; barMs: number } | null;
  /** How far into the playing song the room is (null = nothing rides). */
  playhead: { at: string; of: string; through: number } | null;
  /** The library — null while it loads; [] = no ready hits yet. */
  hits: LineupHit[] | null;
  onAdd: (id: string) => void;
  onRemove: (i: number) => void;
  /** Move the row at `from` so it sits at `to`. */
  onReorder: (from: number, to: number) => void;
  onPlay: (i: number) => void;
  /** Play a hit straight — the whole song, no set involved. The primary act. */
  onPlayHit: (id: string) => void;
  /** Warm a song before it's wanted — the swap has to be instant. */
  onPrefetch: (id: string) => void;
  /** How the song at `i` arrives. */
  onTransition: (i: number, patch: Partial<TransitionShape>) => void;
  onNext: () => void;
  onArrange: () => void;
  arranging: boolean;
}) {
  const [openSeam, setOpenSeam] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; y: number } | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  // A drag that ends is not a tap — the click that follows it must not play.
  const didDrag = useRef(false);
  // The panel closes → it forgets what was open, so it always comes back clean.
  // (Adjusted during render, not in an effect: nothing outside React needs to
  // know, and an effect here would paint the stale card for one frame.)
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setOpenSeam(null);
  }

  const startDrag = (from: number, e: React.PointerEvent) => {
    if (queue.length < 2) return;
    const centers = () =>
      Array.from(rowsRef.current?.querySelectorAll<HTMLElement>("[data-set-row]") ?? []).map(
        (el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        },
      );
    const ys = centers();
    const startY = e.clientY;
    didDrag.current = false;
    setOpenSeam(null);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* the pointer was already gone — the move still tracks on window */
    }
    let landing = from;
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!didDrag.current && Math.abs(dy) < 6) return;
      didDrag.current = true;
      // The FURTHEST row the finger has passed, not the nearest: going up that
      // is the topmost centre it is above, going down the lowest it is below.
      // (Taking the last match in one ascending pass lands one row short every
      // time you drag upward — seen live.)
      let to = from;
      for (let i = 0; i < from; i++)
        if (ev.clientY < ys[i]) {
          to = i;
          break;
        }
      if (to === from)
        for (let i = ys.length - 1; i > from; i--)
          if (ev.clientY > ys[i]) {
            to = i;
            break;
          }
      landing = to;
      setDrag({ from, to, y: dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (didDrag.current && landing !== from) onReorder(from, landing);
      // let the suppressed click through on the NEXT gesture, never this one
      setTimeout(() => {
        didDrag.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  if (!open) return null;
  const inOrder = new Map(queue.map((q, i) => [q.id, i + 1]));
  const hasNext = currentIdx != null && currentIdx < queue.length - 1;
  return (
    <>
      <Scrim onClose={onClose} z="z-[23]" />
      {/* PHONE: a fixed sheet under the bar, full-width. DESKTOP: the house
          dropdown, right-aligned under the mark that opened it.
          THE ROOM'S LADDER: pills 18–19 · the mixer desk 20 · the conversation
          22 · THIS 23/24 · the paying sheet 40. A menu opened from the bar
          outranks every panel that lives on the page — at z-20 the crate opened
          UNDERNEATH the chat and looked like it had failed to open at all. */}
      <div className="fixed inset-x-3 top-[max(3.4rem,calc(env(safe-area-inset-top)_+_3.1rem))] z-[24] flex max-h-[min(70dvh,540px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/95 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
        <div className="flex min-h-0 flex-col p-1.5">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* ── YOUR HITS — the list, and the whole point. Tap = it plays. */}
            <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted/50">
              hits
            </p>
            {hits === null ? (
              <p className="px-3 py-1.5 text-[12px] text-muted/50">
                <span className="shimmer-text">opening the crate…</span>
              </p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted/60">
                Nothing finished yet — write a hit in the studio and it lands
                here.
              </p>
            ) : (
              <div>
                {hits.map((h) => {
                  const pos = inOrder.get(h.id);
                  return (
                    <div
                      key={h.id}
                      className="group flex items-center gap-1.5 rounded-xl px-3 py-2 transition hover:bg-white/[0.05]"
                      // the moment the eye lands on it, the song is on its way
                      onPointerEnter={() => h.ready && onPrefetch(h.id)}
                    >
                      <button
                        onClick={() => onPlayHit(h.id)}
                        onFocus={() => h.ready && onPrefetch(h.id)}
                        disabled={!h.ready}
                        title={
                          h.ready
                            ? "Play the whole song — write on top of it"
                            : "Still composing — it lands here when it's ready"
                        }
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-40"
                      >
                        <span className="w-3.5 shrink-0 text-center text-[10px] tabular-nums text-muted/45">
                          {pos ?? ""}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85">
                          {h.title}
                        </span>
                      </button>
                      {/* THE SECOND ACT, kept quiet but never hidden: put it in
                          an order. (A control that appears on hover is a
                          control that isn't there — the house law.) */}
                      <button
                        onClick={() => onAdd(h.id)}
                        disabled={!h.ready}
                        aria-label="Add to the set"
                        title={pos ? "Again — a hit can play twice in a night" : "Add to the set"}
                        className="shrink-0 px-1 text-[13px] leading-none text-muted/30 transition hover:text-accent-strong disabled:opacity-0 group-hover:text-muted/60"
                      >
                        ＋
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── THE SET — only once there is one. Everything about
                sequencing lives in here, out of the way until it's wanted. */}
            {queue.length > 0 && (
              <div className="mt-1 border-t border-white/[0.06] pt-1.5">
                <div className="flex items-center px-3 pb-1 pt-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted/50">
                    set · {queue.length}
                  </span>
                  <span className="flex-1" />
                  {queue.length > 1 && (
                    <button
                      onClick={onArrange}
                      disabled={arranging}
                      title="The machine orders the night and picks how each song arrives — your hands always overrule it"
                      className="rounded-full px-2 py-0.5 text-[11.5px] text-accent-strong/90 transition hover:bg-accent/[0.1] active:scale-[.95] disabled:opacity-50"
                    >
                      {arranging ? <span className="shimmer-text">ordering…</span> : <>✦ arrange</>}
                    </button>
                  )}
                </div>
                <div ref={rowsRef}>
                  {queue.map((q, i) => {
                    const now = i === currentIdx;
                    const dragging = drag?.from === i;
                    const line = drag && drag.to === i && drag.from !== i;
                    return (
                      <div key={`${q.id}:${i}`}>
                        {/* THE SEAM — how this song arrives. One capsule on a
                            hairline; tap and it opens into the move itself. */}
                        {i > 0 && (
                          <Seam
                            shape={q.t}
                            open={openSeam === i}
                            armed={arriving?.to === i ? arriving : null}
                            onToggle={() => setOpenSeam((v) => (v === i ? null : i))}
                            onPatch={(patch) => onTransition(i, patch)}
                          />
                        )}
                        {/* the drop line — where the row you're dragging lands */}
                        {line && drag.to < drag.from && <DropLine />}
                        <div
                          data-set-row
                          className={`group flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-colors ${
                            now ? "bg-white/[0.05]" : "hover:bg-white/[0.05]"
                          } ${dragging ? "relative z-10 bg-white/[0.07] shadow-[0_12px_30px_-12px_rgba(0,0,0,.9)]" : ""}`}
                          style={
                            dragging
                              ? { transform: `translateY(${drag.y}px)`, opacity: 0.95 }
                              : undefined
                          }
                          onPointerEnter={() => onPrefetch(q.id)}
                        >
                          <button
                            onClick={() => {
                              if (didDrag.current) return; // that was a drag
                              onPlay(i);
                            }}
                            onPointerDown={(e) => {
                              // MOUSE: drag from anywhere on the row. TOUCH:
                              // from the grip only — a finger dragging a row
                              // inside a scrolling sheet has to mean scroll.
                              if (e.pointerType === "mouse" && e.button === 0) startDrag(i, e);
                            }}
                            onKeyDown={(e) => {
                              // ⌥↑ / ⌥↓ — the same move, from the keyboard
                              if (!e.altKey) return;
                              if (e.key === "ArrowUp" && i > 0) {
                                e.preventDefault();
                                onReorder(i, i - 1);
                              } else if (e.key === "ArrowDown" && i < queue.length - 1) {
                                e.preventDefault();
                                onReorder(i, i + 1);
                              }
                            }}
                            title={
                              now
                                ? "Playing — this is the room right now"
                                : "Take it — it arrives the way the seam above says"
                            }
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            {now ? (
                              <span className="flex h-3 w-3.5 shrink-0 items-end justify-center gap-[2px]" aria-hidden>
                                {[0, 1, 2].map((b) => (
                                  <span
                                    key={b}
                                    className="eq-bar w-[2.5px] rounded-full bg-accent-strong"
                                    style={{ height: "100%", animationDelay: `${b * 0.18}s` }}
                                  />
                                ))}
                              </span>
                            ) : (
                              <span className="w-3.5 shrink-0 text-center text-[11px] tabular-nums text-muted/50">
                                {i + 1}
                              </span>
                            )}
                            <span
                              className={`min-w-0 flex-1 truncate text-[12.5px] ${
                                now ? "font-medium text-foreground" : "text-foreground/75"
                              }`}
                            >
                              {q.title}
                            </span>
                            {/* HOW FAR IN, on the row that is playing it. */}
                            {now && playhead && (
                              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted/50">
                                {playhead.at} <span className="text-muted/30">/ {playhead.of}</span>
                              </span>
                            )}
                          </button>
                          <span className="flex shrink-0 items-center">
                            {queue.length > 1 && (
                              <span
                                onPointerDown={(e) => {
                                  if (e.pointerType !== "mouse") startDrag(i, e);
                                }}
                                role="button"
                                tabIndex={-1}
                                aria-label="Drag to reorder"
                                title="Drag it where it belongs"
                                className="cursor-grab touch-none px-1 text-muted/30 transition hover:text-foreground/70 active:cursor-grabbing"
                              >
                                <GripMark />
                              </span>
                            )}
                            <button
                              onClick={() => onRemove(i)}
                              aria-label="Out of the set"
                              className="p-1 text-[11px] text-muted/40 transition hover:text-red-300"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                        {/* HOW FAR THROUGH THE SONG — the app's playhead, a
                            track with a gradient fill. It is the only place
                            that says it on a phone, where the header's
                            now-playing capsule has no room to exist. */}
                        {now && playhead && (
                          <div className="mx-3 mb-1 h-[2px] overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#ff63c1] to-accent-strong shadow-[0_0_8px_rgba(224,49,156,.7)] transition-[width] duration-200 ease-linear"
                              style={{ width: `${Math.max(1, playhead.through * 100).toFixed(2)}%` }}
                            />
                          </div>
                        )}
                        {line && drag.to > drag.from && <DropLine />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* the one CTA — the night advances on YOUR word */}
          {hasNext && (
            <button
              onClick={onNext}
              className="btn-primary mx-1.5 mb-1 mt-2 shrink-0 rounded-full py-2 text-[13px] font-medium transition active:scale-[.98]"
            >
              next → {queue[currentIdx! + 1]?.title}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** The one place a finger may take hold of a row. Drawn for the same reason
 *  the seam is: a braille-dots character is a box on the machines that lack it. */
function GripMark() {
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden className="block">
      {[3, 6, 9].map((y) => (
        <g key={y} fill="currentColor">
          <circle cx="2.5" cy={y - 0.5} r="1" />
          <circle cx="6.5" cy={y - 0.5} r="1" />
        </g>
      ))}
    </svg>
  );
}

/** Where the dragged row will land. */
function DropLine() {
  return (
    <div className="mx-3 my-0.5 h-px bg-gradient-to-r from-transparent via-accent-strong to-transparent shadow-[0_0_10px_rgba(224,49,156,.7)]" />
  );
}

/**
 * THE SEAM — one machined capsule on a hairline, saying how the next song
 * arrives; tapping it opens the same object at full density (the song page's
 * closed-seam ↔ open-picker language). Chips are WHAT it is, the line under
 * them is what it does to the ear, the knobs are how much.
 */
function Seam({
  shape,
  open,
  armed,
  onToggle,
  onPatch,
}: {
  shape: TransitionShape | undefined;
  open: boolean;
  armed: { word: string; dropAt: number; barMs: number } | null;
  onToggle: () => void;
  onPatch: (patch: Partial<TransitionShape>) => void;
}) {
  const { move, knobs } = transitionKnobsOf(shape);
  // While a move is in the air the seam counts the bars down to the drop. The
  // reading is STAMPED WITH THE DROP IT BELONGS TO, so a leftover number from
  // the previous move can never flash on the next one.
  const [cd, setCd] = useState<{ dropAt: number; left: number } | null>(null);
  useEffect(() => {
    if (!armed) return;
    const iv = setInterval(
      () => setCd({ dropAt: armed.dropAt, left: armed.dropAt - performance.now() }),
      120,
    );
    return () => clearInterval(iv);
  }, [armed]);
  const left = armed && cd?.dropAt === armed.dropAt ? cd.left : null;
  const bars = armed && left != null ? Math.ceil(left / armed.barMs) : 0;
  // Only ever counts DOWN. Once the drop has happened the number is a lie the
  // ear can check, so it goes — the capsule stays lit until the move's tail is
  // finished, which is the true thing left to say.
  const countdown =
    !armed || left == null || left <= 150 ? null : bars <= 1 ? "in 1 bar" : `in ${bars} bars`;
  if (!open)
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="h-px flex-1 bg-white/[0.07]" />
        <button
          onClick={onToggle}
          aria-expanded={false}
          title={`${move.word} — ${move.hint}`}
          className={`flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] leading-none transition ${
            armed
              ? "border-accent/40 bg-accent/[0.14] text-accent-strong shadow-[0_0_20px_-6px_rgba(224,49,156,.9)]"
              : "border-white/[0.08] bg-white/[0.03] text-muted/60 hover:border-accent/30 hover:bg-accent/[0.08] hover:text-accent-strong"
          }`}
        >
          {move.word}
          {countdown && (
            <span className="font-mono text-[10px] tabular-nums text-accent-strong/75">
              · {countdown}
            </span>
          )}
        </button>
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>
    );
  return (
    <div className="animate-fade-in mx-1.5 my-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted/45">arrives</span>
        {countdown && (
          <span className="font-mono text-[10px] tabular-nums text-accent-strong">{countdown}</span>
        )}
        <span className="h-px flex-1 bg-white/[0.06]" />
        <button
          onClick={onToggle}
          aria-label="Close"
          className="px-1 text-[11px] leading-none text-muted/45 transition hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1 px-0.5 pb-1">
        {TRANSITION_MOVES.map((m) => {
          const on = m.tpl === move.tpl;
          return (
            <button
              key={m.tpl}
              title={m.hint}
              // a template carries its OWN knobs — switching move resets to
              // what that move wants, exactly like picking a break or an ending
              onClick={() => onPatch({ tpl: m.tpl, ...m.def })}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition active:scale-95 ${
                on
                  ? "bg-gradient-to-r from-[#ff63c1] to-accent-strong text-white"
                  : "text-muted/55 hover:bg-white/[0.06] hover:text-foreground"
              }`}
            >
              {m.word}
            </button>
          );
        })}
      </div>
      <p className="px-1 pb-2 text-[10.5px] leading-snug text-muted/50">{move.hint}</p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-1 pb-1 [&>*:first-child]:col-span-2">
        {TRANSITION_KNOBS.map((k) => {
          const live = move.uses.includes(k.field as TransitionKnobField);
          return (
            <SeamKnob
              key={k.field}
              label={k.word}
              value={knobs[k.field as TransitionKnobField]}
              min={k.min}
              max={k.max}
              step={"int" in k && k.int ? 1 : (k.max - k.min) / 100}
              live={live}
              // never a control that vanishes: a knob this move has no use for
              // stays where it is and says so
              why={live ? "" : `${move.word} has nothing to shape — it just lands.`}
              fmt={(v) => transitionKnobText(k.field as TransitionKnobField, v)}
              onInput={(v) => onPatch({ [k.field]: v })}
            />
          );
        })}
      </div>
    </div>
  );
}

function SeamKnob({
  label,
  value,
  min,
  max,
  step,
  live,
  why,
  fmt,
  onInput,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  live: boolean;
  why: string;
  fmt: (v: number) => string;
  onInput: (v: number) => void;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  return (
    <div className={live ? "" : "opacity-35"} title={why || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] text-foreground/75">{label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-muted/50">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={!live}
        onChange={(e) => onInput(Number(e.target.value))}
        aria-label={label}
        className="slider mt-1.5"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
        }}
      />
    </div>
  );
}
