"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";
import { hasHydra } from "@/lib/hydra-embed";
import {
  playPart,
  setVisuals,
  stop,
  teardownVisuals,
} from "@/lib/strudel-client";

/**
 * THE EVENT PAGE — the public face of a moment. One column, one object at a
 * time: the poster glows, the title carries the night, the when/where sit in a
 * single machined card, and there is exactly ONE thing to do (I'm in / Get your
 * ticket). Share is a breath away. No accounts, no explanations, no chrome.
 */

interface Props {
  token: string;
  /** The TRAILER — one loop of the organizer's own music (sealed; its living
   *  visual rides inside the code). Null = no taste attached. */
  trail: {
    strudel: string;
    strudel_mobile: string | null;
    label: string | null;
  } | null;
  title: string;
  tagline: string | null;
  venue: string | null;
  whenDate: string | null;
  whenTime: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Ticket sales deadline (ISO) — null = sales stay open until door time. */
  salesCloseAt: string | null;
  /** The deadline, pre-printed event-local ("Fri, Aug 7, 8:00 PM"). */
  salesCloseLabel: string | null;
  priceCents: number;
  capacity: number | null;
  confirmed: number;
  cancelled: boolean;
  posterUrl: string | null;
}

/** "in 3d 14h" / "in 2h 41m" / "in 12m" — coarse on purpose; a countdown that
 *  ticks seconds is a stopwatch, not an invitation. */
function untilLabel(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `in ${d}d ${h % 24 ? `${h % 24}h` : ""}`.trim();
}

