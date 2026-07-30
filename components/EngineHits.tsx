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
 *     ordering (↑↓, ✕, ✦ arrange, next →) lives inside it.
 *
 * The word "lineup" is retired from every surface. The storage key it was
 * saved under is NOT — `klappn-lineup-v1` holds people's real orders, and
 * renaming a key silently empties it.
 *
 * Pure view — the room (ZaltzIDE) owns the queue, the pours, the fades.
 */

export interface LineupHit {
  id: string;
  title: string;
  ready: boolean;
}

export default function EngineHits({
  open,
  onClose,
  queue,
  currentIdx,
  hits,
  onAdd,
  onRemove,
  onMove,
  onPlay,
  onPlayHit,
  onNext,
  onArrange,
  arranging,
}: {
  open: boolean;
  onClose: () => void;
  /** The order, when one exists. Empty is the normal, expected state. */
  queue: { id: string; title: string }[];
  /** The row whose song is in the panes right now (null = free play). */
  currentIdx: number | null;
  /** The library — null while it loads; [] = no ready hits yet. */
  hits: LineupHit[] | null;
  onAdd: (id: string) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onPlay: (i: number) => void;
  /** Pour a hit straight in, with no order involved — the primary act. */
  onPlayHit: (id: string) => void;
  onNext: () => void;
  onArrange: () => void;
  arranging: boolean;
}) {
  if (!open) return null;
  const inOrder = new Map(queue.map((q, i) => [q.id, i + 1]));
  const hasNext = currentIdx != null && currentIdx < queue.length - 1;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      {/* PHONE: a fixed sheet under the bar, full-width. DESKTOP: the house
          dropdown, right-aligned under the mark that opened it. */}
      <div className="fixed inset-x-3 top-[max(3.4rem,calc(env(safe-area-inset-top)_+_3.1rem))] z-20 flex max-h-[min(70dvh,540px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/95 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72">
        <div className="flex min-h-0 flex-col p-1.5">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* ── YOUR HITS — the list, and the whole point. Tap = it plays. */}
            <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted/50">
              your hits
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
                    >
                      <button
                        onClick={() => onPlayHit(h.id)}
                        disabled={!h.ready}
                        title={
                          h.ready
                            ? "Pour it into the panes — the fade rides the master"
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
                      {/* THE SECOND ACT, kept quiet: put it in an order. It
                          only shows on hover (always on touch), so the list
                          reads as one clean column of songs. */}
                      <button
                        onClick={() => onAdd(h.id)}
                        disabled={!h.ready}
                        aria-label="Add to the order"
                        title={pos ? "Again — a song can play twice" : "Add to the order"}
                        className="shrink-0 px-1 text-[13px] leading-none text-muted/45 opacity-0 transition hover:text-accent-strong disabled:opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100"
                      >
                        ＋
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── THE ORDER — only once there is one. Everything about
                sequencing lives in here, out of the way until it's wanted. */}
            {queue.length > 0 && (
              <div className="mt-1 border-t border-white/[0.06] pt-1.5">
                <div className="flex items-center px-3 pb-1 pt-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted/50">
                    the order · {queue.length}
                  </span>
                  <span className="flex-1" />
                  {queue.length > 1 && (
                    <button
                      onClick={onArrange}
                      disabled={arranging}
                      title="The machine orders the night — tempo arc, key flow; your ↑↓ always overrides"
                      className="rounded-full px-2 py-0.5 text-[11.5px] text-accent-strong/90 transition hover:bg-accent/[0.1] active:scale-[.95] disabled:opacity-50"
                    >
                      {arranging ? <span className="shimmer-text">ordering…</span> : <>✦ arrange</>}
                    </button>
                  )}
                </div>
                {queue.map((q, i) => {
                  const now = i === currentIdx;
                  return (
                    <div
                      key={`${q.id}:${i}`}
                      className={`group flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
                        now ? "bg-white/[0.05]" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <button
                        onClick={() => onPlay(i)}
                        title={now ? "In the panes now" : "Pour this one in"}
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
                      </button>
                      <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100">
                        <button
                          onClick={() => onMove(i, -1)}
                          disabled={i === 0}
                          aria-label="Earlier"
                          className="p-1 text-[11px] text-muted/50 transition hover:text-foreground disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => onMove(i, 1)}
                          disabled={i === queue.length - 1}
                          aria-label="Later"
                          className="p-1 text-[11px] text-muted/50 transition hover:text-foreground disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => onRemove(i)}
                          aria-label="Out of the order"
                          className="p-1 text-[11px] text-muted/50 transition hover:text-red-300"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  );
                })}
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
