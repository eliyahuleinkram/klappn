"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import DoorGallery, { type DoorSong } from "@/components/DoorGallery";

/**
 * SIGN-IN — a 6-digit CODE, not a link (2026-07-10). A magic link opens in the
 * DEFAULT browser: start in Chrome, tap in Gmail, get signed in over in Safari
 * while Chrome waits forever. A code has no browser — you type it exactly where
 * you are, and the door opens THERE. (The server still honors old magic links.)
 *
 * Below the form: THE DOOR — owner-curated songs that play right here, whole,
 * before any account exists. The proof is the pitch.
 */
export default function SignIn({ door = [] }: { door?: DoorSong[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  // A playing song's own picture is up — the ambient glow steps aside for it
  // (same yield as home's aura).
  const [visualUp, setVisualUp] = useState(false);
  const [state, setState] = useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  // Resend cooldown ticker (only while the gate is up).
  useEffect(() => {
    if (state !== "sent" && state !== "verifying") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const to = email.trim();
    if (!to) return;
    setState("sending");
    setCodeError(null);
    // better-fetch REJECTS on a network-level failure (offline/DNS/abort) rather
    // than resolving `{error}`; without this catch the button hangs on "Sending…"
    // forever with no recovery.
    let error: unknown;
    try {
      ({ error } = await authClient.emailOtp.sendVerificationOtp({
        email: to,
        type: "sign-in",
      }));
    } catch {
      error = true;
    }
    if (error) {
      setState("error");
      return;
    }
    setCode("");
    setResendAt(Date.now() + 30_000);
    setState("sent");
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(otp: string) {
    setState("verifying");
    setCodeError(null);
    // Same network-rejection hazard as send() — a thrown fetch here would strand
    // the code input disabled on "Opening the door…" with no way back.
    let error: unknown;
    try {
      ({ error } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
      }));
    } catch {
      error = true;
    }
    if (error) {
      setState("sent");
      setCode("");
      setCodeError("That's not it — check the newest email.");
      setTimeout(() => codeRef.current?.focus(), 50);
      return;
    }
    router.refresh();
  }

  function onCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setCodeError(null);
    if (digits.length === 6) void verify(digits);
  }

  const gateUp = state === "sent" || state === "verifying";
  const canResend = now >= resendAt;

  // THE DOOR — when curated songs exist, the signed-out page IS the
  // instrument: the visual owns the room, the orb and deck hold the center,
  // the brand signs the corner, and the ask is one glass bar at the bottom.
  // A different flavor from the app on purpose: fullscreen, cinematic, alive.
  if (door.length > 0) {
    return (
      <main className="relative flex flex-1 flex-col overflow-x-clip px-6">
        {/* ambient glow — yields the moment a picture holds the room */}
        <div
          aria-hidden
          className={`glow-breathe pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-[1400ms] ease-out ${
            visualUp ? "opacity-0" : "opacity-100"
          }`}
          style={{
            background:
              "radial-gradient(closest-side, rgba(224,49,156,.14), rgba(168,85,247,.05) 55%, transparent 75%)",
          }}
        />
        {/* legibility scrims — the picture burns near-full behind (door-stage);
            the words float on soft gradients, never on panels */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.32),transparent_24%,transparent_58%,rgba(0,0,0,.58))]"
        />
        {/* the brand signs the corner — the room belongs to the music */}
        <div className="relative z-10 flex items-center gap-2.5 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            aria-hidden
            className="h-8 w-8 select-none shadow-[0_8px_28px_-8px_rgba(224,49,156,.65)]"
            style={{ borderRadius: "7px" }}
            draggable={false}
          />
          <span className="wordmark text-[22px] tracking-tight text-foreground">
            Klappn
          </span>
        </div>

        {/* The gallery scatters its boxes across the WHOLE page (fixed field);
            the doorway holds the bottom centre — the sky's one clear landing. */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-end py-6">
          <DoorGallery songs={door} onVisual={setVisualUp} />

          {/* THE DOOR ITSELF — a pink-lit doorway; the key is one email. */}
          <div className="mt-5 w-full max-w-xl sm:mt-9">
          <div className="rounded-3xl border border-accent/20 bg-black/50 p-4 shadow-[0_0_70px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl">
            {gateUp ? (
              <>
                <p className="select-none text-[13.5px] leading-relaxed text-muted">
                  A 6-digit code is in your inbox — sent to{" "}
                  <span className="text-foreground/80">{email.trim()}</span>.
                  Type it and you&rsquo;re in.
                </p>
                <input
                  ref={codeRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => onCode(e.target.value)}
                  placeholder="••••••"
                  disabled={state === "verifying"}
                  className="mt-3 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-[22px] font-semibold tracking-[0.45em] text-foreground outline-none transition placeholder:text-muted/30 focus:border-accent/45 focus:shadow-[0_0_40px_-14px_rgba(224,49,156,.55)] disabled:opacity-60"
                />
                {state === "verifying" && (
                  <p className="mt-2 text-[13px] text-muted">
                    <span className="shimmer-text">Opening the door…</span>
                  </p>
                )}
                {codeError && (
                  <p className="mt-2 text-[13px] text-red-400">{codeError}</p>
                )}
                <div className="mt-2.5 flex items-center justify-between text-[13px]">
                  <button
                    onClick={() => {
                      setState("idle");
                      setCode("");
                      setCodeError(null);
                    }}
                    className="text-muted transition hover:text-foreground"
                  >
                    Different email
                  </button>
                  <button
                    onClick={() => canResend && void send()}
                    disabled={!canResend}
                    className="text-muted transition hover:text-foreground disabled:opacity-40"
                  >
                    {canResend
                      ? "Send it again"
                      : `Send again in ${Math.ceil((resendAt - now) / 1000)}s`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="select-none text-[13.5px] leading-relaxed text-muted">
                  Type a sentence. Klappn writes all of this —{" "}
                  <span className="text-foreground/85">yours to keep.</span>
                </p>
                <form onSubmit={send} className="mt-3 flex flex-col gap-2.5 sm:mt-3.5 sm:flex-row sm:gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 rounded-2xl border border-white/[0.12] bg-black/50 px-4 py-3 text-[15px] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.08)] outline-none backdrop-blur-xl transition placeholder:text-muted/50 focus:border-accent/45 focus:shadow-[0_0_40px_-14px_rgba(224,49,156,.55)] sm:rounded-xl sm:py-2.5"
                  />
                  <button
                    type="submit"
                    disabled={state === "sending"}
                    className="btn-primary w-full shrink-0 rounded-2xl px-5 py-3 text-[15px] font-semibold transition active:scale-[.98] disabled:opacity-50 sm:w-auto sm:rounded-xl sm:py-2.5"
                  >
                    {state === "sending" ? "Sending…" : "Sign in"}
                  </button>
                </form>
                <p className="mt-2 select-none text-[12px] text-muted/60">
                  No password — a 6-digit code lands in your inbox.
                </p>
                {state === "error" && (
                  <p className="mt-2 text-[13px] text-red-400">
                    Couldn&rsquo;t send the code. Try again.
                  </p>
                )}
              </>
            )}
          </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    // my-auto (not items-center) so a door-tall column scrolls instead of
    // clipping its top inside the old overflow-hidden centering
    <main className="relative flex flex-1 justify-center overflow-x-clip px-6 py-16">
      {/* ambient glow — the room the brand sits in, not a decoration on it.
          It fades when a playing song mounts its own picture. */}
      <div
        aria-hidden
        className={`glow-breathe pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-[58%] rounded-full transition-opacity duration-[1400ms] ease-out ${
          visualUp ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background:
            "radial-gradient(closest-side, rgba(224,49,156,.16), rgba(168,85,247,.06) 55%, transparent 75%)",
        }}
      />
      <div className="relative my-auto w-full max-w-[20rem]">
        {/* the mark — steel K on its tile, floating on its own glow */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg"
          alt=""
          aria-hidden
          className="animate-rise h-12 w-12 select-none shadow-[0_10px_36px_-10px_rgba(224,49,156,.65)]"
          style={{ borderRadius: "10.5px", "--i": 0 } as React.CSSProperties}
          draggable={false}
        />
        <h1
          className="wordmark text-gradient animate-rise mt-7 text-[64px] leading-[0.92] tracking-tight sm:text-[76px]"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Klappn
        </h1>
        <p
          className="animate-rise mt-5 text-[16px] leading-relaxed text-muted"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Build a track, one loop at a time.
        </p>

        {gateUp ? (
          <div className="animate-rise mt-10 rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
            <p className="text-[15px] font-medium text-accent-strong">
              A 6-digit code is in your inbox.
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Sent to <span className="text-foreground/80">{email.trim()}</span> —
              type it here and you&rsquo;re in.
            </p>
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => onCode(e.target.value)}
              placeholder="••••••"
              disabled={state === "verifying"}
              className="mt-4 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 text-center text-[26px] font-semibold tracking-[0.45em] text-foreground outline-none transition placeholder:text-muted/30 focus:border-accent/45 focus:shadow-[0_0_40px_-14px_rgba(224,49,156,.55)] disabled:opacity-60"
            />
            {state === "verifying" && (
              <p className="mt-2 text-[13px] text-muted">
                <span className="shimmer-text">Opening the door…</span>
              </p>
            )}
            {codeError && (
              <p className="mt-2 text-[13px] text-red-400">{codeError}</p>
            )}
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <button
                onClick={() => {
                  setState("idle");
                  setCode("");
                  setCodeError(null);
                }}
                className="text-muted transition hover:text-foreground"
              >
                Different email
              </button>
              <button
                onClick={() => canResend && void send()}
                disabled={!canResend}
                className="text-muted transition hover:text-foreground disabled:opacity-40"
              >
                {canResend
                  ? "Send it again"
                  : `Send again in ${Math.ceil((resendAt - now) / 1000)}s`}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={send}
            className="animate-rise mt-10 space-y-3"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3.5 text-[16px] text-foreground outline-none transition placeholder:text-muted/45 focus:border-accent/40 focus:bg-white/[0.07] focus:shadow-[0_0_40px_-14px_rgba(224,49,156,.55)]"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="btn-primary w-full rounded-2xl px-4 py-3.5 text-[16px] font-medium transition active:scale-[.99] disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Continue with email"}
            </button>
            {state === "error" && (
              <p className="text-[13px] text-red-400">
                Couldn&rsquo;t send the code. Try again.
              </p>
            )}
            <p className="pt-1 text-[12px] leading-relaxed text-muted/50">
              A 6-digit code lands in your inbox — no password, no setup.
            </p>
          </form>
        )}

      </div>
    </main>
  );
}
