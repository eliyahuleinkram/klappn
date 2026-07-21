import {
  applyOrbitGains,
  disableBackgroundPlayback,
  pausePlayback,
  resumePlayback,
  setAutoPauseSink,
  stop,
  teardownVisuals,
} from "@/lib/strudel-client";
import { channelOfOrbit } from "@/lib/set-live";
import { applyMediaSession, clearMediaSession } from "@/lib/media-session";

// When the engine auto-pauses on background (or resumes on return), reflect it in
// the descriptor so the dock icon + the OS lock-screen card follow.
if (typeof window !== "undefined") {
  setAutoPauseSink((paused) => updateNowPlaying({ paused }));
}

/**
 * THE MUSIC BELONGS TO NO PAGE. This tiny module store is the app-wide "now
 * playing" descriptor: whichever surface starts playback publishes here, keeps
 * `sectionLabel`/`paused` fresh while it's mounted, and on unmount just flips
 * `surfaceMounted` off INSTEAD of stopping the engine — the sequencer (module
 * state in lib/strudel-client) keeps sounding, and the NowPlayingDock in the
 * root layout surfaces it wherever you wander. Returning to `href` ADOPTS the
 * running session (rebindSong + this descriptor) — nothing restarts.
 *
 * One session at a time, mirroring the one audio engine: a new publish simply
 * replaces the old descriptor, exactly as a new play replaces the old sound.
 */

/** A set deck's live posture, stashed on unmount so returning restores the
 *  exact performance state the audio is ALREADY wearing (kills are Web Audio
 *  gain gates that survive navigation — the UI must come back matching). */
export interface DeckSnapshot {
  kills: Record<string, boolean>;
  perf: Record<string, number>;
  tempoNudge: number;
  holdMode: boolean;
}

export interface NowPlayingSession {
  kind: "song" | "set";
  /** The owning entity's id — song id or set id. */
  id: string;
  /** Where the dock takes you back to. */
  href: string;
  title: string;
  /** What's sounding right now (section / loop name) — dock's whisper line. */
  sectionLabel?: string | null;
  paused: boolean;
  /** True while the owning page is mounted (the dock hides — that page IS the player). */
  surfaceMounted: boolean;
  deck?: DeckSnapshot;
}

let session: NowPlayingSession | null = null;
const subs = new Set<() => void>();
const emit = () => {
  for (const fn of subs) fn();
};

/** Mirror the descriptor onto the OS lock screen / notification (MediaSession).
 *  Title = the song/set name, subtitle = what's sounding now, album = the kind.
 *  Transport buttons drive the same dock handlers. */
function syncMedia(): void {
  if (!session) {
    clearMediaSession();
    return;
  }
  applyMediaSession({
    title: session.title || "Klappn",
    subtitle: session.sectionLabel || (session.kind === "set" ? "Live set" : "Klappn"),
    album: session.kind === "set" ? "Set" : "Song",
    playing: !session.paused,
    onPlay: () => void dockResume(),
    onPause: () => dockPause(),
    onStop: () => dockStop(),
  });
}

/** Snapshot getter — stable reference between emits (useSyncExternalStore-ready). */
export const nowPlaying = (): NowPlayingSession | null => session;
export const noSession = (): null => null; // server snapshot

export function subscribeNowPlaying(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function publishNowPlaying(next: NowPlayingSession): void {
  // A SONG session never rides a set's background <audio> sink — restore the
  // direct output route the moment a song takes over, or the whole mix can
  // play slower/pitched-down through the stale element after a device change.
  // It never inherits a set's KILL GATES either: those are Web Audio gain gates on
  // the channel orbits, and they outlive the set that engaged them, so a song taking
  // the engine from a killed-drums set played with no drums. Open every channel bus.
  if (next.kind === "song") {
    disableBackgroundPlayback();
    applyOrbitGains((orbit) => (channelOfOrbit(orbit) ? 1 : undefined));
  }
  session = next;
  syncMedia();
  emit();
}

export function updateNowPlaying(patch: Partial<NowPlayingSession>): void {
  if (!session) return;
  session = { ...session, ...patch };
  syncMedia();
  emit();
}

export function clearNowPlaying(): void {
  if (!session) return;
  session = null;
  clearMediaSession();
  emit();
}

// ── the dock's transport (shared by any surface without its own handler) ─────

export function dockPause(): void {
  pausePlayback();
  updateNowPlaying({ paused: true });
}

export async function dockResume(): Promise<void> {
  await resumePlayback();
  updateNowPlaying({ paused: false });
}

/** ✕ on the dock — the one true stop: engine silent, visuals down, session gone.
 *  A SET session also releases its kill gates (Web Audio gains that would
 *  otherwise leave dead buses behind for the next song page). */
export function dockStop(): void {
  if (session?.kind === "set") {
    applyOrbitGains((orbit) => (channelOfOrbit(orbit) ? 1 : undefined));
  }
  stop();
  disableBackgroundPlayback(); // the one true stop also drops the <audio> sink
  teardownVisuals();
  clearNowPlaying();
}
