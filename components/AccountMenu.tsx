"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * ACCOUNT MENU — one avatar, everything about YOU behind a click (the email
 * never sits in the open for anyone glancing over). Born on klappn.com's
 * home; the zaltz IDE wears the exact same one (user 2026-07-27: "it must
 * look the same"). Menu: email · Plan & usage (/billing) · Sign out — or
 * the guest's claim path, or a sign-in door when nobody's home yet.
 */
export default function AccountMenu({
  email,
  isGuest = false,
  signedIn = true,
  alert = false,
  onSignOut,
  onSignIn,
}: {
  email?: string | null;
  isGuest?: boolean;
  /** false = no session at all (the IDE before the first touch). */
  signedIn?: boolean;
  /** The wallet's on fire (spent) — the avatar burns until it's fed. */
  alert?: boolean;
  onSignOut: () => void;
  /** Signed-out only: where the "Sign in" item leads (the IDE opens its sheet). */
  onSignIn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initial = !signedIn
    ? "you"
    : isGuest
      ? "✦"
      : (email?.trim()?.[0] || "?").toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account"
        aria-label="Account"
        className={`flex h-8 w-8 items-center justify-center rounded-full font-medium transition ${
          !signedIn ? "text-[10px] lowercase" : "text-[13px]"
        } ${
          alert
            ? "animate-pulse bg-accent/[0.18] text-accent-strong ring-2 ring-accent/60 shadow-[0_0_44px_-10px_rgba(224,49,156,.9)]"
            : isGuest
              ? "bg-accent/[0.12] text-accent-strong hover:bg-accent/[0.2]"
              : "bg-white/[0.06] text-foreground/80 hover:bg-white/[0.1] hover:text-foreground"
        }`}
      >
        {initial}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/95 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
            {!signedIn ? (
              <div className="px-3 py-2 text-[12px] leading-relaxed text-muted/70">
                The instrument is free — a session appears the moment you touch
                the machine.
              </div>
            ) : isGuest ? (
              <div className="px-3 py-2 text-[12px] leading-relaxed text-muted/70">
                Walking in as a guest — your work lives in this browser until you
                claim it.
              </div>
            ) : (
              email && (
                <div
                  className="truncate px-3 py-2 text-[12px] text-muted/70"
                  title={email}
                >
                  {email}
                </div>
              )
            )}
            {signedIn && (
              <Link
                href="/billing"
                className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
              >
                Plan &amp; usage
              </Link>
            )}
            {!signedIn ? (
              onSignIn && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignIn();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-accent-strong transition hover:bg-accent/[0.08]"
                >
                  Sign in
                </button>
              )
            ) : isGuest ? (
              <Link
                href="/claim"
                className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-accent-strong transition hover:bg-accent/[0.08]"
              >
                ✦ Claim your work
              </Link>
            ) : (
              <button
                onClick={onSignOut}
                className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
              >
                Sign out
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
