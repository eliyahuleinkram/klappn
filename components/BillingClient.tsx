"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  TOKENS_PER_LOOP,
  tokensForUsdCents,
  USD_CENTS_PER_MILLION,
} from "@/lib/pricing";

/**
 * Tokens page (the prepaid-token pivot). One promise, stated in numbers: the
 * price is a public number in lib/pricing.ts, shown here in real token counts
 * and real dollars — the old tier grid and its opaque "loops only" posture are
 * gone. Loops stay as the friendly estimate beside the real figure, never
 * instead of it.
 */

// Legacy subscription display only — these tiers are no longer purchasable;
// existing subscribers keep them until they cancel (portal below).
const LEGACY_PLANS: Record<string, { name: string; usd: number }> = {
  creator: { name: "Creator", usd: 12 },
  studio: { name: "Studio", usd: 39 },
  label: { name: "Label", usd: 129 },
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000)
    return `${(Math.round(n / 100_000) / 10).toLocaleString()}M`;
  return `${Math.round(n / 1000)}k`;
}

function fmtLoops(n: number): string {
  const oneDp = Math.round(n * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

/* The pack row is a heat ladder — the pink climbs with the amount and the
 * top card burns hottest, but the pink BUTTON stays on the everyday anchor
 * ($10): the glow sells the ceiling, the button sells the anchor. One pink
 * only; every glow is the accent family. */
const PACK_HEAT: Record<number, string> = {
  5: "border-white/[0.07] from-white/[0.05] to-white/[0.015] hover:border-white/[0.14]",
  10: "border-accent/30 from-accent/[0.06] to-white/[0.015] shadow-[0_0_55px_-26px_rgba(224,49,156,.55)] hover:shadow-[0_0_75px_-24px_rgba(224,49,156,.7)]",
  25: "border-accent/40 from-accent/[0.09] to-white/[0.015] shadow-[0_0_65px_-24px_rgba(224,49,156,.65)] hover:shadow-[0_0_85px_-22px_rgba(224,49,156,.8)]",
  50: "border-accent/50 from-accent/[0.13] to-accent/[0.02] shadow-[0_0_80px_-22px_rgba(224,49,156,.8)] hover:shadow-[0_0_100px_-18px_rgba(224,49,156,.9)]",
};

export default function BillingClient({
  plan,
  usedTokens,
  allowanceTokens,
  credits,
}: {
  plan: string;
  usedTokens: number;
  allowanceTokens: number;
  credits: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = plan === "owner";
  const legacy = LEGACY_PLANS[plan] ?? null;
  const remaining = Math.max(0, allowanceTokens - usedTokens);
  const pct = Math.min(100, (usedTokens / (allowanceTokens || 1)) * 100);
  // Lifetime spend in real dollars — usage × the same public rate.
  const spentCents = (usedTokens / 1_000_000) * USD_CENTS_PER_MILLION;

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
      };
      if (!res.ok || !d.url) {
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
          Loops
        </Link>
      </div>

      <header className="mt-12">
        <h1 className="wordmark text-gradient text-[40px] leading-[0.95] tracking-tight sm:text-[54px]">
          Tokens
        </h1>
        <p className="mt-2.5 text-[15px] text-muted">
          One flat number, prepaid, never expiring — the whole price sheet
          is a screen of open code.{" "}
          <Link
            href="/open"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            Here’s the whole deal
          </Link>
          .
        </p>
      </header>

      {/* balance */}
      <section className="animate-rise mt-9 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <span
              className={`wordmark text-[30px] leading-none ${
                isOwner || remaining > 0 ? "text-gradient" : "text-foreground"
              }`}
            >
              {isOwner ? "∞" : fmtTokens(remaining)}
            </span>
            <span className="text-[13px] text-muted/60">
              {isOwner
                ? "house account — unmetered"
                : `tokens left · ~${fmtLoops(remaining / TOKENS_PER_LOOP)} loops`}
            </span>
          </div>
          <span className="text-[13px] tabular-nums text-muted">
            {legacy
              ? `${legacy.name} — $${legacy.usd}/month, resets monthly`
              : credits > 0
                ? `spent ${fmtTokens(usedTokens)} ≈ $${(spentCents / 100).toFixed(2)}, ever`
                : `free taste — ${fmtTokens(allowanceTokens)} tokens, once`}
          </span>
        </div>
        {!isOwner && (
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                pct >= 100
                  ? "bg-red-400/80"
                  : "bg-gradient-to-r from-accent to-accent-strong"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {legacy && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={() => go("/api/billing/portal", undefined, "portal")}
              disabled={!!busy}
              className="text-[13px] text-muted/70 transition hover:text-foreground disabled:opacity-40"
            >
              {busy === "portal" ? (
                <span className="shimmer-text">Opening billing…</span>
              ) : (
                "Manage subscription"
              )}
            </button>
            <span className="text-[12px] text-muted/50">
              Monthly plans are retired — cancel any time and switch to
              the token top-ups below. Nothing you’ve made goes anywhere.
            </span>
          </div>
        )}
      </section>

      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}

      {/* top-ups — flat rate, no bulk games */}
      {!isOwner && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium text-foreground">Top up</h2>
            <span className="text-[13px] tabular-nums text-muted">
              ${(USD_CENTS_PER_MILLION / 100).toFixed(0)} per 1M tokens —
              flat, every pack
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CREDIT_PACK_USD.map((usd, i) => {
              const tokens = tokensForUsdCents(usd * 100);
              const fee = cardFeeCents(usd * 100);
              const anchor = usd === 10; // the everyday amount gets the pink CTA
              const hottest = usd === CREDIT_PACK_USD[CREDIT_PACK_USD.length - 1];
              return (
                <div
                  key={usd}
                  style={{ "--i": i } as CSSProperties}
                  className={`animate-rise flex flex-col rounded-[22px] border bg-gradient-to-b p-4 transition duration-300 hover:-translate-y-0.5 ${PACK_HEAT[usd] ?? PACK_HEAT[5]}`}
                >
                  <span
                    className={`wordmark text-[26px] leading-none ${
                      hottest ? "text-gradient" : "text-foreground"
                    }`}
                  >
                    ${usd}
                  </span>
                  <span className="mt-1.5 text-[13px] text-foreground/80">
                    {fmtTokens(tokens)} tokens
                  </span>
                  <span className="text-[12px] text-muted">
                    ~{Math.floor(tokens / TOKENS_PER_LOOP)} loops
                  </span>
                  {/* the fee is legible BEFORE the tap — never a surprise at checkout */}
                  <span className="mt-0.5 text-[11px] tabular-nums text-muted/60 pointer-coarse:text-muted/75">
                    + {(fee / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}{" "}
                    card fee
                  </span>
                  <button
                    onClick={() =>
                      go("/api/billing/checkout", { usd }, String(usd))
                    }
                    disabled={!!busy || !!legacy}
                    className={`mt-4 w-full rounded-full px-3 py-2 text-[13px] font-medium transition active:scale-[.98] disabled:opacity-40 ${
                      // Pink CTA on the ANCHOR, never the ceiling — a hot
                      // button on the priciest pack reads as pressure.
                      anchor
                        ? "btn-primary"
                        : hottest
                          ? "bg-accent/[0.14] text-foreground hover:bg-accent/[0.22]"
                          : "bg-white/[0.06] text-foreground hover:bg-white/[0.1]"
                    }`}
                  >
                    {busy === String(usd) ? (
                      <span className="shimmer-text">Opening checkout…</span>
                    ) : (
                      "Top up"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Tokens never expire. The card fee is Stripe’s, passed through to
            the cent — we add nothing and keep nothing. The price is one you
            can read — the whole sheet is open code, and if it ever moves,
            it moves in the open.
          </p>
        </section>
      )}
    </main>
  );
}
