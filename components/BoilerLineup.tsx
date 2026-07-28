"use client";

/**
 * THE LINEUP — the boiler room's set list, a HEADER control now (2026-07-28,
 * user: the corner chip read wrong; the lineup is the night's structure, it
 * belongs up top). One quiet word in the bar; tap it and the house dropdown
 * opens — same machined glass as AccountMenu and the code door, no gradient
 * headline (the one pink is for STATE and the one CTA, never a title).
 *
 * Tap a row and that song's code POURS INTO THE PANES (the fade rides the
 * master) — everything live-coded on top leaves with the next pour.
 *
 * Pure view — the room (ZaltzIDE) owns the queue, the pours, the fades.
 */

export interface LineupHit {
  id: string;
  title: string;
  ready: boolean;
}

export default function BoilerLineup({
  open,
  onClose,
  queue,
  currentIdx,
  hits,
  onAdd,
  onRemove,
  onMove,
  onPlay,
  onNext,
  onArrange,
  arranging,
}: {
  open: boolean;
  onClose: () => void;
  queue: { id: string; title: string }[];
  /** The row whose song is in the panes right now (null = free play). */
  currentIdx: number | null;
  /** The library — null while it loads; [] = no ready hits yet. */
  hits: LineupHit[] | null;
  onAdd: (id: string) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onPlay: (i: number) => void;
  onNext: () => void;
  onArrange: () => void;
  arranging: boolean;
}) {
  if (!open) return null;
  const queued = new Set(queue.map((q) => q.id));
  const hasNext = currentIdx != null && currentIdx < queue.length - 1;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      {/* PHONE: a fixed sheet under the bar, full-width (anchored to the
          chip it ran off the left edge — the chip sits mid-header). DESKTOP:
          the house dropdown, right-aligned under its word. */}
      <div className="fixed inset-x-3 top-[max(3.4rem,calc(env(safe-area-inset-top)_+_3.1rem))] z-20 flex max-h-[min(70dvh,540px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/95 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72">
        <div className="flex min-h-0 flex-col p-1.5">
          <div className="flex items-center px-3 pb-1 pt-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted/50">
              The night{queue.length > 0 ? ` · ${queue.length}` : ""}
            </span>
            <span className="flex-1" />
            {queue.length > 1 && (
              <button
                onClick={onArrange}
                disabled={arranging}
                title="The AI orders the night — tempo arc, key flow; your ↑↓ always overrides"
                className="rounded-full px-2 py-0.5 text-[11.5px] text-accent-strong/90 transition hover:bg-accent/[0.1] active:scale-[.95] disabled:opacity-50"
              >
                {arranging ? <span className="shimmer-text">ordering…</span> : <>✦ Arrange</>}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {queue.length > 0 ? (
              <div>
                {queue.map((q, i) => {
                  const now = i === currentIdx;
                  return (
                    <div
                      key={`${q.id}:${i}`}
                      className={`group flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${
                        now ? "bg-white/[0.05]" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <button
                        onClick={() => onPlay(i)}
                        title={
                          now
                            ? "In the panes now"
                            : "Pour this song into the panes — the fade rides the master"
                        }
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        {now ? (
                          <span className="flex h-3 w-3 shrink-0 items-end justify-center gap-[2px]" aria-hidden>
                            {[0, 1, 2].map((b) => (
                              <span
                                key={b}
                                className="eq-bar w-[2.5px] rounded-full bg-accent-strong"
                                style={{ height: "100%", animationDelay: `${b * 0.18}s` }}
                              />
                            ))}
                          </span>
                        ) : (
                          <span className="w-3 shrink-0 text-center text-[11px] tabular-nums text-muted/50">
                            {i + 1}
                          </span>
                        )}
                        <span
                          className={`min-w-0 flex-1 truncate text-[13px] ${
                            now ? "font-medium text-foreground" : "text-foreground/80"
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
                          aria-label="Out of the lineup"
                          className="p-1 text-[11px] text-muted/50 transition hover:text-red-300"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-2 text-[12px] leading-relaxed text-muted/60">
                Build the night: add your hits below, order them, pour the
                first one in and play on top of it.
              </p>
            )}
            {/* the library — one tap to queue */}
            <div className="mt-1 border-t border-white/[0.06] pt-1.5">
              <p className="px-3 pb-1 pt-1 text-[11px] uppercase tracking-[0.18em] text-muted/50">
                Your hits
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
                    const inQ = queued.has(h.id);
                    return (
                      <button
                        key={h.id}
                        onClick={() => onAdd(h.id)}
                        disabled={!h.ready}
                        title={
                          !h.ready
                            ? "Still composing — it joins when it's ready"
                            : inQ
                              ? "Again — a song can play twice"
                              : "Into the lineup"
                        }
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        <span className="w-3 shrink-0 text-center text-[13px] leading-none text-muted/60">
                          ＋
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/75">
                          {h.title}
                        </span>
                        {inQ && (
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted/50">
                            in
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
