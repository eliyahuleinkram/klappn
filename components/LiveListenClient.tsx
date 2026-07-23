"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PartRow, SongRow } from "@/lib/songs";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import type { SetEntry, SetTransition } from "@/lib/sets";
import { subscribe, isDead } from "@/lib/rtc";
import {
  TRANSITION_REST,
  sectionCps,
  makeClockSync,
  type LiveState,
  type SetLiveCtx,
} from "@/lib/set-live";
import { applyMediaSession, clearMediaSession } from "@/lib/media-session";
import { extractHydra } from "@/lib/hydra-embed";
import {
  clearLiveHydra,
  initLiveHydra,
  liveHydraReady,
  resetLiveTransport,
  runLiveHydra,
  syncFromState,
} from "@/lib/hydra-live";

/**
 * THE LISTENER — anyone with the link, on their own phone.
 *
 * STREAMING (not synthesis): the DJ's computer renders the whole set and
 * publishes ONE AUDIO mix stream to the Cloudflare Realtime SFU; this phone just
 * SUBSCRIBES and plays it. No engine, no scheduler, no reverbs on the phone —
 * playing a stream is the one audio thing every phone does flawlessly.
 *
 * THE VISUALS are NOT streamed — they're RENDERED here, natively, at full GPU
 * quality (lib/hydra-live). The DJ's visuals move purely off the Strudel transport
 * clock, so from the poll's sectionStartedAt + tempo we reconstruct that clock and
 * run the identical Hydra code in lockstep with the sound. Text, not video: no
 * bandwidth, no compression, no glitching. We poll the DJ's tiny state for the
 * now-playing label, the transport phase, and where the broadcast is.
 */

const POLL_MS = 1500;

interface SongBundle {
  song: SongRow;
  parts: PartRow[];
}

