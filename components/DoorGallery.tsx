"use client";

import { useEffect, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import {
  buildPlayEntry,
  type HomePart,
  type HomePlan,
  type PlayEntry,
} from "@/lib/home-sections";
import {
  applyOrbitGains,
  ensurePerfFx,
  playSong,
  setLivePerf,
  setVisuals,
  startIdleVisual,
  stop,
  teardownVisuals,
} from "@/lib/strudel-client";
import {
  assignChannelOrbits,
  channelOfOrbit,
  CHANNELS,
  type Channel,
} from "@/lib/set-live";
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

/** What /api/door lists — a whisper of identity, no code. */
export interface DoorSong {
  id: string;
  title: string;
  plan: { bpm?: number; key?: string; genre?: string };
}

// The three room chips — fixed, tasty amounts. One tap in, one tap out;
// setLivePerf ramps on the audio graph, so the change is INSTANT and clickless.
type FxKey = "filter" | "echo" | "punch" | "space";
const FX_KEYS: FxKey[] = ["filter", "echo", "punch", "space"];
const FX_LABEL: Record<FxKey, string> = {
  filter: "Filter",
  echo: "Echo",
  punch: "Punch",
  space: "Space",
};
function perfValues(f: Record<FxKey, boolean>) {
  return {
    filter: f.filter ? -55 : 0,
    echo: f.echo ? 0.45 : 0,
    punch: f.punch ? 0.4 : 0,
    space: f.space ? 0.5 : 0,
  };
}

/**
 * THE DOOR — the signed-out page IS the instrument, and one tap starts a
 * JOURNEY: each song plays through once, then hands the room to the next —
 * new picture, new name, no buttons, no choices. The only hands-on controls
 * are the deck: drop the drums, the bass, the melody — instantly, on the
 * audio graph (the same orbit-decade gates the Sets deck uses) — darken the
 * filter, throw the echo, open the space. No account, no tour, no
 * explanation. The technology is the pitch.
 *
 * The hand-off fires ON THE WRAP: playSong cycles its sections forever, so
 * when the first section comes back around after the last one has played,
 * the song has said everything once — that downbeat belongs to the next
 * song (cross-song law: the transition is a cut, and it lands on the bar).
 *
 * Playback laws are home's: tap the sounding orb to hold, cut at tap time,
 * publish only after the engine sounds. The door OWNS its surface
 * (surfaceMounted: true) so no dock doubles the transport here; leaving the
 * page hands the mix to the dock like any other surface.
 */
export default function DoorGallery({
  songs,
  onVisual,
}: {
  songs: DoorSong[];
  /** A picture holds the room (idle or playing) — the page's glow yields. */
  onVisual?: (up: boolean) => void;
}) {
  const [at, setAt] = useState(0);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [error, setError] = useState(false);
  // The journey's odometer: set once the last section has sounded; the next
  // arrival of the FIRST section is the wrap — that downbeat starts the next
  // song. Guarded so one wrap fires exactly one hand-off.
  const journeyRef = useRef({ sawLast: false, advancing: false });
  // Ref-first for anything a gesture must read synchronously (SetClient law:
  // a setState updater runs at render time — the gate would lag a tick).
  const [kills, setKills] = useState<Record<Channel, boolean>>({
    drums: false,
    bass: false,
    melody: false,
  });
  const killsRef = useRef(kills);
  const [fx, setFx] = useState<Record<FxKey, boolean>>({
    filter: false,
    echo: false,
    punch: false,
    space: false,
  });
  const fxRef = useRef(fx);
  const codeCache = useRef(new Map<string, PlayEntry>());

  const playingId = useNowPlayingValue(
    (s) => (s?.kind === "song" ? s.id : null),
    null,
  );
  const paused = useNowPlayingValue(
    (s) => s?.kind === "song" && !!s.paused,
    false,
  );

  const current = songs.find((s) => s.id === playingId) ?? songs[at % songs.length];
  const isPlaying = !!current && playingId === current.id;
  const sounding = isPlaying && !paused;

  /** Fetch + build (once per song): sealed payload → sections, then RE-BUS
   *  every layer onto its channel's orbit decade so the kill gates have
   *  something to hold. Same re-bus the Sets deck runs. */
  async function entryFor(s: DoorSong): Promise<PlayEntry | null> {
    let entry = codeCache.current.get(s.id) ?? null;
    if (entry) return entry;
    const res = await fetch(`/api/door/${s.id}`);
    const d = openDeep(
      (await res.json().catch(() => null)) as {
        song?: { plan?: HomePlan };
        parts?: HomePart[];
      } | null,
    );
    const built = buildPlayEntry(d?.parts ?? [], d?.song?.plan ?? {});
    if (!built) return null;
    entry = {
      ...built,
      sections: built.sections.map((sec) => ({
        ...sec,
        code: assignChannelOrbits(sec.code),
      })),
    };
    codeCache.current.set(s.id, entry);
    return entry;
  }

  // THE ROOM BREATHES BEFORE THE TAP — prefetch the first song and mount its
  // picture as the idle visual, so the page arrives alive (and the first tap
  // starts instantly: the payload is already here).
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const first = songs[0];
        if (!first) return;
        const entry = await entryFor(first);
        if (dead || !entry || !entry.visual) return;
        setVisuals(true);
        await startIdleVisual(entry.sections[0].code);
        if (!dead) onVisual?.(true);
      } catch {
        /* the door still works without a backdrop */
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section changes build fresh orbit buses at gain 1 — re-assert the kills on
  // a light tick (applyOrbitGains skips buses already at target; Sets' law).
  const killGainFor = (orbit: number): number | undefined => {
    const ch = channelOfOrbit(orbit);
    return ch ? (killsRef.current[ch] ? 0 : 1) : undefined;
  };
  useEffect(() => {
    if (!playingId) return;
    const t = setInterval(() => applyOrbitGains(killGainFor), 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);

  /** The next stop on the journey (the list is already a per-visit shuffle). */
  function nextOf(s: DoorSong): DoorSong | null {
    if (songs.length < 2) return null;
    const from = songs.findIndex((x) => x.id === s.id);
    return songs[(from + 1 + songs.length) % songs.length] ?? null;
  }

  // Leaving the door (signing in!): the music rides along — the dock carries
  // it into the signed-in home. Only a silent page tears the engine down. The
  // room chips reset either way: the app inside must open clean.
  useEffect(
    () => () => {
      const np = nowPlaying();
      if (np) {
        if (np.surfaceMounted) updateNowPlaying({ surfaceMounted: false });
      } else {
        stop();
        teardownVisuals();
      }
      setLivePerf({ filter: 0, echo: 0, punch: 0, space: 0 });
    },
    [],
  );

  async function onPlay(s: DoorSong) {
    if (playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    setLoadingPlay(true);
    setError(false);
    // CUT at tap time — the tap says "now". (dockStop also resets the decade
    // gates; the 200ms tick re-asserts any kills the visitor is holding.)
    if (nowPlaying()) dockStop();
    try {
      const entry = await entryFor(s);
      if (!entry) {
        setError(true);
        return;
      }
      if (!entry.visual) teardownVisuals();
      else setVisuals(true);
      // The room chips live on the master graph — install once, assert now.
      ensurePerfFx();
      setLivePerf(perfValues(fxRef.current));
      const { labels, holds } = entry;
      const cached = entry;
      journeyRef.current = { sawLast: false, advancing: false };
      await playSong(entry.sections, {
        owner: s.id,
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null });
          if (!id) return;
          // THE HAND-OFF: wrap detected → this downbeat belongs to the next
          // song. (Wrap check before the last-mark so a one-section song
          // advances on its second pass, not never.)
          const j = journeyRef.current;
          const secs = cached.sections;
          if (id === secs[0].id && j.sawLast && !j.advancing) {
            j.advancing = true;
            const upNext = nextOf(s);
            if (upNext) void onPlay(upNext);
            else j.advancing = false;
          } else if (id === secs[secs.length - 1].id) {
            j.sawLast = true;
          }
        },
        repeatsFor: (id) => {
          if (
            !id.startsWith("break:") &&
            cached.sections.find((x) => x.id === id)?.arr
          )
            return 1;
          const target = holds[id] ?? 1;
          return Number.isFinite(target) ? target : 1;
        },
        effectsFor: () => cached.effects,
        overlaysFor: () => cached.overlays,
        ending: entry.ending,
        onEnded: () => clearNowPlaying(),
      });
      onVisual?.(entry.visual);
      // Published AFTER the engine sounds, never before. The door OWNS its
      // surface — no dock doubling the transport on this page.
      publishNowPlaying({
        kind: "song",
        id: s.id,
        href: "/",
        title: s.title,
        sectionLabel: labels[entry.sections[0].id] ?? null,
        paused: false,
        surfaceMounted: true,
      });
      setAt(Math.max(0, songs.findIndex((x) => x.id === s.id)));
      // The next stop warms up NOW — the hand-off must land on its downbeat,
      // not on a network wait.
      const upNext = nextOf(s);
      if (upNext) void entryFor(upNext).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoadingPlay(false);
    }
  }

  function toggleKill(ch: Channel) {
    const out = { ...killsRef.current, [ch]: !killsRef.current[ch] };
    killsRef.current = out; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(killGainFor);
    setKills(out);
  }

  function toggleFx(k: FxKey) {
    const out = { ...fxRef.current, [k]: !fxRef.current[k] };
    fxRef.current = out;
    ensurePerfFx();
    setLivePerf(perfValues(out));
    setFx(out);
  }

  if (!songs.length || !current) return null;

  const meta = [
    current.plan?.genre?.trim() ? sentenceLabel(current.plan.genre) : null,
    current.plan?.bpm ? `${current.plan.bpm} BPM` : null,
    current.plan?.key || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pill =
    "rounded-full px-4 py-2 text-[13px] font-medium backdrop-blur-xl transition active:scale-[.96]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {/* the whisper — where the journey is right now. Re-keyed per song so
          every hand-off RISES in with its new name. */}
      <p
        key={current.id}
        className="animate-rise text-[13px] tabular-nums text-muted/80"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <span className="wordmark text-[17px] tracking-tight text-foreground/90">
          {current.title}
        </span>
        {meta && <span className="mt-0.5 block">{meta}</span>}
      </p>

      {/* THE ORB — one tap, the room fills. It burns while the music sounds. */}
      <button
        onClick={() => void onPlay(current)}
        disabled={loadingPlay}
        aria-label={
          isPlaying
            ? paused
              ? `Resume ${current.title}`
              : `Pause ${current.title}`
            : `Play ${current.title}`
        }
        className="group relative mt-7 flex h-24 w-24 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:opacity-70"
      >
        <span
          aria-hidden
          className={`absolute -inset-6 rounded-full bg-accent blur-[30px] transition-opacity duration-500 ${
            sounding ? "opacity-45" : "opacity-25 group-hover:opacity-40"
          } ${!isPlaying && !loadingPlay ? "glow-breathe" : ""}`}
        />
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
            sounding
              ? "shadow-[0_0_60px_-6px_rgba(224,49,156,.95),inset_0_2px_0_rgba(255,255,255,.35)]"
              : "shadow-[0_22px_60px_-14px_rgba(224,49,156,.85),inset_0_2px_0_rgba(255,255,255,.35)]"
          }`}
        />
        <span className="relative">
          {loadingPlay ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.6" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          ) : sounding ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
              <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.4v13.2L19 12z" />
            </svg>
          )}
        </span>
      </button>

      {/* Fixed-height stage below the orb: the idle line and the deck live in
          the SAME reserved space, so the orb never moves when play begins. */}
      <div className="mt-7 flex min-h-[6.75rem] w-full flex-col items-center justify-start">
        {!isPlaying ? (
          <p className="mt-8 text-[15px] text-muted">It sounds like this.</p>
        ) : (
          <>
            {/* THE DECK — the parts of the song, held in your hand. Lit = in
                the mix; tap = gone, instantly, tails and all. */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleKill(ch)}
                  aria-pressed={!kills[ch]}
                  className={`${pill} ${
                    kills[ch]
                      ? "border border-white/[0.08] bg-white/[0.03] text-muted/50 line-through"
                      : "border border-accent/25 bg-accent/[0.12] text-foreground shadow-[0_0_24px_-8px_rgba(224,49,156,.8)]"
                  }`}
                >
                  {ch === "drums" ? "Drums" : ch === "bass" ? "Bass" : "Melody"}
                </button>
              ))}
            </div>
            {/* the room — colour the sound */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              {FX_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleFx(k)}
                  aria-pressed={fx[k]}
                  className={`${pill} ${
                    fx[k]
                      ? "border border-accent/30 bg-accent/20 text-accent"
                      : "border border-white/[0.08] bg-white/[0.04] text-muted hover:text-foreground"
                  }`}
                >
                  {FX_LABEL[k]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[13px] text-red-400">
          The journey stumbled — tap the orb.
        </p>
      )}
    </div>
  );
}
