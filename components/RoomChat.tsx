"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDismiss } from "@/components/Dismiss";
import { open as unseal } from "@/lib/seal";
import { diffLines, type LineDiff } from "@/lib/line-diff";

/**
 * THE CONVERSATION (2026-08-02, the user: "a panel like a conversation with an
 * AI just like in Claude… it must be able to make changes to the code as well
 * — that is the point, we can talk to it and it can make changes before our
 * very eyes").
 *
 * A third panel beside the two panes, and the only surface in the room where
 * you speak in whole sentences. It reads what is playing, answers in words as
 * they arrive, and when the ask is a change it writes the WHOLE pane — which
 * lands in the editor and, with the transport on, in the room's own sound one
 * breath later. Nothing here proposes; it does the thing and ⌘Z takes it back
 * (the pane owns its history, so a landed pane is exactly one step).
 *
 * It replaced the ✎ ask — a one-shot command bar that answered in code and
 * could not be asked a follow-up. One AI verb less to learn: the whisper still
 * OFFERS at the caret (⇥ takes it), and everything you would say in words you
 * say here.
 *
 * Layout: a real third column from lg up (you watch the pane change beside the
 * sentence that changed it); below that, a glass sheet on the bottom edge —
 * the composer where every thumb expects it, the code still visible above.
 */

export type ChatPane = "strudel" | "hydra";

/** What the panel needs to know about the room at the moment you hit send. */
export interface RoomSnapshot {
  strudel: string;
  hydra: string;
  playing: boolean;
  hit: { title: string; program: string } | null;
}

interface Msg {
  id: number;
  role: "human" | "machine";
  text: string;
  /** Panes this answer landed / had refused / is writing right now. */
  wrote?: ChatPane[];
  dropped?: ChatPane[];
  writing?: ChatPane | null;
  failed?: boolean;
  /** WHAT IT ACTUALLY DID, line by line — the pane it had against the pane it
   *  wrote. Kept per message so the record survives the next twelve edits. */
  diffs?: Partial<Record<ChatPane, LineDiff>>;
}

/** A quoted stretch of code, carried in from a pane's selection chip. */
export interface ChatSeed {
  pane: ChatPane;
  text: string;
  /** Bumped by the parent on every hand-off so the same span can be sent twice. */
  nonce: number;
}

const STORE = "klappn-room-chat-v1";
const KEEP = 30; // turns kept on disk — a night's conversation, not a career

const paneWord = (p: ChatPane) => (p === "hydra" ? "picture" : "sound");

/** Words with `code` in them. The contract asks for prose and no markdown, and
 *  it obeys — except for the one habit every model has: naming a method in
 *  backticks. Rather than shear them (post-processing a model's answer is the
 *  house's last resort), the one tic it keeps is rendered as what it means: a
 *  mono chip, so `.ply(2)` in a sentence reads like the code it points at. */
