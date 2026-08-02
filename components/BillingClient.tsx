"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  nightsFor,
  songsFor,
  TIERS,
  tokensForUsdCents,
} from "@/lib/pricing";

/**
 * THE PLAN PAGE.
 *
 * REBUILT 2026-08-02b (the user: "the pricing does seem a little all over the
 * place"). It was: a display-type meter headline that changed meaning by state,
 * a progress bar, four paragraphs of body copy at three sizes, three
 * overlapping descriptions per tier, and a five-element section for the least
 * important thing on the page. Every piece was defensible; together they were
 * noise.
 *
 * What it is now — FOUR THINGS, in the order a person actually wants them:
 *   1. the price, as the hero (most people are here for exactly this)
 *   2. one quiet line for where YOU stand
 *   3. one line for the overflow valve
 *   4. one line of fine print
 *
 * Each tier card says five things and never says one twice: name · price ·
 * who it is for (five words) · what a month buys · the unit count. The blurbs
 * that restated the buy line in prettier words are gone.
 *
 * AND THE PINK MOVED (the house law, recovered from the old pack grid):
 * "Pink CTA on the ANCHOR, never the ceiling — a hot button on the priciest
 * pack reads as pressure." Creator burns; Studio is stated, not sold.
 */

/** The server's Meter, structurally — declared here so this client bundle
 *  never reaches into lib/billing (which speaks to the database). */
interface MeterView {
  plan: string;
  planAllowance: number;
  monthUsed: number;
  planLeft: number;
  credits: number;
  spent: number;
  creditsLeft: number;
  remaining: number | null;
}

const FALLBACK: MeterView = {
  plan: "free",
  planAllowance: 0,
  monthUsed: 0,
  planLeft: 0,
  credits: 0,
  spent: 0,
  creditsLeft: 0,
  remaining: 0,
};

/** The retired top tier — display only, for the few who still hold one. */
const LEGACY: Record<string, { name: string; usd: number }> = {
  label: { name: "Label", usd: 129 },
};

/** Five words on who each tier is for. Positioning, never a restatement of the
 *  buy line directly under it. */
const FOR: Record<string, string> = {
  creator: "for the song a week",
  studio: "for living in it",
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000)
    return `${(Math.round(n / 100_000) / 10).toLocaleString()}M`;
  return `${Math.round(n / 1000)}k`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What an allowance buys, in the words people use. "or", always: the songs
 *  and the nights come out of ONE allowance, and "and" would be a promise the
 *  meter can't keep. */
function buys(tokens: number): string {
  const songs = songsFor(tokens);
  const nights = nightsFor(tokens);
  if (songs < 1 && nights < 1) return "";
  if (nights < 1) return plural(songs, "song");
  if (songs < 1) return `${plural(nights, "night")} in the room`;
  return `${plural(songs, "song")}, or ${plural(nights, "night")} in the room`;
}

