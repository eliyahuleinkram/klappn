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
type FxKey = "filter" | "echo" | "space";
const FX_KEYS: FxKey[] = ["filter", "echo", "space"];
const FX_LABEL: Record<FxKey, string> = {
  filter: "Filter",
  echo: "Echo",
  space: "Space",
};
function perfValues(f: Record<FxKey, boolean>) {
  return {
    filter: f.filter ? -55 : 0,
    echo: f.echo ? 0.45 : 0,
    punch: 0,
    space: f.space ? 0.5 : 0,
  };
}

/**
 * THE DOOR — the signed-out page IS the instrument. One orb; tap it and a
 * whole song plays in the browser while its own picture takes the room. Then
 * the deck appears: drop the drums, the bass, the melody — instantly, on the
 * audio graph (the same orbit-decade gates the Sets deck uses) — darken the
 * filter, throw the echo, open the space, unfold the live code, deal Another.
 * No account, no tour, no explanation. The technology is the pitch.
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
  const [codeOpen, setCodeOpen] = useState(false);
  const [curSectionId, setCurSectionId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!playingId) setCodeOpen(false); // the reveal belongs to a sounding room
  }, [playingId]);

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
      setCurSectionId(entry.sections[0].id);
      await playSong(entry.sections, {
        owner: s.id,
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null });
          if (id) setCurSectionId(id);
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
    } catch {
      setError(true);
    } finally {
      setLoadingPlay(false);
    }
  }

  function onAnother() {
    if (!songs.length) return;
    const from = songs.findIndex((x) => x.id === current?.id);
    const next = songs[(from + 1 + songs.length) % songs.length];
    setAt(songs.indexOf(next));
    void onPlay(next);
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

  // The unfolded live code: the section sounding right now, grade-spec blocks
  // stripped (music + @hydra stay — the picture is code too).
  const entry = codeCache.current.get(current.id);
  const liveSection =
    isPlaying && codeOpen && entry
      ? (entry.sections.find((x) => x.id === curSectionId) ?? entry.sections[0])
      : null;
  const liveCode = liveSection
    ? liveSection.code
        .replace(/\/\*\s*@(?:vcontrols|vlooks)\b[\s\S]*?\*\/\n*/g, "")
        .trim()
    : null;

  const pill =
    "rounded-full px-4 py-2 text-[13px] font-medium backdrop-blur-xl transition active:scale-[.96]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {/* the whisper — what's on, or waiting */}
      <p className="text-[13px] tabular-nums text-muted/80">
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

      {!isPlaying ? (
        <p className="mt-7 text-[15px] text-muted">It sounds like this.</p>
      ) : (
        <>
          {/* THE DECK — the parts of the song, held in your hand. Lit = in the
              mix; tap = gone, instantly, tails and all. */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
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
          {/* the room — colour the sound, open the code, deal the next hand */}
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
            <button
              onClick={() => setCodeOpen((v) => !v)}
              aria-pressed={codeOpen}
              className={`${pill} ${
                codeOpen
                  ? "border border-accent/30 bg-accent/20 text-accent"
                  : "border border-white/[0.08] bg-white/[0.04] text-muted hover:text-foreground"
              }`}
            >
              {codeOpen ? "✕ Code" : "Code"}
            </button>
            <button
              onClick={onAnother}
              className={`${pill} border border-white/[0.08] bg-white/[0.04] text-muted hover:text-foreground`}
            >
              Another
            </button>
          </div>
        </>
      )}

      {liveCode && (
        <div className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/50 text-left backdrop-blur-xl">
          <p className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2 text-[11px] tracking-wide text-muted/70">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            {(entry?.labels[liveSection!.id] ?? "Loop") +
              " — the code, as it sounds"}
          </p>
          <pre className="max-h-52 overflow-auto px-3.5 py-3 font-mono text-[11px] leading-relaxed text-foreground/80">
            {liveCode}
          </pre>
        </div>
      )}

      {error && (
        <p className="mt-3 text-[13px] text-red-400">
          Couldn&rsquo;t start that one — tap Another.
        </p>
      )}
    </div>
  );
}
