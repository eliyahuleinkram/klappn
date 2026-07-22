"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { openDeep } from "@/lib/seal";
import type { SetPlan } from "@/lib/sets";
import type { PartRow, SongRow } from "@/lib/songs";
import {
  applyOrbitGains,
  enableBackgroundPlayback,
  loopCycles,
  playSong,
  setVisuals,
  stop,
  teardownVisuals,
} from "@/lib/strudel-client";
import {
  clearNowPlaying,
  dockPause,
  dockResume,
  dockStop,
  nowPlaying,
  publishNowPlaying,
  updateNowPlaying,
} from "@/lib/now-playing";
import { useNowPlayingValue } from "@/lib/use-now-playing";
import {
  buildSetSections,
  channelOfOrbit,
  decorateSetSection,
  PERF_ZERO,
  sectionHoldTarget,
  setHasVisual,
  setSectionLabel,
  type SetLiveCtx,
} from "@/lib/set-live";
import { useIsMobile } from "@/lib/use-is-mobile";

interface SetCard {
  id: string;
  title: string;
  songCount: number;
  songTitles: string[];
}

/** The sets library: every set as a card (open to arrange/perform), plus
 *  one-tap create. Deliberately thin — the set page is where the work happens.
 *  Each card carries a play orb (like the loops on home): the WHOLE set plays
 *  right here — loops, breaks, hand-offs, saved repeats, everything the deck
 *  would play, just with the dials at zero. The dock carries it anywhere, and
 *  opening the set page adopts the running performance into the full deck. */