export default function BillingClient({ meter }: { meter: MeterView | null }) {
  const m = meter ?? FALLBACK;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = m.plan === "owner";
  const subscribed = m.planAllowance > 0 && !isOwner;
  const legacy = LEGACY[m.plan] ?? null;
  const tier = TIERS.find((t) => t.id === m.plan) ?? null;

  async function go(path: string, body?: unknown, key = path) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !d.url) {
        // A guest hit the register — money needs a name on the door first.
        if (d.code === "account_required") {
          window.location.href = "/claim";
          return;
        }
        setError(d.error || "Something went wrong — try again.");
        setBusy(null);
        return;
      }
      window.location.href = d.url;
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  /** WHERE YOU STAND — one line, never a panel. A subscriber sees the month; a
   *  free account sees what the house left on the table; the house sees ∞. */
  // The label goes IN FRONT of the amount, never after it: "3 songs, or 1
  // night in the room left" makes you hold the whole sentence to find out what
  // it is telling you.
  const standing = isOwner
    ? "House account — unmetered."
    : subscribed
      ? `${tier?.name ?? legacy?.name}: ${buys(m.planLeft) || "nothing"} left this month. It refills on the 1st.`
      : m.creditsLeft > 0
        ? `Still yours: ${buys(m.creditsLeft) || "a little"}.`
        : "Nothing in the meter — the machine is waiting to be paid.";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-28 pt-6 sm:pt-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="group -ml-1 flex items-center gap-1 text-[15px] text-muted transition hover:text-foreground"
        >
          <span className="text-lg leading-none transition group-hover:-translate-x-0.5">
            ‹
          </span>
          Hits
        </Link>
      </div>

      <header className="mt-12">
        <h1 className="wordmark text-gradient text-[40px] leading-[0.95] tracking-tight sm:text-[54px]">
          Plans
        </h1>
        <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-muted">
          The instrument is free and stays free. A plan keeps the machine on —
          one price a month, nothing to count.
        </p>
      </header>

      {/* THE PRICE IS THE HERO. It used to sit below a meter card that was
          taller than both tiers put together. */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {TIERS.map((t, i) => {
          const mine = m.plan === t.id;
          // THE ANCHOR BURNS, NEVER THE CEILING (house law): the everyday tier
          // carries the pink; the bigger one is stated and left alone.
          const anchor = t.id === "creator";
          return (
            <div
              key={t.id}
              style={{ "--i": i } as CSSProperties}
              className={`animate-rise flex flex-col rounded-[22px] border bg-gradient-to-b p-5 transition duration-300 hover:-translate-y-0.5 ${
                anchor
                  ? "border-accent/25 from-accent/[0.06] to-white/[0.015] shadow-[0_0_65px_-28px_rgba(224,49,156,.55)]"
                  : "border-white/[0.08] from-white/[0.05] to-white/[0.015] hover:border-white/[0.16]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-medium text-foreground">
                  {t.name}
                </span>
                {mine && (
                  <span className="rounded-full bg-accent/[0.14] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.16em] text-accent-strong">
                    yours
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={`wordmark text-[38px] leading-none ${anchor ? "text-gradient" : "text-foreground"}`}
                >
                  ${t.usd}
                </span>
                <span className="text-[13px] text-muted/60">/month</span>
              </div>
              <span className="mt-1 text-[12.5px] text-muted/55">{FOR[t.id]}</span>
              {/* WHAT A MONTH BUYS — the one line that matters, and the only
                  place this tier describes itself. */}
              <p className="mt-4 text-[14px] leading-relaxed text-foreground/90">
                {buys(t.tokens)}
              </p>
              <span className="mt-1 text-[11.5px] tabular-nums text-muted/45">
                {fmtTokens(t.tokens)} units of machine time
              </span>
              <button
                onClick={() =>
                  mine
                    ? go("/api/billing/portal", undefined, "portal")
                    : go("/api/billing/checkout", { plan: t.id }, t.id)
                }
                disabled={!!busy}
                className={`mt-5 w-full rounded-full px-3 py-2.5 text-[13px] font-medium transition active:scale-[.98] disabled:opacity-40 ${
                  mine
                    ? "bg-white/[0.06] text-foreground hover:bg-white/[0.1]"
                    : anchor
                      ? "btn-primary"
                      : "bg-white/[0.08] text-foreground hover:bg-white/[0.14]"
                }`}
              >
                {busy === t.id || (mine && busy === "portal") ? (
                  <span className="shimmer-text">Opening…</span>
                ) : mine ? (
                  "Manage"
                ) : subscribed ? (
                  "Switch in Manage"
                ) : (
                  `Start ${t.name}`
                )}
              </button>
            </div>
          );
        })}
      </section>

      {/* WHERE YOU STAND — one line under the price, where it belongs: it
          answers a question you only have AFTER you know what things cost. */}
      <section className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className={isOwner || (m.remaining ?? 0) > 0 ? "" : "text-foreground/80"}>
          {standing}
        </span>
        {m.credits > 0 && !isOwner && (
          <span className="tabular-nums text-muted/50">
            {fmtTokens(m.creditsLeft)} prepaid units, never expiring
          </span>
        )}
        {/* ONLY when the plan has no card of its own to carry it — the retired
            Label. A tier on the shelf already shows "Manage" on itself, and two
            doors to the same room forty pixels apart is the clutter this page
            was rebuilt to lose. */}
        {legacy && !tier && (
          <button
            onClick={() => go("/api/billing/portal", undefined, "portal")}
            disabled={!!busy}
            className="text-muted/70 underline decoration-white/20 underline-offset-2 transition hover:text-foreground disabled:opacity-40"
          >
            {busy === "portal" ? "Opening…" : "Manage or cancel"}
          </button>
        )}
      </section>

      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}

      {/* THE OVERFLOW VALVE — one row. It was a five-element section for the
          least important thing here. */}
      {!isOwner && (
        <section className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-5">
          <span className="text-[13px] text-muted">
            Ran long? Top up — the plan’s month is always spent first, and this
            never expires.
          </span>
          <span className="flex flex-wrap gap-2">
            {CREDIT_PACK_USD.map((usd) => (
              <button
                key={usd}
                onClick={() => go("/api/billing/checkout", { usd }, String(usd))}
                disabled={!!busy}
                title={`${fmtTokens(tokensForUsdCents(usd * 100))} units · + ${(cardFeeCents(usd * 100) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} card fee`}
                className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-foreground/85 transition hover:border-white/[0.2] hover:bg-white/[0.08] active:scale-[.98] disabled:opacity-40"
              >
                {busy === String(usd) ? (
                  <span className="shimmer-text">Opening…</span>
                ) : (
                  <>
                    ${usd}
                    <span className="ml-1.5 text-[11.5px] tabular-nums text-muted/55">
                      {fmtTokens(tokensForUsdCents(usd * 100))}
                    </span>
                  </>
                )}
              </button>
            ))}
          </span>
        </section>
      )}

      {/* ONE line of fine print. There were three. */}
      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-muted/55">
        The instrument is free to look around and to play — the machine that
        writes with you is what you are buying. Cancel any time; your songs and everything you have written
        stay exactly where they are. The card fee is Stripe’s, passed through to
        the cent, and the whole price sheet is{" "}
        <Link
          href="/open"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          one screen of open code
        </Link>
        .
      </p>
    </main>
  );
}