function Words({ text }: { text: string }) {
  const parts = text.split(/`([^`\n]+)`/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code
            key={i}
            className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[12px] text-accent-strong/90"
          >
            {p}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}

export default function RoomChat({
  open,
  onClose,
  room,
  onWrite,
  onSpent,
  ensureSession,
  spent,
  seed,
  kbInset = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** Read the room AT SEND TIME — never a snapshot from render (the hands move). */
  room: () => RoomSnapshot;
  /** A gated pane, landed — with the 1-based line numbers that are NEW, so the
   *  editor can show which ones it wrote. The parent owns the pane and the
   *  evaluation. */
  onWrite: (pane: ChatPane, code: string, ask: string, fresh: number[]) => void;
  /** Out of tokens — the parent opens the paying moment. */
  onSpent: () => void;
  ensureSession: () => Promise<boolean>;
  spent: boolean;
  seed: ChatSeed | null;
  kbInset?: number;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<{ pane: ChatPane; text: string } | null>(null);
  /** Which message's diff is unfolded — one at a time (`<msgId>:<pane>`). The
   *  newest lands OPEN: the whole point is to see what just happened to your
   *  code, and something you have to go looking for is not something you feel. */
  const [openDiff, setOpenDiff] = useState<string | null>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true); // the reader is at the bottom → follow the answer

  // The conversation survives a reload like the bench does — same law, same
  // disk. (Mount-time only: a localStorage read in the initial state differs
  // between the server's HTML and the first client paint.)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const rows = JSON.parse(raw) as Msg[];
      if (Array.isArray(rows) && rows.length) {
        seq.current = rows.length;
        setMsgs(rows.map((m, i) => ({ ...m, id: i, writing: null })));
      }
    } catch {
      /* a corrupt transcript is not worth a broken room */
    }
  }, []);
  useEffect(() => {
    if (!msgs.length) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(msgs.slice(-KEEP)));
    } catch {
      /* quota — the conversation still lives in the page */
    }
  }, [msgs]);

  // EVERY OPENING PUTS THE CARET IN THE COMPOSER (the parent hands over a fresh
  // seed each time, selection or not). When a selection came with it, it rides
  // ABOVE the field as a quote — so what the ask is about is legible before a
  // word is typed.
  useEffect(() => {
    if (!seed) return;
    if (seed.text.trim()) setQuote({ pane: seed.pane, text: seed.text });
    inputRef.current?.focus();
  }, [seed]);

  // Follow the answer as it writes — unless the reader has scrolled back up,
  // in which case leave them where they are (nothing is ruder than a panel
  // that yanks you to the bottom mid-sentence).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs, open]);

  const patchLast = useCallback((fn: (m: Msg) => Msg) => {
    setMsgs((prev) => {
      if (!prev.length) return prev;
      const out = prev.slice();
      out[out.length - 1] = fn(out[out.length - 1]);
      return out;
    });
  }, []);

  // THE FIRST KEYSTROKE WARMS THE MACHINE. The conversation's rulebook is a
  // ~17k-token cache write, and paying it on the human's turn cost ~2s of dead
  // air before the first word arrived. Typing is the moment that write is
  // owed — it lands while the sentence is still being finished. Once per visit,
  // signed-in only (warming must never mint a session for someone browsing).
  const warmedRef = useRef(false);
  const warm = useCallback(() => {
    if (warmedRef.current || spent) return;
    warmedRef.current = true; // marked at FIRE time, not on arrival
    void fetch("/api/room/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ warm: true }),
    }).catch(() => {});
  }, [spent]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (spent) return onSpent();
    const asked = quote;
    setDraft("");
    setQuote(null);
    stickRef.current = true;
    const mine: Msg = { id: seq.current++, role: "human", text };
    const answer: Msg = { id: seq.current++, role: "machine", text: "" };
    setMsgs((prev) => [...prev.slice(-(KEEP - 2)), mine, answer]);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      if (!(await ensureSession())) {
        patchLast((m) => ({ ...m, failed: true }));
        return;
      }
      const snap = room();
      // WORDS ONLY in the transcript — the panes below carry the code, and an
      // old take arguing with the live one is how a conversation goes stale.
      const history = msgs.slice(-12).map((m) => ({
        role: m.role === "human" ? "them" : "you",
        text: m.text.slice(0, 1200),
      }));
      const res = await fetch("/api/room/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          strudel: snap.strudel,
          hydra: snap.hydra,
          playing: snap.playing,
          hit: snap.hit,
          selection: asked,
          history,
          message: text,
        }),
      });
      if (res.status === 402) {
        setMsgs((prev) => prev.slice(0, -1));
        onSpent();
        return;
      }
      if (!res.ok || !res.body) {
        patchLast((m) => ({ ...m, failed: true }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          const pane = ev.pane === "hydra" ? "hydra" : "strudel";
          if (ev.t === "say") {
            patchLast((m) => ({ ...m, text: m.text + String(ev.v ?? "") }));
          } else if (ev.t === "open") {
            patchLast((m) => ({ ...m, writing: pane }));
          } else if (ev.t === "land") {
            const code = unseal(String(ev.code ?? ""));
            // THE PANE AS IT IS RIGHT NOW is the "before" — read it here, one
            // instant before the write, so the diff is against what the coder
            // was actually looking at.
            const snap = room();
            // NO CONTEXT LINES: one strudel layer wraps to three rows in this
            // column, so a line of breath either side triples the block for
            // nothing — the pane beside it IS the context, and the "⋯ N
            // unchanged" rows say where in the file this happened.
            const d = diffLines(pane === "hydra" ? snap.hydra : snap.strudel, code, 0);
            onWrite(pane, code, text, d.addedLines);
            setOpenDiff(`${answer.id}:${pane}`);
            patchLast((m) => ({
              ...m,
              writing: null,
              wrote: [...(m.wrote ?? []), pane],
              diffs: { ...m.diffs, [pane]: d },
            }));
          } else if (ev.t === "drop") {
            patchLast((m) => ({
              ...m,
              writing: null,
              dropped: [...(m.dropped ?? []), pane],
            }));
          } else if (ev.t === "fail") {
            patchLast((m) => ({ ...m, writing: null, failed: true }));
          }
        }
      }
      patchLast((m) => ({ ...m, writing: null }));
    } catch (e) {
      // An abort is the coder's own move, not a failure — the half-answer stays.
      if ((e as Error)?.name !== "AbortError") {
        patchLast((m) => ({ ...m, writing: null, failed: true }));
      } else {
        patchLast((m) => ({ ...m, writing: null }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [draft, busy, spent, quote, msgs, room, onWrite, onSpent, ensureSession, patchLast]);

  // Leaving the room mid-answer must not leave a stream pulling tokens.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Escape closes the panel whether or not the field still holds the caret.
  useDismiss(open, onClose);

  if (!open) return null;

  return (
    <aside
      /* ONE ELEMENT, TWO POSTURES: a real column from lg up, a glass sheet on
         the bottom edge below it. Fixed → out of flow, so the panes keep the
         whole row on a phone and simply share it on a desk. */
      className="animate-rise fixed inset-x-2 z-[22] flex h-[58dvh] flex-col overflow-hidden rounded-2xl border border-white/[0.14] bg-black/[0.72] shadow-[0_0_90px_-30px_rgba(224,49,156,.45),0_24px_60px_-24px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-2xl backdrop-saturate-[1.6] lg:static lg:h-auto lg:w-[380px] lg:shrink-0 lg:bg-black/30 lg:shadow-[inset_0_1px_0_rgba(255,255,255,.09),inset_0_-1px_0_rgba(255,255,255,.03)]"
      style={{ bottom: `calc(max(0.5rem, env(safe-area-inset-bottom)) + ${kbInset}px)` }}
      aria-label="Chat"
    >
      {/* THE THREAD — the house gradient along the crown, the room's own way of
          saying "this object is ours" in one hairline. */}
      <div
        aria-hidden
        className="h-[2px] w-full shrink-0"
        style={{ backgroundImage: "linear-gradient(90deg, #ff63c1, #e0319c 55%, #b3126f)" }}
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.09] px-3.5 py-2.5">
        <span className="text-[11.5px] uppercase tracking-[0.18em] text-muted/55">chat</span>
        <span className="flex-1" />
        {msgs.length > 0 && (
          <button
            onClick={() => {
              setMsgs([]);
              try {
                localStorage.removeItem(STORE);
              } catch {
                /* nothing to forget */
              }
            }}
            className="rounded-full px-2 py-1 text-[11.5px] text-muted/45 transition hover:bg-white/[0.06] hover:text-foreground"
            title="Start over — the code stays exactly as it is"
          >
            clear
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close the chat"
          title="Close (⌘K reopens)"
          className="-mr-1 grid h-7 w-7 place-items-center rounded-full text-[12px] text-muted/50 transition hover:bg-white/[0.07] hover:text-foreground active:scale-[.92]"
        >
          ✕
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        /* THE MEASURE IS CAPPED while this is a full-width sheet (a laptop at
           900px gave the answer 90-character lines, which nobody reads); in the
           lg column the width is already the measure. */
        className="mx-auto min-h-0 w-full max-w-[42rem] flex-1 space-y-4 overflow-y-auto px-3.5 py-3.5 lg:max-w-none"
      >
        {msgs.length === 0 ? (
          /* THE INVITATION — two lines, no buttons. An empty panel that offers
             taps would spend someone's tokens before they asked for anything;
             the placeholder below teaches the shape instead. */
          <div className="px-1 pt-6">
            <p className="text-[14px] leading-relaxed text-foreground/85">
              Tell it what you want to hear.
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted/60">
              It knows what is playing — and it writes straight into the panes,
              while the room runs.
            </p>
          </div>
        ) : (
          msgs.map((m) =>
            m.role === "human" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.08] px-3 py-2 text-[13.5px] leading-relaxed text-foreground/90">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={m.id} className="min-w-0">
                {m.text ? (
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/85">
                    <Words text={m.text} />
                  </p>
                ) : m.failed ? null : (
                  /* The answer is on its way — the room's own breathing tell. */
                  <span className="shimmer-text text-[13px]">listening…</span>
                )}
                {/* WHAT IT TOUCHED — a CAPTION, not a badge (a lit capsule in
                    this room is something you press; this is a record). It
                    carries the count of lines in and out, and it OPENS: the
                    lines themselves, the way you would read a commit. */}
                {(m.writing || m.wrote?.length || m.dropped?.length || m.failed) && (
                  <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted/50">
                    {m.writing ? (
                      <span className="shimmer-text">
                        writing the {paneWord(m.writing)}…
                      </span>
                    ) : null}
                    {!m.writing && m.wrote?.length
                      ? m.wrote.map((p) => {
                          const d = m.diffs?.[p];
                          const key = `${m.id}:${p}`;
                          const shown = openDiff === key;
                          return (
                            <button
                              key={p}
                              onClick={() => setOpenDiff(shown ? null : key)}
                              disabled={!d}
                              className="mr-2.5 inline-flex items-center gap-1.5 align-middle transition hover:text-foreground/80 disabled:cursor-default"
                            >
                              wrote{" "}
                              <span className="text-accent-strong/85">the {paneWord(p)}</span>
                              {d && (
                                <>
                                  <span className="tabular-nums text-accent-strong/70">
                                    +{d.added}
                                  </span>
                                  <span className="tabular-nums text-muted/45">−{d.removed}</span>
                                  {/* the one glyph that means "there is more of
                                      this" — it turns when it is open */}
                                  <svg
                                    viewBox="0 0 12 12"
                                    className={`h-[9px] w-[9px] transition-transform ${
                                      shown ? "rotate-90" : ""
                                    }`}
                                    aria-hidden
                                  >
                                    <path
                                      d="M4 2.5 L8 6 L4 9.5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </>
                              )}
                            </button>
                          );
                        })
                      : null}
                    {m.dropped?.map((p) => (
                      <span key={p} className="block">
                        the {paneWord(p)} it wrote would not build — say it again
                      </span>
                    ))}
                    {m.failed && <span className="block">that one did not reach the machine</span>}
                    {/* THE LINES THEMSELVES. Not a preview of something that
                        might happen — this already landed and is already
                        playing; it is here so you can SEE the hand you had in
                        it. Additions in the room's own accent (pink is what is
                        new here, the way it is on the lines in the pane), what
                        left it in quiet grey. */}
                    {m.wrote?.map((p) => {
                      const d = m.diffs?.[p];
                      if (!d || openDiff !== `${m.id}:${p}`) return null;
                      return (
                        <div
                          key={`d-${p}`}
                          className="mt-2 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 py-1.5"
                        >
                          {d.rows.map((r, i) =>
                            r.kind === "gap" ? (
                              <div
                                key={i}
                                className="select-none px-2.5 py-1 font-mono text-[10.5px] text-muted/30"
                              >
                                ⋯ {r.skipped} unchanged
                              </div>
                            ) : (
                              <div
                                key={i}
                                /* WRAPS, never scrolls sideways: a strudel line
                                   is longer than this column will ever be, and
                                   a diff you have to drag to read is a diff
                                   nobody reads. The tint carries across the
                                   wrapped rows, so a long line still reads as
                                   one line. */
                                className={`whitespace-pre-wrap break-words px-2.5 font-mono text-[11.5px] leading-[1.55] ${
                                  r.kind === "add"
                                    ? "bg-accent/[0.09] text-accent-strong/95"
                                    : r.kind === "del"
                                      ? "text-muted/40 line-through decoration-muted/25"
                                      : "text-foreground/45"
                                }`}
                              >
                                <span
                                  aria-hidden
                                  className={
                                    r.kind === "add"
                                      ? "text-accent-strong/70"
                                      : r.kind === "del"
                                        ? "text-muted/35 no-underline"
                                        : "text-transparent"
                                  }
                                >
                                  {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}{" "}
                                </span>
                                {r.text || " "}
                              </div>
                            ),
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>

      {/* THE COMPOSER. `.cmdbar` kills the house's global focus bloom in here:
          the field is focused the whole time this panel is open, and a standing
          pink ring next to the crown thread and the send orb is three pinks on
          one object. The lifted field and the pink caret are the cue. */}
      <div className="cmdbar mx-auto w-full max-w-[42rem] shrink-0 border-t border-white/[0.09] px-3 py-3 lg:max-w-none">
        {quote && (
          /* WHAT THIS IS ABOUT, quoted — carried in from a pane's selection. */
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.05] px-2.5 py-1.5">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted/45">
              {paneWord(quote.pane)}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/70">
              {quote.text}
            </span>
            <button
              onClick={() => setQuote(null)}
              aria-label="Drop the quote"
              className="shrink-0 text-[11px] text-muted/45 transition hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value.trim()) warm();
            }}
            onKeyDown={(e) => {
              // ↵ sends, ⇧↵ makes a line — the shape every message box has.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            rows={1}
            /* Two examples, both true of this machine: one that CHANGES the
               room and one that only answers. Short enough to sit on one line
               in the column — a placeholder that wraps and clips teaches the
               wrong thing about the field. */
            placeholder="dirtier bass · what does .ply do?"
            /* 16px on touch — under that, iOS zooms the page into the field and
               the room lurches. Inline outline:none beats the global
               :focus-visible ring, which would box the field inside its own
               capsule. */
            style={{ outline: "none", maxHeight: 132 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
            }}
            className="min-w-0 flex-1 resize-none rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-[16px] leading-relaxed text-foreground caret-accent transition placeholder:text-muted/35 focus:bg-white/[0.09] sm:text-[13.5px]"
          />
          <button
            onClick={() => (busy ? abortRef.current?.abort() : void send())}
            disabled={!busy && !draft.trim()}
            aria-label={busy ? "Stop" : "Send"}
            title={busy ? "Stop" : "Send (↵)"}
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl text-white transition active:scale-[.94] disabled:opacity-30"
            style={{
              backgroundImage:
                busy || draft.trim()
                  ? "linear-gradient(165deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)"
                  : undefined,
              backgroundColor: busy || draft.trim() ? undefined : "rgba(255,255,255,.06)",
              boxShadow:
                busy || draft.trim()
                  ? "0 2px 12px -2px rgba(179,18,111,.85), 0 0 34px -8px rgba(224,49,156,.8), inset 0 1px 0 rgba(255,255,255,.4)"
                  : undefined,
            }}
          >
            {busy ? (
              /* One square: the universal "stop", drawn — not a spinner
                 borrowed from someone else's software. */
              <svg viewBox="0 0 14 14" className="h-[13px] w-[13px]" aria-hidden>
                <rect x="3" y="3" width="8" height="8" rx="1.4" fill="currentColor" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12h13M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
