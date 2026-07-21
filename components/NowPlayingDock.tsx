"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  dockPause,
  dockResume,
  dockStop,
  noSession,
  nowPlaying,
  subscribeNowPlaying,
} from "@/lib/now-playing";

/**
 * THE DOCK — the music, riding along, the moment you leave the page that's
 * playing (the owning page IS the player, so we hide there). Space = pause
 * anywhere the dock shows.
 *
 * TWO looks, one behaviour:
 *  • DESKTOP (sm+) — the original floating glass pill (unchanged; loved as-is).
 *  • MOBILE — a full-bleed bar flush to the screen's left/right/bottom edges,
 *    wearing the song's OWN one-pink light as its "cover" (no album art exists —
 *    the aura IS the art): it BREATHES while playing, dims while held.
 */

/** The Sets mark — pink headphones. Identity, not liveness (dims but never leaves). */
function SetGlyph({ dim }: { dim: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#dock-hp)"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={`shrink-0 transition-opacity duration-300 ${dim ? "opacity-40" : "opacity-100"}`}
    >
      <defs>
        <linearGradient id="dock-hp" gradientUnits="userSpaceOnUse" x1="3" y1="5" x2="21" y2="20">
          <stop offset="0" stopColor="#ff63c1" />
          <stop offset="1" stopColor="#e0319c" />
        </linearGradient>
      </defs>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13.2" width="4.6" height="6.8" rx="2.3" />
      <rect x="16.4" y="13.2" width="4.6" height="6.8" rx="2.3" />
    </svg>
  );
}

/** Three breathing bars — the sign the music is alive. Colour via `bg-current`. */
function EqBars({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-end gap-[2.5px] ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[2.5px] rounded-full bg-current"
          style={{ height: "100%", animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

const PlayGlyph = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.2v13.6L19 12z" />
  </svg>
);
const PauseGlyph = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
    <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
  </svg>
);
const CloseGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default function NowPlayingDock() {
  const np = useSyncExternalStore(subscribeNowPlaying, nowPlaying, noSession);

  // SPACE, everywhere: while the dock is the visible player (owning page not
  // mounted), the spacebar holds and releases the music from ANY page. Typing
  // is sacred — never intercept inside a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== "Space" && e.key !== " ") || e.repeat) return;
      const s = nowPlaying();
      if (!s || s.surfaceMounted) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (
        t &&
        (t.isContentEditable ||
          t.closest("input, textarea, select, [contenteditable='true']"))
      )
        return;
      e.preventDefault();
      if (s.paused) void dockResume();
      else dockPause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!np || np.surfaceMounted) return null;

  const playing = !np.paused;
  const toggle = () => (np.paused ? void dockResume() : dockPause());

  return (
    <>
      {/* ───────────────── DESKTOP (sm+) — the original floating pill ───────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-50 hidden justify-center px-4 sm:flex">
        <div className="cmdbar-in pointer-events-auto flex w-full max-w-[22rem] items-center gap-2.5 rounded-full border border-white/[0.09] bg-[#16111c]/90 py-1.5 pl-1.5 pr-1.5 shadow-[0_30px_90px_-26px_rgba(0,0,0,.95),0_0_44px_-14px_rgba(224,49,156,.45),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl">
          <button
            onClick={toggle}
            aria-label={np.paused ? "Resume" : "Pause"}
            title={np.paused ? "Resume" : "Pause"}
            className="group/orb relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-transform duration-200 hover:scale-[1.06] active:scale-95"
          >
            <span
              aria-hidden
              className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
                np.paused
                  ? "shadow-[0_8px_22px_-8px_rgba(224,49,156,.8),inset_0_1px_0_rgba(255,255,255,.3)]"
                  : "shadow-[0_0_24px_-2px_rgba(224,49,156,.85),inset_0_1px_0_rgba(255,255,255,.3)]"
              }`}
            />
            <span className="relative">{np.paused ? <PlayGlyph size={13} /> : <PauseGlyph size={12} />}</span>
          </button>
          <Link
            href={np.href}
            className="group/back flex min-w-0 flex-1 items-center gap-2.5 py-1"
            title="Back to the music"
          >
            {np.kind === "set" ? <SetGlyph dim={np.paused} /> : !np.paused && <EqBars className="h-3 text-accent-strong" />}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium leading-tight text-foreground/90 transition group-hover/back:text-foreground">
                {np.title}
              </span>
              <span className="block truncate text-[11px] leading-tight text-muted/60">
                {[np.kind === "set" ? "Set" : "Song", np.paused ? "Paused" : np.sectionLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
          <button
            onClick={dockStop}
            aria-label="Stop the music"
            title="Stop"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted/50 transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
          >
            <CloseGlyph />
          </button>
        </div>
      </div>

      {/* ───────── MOBILE — full-bleed; the song's light glowing THROUGH the glass ───────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 sm:hidden">
        <div
          className="cmdbar-in pointer-events-auto relative overflow-hidden border-t border-white/[0.07] bg-[#0b0810]/72 backdrop-blur-2xl"
          style={{
            boxShadow:
              "0 -22px 60px -30px rgba(0,0,0,.92), inset 0 1px 0 rgba(255,255,255,.06)",
          }}
        >
          {/* a faint warmth rising from the base — ambient, breathing while it plays */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${playing ? "glow-breathe" : "opacity-30"}`}
            style={{
              background:
                "radial-gradient(120% 150% at 50% 150%, rgba(255,99,193,.12), transparent 70%)",
            }}
          />
          {/* a filament of light along the top edge */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,.14) 40%, rgba(255,99,193,.28) 80%, transparent)",
            }}
          />

          <div
            className="relative flex items-center gap-3.5 px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {/* what's playing — the words are the way back into the player */}
            <Link href={np.href} title="Back to the music" className="group/back min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-white/95 transition group-hover/back:text-white">
                {np.title}
              </span>
              <span className="mt-1 block truncate text-[11px] font-medium uppercase leading-tight tracking-[0.14em] text-muted/50">
                {np.kind === "set" ? "Set" : "Song"}
                {playing && np.sectionLabel ? (
                  <span className="ml-1.5 tracking-[0.1em] text-accent-strong/70">{np.sectionLabel}</span>
                ) : (
                  <span className="ml-1.5">{playing ? "" : "Paused"}</span>
                )}
              </span>
            </Link>

            {/* the control */}
            <button
              onClick={toggle}
              aria-label={np.paused ? "Resume" : "Pause"}
              title={np.paused ? "Resume" : "Pause"}
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/90 transition hover:bg-white/[0.09] hover:text-white active:scale-95"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
            >
              {np.paused ? <PlayGlyph size={17} /> : <PauseGlyph size={15} />}
            </button>

            <button
              onClick={dockStop}
              aria-label="Stop the music"
              title="Stop"
              className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted/40 transition hover:bg-white/[0.06] hover:text-foreground/80 active:scale-90"
            >
              <CloseGlyph />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
