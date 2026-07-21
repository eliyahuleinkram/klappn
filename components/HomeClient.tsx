"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { signOut } from "@/lib/auth-client";
import type { SongRowRich } from "@/lib/songs";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import { DEFAULT_MODEL, type ModelId } from "@/lib/models";
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
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { DISCORD_URL, GITHUB_URL, ZALTZ_GITHUB_URL } from "@/lib/links";

// Evocative, hopeful status lines shown while a loop is being built — they make
// the (genuinely working) wait feel alive and reassuring.
const BUILD_STEPS = [
  "Imagining the vibe…",
  "Choosing the instruments…",
  "Finding the key & tempo…",
  "Sketching the groove…",
  "Shaping the sound…",
  "Almost there — making it slap…",
];

const STATUS: Record<string, { label: string; tone: string } | null> = {
  draft: { label: "Empty", tone: "text-muted/60" },
  overview: { label: "Empty", tone: "text-muted/60" },
  generating: { label: "Composing…", tone: "text-accent" },
  ready: null,
  error: { label: "Needs attention", tone: "text-rose-300/75" },
};

// THE AURA — one huge gradient breathing behind the page: white-hot pink falling
// through violet into black. No shapes, no ornaments — just heat. It steps aside
// (fades out) the moment a playing song brings its own visuals, and returns when
// the visuals leave.
function Aura({ dim }: { dim: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-[1] overflow-hidden transition-opacity duration-[1400ms] ease-out ${
        dim ? "opacity-0" : "opacity-100"
      }`}
    >
      <span className="aura-a" />
      <span className="aura-b" />
    </div>
  );
}


// HomePart/HomePlan + the section builders live in lib/home-sections.ts now —
// shared with the signed-out door gallery so the two can never drift apart.

export default function HomeClient({
  initialSongs,
  userEmail,
  isOwner,
}: {
  initialSongs: SongRowRich[];
  userEmail?: string | null;
  /** The house account curates THE DOOR (the signed-out gallery) — everyone
   *  else never sees the control. */
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // HOME PLAYBACK — hear the WHOLE SONG right here: every ready loop and its breaks, in
  // order, sequenced by the same playSong() the song page uses (one small request, cached),
  // VISUALS INCLUDED — pressing play puts the song's own backdrop behind the page, and the
  // aura yields to it. Home never OWNS the session (the song page does): the dock carries
  // it, and opening the song's page ADOPTS this very mix mid-phrase. One at a time; tap
  // the sounding card to HOLD it, tap again to carry on (the dock's ✕ is the one true
  // stop). Navigating away stops audio + canvas.
  const [loadingPlay, setLoadingPlay] = useState<string | null>(null);
  // A song's visual is UP (mounted on the backdrop canvas) — the aura steps aside. It
  // stays up after a stop (the idle clock keeps it drifting, like the song page) and
  // comes down when a visual-less song plays or the page unmounts.
  const [visualUp, setVisualUp] = useState(false);
  const codeCache = useRef(new Map<string, PlayEntry>());
  // Leaving home: any live session — a loop started HERE or one riding along
  // from another page — keeps sounding (the dock carries it). Only a silent
  // page tears the engine + canvas down.
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
  // Home never OWNS a session (the song page does), so the dock is up whenever
  // something plays from here — and the dock's global spacebar covers this page
  // too. THE SESSION STORE *IS* THE CARDS' PLAYING STATE: a song lights up whether
  // it was started here or on its own page, and it shows held the moment anything
  // pauses it (the dock, the OS lock screen, a backgrounded phone). No local copy
  // to fall out of sync. (Same rule as SetsClient.)
  //
  // Read as two PRIMITIVES, never the session object: home now sequences a whole
  // song, so updateNowPlaying({sectionLabel}) fires at every loop boundary — and a
  // whole-session subscription would re-render this un-memoized gallery, on the
  // main thread the Strudel scheduler ticks on, every few seconds. useSyncExternalStore
  // bails out on an Object.is-equal snapshot; these two barely ever change.
  const playingId = useNowPlayingValue((s) => (s?.kind === "song" ? s.id : null), null);
  const paused = useNowPlayingValue((s) => s?.kind === "song" && !!s.paused, false);
  useEffect(() => {
    if (!playingId) setVisualUp(false); // the session ended — the canvas is down, the aura returns
  }, [playingId]);
  async function onPlaySong(s: SongRowRich) {
    // Tap the sounding card = HOLD; tap again = carry on, same phrase.
    if (playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    // The orb spins — and stays DISABLED — for the whole start, fetch and engine both.
    // Nothing may offer a pause button before there is audio to pause: playSong() calls
    // resumeAudio(), which silently undoes a pause taken while it was still starting,
    // leaving every icon showing ⏸ over music that is merrily playing.
    setLoadingPlay(s.id);
    // CUT the sounding session at TAP time, not after the fetch: the tap is the
    // user saying "this one now" — the old song must not keep playing through a
    // network wait (it used to ride along until playSong()'s internal stop()).
    if (nowPlaying()) dockStop();
    try {
      let entry = codeCache.current.get(s.id);
      if (!entry) {
        const res = await fetch(`/api/songs/${s.id}`, { cache: "no-store" });
        // Code arrives SEALED (lib/seal.ts) — open it; pass-through if unsealed.
        const d = openDeep(
          (await res.json().catch(() => null)) as {
            song?: { plan?: HomePlan };
            parts?: HomePart[];
          } | null,
        );
        const built = buildPlayEntry(d?.parts ?? [], d?.song?.plan ?? {});
        if (!built) return;
        entry = built;
        codeCache.current.set(s.id, entry);
      }
      // A song WITHOUT visuals must not play under the previous song's picture; one
      // WITH visuals re-arms the visual engine (a prior song's failed sketch turns
      // it off globally — that must never mute the NEXT song's picture).
      if (!entry.visual) teardownVisuals();
      else setVisuals(true);
      const { labels, holds } = entry;
      const cached = entry;
      await playSong(entry.sections, {
        owner: s.id, // the song owns the program — anything else playing is cut, not crossfaded
        onSection: (id) =>
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null }),
        // REPEAT latches bake into the pattern as extra cycles — breaks and
        // (chapters era) plain loops alike; a legacy spec'd section plays its
        // authored span once, same as the song page.
        repeatsFor: (id) => {
          if (
            !id.startsWith("break:") &&
            cached.sections.find((x) => x.id === id)?.arr
          )
            return 1;
          const target = holds[id] ?? 1;
          return Number.isFinite(target) ? target : 1;
        },
        // Song-level effects + break overlays — exactly like the song page.
        effectsFor: () => cached.effects,
        overlaysFor: () => cached.overlays,
        // The song's OWN end (arrangement ending "stop") — the card goes dark
        // when the song finishes itself, exactly like the song page.
        ending: entry.ending,
        onEnded: () => clearNowPlaying(),
      });
      setVisualUp(entry.visual);
      // The song belongs to the APP now — and home is NOT its owning page (the song
      // page is), so the dock appears right here: play from anywhere that isn't the
      // song/set page and the overlay is already carrying it. Opening the song's page
      // adopts this mix in place.
      //
      // Published AFTER playSong resolves, never before: the session IS the transport,
      // and a transport that exists before the engine does is a lie you can tap.
      publishNowPlaying({
        kind: "song",
        id: s.id,
        href: `/song/${s.id}`,
        title: s.title,
        sectionLabel: labels[entry.sections[0].id] ?? null,
        paused: false,
        surfaceMounted: false,
      });
    } catch {
      setError("Couldn’t play that song.");
    } finally {
      setLoadingPlay(null);
    }
  }
  const [setup, setSetup] = useState(false);
  // "Select" is a mode you opt into: tap Select, then tap loops (multi). With a
  // selection you can DELETE them, or put them in a named PLAYLIST. Playlist
  // pills at the top filter the grid.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playlistName, setPlaylistName] = useState("");
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setPlaylistName("");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Put every selected loop in (or out of) a playlist.
  async function assignPlaylist(name: string | null) {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    const clean = name?.trim().slice(0, 60) || null;
    if (name !== null && !clean) return; // adding needs a name
    setError(null);
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/songs/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playlist: clean }),
        })
          .then((r) => r.ok)
          // A single rejected fetch would reject Promise.all and leave the
          // selection bar stuck with no error; treat it as a failed row instead.
          .catch(() => false),
      ),
    );
    if (results.some((ok) => !ok)) setError("Couldn’t update some loops.");
    setSongs((prev) =>
      prev.map((s) => (selected.has(s.id) ? { ...s, playlist: clean } : s)),
    );
    exitSelect();
    router.refresh();
  }

  // OWNER ONLY — put the selection on (or take it off) THE DOOR, the
  // signed-out gallery. One tap: if every selected song is already out
  // there, the same tap brings them home.
  async function assignDoor() {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    const featured = !ids.every(
      (id) => songs.find((s) => s.id === id)?.featured_at,
    );
    setError(null);
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/songs/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ featured }),
        })
          .then((r) => r.ok)
          .catch(() => false),
      ),
    );
    if (results.some((ok) => !ok)) setError("Couldn’t update some loops.");
    setSongs((prev) =>
      prev.map((s) =>
        selected.has(s.id)
          ? { ...s, featured_at: featured ? new Date().toISOString() : null }
          : s,
      ),
    );
    exitSelect();
    router.refresh();
  }

  // Bulk delete the selection (irreversible → confirm).
  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    if (
      !confirm(
        `Delete ${ids.length} loop${ids.length === 1 ? "" : "s"}? This can’t be undone.`,
      )
    )
      return;
    setDeleting(true);
    setError(null);
    // ONE request for the whole selection — the server deletes them in a single
    // query. (Fanning out one DELETE per loop spiked N simultaneous DB
    // connections and blew past the pool ceiling, so "some" deletes 500'd.)
    let ok = false;
    try {
      const res = await fetch("/api/songs", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (ok) {
      // All-or-nothing on the server → only prune on success, and keep the
      // selection on failure so the user can retry.
      setSongs((prev) => prev.filter((s) => !selected.has(s.id)));
      exitSelect();
    } else {
      setError("Couldn’t delete those loops.");
    }
    setDeleting(false);
    router.refresh();
  }

  async function createWorkspace(firstLoop: string, model: ModelId) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstLoop, model }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error || "Couldn’t create that loop.");
        setBusy(false);
        return;
      }
      router.push(`/song/${data.id}`);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  async function del(id: string): Promise<boolean> {
    // A network-level rejection here would escape onDelete after setDeleting(true)
    // and wedge every delete button (busy || deleting) until a reload.
    try {
      const res = await fetch(`/api/songs/${id}`, { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  }
  async function onDelete(id: string, title: string) {
    if (busy || deleting) return;
    if (!confirm(`Delete “${title}”? This can’t be undone.`)) return;
    setDeleting(true);
    setError(null);
    if (!(await del(id))) setError("Couldn’t delete that loop.");
    else setSongs((prev) => prev.filter((s) => s.id !== id));
    setDeleting(false);
    router.refresh();
  }

  // Live song list — seeded from the server, then refreshed while anything is
  // still composing so a finished loop/mix flips to playable here without a reload.
  const [songs, setSongs] = useState<SongRowRich[]>(initialSongs);
  const anyGenerating = songs.some((s) => s.status === "generating");
  useEffect(() => {
    setSongs(initialSongs);
  }, [initialSongs]);
  // FRESHNESS: the server render can be STALE after navigating back here (and a
  // back/forward-cache restore skips mounting entirely) — so a loop that
  // finished composing could still read "Composing…". Sync with the API on
  // arrival, and again whenever the browser revives this page from its cache.
  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch("/api/songs", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { songs?: SongRowRich[] };
        if (Array.isArray(data.songs)) setSongs(data.songs);
      } catch {
        /* transient — the regular poll or next visit catches up */
      }
    };
    void sync();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void sync();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  useEffect(() => {
    if (!anyGenerating) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/songs");
        if (!res.ok) return;
        const data = (await res.json()) as { songs?: SongRowRich[] };
        if (alive && Array.isArray(data.songs)) setSongs(data.songs);
      } catch {
        /* transient — try again next tick */
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [anyGenerating]);

  const empty = songs.length === 0;

  // Search — instant, local, forgiving: matches the title or the playlist name.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Playlist pills: every named playlist in the library. The active pill filters
  // the grid; it auto-clears if its playlist empties out.
  const playlists = [
    ...new Set(songs.map((s) => s.playlist).filter((p): p is string => !!p)),
  ].sort();
  // Search + playlist filter runs over the WHOLE library; pagination applies AFTER it —
  // a search always finds every match, the grid just reveals them a page at a time.
  const visible = songs.filter(
    (s) =>
      (!activePlaylist || s.playlist === activePlaylist) &&
      (!q ||
        s.title.toLowerCase().includes(q) ||
        (s.playlist || "").toLowerCase().includes(q)),
  );
  useEffect(() => {
    if (activePlaylist && !playlists.includes(activePlaylist))
      setActivePlaylist(null);
  }, [activePlaylist, playlists]);

  // PAGINATION — the grid shows a page at a time ("Show more" reveals the next).
  // A new search / playlist filter starts back at the first page (reset in the setters,
  // not an effect — the reset belongs to the gesture that changes the filter).
  const PAGE_SIZE = 6;
  const [shown, setShown] = useState(PAGE_SIZE);
  const paged = visible.slice(0, shown);
  function searchFor(v: string) {
    setQuery(v);
    setShown(PAGE_SIZE);
  }
  function filterPlaylist(p: string | null) {
    setActivePlaylist(p);
    setShown(PAGE_SIZE);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-28 pt-6 sm:pt-8">
      <Aura dim={visualUp} />
      {/* brand bar */}
      <div className="flex items-center justify-between">
        <span className="wordmark text-[17px] tracking-tight text-foreground">
          Klappn
        </span>
        <div className="flex items-center gap-2.5">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:bg-white/[0.08]"
          >
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#sets-hp)"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <defs>
                <linearGradient
                  id="sets-hp"
                  gradientUnits="userSpaceOnUse"
                  x1="3"
                  y1="5"
                  x2="21"
                  y2="20"
                >
                  <stop offset="0" stopColor="#ff63c1" />
                  <stop offset="1" stopColor="#e0319c" />
                </linearGradient>
              </defs>
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <rect x="3" y="13.2" width="4.6" height="6.8" rx="2.3" />
              <rect x="16.4" y="13.2" width="4.6" height="6.8" rx="2.3" />
            </svg>
            Sets
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:bg-white/[0.08]"
          >
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#events-hp)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <defs>
                <linearGradient
                  id="events-hp"
                  gradientUnits="userSpaceOnUse"
                  x1="3"
                  y1="5"
                  x2="21"
                  y2="20"
                >
                  <stop offset="0" stopColor="#ff63c1" />
                  <stop offset="1" stopColor="#e0319c" />
                </linearGradient>
              </defs>
              {/* a ticket */}
              <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3z" />
              <path d="M13 5v2M13 11v2M13 17v2" />
            </svg>
            Events
          </Link>
          <AccountMenu
            email={userEmail}
            onSignOut={() => signOut().then(() => router.refresh())}
          />
        </div>
      </div>

      {/* header — the title sits in its own pool of light */}
      <header className="relative mt-14 flex items-end justify-between gap-4">
        <span
          aria-hidden
          className="glow-breathe pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(224,49,156,.22), transparent 70%)",
          }}
        />
        <div className="relative">
          <h1 className="wordmark text-gradient-hot text-[40px] leading-[0.95] tracking-tight sm:text-[54px]">
            Loops
          </h1>
          <p className="mt-2.5 text-[15px] text-muted">
            {empty
              ? "Your loops live here."
              : `${songs.length} loop${songs.length === 1 ? "" : "s"} in the works.`}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
          {!empty && (
            <button
              onClick={selectMode ? exitSelect : () => setSelectMode(true)}
              className="rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-[15px] font-medium text-foreground/80 transition hover:bg-white/[0.08] active:scale-[.98]"
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
          {!selectMode && (
            <button
              onClick={() => setSetup(true)}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition active:scale-[.98] disabled:opacity-50"
            >
              <span className="text-base leading-none">+</span>
              New loop
            </button>
          )}
        </div>
      </header>

      {/* mobile create / select */}
      <div className="mt-7 flex gap-2.5 sm:hidden">
        {!empty && (
          <button
            onClick={selectMode ? exitSelect : () => setSelectMode(true)}
            className={`rounded-2xl border border-white/[0.12] bg-white/[0.04] px-5 py-3.5 text-[16px] font-medium text-foreground/80 transition active:scale-[.99] ${selectMode ? "flex-1" : ""}`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        )}
        {!selectMode && (
          <button
            onClick={() => setSetup(true)}
            disabled={busy}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[16px] font-medium transition active:scale-[.99] disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            New loop
          </button>
        )}
      </div>

      {setup && (
        <CreateSheet
          busy={busy}
          onCancel={() => setSetup(false)}
          onCreate={createWorkspace}
        />
      )}

      {error && <p className="mt-5 text-[13px] leading-relaxed text-rose-300/90">{error}</p>}

      {/* search — find a loop by name (or playlist) the moment you type */}
      {!empty && (
        <div className="relative mt-8">
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted/45"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => searchFor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") searchFor("");
            }}
            placeholder="Search your loops"
            className="w-full rounded-2xl bg-white/[0.04] py-3 pl-11 pr-10 text-[15px] text-foreground outline-none transition placeholder:text-muted/45 focus:bg-white/[0.07]"
          />
          {query && (
            <button
              onClick={() => searchFor("")}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[12px] text-muted transition hover:bg-white/[0.06] hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* playlist pills — tap one to see just that playlist */}
      {playlists.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => filterPlaylist(null)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-[.97] ${
              activePlaylist === null
                ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                : "bg-white/[0.05] text-muted hover:bg-white/[0.09] hover:text-foreground"
            }`}
          >
            All
          </button>
          {playlists.map((p) => (
            <button
              key={p}
              onClick={() => filterPlaylist(activePlaylist === p ? null : p)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-[.97] ${
                activePlaylist === p
                  ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                  : "bg-white/[0.05] text-muted hover:bg-white/[0.09] hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {empty ? (
        <div className="animate-rise relative mt-16 flex flex-col items-center text-center sm:mt-24">
          {/* concentric rings — the record waiting for its groove */}
          <span
            aria-hidden
            className="glow-breathe pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(224,49,156,.14), transparent 72%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,99,193,.16)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,99,193,.09)" }}
          />
          <span className="text-glow wordmark relative text-[28px] text-foreground/90">
            Silence, for now.
          </span>
          <p className="relative mt-3 max-w-xs text-[15px] leading-relaxed text-muted">
            Hit <span className="text-foreground">New loop</span> and describe a
            sound — a beat, a vibe, a feeling.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-muted/60">
          Nothing matches{q ? <> “{query.trim()}”</> : null}.
        </p>
      ) : (
        <>
          {/* FEWER, DEEPER — one column of rich cards: play it right here, see its sections,
              layers and identity at a glance. The rest of the library is a page away. */}
          <div className="mt-10 flex flex-col gap-3">
            {paged.map((s, i) => {
              const p = s.plan as { bpm?: number; key?: string; genre?: string };
              const meta = [
                p?.genre?.trim() ? sentenceLabel(p.genre) : null,
                p?.bpm ? `${p.bpm} BPM` : null,
                p?.key || null,
              ]
                .filter(Boolean)
                .join(" · ");
              const st = STATUS[s.status];
              const sel = selectMode && selected.has(s.id);
              const isPlaying = playingId === s.id; // the app is carrying THIS song
              const sounding = isPlaying && !paused; // …and it isn't held
              const canPlay = !!s.first_part_id;
              const inner = (
                <>
                  {selectMode ? (
                    <span
                      aria-hidden
                      className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] leading-none transition ${
                        sel
                          ? "bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_0_18px_-1px_rgba(224,49,156,.9)]"
                          : "border border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  ) : (
                    // PLAY — the whole song, right here (fetched once, cached).
                    // While it sounds, this IS its pause button, wherever it was started.
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (canPlay) void onPlaySong(s);
                      }}
                      disabled={!canPlay || loadingPlay === s.id}
                      title={isPlaying ? (paused ? "Resume" : "Pause") : undefined}
                      aria-label={
                        isPlaying
                          ? paused
                            ? `Resume ${s.title}`
                            : `Pause ${s.title}`
                          : `Play ${s.title}`
                      }
                      className="group/play relative mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-[1.06] active:scale-95 disabled:cursor-default disabled:opacity-30"
                    >
                      {/* the orb's own halo — every card carries a small pink sun.
                          It burns while the music SOUNDS, banks while it's held. */}
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
                      {/* the ring says "this is the song the app is carrying" — held or not */}
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
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="wordmark truncate pr-7 text-[20px] tracking-tight text-foreground">
                      {s.title}
                    </h3>
                    {/* ONE whisper of identity — genre · BPM · key (plus a status
                        only when something needs saying). Section chips and
                        counts are gone: that's the song page's story, and a
                        gallery drowning in data stops feeling like a gallery. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                      <span className="tabular-nums">{meta}</span>
                      {st && (
                        <>
                          <span className="text-muted/30">·</span>
                          <span className={s.status === "generating" ? "shimmer-text" : st.tone}>
                            {st.label}
                          </span>
                        </>
                      )}
                      {s.playlist && !activePlaylist && (
                        <>
                          <span className="text-muted/30">·</span>
                          <span className="truncate text-muted/60">{s.playlist}</span>
                        </>
                      )}
                      {isOwner && s.featured_at && (
                        <>
                          <span className="text-muted/30">·</span>
                          <span className="text-accent/70">Door</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              );
              return (
                <div
                  key={s.id}
                  style={{ "--i": Math.min(i, 10) } as CSSProperties}
                  className={`group animate-rise relative rounded-[22px] border bg-gradient-to-b transition duration-300 ${
                    sel
                      ? "-translate-y-1 border-accent from-accent/[0.2] to-white/[0.015] shadow-[0_24px_70px_-26px_rgba(224,49,156,.95)] ring-1 ring-accent/60"
                      : isPlaying
                        ? "playing-glow border-accent/60 from-accent/[0.12] to-white/[0.015]"
                        : s.status === "generating"
                          ? "border-accent/40 from-accent/[0.07] to-white/[0.015] shadow-[0_0_55px_-22px_rgba(224,49,156,.6)]"
                          : "border-white/[0.07] from-white/[0.06] to-white/[0.015] hover:-translate-y-0.5 hover:border-accent/25 hover:from-accent/[0.05] hover:shadow-[0_0_55px_-20px_rgba(224,49,156,.7)]"
                  }`}
                >
                  {selectMode ? (
                    // multi-select — tap to add/remove this loop from the pick
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={sel}
                      onClick={() => toggleSelect(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelect(s.id);
                        }
                      }}
                      className="flex cursor-pointer items-start gap-4 p-5"
                    >
                      {inner}
                    </div>
                  ) : (
                    <Link href={`/song/${s.id}`} className="flex items-start gap-4 p-5">
                      {inner}
                    </Link>
                  )}
                  {/* ✕ only in normal mode (desktop hover) — select mode deletes
                      in bulk from the bar, so mobile never shows it unprompted. */}
                  {!selectMode && (
                    <button
                      onClick={() => onDelete(s.id, s.title)}
                      disabled={busy || deleting}
                      title="Delete loop"
                      aria-label={`Delete ${s.title}`}
                      className="absolute right-3.5 top-4 hidden h-7 w-7 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-white/[0.06] hover:text-red-400 disabled:opacity-30 sm:flex sm:group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* the next page — one quiet action; the count says where you are */}
          {visible.length > shown && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-2.5 text-[14px] font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground hover:shadow-[0_0_32px_-12px_rgba(224,49,156,.6)] active:scale-[.98]"
              >
                Show more
              </button>
              <span className="text-[12px] tabular-nums text-muted/45">
                {paged.length} of {visible.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* SELECTION BAR — one floating glass pill (the command bar's language): the count,
          every playlist as a one-tap chip, an inline new-playlist field, delete, cancel. */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4 sm:bottom-7">
          <div className="cmdbar cmdbar-in flex w-full max-w-2xl flex-wrap items-center gap-1.5 rounded-[20px] border border-white/[0.09] bg-[#16111c]/90 p-2 shadow-[0_30px_90px_-26px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl">
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pl-3 pr-3.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
              <span className="text-[12px] font-medium tabular-nums text-foreground/85">
                {selected.size} selected
              </span>
            </span>
            {playlists.map((p) => (
              <button
                key={p}
                onClick={() => assignPlaylist(p)}
                title={`File in “${p}”`}
                className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-accent/15 hover:text-accent active:scale-[.97]"
              >
                {p}
              </button>
            ))}
            {activePlaylist && (
              <button
                onClick={() => assignPlaylist(null)}
                title={`Take out of “${activePlaylist}”`}
                className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-white/[0.1] hover:text-foreground active:scale-[.97]"
              >
                − {activePlaylist}
              </button>
            )}
            {/* OWNER ONLY — the door curator's one control: put the selection on
                the signed-out gallery, or (same tap, all already out) bring it home. */}
            {isOwner &&
              (() => {
                const allOut = [...selected].every(
                  (id) => songs.find((s) => s.id === id)?.featured_at,
                );
                return (
                  <button
                    onClick={() => void assignDoor()}
                    title={allOut ? "Take off the door" : "Put on the door"}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[.97] ${
                      allOut
                        ? "bg-accent/15 text-accent hover:bg-white/[0.08] hover:text-muted"
                        : "bg-white/[0.05] text-muted hover:bg-accent/15 hover:text-accent"
                    }`}
                  >
                    {allOut ? "− Door" : "Door"}
                  </button>
                );
              })()}
            {/* new playlist — an inline borderless field, right in the pill */}
            <input
              value={playlistName}
              maxLength={60}
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void assignPlaylist(playlistName);
                }
              }}
              placeholder="new playlist…"
              className="w-32 min-w-0 flex-1 border-0 bg-transparent px-2 text-[13px] text-foreground placeholder:text-muted/40"
            />
            <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />
            <button
              onClick={deleteSelected}
              disabled={deleting}
              title="Delete the selected loops"
              aria-label="Delete selected"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-300/70 transition hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 disabled:opacity-40"
            >
              {deleting ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
                </svg>
              )}
            </button>
            <button
              onClick={exitSelect}
              title="Done selecting"
              aria-label="Exit select mode"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted/55 transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* the open-project footer — quiet, but always there: the code, the
          room, and the deal. Links hide until lib/links.ts has real URLs. */}
      <footer className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-2 text-[12.5px] text-muted/60 pointer-coarse:text-muted/80">
        <Link href="/open" className="transition hover:text-foreground">
          Open, all the way down
        </Link>
        <a
          href={ZALTZ_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-foreground"
        >
          zaltz — our audio engine
        </a>
        {GITHUB_URL && (
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            GitHub
          </a>
        )}
        {DISCORD_URL && (
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Discord
          </a>
        )}
      </footer>
    </main>
  );
}

// Account control — just an initial avatar; the email + sign-out live behind a
// click, so the address isn't sitting in the open for anyone glancing over.
function AccountMenu({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initial = (email?.trim()?.[0] || "?").toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account"
        aria-label="Account"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[13px] font-medium text-foreground/80 transition hover:bg-white/[0.1] hover:text-foreground"
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
            {email && (
              <div
                className="truncate px-3 py-2 text-[12px] text-muted/70"
                title={email}
              >
                {email}
              </div>
            )}
            <Link
              href="/billing"
              className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
            >
              Tokens &amp; usage
            </Link>
            <button
              onClick={onSignOut}
              className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-foreground transition hover:bg-white/[0.06]"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateSheet({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (firstLoop: string, model: ModelId) => void;
}) {
  const [query, setQuery] = useState("");
  const model: ModelId = DEFAULT_MODEL; // one model — the picker died with the bake-off (2026-07-20)
  const [step, setStep] = useState(0);
  const kbInset = useKeyboardInset(); // bottom sheet must ride above the phone keyboard

  // While building, cycle evocative status lines so the wait feels alive — the
  // model is genuinely working.
  useEffect(() => {
    if (!busy) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % BUILD_STEPS.length), 2400);
    return () => clearInterval(id);
  }, [busy]);

  function submit() {
    if (busy || !query.trim()) return;
    onCreate(query.trim(), model);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
        aria-hidden
      />
      <div
        className="animate-rise relative z-10 w-full max-w-lg rounded-t-[28px] border border-white/[0.08] bg-[#101115] p-6 shadow-[0_-30px_90px_-30px_rgba(0,0,0,.9)] sm:rounded-[28px] sm:shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]"
        // keyboard lift: margin (not transform) so it doesn't fight animate-rise
        style={kbInset ? { marginBottom: kbInset } : undefined}
      >
        <h2 className="wordmark text-[24px] tracking-tight text-foreground">
          Start with a sound
        </h2>
        {busy ? (
          <p
            key={step}
            className="animate-fade-in mt-1.5 text-[14px] leading-relaxed"
          >
            <span className="shimmer-text">{BUILD_STEPS[step]}</span>
          </p>
        ) : (
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Describe any sound — a beat, a vibe, a melody. We&rsquo;ll figure out
            the rest and start building it for you.
          </p>
        )}

        <textarea
          autoFocus
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="e.g. a massive techno drop that feels like walking into a castle"
          className="mt-5 w-full resize-none rounded-2xl bg-white/[0.05] px-4 py-3.5 text-[15px] leading-relaxed text-foreground outline-none transition placeholder:text-muted/50 focus:bg-white/[0.08]"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 text-[14px] text-muted transition hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !query.trim()}
            className="btn-primary rounded-full px-6 py-2.5 text-[15px] font-medium transition active:scale-[.98] disabled:opacity-50"
          >
            {busy ? "Building…" : "Build it"}
          </button>
        </div>
      </div>
    </div>
  );
}