export default function LiveListenClient({
  token,
  setTitle,
  expiresAt,
  entries,
  transitions,
  songs,
}: {
  token: string;
  setTitle: string;
  expiresAt: string;
  entries: SetEntry[];
  transitions: Record<string, SetTransition>;
  songs: SongBundle[];
}) {
  // Code arrives SEALED from the server (lib/seal.ts) — open it once on entry.
  songs = useMemo(() => openDeep(songs), [songs]);
  transitions = useMemo(() => openDeep(transitions), [transitions]);
  const [joined, setJoined] = useState(false);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [nowLine, setNowLine] = useState<{ title: string; label: string | null }>({
    title: "",
    label: null,
  });

  const ctxRef = useRef<SetLiveCtx>({
    entries,
    songs: Object.fromEntries(songs.map((b) => [b.song.id, b])),
    transitions,
  });

  const [hasVisuals, setHasVisuals] = useState(false); // this section carries Hydra
  // The single audio element that plays the stream + the MediaStream it plays.
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const subSessionRef = useRef<string | null>(null); // broadcast session we're on
  const subBusyRef = useRef(false);
  const hydraCodeRef = useRef<string | null>(null); // the visual currently running
  // Server-clock estimation, same NTP-midpoint sync the DJ uses to STAMP
  // sectionStartedAt (SetClient). A single serverNow−Date.now() sample is biased
  // by the poll's downstream latency and jitters per poll; makeClockSync keeps
  // the smallest-RTT sample so the reconstructed visual phase stays steady.
  const clockRef = useRef(makeClockSync());

  // LOCAL pause — the listener silencing THEIR phone (lock screen or on-screen),
  // distinct from the DJ's hold (`paused`, from the poll). The stream stays live
  // on the SFU; pausing just stops this phone's elements and resume rejoins the
  // live point. The ref is the source of truth so the <audio> auto-replay guard
  // reads it synchronously (a lock-screen pause must NOT be instantly undone).
  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);
  function pauseLocal() {
    userPausedRef.current = true;
    setUserPaused(true);
    mediaRef.current?.pause();
  }
  async function resumeLocal() {
    userPausedRef.current = false;
    setUserPaused(false);
    try {
      await mediaRef.current?.play();
    } catch {
      /* gesture/interruption — the poll's ensureSubscribed will re-arm */
    }
  }

  /** Lazily create the play stream (once). */
  function ensureStream(): MediaStream {
    if (streamRef.current) return streamRef.current;
    streamRef.current = new MediaStream();
    return streamRef.current;
  }

  /** Human label for a section id — the song title + the loop/break name. */
  function describe(id: string | null): { title: string; label: string | null } {
    if (!id) return { title: "", label: null };
    const [entryId, rest] = id.split("|");
    const ctx = ctxRef.current;
    const entry = ctx.entries.find((e) => e.id === entryId);
    const bundle = entry ? ctx.songs[entry.songId] : undefined;
    const title = bundle?.song.title ?? "";
    if (rest === TRANSITION_REST) {
      const t = ctx.transitions[entryId];
      const worn = t && t.chosen != null ? t.options[t.chosen] : null;
      return { title, label: worn?.label ? sentenceLabel(worn.label) : "hand-off" };
    }
    if (rest?.startsWith("break:")) {
      const plan = (bundle?.song.plan ?? {}) as {
        breaks?: Record<string, { options: { label: string }[]; chosen: number | null }>;
      };
      const s = plan.breaks?.[rest.slice("break:".length)];
      const worn = s && s.chosen != null ? s.options[s.chosen] : null;
      return { title, label: worn?.label ? sentenceLabel(worn.label) : "break" };
    }
    const part = bundle?.parts.find((p) => p.id === rest);
    return { title, label: part?.label ?? null };
  }

  /** The Hydra program to render for a section id: the section's OWN @hydra block,
   *  else the song's visual (every part carries a copy — a song has ONE visual).
   *  Returns null for an audio-only song. */
  function sectionHydra(id: string | null): string | null {
    if (!id) return null;
    const [entryId, rest] = id.split("|");
    const ctx = ctxRef.current;
    const entry = ctx.entries.find((e) => e.id === entryId);
    const bundle = entry ? ctx.songs[entry.songId] : undefined;
    if (!bundle) return null;
    let code: string | null = null;
    if (rest === TRANSITION_REST) {
      const t = ctx.transitions[entryId];
      const worn = t && t.chosen != null ? t.options[t.chosen] : null;
      code = (worn as { strudel?: string } | null | undefined)?.strudel ?? null;
    } else if (rest?.startsWith("break:")) {
      const plan = (bundle.song.plan ?? {}) as {
        breaks?: Record<
          string,
          { options: { strudel?: string }[]; chosen: number | null }
        >;
      };
      const s = plan.breaks?.[rest.slice("break:".length)];
      const worn = s && s.chosen != null ? s.options[s.chosen] : null;
      code = worn?.strudel ?? null;
    } else {
      code = bundle.parts.find((p) => p.id === rest)?.strudel ?? null;
    }
    const own = extractHydra(code);
    if (own) return own;
    for (const p of bundle.parts) {
      const h = extractHydra(p.strudel);
      if (h) return h;
    }
    return null;
  }

  // LOCK SCREEN: a Spotify-style now-playing card while the stream plays in the
  // background — the set name, what's sounding right now, and branded artwork.
  // (The stream is live, so it's always "playing"; the listener follows the DJ.)
  useEffect(() => {
    if (!joined || ended) {
      clearMediaSession();
      return;
    }
    applyMediaSession({
      title: nowLine.title || setTitle || "Live set",
      subtitle: nowLine.label
        ? `${setTitle} · ${nowLine.label}`
        : setTitle || "Live on Klappn",
      album: "Live",
      playing: !paused && !userPaused,
      onPause: () => pauseLocal(),
      onPlay: () => void resumeLocal(),
      onStop: () => pauseLocal(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, ended, nowLine, paused, userPaused, setTitle]);
  useEffect(() => () => clearMediaSession(), []);

  // BOOT THE NATIVE VISUAL STAGE once joined (audio unlocked by the gesture). The
  // shared #hydra-canvas is fixed + full-screen; .live-stage lifts it to full
  // opacity. Half-res on small screens keeps a phone's GPU light. Torn down on
  // leave/end so the visuals never outlive the set.
  useEffect(() => {
    if (!joined || ended) return;
    document.body.classList.add("live-stage");
    const small = typeof window !== "undefined" && window.innerWidth < 720;
    void initLiveHydra(small ? 0.6 : 1);
    return () => {
      document.body.classList.remove("live-stage");
      clearLiveHydra();
    };
  }, [joined, ended]);

  /** (Re)subscribe to the DJ's broadcast — on first sight, when the session
   *  changes (DJ restarted), or when the connection died. Adds the DJ's tracks
   *  into the gesture-blessed media stream, so audio flows with no new play(). */
  async function ensureSubscribed(broadcast: NonNullable<LiveState["broadcast"]>) {
    if (!broadcast.session || subBusyRef.current) return;
    const pc = pcRef.current;
    const needNew =
      broadcast.session !== subSessionRef.current || (pc != null && isDead(pc));
    if (!needNew) return;
    subBusyRef.current = true;
    setConnecting(true);
    try {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          /* already closed */
        }
        pcRef.current = null;
      }
      const stream = ensureStream();
      for (const t of stream.getTracks()) {
        stream.removeTrack(t);
        t.stop();
      }
      // AUDIO ONLY — the visuals render locally (lib/hydra-live), not over the wire.
      const { pc: next } = await subscribe(
        broadcast.session,
        [broadcast.audio],
        stream,
        token,
      );
      pcRef.current = next;
      subSessionRef.current = broadcast.session;
      resetLiveTransport(); // fresh broadcast → re-seed the visual phase once
      // A jitter buffer smooths cellular hiccups (the "off-occasion" glitch) at
      // the cost of a little latency — invisible for a one-way listen. Chrome
      // honours jitterBufferTarget; Safari ignores it (best-effort).
      for (const rcv of next.getReceivers()) {
        try {
          (rcv as RTCRtpReceiver & { jitterBufferTarget?: number }).jitterBufferTarget = 300;
        } catch {
          /* not supported here */
        }
      }
      const el = mediaRef.current;
      if (el && !userPausedRef.current) {
        if (el.srcObject !== stream) el.srcObject = stream;
        await el.play().catch(() => {});
      }
      setConnecting(false);
    } catch (e) {
      console.error("[live] subscribe failed", e);
      subSessionRef.current = null; // force a retry next poll
      // Drop "Tuning in…" on failure — it's re-set when the next poll retries;
      // leaving it true strands the UI on the connecting state during an outage
      // even though the retry loop is still running underneath.
      setConnecting(false);
    } finally {
      subBusyRef.current = false;
    }
  }

  // The poll loop — reads the DJ's state for the label + broadcast location,
  // and manages the subscription. Only after the Join tap (audio unlock).
  useEffect(() => {
    if (!joined || ended) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // ±20% jitter so a crowd that joined together doesn't poll in lockstep.
    const next = () => {
      if (!alive) return;
      timer = setTimeout(tick, POLL_MS * (0.8 + Math.random() * 0.4));
    };
    const tick = async () => {
      try {
        const before = Date.now(); // for the NTP-midpoint clock sample
        const r = await fetch(`/api/live/${token}`, { cache: "no-store" });
        if (r.status === 410) {
          if (alive) endStream();
          return;
        }
        const j = (await r.json()) as { state?: LiveState; now?: number };
        const st = j.state;
        if (typeof j.now === "number")
          clockRef.current.sample(before, j.now, Date.now());
        if (alive && st && typeof st === "object" && "sectionId" in st) {
          setPaused(!!st.paused);
          setNowLine(describe(st.sectionId));
          if (st.broadcast) void ensureSubscribed(st.broadcast);
          // THE VISUALS, rendered here in lockstep with the streamed sound. Rebuild
          // OUR transport clock from the DJ's phase (server-clock) and swap the
          // Hydra program whenever the section's visual changes.
          if (st.sectionId && liveHydraReady()) {
            const skewMs = clockRef.current.offset(); // serverNow − localNow, best-RTT
            const cps = sectionCps(st.sectionId, ctxRef.current, st.nudge ?? 0);
            syncFromState(st.sectionStartedAt ?? Date.now() + skewMs, skewMs, cps);
            const hy = sectionHydra(st.sectionId);
            setHasVisuals(!!hy);
            if (hy) {
              if (hy !== hydraCodeRef.current) {
                hydraCodeRef.current = hy;
                runLiveHydra(hy);
              }
            } else if (hydraCodeRef.current) {
              hydraCodeRef.current = null;
              clearLiveHydra(); // moved to an audio-only song — dark the stage
            }
          }
        }
      } catch {
        /* a dropped poll is nothing — the next one carries on */
      }
      next();
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, ended]);

  function endStream() {
    setEnded(true);
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    const el = mediaRef.current;
    if (el) {
      el.pause();
      el.srcObject = null;
    }
  }

  // teardown on unmount
  useEffect(
    () => () => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  const hoursLeft = Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 36e5),
  );

  if (ended) {
    return (
      <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="wordmark text-gradient text-[34px] tracking-tight">
          The set has ended.
        </h1>
        <p className="mt-3 text-[14px] text-muted">Thanks for listening.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[85vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {/* THE STREAM SINK — a hidden <audio> that plays the DJ's mix. Blessed by
          the Join tap; the DJ's audio track is added to its stream on subscribe.
          AUTO-RESUME: iOS pauses media elements on interruptions (a call, an
          audio-route change) with no recovery — heard as "it just dropped off".
          A DJ pause sends SILENCE, never an element pause, so any pause here is
          unwanted → play again. Same for a stall. */}
      <audio
        ref={mediaRef}
        autoPlay
        // iOS inline-media policy: WebKit gates un-inline media playback (its
        // playsinline requirement) and srcObject streams have hit it on some
        // iOS versions. The engine's own hidden sinks set it too — cheap
        // insurance that the stream plays inline, in-page, on every iPhone.
        playsInline
        className="hidden"
        onPause={(e) => {
          // iOS pauses media on interruptions (a call, a route change) with no
          // recovery — heard as "it just dropped off". A DJ pause sends SILENCE,
          // never an element pause, so an unwanted pause here → play again. But a
          // DELIBERATE pause (lock screen / the on-screen button) must STICK.
          if (!ended && !userPausedRef.current)
            void e.currentTarget.play().catch(() => {});
        }}
        onStalled={(e) => {
          if (!ended && !userPausedRef.current)
            void e.currentTarget.play().catch(() => {});
        }}
      />
      {/* THE VISUALS render on the shared #hydra-canvas (lib/hydra-live), fixed
          full-screen BEHIND this content — nothing to mount here. A legibility
          scrim floats over the picture so the now-playing text stays readable. */}
      {hasVisuals && joined && (
        <div className="pointer-events-none fixed inset-0 z-[-1] bg-gradient-to-b from-black/45 via-black/25 to-black/70 transition-opacity duration-700" />
      )}
      {!joined ? (
        <>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-strong" />
            </span>
            Live now
          </p>
          <h1 className="wordmark text-gradient mt-4 text-[40px] leading-tight tracking-tight">
            {setTitle}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Put your headphones in.
            <br />
            Your phone plays the set as it happens.
          </p>
          <button
            onClick={() => {
              // Unlock the media element INSIDE the gesture: play the (empty)
              // stream now so later track arrivals flow without a fresh gesture.
              const stream = ensureStream();
              const el = mediaRef.current;
              if (el) {
                el.srcObject = stream;
                void el.play().catch(() => {});
              }
              setConnecting(true);
              setJoined(true);
            }}
            className="btn-primary mt-10 rounded-full px-10 py-4 text-[16px] font-medium transition active:scale-[.98]"
          >
            ▶ Join the set
          </button>
          <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-muted/50">
            live for ~{hoursLeft}h more
          </p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted/70">
            {!paused && !userPaused && !connecting && (
              <span className="flex h-3 items-end gap-[3px]" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="eq-bar w-[3px] rounded-full bg-accent-strong"
                    style={{ height: "100%", animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </span>
            )}
            {connecting
              ? "Tuning in…"
              : userPaused
                ? "Paused"
                : paused
                  ? "Holding…"
                  : "Live"}
          </p>
          <h1 className="wordmark text-gradient mt-4 text-[40px] leading-tight tracking-tight">
            {setTitle}
          </h1>
          <p className="mt-4 min-h-6 text-[15px] text-foreground/90">
            {nowLine.title ? (
              <>
                {nowLine.title}
                {nowLine.label && (
                  <span className="text-accent-strong"> · {nowLine.label}</span>
                )}
              </>
            ) : (
              <span className="shimmer-text">waiting for the DJ</span>
            )}
          </p>
          {/* No on-screen transport — the listen screen stays clean (visuals +
              what's playing). Pause/resume lives on the LOCK SCREEN / notification
              (MediaSession), so it works with the phone in your pocket. */}
        </>
      )}
    </main>
  );
}
