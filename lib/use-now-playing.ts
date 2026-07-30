"use client";

import { useSyncExternalStore } from "react";
import {
  nowPlaying,
  subscribeNowPlaying,
  type NowPlayingSession,
} from "./now-playing";
/**
 * ONE primitive off the session. useSyncExternalStore bails out when the
 * snapshot is Object.is-equal, so a per-section label tick can't force a
 * re-render of the song page — whose (un-memoized) tree renders on the SAME
 * main thread the Strudel scheduler ticks on, i.e. a re-render per boundary is
 * a glitch. MUST return a primitive; an object snapshot re-renders forever.
 */
export function useNowPlayingValue<T extends string | number | boolean | null>(
  select: (s: NowPlayingSession | null) => T,
  server: T,
): T {
  return useSyncExternalStore(
    subscribeNowPlaying,
    () => select(nowPlaying()),
    () => server,
  );
}

/** True while `kind`/`id` is the session the store is carrying — i.e. THIS page's
 *  music is the music. (Another song, or a set, riding along in the dock is not.) */
export const isOwnSession = (
  s: NowPlayingSession | null,
  kind: NowPlayingSession["kind"],
  id: string,
): boolean => !!s && s.kind === kind && s.id === id;