export default function EventClient(p: Props) {
  // ---- phase: upcoming → now → passed (ticks once a minute) ----------------
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const startTs = p.startsAt ? Date.parse(p.startsAt) : null;
  const endTs = p.endsAt
    ? Date.parse(p.endsAt)
    : startTs
      ? startTs + 3 * 3600_000
      : null;
  const phase: "upcoming" | "now" | "passed" | "untimed" = !startTs
    ? "untimed"
    : nowTs < startTs
      ? "upcoming"
      : endTs && nowTs > endTs
        ? "passed"
        : "now";

  // Ticket sales deadline — set and past flips the CTA to the closed state
  // (same honest treatment as at-capacity); ticks over live via nowTs.
  const salesCloseTs = p.salesCloseAt ? Date.parse(p.salesCloseAt) : null;
  const salesOver = salesCloseTs !== null && nowTs >= salesCloseTs;

  // ---- the one action ------------------------------------------------------
  const paid = p.priceCents > 0;
  const spotsLeft =
    p.capacity !== null ? Math.max(0, p.capacity - p.confirmed) : null;
  const full = spotsLeft !== null && spotsLeft === 0;
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inNow, setInNow] = useState(false); // "You're in" — this session
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (rsvpOpen) emailRef.current?.focus();
  }, [rsvpOpen]);

  // Post-payment landing: ?session=cs_... — ask if the webhook confirmed us.
  useEffect(() => {
    const session = new URLSearchParams(location.search).get("session");
    if (!session) return;
    let tries = 0;
    let stop = false;
    const check = async () => {
      if (stop) return;
      try {
        const res = await fetch(
          `/api/e/${p.token}/ticket?session=${encodeURIComponent(session)}`,
        );
        const d = (await res.json().catch(() => ({}))) as { status?: string };
        if (d.status === "confirmed") {
          setInNow(true);
          history.replaceState(null, "", `/e/${p.token}`);
          return;
        }
      } catch {
        /* keep trying */
      }
      if (++tries < 8) setTimeout(check, 1500); // webhook is usually <2s behind
      else setInNow(true); // payment succeeded (Stripe redirected) — trust it
    };
    void check();
    return () => {
      stop = true;
    };
  }, [p.token]);

  async function rsvp() {
    const e = email.trim();
    if (!e.includes("@") || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/e/${p.token}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(d.error || "That didn't take — try again.");
      else setInNow(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/e/${p.token}/checkout`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !d.url) {
        setError(d.error || "Checkout didn't start — try again.");
        setBusy(false);
        return;
      }
      location.href = d.url;
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  // ---- the trailer: the night, playing --------------------------------------
  const [trailOn, setTrailOn] = useState(false);
  const [trailVisual, setTrailVisual] = useState(false);
  const startedTrail = useRef(false);
  async function toggleTrail() {
    if (!p.trail) return;
    if (trailOn) {
      stop();
      teardownVisuals();
      setTrailOn(false);
      setTrailVisual(false);
      return;
    }
    try {
      const t = openDeep(p.trail);
      // Every device plays the original loop (the mobile twin was retired 07-20).
      const code =
        t.strudel;
      const visual = hasHydra(code);
      if (visual) setVisuals(true);
      setTrailOn(true); // optimistic — the tap must feel instant
      startedTrail.current = true;
      await playPart("event-trail", code, p.token);
      setTrailVisual(visual);
    } catch {
      setTrailOn(false);
      setError("The music didn't start — try again.");
    }
  }
  // We started it, we end it — leaving the page mid-trailer never leaks audio.
  useEffect(
    () => () => {
      if (startedTrail.current) {
        stop();
        teardownVisuals();
      }
    },
    [],
  );

  // ---- share ----------------------------------------------------------------
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}/e/${p.token}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title, url });
        return;
      }
    } catch {
      /* dismissed — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied — nothing to do */
    }
  }

  const kicker = useMemo(() => {
    if (p.cancelled) return "Called off";
    if (phase === "now") return "Happening now";
    if (phase === "passed") return "It happened";
    if (phase === "upcoming" && startTs) return untilLabel(startTs - nowTs);
    return "Save the date";
  }, [p.cancelled, phase, startTs, nowTs]);

  const price = `$${(p.priceCents / 100).toFixed(p.priceCents % 100 ? 2 : 0)}`;
  const actionable = !p.cancelled && phase !== "passed" && !full && !salesOver;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col items-center px-6 pb-20 pt-12">
      {/* ambient backdrop: the poster itself, blown out and dimmed — the room's light */}
      {p.posterUrl ? (
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-1000 ${
            trailVisual ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.posterUrl}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-[0.22] blur-3xl saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#060708]" />
        </div>
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="glow-breathe absolute left-1/2 top-[-120px] h-[420px] w-[420px] -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(224,49,156,.28), rgba(179,18,111,.10) 55%, transparent 72%)",
            }}
          />
        </div>
      )}

      {/* poster — the one object, machined */}
      {p.posterUrl && (
        <div className="animate-rise w-full" style={{ ["--i" as string]: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.posterUrl}
            alt={p.title}
            className="w-full rounded-3xl border border-white/[0.1] shadow-[0_40px_120px_-30px_rgba(224,49,156,.45),0_30px_80px_-40px_rgba(0,0,0,.9)]"
          />
        </div>
      )}

      {/* kicker — the pulse of the moment */}
      <div
        className="animate-rise mt-9 flex items-center gap-2"
        style={{ ["--i" as string]: 1 }}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            phase === "now" && !p.cancelled
              ? "playing-glow bg-accent"
              : "bg-accent/70 shadow-[0_0_8px_var(--accent)]"
          }`}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          {kicker}
        </span>
      </div>

      {/* title + tagline */}
      <h1
        className="animate-rise wordmark text-gradient-hot mt-3 text-center text-[40px] leading-[1.06] tracking-tight"
        style={{ ["--i" as string]: 2 }}
      >
        {p.title}
      </h1>
      {p.tagline && (
        <p
          className="animate-rise mt-3 max-w-[36ch] text-center text-[15px] leading-relaxed text-muted"
          style={{ ["--i" as string]: 3 }}
        >
          {p.tagline}
        </p>
      )}

      {/* THE TRAILER — the night, audible. One pill; the tap is the unlock. */}
      {p.trail && (
        <button
          onClick={() => void toggleTrail()}
          className={`animate-rise mt-6 flex items-center gap-2.5 rounded-full border px-6 py-2.5 text-[13.5px] font-semibold backdrop-blur-md transition duration-300 active:scale-95 ${
            trailOn
              ? "border-accent/45 bg-accent/[0.12] text-accent-strong shadow-[0_0_44px_-10px_rgba(224,49,156,.7)]"
              : "border-white/[0.12] bg-white/[0.04] text-foreground/85 hover:border-accent/40 hover:shadow-[0_0_36px_-12px_rgba(224,49,156,.6)]"
          }`}
          style={{ ["--i" as string]: 3 }}
        >
          {trailOn ? (
            <>
              <span className="playing-glow h-2 w-2 rounded-full bg-accent" />
              This is the sound — tap to stop
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              Taste the night
            </>
          )}
        </button>
      )}

      {/* when / where — one machined card, hairline rows */}
      {(p.whenDate || p.venue) && (
        <div
          className="animate-rise mt-8 w-full divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#101115]/80 backdrop-blur-xl"
          style={{ ["--i" as string]: 4 }}
        >
          {p.whenDate && (
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                  When
                </div>
                <div className="mt-1 text-[15px] font-medium text-foreground">
                  {p.whenDate}
                  {p.whenTime && (
                    <span className="text-muted"> · {p.whenTime}</span>
                  )}
                </div>
              </div>
              {phase === "upcoming" && (
                <a
                  href={`/api/e/${p.token}/ics`}
                  className="shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-foreground/75 transition hover:bg-white/[0.09]"
                >
                  Calendar
                </a>
              )}
            </div>
          )}
          {p.venue && (
            <div className="px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Where
              </div>
              <div className="mt-1 text-[15px] font-medium text-foreground">
                {p.venue}
              </div>
            </div>
          )}
        </div>
      )}

      {/* THE action — exactly one */}
      <div className="animate-rise mt-8 w-full" style={{ ["--i" as string]: 5 }}>
        {p.cancelled ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center text-[14px] text-muted">
            This one was called off.
          </div>
        ) : phase === "passed" ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center text-[14px] text-muted">
            This night already happened. You had to be there.
          </div>
        ) : inNow ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/[0.07] px-5 py-5 text-center">
            <div className="wordmark text-gradient text-[24px] tracking-tight">
              You&rsquo;re in.
            </div>
            <p className="mt-1.5 text-[13px] text-muted">
              It&rsquo;s tied to your email — details are in your inbox.
            </p>
            <button
              onClick={share}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.05] px-5 py-2 text-[13px] font-medium text-foreground/85 transition hover:bg-white/[0.1]"
            >
              {copied ? "Link copied" : "Bring the loud ones"}
            </button>
          </div>
        ) : salesOver ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center text-[14px] text-muted">
            Ticket sales have closed.
          </div>
        ) : full ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center text-[14px] text-muted">
            At capacity — the room is full.
          </div>
        ) : paid ? (
          <>
            <button
              onClick={buy}
              disabled={busy}
              className="btn-primary w-full rounded-2xl py-4 text-[16px] font-semibold tracking-tight disabled:opacity-60"
            >
              {busy ? "Opening checkout…" : `Get your ticket — ${price}`}
            </button>
            {spotsLeft !== null && spotsLeft <= 30 && (
              <p className="mt-2.5 text-center text-[12px] text-muted/80">
                {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
              </p>
            )}
          </>
        ) : rsvpOpen ? (
          <div className="cmdbar cmdbar-in flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-[#16111c]/90 py-2 pl-5 pr-2 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl focus-within:border-accent/35">
            <input
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void rsvp()}
              placeholder="your@email"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-foreground placeholder:text-muted/40"
            />
            <button
              onClick={() => void rsvp()}
              disabled={busy || !email.trim().includes("@")}
              aria-label="I'm in"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] text-white shadow-[0_8px_24px_-6px_rgba(224,49,156,.85)] transition-transform hover:scale-[1.06] active:scale-95 disabled:opacity-40"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setRsvpOpen(true)}
              className="btn-primary w-full rounded-2xl py-4 text-[16px] font-semibold tracking-tight"
            >
              I&rsquo;m in
            </button>
            {spotsLeft !== null && spotsLeft <= 30 && (
              <p className="mt-2.5 text-center text-[12px] text-muted/80">
                {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
              </p>
            )}
          </>
        )}
        {/* the deadline, said quietly while the door is still open */}
        {!inNow && actionable && salesCloseTs !== null && p.salesCloseLabel && (
          <p className="mt-2.5 text-center text-[12px] text-muted/60">
            tickets until {p.salesCloseLabel}
          </p>
        )}
        {error && (
          <p className="mt-3 text-center text-[13px] text-red-400/90">{error}</p>
        )}
      </div>

      {/* share — always a breath away (hidden while the success card offers it) */}
      {!inNow && actionable && (
        <button
          onClick={share}
          className="animate-rise mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-5 py-2 text-[13px] font-medium text-foreground/70 transition hover:bg-white/[0.08] hover:text-foreground"
          style={{ ["--i" as string]: 6 }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
          </svg>
          {copied ? "Link copied" : "Share"}
        </button>
      )}

      {/* the quietest signature */}
      <Link
        href="/"
        className="wordmark mt-auto pt-14 text-[12px] font-semibold tracking-tight text-white/25 transition hover:text-white/50"
      >
        Klappn
      </Link>
    </main>
  );
}
