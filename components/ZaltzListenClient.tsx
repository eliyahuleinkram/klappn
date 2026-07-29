"use client";

import { useEffect, useRef, useState } from "react";
import { subscribe, isDead } from "@/lib/rtc";
import type { LiveState } from "@/lib/set-live";
import { applyMediaSession, clearMediaSession } from "@/lib/media-session";
import {
  clearLiveHydra,
  initLiveHydra,
  liveHydraReady,
  resetLiveTransport,
  runLiveHydra,
} from "@/lib/hydra-live";

/**
 * THE ZALTZ LISTENER — anyone with the link, hearing the live-coding room as
 * it happens (2026-07-28). Same contract as the set listener: the coder's
 * computer publishes ONE mixed audio stream to the Realtime SFU and this phone
 * just plays it; the room's hydra sketch travels as TEXT (the poll's `visual`)
 * and renders here at native GPU quality. No engine, no synthesis, no video.
 */

const POLL_MS = 1500;

export default function ZaltzListenClient({
  token,
  title,
  expiresAt,
  initialVisual,
}: {
  token: string;
  title: string;
  expiresAt: string;
  initialVisual: string | null;
}) {
  const [joined, setJoined] = useState(false);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hasVisuals, setHasVisuals] = useState(false);

  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const subSessionRef = useRef<string | null>(null);
  const subBusyRef = useRef(false);
  const hydraCodeRef = useRef<string | null>(null);
  const visualRef = useRef<string | null>(initialVisual);

  // LOCAL pause — the listener silencing THEIR phone; the stream stays live.
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

  function ensureStream(): MediaStream {
    if (streamRef.current) return streamRef.current;
    streamRef.current = new MediaStream();
    return streamRef.current;
  }

  // Lock-screen card while the stream plays in the background.
  useEffect(() => {
    if (!joined || ended) {
      clearMediaSession();
      return;
    }
    applyMediaSession({
      title: title || "the engine",
      subtitle: "Live on Klappn — the engine",
      album: "Live",
      playing: !paused && !userPaused,
      onPause: () => pauseLocal(),
      onPlay: () => void resumeLocal(),
      onStop: () => pauseLocal(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, ended, paused, userPaused, title]);
  useEffect(() => () => clearMediaSession(), []);

  // The native visual stage, once joined (same #hydra-canvas as the set page).
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

  /** (Re)subscribe to the room's broadcast — first sight, session change, or a
   *  dead connection. Tracks land in the gesture-blessed stream. */
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
      const { pc: next } = await subscribe(
        broadcast.session,
        [broadcast.audio],
        stream,
        token,
      );
      pcRef.current = next;
      subSessionRef.current = broadcast.session;
      resetLiveTransport();
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
      setConnecting(false);
    } finally {
      subBusyRef.current = false;
    }
  }

  // The poll — the broadcast location, the hold flag, and the room's sketch.
  useEffect(() => {
    if (!joined || ended) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      if (!alive) return;
      timer = setTimeout(tick, POLL_MS * (0.8 + Math.random() * 0.4));
    };
    const tick = async () => {
      try {
        const r = await fetch(`/api/live/${token}`, { cache: "no-store" });
        if (r.status === 410) {
          if (alive) endStream();
          return;
        }
        const j = (await r.json()) as {
          state?: LiveState;
          visual?: string | null;
        };
        const st = j.state;
        if (alive && st && typeof st === "object") {
          setPaused(!!st.paused);
          if (st.broadcast) void ensureSubscribed(st.broadcast);
        }
        if (alive) visualRef.current = j.visual ?? null;
        // THE PICTURE — the room's own hydra sketch, re-run only when the
        // coder actually changes it (text compare — a poll is not a repaint).
        if (alive && liveHydraReady()) {
          const hy = visualRef.current?.trim() ? visualRef.current : null;
          setHasVisuals(!!hy);
          if (hy) {
            if (hy !== hydraCodeRef.current) {
              hydraCodeRef.current = hy;
              runLiveHydra(hy);
            }
          } else if (hydraCodeRef.current) {
            hydraCodeRef.current = null;
            clearLiveHydra();
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
          The room has gone quiet.
        </h1>
        <p className="mt-3 text-[14px] text-muted">Thanks for listening.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[85vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {/* THE STREAM SINK — see LiveListenClient: gesture-blessed, auto-resumes
          through iOS interruptions; a deliberate pause sticks. */}
      <audio
        ref={mediaRef}
        autoPlay
        playsInline
        className="hidden"
        onPause={(e) => {
          if (!ended && !userPausedRef.current)
            void e.currentTarget.play().catch(() => {});
        }}
        onStalled={(e) => {
          if (!ended && !userPausedRef.current)
            void e.currentTarget.play().catch(() => {});
        }}
      />
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
            {title}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Someone is at the engine —
            <br />
            code becoming sound, as it happens.
          </p>
          <button
            onClick={() => {
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
            ▶ Step into the room
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
            {title}
          </h1>
          <p className="mt-4 min-h-6 text-[15px] text-foreground/90">
            the engine — code becoming sound, live
          </p>
        </>
      )}
    </main>
  );
}
