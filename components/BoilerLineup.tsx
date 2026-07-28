"use client";

/**
 * THE LINEUP — the boiler room's crate (2026-07-28, user: "integrate the sets
 * within the live… you can import songs you have constructed with klappn, and
 * then you can live code on top"). A machined corner card in the room:
 * your hits below, the night's order above; tap a row and that song's code
 * POURS INTO THE PANES (the fade rides the master), and everything you
 * live-coded on top goes with the pour — the pane IS the performance.
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
    <div className="pill-pop fixed bottom-16 left-4 z-[19] flex max-h-[70dvh] w-[300px] flex-col overflow-hidden rounded-[26px] border border-white/[0.14] bg-black/45 shadow-[0_24px_80px_-18px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl backdrop-saturate-[1.6]">
      <span
        aria-hidden
        className="block h-[2px] w-full shrink-0 bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] opacity-90"
      />
      <div className="flex min-h-0 flex-col p-4">
        <div className="flex items-baseline gap-2">
          <span className="wordmark bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] bg-clip-text text-[17px] leading-none text-transparent">
            lineup
          </span>
          {queue.length > 0 && (
            <span className="text-[12px] tabular-nums text-muted/70">
              {queue.length} {queue.length === 1 ? "song" : "songs"}
            </span>
          )}
          <span className="flex-1" />
          {queue.length > 1 && (
            <button
              onClick={onArrange}
              disabled={arranging}
              title="The AI orders the night — tempo arc, key flow; your ↑↓ always overrides"
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] text-accent-strong/90 transition hover:bg-accent/[0.1] active:scale-[.95] disabled:opacity-50"
            >
              {arranging ? (
                <span className="shimmer-text">ordering…</span>
              ) : (
                <>✦ Arrange</>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Put the lineup away"
            className="-m-1.5 p-1.5 text-[13px] text-muted/60 transition hover:text-foreground active:scale-[.92]"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-3">
          {/* THE NIGHT — the order; tap a row and its code pours in. */}
          {queue.length > 0 ? (
            <div className="space-y-0.5">
              {queue.map((q, i) => {
                const now = i === currentIdx;
                return (
                  <div
                    key={`${q.id}:${i}`}
                    className={`group flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition ${
                      now ? "bg-accent/[0.1]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <button
                      onClick={() => onPlay(i)}
                      title={now ? "In the panes now" : "Pour this song into the panes — the fade rides the master"}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {now ? (
                        <span className="flex h-3 shrink-0 items-end gap-[2px]" aria-hidden>
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
                          now ? "text-accent-strong" : "text-foreground/85"
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
            <p className="px-2 text-[12px] leading-relaxed text-muted/60">
              Build the night: add your hits below, order them, then pour the
              first one in and play on top of it.
            </p>
          )}
          {/* YOUR HITS — the library, one tap to queue. */}
          <div className="mt-3 border-t border-white/[0.07] pt-2.5">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/40">
              your hits
            </p>
            {hits === null ? (
              <p className="px-2 py-1 text-[12px] text-muted/50">
                <span className="shimmer-text">opening the crate…</span>
              </p>
            ) : hits.length === 0 ? (
              <p className="px-2 py-1 text-[12px] leading-relaxed text-muted/60">
                Nothing finished yet — write a hit in the studio and it lands
                here.
              </p>
            ) : (
              <div className="space-y-0.5">
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
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.04] disabled:opacity-40"
                    >
                      <span className="shrink-0 text-[13px] leading-none text-accent-strong/80">
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
        {/* NEXT — the night advances on YOUR word; the fade carries
            everything you coded on top out with the song. */}
        {hasNext && (
          <button
            onClick={onNext}
            className="btn-primary mt-3 w-full shrink-0 rounded-full py-2 text-[13.5px] font-medium transition active:scale-[.98]"
          >
            next → {queue[currentIdx! + 1]?.title}
          </button>
        )}
      </div>
    </div>
  );
}
