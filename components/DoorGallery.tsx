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

/** What /api/door lists — a card whisper, no code. */
export interface DoorSong {
  id: string;
  title: string;
  plan: { bpm?: number; key?: string; genre?: string };
}

/**
 * THE DOOR — the signed-out gallery on the sign-in page. Whole songs, played
 * right here by the same engine and the same section builder as home (one
 * sealed fetch per song, cached). No account, no explanation: press the orb,
 * the room fills. Same playback laws as HomeClient — tap the sounding card to
 * hold, tap again to carry on, the dock carries the mix, and nothing is
 * published before the engine sounds.
 */
export default function DoorGallery({
  songs,
  onVisual,
}: {
  songs: DoorSong[];
  /** A playing song's own picture mounted (or left) — the page's glow yields. */
  onVisual?: (up: boolean) => void;
}) {
  const [loadingPlay, setLoadingPlay] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const codeCache = useRef(new Map<string, PlayEntry>());
  const playingId = useNowPlayingValue(
    (s) => (s?.kind === "song" ? s.id : null),
    null,
  );
  const paused = useNowPlayingValue(
    (s) => s?.kind === "song" && !!s.paused,
    false,
  );
  useEffect(() => {
    if (!playingId) onVisual?.(false); // the session ended — the glow returns
  }, [playingId, onVisual]);
  // Leaving the door (signing in!): the music rides along — the dock carries it
  // straight into the signed-in home. Only a silent page tears the engine down.
  useEffect(
    () => () => {
      const np = nowPlaying();
      if (np) {
        if (np.surfaceMounted) updateNowPlaying({ surfaceMounted: false });
      } else {
        stop();
        teardownVisuals();
      }
    },
    [],
  );

  async function onPlay(s: DoorSong) {
    // Tap the sounding card = HOLD; tap again = carry on, same phrase.
    if (playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    setLoadingPlay(s.id);
    setError(false);
    // CUT the sounding session at TAP time — the tap says "this one now".
    if (nowPlaying()) dockStop();
    try {
      let entry = codeCache.current.get(s.id);
      if (!entry) {
        const res = await fetch(`/api/door/${s.id}`);
        // Code arrives SEALED (lib/seal.ts) — open it; pass-through if unsealed.
        const d = openDeep(
          (await res.json().catch(() => null)) as {
            song?: { plan?: HomePlan };
            parts?: HomePart[];
          } | null,
        );
        const built = buildPlayEntry(d?.parts ?? [], d?.song?.plan ?? {});
        if (!built) {
          setError(true);
          return;
        }
        entry = built;
        codeCache.current.set(s.id, entry);
      }
      if (!entry.visual) teardownVisuals();
      else setVisuals(true);
      const { labels, holds } = entry;
      const cached = entry;
      await playSong(entry.sections, {
        owner: s.id,
        onSection: (id) =>
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null }),
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
      // Published AFTER playSong resolves, never before: the session IS the
      // transport, and a transport that exists before the engine does is a lie
      // you can tap. The door has no song page — the dock points home.
      publishNowPlaying({
        kind: "song",
        id: s.id,
        href: "/",
        title: s.title,
        sectionLabel: labels[entry.sections[0].id] ?? null,
        paused: false,
        surfaceMounted: false,
      });
    } catch {
      setError(true);
    } finally {
      setLoadingPlay(null);
    }
  }

  if (!songs.length) return null;

  return (
    <div className="animate-rise mt-14" style={{ "--i": 4 } as React.CSSProperties}>
      {/* the whole pitch, in four words — then proof you can tap */}
      <p className="text-[13px] font-medium tracking-wide text-muted/70">
        It sounds like this.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {songs.map((s) => {
          const meta = [
            s.plan?.genre?.trim() ? sentenceLabel(s.plan.genre) : null,
            s.plan?.bpm ? `${s.plan.bpm} BPM` : null,
            s.plan?.key || null,
          ]
            .filter(Boolean)
            .join(" · ");
          const isPlaying = playingId === s.id;
          const sounding = isPlaying && !paused;
          return (
            <button
              key={s.id}
              onClick={() => void onPlay(s)}
              disabled={loadingPlay === s.id}
              aria-label={
                isPlaying
                  ? paused
                    ? `Resume ${s.title}`
                    : `Pause ${s.title}`
                  : `Play ${s.title}`
              }
              className={`group flex w-full items-center gap-3.5 rounded-2xl border p-3 text-left backdrop-blur-xl transition active:scale-[.995] ${
                isPlaying
                  ? "border-accent/30 bg-accent/[0.07]"
                  : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]"
              }`}
            >
              {/* the orb — every card carries a small pink sun. It burns while
                  the music SOUNDS, banks while it's held. */}
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
                <span
                  aria-hidden
                  className={`absolute -inset-2 rounded-full bg-accent blur-[14px] transition-opacity duration-300 ${
                    sounding
                      ? "opacity-40"
                      : isPlaying
                        ? "opacity-25"
                        : "opacity-[0.18] group-hover:opacity-35"
                  }`}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
                    sounding
                      ? "shadow-[0_0_28px_-2px_rgba(224,49,156,.9),inset_0_1px_0_rgba(255,255,255,.3)]"
                      : "shadow-[0_10px_26px_-8px_rgba(224,49,156,.8),inset_0_1px_0_rgba(255,255,255,.3)] group-hover:shadow-[0_0_30px_-2px_rgba(224,49,156,.9)]"
                  }`}
                />
                {isPlaying && (
                  <span
                    aria-hidden
                    className="absolute -inset-[3px] rounded-full ring-1 ring-accent/40"
                  />
                )}
                <span className="relative">
                  {loadingPlay === s.id ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : sounding ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
                      <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.4v13.2L19 12z" />
                    </svg>
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="wordmark block truncate text-[17px] tracking-tight text-foreground">
                  {s.title}
                </span>
                {meta && (
                  <span className="mt-0.5 block truncate text-[12.5px] tabular-nums text-muted">
                    {meta}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-[13px] text-red-400">
          Couldn&rsquo;t play that one. Try another.
        </p>
      )}
    </div>
  );
}