export default function SetsClient({ initialSets }: { initialSets: SetCard[] }) {
  const router = useRouter();
  // Sets PERFORM on a computer (the deck, the dials, live audio streaming from
  // the DJ's machine). On a phone the card orb opens the set to build/arrange
  // rather than launching it. See SetClient for the same rule at the deck.
  const isMobile = useIsMobile();
  const [sets, setSets] = useState(initialSets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // --- inline set playback (mirrors home's per-card song playback) -----------
  const [loadingPlay, setLoadingPlay] = useState<string | null>(null);
  const ctxCache = useRef(new Map<string, SetLiveCtx>());
  // ENGINE-MEASURED loop periods, keyed `partId:codeLength` — the same truth the
  // song page plays by. buildSetSections falls back to the regex estimate until
  // a measurement lands; the sequencer's watcher then picks the new boundary up
  // seamlessly. (The estimate over-counts repeating slowcat elements — sets were
  // holding loops well past their real length.)
  const measuredBarsRef = useRef<Record<string, number>>({});
  const barsForPart = (p: PartRow): number | undefined =>
    measuredBarsRef.current[`${p.id}:${(p.strudel || "").length}`];
  function measureCtx(c: SetLiveCtx): void {
    void (async () => {
      for (const b of Object.values(c.songs)) {
        for (const p of b?.parts ?? []) {
          const code = p.strudel;
          if (!code?.trim()) continue;
          const key = `${p.id}:${code.length}`;
          if (measuredBarsRef.current[key]) continue;
          const n = await loopCycles(code);
          if (n && n > 0) measuredBarsRef.current[key] = n;
        }
      }
    })();
  }
  // Leaving the page: a live session — started HERE or riding along — keeps
  // sounding (the dock carries it). Only a silent page tears the engine down.
  useEffect(
    () => () => {
      if (!nowPlaying()) {
        stop();
        teardownVisuals();
      }
    },
    [],
  );
  // This page never OWNS a session (the set page does), so the dock is up
  // whenever something plays from here — and the session store IS the cards'
  // playing state: a set lights up whether it was started here, or it's the
  // one riding along in the dock. No local copy to fall out of sync.
  // Two PRIMITIVES, never the session object: sectionLabel ticks at every boundary of
  // the playing set, and a whole-session subscription would re-render this un-memoized
  // list on the thread the scheduler ticks on. (Same rule as HomeClient.)
  const playingId = useNowPlayingValue((s) => (s?.kind === "set" ? s.id : null), null);
  const paused = useNowPlayingValue((s) => s?.kind === "set" && !!s.paused, false);

  async function onPlaySet(s: SetCard) {
    // Tap the sounding card = HOLD; tap again = carry on. (The dock's ✕ is the one
    // true stop — that's what releases the kill gates and tears the canvas down.)
    // BEFORE the mobile gate: a set sounding on a phone is still sounding, and this
    // orb is wearing a ❚❚. An icon you can see is an icon that must do what it says.
    if (playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (isMobile) {
      // No STARTING a performance on a phone — open the set to build/arrange it instead.
      router.push(`/set/${s.id}`);
      return;
    }
    if (loadingPlay) return;
    // Only tear down playback if THIS call actually took over the dock — a fetch
    // or build failure before we publish must not stop a foreign session (a song
    // from home, another set) that happens to be riding in the dock.
    let started = false;
    try {
      let ctx = ctxCache.current.get(s.id);
      if (!ctx) {
        setLoadingPlay(s.id);
        const res = await fetch(`/api/sets/${s.id}`, { cache: "no-store" });
        // The bundle arrives SEALED (lib/seal.ts) — open it; pass-through if unsealed.
        const d = openDeep(
          (await res.json().catch(() => null)) as {
            set?: { plan?: SetPlan };
            songs?: { song: SongRow; parts: PartRow[] }[];
          } | null,
        );
        if (!d?.set) {
          setLoadingPlay(null);
          setError("Couldn’t load that set.");
          return;
        }
        ctx = {
          entries: d.set.plan?.entries ?? [],
          songs: Object.fromEntries((d.songs ?? []).map((b) => [b.song.id, b])),
          transitions: d.set.plan?.transitions ?? {},
        };
        ctxCache.current.set(s.id, ctx);
        setLoadingPlay(null);
      }
      const c = ctx;
      measureCtx(c); // kick the real-period measurements; boundaries refine live
      const sections = buildSetSections(c, barsForPart);
      if (sections.length === 0) {
        setError("That set has nothing to play yet — its songs are still empty.");
        return;
      }
      // A previous set session's kill gates must never mute this one — open
      // every channel bus before the first section lands.
      applyOrbitGains((orbit) => (channelOfOrbit(orbit) ? 1 : undefined));
      // The set's own backdrop if any song carries one (canonical plan.visual
      // included — decorateSetSection grafts it onto every section, like home);
      // a visual-less set must not play under the previous music's picture.
      if (setHasVisual(c)) setVisuals(true);
      else teardownVisuals();
      // Screen-off survival: become a real media player (lock screen included).
      void enableBackgroundPlayback({ title: s.title });
      // The performance belongs to the APP — this page isn't its owning surface,
      // so the dock appears right here; opening the set page adopts it.
      started = true;
      publishNowPlaying({
        kind: "set",
        id: s.id,
        href: `/set/${s.id}`,
        title: s.title,
        sectionLabel: setSectionLabel(sections[0].id, c),
        paused: false,
        surfaceMounted: false,
      });
      // The deck's dials at zero — but the songs' SAVED repeats play exactly as
      // arranged on their song pages, and every transform (tempo, key, channel
      // orbits) rides the same shared decorate as the deck and live listeners.
      const dials = { nudge: 0, perf: PERF_ZERO };
      await playSong(sections, {
        owner: s.id, // the set owns the program — anything else playing is cut, not crossfaded
        sectionsFor: () => buildSetSections(c, barsForPart),
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: setSectionLabel(id, c) });
        },
        decorate: (code, id) => decorateSetSection(code, id, c, dials),
        // HOLD is a pure LEVEL, polled at any frequency — only an ∞ latch pins
        // its section. Finite saved repeats (2×/4×/8×) bake into the pattern as
        // extra cycles instead (same contract as the deck — counting inside
        // holdSection double-counted under the arrangement watcher's ~5Hz poll).
        holdSection: (id) => sectionHoldTarget(id, c) === Infinity,
        repeatsFor: (id) => {
          const target = sectionHoldTarget(id, c);
          return Number.isFinite(target) ? target : 1;
        },
        secondsFor: (id) => buildSetSections(c, barsForPart).find((x) => x.id === id)?.seconds,
        // decorateSetSection already bused every layer onto its channel's kill
        // decade — the arrangement's global re-bus would fold them back onto
        // 1..n and the deck's kills (adopted mid-play on the set page) would
        // gate buses nothing plays on.
        keepOrbits: true,
      });
    } catch {
      setLoadingPlay(null);
      if (started) {
        stop();
        clearNowPlaying();
      }
      setError("Couldn’t play that set.");
    }
  }

  // The server-rendered list can arrive STALE on a back-navigation (the client
  // router serves its cached payload), so a rename made on the set page didn't
  // show here. Re-read the truth on every mount — and again when the browser
  // restores the page from bfcache (no remount, only pageshow fires).
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      fetch("/api/sets", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { sets?: SetCard[] } | null) => {
          if (alive && j?.sets) {
            setSets(
              j.sets.map((s) => ({
                id: s.id,
                title: s.title,
                songCount: s.songCount,
                songTitles: s.songTitles,
              })),
            );
          }
        })
        .catch(() => {});
    void refresh();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      alive = false;
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  async function createSet() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });
      const j = (await r.json()) as { set?: { id: string }; error?: string };
      if (!r.ok || !j.set) throw new Error(j.error || "couldn’t create the set");
      router.push(`/set/${j.set.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t create the set.");
      setBusy(false);
    }
  }

  async function deleteSet(id: string) {
    if (playingId === id) dockStop(); // a deleted set can't keep sounding
    setSets((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/sets/${id}`, { method: "DELETE" }).catch(() => {});
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

      <header className="mt-14 flex items-end justify-between gap-4">
        <div>
          <h1 className="wordmark text-gradient text-[40px] leading-[0.95] tracking-tight sm:text-[54px]">
            Sets
          </h1>
          <p className="mt-2.5 text-[15px] text-muted">
            Your songs, one continuous night.
          </p>
        </div>
        <button
          onClick={() => void createSet()}
          disabled={busy}
          className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition active:scale-[.98] disabled:opacity-50"
        >
          <span className="text-base leading-none">+</span>
          New set
        </button>
      </header>

      {error && (
        <p className="mt-5 text-[13px] leading-relaxed text-rose-300/90">{error}</p>
      )}

      <div className="mt-10 flex flex-col gap-3">
        {sets.length === 0 && (
          <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] px-8 py-20 text-center">
            <div
              className="glow-breathe pointer-events-none absolute -top-28 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(224,49,156,0.18), transparent)",
              }}
            />
            <p className="relative text-[15px] text-muted">
              No sets yet.
              <br />
              <span className="text-foreground/80">
                Arrange your songs into a night that never stops.
              </span>
            </p>
          </div>
        )}
        {sets.map((s, i) => {
          const isPlaying = playingId === s.id; // the app is carrying THIS set
          const sounding = isPlaying && !paused; // …and it isn't held
          const canPlay = s.songCount > 0;
          return (
            <div
              key={s.id}
              className={`group animate-rise flex items-center gap-4 rounded-[22px] border transition hover:-translate-y-0.5 ${
                isPlaying
                  ? "playing-glow border-accent/60 bg-accent/[0.08]"
                  : "border-white/[0.06] bg-white/[0.03] hover:border-accent/25 hover:bg-white/[0.05]"
              }`}
              style={{ "--i": i } as CSSProperties}
            >
              {/* PLAY — the whole set, right here (fetched once, cached) */}
              <button
                onClick={() => {
                  if (canPlay) void onPlaySet(s);
                }}
                disabled={isMobile ? false : !canPlay || loadingPlay === s.id}
                title={isPlaying ? (paused ? "Resume" : "Pause") : undefined}
                aria-label={
                  isPlaying
                    ? paused
                      ? `Resume ${s.title}`
                      : `Pause ${s.title}`
                    : isMobile
                      ? `Open ${s.title}`
                      : `Play ${s.title}`
                }
                className="group/play relative ml-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-[1.06] active:scale-95 disabled:cursor-default disabled:opacity-30"
              >
                {/* the orb's own halo — every card carries a small pink sun.
                    It burns while the set SOUNDS, banks while it's held. */}
                <span
                  aria-hidden
                  className={`absolute -inset-2 rounded-full bg-accent blur-[14px] transition-opacity duration-300 ${
                    sounding
                      ? "opacity-40"
                      : isPlaying
                        ? "opacity-25"
                        : "opacity-[0.18] group-hover/play:opacity-35"
                  }`}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
                    sounding
                      ? "shadow-[0_0_28px_-2px_rgba(224,49,156,.9),inset_0_1px_0_rgba(255,255,255,.3)]"
                      : "shadow-[0_10px_26px_-8px_rgba(224,49,156,.8),inset_0_1px_0_rgba(255,255,255,.3)] group-hover/play:shadow-[0_0_30px_-2px_rgba(224,49,156,.9)]"
                  }`}
                />
                {isPlaying && (
                  <span aria-hidden className="absolute -inset-[3px] rounded-full ring-1 ring-accent/40" />
                )}
                <span className="relative">
                  {loadingPlay === s.id ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : sounding ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
                      <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.4v13.2L19 12z" />
                    </svg>
                  )}
                </span>
              </button>
              <Link href={`/set/${s.id}`} className="min-w-0 flex-1 py-5 pr-5">
                <div className="truncate text-[17px] font-medium text-foreground">
                  {s.title}
                </div>
                <div className="mt-1.5 truncate text-[13px] text-muted">
                  {s.songCount} song{s.songCount === 1 ? "" : "s"}
                  {s.songTitles.length > 0 && (
                    <span className="text-muted/70">
                      {" "}
                      · {s.songTitles.join("  →  ")}
                    </span>
                  )}
                </div>
              </Link>
              <button
                onClick={() => void deleteSet(s.id)}
                aria-label="Delete set"
                className="mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] text-muted transition hover:bg-white/[0.07] hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
