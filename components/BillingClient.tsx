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
  USD_CENTS_PER_MILLION,
} from "@/lib/pricing";

/**
 * THE PLAN PAGE (the subscription pivot, 2026-08-02).
 *
 * What changed and why: this page used to sell prepaid tokens, and it led with
 * the number — a flat public $/M rate, a balance, four packs. That was honest
 * and it made everybody do arithmetic before they could buy anything. A plan is
 * the same honesty with the arithmetic already done: the headline says what a
 * month BUYS (songs, nights in the room), and the unit count sits underneath it
 * for anyone who wants to check the sum. Both numbers come off the same
 * constants the gate meters against (lib/pricing TIERS), so the shelf and the
 * machine can never disagree.
 *
 * Top-ups survive below, deliberately quiet: they are the overflow valve for a
 * night that ran long, not the product. And every prepaid unit sold in the July
 * token era is still spendable here, forever, exactly as promised.
 */

/** The server's Meter, structurally — declared here so this client bundle
 *  never reaches into lib/billing (which speaks to the database). */
interface MeterView {
  plan: string;
  planAllowance: number;
  monthUsed: number;
  planLeft: number;
  taste: number;
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
  taste: 0,
  credits: 0,
  spent: 0,
  creditsLeft: 0,
  remaining: 0,
};

/** The retired top tier — display only, for the few who still hold one. */
const LEGACY: Record<string, { name: string; usd: number }> = {
  label: { name: "Label", usd: 129 },
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000)
    return `${(Math.round(n / 100_000) / 10).toLocaleString()}M`;
  return `${Math.round(n / 1000)}k`;
}

/** What an allowance buys, in the words people actually use. Floored, so a
 *  plan always delivers at least what the page promised. */
function buys(tokens: number): string {
  const songs = songsFor(tokens);
  const nights = nightsFor(tokens);
  const parts = [
    songs > 0 ? `${songs} song${songs === 1 ? "" : "s"}` : "",
    nights > 0 ? `${nights} night${nights === 1 ? "" : "s"} in the room` : "",
  ].filter(Boolean);
  return parts.join(" · or ");
}

export default function BillingClient({ meter }: { meter: MeterView | null }) {
  const m = meter ?? FALLBACK;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = m.plan === "owner";
  const subscribed = m.planAllowance > 0 && !isOwner;
  const legacy = LEGACY[m.plan] ?? null;
  const tier = TIERS.find((t) => t.id === m.plan) ?? null;
  const monthPct = subscribed
    ? Math.min(100, (m.monthUsed / (m.planAllowance || 1)) * 100)
    : 0;
  // Lifetime spend at the same public rate — the arithmetic stays checkable.
  const spentCents = (m.spent / 1_000_000) * USD_CENTS_PER_MILLION;

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
        <p className="mt-2.5 text-[15px] text-muted">
          The instrument is free, and stays free. A plan keeps the machine
          on — one price a month, no counting.{" "}
          <Link
            href="/open"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            Here’s the whole deal
          </Link>
          .
        </p>
      </header>

      {/* WHERE YOU STAND. A subscriber sees the month; everybody else sees
          what the house put on the table. */}
      <section className="animate-rise mt-9 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <span
              className={`wordmark text-[30px] leading-none ${
                isOwner || (m.remaining ?? 0) > 0 ? "text-gradient" : "text-foreground"
              }`}
            >
              {isOwner
                ? "∞"
                : subscribed
                  ? tier?.name ?? legacy?.name ?? "Plan"
                  : m.creditsLeft > 0
                    ? buys(m.creditsLeft) || "a taste"
                    : "spent"}
            </span>
            <span className="text-[13px] text-muted/60">
              {isOwner
                ? "house account — unmetered"
                : subscribed
                  ? `$${tier?.usd ?? legacy?.usd}/month`
                  : m.creditsLeft > 0
                    ? // "on the house" is only true while the bucket is only
                      // the taste — the moment somebody has BOUGHT time, calling
                      // it a gift is a small lie.
                      m.credits > 0
                      ? "left on the meter"
                      : "left on the house"
                    : "the taste is used up"}
            </span>
          </div>
          <span className="text-[13px] tabular-nums text-muted">
            {isOwner
              ? ""
              : subscribed
                ? `${buys(m.planLeft) || "nothing"} left this month`
                : m.spent > 0
                  ? `used ${fmtTokens(m.spent)} units ≈ $${(spentCents / 100).toFixed(2)}, ever`
                  : `${fmtTokens(m.creditsLeft)} units to start`}
          </span>
        </div>
        {!isOwner && (
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                (m.remaining ?? 0) <= 0
                  ? "bg-red-400/80"
                  : "bg-gradient-to-r from-accent to-accent-strong"
              }`}
              style={{
                width: `${
                  subscribed
                    ? monthPct
                    : Math.min(
                        100,
                        (m.spent / (m.taste + m.credits || 1)) * 100,
                      )
                }%`,
              }}
            />
          </div>
        )}
        {(subscribed || legacy) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={() => go("/api/billing/portal", undefined, "portal")}
              disabled={!!busy}
              className="text-[13px] text-muted/70 transition hover:text-foreground disabled:opacity-40"
            >
              {busy === "portal" ? (
                <span className="shimmer-text">Opening billing…</span>
              ) : (
                "Manage — change or cancel"
              )}
            </button>
            <span className="text-[12px] text-muted/50">
              The month refills on the 1st. Cancel any time; everything you’ve
              made stays yours.
            </span>
          </div>
        )}
        {!subscribed && !isOwner && m.credits > 0 && (
          <p className="mt-4 text-[12px] text-muted/50">
            You have {fmtTokens(m.creditsLeft)} units of prepaid machine time
            left from before. It never expires, and a plan doesn’t touch it —
            it waits underneath.
          </p>
        )}
      </section>

      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}

      {/* THE SHELF — two prices, and what each month buys. */}
      {!isOwner && (
        <section className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {TIERS.map((t, i) => {
              const mine = m.plan === t.id;
              const hot = t.id === "studio";
              return (
                <div
                  key={t.id}
                  style={{ "--i": i } as CSSProperties}
                  className={`animate-rise flex flex-col rounded-[22px] border bg-gradient-to-b p-5 transition duration-300 hover:-translate-y-0.5 ${
                    hot
                      ? "border-accent/35 from-accent/[0.08] to-white/[0.015] shadow-[0_0_70px_-26px_rgba(224,49,156,.6)]"
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
                      className={`wordmark text-[34px] leading-none ${hot ? "text-gradient" : "text-foreground"}`}
                    >
                      ${t.usd}
                    </span>
                    <span className="text-[13px] text-muted/60">/month</span>
                  </div>
                  {/* WHAT A MONTH BUYS — the headline, in the words people use.
                      The unit count sits under it, small, for anyone checking. */}
                  <p className="mt-3.5 text-[13.5px] leading-relaxed text-foreground/85">
                    {buys(t.tokens)} — every month.
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted/60">
                    {t.blurb}
                  </p>
                  <span className="mt-1.5 text-[11px] tabular-nums text-muted/45">
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
                        : hot
                          ? "btn-primary"
                          : "bg-white/[0.08] text-foreground hover:bg-white/[0.14]"
                    }`}
                  >
                    {busy === t.id ? (
                      <span className="shimmer-text">Opening checkout…</span>
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
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            No card to look around, and no clock on the free taste — it waits
            until you use it. Cancel any time; the instrument, your songs and
            everything you’ve written stay exactly where they are.
          </p>
        </section>
      )}

      {/* THE OVERFLOW VALVE — quiet on purpose. A plan is the product; this is
          for the night that ran long. */}
      {!isOwner && (
        <section className="mt-10 rounded-[22px] border border-white/[0.06] bg-white/[0.015] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-medium text-foreground/85">
              Ran long?
            </h2>
            <span className="text-[12.5px] tabular-nums text-muted/60">
              a dollar is {fmtTokens(tokensForUsdCents(100))} units — flat,
              every time
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted/70">
            Extra machine time, for when a month runs out before it ends. It
            never expires, and the plan’s month is always spent first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CREDIT_PACK_USD.map((usd) => {
              const fee = cardFeeCents(usd * 100);
              return (
                <button
                  key={usd}
                  onClick={() => go("/api/billing/checkout", { usd }, String(usd))}
                  disabled={!!busy}
                  title={`${fmtTokens(tokensForUsdCents(usd * 100))} units · +${(fee / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} card fee`}
                  className="rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] text-foreground/85 transition hover:border-white/[0.2] hover:bg-white/[0.08] active:scale-[.98] disabled:opacity-40"
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
              );
            })}
          </div>
          <p className="mt-3.5 text-[12px] leading-relaxed text-muted/50">
            The card fee is Stripe’s, passed through to the cent — shown before
            you tap and itemised inside checkout. The rate follows the model’s
            own: it launched at $10 a million and halved to $5 the day a
            cheaper composer took over. The whole sheet is open code.
          </p>
        </section>
      )}
    </main>
  );
}
