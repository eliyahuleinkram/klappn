/**
 * Browser-only Strudel engine wrapper.
 *
 * Strudel touches `window` / Web Audio and crashes if evaluated on the server,
 * so this module is imported lazily (dynamic `import()`) from inside a click
 * handler — never at module top-level and never during SSR. That gives the same
 * guarantee as a `ssr:false` dynamic import: the engine only ever loads in the
 * browser, after a user gesture (which browsers require before audio starts).
 *
 * IMPORTANT — sound parity with strudel.cc: `@strudel/web`'s default prebake
 * registers ONLY synth sounds (it ships `registerSoundfonts()` commented out and
 * loads no sample maps). strudel.cc, by contrast, loads the GM soundfonts plus a
 * set of sample maps from the `dough-samples` repo. If we don't replicate that,
 * (a) GM instruments like `gm_epiano1`/`gm_acoustic_bass` make NO sound, and
 * (b) bare drums like `s("sd")` resolve to a different sample than on strudel.cc
 * (their default `bd/sd/hh` come from EmuSP12, not tidalcycles/dirt-samples).
 * So we mirror strudel.cc's prebake exactly.
 */

import { isZaltz, zaltzActive, zaltzApplyOrbitGains, zaltzBootFailed, zaltzCycleNow, zaltzEvaluate, zaltzHush, zaltzLiveNote, zaltzOrbitGains, zaltzPause, zaltzResume, zaltzSetCps, zaltzStop } from "./zaltz";
import { extractHydra, stripHydraBlock } from "./hydra-embed";
import { capReverbs } from "./reverb-cap";
import {
  buildArrangement,
  nextUnit,
  spanAtCycle,
  type ArrangeSection,
  type ArrangeSpan,
  type SectionArrange,
  type SongEnding,
  type SongFx,
} from "./arrange";
// Keeps Safari 18.0.x from garbage-collecting AudioWorkletProcessor constructors
// out from under itself mid-playback (WebKit 279537/278512). See ensureStarted.
import { pinWorkletConstructors, readPinnedProcessors } from "./worklet-pin";

interface StrudelModule {
  initStrudel: (opts?: Record<string, unknown>) => Promise<unknown> | unknown;
  evaluate: (code: string, autoplay?: boolean) => Promise<unknown>;
  hush: () => void;
  samples: (...args: unknown[]) => Promise<unknown>;
  aliasBank?: (url: string) => Promise<unknown>;
  getAudioContext?: () => AudioContext;
  // Replace the engine's shared context (re-exported from ITS superdough copy —
  // never import setAudioContext from 'superdough' directly, see strudel-engine.ts).
  setAudioContext?: (ac: AudioContext) => AudioContext;
  // The scheduler's live clock: the current cycle position (a float, in cycles)
  // that DRIVES the audio. @strudel/web wires `getTime` to `repl.scheduler.now()`
  // (see web.mjs), so reading it tells us exactly where in the loop the music is.
  getTime?: () => number;
  // Swap the GLOBAL time source that signal sampling (incl. the H() visual bridge) reads.
  // Re-exported from @strudel/core. NB: the audio scheduler runs off its OWN absolute clock,
  // so overriding this only affects signal/visual sampling — never audio timing.
  setTime?: (fn: () => number) => void;
  // Loads the AudioWorklet DSP modules (addModule) onto the engine's context.
  // We call this during warm-up so worklet-based effects are ready before play.
  loadWorklets?: () => Promise<unknown>;
  // Cap simultaneous voices (voice stealing). CRITICAL on mobile — see
  // assertMaxPolyphony. Re-exported from superdough via @strudel/web.
  setMaxPolyphony?: (n: number) => void;
  // superdough's master output controller (re-exported through @strudel/web).
  // `output.destinationGain` is the master GainNode feeding ac.destination — the
  // tap point for WAV export.
  getSuperdoughAudioController?: () => {
    output?: { destinationGain?: AudioNode };
  };
  // superdough sample loader (re-exported through @strudel/web) — used to
  // PRELOAD a sound's audio buffer ahead of playback so nothing is silent on the
  // first hit. Takes a hap value { s, n } and an optional bank name.
  getSampleBuffer?: (
    hapValue: Record<string, unknown>,
    bank?: string,
  ) => Promise<unknown>;
  // superdough's raw voice trigger (re-exported through @strudel/web): plays
  // ONE hap value at an absolute context time — no pattern, no scheduler. The
  // live MIDI keyboard path (lib/midi-live.ts → triggerLiveNote) rides this.
  superdough?: (
    value: Record<string, unknown>,
    time: number,
    duration: number,
  ) => Promise<unknown>;
}

/** The TRUE loop length in CYCLES, measured from the actual pattern (not the
 *  regex estimate) — how many cycles before the whole loop repeats. Async +
 *  code-split (pulls the interpreter only when first needed). Returns null if it
 *  can't be measured, so callers fall back to the cheap estimate. */
export async function loopCycles(code: string): Promise<number | null> {
  try {
    const { loopCycles: fn } = await import("./strudel-interp");
    return await fn(code);
  } catch {
    return null;
  }
}

/** The current loop position, in CYCLES (a float), straight from the scheduler
 *  clock that drives the audio. Use this to phase-lock a UI playhead to what's
 *  actually playing — `cycle % loopBars / loopBars` is the exact bar progress,
 *  with 0 = the start of the loop's progression. Returns 0 when not started. */
export function currentCycle(): number {
  try {
    const t = mod?.getTime?.();
    return typeof t === "number" && Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

function audioContext(): AudioContext | null {
  try {
    return mod?.getAudioContext?.() ?? null;
  } catch {
    return null;
  }
}

/** Wait `ms` on the AUDIO clock. A locked phone throttles setTimeout to ≥1s
 *  granularity, but the audio context keeps exact time while background
 *  playback runs — a silent ConstantSource's `onended` fires at a sample-exact
 *  stop time, so live-set bar waits stay precise with the screen off. Falls
 *  back to setTimeout when no context is running; a late backstop timeout
 *  guarantees resolution even if the context suspends mid-wait. */
export function audioClockWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const ac = audioContext();
    if (!ac || ac.state !== "running" || !(ms > 0)) {
      setTimeout(resolve, Math.max(0, ms));
      return;
    }
    try {
      const src = ac.createConstantSource();
      // offset 0 = a stream of zeros — silent by construction, so no gate
      // GainNode is needed (it defaults to 1 = a loud DC step otherwise). It
      // stays CONNECTED to the destination: WebKit has historically skipped
      // onended on sources not wired into the rendered graph. One node per
      // wait instead of two — these arm continuously during playback.
      src.offset.value = 0;
      src.connect(ac.destination);
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        try {
          src.disconnect();
        } catch {
          /* already gone */
        }
        resolve();
      };
      src.onended = done;
      src.start();
      src.stop(ac.currentTime + ms / 1000);
      setTimeout(done, ms + 2000);
    } catch {
      setTimeout(resolve, ms);
    }
  });
}

// --- throttle-immune timers ----------------------------------------------------
// iOS Safari freezes setInterval/setTimeout on a hidden page to ~once per 30s+
// even while it happily lets the audio graph keep RENDERING. The engine's
// scheduler (zyklus) ticks on an injectable setInterval and every song boundary
// rode a setTimeout — both starved: with the screen off, each throttled tick
// scheduled only its ~0.2s lookahead window ("skip query: too late" for the
// rest), heard as a tiny burst of music then ages of silence, repeating.
// These timers run the SAME waits on the AUDIO clock instead: a silent
// ConstantSource fires onended at a sample-exact stop time, and audio events
// keep being delivered exactly as long as the context renders — the one thing
// the phone doesn't throttle (same primitive as audioClockWait above). When the
// context isn't running they fall back to real timers; a mid-flight death
// (context suspended under a pending wait) re-ARMS rather than fires, so a
// paused transport stays frozen and picks the right clock back up on resume.
interface AudioTimerState {
  cancelled: boolean;
  src: ConstantSourceNode | null;
  timer: ReturnType<typeof setTimeout> | null;
}
const audioTimers = new Map<number, AudioTimerState>();
let audioTimerSeq = 1;

function disarmAudioTimer(st: AudioTimerState): void {
  if (st.timer) {
    clearTimeout(st.timer);
    st.timer = null;
  }
  if (st.src) {
    try {
      st.src.onended = null;
      st.src.disconnect();
    } catch {
      /* already gone */
    }
    st.src = null;
  }
}

function armAudioDelay(st: AudioTimerState, ms: number, fire: () => void): void {
  if (st.cancelled) return;
  disarmAudioTimer(st);
  const ac = audioContext();
  if (ac && ac.state === "running") {
    try {
      const src = ac.createConstantSource();
      // offset 0 = silent by construction — no gate GainNode (see
      // audioClockWait). This is the hot path: the arrangement watcher re-arms
      // one of these 5×/s for the length of a song, and the desktop hidden-page
      // heartbeat ~10×/s; the old src+gain pair also LEAKED the gain (disarm
      // only disconnected src, leaving a GainNode wired to the destination
      // for the session on every re-arm/backstop).
      src.offset.value = 0;
      src.connect(ac.destination);
      let settled = false;
      src.onended = () => {
        if (settled || st.cancelled) return;
        settled = true;
        fire();
      };
      src.start();
      src.stop(ac.currentTime + ms / 1000);
      st.src = src;
      // If the context suspends under this wait, onended stalls with it —
      // correct for a paused transport. The backstop re-ARMS (never fires) so
      // a killed wait self-heals against whatever clock is live by then.
      st.timer = setTimeout(() => {
        if (!settled && !st.cancelled && audioContext()?.state === "running") {
          settled = true;
          armAudioDelay(st, ms, fire);
        } else if (!settled && !st.cancelled) {
          st.timer = setTimeout(() => armAudioDelay(st, ms, fire), ms);
        }
      }, ms + 2500);
      return;
    } catch {
      /* node creation failed — fall through to the plain timer */
    }
  }
  st.timer = setTimeout(() => {
    if (!st.cancelled) fire();
  }, ms);
}

/** setTimeout, but the wait rides the audio clock when the context is running
 *  (background-throttle immune). Cancel with clearAudioTimeout. */
function audioSetTimeout(cb: () => void, ms: number): number {
  const id = audioTimerSeq++;
  const st: AudioTimerState = { cancelled: false, src: null, timer: null };
  audioTimers.set(id, st);
  armAudioDelay(st, ms, () => {
    audioTimers.delete(id);
    cb();
  });
  return id;
}
function clearAudioTimeout(id: number | null): void {
  if (id == null) return;
  const st = audioTimers.get(id);
  if (!st) return;
  st.cancelled = true;
  disarmAudioTimer(st);
  audioTimers.delete(id);
}

// --- background-immune scheduler heartbeat (DESKTOP) ---------------------------
// Strudel's main-thread Cyclist scheduler runs off a stock setInterval(~100ms)
// that schedules only ~0.2s of audio ahead (both hard-coded in @strudel/core's
// zyklus). DESKTOP Safari clamps every main-thread timer on a page to ~1Hz the
// moment the window is HIDDEN (covered by another app, minimised, another Space,
// or a background tab) — WebKit's per-page DOM-timer alignment, which (unlike
// Chrome) has NO carve-out for a tab that is audibly playing. Starved to 1 tick/s
// the scheduler fills its 0.2s window then drops the ~0.8s backlog ("skip query:
// too late"), heard as playback dragging/hiccuping. Chrome exempts audible tabs,
// so it never bites there — matching the "only Safari, same Mac" report.
//
// The audio RENDER clock is NOT throttled while an audible context keeps
// rendering (desktop Safari doesn't suspend an audible context on occlusion), so
// we drive the scheduler off it — the same silent-ConstantSource onended trick
// as audioSetTimeout above. We keep the STOCK interval untouched for the common
// foreground path (steady, zero change) and only arm the audio-clock lifeline
// WHILE THE PAGE IS HIDDEN, so there is no node churn or redundant work when
// visible. Extra onTick calls while hidden are harmless: zyklus advances a
// monotonic phase only up to its lookahead, so a redundant tick schedules
// nothing twice. Desktop only — mobile PAUSES on background (so it never
// throttles mid-play) and the audio-clock timer's jitter hurt weak phones, which
// is why it was pulled. Kill switch: ?bgtimer=0 (or localStorage klappnBgTimer).
function bgSchedulerImmune(): boolean {
  if (typeof window === "undefined") return false;
  if (isMobileDevice()) return false; // mobile pauses on hide; leave it on stock timers
  try {
    const u = new URLSearchParams(window.location.search).get("bgtimer");
    if (u === "0") return false;
    if (u === "1") return true;
    const ls = localStorage.getItem("klappnBgTimer");
    if (ls === "0") return false;
    if (ls === "1") return true;
  } catch {
    /* URL/storage unavailable — fall through to the default */
  }
  return true; // default ON for desktop
}

interface BgTimerState {
  cancelled: boolean;
  stock: ReturnType<typeof setInterval>;
  audio: AudioTimerState;
  looping: boolean;
  onVis: () => void;
}
const bgTimers = new Map<number, BgTimerState>();
let bgTimerSeq = 1;

/** setInterval for the scheduler heartbeat: the STOCK timer as always, PLUS an
 *  audio-clock re-arming timer that fires the same callback while the page is
 *  hidden (Safari-throttle immune). Signature matches globalThis.setInterval so
 *  it can be handed to @strudel/core's clock. */
function bgSafeSetInterval(cb: () => void, ms: number): number {
  const id = bgTimerSeq++;
  const audio: AudioTimerState = { cancelled: false, src: null, timer: null };
  const st: BgTimerState = {
    cancelled: false,
    stock: setInterval(cb, ms),
    audio,
    looping: false,
    onVis: () => {},
  };
  const armLoop = () => {
    if (st.cancelled || st.looping) return;
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    st.looping = true;
    const tick = () => {
      if (
        st.cancelled ||
        (typeof document !== "undefined" && document.visibilityState === "visible")
      ) {
        st.looping = false;
        disarmAudioTimer(audio);
        return;
      }
      armAudioDelay(audio, ms, () => {
        if (st.cancelled) return;
        cb();
        tick();
      });
    };
    tick();
  };
  st.onVis = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") armLoop();
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", st.onVis);
    armLoop(); // cover the case where we're created while already hidden
  }
  bgTimers.set(id, st);
  return id;
}
function bgSafeClearInterval(id: number | undefined | null): void {
  if (id == null) return;
  const st = bgTimers.get(id);
  if (!st) return;
  st.cancelled = true;
  st.audio.cancelled = true;
  clearInterval(st.stock);
  disarmAudioTimer(st.audio);
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", st.onVis);
  bgTimers.delete(id);
}


/** This device's audio OUTPUT latency in ms — how far the audible sound runs
 *  behind the scheduler. Chrome reports the sink's real latency in
 *  `outputLatency` (Bluetooth ≈ 150–300ms); Safari/iOS omits it, so there only
 *  `baseLatency` (a few ms) is correctable and a BT offset remains. Live-set
 *  sync leads by this so the AUDIBLE downbeat lands on the shared bar grid.
 *  Clamped — some devices report garbage. */
export function outputLatencyMs(): number {
  const ac = audioContext();
  if (!ac) return 0;
  const out = (ac as unknown as { outputLatency?: number }).outputLatency;
  // When the opt-in scheduler shift is armed (see initSchedAhead) it IS output
  // latency from the outside (scheduler-to-ear delay) — live-set phrase
  // alignment must lead by it too. 0 when disarmed (the default).
  const ahead = mobileEngineAc ? schedAheadS : 0;
  const total =
    ((ac.baseLatency || 0) + (typeof out === "number" && out > 0 ? out : 0) + ahead) *
    1000;
  return Math.max(0, Math.min(1000, Math.round(total)));
}

// The Web Audio clock keeps running after hush() (which only stops SCHEDULING
// new notes), so already-sounding notes finish their release/reverb tails.
// Suspending the audio context freezes ALL output instantly — a genuine stop.
// We resume it right before the next playback.
//
// THE ELEMENT SINK MUST MUTE IN LOCKSTEP (2026-07-05): on phones the mix
// plays through a hidden <audio> element fed by a MediaStream (background
// playback). Suspending the context STARVES that stream while the element
// keeps pulling — and mobile browsers fill the starvation by repeating the
// last buffered slice, heard as a beat machine-gunning insanely fast on every
// pause/stop. MUTE (never pause) the element while the context isn't running:
// muted kills the machine-gun, but a PAUSED media element releases the OS's
// "this tab is playing" status — pausing here is what made backgrounding kill
// the music outright. resumeAudio() unmutes and revives everything.
function suspendAudio(): void {
  if (bgAudioEl) bgAudioEl.muted = true;
  void audioContext()?.suspend?.();
}
async function resumeAudio(): Promise<void> {
  const ac = audioContext();
  if (ac && ac.state !== "running" && ac.state !== "closed") {
    try {
      // RACE the resume: under Chrome's autoplay policy (and WebKit's), a
      // resume() called WITHOUT live user activation is left PENDING — never
      // rejected — so a bare `await` here would stall the whole play chain
      // (evaluate never runs; the tap looks dead). 1s is far beyond any
      // granted resume; a blocked one falls through and the retry below +
      // the sink guard win later.
      await Promise.race([
        ac.resume(), // covers "suspended" AND iOS's non-standard "interrupted"
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    } catch {
      /* ignore */
    }
    // Still not running while the transport SHOULD be sounding: a blocked
    // resume (spent activation) or iOS "interrupted" that fired NO statechange
    // leaves the sink guard's retry unarmed — recovery must not depend on an
    // event that may never come. Same 1Hz retry, armed directly.
    if ((ac.state as string) !== "running" && transportActive) armResumeRetry(ac);
  }
  for (const el of [bgAudioEl, bgAnchorEl]) {
    if (!el) continue;
    el.muted = el === bgAudioEl ? false : el.muted;
    if (el.paused) {
      try {
        await el.play(); // no fresh gesture needed — the first play() consumed one
      } catch {
        /* best-effort — worst case the direct route still sounds on unlock */
      }
    }
  }
}

// The OS suspends the context too (2026-07-05): iOS interrupts Web Audio when
// Safari backgrounds, a call/Siri lands, or the audio route changes — the
// stream freezes UNDER the still-playing element sink (machine-gun, OS side).
// Mirror the sink's MUTE to the context's ACTUAL state, whoever changed it;
// while music is SUPPOSED to be playing, fight the interruption with resume
// retries (the silent anchor holds the audio session, so retries can win even
// in the background); and on returning to a visible page, restart everything.
let sinkGuardInstalled = false;
let resumeRetryTimer: ReturnType<typeof setInterval> | null = null;
/** Fight an unwanted suspend/interruption with 1Hz resume() retries while music
 *  is supposed to be playing. iOS keeps the context "interrupted" through a
 *  call/Siri/route change and a single resume() often loses that race — but the
 *  silent anchor holds the audio session, so retries can win even backgrounded.
 *  Shared by the statechange guard AND resumeAudio (a blocked first unlock
 *  never fires statechange at all). Self-clears on success/stop/20 tries. */
function armResumeRetry(ac: AudioContext): void {
  if (resumeRetryTimer) return;
  let tries = 0;
  resumeRetryTimer = setInterval(() => {
    if ((ac.state as string) === "running" || !transportActive || ++tries > 20) {
      if (resumeRetryTimer) clearInterval(resumeRetryTimer);
      resumeRetryTimer = null;
      return;
    }
    void ac.resume().catch(() => {});
  }, 1000);
  // BELT: iOS can refuse every timer-driven resume() after a background kill —
  // only a real gesture wins. Borrow the next tap anywhere.
  if (typeof document !== "undefined") {
    document.addEventListener(
      "pointerdown",
      () => {
        if ((ac.state as string) !== "running" && transportActive) {
          void ac.resume().catch(() => {});
          for (const el of [bgAudioEl, bgAnchorEl])
            if (el && el.paused) void el.play().catch(() => {});
        }
      },
      { once: true, capture: true },
    );
  }
}
/** Spend the CURRENT tap on the context, synchronously — before any await.
 *  iOS Safari and Chrome's autoplay policy honour AudioContext.resume() only
 *  while the gesture's transient activation is live; a COLD first play awaits
 *  ensureStarted() (seconds of module + sample loading) before resumeAudio(),
 *  by which time the activation can be spent and the resume is silently
 *  deferred — context stuck "suspended": running clock, total silence, and no
 *  statechange to trigger recovery. If warm-up already created the (suspended)
 *  context — the normal flow — unlock it here, inside the gesture. */
function kickResumeInGesture(): void {
  try {
    const ac = audioContext();
    if (ac && ac.state !== "running" && ac.state !== "closed")
      void ac.resume().catch(() => {});
  } catch {
    /* best-effort — resumeAudio() follows on the async path */
  }
}
function installSinkGuard(ac: AudioContext): void {
  if (sinkGuardInstalled || typeof document === "undefined") return;
  sinkGuardInstalled = true;
  ac.addEventListener("statechange", () => {
    if ((ac.state as string) === "running") {
      if (bgAudioEl) {
        bgAudioEl.muted = false;
        if (bgAudioEl.paused) void bgAudioEl.play().catch(() => {});
      }
      if (resumeRetryTimer) {
        clearInterval(resumeRetryTimer);
        resumeRetryTimer = null;
      }
      return;
    }
    if (bgAudioEl) bgAudioEl.muted = true;
    // transportActive is false on OUR deliberate pause/stop (set before the
    // suspend) — retries only fight suspends the user didn't ask for.
    if (transportActive) armResumeRetry(ac);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      // MOBILE HOLDS ON HIDE (2026-07-22, confirmed on a real iPhone): the
      // pattern walk lives on the MAIN thread and a backgrounded iOS page
      // wakes it ~once a second — a 0.35s lookahead starves into stutter.
      // Until scheduling moves into the worklet, phones HOLD the music the
      // moment the page hides and resume on return; desktop plays on (its
      // main thread never freezes). The armed sink + silent anchor keep the
      // audio session alive through the hold, so the resume is instant.
      if (isMobileDevice() && transportActive) {
        autoPausedByHide = true;
        pausePlayback();
        autoPauseSink?.(true); // flip the UI + lock-screen icon to paused
      }
      return;
    }
    if (autoPausedByHide) {
      autoPausedByHide = false;
      void resumePlayback(); // we paused it — we bring it back
      autoPauseSink?.(false);
      return;
    }
    if (transportActive && (ac.state as string) !== "running") void resumeAudio();
  });
  // BELT: iOS fires pagehide more reliably than visibilitychange on some
  // app-switch/lock transitions — same hold, whichever arrives first.
  window.addEventListener("pagehide", () => {
    if (isMobileDevice() && transportActive) {
      autoPausedByHide = true;
      pausePlayback();
      autoPauseSink?.(true);
    }
  });
  // BELT #2: a bfcache restore (iOS back-swipe, Safari tab restore) fires
  // pageshow — and iOS Safari can bring the page back with the context left
  // "interrupted"/"suspended" WITHOUT a visibilitychange or statechange (the
  // page was frozen when the interruption landed, so the event was never
  // delivered). Run the same recovery as the visible branch above; on a
  // non-bfcache initial load both conditions are false and this is a no-op.
  window.addEventListener("pageshow", () => {
    if (autoPausedByHide) {
      autoPausedByHide = false;
      void resumePlayback();
      autoPauseSink?.(false);
      return;
    }
    if (transportActive && (ac.state as string) !== "running") void resumeAudio();
  });
}
let autoPausedByHide = false;
// The UI owns the play/pause icon + the lock-screen state; when WE auto-pause on
// background (or resume on return) it must follow. now-playing registers this.
let autoPauseSink: ((paused: boolean) => void) | null = null;
export function setAutoPauseSink(fn: ((paused: boolean) => void) | null): void {
  autoPauseSink = fn;
}

let initPromise: Promise<StrudelModule> | null = null;

// PHONES: the engine context we create (latencyHint "playback") — held so the
// scheduler's getTime can be shifted against it (see schedAheadS).
let mobileEngineAc: AudioContext | null = null;
// EXPERIMENT, OFF BY DEFAULT (2026-07-06): running the scheduler's clock ahead
// of the real audio clock widens the engine's hard-coded ~0.3s stall headroom
// (seam bursts: synchronous reverb-IR regeneration, voice-graph builds,
// first-use buffers) — but the first live trial "made the timing completely
// out of whack" on a real iPhone, something desktop verification cannot hear.
// So it ships DISARMED and is enabled per-device for a LISTENING test:
//   ?sa=350 on any URL (or localStorage klappnSchedAheadMs) → 350ms shift
//   ?sa=0 → off again.  The ear is the acceptance test; never default this on
// without one.
let schedAheadS = 0;
// MOBILE REVERB LIGHTENING (2026-07-06k): reverb convolution is the dominant
// audio-thread cost (proven in the orbit-leak hunt) and its price scales with
// tail LENGTH (roomsize → IR sample count). A dense loop stacking several long
// reverbs (e.g. "Golem Strut": 13 layers, 4 reverbs) overruns a phone's
// real-time synthesis budget → it "trips out". Capping the tail makes each
// convolver 2–3× cheaper while keeping the reverb's character — and at club
// tempo a 4s tail is buried by the next hit anyway. Desktop keeps full tails;
// ?rev=full restores them on mobile for an A/B.
let mobileLighten = true;
const MOBILE_ROOMSIZE_CAP = 1.5;
// ...and cap the NUMBER of reverbs too: each `.room` layer on a distinct orbit
// is a whole convolution reverb, and the composer stacks them (Golem Strut: 5
// reverb layers). Convolver COUNT is a bigger cost than tail length, so on
// mobile keep reverb only on the strongest few sends (capReverbs) and strip the
// rest — reverb-as-a-shared-send, the way a mix engineer would. Tunable ?revn=N.
let mobileMaxReverbs = 2;
function initSchedAhead(): void {
  // OFF BY DEFAULT (2026-07-06j): the 300ms phone default was for the DJ
  // touch-freeze case (dragging deck controls while performing) — irrelevant
  // to just LISTENING to a song, and the clock shift is another suspect for
  // mobile song audio "going a little crazy". Mobile live moves to streaming,
  // so nothing needs it by default. ?sa=NNN re-enables per-device for testing.
  const MOBILE_DEFAULT_MS = 0;
  try {
    const vq = new URLSearchParams(window.location.search).get("vis");
    if (vq !== null)
      localStorage.setItem("klappnMobileVisuals", vq === "1" ? "1" : "0");
    // ?rev=full restores the full-length reverbs on mobile (A/B the lighten);
    // ?rev=lite (or default) shortens them. See lightenForMobile.
    const rq = new URLSearchParams(window.location.search).get("rev");
    if (rq !== null) localStorage.setItem("klappnRevFull", rq === "full" ? "1" : "0");
    mobileLighten = localStorage.getItem("klappnRevFull") !== "1";
    // ?revn=N caps the reverb-layer count on mobile (0 = don't cap; default 2)
    const rn = new URLSearchParams(window.location.search).get("revn");
    if (rn !== null) localStorage.setItem("klappnMaxReverbs", String(Math.max(0, Math.min(12, Number(rn) || 0))));
    const storedRn = localStorage.getItem("klappnMaxReverbs");
    if (storedRn !== null) mobileMaxReverbs = Number(storedRn);
  } catch {
    /* flags are best-effort */
  }
  try {
    const q = new URLSearchParams(window.location.search).get("sa");
    if (q !== null) {
      const ms = Math.max(0, Math.min(1000, Number(q) || 0));
      if (ms > 0) localStorage.setItem("klappnSchedAheadMs", String(ms));
      else localStorage.setItem("klappnSchedAheadMs", "0"); // explicit off
    }
    const stored = localStorage.getItem("klappnSchedAheadMs");
    const ms =
      stored !== null
        ? Math.max(0, Math.min(1000, Number(stored) || 0))
        : isMobileDevice()
          ? MOBILE_DEFAULT_MS
          : 0;
    schedAheadS = ms / 1000;
  } catch {
    schedAheadS = isMobileDevice() ? MOBILE_DEFAULT_MS / 1000 : 0;
  }
}
let mod: StrudelModule | null = null;
let currentPartId: string | null = null;

// ── PLAYBACK-ERROR CAPTURE (auto self-heal) ──────────────────────────────────
// A generated loop can fail at PLAYBACK two ways, and we capture BOTH: (1) a synchronous eval/build error
// (bad method, syntax) — the `evaluate()` promise rejects, caught in playPart; (2) an async runtime error
// (e.g. "sound not found", a per-cycle query crash) — surfaced via Strudel's typed `strudel.log` DOM event
// (installStrudelErrorListener). Both go to a sink (SongClient), which asks the server to repair the loop
// and re-plays the fix. Only real ERRORS fire — the engine's ordinary logs (start/stop/code updated/sample
// loads) never do. The sink is registered by the UI; nothing here decides policy.
type StrudelErrorInfo = { partId: string | null; error: string };
let strudelErrorSink: ((info: StrudelErrorInfo) => void) | null = null;
/** Register (or clear with null) the handler that receives playback errors for auto-repair. */
export function setStrudelErrorSink(fn: ((info: StrudelErrorInfo) => void) | null): void {
  strudelErrorSink = fn;
}
let lastErrReport = { key: "", at: 0 };
/** BENIGN engine noise the self-heal must IGNORE — not a broken loop. A duck
 *  can fire before its target orbit's FIRST event has materialized the bus
 *  (and a muted/soloed-away target never materializes it): superdough skips
 *  that tick and recovers by itself. Treating it as a playback error sent the
 *  repair loop chasing a healthy line forever ("Fixing a playback glitch…"
 *  that never resolves — seen live on song 37c6f2a7, 2026-07-14). */
const BENIGN_PLAYBACK_ERR = /duck target orbit .+ does not exist/i;
/** Report one playback error to the sink, deduped (the async ones re-log every cycle). */
function reportStrudelError(error: string, partId: string | null = currentPartId): void {
  if (!error || !strudelErrorSink) return;
  if (BENIGN_PLAYBACK_ERR.test(error)) return;
  const key = `${partId}|${error}`.slice(0, 240);
  const now = performance.now();
  if (key === lastErrReport.key && now - lastErrReport.at < 4000) return; // same error within 4s → ignore
  lastErrReport = { key, at: now };
  try {
    strudelErrorSink({ partId, error });
  } catch {
    /* the sink must never break playback */
  }
}

// The SAME self-heal, but for the loop's VISUAL (@hydra): a Hydra render/eval error is caught in the
// visuals path (updateVisuals / evalProgram) and reported to a SEPARATE sink so the UI repairs the
// VISUAL (repairPartVisual), not the audio. A broken visual just doesn't show — never breaks the audio.
let hydraErrorSink: ((info: StrudelErrorInfo) => void) | null = null;
/** Register (or clear with null) the handler that receives Hydra visual errors for auto-repair. */
export function setHydraErrorSink(fn: ((info: StrudelErrorInfo) => void) | null): void {
  hydraErrorSink = fn;
}
let lastHydraErr = { key: "", at: 0 };
function reportHydraError(error: string, partId: string | null = currentPartId): void {
  if (!error || !hydraErrorSink) return;
  const key = `${partId}|${error}`.slice(0, 240);
  const now = performance.now();
  if (key === lastHydraErr.key && now - lastHydraErr.at < 4000) return;
  lastHydraErr = { key, at: now };
  try {
    hydraErrorSink({ partId, error });
  } catch {
    /* the sink must never break playback */
  }
}

// ── CONSOLE GATE ──────────────────────────────────────────────────────────────
// One console hook, two jobs:
//
// (1) CAPTURE the #1 Hydra failure — an INVALID SHADER — which is SWALLOWED: regl throws, hydra
// catches it and only `console.warn('shader could not compile', err)` (hydra-synth/src/
// glsl-source.js), and the compile happens on a RENDER tick, AFTER evaluate() returns. So neither
// our eval try/catch nor a thrown path ever sees it. The ONLY signal is that console line — so we
// hook it (unambiguous, no false positives) and route it to the visual repair sink.
//
// (2) In PRODUCTION, keep the engine's chatter OUT of the user's console entirely — DEFAULT-DENY
// for the log level: console.log/info/debug print ONLY lines carrying our own "[klappn]" tag.
// (An allowlist, not a fingerprint list: the first pass pattern-matched known engine lines, and a
// dep that logged bare numbers sailed straight through — deny-by-default can't be surprised like
// that.) warn/error still pass through unless they match known engine noise, so real app failures
// stay visible. Muting loses NOTHING for self-heal: Strudel's logger mirrors every message as a
// `strudel.log` DOM event — the channel our error capture actually listens on
// (installStrudelErrorListener) — and shader errors are captured right here before the mute.
// In dev the console stays fully verbose; on prod, `localStorage.klappnDebug = "1"` (or ?kdebug)
// restores full output for our own debugging (same flag gates the __klappn diagnostics).
let consoleGateInstalled = false;
const QUIET_CONSOLE = process.env.NODE_ENV === "production";
function debugConsoleWanted(): boolean {
  try {
    return (
      (typeof localStorage !== "undefined" && localStorage.getItem("klappnDebug") === "1") ||
      (typeof location !== "undefined" && location.search.includes("kdebug"))
    );
  } catch {
    return false;
  }
}
const SHADER_ERR = /shader could not compile|compiling (fragment|vertex) shader/i;
// warn/error lines from the audio/visual libs — muted; anything else keeps printing.
const ENGINE_NOISE = [
  /^load .+ from /, // sample/font load chatter
  /^getSound: expected string/,
  /could not load AudioWorklet effects/,
  /^type .+ not recognized/, // visual-chain warnings
  /no support for renderpass/,
  /function does not return a number/,
  /\(regl\)/,
  /loaded more than once/, // engine double-instance warning
  /^\[(cyclist|eval|sampler|webaudio|superdough|getTrigger|mini)\]/, // logger-origin tags
];
function installConsoleGate(): void {
  if (consoleGateInstalled || typeof console === "undefined") return;
  consoleGateInstalled = true;
  const quiet = QUIET_CONSOLE && !debugConsoleWanted();
  const text = (args: unknown[]): string =>
    args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
  const wrap =
    (orig: (...a: unknown[]) => void, level: "chatter" | "problem") =>
    (...args: unknown[]): void => {
      let drop = false;
      try {
        const t = text(args);
        const ours = t.includes("[klappn]");
        if (SHADER_ERR.test(t) && !ours) reportHydraError(t.slice(0, 400)); // capture BEFORE the mute — repair never depends on the print
        drop =
          quiet && !ours && (level === "chatter" || ENGINE_NOISE.some((re) => re.test(t)));
      } catch {
        /* never throw from the hook */
      }
      if (!drop) orig(...args);
    };
  console.log = wrap(console.log.bind(console), "chatter");
  console.info = wrap(console.info.bind(console), "chatter");
  console.debug = wrap(console.debug.bind(console), "chatter");
  console.warn = wrap(console.warn.bind(console), "problem");
  console.error = wrap(console.error.bind(console), "problem");
}
let strudelLogHooked = false;
/**
 * Subscribe ONCE to Strudel's own log channel and forward ONLY real errors to the repair sink.
 *
 * Strudel's `logger()` (@strudel/core/logger.mjs) sends EVERY message through `console.log` (never
 * console.error in the prod build), AND dispatches a `strudel.log` CustomEvent on `document` with a
 * `type`. So the reliable, unambiguous error signal is that event — NOT scraping the console. A message
 * is an error iff `type === "error"` (repl eval errors, sampler "could not load") OR its text carries the
 * `errorLogger` format `"[origin] error: …"` (cyclist/query/getTrigger runtime throws, incl. "sound not
 * found"). Every benign log the engine prints — `[cyclist] start/stop`, `[eval] code updated`,
 * `[sampler] … took too long` (type "highlight"), `load sound … done!` — has neither, so it never fires.
 */
function installStrudelErrorListener(): void {
  if (strudelLogHooked || typeof document === "undefined") return;
  strudelLogHooked = true;
  document.addEventListener("strudel.log", (e: Event) => {
    try {
      const detail = (e as CustomEvent).detail as { message?: unknown; type?: unknown } | undefined;
      const message = typeof detail?.message === "string" ? detail.message : "";
      const type = typeof detail?.type === "string" ? detail.type : "";
      const isError = type === "error" || / error:\s/i.test(message);
      if (isError) reportStrudelError(message);
    } catch {
      /* never let the listener throw into the audio thread */
    }
  });
}
// gm_* font warm — fetch the FONT FILE through our proxy (1y-cached) so the
// first Play parses it from browser cache instead of the network. Both engines
// (zaltz's vendored loader AND superdough's fontloader) fetch the same
// /api/snd/f/<font>.js URL, so one fetch warms either path. NB the
// `loadSoundfont` @strudel/soundfonts exports is sfumato's, which takes a URL —
// passing it a bare gm_* name made the browser resolve the name against the
// PAGE url, one 500 per gm sound on every song load (2026-07-19).
let gmFontMap: Record<string, string[]> | null = null;
async function warmGmFont(tok: string): Promise<void> {
  if (!gmFontMap) {
    const gm = (await import("./vendor/soundfonts/gm.mjs")) as unknown as {
      default: Record<string, string[]>;
    };
    gmFontMap = gm.default;
  }
  const fonts = gmFontMap[tok];
  if (!fonts?.length) return;
  await fetch(`/api/snd/f/${fonts[0]}.js`);
}

// --- clickless delay bus ------------------------------------------------------
// superdough mutates its per-orbit FeedbackDelay with setValueAtTime — an
// INSTANT step. A feedback step lands inside a RECIRCULATING loop (one tick,
// repeated each echo); a delayTime step is a hard discontinuity on a ringing
// buffer. Any effect glide riding .delayfeedback re-values it EVERY EVENT →
// a click per event under the glide (2026-07-14, "Niggun fragment drifts").
// superdough installs the delay via BaseAudioContext.prototype
// .createFeedbackDelay (its own seam) — wrap that same seam ONCE so those
// params always move as short setTargetAtTime ramps: 20ms on feedback
// (inaudible as a transition, kills the step), 60ms on delayTime (a subtle
// tape-glide instead of a click). The music's values are untouched — only
// HOW they move.
let delayBusSmoothed = false;
function smoothDelayBus(): void {
  if (delayBusSmoothed) return;
  try {
    const proto = (
      globalThis as unknown as {
        BaseAudioContext?: { prototype: Record<string, unknown> };
      }
    ).BaseAudioContext?.prototype;
    const orig = proto?.createFeedbackDelay as
      | ((wet: number, time: number, feedback: number) => AudioNode)
      | undefined;
    if (!proto || typeof orig !== "function") return; // engine not loaded yet — next call
    proto.createFeedbackDelay = function (
      this: BaseAudioContext,
      wet: number,
      time: number,
      feedback: number,
    ) {
      const node = orig.call(this, wet, time, feedback) as AudioNode & {
        feedback?: AudioParam;
        delayTime?: AudioParam;
      };
      for (const [key, tc] of [
        ["feedback", 0.02],
        ["delayTime", 0.06],
      ] as const) {
        const param = node[key];
        if (!param || typeof param.setTargetAtTime !== "function") continue;
        param.setValueAtTime = ((v: number, t: number) => {
          param.setTargetAtTime(v, Math.max(t, 0), tc);
          return param;
        }) as AudioParam["setValueAtTime"];
      }
      return node;
    };
    delayBusSmoothed = true;
  } catch {
    /* smoothing is an enhancement — a failure must never block the engine */
  }
}

// --- master limiter ---------------------------------------------------------
// A brickwall-ish limiter on the output so the mix can NEVER hard-clip into
// crackle, no matter how high the Tweak faders are pushed. We splice a
// DynamicsCompressor between superdough's master gain and the speakers. Exports
// tap the post-limiter node so files match what you hear.
let outputTap: AudioNode | null = null; // post-limiter node (or null = use master)
let limiterInstalled = false;

function masterNode(): AudioNode | undefined {
  return mod?.getSuperdoughAudioController?.()?.output?.destinationGain as
    | AudioNode
    | undefined;
}

/** Where the chain's last node feeds: the background <audio> sink while the
 *  phone reroute is up (see enableBackgroundPlayback), else the speakers. */
function outputSink(ac: AudioContext): AudioNode {
  // Reflects the CURRENT route (see routeSink): the element sink carries the
  // mix only while the page is hidden; visible playback is direct.
  return sinkRouted && bgStreamDest ? bgStreamDest : ac.destination;
}

// --- LIVE PERF FX (master bus) -------------------------------------------------
// The deck's filter/echo/punch/space dials are MASTER-BUS semantics by design,
// but they used to be applied by REWRITING every layer's code and re-evaluating
// the whole arrangement — on a phone that compile blocked the main thread for
// up to a second, starving the scheduler: "every change freezes the sound".
// Live dials must never compile. This chain hangs after the limiter and the
// dials write Web Audio params directly — instant, glitch-free, zero compile.
// The KEY dial (re-pitching notes) is the one that still rides code.
interface PerfFx {
  input: GainNode;
  out: GainNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  driveWet: GainNode;
  echoSend: GainNode;
  spaceSend: GainNode;
  conv: ConvolverNode;
  convConnected: boolean;
  convKill: ReturnType<typeof setTimeout> | null;
}
let perfFx: PerfFx | null = null;

/** Build + splice the master perf chain (idempotent). Called at SET play
 *  start — the song page never installs it, keeping its path untouched. */
export function ensurePerfFx(): void {
  if (perfFx) return;
  installLimiter(); // the chain hangs POST-limiter — splice order matters
  const ac = audioContext();
  const tap = outputTap ?? masterNode();
  if (!ac || !tap) return;
  try {
    const input = ac.createGain();
    // inline: HP → LP (both open by default — bit-transparent at rest)
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 20;
    hp.Q.value = 0.7;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 20000;
    lp.Q.value = 0.7;
    const out = ac.createGain();
    input.connect(hp);
    hp.connect(lp);
    lp.connect(out);
    // punch: parallel saturation, wet mix = the dial (0..0.5)
    const driveShaper = ac.createWaveShaper();
    const N = 1024;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      curve[i] = Math.tanh(2.5 * x);
    }
    driveShaper.curve = curve;
    driveShaper.oversample = "2x";
    const driveWet = ac.createGain();
    driveWet.gain.value = 0;
    lp.connect(driveShaper);
    driveShaper.connect(driveWet);
    driveWet.connect(out);
    // echo: feedback delay send (send level = the dial, 0..0.7)
    const echoSend = ac.createGain();
    echoSend.gain.value = 0;
    const delay = ac.createDelay(1.5);
    delay.delayTime.value = 0.375;
    const fb = ac.createGain();
    fb.gain.value = 0.4;
    const echoTone = ac.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 4500;
    lp.connect(echoSend);
    echoSend.connect(delay);
    delay.connect(echoTone);
    echoTone.connect(fb);
    fb.connect(delay);
    echoTone.connect(out);
    // space: reverb send (send level = the dial, 0..0.6) — IR generated ONCE,
    // here at install time, never per dial move.
    const spaceSend = ac.createGain();
    spaceSend.gain.value = 0;
    const conv = ac.createConvolver();
    const secs = 1.6;
    const len = Math.floor(ac.sampleRate * secs);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    conv.buffer = ir;
    lp.connect(spaceSend);
    // conv connects LAZILY (see setLivePerf): a convolver crunches its full
    // FFT load even on silence — phones must not pay for an idle reverb.
    conv.connect(out);
    // splice into the output: tap → input, out → wherever the tap pointed
    const sink = outputSink(ac);
    try {
      tap.disconnect(sink);
    } catch {
      /* tap wasn't on this sink */
    }
    tap.connect(input);
    out.connect(sink);
    perfFx = { input, out, hp, lp, driveWet, echoSend, spaceSend, conv, convConnected: false, convKill: null };
  } catch (e) {
    console.error("[klappn] perf fx failed to install; dials fall back to code", e);
  }
}

/** The node whose downstream edge routeSink()/the bg sink move around. */
function finalTap(): AudioNode | undefined {
  return perfFx?.out ?? outputTap ?? masterNode();
}

// --- PLAY DIAGNOSTIC (klappnDebug only) ----------------------------------------
// A self-diagnosing recorder for the play-start glitch hunt: at every fresh
// play (with localStorage.klappnDebug = "1") a tiny capture worklet taps the
// FINAL output for 4s and prints a numeric verdict — first-sound time, click
// list, silence gaps, envelope — so a reproduction becomes pasteable data
// instead of a description. Audio-thread capture: it can never distort what
// it measures. The raw buffer lands on window.__klappnDiagBuf for deeper digs.
let diagModuleReady: Promise<void> | null = null;
function ensureDiagWorklet(ac: AudioContext): Promise<void> {
  if (!diagModuleReady) {
    const src = `
      class KlappnDiag extends AudioWorkletProcessor {
        constructor() { super(); this.buf = null; this.n = 0;
          this.port.onmessage = (e) => { this.buf = new Float32Array(e.data.frames); this.n = 0; };
        }
        process(inputs) {
          const ch = inputs[0] && inputs[0][0];
          if (this.buf && ch) {
            const room = this.buf.length - this.n;
            const take = Math.min(room, ch.length);
            this.buf.set(take === ch.length ? ch : ch.subarray(0, take), this.n);
            this.n += take;
            if (this.n >= this.buf.length) {
              const done = this.buf; this.buf = null;
              this.port.postMessage(done, [done.buffer]);
            }
          }
          return true;
        }
      }
      registerProcessor("klappn-diag", KlappnDiag);
    `;
    const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
    diagModuleReady = ac.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
  }
  return diagModuleReady;
}

function armPlayDiagnostic(label: string): void {
  if (!debugConsoleWanted()) return;
  void (async () => {
    try {
      const ac = audioContext();
      const tap = finalTap();
      if (!ac || !tap) return;
      await ensureDiagWorklet(ac);
      const node = new AudioWorkletNode(ac, "klappn-diag", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });
      tap.connect(node);
      const sr = ac.sampleRate;
      const t0 = ac.currentTime;
      node.port.onmessage = (e) => {
        try {
          tap.disconnect(node);
        } catch {
          /* already gone */
        }
        const d = e.data as Float32Array;
        (window as unknown as Record<string, unknown>).__klappnDiagBuf = d;
        // first sound
        let first = -1;
        for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.005) { first = i; break; }
        // clicks: sample deltas that dwarf the local level
        const clicks: string[] = [];
        let maxD = 0, maxAt = 0;
        for (let i = 1; i < d.length; i++) {
          const dd = Math.abs(d[i] - d[i - 1]);
          if (dd > maxD) { maxD = dd; maxAt = i; }
          if (dd > 0.3 && clicks.length < 12) clicks.push(`${((i / sr) * 1000) | 0}ms`);
        }
        // envelope (50ms) + gaps AFTER first sound
        const w = (sr / 20) | 0;
        const env: number[] = [];
        for (let i = 0; i + w <= d.length; i += w) {
          let s2 = 0;
          for (let j = i; j < i + w; j++) s2 += d[j] * d[j];
          env.push(Math.sqrt(s2 / w));
        }
        const gaps: string[] = [];
        const firstWin = first < 0 ? env.length : (first / w) | 0;
        for (let i = firstWin + 1; i < env.length; i++)
          if (env[i] < 1e-4 && env[i - 1] >= 1e-4 && gaps.length < 8) gaps.push(`${i * 50}ms`);
        const envDb = env.map((x) => Math.round(20 * Math.log10(x + 1e-6)));
        console.log(
          `[klappn/diag] ${label} @${t0.toFixed(2)}s | first-sound ${first < 0 ? "NONE" : `${((first / sr) * 1000) | 0}ms`} | clicks>${0.3}: ${clicks.length ? clicks.join(",") : "none"} (maxΔ=${maxD.toFixed(3)}@${((maxAt / sr) * 1000) | 0}ms) | gaps: ${gaps.length ? gaps.join(",") : "none"} | env(dB/50ms): ${envDb.join(" ")}`,
        );
      };
      node.port.postMessage({ frames: Math.floor(4 * sr) });
    } catch (e) {
      console.warn("[klappn/diag] recorder failed", e);
    }
  })();
}

// --- BROADCAST TAP (live streaming) -------------------------------------------
// The DJ's computer renders the set and STREAMS it to listeners' phones (see
// lib/rtc.ts + Cloudflare Realtime). We capture the mix as a MediaStream by
// tapping the final node IN PARALLEL — an extra edge that never disturbs the
// DJ's own direct-to-speakers monitoring. Post-limiter + post-perf-FX, so what
// streams is exactly what the DJ hears.
let broadcastDest: MediaStreamAudioDestinationNode | null = null;
/** A live MediaStream of the mix for broadcasting, or null if the engine isn't
 *  up yet. Idempotent — the same stream is returned across calls. */
export function getBroadcastStream(): MediaStream | null {
  const ac = audioContext();
  const tap = finalTap();
  if (!ac || !tap) return null;
  if (!broadcastDest) {
    broadcastDest = ac.createMediaStreamDestination();
    try {
      tap.connect(broadcastDest); // parallel — the speaker route stays intact
    } catch {
      broadcastDest = null;
      return null;
    }
  }
  return broadcastDest.stream;
}
/** Drop the broadcast tap (broadcast ended). */
export function stopBroadcastStream(): void {
  // The mic exists FOR the listeners — when the broadcast door closes there
  // is no one left to hear it, and hot capture with no audience is a trust
  // problem, so it goes down with the tap.
  disableLiveMic();
  if (!broadcastDest) return;
  try {
    finalTap()?.disconnect(broadcastDest);
  } catch {
    /* edge already gone */
  }
  broadcastDest = null;
}

// --- LIVE MIDI TRIGGER (one-off engine voices) -----------------------------------
/** Fire ONE voice through the engine RIGHT NOW — the live MIDI instrument path
 *  (lib/midi-live.ts). Rides `mod.superdough` (the engine's OWN re-export via
 *  @strudel/web — NEVER import 'superdough' directly: dev dep-optimization can
 *  duplicate it, and the second copy plays a different AudioContext, see
 *  lib/strudel-engine.ts). The voice lands on orbit 1 → master → limiter →
 *  perf FX → broadcast tap, so the DJ hears it AND every stream listener does,
 *  automatically. Orbit 1 sits OUTSIDE the set's kill decades (10–39,
 *  lib/set-live.ts) — the channel kills never gate the keyboard.
 *
 *  LATENCY NOTE: this bypasses pattern scheduling entirely (no compile, no
 *  cycle-boundary wait) — ~12ms of onset lead-in plus the context's output
 *  latency. Acceptable, and the point, for live playing.
 *
 *  No-op before the engine is up and running — a keyboard can't wake a silent
 *  page (superdough would refuse the past-onset anyway, one warn per hit). */
export function triggerLiveNote(opts: {
  s: string;
  note: number;
  gain: number;
  duration?: number;
}): void {
  const ac = audioContext();
  // a set playing on ZALTZ takes the note in-engine (same orbit-1 →
  // master → perf-FX → broadcast path); superdough covers cold zone loads
  if (zaltzActive() && zaltzLiveNote(opts)) return;
  const sd = mod?.superdough;
  if (typeof sd !== "function" || !ac || ac.state !== "running") return;
  const duration = opts.duration ?? 0.8;
  const fire = (coldRetry: boolean): void => {
    // superdough refuses onsets in the past — a hair of lead-in. (Fresh value
    // object per fire: superdough mutates the hap value it's handed.)
    const t = ac.currentTime + 0.012;
    try {
      void Promise.resolve(
        sd(
          {
            s: opts.s,
            note: opts.note,
            gain: opts.gain,
            // a modest release so looped soundfont voices LAND at cutoff (the
            // superdough default, 0.01s, clicks on sustained gm_* samples)
            release: 0.2,
            orbit: 1,
          },
          t,
          duration,
        ),
      ).then(
        () => {
          // COLD-START RESCUE (measured in the pane, 2026-07-12): superdough
          // AWAITS the sound's onTrigger, and the first press of a fresh pitch
          // means a soundfont zone fetch+decode — by the time it resolves the
          // onset has passed and superdough SILENTLY drops the hap ("skip hap:
          // still loading"). That load is cached now, so one immediate re-fire
          // lands the note — a buffer-decode late, only ever on the first
          // press of that key. (Tiny race: a slow-but-scheduled voice would
          // re-fire as a flam — the window is sub-ms, worth the trade live.)
          if (coldRetry && ac.currentTime > t) fire(false);
        },
        (e) => {
          // unknown sound / mid-flight teardown: keep the set alive, say why
          console.error("[klappn] live note failed", e);
        },
      );
    } catch (e) {
      console.error("[klappn] live note failed", e);
    }
  };
  fire(true);
}

// --- LIVE MIC (the DJ's voice over the mix) -------------------------------------
// A live set needs a VOICE — announcements, hype, singing over the drop. The
// mic is pure Web Audio summed into the broadcast tap above (never into the
// pattern engine: no compile, no scheduler cost), so listeners hear mix +
// voice on the ONE stream and a broadcast re-publish (epoch bump) keeps the
// mic because the tap node itself survives the peer connection. The DJ's own
// speakers stay clean by default (monitor gain 0) — a laptop mic beside
// laptop speakers is a feedback machine.
interface MicNodes {
  src: MediaStreamAudioSourceNode;
  /** The source's own fader — the crossfade point a device swap rides
   *  (setLiveMicDevice): everything downstream of hp never re-wires. */
  srcGain: GainNode;
  hp: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  /** Character stage bookends — every voice path runs charIn → … → charOut. */
  charIn: GainNode;
  charDry: GainNode;
  charOut: GainNode;
  /** Drive-stage bookends — charOut → driveDry → post at rest; the tanh rig
   *  (built lazily, see ensureMicDrive) crossfades in around driveDry. Every
   *  send below (dry/echo/space/glow) reads `post`, so they ride the drive. */
  driveDry: GainNode;
  post: GainNode;
  dry: GainNode;
  delay: DelayNode;
  fb: GainNode;
  fbLp: BiquadFilterNode;
  echoWet: GainNode;
  conv: ConvolverNode;
  spaceWet: GainNode;
  bus: GainNode;
  analyser: AnalyserNode;
  monitor: GainNode;
}
let micStream: MediaStream | null = null;
let micNodes: MicNodes | null = null;
// Echo delay time (sec). 0.32 until a bpm is known; setLiveMicEchoBpm snaps
// it to a dotted eighth so throws land ON the groove instead of near it.
let micEchoDelay = 0.32;
// getUserMedia is async — if the mic is toggled off (or the door closes)
// while the permission prompt is still up, the late stream must be dropped,
// not wired into a graph nobody asked for anymore.
let micWanted = false;

/** The capture constraints in ONE place — enable and device-swap must ask the
 *  browser for the same treatment or a swap would change the voice. */
function micConstraints(deviceId?: string | null): MediaTrackConstraints {
  return {
    // let the browser fight the room (AEC + NS: the DJ is next to loud
    // speakers) — but NOT the level: AGC over music hunts between phrases
    // (rides bleed up in gaps, clamps sustained lines); the compressor in
    // the chain does the level-riding job without pumping. Mono: every DJ
    // mic is mono — skip the fake stereo pair.
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

/** Open a capture stream on the asked-for device, falling back to the
 *  browser default when that exact device won't open (unplugged since the
 *  choice was saved) — a vanished mic must never cost the DJ the voice. */
async function openMicStream(deviceId?: string | null): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: micConstraints(deviceId) });
  } catch {
    if (!deviceId) return null; // denied, or no input device at all
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: micConstraints() });
    } catch {
      return null;
    }
  }
}

// --- VOICE CHARACTERS -----------------------------------------------------------
// Caricature filters for the DJ's voice — Deep / Chipmunk / Robot / Phone.
// All CHEAP NATIVE nodes (this thread synthesizes the whole set; a worklet is
// off the table), inserted AFTER the compressor and BEFORE the dry/echo/space
// split so the throws and the hall ride the character, not the raw voice.
export type LiveMicVoice = "natural" | "deep" | "chipmunk" | "robot" | "phone";
let micVoice: LiveMicVoice = "natural";

interface PitchShifter {
  input: GainNode;
  output: GainNode;
  setRatio(r: number): void;
  dispose(): void;
}

/** The classic dual-delay granular ("Doppler") pitch shifter. Two delay taps
 *  whose delayTime rides a sawtooth ramp — a steadily changing delay IS a
 *  pitch shift (rate = 1 − d(delay)/dt) — with the two ramps 180° apart and
 *  each tap amplitude-windowed by a triangle LFO whose trough sits exactly on
 *  its ramp's wrap, so the delay-time jump is never audible. ~90ms grains:
 *  audible warble on sustained notes, but these are caricatures on purpose.
 *
 *  Phase trick: an OscillatorNode has no phase knob, so the 180° offset and
 *  the window alignment are built from START TIMES at a fixed startup rate.
 *  Offsets in RADIANS survive later frequency writes as long as every LFO
 *  gets the same frequency at the same time — which setRatio guarantees. */
function makePitchShifter(ac: AudioContext): PitchShifter {
  const W = 0.09; // grain window (sec) — the delay sweep span
  const F0 = 4; // startup LFO rate; only the start-time phase math uses it
  const T0 = 1 / F0;
  const input = ac.createGain();
  const output = ac.createGain();
  // dry switch: Natural routes AROUND the delays (and freezes the LFOs at
  // frequency 0) so a bypassed shifter costs ~nothing
  const dry = ac.createGain();
  dry.gain.value = 1;
  input.connect(dry);
  dry.connect(output);
  const wet = ac.createGain();
  wet.gain.value = 0;
  wet.connect(output);
  // the delay center — ramps swing ±W/2 around it, so it must clear zero
  const center = ac.createConstantSource();
  center.offset.value = 0.003 + W / 2;
  const t0 = ac.currentTime + 0.05;
  center.start(t0);
  const freqs: AudioParam[] = [];
  const slopes: AudioParam[] = [];
  const stoppable: (OscillatorNode | ConstantSourceNode)[] = [center];
  const all: AudioNode[] = [input, output, dry, wet, center];
  for (const k of [0, 1] as const) {
    const d = ac.createDelay(1);
    d.delayTime.value = 0; // driven entirely by center + ramp
    center.connect(d.delayTime);
    const ramp = ac.createOscillator();
    ramp.type = "sawtooth";
    ramp.frequency.value = F0;
    const slope = ac.createGain(); // ±W/2 — the sign picks shift direction
    slope.gain.value = W / 2;
    ramp.connect(slope);
    slope.connect(d.delayTime);
    // window = 0.5 + 0.5·triangle → 0..1, silent at the ramp's wrap
    const winOsc = ac.createOscillator();
    winOsc.type = "triangle";
    winOsc.frequency.value = F0;
    const winScale = ac.createGain();
    winScale.gain.value = 0.5;
    winOsc.connect(winScale);
    const amp = ac.createGain();
    amp.gain.value = 0.5;
    winScale.connect(amp.gain);
    input.connect(d);
    d.connect(amp);
    amp.connect(wet);
    // tap 1's saw starts half a period after tap 0's (the 180°); each
    // triangle starts 3T/4 after ITS saw — the native triangle troughs at
    // 3T/4, which lands the window's zero on the saw's discontinuity
    ramp.start(t0 + k * (T0 / 2));
    winOsc.start(t0 + k * (T0 / 2) + 0.75 * T0);
    freqs.push(ramp.frequency, winOsc.frequency);
    slopes.push(slope.gain);
    stoppable.push(ramp, winOsc);
    all.push(d, ramp, slope, winOsc, winScale, amp);
  }
  return {
    input,
    output,
    setRatio(r: number) {
      const t = ac.currentTime;
      if (Math.abs(r - 1) < 1e-3) {
        // BYPASS — dry through, LFOs frozen (freq 0 halts phase together, so
        // the start-time alignment survives the nap)
        dry.gain.setTargetAtTime(1, t, 0.02);
        wet.gain.setTargetAtTime(0, t, 0.02);
        for (const f of freqs) f.setValueAtTime(0, t);
        return;
      }
      // |slope| of the saw is 2f, scaled by W/2 → d(delay)/dt = W·f = |1−r|
      const f = Math.abs(1 - r) / W;
      for (const p of freqs) p.setValueAtTime(f, t);
      // rising delay = pitch DOWN (r<1); falling = pitch UP (r>1)
      for (const g of slopes) g.setValueAtTime((r < 1 ? 1 : -1) * (W / 2), t);
      dry.gain.setTargetAtTime(0, t, 0.02);
      wet.gain.setTargetAtTime(1, t, 0.02);
    },
    dispose() {
      for (const o of stoppable) {
        try {
          o.stop();
        } catch {
          /* never started / already stopped */
        }
      }
      for (const n of all) {
        try {
          n.disconnect();
        } catch {
          /* already gone */
        }
      }
    },
  };
}

/** One toggleable character path — TRUE bypass is structural: `edges` are the
 *  path's splice points (charIn → head, tail → charOut), and an idle path is
 *  DISCONNECTED at both, so nothing upstream of charOut pulls it. A gain at 0
 *  is not a bypass — Web Audio renders every node that can reach a sink. */
interface MicCharPath {
  /** [from, to] pairs to connect when worn, disconnect when shed. */
  edges: [AudioNode, AudioNode][];
  wet: GainNode;
  connected: boolean;
  kill: ReturnType<typeof setTimeout> | null;
}

interface MicCharRig {
  shifter: PitchShifter;
  ringCarrier: OscillatorNode;
  ringScale: GainNode;
  ringGain: GainNode;
  robotBp: BiquadFilterNode;
  phoneBp: BiquadFilterNode;
  paths: { shift: MicCharPath; ring: MicCharPath; robot: MicCharPath; phone: MicCharPath };
}
// Built LAZILY on the first non-natural voice — a DJ who never touches the
// character pills pays zero extra nodes — and torn down with the mic. Paths
// are built COLD (edges unconnected); setLiveMicVoice splices in what it wears.
let micCharRig: MicCharRig | null = null;

function ensureMicChar(ac: AudioContext, m: MicNodes): MicCharRig {
  if (micCharRig) return micCharRig;
  const path = (edges: [AudioNode, AudioNode][], wet: GainNode): MicCharPath => ({
    edges,
    wet,
    connected: false,
    kill: null,
  });
  // DEEP / CHIPMUNK — the granular shifter
  const shifter = makePitchShifter(ac);
  const shiftWet = ac.createGain();
  shiftWet.gain.value = 0;
  shifter.output.connect(shiftWet);
  // ROBOT — ring mod: voice × (0.5 + 0.5·sin 30Hz), the Dalek tremor…
  const ringGain = ac.createGain();
  ringGain.gain.value = 0.5;
  const ringCarrier = ac.createOscillator();
  ringCarrier.type = "sine";
  ringCarrier.frequency.value = 0; // frozen until Robot is worn
  const ringScale = ac.createGain();
  ringScale.gain.value = 0.5;
  ringCarrier.connect(ringScale);
  ringScale.connect(ringGain.gain);
  ringCarrier.start();
  const ringWet = ac.createGain();
  ringWet.gain.value = 0;
  ringGain.connect(ringWet);
  // …plus a narrow 1.2kHz band mixed in for the tin-can resonance
  const robotBp = ac.createBiquadFilter();
  robotBp.type = "bandpass";
  robotBp.frequency.value = 1200;
  robotBp.Q.value = 0.8;
  const robotWet = ac.createGain();
  robotWet.gain.value = 0;
  robotBp.connect(robotWet);
  // PHONE — one bandpass, boosted (a band that narrow loses real level)
  const phoneBp = ac.createBiquadFilter();
  phoneBp.type = "bandpass";
  phoneBp.frequency.value = 1700;
  phoneBp.Q.value = 1.1;
  const phoneWet = ac.createGain();
  phoneWet.gain.value = 0;
  phoneBp.connect(phoneWet);
  micCharRig = {
    shifter,
    ringCarrier,
    ringScale,
    ringGain,
    robotBp,
    phoneBp,
    paths: {
      shift: path(
        [
          [m.charIn, shifter.input],
          [shiftWet, m.charOut],
        ],
        shiftWet,
      ),
      ring: path(
        [
          [m.charIn, ringGain],
          [ringWet, m.charOut],
        ],
        ringWet,
      ),
      robot: path(
        [
          [m.charIn, robotBp],
          [robotWet, m.charOut],
        ],
        robotWet,
      ),
      phone: path(
        [
          [m.charIn, phoneBp],
          [phoneWet, m.charOut],
        ],
        phoneWet,
      ),
    },
  };
  return micCharRig;
}

/** Splice a path in NOW, or ramp it silent and unplug it once the 30ms fade
 *  has passed (150ms grace — generous, and a re-wear cancels the unplug). */
function setCharPath(ac: AudioContext, p: MicCharPath, gain: number): void {
  const t = ac.currentTime;
  if (gain > 0) {
    if (p.kill) {
      clearTimeout(p.kill);
      p.kill = null;
    }
    if (!p.connected) {
      for (const [from, to] of p.edges) from.connect(to);
      p.connected = true;
    }
  }
  p.wet.gain.cancelScheduledValues(t);
  p.wet.gain.setTargetAtTime(gain, t, 0.02);
  if (gain === 0 && p.connected && !p.kill) {
    p.kill = setTimeout(() => {
      p.kill = null;
      if (!p.connected) return;
      for (const [from, to] of p.edges) {
        try {
          from.disconnect(to);
        } catch {
          /* already gone */
        }
      }
      p.connected = false;
    }, 150);
  }
}

function disposeMicChar(): void {
  const rig = micCharRig;
  if (!rig) return;
  micCharRig = null;
  rig.shifter.dispose();
  try {
    rig.ringCarrier.stop();
  } catch {
    /* already stopped */
  }
  const rest: AudioNode[] = [
    rig.ringCarrier,
    rig.ringScale,
    rig.ringGain,
    rig.robotBp,
    rig.phoneBp,
  ];
  for (const p of Object.values(rig.paths)) {
    if (p.kill) clearTimeout(p.kill);
    rest.push(p.wet);
  }
  for (const n of rest) {
    try {
      n.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/** Wear a voice character. Reconfigures the live chain in place (parameter
 *  ramps — no rebuild, no dropout); remembered only while the mic is open,
 *  and the mic always reopens Natural. */
export function setLiveMicVoice(v: LiveMicVoice): void {
  micVoice = v;
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m) return;
  if (v === "natural" && !micCharRig) return; // nothing built, nothing to undo
  const rig = ensureMicChar(ac, m);
  const t = ac.currentTime;
  const set = (p: AudioParam, val: number) => {
    p.cancelScheduledValues(t);
    p.setTargetAtTime(val, t, 0.02);
  };
  // one table, five voices — every path's level in one place
  const g = { dry: 0, shift: 0, ring: 0, robotBp: 0, phone: 0 };
  let ratio = 1;
  switch (v) {
    case "natural":
      g.dry = 1;
      break;
    case "deep":
      g.shift = 1;
      ratio = MIC_DEEP_RATIO;
      break;
    case "chipmunk":
      g.shift = 1;
      ratio = MIC_CHIPMUNK_RATIO;
      break;
    case "robot":
      g.ring = 0.9;
      g.robotBp = 0.5;
      break;
    case "phone":
      g.phone = 1.6;
      break;
  }
  set(m.charDry.gain, g.dry);
  // structural: idle paths ramp silent and then UNPLUG (setCharPath) — Natural
  // leaves the whole rig cold, and Deep never pays for Phone's filter.
  setCharPath(ac, rig.paths.shift, g.shift);
  setCharPath(ac, rig.paths.ring, g.ring);
  setCharPath(ac, rig.paths.robot, g.robotBp);
  setCharPath(ac, rig.paths.phone, g.phone);
  rig.shifter.setRatio(ratio);
  // the ring carrier only spins while Robot is on — frozen otherwise
  rig.ringCarrier.frequency.setValueAtTime(v === "robot" ? 30 : 0, t);
  // PHONE leans a touch harder on the existing compressor — the "line drive"
  // crunch is the comp working, not a new node
  m.comp.ratio.setTargetAtTime(v === "phone" ? 8 : 4, t, 0.05);
  m.comp.threshold.setTargetAtTime(v === "phone" ? -24 : -18, t, 0.05);
  // on-key steering follows the voice: fresh slew state (no ratio bleeds
  // from one caricature into the next), detector started or stopped, and
  // Robot's drone dressed or shed (syncMicPitchLoop).
  micSteerFresh();
  syncMicPitchLoop();
}

/** Open the DJ's microphone and sum it into the broadcast. Resolves false
 *  when there's no engine yet, no broadcast tap to land on, or the browser
 *  denied the device. Idempotent while live. Pass the deck's remembered
 *  deviceId to open THAT mic; a vanished pick falls back to the default. */
export async function enableLiveMic(deviceId?: string | null): Promise<boolean> {
  if (micNodes) return true;
  const ac = audioContext();
  if (!ac) return false; // the mic rides the mix — no engine, no mic
  micWanted = true;
  const stream = await openMicStream(deviceId);
  if (!stream) {
    micWanted = false;
    return false; // denied, or no input device
  }
  if (!micWanted || micNodes) {
    // toggled off (or a racing enable already won) during the prompt
    for (const t of stream.getTracks()) t.stop();
    return !!micNodes;
  }
  // Land on the broadcast tap — same lazy creation the publisher uses, so
  // whichever side runs first, both ride the one MediaStream.
  if (!getBroadcastStream() || !broadcastDest) {
    for (const t of stream.getTracks()) t.stop();
    micWanted = false;
    return false;
  }
  try {
    const src = ac.createMediaStreamSource(stream);
    // the source's own fader — unity at rest; a device swap crossfades a new
    // source in against this node (setLiveMicDevice) so the chain never gaps
    const srcGain = ac.createGain();
    srcGain.gain.value = 1;
    // voice cleanup: cut the rumble, then squash the level swings so the DJ
    // sits ON the mix instead of under it
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 90;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    src.connect(srcGain);
    srcGain.connect(hp);
    hp.connect(comp);
    // CHARACTER STAGE bookends — comp → charIn → (voice paths) → charOut,
    // and everything downstream (dry, echo, space) reads charOut, so the
    // throws and the hall wear the character too. Natural = charDry at unity;
    // the caricature rig itself is built lazily on first use (ensureMicChar).
    const charIn = ac.createGain();
    const charDry = ac.createGain();
    const charOut = ac.createGain();
    comp.connect(charIn);
    charIn.connect(charDry);
    charDry.connect(charOut);
    // DRIVE bookends — pass-through gains at rest; the tanh rig splices in
    // lazily (ensureMicDrive) and crossfades against driveDry. Everything
    // below reads `post`, so the throws and the hall wear the drive too.
    const driveDry = ac.createGain();
    const post = ac.createGain();
    charOut.connect(driveDry);
    driveDry.connect(post);
    const bus = ac.createGain(); // the ONE node the VOX dial rides
    bus.gain.value = 1;
    // (a) dry voice
    const dry = ac.createGain();
    post.connect(dry);
    dry.connect(bus);
    // (b) echo: feedback delay — in → delay, delay → fb → lp → delay. The
    // lowpass sits INSIDE the loop: full-band repeats stack their sibilance
    // and stay bright; darkening each pass makes the tail recede naturally.
    const delay = ac.createDelay(1);
    delay.delayTime.value = micEchoDelay; // tempo-synced when a bpm is known
    const fb = ac.createGain();
    fb.gain.value = 0.38;
    const fbLp = ac.createBiquadFilter();
    fbLp.type = "lowpass";
    fbLp.frequency.value = 3500;
    post.connect(delay);
    delay.connect(fb);
    fb.connect(fbLp);
    fbLp.connect(delay);
    const echoWet = ac.createGain();
    echoWet.gain.value = 0; // wet levels start closed — the deck dials them in
    delay.connect(echoWet);
    echoWet.connect(bus);
    // (c) space: a small generated hall — like ensurePerfFx, the IR is made
    // ONCE at enable, never per dial move. 20ms of leading zeros (pre-delay
    // keeps the dry voice intelligible in FRONT of the wash) and the tail's
    // random DC lean removed envelope-weighted — a convolver passes any DC
    // its IR sums to, and a flat subtraction would bake a step (= click)
    // into the impulse (same pattern as makePlateImpulse in lib/vocal-fx).
    const conv = ac.createConvolver();
    const secs = 2.2;
    const pre = Math.floor(ac.sampleRate * 0.02);
    const len = Math.floor(ac.sampleRate * secs);
    const ir = ac.createBuffer(2, pre + len, ac.sampleRate);
    const env = (i: number) => Math.exp(-3.5 * (i / len));
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let sumD = 0;
      let sumE = 0;
      for (let i = 0; i < len; i++) {
        d[pre + i] = (Math.random() * 2 - 1) * env(i);
        sumD += d[pre + i];
        sumE += env(i);
      }
      const lean = sumE > 0 ? sumD / sumE : 0;
      for (let i = 0; i < len; i++) d[pre + i] -= lean * env(i);
    }
    conv.buffer = ir;
    const spaceWet = ac.createGain();
    spaceWet.gain.value = 0;
    // the convolver's INPUT edge is LAZY (post → conv lives in setLiveMicFx,
    // same pattern as ensurePerfFx's conv): an idle reverb crunches its full
    // FFT load on silence, and the mic must cost a phone nothing at rest.
    conv.connect(spaceWet);
    spaceWet.connect(bus);
    // level tap for the deck's hot-mic light — post-everything, on the bus,
    // so the glow shows what LISTENERS get, not what the capsule picked up
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    bus.connect(analyser);
    // into the broadcast — parallel edge, the DJ's speaker route untouched
    bus.connect(broadcastDest);
    // monitor: OFF by default (feedback); the deck can open it on headphones
    const monitor = ac.createGain();
    monitor.gain.value = 0;
    bus.connect(monitor);
    monitor.connect(outputSink(ac));
    micStream = stream;
    micNodes = {
      src,
      srcGain,
      hp,
      comp,
      charIn,
      charDry,
      charOut,
      driveDry,
      post,
      dry,
      delay,
      fb,
      fbLp,
      echoWet,
      conv,
      spaceWet,
      bus,
      analyser,
      monitor,
    };
    micVoice = "natural"; // the mic always opens with the DJ's own voice
    return true;
  } catch (e) {
    console.error("[klappn] live mic failed to wire", e);
    for (const t of stream.getTracks()) t.stop();
    micWanted = false;
    return false;
  }
}

/** Close the mic: stop capture, tear the graph down. Safe if never enabled. */
export function disableLiveMic(): void {
  micWanted = false;
  micVoice = "natural"; // no character outlives the mic that wore it
  disposeMicChar(); // stops the LFO oscillators, not just the edges
  disposeMicDriveGlow();
  // key steering dies with the mic (the KEY itself is remembered, like the
  // echo bpm — the deck re-feeds it anyway); analyser edges fall in the
  // graph teardown below.
  if (micPitchTimer) {
    clearInterval(micPitchTimer);
    micPitchTimer = null;
  }
  micPitchAnalyser = null;
  micDebugFft = null;
  micDebugPitchAn = null;
  if (micConvKill) {
    clearTimeout(micConvKill);
    micConvKill = null;
  }
  micConvConnected = false;
  micEchoPos = 0;
  if (micStream) for (const t of micStream.getTracks()) t.stop();
  if (micNodes) {
    // fb → lp → delay is a cycle — disconnect EVERY node or the loop keeps
    // ringing (and keeps the graph alive) after the source is gone
    for (const n of Object.values(micNodes)) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
  }
  micStream = null;
  micNodes = null;
}

// A device swap is async (getUserMedia) — a second pick, or a close/reopen,
// while one is in flight must win; the stale stream gets dropped, not wired.
let micSwapSeq = 0;

/** Switch the live mic to another input WITHOUT dropping the voice: open the
 *  new device, build a fresh source, 30ms crossfade old→new at the chain's
 *  source fader (everything from the highpass down never re-wires — FX,
 *  character, broadcast edge all carry straight through), then stop the old
 *  tracks. A vanished device falls back to the browser default rather than
 *  killing the mic. Resolves false (graph untouched) when nothing would open.
 *  No-op while the mic is closed. */
export async function setLiveMicDevice(deviceId: string | null): Promise<boolean> {
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m || !micStream) return false;
  const seq = ++micSwapSeq;
  const stream = await openMicStream(deviceId);
  if (!stream) return false;
  if (micNodes !== m || seq !== micSwapSeq) {
    // the mic closed/reopened, or a newer pick won, during the prompt
    for (const t of stream.getTracks()) t.stop();
    return false;
  }
  try {
    const oldSrc = m.src;
    const oldGain = m.srcGain;
    const oldStream = micStream;
    const src = ac.createMediaStreamSource(stream);
    const srcGain = ac.createGain();
    srcGain.gain.value = 0;
    src.connect(srcGain);
    srcGain.connect(m.hp);
    // the 30ms crossfade — click-free, and no gap a listener could hear
    const t = ac.currentTime;
    oldGain.gain.cancelScheduledValues(t);
    oldGain.gain.setValueAtTime(oldGain.gain.value, t);
    oldGain.gain.linearRampToValueAtTime(0, t + 0.03);
    srcGain.gain.setValueAtTime(0, t);
    srcGain.gain.linearRampToValueAtTime(1, t + 0.03);
    // the new pair is canonical NOW (disable stops these tracks); the old
    // pair unplugs once its fade has landed
    micStream = stream;
    m.src = src;
    m.srcGain = srcGain;
    setTimeout(() => {
      try {
        oldSrc.disconnect();
      } catch {
        /* already gone */
      }
      try {
        oldGain.disconnect();
      } catch {
        /* already gone */
      }
      for (const tr of oldStream.getTracks()) tr.stop();
    }, 80);
    return true;
  } catch (e) {
    console.error("[klappn] mic device swap failed", e);
    for (const t of stream.getTracks()) t.stop();
    return false;
  }
}

// --- DRIVE & GLOW (lazy mic colour stages) ----------------------------------
// Ported from the retired studio chain (lib/vocal-fx): DRIVE = rampable
// pre-gain → fixed tanh WaveShaper (wide-span trick, curve never rebuilt) →
// peak-compensated post-gain; GLOW = a doubled take, two short modulated
// delays panned wide (depth stays under pitch-warble territory). Both are
// built LAZILY on the first non-default dial and TRUE-bypassed via setCharPath
// (edges unplugged, not gain 0) when the dial returns to zero.
const MIC_SHAPER_SPAN = 4; // covers max pre-gain 1 + 3·drive ≤ 4

interface MicDriveRig {
  pre: GainNode;
  makeup: GainNode;
  path: MicCharPath;
}
let micDriveRig: MicDriveRig | null = null;

function ensureMicDrive(ac: AudioContext, m: MicNodes): MicDriveRig {
  if (micDriveRig) return micDriveRig;
  const pre = ac.createGain();
  const span = ac.createGain();
  span.gain.value = 1 / MIC_SHAPER_SPAN;
  const shaper = ac.createWaveShaper();
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * MIC_SHAPER_SPAN);
  }
  shaper.curve = curve;
  shaper.oversample = "2x";
  const makeup = ac.createGain();
  const wet = ac.createGain();
  wet.gain.value = 0;
  pre.connect(span);
  span.connect(shaper);
  shaper.connect(makeup);
  makeup.connect(wet);
  micDriveRig = {
    pre,
    makeup,
    path: {
      edges: [
        [m.charOut, pre],
        [wet, m.post],
      ],
      wet,
      connected: false,
      kill: null,
    },
  };
  return micDriveRig;
}

interface MicGlowRig {
  lfos: OscillatorNode[];
  voices: AudioNode[];
  path: MicCharPath;
}
let micGlowRig: MicGlowRig | null = null;

function ensureMicGlow(ac: AudioContext, m: MicNodes): MicGlowRig {
  if (micGlowRig) return micGlowRig;
  const wet = ac.createGain();
  wet.gain.value = 0;
  const lfos: OscillatorNode[] = [];
  const voices: AudioNode[] = [];
  const inputs: AudioNode[] = [];
  const voice = (base: number, rateHz: number, pan: number) => {
    const delay = ac.createDelay(0.05);
    delay.delayTime.value = base;
    const lfo = ac.createOscillator();
    lfo.frequency.value = rateHz;
    const depth = ac.createGain();
    depth.gain.value = 0.0018;
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();
    lfos.push(lfo);
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    delay.connect(panner);
    panner.connect(wet);
    inputs.push(delay);
    voices.push(delay, depth, panner);
  };
  voice(0.014, 0.55, -0.6);
  voice(0.021, 0.7, 0.6);
  micGlowRig = {
    lfos,
    voices,
    path: {
      // the doubles ride the drive (post) and land on the bus, so VOX levels them
      edges: [
        [m.post, inputs[0]],
        [m.post, inputs[1]],
        [wet, m.bus],
      ],
      wet,
      connected: false,
      kill: null,
    },
  };
  return micGlowRig;
}

function disposeMicDriveGlow(): void {
  if (micDriveRig) {
    if (micDriveRig.path.kill) clearTimeout(micDriveRig.path.kill);
    for (const n of [micDriveRig.pre, micDriveRig.makeup, micDriveRig.path.wet]) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
    micDriveRig = null;
  }
  if (micGlowRig) {
    if (micGlowRig.path.kill) clearTimeout(micGlowRig.path.kill);
    for (const lfo of micGlowRig.lfos) {
      try {
        lfo.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of [...micGlowRig.lfos, ...micGlowRig.voices, micGlowRig.path.wet]) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
    micGlowRig = null;
  }
}

// the convolver's lazy input edge (post → conv) — see enableLiveMic's note
let micConvConnected = false;
let micConvKill: ReturnType<typeof setTimeout> | null = null;
// last-written echo dial, for the perf probe's stage list (reset with the mic)
let micEchoPos = 0;

/** Apply the mic dials as PARAMETER writes — instant, no compile. Dial
 *  positions arrive 0..1 from the deck; the Web Audio ranges live here so
 *  the UI never learns node numbers. No-op while the mic is closed. */
export function setLiveMicFx(fx: {
  level?: number;
  echo?: number;
  space?: number;
  drive?: number;
  glow?: number;
  monitor?: boolean;
}): void {
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m) return;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const ramp = (p: AudioParam, v: number) => {
    // 30ms linear — click-free but still feels instant under a finger
    const t = ac.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + 0.03);
  };
  if (fx.level !== undefined) ramp(m.bus.gain, clamp01(fx.level) * 1.5);
  if (fx.echo !== undefined) {
    micEchoPos = clamp01(fx.echo);
    ramp(m.echoWet.gain, micEchoPos * 0.9);
  }
  if (fx.space !== undefined) {
    const v = clamp01(fx.space);
    ramp(m.spaceWet.gain, v * 0.9);
    // lazy convolver: engage on first use, release ~2.5s after the dial
    // zeroes (the tail rings out) — same contract as ensurePerfFx's conv.
    if (v > 0) {
      if (micConvKill) {
        clearTimeout(micConvKill);
        micConvKill = null;
      }
      if (!micConvConnected) {
        try {
          m.post.connect(m.conv);
          micConvConnected = true;
        } catch {
          /* best-effort */
        }
      }
    } else if (micConvConnected && !micConvKill) {
      micConvKill = setTimeout(() => {
        micConvKill = null;
        const cur = micNodes;
        if (!cur || !micConvConnected) return;
        try {
          cur.post.disconnect(cur.conv);
        } catch {
          /* already gone */
        }
        micConvConnected = false;
      }, 2500);
    }
  }
  if (fx.drive !== undefined) {
    const v = clamp01(fx.drive);
    if (v > 0 || micDriveRig) {
      const rig = ensureMicDrive(ac, m);
      // engaged = full wet (the AMOUNT lives in the pre-gain); the dry
      // bookend crossfades out so the stage is serial, like the studio's
      setCharPath(ac, rig.path, v > 0 ? 1 : 0);
      ramp(m.driveDry.gain, v > 0 ? 0 : 1);
      const pre = 1 + 3 * v;
      ramp(rig.pre.gain, pre);
      // compensate the tanh peak loss so drive changes color, not loudness
      ramp(rig.makeup.gain, 1 / Math.tanh(pre));
    }
  }
  if (fx.glow !== undefined) {
    const v = clamp01(fx.glow);
    if (v > 0 || micGlowRig) {
      const rig = ensureMicGlow(ac, m);
      setCharPath(ac, rig.path, v * 0.8);
    }
  }
  if (fx.monitor !== undefined) ramp(m.monitor.gain, fx.monitor ? 1 : 0);
}

/** Whether the DJ's mic is currently open. */
export function liveMicActive(): boolean {
  return micNodes !== null;
}

/** Tempo-sync the mic echo: a dotted eighth at the playing song's bpm,
 *  clamped to a usable throw. Remembered while the mic is closed and applied
 *  at the next enable; a live graph GLIDES there (a delayTime step chirps). */
export function setLiveMicEchoBpm(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  micEchoDelay = Math.min(1, Math.max(0.12, (60 / bpm) * 0.75));
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m) return;
  m.delay.delayTime.setTargetAtTime(micEchoDelay, ac.currentTime, 0.08);
}

let micLevelBuf: Uint8Array<ArrayBuffer> | null = null;
/** The voice's current level, 0..1 (RMS-ish, post-FX — what listeners get).
 *  Cheap enough to poll on a slow interval for the deck's hot-mic glow.
 *  0 while the mic is closed. */
export function getLiveMicLevel(): number {
  const m = micNodes;
  if (!m) return 0;
  const n = m.analyser.fftSize;
  if (!micLevelBuf || micLevelBuf.length !== n) micLevelBuf = new Uint8Array(n);
  m.analyser.getByteTimeDomainData(micLevelBuf);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (micLevelBuf[i] - 128) / 128;
    sum += v * v;
  }
  // speech RMS tops out well under full-scale — ×3 so a confident voice
  // reads near 1 without clipping the scale
  return Math.min(1, Math.sqrt(sum / n) * 3);
}

// --- ON-KEY VOICE STEERING ------------------------------------------------------
// The pitch-shifted characters (Deep/Chipmunk) land ON the playing song's
// scale, gently: a cheap main-thread autocorrelation reads the singer's f0
// from a pre-character tap (post-comp — the detector hears the VOICE, never
// the shifted output), the target ratio bends so the SHIFTED note falls on a
// scale tone — clamped to ±80 cents around the character's base, the
// caricature never breaks — and the working ratio slews there through a
// one-pole (~120ms), so corrections glide instead of stepping. Robot gains a
// DRONE: the shifter (idle under Robot otherwise) is spliced in flattening
// the voice onto the scale note nearest the singer's median — an on-key
// monotone hum under the ring-mod tremor, which stays exactly as it was.
// ZERO cost at Natural/Phone or with no key: the detector interval only runs
// while a steerable character is worn AND a key is known (setLiveMicKey —
// the deck feeds it the playing song's scale, transpose and KEY dial baked in).
const MIC_DEEP_RATIO = 0.78;
const MIC_CHIPMUNK_RATIO = 1.45;
const MIC_STEER_CLAMP = Math.pow(2, 80 / 1200); // ±80 cents around base
const MIC_ROBOT_CLAMP = Math.pow(2, 7 / 12); // the drone flatten's reach
const MIC_ROBOT_DRONE = 0.55; // the drone layer's level under the tremor
const MIC_PITCH_MS = 60; // detector cadence — the meter loop's style
// one-pole step toward the target per tick — τ ≈ 120ms
const MIC_STEER_ALPHA = 1 - Math.exp(-(MIC_PITCH_MS / 1000) / 0.12);
// The dual-delay shifter UNDER-shifts: measured on sine inputs 200–300Hz
// (both directions, dev 07-12), the landed pitch is f0·(1 + (r−1)·0.85) —
// the crossfading grain taps re-anchor phase toward the input and eat ~15%
// of the nominal shift. Steering must aim THROUGH this transfer or every
// "scale tone" lands ~70 cents flat of it. (The caricatures themselves never
// cared — ±15% of a caricature is still the caricature.)
const MIC_SHIFTER_LOSS = 0.15;
const micEffRatio = (asked: number) => 1 + (asked - 1) * (1 - MIC_SHIFTER_LOSS);
const micAskedFor = (eff: number) => 1 + (eff - 1) / (1 - MIC_SHIFTER_LOSS);

let micScalePcs: number[] | null = null;
let micPitchTimer: ReturnType<typeof setInterval> | null = null;
let micPitchAnalyser: AnalyserNode | null = null;
let micPitchBuf: Float32Array<ArrayBuffer> | null = null;
let micNsdfBuf: Float32Array<ArrayBuffer> | null = null;
let micWorkRatio = 1; // the slewed ratio the shifter is actually wearing
// Robot's median memory — the last ~1.3s of voiced f0s (allocation-free ring)
const micF0Ring = new Float32Array(21);
let micF0RingAt = 0;
let micF0RingN = 0;
const micF0Sorted: number[] = [];
// last-tick telemetry for the debug surface (__klappnMicSteer)
const micSteerTelem = { f0: 0, clarity: 0, target: 0, ratio: 0 };
// DEBUG-only output-frequency analyser (micDebugOutHz) — never in the money path
let micDebugFft: AnalyserNode | null = null;

/** Reset the slew to the worn character's base — on voice changes, and when
 *  steering starts/stops, so ratios never bleed between caricatures. */
function micSteerFresh(): void {
  micWorkRatio =
    micVoice === "deep" ? MIC_DEEP_RATIO : micVoice === "chipmunk" ? MIC_CHIPMUNK_RATIO : 1;
  micF0RingAt = 0;
  micF0RingN = 0;
  micSteerTelem.ratio = micWorkRatio;
}

/** One detector pass: NSDF (McLeod-lite) autocorrelation over 60–800Hz on
 *  the tap's time buffer, first-strong-peak pick (a 2·period pick — octave
 *  down — always sits at a LONGER lag, so first-wins kills it), parabolic
 *  refine (1-sample lag quantization alone is ~9 cents at 250Hz). Returns 0
 *  when unvoiced (clarity < .9, or near-silence). Allocation-free after
 *  warm-up — both buffers are module-scoped and reused. */
function micDetectF0(ac: AudioContext, an: AnalyserNode): number {
  const nRaw = an.fftSize;
  if (!micPitchBuf || micPitchBuf.length !== nRaw) micPitchBuf = new Float32Array(nRaw);
  an.getFloatTimeDomainData(micPitchBuf);
  const x = micPitchBuf;
  // DECIMATE ×2 in place (pair-average = mild anti-alias): voice f0 lives
  // under 800Hz, and halving both the window and the lag range cuts the
  // correlation ~8× (measured ~5ms → ~0.6ms per tick) — the parabolic
  // refine below keeps the precision in single-digit cents.
  const n = nRaw >> 1;
  for (let i = 0; i < n; i++) x[i] = (x[2 * i] + x[2 * i + 1]) * 0.5;
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += x[i] * x[i];
  if (e0 / n < 1e-5) return 0; // silence — don't correlate the noise floor
  const sr = ac.sampleRate / 2;
  const minLag = Math.max(2, Math.floor(sr / 800));
  const maxLag = Math.min(n >> 1, Math.ceil(sr / 60));
  if (maxLag - minLag < 8) return 0;
  if (!micNsdfBuf || micNsdfBuf.length < maxLag + 2) micNsdfBuf = new Float32Array(maxLag + 2);
  const nsdf = micNsdfBuf;
  // incremental window energies: head = Σx²[0..τ), tail = Σx²[n−τ..n)
  let headE = 0;
  let tailE = 0;
  for (let i = 0; i < minLag; i++) {
    headE += x[i] * x[i];
    tailE += x[n - 1 - i] * x[n - 1 - i];
  }
  let gmax = 0;
  let gLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) r += x[i] * x[i + lag];
    const norm = 2 * e0 - headE - tailE;
    const v = norm > 1e-9 ? (2 * r) / norm : 0;
    nsdf[lag] = v;
    if (v > gmax) {
      gmax = v;
      gLag = lag;
    }
    headE += x[lag] * x[lag];
    tailE += x[n - 1 - lag] * x[n - 1 - lag];
  }
  micSteerTelem.clarity = gmax;
  if (gLag < 0 || gmax < 0.9) return 0; // unvoiced — the tick HOLDS, no wobble
  let pick = gLag;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (
      nsdf[lag] >= 0.9 &&
      nsdf[lag] >= 0.93 * gmax &&
      nsdf[lag] >= nsdf[lag - 1] &&
      nsdf[lag] >= nsdf[lag + 1]
    ) {
      pick = lag;
      break;
    }
  }
  let lagF = pick;
  if (pick > minLag && pick < maxLag) {
    const a = nsdf[pick - 1];
    const b = nsdf[pick];
    const c = nsdf[pick + 1];
    const den = a - 2 * b + c;
    if (Math.abs(den) > 1e-9) lagF = pick + (0.5 * (a - c)) / den;
  }
  const f0 = sr / lagF;
  return f0 >= 60 && f0 <= 800 ? f0 : 0;
}

/** The frequency of the scale note nearest `hz` (any octave). */
function micNearestScaleHz(hz: number, pcs: number[]): number {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const at = Math.round(midi);
  let best = at;
  let bestD = Infinity;
  for (let o = -6; o <= 6; o++) {
    const note = at + o;
    if (!pcs.includes(((note % 12) + 12) % 12)) continue;
    const d = Math.abs(note - midi);
    if (d < bestD) {
      bestD = d;
      best = note;
    }
  }
  return 440 * Math.pow(2, (best - 69) / 12);
}

/** One steering tick: detect → aim → slew → write. Runs only on
 *  micPitchTimer (syncMicPitchLoop owns its lifecycle). The write path is
 *  setRatio — the same atomic LFO-frequency writes a character wear does, so
 *  a slewed 60ms step is parameter-clean, never a graph change. */
function micSteerTick(): void {
  const ac = audioContext();
  const rig = micCharRig;
  const pcs = micScalePcs;
  if (!ac || !rig || !pcs || !micNodes || !micPitchAnalyser) return;
  const f0 = micDetectF0(ac, micPitchAnalyser);
  micSteerTelem.f0 = f0;
  if (!f0) return; // unvoiced: HOLD the last steered ratio
  let target: number;
  if (micVoice === "deep" || micVoice === "chipmunk") {
    const base = micVoice === "deep" ? MIC_DEEP_RATIO : MIC_CHIPMUNK_RATIO;
    // where the caricature ACTUALLY lands the note (the shifter's measured
    // transfer, not the nominal ratio) → pull to the nearest scale tone,
    // never further than the identity clamp allows
    const landHz = f0 * micEffRatio(base);
    const t = micAskedFor(micNearestScaleHz(landHz, pcs) / f0);
    target = Math.min(base * MIC_STEER_CLAMP, Math.max(base / MIC_STEER_CLAMP, t));
  } else if (micVoice === "robot") {
    // the drone note = nearest scale tone to the singer's MEDIAN; the
    // per-frame ratio FLATTENS the voice onto that constant
    micF0Ring[micF0RingAt] = f0;
    micF0RingAt = (micF0RingAt + 1) % micF0Ring.length;
    if (micF0RingN < micF0Ring.length) micF0RingN++;
    micF0Sorted.length = 0;
    for (let i = 0; i < micF0RingN; i++) micF0Sorted.push(micF0Ring[i]);
    micF0Sorted.sort((a, b) => a - b);
    const median = micF0Sorted[micF0Sorted.length >> 1];
    const t = micAskedFor(micNearestScaleHz(median, pcs) / f0);
    target = Math.min(MIC_ROBOT_CLAMP, Math.max(1 / MIC_ROBOT_CLAMP, t));
  } else {
    return; // natural/phone never steer (the loop shouldn't even be running)
  }
  micSteerTelem.target = target;
  micWorkRatio += (target - micWorkRatio) * MIC_STEER_ALPHA;
  micSteerTelem.ratio = micWorkRatio;
  rig.shifter.setRatio(micWorkRatio);
}

/** Start/stop the detector and dress Robot's drone. The interval exists ONLY
 *  while (mic open) ∧ (key known) ∧ (Deep/Chipmunk/Robot worn) — Natural and
 *  Phone pay nothing, keyless songs pay nothing, and stopping restores the
 *  worn character's base ratio exactly as before steering existed. */
function syncMicPitchLoop(): void {
  const ac = audioContext();
  const m = micNodes;
  const steerable = micVoice === "deep" || micVoice === "chipmunk" || micVoice === "robot";
  const want = !!(ac && m && micScalePcs && steerable);
  // Robot's drone layer rides the shift path — spliced structurally like any
  // character path (setCharPath), shed the moment the key or the robot goes
  if (ac && micCharRig && micVoice === "robot")
    setCharPath(ac, micCharRig.paths.shift, want ? MIC_ROBOT_DRONE : 0);
  if (want && !micPitchTimer) {
    // the tap: post-comp, PRE-character — hears the singer, not the shift
    if (!micPitchAnalyser) {
      micPitchAnalyser = ac!.createAnalyser();
      micPitchAnalyser.fftSize = 2048;
    }
    try {
      m!.comp.connect(micPitchAnalyser);
    } catch {
      /* already connected */
    }
    micSteerFresh();
    micPitchTimer = setInterval(micSteerTick, MIC_PITCH_MS);
  } else if (!want && micPitchTimer) {
    clearInterval(micPitchTimer);
    micPitchTimer = null;
    if (micPitchAnalyser && micNodes) {
      try {
        micNodes.comp.disconnect(micPitchAnalyser);
      } catch {
        /* already gone */
      }
    }
    micPitchAnalyser = null;
    // steering off → the worn character's base, exactly as today
    if (micCharRig) {
      micSteerFresh();
      micCharRig.shifter.setRatio(micWorkRatio);
    }
  }
}

/** The playing song's scale as pitch classes 0–11; null = no key → no
 *  steering, base caricatures untouched. The deck feeds this from the same
 *  effect that tempo-syncs the echo, so the voice always chases the song the
 *  listeners are hearing. Remembered across mic open/close (like the echo
 *  bpm) — the detector itself only runs while the mic is open. */
export function setLiveMicKey(scalePcs: number[] | null): void {
  const pcs = scalePcs?.filter((p) => Number.isInteger(p) && p >= 0 && p < 12) ?? null;
  micScalePcs = pcs && pcs.length ? pcs : null;
  syncMicPitchLoop();
}

/** Steering telemetry — running flag, active scale, and the last tick's
 *  f0/clarity/target/ratio (zeros until the first voiced frame). */
function micSteerSnapshot() {
  return { running: micPitchTimer !== null, scale: micScalePcs, ...micSteerTelem };
}

/** DEBUG: dominant frequency (Hz) at the mic BUS — parabolic-interpolated
 *  FFT peak on a lazy high-res analyser (bin ≈ 1.5Hz at 48k). Field/verify
 *  tool only; costs nothing until first called, dies with the mic. */
function micDebugOutHz(): number {
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m) return 0;
  if (!micDebugFft) {
    micDebugFft = ac.createAnalyser();
    micDebugFft.fftSize = 32768;
    micDebugFft.smoothingTimeConstant = 0;
    m.bus.connect(micDebugFft);
  }
  const n = micDebugFft.frequencyBinCount;
  const buf = new Float32Array(n); // debug path — allocation is fine here
  micDebugFft.getFloatFrequencyData(buf);
  const lo = Math.max(2, Math.floor((50 * micDebugFft.fftSize) / ac.sampleRate));
  let bi = lo;
  for (let i = lo + 1; i < n - 1; i++) if (buf[i] > buf[bi]) bi = i;
  const a = buf[bi - 1];
  const b = buf[bi];
  const c = buf[bi + 1];
  const den = a - 2 * b + c;
  const d = Math.abs(den) > 1e-9 ? (0.5 * (a - c)) / den : 0;
  return ((bi + d) * ac.sampleRate) / micDebugFft.fftSize;
}

/** DEBUG: perceived pitch (Hz) at the mic BUS — the same NSDF detector the
 *  steering uses, pointed at the OUTPUT. The granular shifter's spectrum is
 *  a comb of grain-rate sidebands around the shifted carrier, so an FFT max
 *  (micDebugOutHz) can sit a few comb lines off; periodicity reads the pitch
 *  the EAR gets. Field/verify tool only. */
let micDebugPitchAn: AnalyserNode | null = null;
function micDebugOutF0(): number {
  const ac = audioContext();
  const m = micNodes;
  if (!ac || !m) return 0;
  if (!micDebugPitchAn) {
    micDebugPitchAn = ac.createAnalyser();
    micDebugPitchAn.fftSize = 4096;
    m.bus.connect(micDebugPitchAn);
  }
  return micDetectF0(ac, micDebugPitchAn);
}

// --- LIVE PERF PROBE (dev-only) ----------------------------------------------
// Field diagnosis for the live instrument: which mic stages are actually
// rendering right now (a bypassed stage must NOT appear), plus context health
// and the keyboard's notional voice count. Installed on window only in dev.
let midiActiveProbe: () => number = () => 0;
/** lib/midi-live registers its live voice counter here (it imports this
 *  module, so the probe can't import it back — a require cycle). */
export function registerMidiActiveProbe(fn: () => number): void {
  midiActiveProbe = fn;
}

function livePerfSnapshot(): {
  audioCtxState: string;
  baseLatency: number | null;
  activeMicStages: string[];
  /** RMS (0..1, raw) at the mic BUS — post-FX, the exact signal summed into
   *  the broadcast. `null` while the mic is closed. A singing DJ should read
   *  well above 0.05; ~0 with the pill lit = the voice is NOT reaching
   *  listeners (dead device, AEC swallowing it, or a suspended context —
   *  check audioCtxState). The one-call field check for "can they hear me". */
  micThroughRms: number | null;
  broadcastTapLive: boolean;
  midiActiveNotes: number;
} {
  const ac = audioContext();
  // Rides the bus analyser the level dot already polls (enableLiveMic) — no
  // new nodes, no cost while the mic is closed. NB while the context is
  // suspended the analyser holds its last frame: a frozen nonzero read plus
  // audioCtxState !== "running" still means silence on the wire.
  let micThroughRms: number | null = null;
  if (micNodes) {
    const an = micNodes.analyser;
    const n = an.fftSize;
    if (!micLevelBuf || micLevelBuf.length !== n) micLevelBuf = new Uint8Array(n);
    an.getByteTimeDomainData(micLevelBuf);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = (micLevelBuf[i] - 128) / 128;
      sum += v * v;
    }
    micThroughRms = Math.sqrt(sum / n);
  }
  const stages: string[] = [];
  if (micNodes) {
    stages.push("capture"); // hp + comp + char bookends — the always-on spine
    // NB the echo delay stays WIRED at zero (one delay + biquad; unplugging a
    // feedback loop mid-set truncates tails) — this flag means AUDIBLE.
    if (micEchoPos > 0) stages.push("echo");
    if (micConvConnected) stages.push("space");
    if (micPitchTimer) stages.push("keysteer"); // detector interval is live
  }
  const rig = micCharRig;
  if (rig) {
    if (rig.paths.shift.connected) stages.push("shifter");
    if (rig.paths.ring.connected) stages.push("ringmod");
    if (rig.paths.robot.connected) stages.push("robot-band");
    if (rig.paths.phone.connected) stages.push("phone");
  }
  if (micDriveRig?.path.connected) stages.push("drive");
  if (micGlowRig?.path.connected) stages.push("glow");
  return {
    audioCtxState: ac?.state ?? "none",
    baseLatency: ac?.baseLatency ?? null,
    activeMicStages: stages,
    micThroughRms,
    broadcastTapLive: !!broadcastDest,
    midiActiveNotes: midiActiveProbe(),
  };
}

// Gated like __klappn (debugSurfaceWanted): always in dev, and in PROD behind
// the klappnDebug flag — so a field DJ can verify mic signal-through in
// seconds (window.__klappnLivePerf().micThroughRms) instead of singing into
// dead air. Previously dev-only, which made the 07-12 field failure blind.
/** Install the live-mic diagnostic surfaces. Called at module eval AND from
 *  exposeAudioDebug (engine start): dev module graphs can hold TWO instances
 *  of this module (see the __klappnEngine note), and the LIVE one must own
 *  the window keys or every probe reads a dead parallel mic. */
function installMicDebugSurfaces(): void {
  if (typeof window === "undefined" || !debugSurfaceWanted()) return;
  (window as unknown as Record<string, unknown>).__klappnLivePerf = livePerfSnapshot;
  // Mic steering telemetry + remote hooks — the same console a field DJ uses
  // for micThroughRms can watch the key-steer land (snapshot/outHz/outF0) or
  // drive the mic outright; the steering verification harness rides these too.
  (window as unknown as Record<string, unknown>).__klappnMicSteer = {
    snapshot: micSteerSnapshot,
    outHz: micDebugOutHz,
    outF0: micDebugOutF0,
    setKey: setLiveMicKey,
    setVoice: setLiveMicVoice,
    enable: enableLiveMic,
    disable: disableLiveMic,
  };
}
installMicDebugSurfaces();

/** Apply the live perf dials as PARAMETER writes — instant, no compile.
 *  Mirrors filterFreqs (lib/set-live): −100..0 sweeps the LP 12k→400 (log),
 *  0..+100 sweeps the HP 20→2000 (log). Returns false when the chain isn't
 *  up (caller may fall back to a code rebuild). */
export function setLivePerf(perf: {
  filter: number;
  echo: number;
  punch: number;
  space: number;
}): boolean {
  const ac = audioContext();
  if (!perfFx || !ac) return false;
  const t = ac.currentTime;
  const RAMP = 0.04; // zipper-free but immediate to the ear
  const set = (p: AudioParam, v: number) => {
    try {
      p.setTargetAtTime(v, t, RAMP);
    } catch {
      p.value = v;
    }
  };
  const v = perf.filter || 0;
  set(perfFx.lp.frequency, v < 0 ? 12000 * Math.pow(400 / 12000, -v / 100) : 20000);
  set(perfFx.hp.frequency, v > 0 ? 20 * Math.pow(100, v / 100) : 20);
  set(perfFx.echoSend.gain, Math.max(0, Math.min(1, perf.echo || 0)));
  set(perfFx.driveWet.gain, Math.max(0, Math.min(1, perf.punch || 0)));
  const space = Math.max(0, Math.min(1, perf.space || 0));
  set(perfFx.spaceSend.gain, space);
  // lazy convolver: engage on first use, release ~2.5s after the dial zeroes
  // (the tail rings out) — an idle reverb must cost a phone nothing.
  if (space > 0) {
    if (perfFx.convKill) {
      clearTimeout(perfFx.convKill);
      perfFx.convKill = null;
    }
    if (!perfFx.convConnected) {
      try {
        perfFx.spaceSend.connect(perfFx.conv);
        perfFx.convConnected = true;
      } catch {
        /* best-effort */
      }
    }
  } else if (perfFx.convConnected && !perfFx.convKill) {
    perfFx.convKill = setTimeout(() => {
      if (!perfFx || perfFx.convKill === null) return;
      perfFx.convKill = null;
      try {
        perfFx.spaceSend.disconnect(perfFx.conv);
        perfFx.convConnected = false;
      } catch {
        /* already gone */
      }
    }, 2500);
  }
  return true;
}

/** Live tempo: drive the scheduler DIRECTLY (its own supported mid-flight
 *  pivot) — no re-evaluate, no freeze. The arrangement's boundary math and
 *  future rebuilds follow via a.cps + the nudged setcpm decorate writes. */
export function setLiveCps(cps: number): void {
  if (!(cps > 0)) return;
  try {
    if (zaltzActive()) zaltzSetCps(cps); // the deck's nudge, engine-side
    (replInstance as { setCps?: (v: number) => void } | null)?.setCps?.(cps);
    if (arrangement) arrangement.cps = cps;
  } catch {
    /* best-effort — the next evaluate re-asserts tempo */
  }
}

/** Splice a limiter between the master and the speakers (once). Fail-safe: if any
 *  step fails, the original master→destination path is preserved/restored so
 *  audio never dies. */
/** The master limiter chain — a slow GLUE compressor into a fast limiting
 *  DynamicsCompressor into a soft-clip WaveShaper. Returns the chain's input +
 *  output; the caller wires source→input and output→sink.
 *
 *  The glue stage (2026-07-13) is a gentle bus compressor — low ratio, wide
 *  knee, slow attack — that lets transients through and just leans the layers
 *  into each other, the cohesion a mastered track has and a raw stack of
 *  orbits doesn't. Conservative on purpose: at −18dB/2.5:1 with a 12dB knee it
 *  barely moves on a sparse loop and earns ~2-3dB of density on a full one. */
export function buildLimiterChain(ac: BaseAudioContext): { input: AudioNode; output: AudioNode } {
  const glue = ac.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 12;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.03;
  glue.release.value = 0.25;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.2;
  const shaper = ac.createWaveShaper();
  const N = 2048;
  const curve = new Float32Array(N);
  const t = 0.6; // transparent below this
  const c = 0.98; // asymptotic ceiling
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    const a = Math.abs(x);
    curve[i] = a <= t ? x : Math.sign(x) * (t + (c - t) * Math.tanh((a - t) / (c - t)));
  }
  shaper.curve = curve;
  shaper.oversample = "4x";
  glue.connect(comp);
  comp.connect(shaper);
  return { input: glue, output: shaper };
}

function installLimiter(): void {
  if (limiterInstalled) return;
  const ac = audioContext();
  const master = masterNode();
  if (!ac || !master) return; // not ready yet — try again on the next play
  // Step 1: drop the direct master→output edge (the speakers, or the background
  // <audio> sink if a set already rerouted). If it isn't there, bail (don't
  // risk doubling the signal).
  const sink = outputSink(ac);
  try {
    master.disconnect(sink);
  } catch {
    limiterInstalled = true;
    return;
  }
  // Step 2: master → compressor → soft-clipper → speakers. The compressor rides
  // sustained loudness down; the WaveShaper is the sample-accurate ceiling (no
  // attack lag) that a compressor's 2ms attack would let transients spike past.
  try {
    const { input, output } = buildLimiterChain(ac);
    master.connect(input);
    output.connect(sink);
    outputTap = output;
  } catch (e) {
    console.error("[klappn] limiter failed; restoring direct output", e);
    try {
      master.connect(sink);
    } catch {
      /* ignore */
    }
    outputTap = null;
  }
  limiterInstalled = true;
  exposeAudioDebug();
}

/** True when the diagnostic surfaces (window.__klappn / __klappnEngine) should
 *  install: always in dev; in prod only behind the klappnDebug flag — a public
 *  build shouldn't hand every visitor a labelled handle into the engine. */
function debugSurfaceWanted(): boolean {
  return !QUIET_CONSOLE || debugConsoleWanted();
}

/** Diagnostic surface on window.__klappn — lets us measure, from the console on
 *  the real machine, whether crackle is clipping (hot source), the limiter not
 *  installing, or dropouts. `await window.__klappn.diagnose(4)` while a loop plays. */
function exposeAudioDebug(): void {
  if (typeof window === "undefined" || !debugSurfaceWanted()) return;
  installMicDebugSurfaces(); // the LIVE instance re-claims the mic probes too
  const ac = audioContext();
  const master = masterNode();
  if (!ac || !master) return;
  (window as unknown as { __klappn?: unknown }).__klappn = {
    /** The engine's current cycle position (drives the audio AND the playhead). */
    cycle: () => currentCycle(),
    /** Measure the REAL tempo live: samples the scheduler clock over `seconds` and
     *  returns cps + seconds-per-cycle. With setcpm(60/4) this should read cps≈0.25,
     *  secPerCycle≈4. If it's off, the audio isn't playing at the labelled tempo. */
    async timing(seconds = 6) {
      const c0 = currentCycle();
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const c1 = currentCycle();
      const dt = (performance.now() - t0) / 1000;
      const cps = (c1 - c0) / dt;
      return {
        cps: +cps.toFixed(4),
        secPerCycle: cps ? +(1 / cps).toFixed(3) : null,
        cyclesElapsed: +(c1 - c0).toFixed(3),
        overSeconds: +dt.toFixed(2),
      };
    },
    info: () => ({
      sampleRate: ac.sampleRate,
      state: ac.state,
      baseLatency: ac.baseLatency,
      outputLatency: (ac as unknown as { outputLatency?: number }).outputLatency,
      channelCount: ac.destination.channelCount,
      maxChannelCount: ac.destination.maxChannelCount,
      limiterInstalled,
      limiterInPath: !!outputTap,
    }),
    /** Measure peak/RMS at the SOURCE (pre-limiter master) and at the OUTPUT
     *  (post-limiter). Source peak >> 1 ⇒ too hot (saturation grit). Output peak
     *  near 0.9 with source modest ⇒ not clipping (look at dropouts). */
    async diagnose(seconds = 4) {
      const tap = outputTap;
      const aSrc = ac.createAnalyser();
      aSrc.fftSize = 2048;
      master.connect(aSrc);
      const aOut = tap ? ac.createAnalyser() : null;
      if (aOut && tap) {
        aOut.fftSize = 2048;
        tap.connect(aOut);
      }
      const buf = new Float32Array(2048);
      let srcPeak = 0,
        outPeak = 0,
        gaps = 0,
        frames = 0;
      const read = (an: AnalyserNode) => {
        an.getFloatTimeDomainData(buf);
        let p = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]);
          if (v > p) p = v;
        }
        return p;
      };
      let last = performance.now();
      const end = last + seconds * 1000;
      while (performance.now() < end) {
        const now = performance.now();
        if (now - last > 60) gaps++; // a >60ms hiccup in the rAF/timer loop = jank
        last = now;
        frames++;
        srcPeak = Math.max(srcPeak, read(aSrc));
        if (aOut) outPeak = Math.max(outPeak, read(aOut));
        await new Promise((r) => setTimeout(r, 25));
      }
      try {
        master.disconnect(aSrc);
        if (aOut && tap) tap.disconnect(aOut);
      } catch {
        /* ignore */
      }
      return {
        sourcePeak: +srcPeak.toFixed(3),
        outputPeak: tap ? +outPeak.toFixed(3) : "no limiter in path!",
        clippingAtSource: srcPeak > 1,
        mainThreadHiccups: gaps,
        frames,
        ...((window as unknown as { __klappn: { info: () => object } }).__klappn.info()),
      };
    },
  };
}

// --- whole-song playback state ----------------------------------------------
// Song boundaries ride the audio-clock timers (audioSetTimeout): wall timers
// stall on hidden phones, which left a backgrounded song stuck on one loop.
let songTimer: number | null = null;
let songActive = false;
// RUN TOKEN — every playSong() call takes a fresh id. `songActive` is a shared
// boolean, so a call parked on an await (cold-start ensureStarted/resumeAudio —
// seconds on a phone) could resume, see a LATER call's songActive===true, and
// interleave a second step/watch chain into the single songTimer/songStepRef
// slots (double evaluates, seams firing twice). Each call checks its captured id
// after every await and bails the moment a newer call has taken over.
let songRunId = 0;
// STEPPER FALLBACK ONLY (see the arrangement path below): measured
// hush→evaluate cost of a section swap (EMA) — boundaries fire early by this
// so the next loop lands closer to the seam. The arrangement path has no
// seams to compensate: they're pattern math.
let evalLeadMs = 120;

// --- NATIVE ARRANGEMENT MODE (lib/arrange.ts) ---------------------------------
// The WHOLE song as ONE pattern via arrange(): evaluated once, every loop→loop
// seam is rendered by the scheduler as pure pattern math — sample-exact on
// every device, and a backgrounded phone flows through transitions because
// they live INSIDE the pattern, not in a timer. The watcher below is NOT in
// the audio path: it only reports the current section to the UI, services
// hold latches (by stretching the held span in place — phase-preserving), and
// rebuilds when the live section list changes. Sections that can't share one
// pattern (mixed tempos in a set, exotic code) fall back to the stepper.
interface ActiveArrangement {
  spans: ArrangeSpan[];
  totalCycles: number;
  cps: number;
  watcherId: number | null;
  sig: string;
  heldId: string | null;
  heldCycles: number | null;
  overrides: Map<string, string>; // sectionId → live-tweaked code (dial rides)
  /** The UNIT's sections (raw) — a same-tempo slice of the live list. */
  baseList: SongSection[];
  /** First section id — where this unit anchors in the live list. */
  anchorId: string;
  /** Cheap change fingerprint (ids + code lengths) — slow-tick comparisons. */
  rawPrint: string;
  /** Covers the ENTIRE list → the pattern loops forever, no end timer. */
  wholeList: boolean;
  /** The arrangement ENDS at totalCycles (SongEnding "stop") — a terminal
   *  timer stops the transport there instead of letting the pattern wrap. */
  ends: boolean;
  evalFn: (code: string) => Promise<void>;
  rebuildBusy: boolean;
  rebuildPending: boolean;
  /** A debounced rebuild is armed — coalesces a burst of watcher triggers (hold
   *  latches, structure edits) into ONE parse+schedule instead of one per tick. */
  rebuildScheduled?: boolean;
  /** SEEK shift in whole cycles: the program is rebuilt with `.late(shift)`,
   *  so content position = scheduler position − shift. The scheduler clock is
   *  never touched (setCycle desyncs the worker clock — see schedulerCycleNow);
   *  the CONTENT moves under it instead, gaplessly. */
  shift?: number;
}

/** Content-cycle position for an arrangement: scheduler pos minus the seek
 *  shift, wrapped into [0, total). Every span lookup goes through this. */
function contentPos(a: ActiveArrangement): number {
  const raw = schedulerCycle();
  if (raw <= 0) return 0; // fresh-eval negative latency — never wrap it
  const total = Math.max(1, a.totalCycles);
  return (((raw - (a.shift ?? 0)) % total) + total) % total;
}

/** The cheap change fingerprint the slow watcher compares: ids + code lengths
 *  + each section's AUDIBLE arrangement fields — so an unfold edit (bars, a
 *  painted lane, a sweep slider) is HEARD within a watcher tick, not on the
 *  next structural change. String ops only. */
function rawPrintOf(list: { id: string; code: string; arr?: SectionArrange | null }[]): string {
  return list
    .map((s) => {
      const a = s.arr;
      const arrPart = a
        ? JSON.stringify([
            a.bars,
            a.layerCount,
            a.moves,
            (a.sweeps ?? []).map((w) => [w.param, w.from, w.to, w.bar, w.bars, w.curve]),
            // overlays fingerprint by span + code length — an in-place rework
            // (same count, new line) must be HEARD on the next watcher tick.
            (a.overlays ?? []).map((o) => [o.bar, o.bars, o.code?.length ?? 0]),
          ])
        : "";
      return `${s.id}:${s.code.length}:${arrPart}`;
    })
    .join(",");
}

/** Coalesce arrangement rebuilds: a 60ms debounce on the AUDIO clock so several
 *  watcher triggers in one window collapse into a single parse+schedule. Each
 *  rebuildArrangement is a full buildArrangement (regex per section) + eval on the
 *  MAIN thread; firing them back-to-back blocks the scheduler's ~0.2s lookahead
 *  and glitches audio. This bounds the pile-up. */
function requestRebuild(a: ActiveArrangement): void {
  if (a.rebuildScheduled) return;
  a.rebuildScheduled = true;
  // A wider coalesce window on mobile: a burst of watcher triggers (hold latches,
  // a loop growing live, dial rides) collapses into ONE main-thread parse+schedule,
  // giving the scheduler its thread back sooner. Arrangement ops are non-realtime,
  // so ~140ms is imperceptible. (Live NL/knob edits bypass this — they go straight
  // through liveUpdate — so their throttle lives in SongClient.)
  audioSetTimeout(() => {
    a.rebuildScheduled = false;
    if (arrangement === a && songActive) void rebuildArrangement(a);
  }, isMobileDevice() ? 140 : 60);
}
let arrangement: ActiveArrangement | null = null;
const HOLD_STRETCH = 512; // cycles a latched hold extends by (re-extended as needed)
let lastRebuildProgramHead = ""; // debug surface: what the last rebuild evaluated

/** The unit's sections, refreshed from the live list (edits, growing loops)
 *  but never re-scoped here — structural adoption is the watcher's job. */
function arrangementList(a: ActiveArrangement): SongSection[] {
  const live = songOpts.sectionsFor?.().filter((s) => s.code && s.code.trim());
  if (!live || !live.length) return a.baseList;
  return a.baseList.map((b) => live.find((s) => s.id === b.id) ?? b);
}

/** A section's finite repeat multiplier (1 for none/∞ — ∞ rides holdSection). */
function sectionRepeats(id: string): number {
  const n = songOpts.repeatsFor?.(id);
  return Number.isFinite(n) && (n as number) >= 1 ? Math.min(64, Math.floor(n as number)) : 1;
}

function arrangementInput(a: ActiveArrangement): ArrangeSection[] {
  return arrangementList(a).map((s) => ({
    id: s.id,
    code:
      a.overrides.get(s.id) ??
      (songOpts.decorate ? songOpts.decorate(s.code, s.id) : s.code),
    seconds:
      Math.max(0.5, songOpts.secondsFor?.(s.id) ?? s.seconds) * sectionRepeats(s.id),
    cycles: a.heldId === s.id && a.heldCycles ? a.heldCycles : undefined,
    // whether a dialled repeat keeps its arrangement is the CALLER's call —
    // arrOf() only attaches arr when it was authored for the current dial,
    // and its bars then equal repeats × natural, so the span math agrees.
    arr: s.arr,
  }));
}

function arrangementSig(a: ActiveArrangement): string {
  // MUSICAL lengths (cycles), not wall seconds: a live tempo nudge scales
  // secondsFor and cps inversely, so cycles stay put — a tempo move must
  // never read as a structure change (that fired a full recompile per nudge).
  return arrangementList(a)
    .map((s) => {
      const secs = songOpts.secondsFor?.(s.id) ?? s.seconds;
      const cycles = Math.round(secs * a.cps * sectionRepeats(s.id) * 4) / 4;
      return `${s.id}|${cycles}|${s.code.length}`;
    })
    .join(";");
}

/** Re-evaluate the arrangement WITHOUT hush — the scheduler keeps its cycle
 *  position, so an unchanged grid prefix means a seamless in-place swap
 *  (hold stretches, dial rides, a growing loop's new layers). Coalesced. */
async function rebuildArrangement(a: ActiveArrangement): Promise<void> {
  if (arrangement !== a || !songActive) return;
  graceVisualYield(); // rebuild = a transient stall, not sustained playback jank
  if (a.rebuildBusy) {
    a.rebuildPending = true;
    return;
  }
  a.rebuildBusy = true;
  try {
    do {
      a.rebuildPending = false;
      // Visual stays as-is on rebuilds — re-running the shader per dial move
      // is the main-thread cost that stuttered phones.
      const buildOpts = {
        attachVisual: false as const,
        ending: a.ends ? (songOpts.ending ?? null) : null,
        effects: songOpts.effectsFor?.() ?? null,
        overlays: songOpts.overlaysFor?.() ?? null,
        lateCycles: a.shift ?? 0,
        keepOrbits: songOpts.keepOrbits,
      };
      let built = buildArrangement(arrangementInput(a), buildOpts);
      if (!built && a.overrides.size) {
        // A TEMPO dial move makes the overridden section's setcpm disagree
        // with the freshly-decorated rest — the overrides are stale, the
        // decorate closure already carries the new dial state for EVERY
        // section. Drop them and build clean.
        a.overrides.clear();
        built = buildArrangement(arrangementInput(a), buildOpts);
      }
      if (!built) return;
      // Debug surface keeps the WHOLE program (gated behind debugSurfaceWanted;
      // it's one string) — a truncated head made live-toggle bugs (mute/solo
      // reaching the engine or not) impossible to diagnose from the console.
      lastRebuildProgramHead = built.program;
      try {
        await a.evalFn(built.program);
      } catch {
        return; // a transient bad intermediate — the next change recovers
      }
      if (arrangement !== a) return;
      a.spans = built.spans;
      a.totalCycles = built.totalCycles;
      a.cps = built.cps; // unit-end math must follow a live tempo change
      a.sig = arrangementSig(a);
    } while (a.rebuildPending);
  } finally {
    a.rebuildBusy = false;
  }
}

function stopArrangement(): void {
  if (arrangement?.watcherId != null) clearAudioTimeout(arrangement.watcherId);
  arrangement = null;
}

// --- hydra (visuals) --------------------------------------------------------
// A loop carries its visuals as an inert `/* @hydra */` block. When visuals are
// ON, we run that block as real Hydra code together with the audio (one
// evaluate(), so they share the transport clock and stay in sync).
type HydraMod = {
  initHydra: (opts?: Record<string, unknown>) => Promise<unknown>;
  H: (pattern: unknown) => () => number;
  clearHydra: () => void;
};
let hydraMod: HydraMod | null = null;
let hydraLoaded = false; // modules imported + globals set (one-time)
let hydraReady = false; // the ONE session canvas/context exists (clearVisuals soft-hides, never removes it)
let visualsEnabled = true;
// The live Hydra instance + a one-time resize binding so the canvas + render
// buffers refit when the window/screen dimensions change.
let hydraInstance: {
  setResolution?: (w: number, h: number) => void;
  hush?: () => void;
} | null = null;
let resizeBound = false;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
// Bound ONCE per live canvas / page: a webglcontextlost recovery handler and a
// pagehide handler that frees the GPU context on real teardown.
let contextLossBound = false;
let unloadReleaseBound = false;
// Render the canvas at the device's pixel ratio (capped at 2) so the visuals are
// crisp on retina, not soft. The fill is set both at init (pixelRatio) and on
// every resize (setResolution scaled by the same ratio).
// COST CAP (the user, 2026-07-02): render the visual at 1× — every hydra stage runs per PIXEL,
// so 2× retina was 4× the GPU work for a layer that mostly plays as a dim whisper behind the UI.
// Generative visuals read fine at 1× even fullscreen; the page must never lag for them.
//
// PHONES run LOW-POWER visuals (2026-07-05): half resolution (¼ the fragment
// work) + a 30fps cap (see ensureHydra) — hydra's draw calls share the main
// thread with the audio scheduler, and on a weak phone full-rate visuals
// starve it into burst/stop/burst stutter. The dreamy gradient language reads
// fine soft and slow; the music never should. armVisualYield() is the backstop.
const HYDRA_DPR = 1;
// Weak-GPU friendly: render Hydra at 0.4× (≈1/6 the fragment work of full-res),
// upscaled to fill — the dreamy gradient language reads fine soft, and the low res
// is the cheapest lever (no AI, just fewer pixels). 30fps cap on top.
const HYDRA_DPR_MOBILE = 0.4;
const HYDRA_FPS_MOBILE = 30;
function hydraDpr(): number {
  return isMobileDevice() ? HYDRA_DPR_MOBILE : HYDRA_DPR;
}
function fitHydra(): void {
  try {
    hydraInstance?.setResolution?.(
      window.innerWidth * hydraDpr(),
      window.innerHeight * hydraDpr(),
    );
  } catch {
    /* ignore — canvas may be mid-teardown */
  }
}

/** PHONES: visuals are ON again (2026-07-07 — they were OFF while mobile ran the
 *  heavy loops; now mobile plays the LOW-CPU twins, freeing headroom for a
 *  low-res/30fps Hydra that no longer starves the audio scheduler). ?vis=0 (or
 *  localStorage klappnMobileVisuals="0") turns them off on a weak device. */
function mobileVisualsAllowed(): boolean {
  if (!isMobileDevice()) return true;
  try {
    return localStorage.getItem("klappnMobileVisuals") !== "0";
  } catch {
    return true;
  }
}

/** Turn visuals on/off (default on; phones default OFF — see above). The next
 *  evaluate() reflects it. */
export function setVisuals(on: boolean): void {
  visualsEnabled = on && mobileVisualsAllowed();
  if (!visualsEnabled) clearVisuals();
}
export function visualsOn(): boolean {
  return visualsEnabled;
}

/** Lazy-load + initialise Hydra (WebGL canvas overlay). hydra-synth is bundled
 *  locally and handed to @strudel/hydra via a no-op `src`, so there's no runtime
 *  CDN fetch. Returns false (and disables visuals quietly) if WebGL/Hydra fail. */
async function ensureHydra(): Promise<boolean> {
  // THE bulletproof mobile gate: every visual render path funnels through here,
  // so refusing to init Hydra when visuals aren't allowed guarantees NO canvas
  // and NO WebGL on phones — regardless of visualsEnabled's boot-time race
  // (it starts `true` and only flips false once ensureStarted runs, so an idle
  // visual firing during warm-up used to slip a canvas onto the song page).
  if (!mobileVisualsAllowed()) return false;
  if (hydraReady) {
    // The canvas/context persist for the whole session; a prior stop/song-switch
    // only SOFT-HID it (clearVisuals). Re-show it here instead of building a new
    // Hydra — a fresh instance spawns a second, never-stopping rAF loop that pins
    // its own WebGL context forever, and enough of those crash-reload the tab.
    const shown = document.getElementById("hydra-canvas") as HTMLElement | null;
    if (shown) {
      if (shown.style.display === "none") {
        shown.style.display = "";
        fitHydra(); // restore viewport resolution (a video export may have left it at 1080p)
      }
      return true;
    }
    // Marked ready but the canvas is gone (a context-loss teardown that raced this
    // call): fall through to a fresh init rather than returning a canvas-less ready.
    hydraReady = false;
  }
  if (typeof window === "undefined") return false;
  installConsoleGate(); // capture swallowed shader-compile errors + mute engine chatter in prod
  try {
    if (!hydraLoaded) {
      // hydra-synth is authored for Node and references the `global` object,
      // which doesn't exist in browsers — alias it to globalThis BEFORE the
      // module loads, or its body throws "global is not defined".
      const g = globalThis as Record<string, unknown>;
      if (typeof g.global === "undefined") g.global = globalThis;
      if (!hydraMod) hydraMod = (await import("@strudel/hydra")) as HydraMod;
      const synth = await import("hydra-synth");
      g.Hydra = (synth as { default?: unknown }).default ?? synth;
      // H() is the Strudel→Hydra bridge; expose it to the evaluated code's scope.
      g.H = hydraMod.H;
      hydraLoaded = true;
    }
    // Create the ONE session canvas. This runs only on a true first init (or after
    // a context-loss rebuild) — every ordinary stop/resume keeps this same canvas
    // and just soft-hides/re-shows it (see clearVisuals + the hydraReady re-show
    // above), so we never spawn a second Hydra instance.
    // The no-op module handed to Hydra as its `src`; revoke it once init has
    // imported it, or every (re)init leaks a blob URL for the session.
    const noop = URL.createObjectURL(
      new Blob(["export default {}"], { type: "text/javascript" }),
    );
    try {
      hydraInstance = (await hydraMod!.initHydra({
        src: noop,
        detectAudio: false,
        pixelated: false,
        pixelRatio: hydraDpr(), // desktop 1×; phones ½× (low-power mode, see HYDRA_DPR_MOBILE)
        // extra keys flow into the Hydra constructor; fps caps its rAF tick.
        ...(isMobileDevice() ? { fps: HYDRA_FPS_MOBILE } : {}),
      })) as typeof hydraInstance;
    } finally {
      try {
        URL.revokeObjectURL(noop);
      } catch {
        /* ignore */
      }
    }
    fitHydra(); // size to the current viewport right away
    armVisualYield(); // phones: music wins — sustained jank turns visuals off
    // Refit on resize (debounced) so visuals always fill the screen edge-to-edge.
    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener("resize", () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitHydra, 150);
      });
    }
    hydraReady = true;
    bindHydraContextLoss(); // recover gracefully if the GPU drops this context
    bindHydraUnloadRelease(); // free the context on real page teardown
    return true;
  } catch (e) {
    console.error("[klappn] visuals init failed; visuals disabled", e);
    visualsEnabled = false;
    return false;
  }
}

/** WARM the Hydra engine's heavy modules ahead of play — the @strudel/hydra + hydra-synth
 *  dynamic imports are the slow part, and they were only fetched lazily on the FIRST play,
 *  so a song that ALREADY has visuals took a beat to light up. Call this on page load when
 *  the song has visuals: it does ONLY the imports (no canvas, no render loop — the canvas
 *  is still created on the first play), so when you hit play the visual is instant. Idempotent
 *  and best-effort — if it fails, play just lazy-loads as before. */
export async function preloadHydra(): Promise<void> {
  if (hydraLoaded || typeof window === "undefined") return;
  try {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.global === "undefined") g.global = globalThis;
    if (!hydraMod) hydraMod = (await import("@strudel/hydra")) as HydraMod;
    const synth = await import("hydra-synth");
    g.Hydra = (synth as { default?: unknown }).default ?? synth;
    g.H = hydraMod.H;
    hydraLoaded = true;
  } catch {
    /* best-effort warm — the first play will lazy-load if this didn't land */
  }
}

/** Re-run ONLY the visuals from `code` (its @hydra block) — the audio scheduler
 *  is NEVER touched, so tweaking a visual knob can't pause the music. The hydra
 *  block is plain JS over globals (osc/H/… installed by initHydra/initStrudel),
 *  so it can be executed directly without re-evaluating the Strudel program.
 *
 *  THROTTLED: a slider drag fires dozens of calls per second, and each eval
 *  rebuilds the whole Hydra chain ON THE MAIN THREAD — un-throttled, that
 *  starves the audio scheduler (which shares the thread) and the music
 *  stutters. Calls are coalesced to one eval per ~120ms, trailing edge, so the
 *  look still tracks the finger but the audio never feels it.
 *
 *  No-op when visuals are off or the loop has none; errors leave the previous
 *  frame running. */
let visualsTimer: ReturnType<typeof setTimeout> | null = null;
let visualsQueued: string | null = null;
export async function updateVisuals(code: string): Promise<void> {
  visualsQueued = code;
  if (visualsTimer) return; // an eval is already scheduled — it'll take the latest
  visualsTimer = setTimeout(async () => {
    visualsTimer = null;
    const queued = visualsQueued;
    visualsQueued = null;
    if (!queued) return;
    const hydra = extractHydra(queued);
    if (!visualsEnabled || !hydra) return;
    if (!(await ensureHydra())) return;
    try {
      new Function(hydra)();
    } catch (e) {
      console.error("[klappn] visual tweak failed; keeping previous look", e);
      reportHydraError(e instanceof Error ? e.message : String(e));
    }
  }, 120);
}

// SOFT-HIDE the visuals — the crux of the no-crash fix. We deliberately do NOT
// remove the canvas or drop the Hydra instance: @strudel/hydra's clearHydra()
// only does canvas.remove(), which leaves the WebGL context — and hydra-synth's
// never-stopping rAF loop that pins it — leaked, and the next play would build a
// whole new one. Over a session those pile up until Safari's Web Content process
// hits its memory ceiling and reload-crashes the tab. Instead we keep the ONE
// context alive and just blank + hide it; the next ensureHydra() re-shows it.
function clearVisuals(): void {
  try {
    hydraInstance?.hush?.(); // paint the outputs transparent — no stale picture
  } catch {
    /* ignore — visuals are cosmetic */
  }
  if (typeof document !== "undefined") {
    const canvas = document.getElementById("hydra-canvas") as HTMLElement | null;
    if (canvas) canvas.style.display = "none";
  }
  // hydraReady stays true and the canvas/context stay alive on purpose.
}

/** Free the live WebGL context immediately (Safari won't do it on its own, and a
 *  detached canvas keeps its context). Used on real page teardown. */
function releaseHydraContext(): void {
  if (typeof document === "undefined") return;
  try {
    const canvas = document.getElementById(
      "hydra-canvas",
    ) as HTMLCanvasElement | null;
    const gl =
      (canvas?.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas?.getContext("webgl2") as WebGL2RenderingContext | null);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* ignore */
  }
}

/** Recover from a lost GPU context (driver reset, tab backgrounding, hitting the
 *  browser's live-context cap). We can't rebuild hydra's GL resources in place, so
 *  drop the dead canvas and flag a fresh init on the next play — the audio, which
 *  runs on its own thread, never depended on this. */
function bindHydraContextLoss(): void {
  if (contextLossBound || typeof document === "undefined") return;
  const canvas = document.getElementById(
    "hydra-canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) return;
  contextLossBound = true;
  canvas.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      try {
        document.getElementById("hydra-canvas")?.remove();
      } catch {
        /* ignore */
      }
      hydraInstance = null;
      hydraReady = false;
      contextLossBound = false; // rebind onto the fresh canvas next init
      console.warn("[klappn] WebGL context lost — visuals re-init on next play");
    },
    false,
  );
}

/** On genuine page teardown (tab close / bfcache) release the GPU context. Client
 *  navigations don't fire pagehide, so the single session context survives them. */
function bindHydraUnloadRelease(): void {
  if (unloadReleaseBound || typeof window === "undefined") return;
  unloadReleaseBound = true;
  window.addEventListener("pagehide", releaseHydraContext);
}

// MUSIC WINS (2026-07-05): the audio scheduler shares the main thread with
// hydra's render loop, and on a phone that can't carry both, the sound plays
// in bursts (a second of lookahead, silence, a burst). Low-power mode (½ res +
// 30fps) makes that rare; this is the backstop for the phones where it isn't:
// watch the frame cadence while music plays, and after repeated long stalls
// turn the visuals off for the rest of the session. A single stall is normal
// (a section evaluate, a GC pause) — only a PATTERN of them yields.
let yieldWatcherRunning = false;
// A forward GRACE window. Heavy but TRANSIENT work — a program (re)build, the
// adoption re-eval when you navigate home→song, engine warm-up — stalls the thread
// for a beat, and that is NOT the sustained playback jank this backstop guards
// against. Any such op opens a grace window (graceVisualYield); while it's open the
// watcher accumulates no strikes, so ONLY stalls during STEADY playback (long
// stretches with no re-evals) can ever yield the visuals. This is what keeps mobile
// visuals seamless across navigation, exactly like desktop — the false-trip that
// used to blank the canvas on every home→song nav is gone.
let visualYieldGraceUntil = 0;
function graceVisualYield(ms = 3000): void {
  visualYieldGraceUntil =
    (typeof performance !== "undefined" ? performance.now() : 0) + ms;
}
function armVisualYield(): void {
  if (yieldWatcherRunning || !isMobileDevice() || typeof window === "undefined") return;
  yieldWatcherRunning = true;
  const STALL_MS = 200; // one missed ~12 frames — real jank, not a slow frame
  const STRIKES_TO_YIELD = 3;
  const STRIKE_WINDOW_MS = 12000; // strikes must cluster to count as a pattern
  let last = performance.now();
  let strikes: number[] = [];
  const tick = (now: number) => {
    if (!visualsEnabled || !hydraReady) {
      yieldWatcherRunning = false; // canvas is down — re-armed by the next ensureHydra
      return;
    }
    // Inside a grace window (a re-eval / navigation just happened): the stall is
    // expected and transient, never sustained jank. Forget it and keep watching.
    if (now < visualYieldGraceUntil) {
      strikes.length = 0;
      last = now;
      requestAnimationFrame(tick);
      return;
    }
    // A hidden tab throttles rAF by design; that gap says nothing about load.
    if (document.visibilityState === "visible" && transportActive && now - last > STALL_MS) {
      strikes = strikes.filter((t) => now - t < STRIKE_WINDOW_MS);
      strikes.push(now);
      if (strikes.length >= STRIKES_TO_YIELD) {
        console.warn("[klappn] visuals yielded to audio (sustained main-thread stalls)");
        yieldWatcherRunning = false;
        setVisuals(false); // clears the canvas; the music sails on
        return;
      }
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(tick);
  });
}

/** Hide the visuals — leaving a page, switching to a loop with no picture, exports.
 *  This SOFT-hides (see clearVisuals): the single WebGL context is kept alive for the
 *  session and re-shown on the next play, never rebuilt. The context is only truly
 *  released on real page teardown (bindHydraUnloadRelease). (Stop/pause don't freeze;
 *  the visual keeps drifting via the idle visual clock — see visualClock.) */
export function teardownVisuals(): void {
  clearVisuals();
}

// Hydra's `speed` scales its render-loop time. We keep it at 1 (thawed) so the canvas always
// renders; the visual's MOTION comes from the global time source (visualClock) that H() samples,
// so stop/pause drift rather than freeze. thaw() also re-arms speed on resume in case a sketch
// or a prior state left it at 0.
function setHydraSpeed(v: number): void {
  try {
    const inst = hydraInstance as { synth?: { speed?: number } } | null;
    if (inst?.synth && typeof inst.synth.speed === "number")
      inst.synth.speed = v;
    // hydra also mirrors sketch globals on window (makeGlobal) — keep in sync.
    const g = globalThis as Record<string, unknown>;
    if (typeof g.speed === "number") g.speed = v;
  } catch {
    /* visuals are cosmetic — never let this throw into the audio path */
  }
}
function thawVisuals(): void {
  if (hydraReady) setHydraSpeed(1);
}

// --- visual clock: keep the visuals BREATHING and FLOWING, never snapping --------------------
// The H() bridge that drives the visuals samples the GLOBAL time source every frame. The repl
// wires that to repl.scheduler.now() — but hush() ZEROES the scheduler on every play and every
// section start, and it reads 0 while stopped, so sampling it directly SNAPS the visual back to
// a set frame the moment you press play (or change section). We install our OWN time source: a
// CONTINUOUS ODOMETER that only ever moves FORWARD — it accrues cycle-position at a calm creep
// while idle/paused and at the music's MEASURED rate while playing. Because it never resets, the
// visual keeps animating from exactly where it had drifted to and just "gears up" to the track —
// no jump. The audio scheduler runs off its own clock; this feeds only signal/visual sampling.
//
// The repl re-points the time source → scheduler.now() on EVERY evaluate (repl.mjs), so we RE-ARM
// our clock after every evaluate (see evalProgram), at init, and when leaving play. Re-arming only
// resets the SAMPLING refs, never the odometer, so motion stays unbroken. scheduler.now() is a
// METHOD (bound) — calling it unbound throws.
const IDLE_CPS = 0.08; // calm idle creep — ~one signal cycle every ~12.5s, much slower than the track
let replInstance: { scheduler?: { now?: () => number } } | null = null;
let transportActive = false; // true ONLY during active playback (false when paused/stopped/idle)
let visCycles = 0; // the odometer: monotonic visual cycle-position, NEVER reset (that's what kills the snap)
let visLastMs = 0; // wall-clock at the last sample
let visLastSched = 0; // scheduler cycle at the last sample, to measure the music's live rate
let visCps = IDLE_CPS; // last good music rate (cycles/sec), measured from the scheduler each frame
function perfNow(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}
function schedulerCycle(): number {
  // under ?engine=zaltz the repl is silent — position comes from the
  // engine that's actually sounding (same downbeat semantics: hush/eval = 0)
  if (zaltzActive()) return zaltzCycleNow();
  try {
    return replInstance?.scheduler?.now?.() ?? 0; // method call → correctly bound
  } catch {
    return 0;
  }
}
function visualClock(): number {
  const now = perfNow();
  if (!visLastMs) {
    visLastMs = now;
    visLastSched = schedulerCycle();
  }
  const dtReal = (now - visLastMs) / 1000;
  visLastMs = now;
  // STALL CLAMP (2026-07-22, the user: "no jumps"): the odometer advances by
  // wall-clock dt, so when the main thread stalls — a section-boundary
  // re-render walking the whole song tree, a GC pause — the NEXT frame used
  // to leap the visual forward by the entire stall: a visible jump-cut. Cap
  // the per-frame advance at ~2 frames' worth; after a stall the visual
  // GLIDES on from where it froze. (The odometer is freewheeling — phase
  // continuity is its whole contract — so the small lag this trades in is
  // invisible; the rate measure below still uses the REAL dt.)
  const dt = Math.min(dtReal, 0.1);
  if (transportActive) {
    const s = schedulerCycle();
    const dCyc = s - visLastSched;
    visLastSched = s;
    // Measure the music's true rate from FORWARD deltas only; IGNORE the scheduler resets
    // (dCyc <= 0 at a play / section / loop boundary) and glitches — so the odometer never jumps.
    if (dtReal > 0 && dCyc > 0 && dCyc < 2) visCps = dCyc / dtReal;
    visCycles += dt * visCps;
  } else {
    visCycles += dt * IDLE_CPS; // idle / paused → calm creep, continuing from where it is
  }
  return visCycles;
}
/** (Re)install our continuous odometer as the global time source. Called at init, when leaving
 *  play (stop/pause), and after EVERY evaluate (evalProgram) — the repl keeps re-pointing the
 *  source at scheduler.now(). Resets only the sampling refs, NEVER the odometer, so the visual
 *  flows unbroken across play / pause / section boundaries. */
function armVisualClock(): void {
  visLastMs = perfNow();
  visLastSched = schedulerCycle();
  mod?.setTime?.(visualClock);
}

/** Render + gently animate a song's visual WITHOUT playing audio. Mounts the @hydra block on
 *  the full-screen (behind-the-UI) canvas; the calm motion comes from the idle visual clock
 *  above. Call it on load when the song has visuals so the backdrop breathes instead of sitting
 *  frozen until you press play. Best-effort — visuals are cosmetic, never throw into audio. */
export async function startIdleVisual(code: string): Promise<void> {
  if (typeof window === "undefined" || !visualsEnabled) return;
  const hydra = extractHydra(code);
  if (!hydra) return;
  await ensureStarted(); // boots the repl + installs the visual clock (idempotent)
  if (!(await ensureHydra())) return;
  try {
    thawVisuals(); // ensure the render loop is live (a prior stop may have held it)
    // Re-arm our visual clock right here: anything that evaluated since init (sample warm-up,
    // etc.) would have re-pointed setTime back to scheduler.now(). With nothing playing,
    // transportActive is false, so this makes the idle drift take effect immediately.
    if (!transportActive) armVisualClock();
    new Function(hydra)();
  } catch (e) {
    console.error("[klappn] idle visual failed to start", e);
  }
}

// A surface that drives visuals EXPLICITLY (startIdleVisual/updateVisuals — the
// door) keeps the @hydra block OUT of every evaluated program: the combined
// path can die on prod chunk splits, and its failure handler turns visuals off
// for the WHOLE session — killing the picture at the exact moment play starts,
// with the explicit repaint then gated off by the same flag.
let explicitVisualsDrive = false;
export function setExplicitVisualsDrive(on: boolean): void {
  explicitVisualsDrive = on;
}

/** Build the program to evaluate: music alone, or (visuals on + loop has a
 *  @hydra block) the Hydra code FIRST then the music, so the music's `$:` stack
 *  is the final pattern and the visuals run as a side effect alongside it. */
async function buildProgram(code: string): Promise<string> {
  const hydra = extractHydra(code);
  const music = stripHydraBlock(code);
  if (explicitVisualsDrive) return music;
  if (visualsEnabled && hydra && (await ensureHydra())) {
    return `${hydra}\n\n${music}`;
  }
  return music;
}

/** Evaluate a loop, visuals included if on. CRITICAL: if the combined program
 *  throws (a bad/unsupported Hydra line), retry AUDIO-ONLY so the sound never
 *  dies because of the visuals. */
// ORBIT LEAK PRUNE (2026-07-06i): the engine creates an audio bus ("orbit")
// per distinct (channel, reverb-signature) — and NEVER frees them. A SET splits
// layers per-channel (drums/bass/melody decades), so it builds ~2× the orbits a
// song does for the same material, and every section that introduces a new
// reverb signature adds ANOTHER orbit that lives forever. Each orbit with reverb
// is a convolver grinding the AUDIO THREAD continuously — measured growing
// 4→7→9→… across a set while the song page holds a flat 4. That accumulation
// starves a phone's audio render quantum: the "random pauses that get worse",
// live-only. Songs never hit it (one small stable graph). So after each program
// settles, tear down every orbit the CURRENT program doesn't use — bounding the
// live graph to one song's worth of buses instead of a whole night's.
function orbitsInProgram(program: string): Set<number> {
  const keep = new Set<number>();
  for (const m of program.matchAll(/\.orbit\(\s*(\d+)\s*\)/g)) keep.add(Number(m[1]));
  return keep;
}
let orbitPruneTimer: ReturnType<typeof setTimeout> | null = null;
// The orbits the CURRENT program uses (+ the sacrosanct default bus {0,1}). Updated
// on every eval; the prune ticker reaps everything else. A rolling set, NOT a
// per-eval timer, so a long set with frequent rebuilds (holds, dial rides, growing
// loops) can't keep POSTPONING the prune — the bug that let "Golem Strut"'s four
// reverb convolvers grind on under every later loop and made long play degrade.
let orbitKeep = new Set<number>([0, 1]);
function pruneOrbitsNow(): void {
  try {
    const c = mod?.getSuperdoughAudioController?.() as
      | { nodes?: Record<string, { disconnect?: () => void }> }
      | undefined;
    const nodes = c?.nodes;
    if (!nodes) return;
    for (const k of Object.keys(nodes)) {
      if (orbitKeep.has(Number(k))) continue;
      try {
        nodes[k].disconnect?.();
      } catch {
        /* already detached */
      }
      delete nodes[k];
    }
  } catch {
    /* best-effort — a stale orbit is a leak, never a crash */
  }
}
function scheduleOrbitPrune(program: string): void {
  // The DEFAULT BUS is sacrosanct: layers without an explicit .orbit() play on
  // orbit 1 (and 0 on some builds). Never tear it down.
  const keep = orbitsInProgram(program);
  keep.add(0);
  keep.add(1);
  orbitKeep = keep; // remember the LATEST program's orbits for the next tick
  if (orbitPruneTimer) return; // a prune is already pending — it'll use orbitKeep
  // Self-rescheduling every ~4s WHILE PLAYING (the 4s delay lets a left section's
  // reverb/delay tail ring out before teardown). Because subsequent evals only
  // update orbitKeep and never cancel this, abandoned orbits are always reaped
  // within a tick — no matter how often the program changes.
  const tick = () => {
    orbitPruneTimer = null;
    pruneOrbitsNow();
    if (transportActive) orbitPruneTimer = setTimeout(tick, 4000);
  };
  orbitPruneTimer = setTimeout(tick, 4000);
}

/** Cap reverb tail length on mobile — see MOBILE_ROOMSIZE_CAP. Pure string
 *  transform (roomsize is a bare-number arg), applied at the eval chokepoint so
 *  it covers every song/set/loop path. No-op on desktop or with ?rev=full. */
function lightenForMobile(code: string): string {
  // ZALTZ reverbs are engine-side FDNs on the audio thread — phones play the
  // full mix untouched. The cap only survives for the superdough fallback
  // session, where convolvers on the main thread are still the hog.
  if (!isMobileDevice() || !mobileLighten || isZaltz()) return code;
  // 1) cut the reverb COUNT (fewer convolvers — the dominant per-block audio-thread
  // cost), 2) shorten each surviving tail (cheaper IR). Order matters: cap first so
  // the roomsize cap only touches the reverbs we keep.
  // ADAPTIVE (2026-07-07): on the DENSEST loops (≥10 layers — the Golem/Dybbuk class
  // whose per-cycle synthesis already maxes the phone) drop to ONE shared convolver.
  // capReverbs keeps the STRONGEST send, so this thins the quietest wash, not the
  // lead. Sparser loops keep the normal cap. ?rev=full (mobileLighten=false) is the
  // A/B escape hatch.
  const layerCount = (code.match(/^\s*_?\$\s*:/gm) || []).length;
  const cap = layerCount >= 10 ? Math.min(mobileMaxReverbs, 1) : mobileMaxReverbs;
  let out = cap > 0 ? capReverbs(code, cap) : code;
  out = out.replace(/\.roomsize\(\s*([\d.]+)\s*\)/g, (m, n) => {
    const v = Number(n);
    return Number.isFinite(v) && v > MOBILE_ROOMSIZE_CAP
      ? `.roomsize(${MOBILE_ROOMSIZE_CAP})`
      : m;
  });
  return out;
}

// Armed by the play paths when a NEW loop takes over a LIVE zaltz
// session: the next evaluate crossfades (old music retires under the new
// downbeat) instead of hushing into a silence hole. One-shot.
let zaltzTakeoverNext = false;

// WHO the running program belongs to (song/set id, from the play call). The
// crossfade takeover is a SAME-OWNER courtesy — replaying your own song from
// another loop, the growing build re-starting. A DIFFERENT owner taking the
// engine (new song page while another song rides the dock) must CUT at the
// tap: the takeover's load-wait + 1.2s retire otherwise plays seconds of the
// OLD song under the new downbeat ("spillage", 2026-07-19).
let programOwner: string | null = null;

async function evalProgram(
  evaluate: (code: string, autoplay?: boolean) => Promise<unknown>,
  code: string,
): Promise<void> {
  graceVisualYield(); // a compile is a transient stall — don't let it yield visuals
  code = lightenForMobile(code); // phones: shorten reverb tails (the audio-thread hog)
  const program = await buildProgram(code);
  // Debug surface: EVERY evaluated program lands here (not just arrangement
  // rebuilds) — the initial play/takeover evals were invisible, which made
  // live-toggle bugs (solo/mute reaching the engine or not) undiagnosable.
  lastRebuildProgramHead = program;
  // ZALTZ: our own WASM engine takes the program — audio renders on the
  // audio thread, the repl stays silent. VISUALS RIDE ALONG: the combined
  // program's hydra lines execute during OUR evaluate (the hydra globals are
  // page-level, H() reads the flag-aware scheduler clock), with the same
  // audio-only retry contract as the repl path below.
  if (isZaltz()) {
    const ac = audioContext();
    if (ac) {
      const takeover = zaltzTakeoverNext;
      zaltzTakeoverNext = false;
      thawVisuals(); // pause froze the clock — re-arm time BEFORE the sketch runs
      try {
        try {
          // pour through the MASTER — limiter chain, swallow/release rides, and
          // the mobile background sink all live behind it
          await zaltzEvaluate(program, ac, masterNode() ?? null, takeover);
        } catch (e) {
          if (zaltzBootFailed()) throw e; // engine never booted — not a visuals problem
          const music = stripHydraBlock(program);
          if (program === music) throw e; // not a visuals problem — bubble up
          console.error("[klappn] visuals failed to run; playing audio only", e);
          reportHydraError(e instanceof Error ? e.message : String(e));
          visualsEnabled = false;
          clearVisuals();
          await zaltzEvaluate(music, ac, masterNode() ?? null, takeover);
        }
        return;
      } catch (e) {
        // ENGINE BOOT FAILURE (browser too old for the wasm/worklet, or the
        // assets never loaded): isZaltz() now reports false for the whole
        // session — fall through and play THIS program on superdough. Old
        // browsers get music, not silence.
        if (!zaltzBootFailed()) throw e;
        console.error("[klappn] zaltz can't boot here — superdough takes the session", e);
      }
    }
  }
  thawVisuals(); // pause froze the clock — re-arm time BEFORE the sketch runs
  try {
    await evaluate(program, true);
  } catch (e) {
    const music = stripHydraBlock(code);
    if (program === music) throw e; // not a visuals problem — bubble up
    console.error("[klappn] visuals failed to run; playing audio only", e);
    reportHydraError(e instanceof Error ? e.message : String(e)); // self-heal the @hydra block
    visualsEnabled = false;
    clearVisuals();
    await evaluate(music, true);
  }
  // The repl's evaluate just re-pointed the global time source at scheduler.now() (which hush()
  // resets to ~0 on each play/section). Re-install our CONTINUOUS odometer so the visual flows
  // across the boundary instead of snapping to a set frame. Audio timing is unaffected.
  armVisualClock();
  scheduleOrbitPrune(stripHydraBlock(program)); // reap orbits this program abandoned
}

// ALL engine assets — sample manifests, audio, soundfonts — load through OUR
// same-origin proxy (app/api/snd/[...path]/route.ts): the browser's network tab
// shows only /api/snd/* on our domain (no vendor CDN hostnames), and the proxy
// adds edge + browser caching. Manifest names are opaque on purpose; the
// upstream registry lives in the route. The set mirrors strudel.cc's prebake
// exactly (d0 = the uzu-drumkit default kit incl. sh — NOT EmuSP12, which is
// why `sd` used to sound different; d4 = prefixed drum-machine names for
// .bank(); a0 = bank aliases so .bank("tr909") resolves to RolandTR909_*).
const MAPS_BASE = "/api/snd/m";
const SAMPLE_MAPS = ["d0.json", "d1.json", "d2.json", "d3.json", "d4.json", "d5.json"];
const ALIAS_MAPS = ["a0.json"];
// GM soundfont data files (<name>.js) — proxied through the same route.
const FONTS_BASE = "/api/snd/f";

// The FULL classic sample library (218 categories: arpy, jvbass, sitar, amencutup,
// casio, …) — lib.json on the proxy, which also rewrites `_base` to a proxied,
// properly CDN-backed base (the repo manifest hardcodes a rate-limited host).
// ONE manifest fetch on load; audio is LAZY per-sample on first play (no
// 200-file stampede).
async function loadDirtSamples(w: StrudelModule): Promise<void> {
  try {
    const map = (await (await fetch(`${MAPS_BASE}/lib.json`)).json()) as Record<string, unknown>;
    const base = typeof map._base === "string" ? map._base : "";
    delete map._base;
    await w.samples(map, base);
  } catch (e) {
    console.error("[klappn] sample library load failed", e);
  }
}

// VOICE CAP — the biggest mobile audio-quality lever (2026-07-06). superdough
// steals the oldest voices once the live count exceeds maxPolyphony, but a
// buggy `parseInt(undefined) ?? 128` in setMaxPolyphony leaves it NaN after the
// engine's own init → the cap is DISABLED → unlimited polyphony. On a phone a
// dense section (layers × fast subdivisions × long reverb/release tails) then
// piles up HUNDREDS of concurrent voices, drowning the audio thread → the
// glitches. Desktop has the headroom to survive it; a phone does not. So we
// re-assert the cap on every play (it MUST run after the engine's NaN init,
// which fires on the first gesture — the play tap). PARITY WITH DESKTOP: 128,
// the engine's own DEFAULT_MAX_POLYPHONY — the same value that sounds perfect
// on desktop. A tighter MOBILE cap (48) was a REGRESSION — superdough ramps the
// oldest voices to 0 over 0.25s and stops them MID-NOTE the instant a dense
// loop exceeds the cap, chopping sustained notes + reverb/release tails: the
// "sounds horrible" the user reported. The assert is still load-bearing:
// without it the engine's buggy `parseInt(undefined) ?? 128` = NaN leaves the
// cap DISABLED (unlimited), further from the proven path than a real 128.
// Tunable live via ?poly=N for ear-testing a device that genuinely can't reach
// 128 voices.
function maxVoices(): number {
  try {
    const q = new URLSearchParams(window.location.search).get("poly");
    if (q !== null) {
      const n = Math.max(4, Math.min(256, Number(q) || 0));
      if (n) localStorage.setItem("klappnPoly", String(n));
    }
    const stored = Number(localStorage.getItem("klappnPoly"));
    if (stored >= 4) return stored;
  } catch {
    /* fall through to the default */
  }
  return 128; // desktop parity — the proven value, both platforms
}
function assertMaxPolyphony(): void {
  try {
    mod?.setMaxPolyphony?.(maxVoices());
  } catch {
    /* engine build without the setter — nothing to do */
  }
}

async function ensureStarted(): Promise<StrudelModule> {
  installConsoleGate(); // mute engine chatter in prod (capture is event-based, unaffected)
  installStrudelErrorListener(); // catch async play-time errors via Strudel's typed strudel.log event
  if (!initPromise) {
    initPromise = (async () => {
      // ONE dynamic import of a module that statically co-imports @strudel/web
      // AND @strudel/soundfonts, so @strudel/core / superdough are a single
      // instance and registerSoundfonts() registers into the SAME soundMap the
      // REPL plays from (see lib/strudel-engine.ts).
      const { web, registerSoundfonts, setSoundfontUrl } =
        await import("./strudel-engine");
      smoothDelayBus(); // clickless delay-bus moves — see the function's note
      // EVERY DEVICE gets a context with BIG output buffers before anything
      // lazily creates the default one. The default latencyHint ("interactive",
      // ~10–40ms of buffer) leaves the main thread doing synthesis + UI + React
      // no slack — any jank underruns the output, heard as CRACKLE (2026-07-14:
      // dense 8-layer songs crackled on desktop too — the underrun class isn't
      // a phone problem, it's an interactive-buffers problem). "playback"
      // trades tap-to-sound feel (~100–200ms) for glitch-free sustained audio —
      // Klappn is a listening product first; a crackle sours everything, 100ms
      // of start latency sours nothing. Created suspended — resumed on play.
      try {
        const setAc = (web as unknown as StrudelModule).setAudioContext;
        if (typeof setAc === "function") {
          mobileEngineAc = new AudioContext({ latencyHint: "playback" });
          setAc(mobileEngineAc);
        }
      } catch {
        mobileEngineAc = null; // engine falls back to its own default context
      }
      // WEBKIT BUG 279537/278512 (Safari 18.0/18.0.1): AudioWorkletProcessor constructors are
      // held by a WEAK handle, and superdough ships its worklets as one IIFE — so every processor
      // class is unreachable from JS the instant that module evaluates. A worklet-VM GC during
      // playback reaps any class with no live instance (e.g. supersaw-oscillator while a
      // crush/shape loop plays), and the next `new AudioWorkletNode(ac, 'supersaw-oscillator')`
      // null-derefs on the audio thread and hard-crashes the tab. Pin the constructors from the
      // worklet global (a GC root) — see lib/worklet-pin.ts. No-op on Chrome and on Safari ≥18.1.
      //
      // Placement is load-bearing, on BOTH sides:
      //   • AFTER the mobile setAudioContext above — getAudioContext() CREATES the context, and
      //     the phone's latencyHint:"playback" context must be installed before that happens.
      //   • BEFORE initStrudel/loadWorklets — the pin works by wrapping registerProcessor, so it
      //     must be the first addModule on the context. (Desktop already created its context at
      //     boot inside loadWorklets(), so hoisting the creation here changes nothing.)
      await pinWorkletConstructors((web as unknown as StrudelModule).getAudioContext?.());
      if (typeof window !== "undefined") initSchedAhead(); // ?sa= / stored flag → schedAheadS
      if (!mobileVisualsAllowed()) visualsEnabled = false; // phones: visuals off
      // Soundfont data files fetch from our same-origin proxy, not the vendor host.
      try {
        setSoundfontUrl(FONTS_BASE);
      } catch {
        /* fall back to the default host */
      }
      const w = web as unknown as StrudelModule;
      const repl = (await w.initStrudel({
        // MOBILE ticks on STOCK timers: mobile PAUSES on background so its main
        // thread is never throttled mid-play, and the audio-clock timer's
        // per-tick jitter was a prime suspect for phone audio "going a little
        // crazy". DESKTOP keeps playing when the window leaves the foreground,
        // where Safari clamps main-thread timers to ~1Hz and starves the
        // scheduler (Chrome exempts audible tabs, so it's a Safari-only drag) —
        // so desktop gets a background-immune audio-clock heartbeat that stays
        // dormant until the page is hidden. See bgSafeSetInterval. Kill switch:
        // ?bgtimer=0. (audioSetTimeout stays available for song-boundary timers.)
        ...(bgSchedulerImmune()
          ? { setInterval: bgSafeSetInterval, clearInterval: bgSafeClearInterval }
          : {}),
        // OPT-IN LISTENING EXPERIMENT (see initSchedAhead — off by default):
        // run the scheduler's clock ahead of the real audio clock for extra
        // seam-burst headroom. Only ever enabled per-device via ?sa=; the
        // first always-on attempt broke real-iPhone timing in a way desktop
        // verification can't hear.
        ...(mobileEngineAc && schedAheadS > 0
          ? { getTime: () => mobileEngineAc!.currentTime + schedAheadS }
          : {}),
        // runs AFTER the built-in defaultPrebake (which does registerSynthSounds)
        prebake: async () => {
          await Promise.all([
            registerSoundfonts(),
            ...SAMPLE_MAPS.map((f) => w.samples(`${MAPS_BASE}/${f}`)),
            loadDirtSamples(w),
            ...ALIAS_MAPS.map((f) => w.aliasBank?.(`${MAPS_BASE}/${f}`)),
          ]);
        },
      })) as { scheduler?: { now?: () => number } };
      // PRELOAD the AudioWorklet DSP modules onto the engine's context NOW, during
      // warm-up. superdough builds worklet nodes (shape, distort, compressor,
      // coarse/crush, ladder filter, supersaw…) with NO guard that the module is
      // loaded — and it otherwise defers loadWorklets() to the first click, async.
      // So a worklet-using loop played before addModule() resolves throws
      // "AudioWorklet does not have a valid AudioWorkletGlobalScope" on every hap.
      // Awaiting it here (addModule works on a suspended context) closes that race.
      try {
        await w.loadWorklets?.();
      } catch (e) {
        console.error("[klappn] worklet preload failed", e);
      }
      mod = w;
      // Element sink ↔ context-state lockstep (see installSinkGuard) — the
      // context exists by now whichever path created it.
      const guardAc = w.getAudioContext?.();
      if (guardAc) installSinkGuard(guardAc);
      // Keep the visuals BREATHING when the transport isn't actively playing: install our
      // visual clock now (idle drift), before any play. See visualClock/armVisualClock.
      replInstance = repl;
      // Diagnostics handle: dev-server module graphs can hold TWO instances of
      // this module (raw-URL import vs the app bundle), which makes external
      // probes read a dead parallel engine. The LIVE engine registers itself.
      // Gated like __klappn — not installed for ordinary prod visitors.
      if (debugSurfaceWanted()) {
        try {
          (globalThis as unknown as Record<string, unknown>).__klappnEngine = {
            cycle: () => schedulerCycle(),
            // Worklet-constructor pin (lib/worklet-pin.ts). Call while audio PLAYS: expect the 17
            // pinned processor names. null = not confirmed (never installed, or context idle).
            pins: () => readPinnedProcessors(audioContext()),
            cps: () =>
              (replInstance as { scheduler?: { cps?: number } } | null)?.scheduler?.cps,
            arrangement: () =>
              arrangement && {
                anchor: arrangement.anchorId,
                total: arrangement.totalCycles,
                cps: arrangement.cps,
                overrides: [...arrangement.overrides.keys()],
                heldId: arrangement.heldId,
                sig: arrangement.sig.slice(0, 80),
              },
            playing: () => ({ songActive, currentPartId, transportActive }),
            orbitGains: () => zaltzOrbitGains(),
            playhead: () => sectionPlayhead(),
            lastRebuild: () => lastRebuildProgramHead,
            poly: () => ({
              max: (mod as unknown as { maxPolyphony?: number })?.maxPolyphony,
              want: maxVoices(),
            }),
            sink: () => ({ routed: sinkRouted, el: !!bgAudioEl, anchor: !!bgAnchorEl }),
            graph: () => {
              try {
                const c = mod?.getSuperdoughAudioController?.() as
                  | { nodes?: Record<string, { reverbNode?: unknown; delayNode?: unknown }> }
                  | undefined;
                const nodes = c?.nodes ?? {};
                const orbits = Object.keys(nodes);
                let reverbs = 0;
                let delays = 0;
                for (const k of orbits) {
                  if (nodes[k]?.reverbNode) reverbs++;
                  if (nodes[k]?.delayNode) delays++;
                }
                return { orbits: orbits.length, ids: orbits, reverbs, delays };
              } catch (e) {
                return { error: String(e) };
              }
            },
            overrideCpms: () =>
              arrangement
                ? [...arrangement.overrides.entries()].map(([k, v]) => [
                    k.slice(-6),
                    (v.match(/setcpm\([^)]*\)/) || ["none"])[0],
                  ])
                : null,
            freshDecorateCpm: () => {
              const a = arrangement;
              if (!a || !songOpts.decorate) return null;
              const s = a.baseList[0];
              return songOpts.decorate(s.code, s.id).match(/setcpm\([^)]*\)/g) ?? "none";
            },
            controller: () => mod?.getSuperdoughAudioController?.(),
            play: (code: string) => playPart("probe", code),
            // context-identity forensics: every one of these must be === true
            // on phones, or voices throw "different audio context" at connect.
            ctx: () => ({
              engineIsOurs: !mobileEngineAc || audioContext() === mobileEngineAc,
              controllerCtxIsEngine:
                (mod?.getSuperdoughAudioController?.() as { audioContext?: unknown } | undefined)
                  ?.audioContext === audioContext(),
            }),
          };
        } catch {
          /* diagnostics only */
        }
      }
      armVisualClock();
      return w;
    })();
  }
  return initPromise;
}

/**
 * Warm the engine ahead of the first play: loads ALL sample maps + soundfonts
 * and creates the (suspended) AudioContext, so clicking Play doesn't stall on a
 * multi-second download. Idempotent — safe to call on mount and on first gesture.
 */
export async function warmEngine(): Promise<void> {
  graceVisualYield(); // module warm-up on nav can stall — transient, not jank
  try {
    await ensureStarted();
  } catch {
    /* ignore — playback will retry */
  }
}

const SYNTH_SOUNDS = new Set(
  "sine sawtooth saw square sqr triangle tri isaw supersaw pulse white pink brown crackle".split(
    " ",
  ),
);

/**
 * PRELOAD the actual audio buffers a set of loops uses, so every sound is in
 * memory before playback (no "first hit is silent while it downloads"). Best
 * effort: synths and gm_/wt_ soundfonts need no sample buffer and are skipped;
 * any fetch that fails is ignored (the lazy path still works at play time).
 */
export async function preloadSamples(codes: string[]): Promise<void> {
  let web: StrudelModule;
  try {
    web = await ensureStarted();
  } catch {
    return;
  }
  const getBuf = web.getSampleBuffer;
  if (typeof getBuf !== "function") return;

  // THUNKS, not started promises — so loading can be PACED. Firing every
  // fetch+decode at once stutters Safari (memory spikes, audio-thread
  // contention); tiny batches get everything warm before the first Play
  // without ever overwhelming the browser.
  const jobs: (() => Promise<unknown>)[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    if (!code) continue;
    // Every instrument-swap OPTION too (the @swaps JSON block) — they're not in
    // the music yet, but one tap away; an unwarmed pick limps for two beats.
    const swapsM = code.match(/\/\*\s*@swaps\s*([\s\S]*?)\*\//);
    if (swapsM) {
      try {
        const arr = JSON.parse(swapsM[1]) as { options?: { s?: string }[] }[];
        for (const sw of arr) {
          for (const o of sw.options ?? []) {
            const tok = (o.s || "").trim();
            if (!tok || SYNTH_SOUNDS.has(tok) || seen.has(`|${tok}`)) continue;
            seen.add(`|${tok}`);
            if (/^(gm_|wt_)/.test(tok)) {
              jobs.push(() => warmGmFont(tok).catch(() => {}));
            } else {
              jobs.push(() => Promise.resolve(getBuf({ s: tok, n: 0 }, undefined)).catch(() => {}));
            }
          }
        }
      } catch {
        /* malformed swaps block — playback never depends on this */
      }
    }
    for (const layer of code.split(/\$:/)) {
      const bankM = layer.match(/\.bank\s*\(\s*['"`]([^'"`]+)['"`]/);
      const bank = bankM ? bankM[1].trim().split(/\s+/)[0] : undefined;
      const soundRe = /\bs(?:ound)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let m: RegExpExecArray | null;
      while ((m = soundRe.exec(layer))) {
        const cleaned = m[1]
          .replace(/[[\]<>{}(),~]/g, " ")
          .replace(/[*/:!@%][0-9.]+/g, " ");
        for (const tok of cleaned.split(/\s+/).filter(Boolean)) {
          if (/^[0-9.]+$/.test(tok) || /^z_/.test(tok) || SYNTH_SOUNDS.has(tok))
            continue;
          const k = `${bank || ""}|${tok}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (/^gm_/.test(tok) || /^wt_/.test(tok)) {
            // gm_*/wt_* are soundfonts (no sample buffer) — warm the font so
            // the first Play doesn't fetch+parse it on the click.
            jobs.push(() => warmGmFont(tok).catch(() => {}));
            continue;
          }
          jobs.push(() =>
            Promise.resolve(getBuf({ s: tok, n: 0 }, bank)).catch(() => {}),
          );
        }
      }
    }
  }
  // Gentle batches of 5 — everything is ready before you reach for Play,
  // nothing arrives as a stampede.
  for (let i = 0; i < jobs.length; i += 5) {
    await Promise.allSettled(jobs.slice(i, i + 5).map((j) => j()));
  }
}

/**
 * Warm specific sounds by name (an instrument SWAP target, say) so they can be
 * played the instant they're asked for. Swapping to an unloaded gm_* soundfont
 * mid-playback makes the layer drop/limp for a couple of beats while the font
 * fetches+parses — heard as the GROOVE lurching ("the tempo changed"). Warm
 * first, then swap. Best-effort and idempotent.
 */
export async function warmSounds(tokens: string[]): Promise<void> {
  let web: StrudelModule;
  try {
    web = await ensureStarted();
  } catch {
    return;
  }
  await Promise.allSettled(
    tokens
      .filter((t) => t && !SYNTH_SOUNDS.has(t))
      .map((tok) =>
        /^(gm_|wt_)/.test(tok)
          ? warmGmFont(tok).catch(() => {})
          : Promise.resolve(web.getSampleBuffer?.({ s: tok, n: 0 }, undefined)).catch(
              () => {},
            ),
      ),
  );
}

/**
 * Hot-swap the running pattern with new code WITHOUT stopping — Strudel swaps at
 * the next cycle boundary, so a tweak is heard live. No-op if nothing's playing.
 *
 * COALESCED, latest-wins: a fast slider drag fires many updates; queueing every
 * evaluate would put the newest gesture seconds behind the audio (the "delayed
 * kill" bug on the live deck). While one evaluate runs, later codes overwrite a
 * single pending slot — so at most one evaluate separates a gesture from air.
 */
let liveEvalBusy = false;
let liveEvalPending: string | null = null;
export async function liveUpdate(code: string, _layer?: number): Promise<void> {
  if (!code.trim()) return;
  if (!mod) return;
  // ARRANGEMENT MODE: callers hand us the CURRENT section's tweaked code (a
  // deck dial, a layer swap). Evaluating it bare would replace the whole song
  // with one loop — instead the tweak becomes an override and the full
  // arrangement re-evaluates in place (no hush → the phase carries through).
  if (songActive && arrangement && currentPartId) {
    arrangement.overrides.set(currentPartId, code);
    void rebuildArrangement(arrangement);
    return;
  }
  if (liveEvalBusy) {
    liveEvalPending = code; // latest wins — intermediate states are disposable
    return;
  }
  liveEvalBusy = true;
  const evaluate = mod.evaluate;
  try {
    let next: string | null = code;
    while (next) {
      const c: string = next;
      next = null;
      try {
        await evalProgram((cc, a) => evaluate(cc, a), c);
      } catch {
        /* a transient bad intermediate edit — ignore, the next change recovers */
      }
      next = liveEvalPending;
      liveEvalPending = null;
    }
  } finally {
    liveEvalBusy = false;
  }
}

/**
 * SEEK the audio scheduler to an absolute cycle position — how a listener
 * joining a live set lands IN PHASE with the DJ instead of at bar 1. Patterns
 * are cyclic, so any position ≥ 0 is valid. Call right after an evaluate
 * (which starts at cycle 0). Best-effort: without setCycle we play from the
 * downbeat as before.
 */
/**
 * BACKGROUND PLAYBACK — keep the music alive when the phone's screen goes off.
 *
 * A bare Web Audio graph is not "media" to the OS: lock the screen and iOS and
 * Android suspend the page (timers throttle, the sequencer stalls, sound dies).
 * The fix is to BE a media player: reroute the engine's output through a
 * MediaStream into a real <audio> element and register Media Session metadata.
 * The OS then treats the tab as playing audio — background execution stays on,
 * every platform, and the lock screen shows the set with play/pause.
 *
 * PHONES ONLY. On desktop the Web Audio graph already survives background tabs,
 * and the element sink is a LIABILITY there: an <audio> playing a MediaStream
 * does NOT reliably resample when the output device's rate differs from the
 * engine's context (switching to Bluetooth/an interface, 44.1k vs 48k) — the
 * whole mix then plays uniformly SLOWER and PITCHED DOWN (~a semitone and a
 * half at 44.1/48), heard as "the song is slower and in a lower key". Desktop
 * keeps the direct ac.destination route; MediaSession metadata is still set.
 *
 * The reroute taps POST-limiter (outputTap) so the brickwall stays in the path;
 * disableBackgroundPlayback() restores the direct route — a SONG session never
 * rides the set's element sink (see lib/now-playing.ts).
 *
 * Idempotent; call from a USER GESTURE (the element's play() needs one).
 * Best-effort: on any failure the normal ac.destination route keeps working.
 */
let bgAudioEl: HTMLAudioElement | null = null;
let bgStreamDest: MediaStreamAudioDestinationNode | null = null;
// THE SESSION ANCHOR (2026-07-05): a MediaStream-fed element does NOT hold the
// phone's "playback" audio session — the OS files it under live-stream media,
// so hiding the page still interrupts the Web Audio context (heard first as
// the machine-gun, then, once the sink mirrored the suspend, as silence).
// A silent LOOPING FILE is real media playback: it anchors the session so the
// OS keeps the tab — and the context — rendering with the screen off. The
// classic web-audio-in-background hack (à la unmute.js), phones only.
let bgAnchorEl: HTMLAudioElement | null = null;
let bgAnchorUrl: string | null = null;
// FOREGROUND PLAYS DIRECT (2026-07-06): the MediaStream-fed sink element on
// WebKit buffers on its own clock and randomly UNDERRUNS mid-play — the set
// went silent for stretches while the engine kept rendering into a stalled
// element (songs never route through it: that asymmetry was the tell). The
// element is a SCREEN-OFF tool, so the mix flows into it ONLY while the page
// is hidden; visible playback takes the same direct path as the song page.
let sinkRouted = false; // true = mix → element sink (page hidden)
let sinkRouterInstalled = false;

function sinkForced(): boolean {
  try {
    return localStorage.getItem("klappnForceSink") === "1"; // A/B: pin old route
  } catch {
    return false;
  }
}

/** Point the mix at the element sink (hidden) or the direct route (visible).
 *  Connect the new edge BEFORE dropping the old — a few ms of doubled routing
 *  at a visibility flip beats a dropout. Idempotent (Web Audio collapses
 *  duplicate connects). */
function routeSink(toElement: boolean): void {
  const ac = audioContext();
  const tap = finalTap();
  if (!ac || !tap || !bgStreamDest) return;
  try {
    if (toElement) {
      tap.connect(bgStreamDest);
      try {
        tap.disconnect(ac.destination);
      } catch {
        /* already off the direct route */
      }
    } else {
      tap.connect(ac.destination);
      try {
        tap.disconnect(bgStreamDest);
      } catch {
        /* already off the element route */
      }
    }
    sinkRouted = toElement;
  } catch {
    /* best-effort — some sound beats none */
  }
}

function installSinkRouter(_ac: AudioContext): void {
  if (sinkRouterInstalled || typeof document === "undefined") return;
  sinkRouterInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (!bgAudioEl) return; // background playback torn down
    routeSink(document.visibilityState === "hidden" || sinkForced());
  });
}
/** One second of silent 16-bit mono WAV, built in memory (no asset, no fetch). */
function silentWavUrl(): string {
  const rate = 8000;
  const n = rate; // 1s — ultra-short loops glitch on some platforms
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true); // sample bytes stay zero = silence
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Phone/tablet detection — the surfaces whose screens lock playback away.
 *  iPadOS masquerades as a Mac, hence the touch-points check. */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    // debugging hook (klappnDebug family): force the phone audio path on any
    // device — big buffers, audio-clock timers, shifted scheduler clock.
    if (localStorage.getItem("klappnForceMobile") === "1") return true;
  } catch {
    /* storage may be unavailable */
  }
  const uaMobile = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData?.mobile;
  if (uaMobile === true) return true;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// A cold first play can spend its gesture on engine boot before the sink
// elements call play() — autoplay policy then rejects them, and a phone would
// lose background playback until the next playSong (the door has only one).
// Borrow the very next tap ANYWHERE to start whatever didn't.
let sinkRetryArmed = false;
function armSinkGestureRetry(): void {
  if (sinkRetryArmed || typeof document === "undefined") return;
  sinkRetryArmed = true;
  const retry = () => {
    sinkRetryArmed = false;
    for (const el of [bgAudioEl, bgAnchorEl]) {
      if (el && el.paused) void el.play().catch(() => armSinkGestureRetry());
    }
  };
  document.addEventListener("pointerdown", retry, { once: true, capture: true });
}

export async function enableBackgroundPlayback(_meta?: {
  title?: string;
  artist?: string;
}): Promise<void> {
  try {
    await ensureStarted();
    // The master chain can land moments after boot on a cold start — wait for
    // it instead of silently giving up (a phone without the sink loses
    // background playback entirely).
    let master = masterNode();
    let ac = audioContext();
    for (let i = 0; i < 12 && (!master || !ac); i++) {
      await new Promise((r) => setTimeout(r, 500));
      master = masterNode();
      ac = audioContext();
    }
    if (!master || !ac) return;
    if (isMobileDevice() && !bgAudioEl) {
      const dest = ac.createMediaStreamDestination();
      bgStreamDest = dest;
      const el = document.createElement("audio");
      el.srcObject = dest.stream;
      el.setAttribute("playsinline", "");
      el.style.display = "none";
      document.body.appendChild(el);
      bgAudioEl = el;
      try {
        await el.play(); // start INSIDE the gesture…
      } catch {
        armSinkGestureRetry(); // …or borrow the NEXT tap (cold first play)
      }
      // FOREGROUND PLAYS DIRECT (2026-07-06): a MediaStream-fed element on
      // WebKit buffers on its own clock and randomly UNDERRUNS mid-play —
      // heard as the set going silent for stretches while the engine plays
      // on (songs never route through it, which is why only "live" starved).
      // The element is a SCREEN-OFF tool: route the mix into it only while
      // the page is hidden; visible playback takes the same direct path as
      // the song page. localStorage klappnForceSink="1" pins the old
      // always-element route for A/B listening.
      installSinkRouter(ac);
      routeSink(
        document.visibilityState === "hidden" || sinkForced(), // initial route
      );
    }
    if (isMobileDevice() && !bgAnchorEl) {
      // The session anchor (see silentWavUrl) — must start INSIDE this same
      // gesture. Never muted: a muted element doesn't hold the session.
      const anchor = document.createElement("audio");
      bgAnchorUrl = silentWavUrl();
      anchor.src = bgAnchorUrl;
      anchor.loop = true;
      anchor.setAttribute("playsinline", "");
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      bgAnchorEl = anchor;
      try {
        await anchor.play();
      } catch {
        armSinkGestureRetry();
      }
    }
    // MediaSession metadata + the nice lock-screen card are owned centrally now:
    // now-playing.ts (songs/sets) and LiveListenClient (the stream) call
    // lib/media-session. This function just holds the background AUDIO session.
  } catch {
    /* best-effort: the direct audio route still works */
  }
}

/**
 * Tear the background <audio> sink down and restore the DIRECT output route.
 * Called when a SONG session takes over and on the dock's ✕ — the element is a
 * set-performance tool (screen-off survival), and leaving every later play
 * routed through it exposes media-element resample bugs (the whole mix slower
 * and pitched down after an output-device change). Idempotent, best-effort.
 */
export function disableBackgroundPlayback(): void {
  try {
    if (!bgAudioEl && !bgStreamDest) return;
    const ac = audioContext();
    const tap = finalTap();
    if (tap && bgStreamDest) {
      try {
        tap.disconnect(bgStreamDest);
      } catch {
        /* edge already gone */
      }
    }
    // Duplicate connect()s to the same destination are collapsed by Web Audio,
    // so this is safe even if the direct edge somehow survived.
    if (tap && ac) tap.connect(ac.destination);
    if (bgAudioEl) {
      bgAudioEl.pause();
      bgAudioEl.srcObject = null;
      bgAudioEl.remove();
    }
    if (bgAnchorEl) {
      bgAnchorEl.pause();
      bgAnchorEl.remove();
    }
    if (bgAnchorUrl) URL.revokeObjectURL(bgAnchorUrl);
  } catch {
    /* best-effort — never break playback over routing hygiene */
  } finally {
    bgAudioEl = null;
    bgStreamDest = null;
    bgAnchorEl = null;
    bgAnchorUrl = null;
    sinkRouted = false;
  }
}

/**
 * Unlock audio INSIDE a user gesture. A page that starts playback from a poll
 * loop (the live listener) never has a gesture on the call stack when
 * playPart runs — the AudioContext (created suspended during warm-up) stays
 * suspended, the scheduler's deadlines never advance, and every query logs
 * "skip query: too late": running clock, total silence. Call this from the
 * join click; afterwards the context is running for good.
 */
export async function unlockAudio(): Promise<void> {
  try {
    kickResumeInGesture(); // spend the tap on an already-warm context before any await
    await ensureStarted();
    await resumeAudio();
  } catch {
    /* best-effort — playPart will retry the resume */
  }
}

/** The AUDIO scheduler's current cycle position (not the visual odometer —
 *  armVisualClock re-points getTime). For phase-sync diagnostics.
 *
 *  NB: scheduler.setCycle() was tried for listener phase-seek and REJECTED —
 *  on the worker-clock scheduler it desynchronizes now()'s cps math (the clock
 *  raced ~10× and no hap ever fired: total silence). Listener sync instead
 *  BAR-ALIGNS the evaluate start (see LiveListenClient) — no scheduler surgery. */
export function schedulerCycleNow(): number {
  return schedulerCycle();
}

/**
 * Ramp the MASTER gain to `target` over `seconds` — the live deck's smooth
 * NEXT (fade down, jump, and the fresh start's swallowTails brings it back).
 * Best-effort; never breaks playback.
 */
export function fadeMaster(target: number, seconds: number): void {
  try {
    const g = mod?.getSuperdoughAudioController?.()?.output?.destinationGain as
      | GainNode
      | undefined;
    const ac = audioContext();
    if (!g?.gain || !ac) return;
    const now = ac.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + seconds);
  } catch {
    /* smoothing is best-effort */
  }
}

/**
 * INSTANT per-orbit gain — the live deck's channel kills. Sets each orbit bus's
 * output gain directly on the Web Audio graph (25ms ramp: click-free but
 * immediate), so a kill silences even already-sounding notes and tails — and
 * releasing it brings the still-running music back mid-note, like a mixer's
 * kill EQ. `gainFor` returns the target gain for an orbit number, or undefined
 * to leave that orbit alone (e.g. the song page's own buses). Best-effort.
 */
export function applyOrbitGains(gainFor: (orbit: number) => number | undefined): void {
  try {
    if (zaltzActive()) zaltzApplyOrbitGains(gainFor); // engine-side kills
    const ctl = mod?.getSuperdoughAudioController?.() as
      | { nodes?: Record<string, { output?: GainNode }> }
      | undefined;
    const ac = audioContext();
    if (!ctl?.nodes || !ac) return;
    // for..in, not Object.entries: SetClient's kill-enforcement calls this
    // 5×/s for a whole set, and a fresh [key, value] pair array per tick is
    // steady GC food on the same main thread the scheduler ticks on. (The
    // already-at-target skip below keeps the steady state near-free.)
    const nodes = ctl.nodes;
    for (const num in nodes) {
      const target = gainFor(Number(num));
      const gain = nodes[num]?.output?.gain;
      if (target === undefined || !gain) continue;
      if (Math.abs(gain.value - target) < 0.001) continue; // already there — don't fight ramps
      const now = ac.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(target, now + 0.025);
    }
  } catch {
    /* live-gain is best-effort — never break playback over it */
  }
}

/** Swallow the PREVIOUS loop's lingering audio — the lookahead's already-scheduled
 *  haps + reverb/delay tails — on a FRESH start, so a new loop never begins with
 *  sounds bleeding over from the last one. hush()/stop() halt the scheduler but can't
 *  un-schedule audio already queued on the context, and stop()'s suspend merely
 *  FREEZES ringing reverb/delay tails — the new play's resumeAudio() thaws them
 *  right back (the "old song keeps playing under the new one" bug). So the master
 *  is cut to ~0 and HELD there until the new program is actually evaluated;
 *  releaseTails() then fades it up just ahead of the incoming downbeat (the
 *  scheduler's ~200ms lookahead means the first hap sounds after the fade tops
 *  out). A safety ramp restores the master even if the release is never reached
 *  (eval throw), so playback can't be stranded silent. Best-effort. */
function masterGainNode(): GainNode | undefined {
  return mod?.getSuperdoughAudioController?.()?.output?.destinationGain as
    | GainNode
    | undefined;
}
function transportTrace(what: string): void {
  if (!debugConsoleWanted()) return;
  try {
    const ac = audioContext();
    console.log(`[klappn/transport] ${what} @${ac ? ac.currentTime.toFixed(2) : "?"}s`);
  } catch {
    /* trace only */
  }
}
function swallowTails(): void {
  transportTrace("swallowTails");
  try {
    const g = masterGainNode();
    const ac = audioContext();
    if (g?.gain && ac) {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      if (ac.state === "suspended") {
        // PAUSED context: nothing renders across the change, so a hard step
        // is inaudible by construction. A RAMP here is the bug — it renders
        // AFTER resume, spreading 12ms of the old loop's frozen tail into
        // the new play's first quanta (the diag's −19dB window-0 blip: "it
        // glitches for a millisecond and then plays").
        g.gain.setValueAtTime(0.0001, now);
      } else {
        // RUNNING audio: 12ms ramp, not a step — an instant cut
        // mid-waveform IS a click (Δ0.6 clusters at every cut edge).
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
        g.gain.linearRampToValueAtTime(0.0001, now + 0.012);
      }
      // Safety net only — the real restore is releaseTails() at eval time.
      g.gain.setValueAtTime(0.0001, now + 1.6);
      g.gain.exponentialRampToValueAtTime(1, now + 1.9);
    }
  } catch {
    /* tail-swallow is best-effort — never break playback over it */
  }
}
/** HARD-KILL the previous program's ringing energy at a TAKEOVER (new loop,
 *  new song, or voice solo starting over whatever played before).
 *
 *  swallowTails() only mutes the MASTER — the energy keeps circulating behind
 *  it: a convolver rings for its whole IR (3–8s pads) and a feedback delay
 *  recirculates indefinitely, so when releaseTails() restores the master at
 *  eval (~0.3–0.8s later) the leftover tail is still there, audible under the
 *  new audio. This drops the energy itself: every orbit bus (superdough's
 *  per-orbit output + summing + reverb convolver + feedback delay + djf) is
 *  disconnected from the graph and DELETED from the controller's node map, so
 *  the tails' storage is orphaned — silent immediately, GC'd after. superdough
 *  recreates an orbit lazily on the next hap that needs it
 *  (SuperdoughAudioController.getOrbit: `nodes[orbitNum] == null` → new Orbit +
 *  connectToDestination), so the NEW program plays through fresh, silent buses.
 *
 *  Deliberately untouched: the master output (destinationGain / channelMerger)
 *  — the limiter splice (installLimiter), the deck's perf-FX chain, the WAV
 *  export tap and the background <audio> sink all hang off it; and the vocal
 *  layer's chain, which feeds the sink directly (not an orbit). Known small
 *  leak: connectToDestination's per-orbit StereoPanner+splitter pair stays on
 *  the channelMerger (superdough keeps no handle to it) — a couple of silent,
 *  input-less nodes per takeover, negligible.
 *
 *  NOT for mid-song section boundaries (tails ringing across a seam is the
 *  transition) or plain stop (suspend already freezes everything). Safe on a
 *  suspended context — that's the best moment: frozen tails are dropped before
 *  resume can thaw them. Best-effort, never breaks playback. */
export function hardKillTails(): void {
  transportTrace("hardKillTails");
  try {
    const ctl = mod?.getSuperdoughAudioController?.() as
      | {
          nodes?: Record<
            string,
            { disconnect?: () => void; djfNode?: { disconnect?: () => void } | null }
          >;
        }
      | undefined;
    const nodes = ctl?.nodes;
    if (!nodes) return;
    for (const num in nodes) {
      const orbit = nodes[num];
      try {
        orbit?.disconnect?.(); // output + summing + reverb + delay off the graph
      } catch {
        /* already detached */
      }
      try {
        orbit?.djfNode?.disconnect?.(); // Orbit.disconnect() misses the djf worklet
      } catch {
        /* none/already */
      }
      delete nodes[num]; // getOrbit() rebuilds fresh on the next hap
    }
  } catch {
    /* tail-kill is best-effort — never break playback over it */
  }
}

/** The new program is compiled and scheduling — bring the master back NOW (the
 *  old tails have been strangled for the whole init window). Idempotent: on a
 *  mid-song section boundary the master is already at 1 and this is a no-op. */
function releaseTails(): void {
  transportTrace("releaseTails");
  try {
    const g = masterGainNode();
    const ac = audioContext();
    if (g?.gain && ac) {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.exponentialRampToValueAtTime(1, now + 0.14);
    }
  } catch {
    /* best-effort */
  }
}

// --- engine bridge ----------------------------------------------------------
// Narrow accessors onto the engine's ONE AudioContext + its output sink, so
// sibling features (the voice studio) can hang their own graph off the same
// context (never a second one — cross-context nodes throw and background
// playback breaks).
export function getEngineAudioContext(): AudioContext | null {
  return audioContext();
}
/** Boot the engine — module, AudioContext, master graph — WITHOUT playing
 *  anything, and unlock the context inside the caller's gesture. For siblings
 *  that must hang capture off the engine's context BEFORE the music starts:
 *  the voice studio's recorder needs the context and the broadcast tap to
 *  exist when the mic opens, or the take records with no echo-cancel
 *  reference (the silent-fallback that printed the whole song into a take). */
export async function ensureEngineStarted(): Promise<void> {
  kickResumeInGesture(); // spend the tap synchronously — before any await
  await ensureStarted();
  await resumeAudio();
}
export function serverLoopSink(ac: AudioContext): AudioNode {
  return outputSink(ac);
}
export { isMobileDevice };


/** Evaluate and start one part's pattern (it loops — expected).
 *  `owner` identifies whose music this is (song/set/page id) — a live session
 *  with the SAME owner hands over by crossfade; anything else is cut. */
export async function playPart(partId: string, code: string, owner?: string): Promise<void> {
  stopSong(); // a single part takes over from any running song
  transportActive = true; // visuals lock to the music while it plays
  armPlayDiagnostic("playPart"); // klappnDebug only — records the first 4s
  // A LIVE zaltz session of the SAME owner hands over by CROSSFADE: the
  // old music retires (1.2s engine fade, tails ringing) under the new
  // downbeat — no cut, no silence hole, no cold reverb. A different owner's
  // music is CUT at the tap (see programOwner); the cut/hush machinery below
  // also covers the superdough path and dead-session starts.
  const sdTakeover =
    isZaltz() && zaltzActive() && owner != null && owner === programOwner;
  programOwner = owner ?? null;
  installLimiter(); // never let the mix hard-clip
  if (!sdTakeover) {
    // CUT BEFORE ANY THAW: a paused context holds the OLD sound frozen in it,
    // and kickResumeInGesture() below resumes SYNCHRONOUSLY in the tap — the
    // master must already be at ~0 before that call. Gain writes on a
    // suspended context apply the instant it wakes.
    swallowTails(); // master to ~0 first, so the kill below can't click
    hardKillTails(); // then DROP the previous loop's reverb/delay energy for real
  }
  kickResumeInGesture(); // unlock BEFORE the awaits below spend the tap's activation (iOS)
  const web = await ensureStarted();
  await resumeAudio(); // in case a previous stop() suspended the context
  assertMaxPolyphony(); // cap voices AFTER the engine's NaN init (see the note)
  // Reset the scheduler to cycle 0 so the loop starts at its DOWNBEAT (bar 1) —
  // via hush on the repl path, via the takeover re-anchor on zaltz.
  try {
    web.hush();
    if (sdTakeover) zaltzTakeoverNext = true;
    else if (zaltzActive()) zaltzHush();
  } catch {
    /* ignore — worst case it starts mid-cycle as before */
  }
  currentPartId = partId; // set BEFORE eval so a build error attributes to the right loop
  try {
    await evalProgram((c, a) => web.evaluate(c, a), code);
  } catch (e) {
    // A synchronous build/eval error (bad method, syntax) — report it for auto-repair, then rethrow
    // so the caller's own error UI still runs.
    reportStrudelError(e instanceof Error ? e.message : String(e), partId);
    throw e;
  } finally {
    releaseTails(); // the new loop is scheduling — un-strangle the master
  }
}

export interface SongSection {
  id: string;
  code: string;
  /** How long this section plays before moving on (seconds). */
  seconds: number;
  /** Optional HAND-OFF: a variant of `code` played for the FINAL `seconds` of
   *  this section (e.g. a one-bar filter-down), so the next section lands as a
   *  transition, not a hard cut. Best-effort — if it fails to evaluate the
   *  section simply plays to the end as before. */
  outro?: { code: string; seconds: number };
  /** The model-authored arrangement for this section (plan.arrangement) —
   *  layer entries/exits, sweeps, overlays, an unfolded length. Rendered by
   *  lib/arrange; absent = the whole loop plays for the whole span. */
  arr?: SectionArrange | null;
}

/**
 * Play the WHOLE song: each part's program in order, one section at a time,
 * looping back to the start. Strudel hot-swaps the running program at the next
 * cycle boundary when we re-`evaluate()`, so sections transition on the beat.
 *
 * Parts are standalone programs (each sets its own tempo + stacks its layers
 * via `$:`), so we can't fold them into a single `arrange(...)` expression
 * reliably — we sequence them on a timer instead. `secondsPerSection` controls
 * how long each section plays; derive it from the song's bpm for musical
 * lengths. `onSection` fires as each section starts so the UI can highlight it.
 */
export interface SongPlayOpts {
  /** Whose music this is (song/set id). A live session keeps its crossfade
   *  hand-over only when the NEXT play carries the SAME owner; a different
   *  (or missing) owner cuts the old sound at the tap instead of letting it
   *  spill under the new downbeat. */
  owner?: string;
  onSection?: (id: string | null) => void;
  /** Applied to each section's code at the moment it starts (receives the
   *  section id) — lets the caller substitute FRESH code and live dial
   *  values, so tweaks made mid-mix carry into every later section instead
   *  of replaying the stale code captured when play began. */
  decorate?: (code: string, id: string) => string;
  /** PURE LEVEL, polled at any frequency (the arrangement watcher reads it
   *  ~5×/s): true while the section must HOLD (∞ latch, deck LOOP mode, a
   *  still-generating loop). NEVER count calls in here — finite repeat COUNTS
   *  belong in repeatsFor, where they bake into the pattern itself. */
  holdSection?: (id: string) => boolean;
  /** FINITE repeat count for a section (a saved 2×/4×/8× latch). Baked into
   *  the arrangement as extra cycles — the repeats are pattern math, no
   *  re-eval, and every follower derives the same timeline. Return 1 (or
   *  undefined, or Infinity — use holdSection for ∞) for a single pass. */
  repeatsFor?: (id: string) => number | undefined;
  /** LIVE section length (seconds), re-read at each pass. Lets a still-GENERATING
   *  loop grow: return a large value while its layers stream so the timer never
   *  cuts it short, then the real length once it settles. Falls back to the
   *  baked section.seconds when undefined. */
  secondsFor?: (id: string) => number | undefined;
  /** LIVE ordered section list, re-read at every section boundary. Lets the STRUCTURE
   *  change mid-play (a break added/removed/re-rolled) without restarting the transport:
   *  step() advances to the section AFTER the one that just played in this list. Falls
   *  back to the fixed `sections` arg when absent. */
  sectionsFor?: () => SongSection[];
  /** How the song ENDS (plan.arrangement.ending). Mode "stop": the mix plays
   *  through the LIST'S end (no wrap past it), the optional final one-shot
   *  rings out, and the transport stops itself. Absent/"loop" = the classic
   *  forever-wrap. */
  ending?: SongEnding | null;
  /** SONG-LEVEL effects (chapters era, plan.effects) — read LIVE at every
   *  rebuild so knob rides land on the next pass. Glides anchored to part
   *  ranges; buildArrangement wraps every covered entry. */
  effectsFor?: () => SongFx[] | null | undefined;
  /** BREAK OVERLAYS riding loop ranges (plan.overlays) — deterministic drum
   *  lines stacked over the arrangement, same live-read contract as effects. */
  overlaysFor?: () => import("./breaks-catalog").BreakOverlay[] | null | undefined;
  /** Fired ONCE when an ending-stop mix reaches its end and the engine stops
   *  itself — the UI's cue to publish the stopped state (the engine never
   *  touches the now-playing store). */
  onEnded?: () => void;
  /** The caller has ALREADY bussed every layer deliberately (the door's
   *  per-layer kill gates). The arrange build keeps those orbits instead of
   *  re-busing the whole song by signature — see buildArrangement. */
  keepOrbits?: boolean;
}

// The RUNNING mix's callbacks, module-scoped so a page that navigates away and
// comes BACK can rebind them to its fresh instance (rebindSong) — the sequencer
// itself never stops; only who's answering its questions changes.
let songOpts: SongPlayOpts = {};

/** Swap the running mix's callbacks for a new set — the ADOPTION handshake: a
 *  remounted page hands in closures over its own live refs, and every later
 *  section boundary consults the new owner. No-op when nothing is playing. */
export function rebindSong(opts: SongPlayOpts): void {
  if (songActive) songOpts = opts;
}

/** Ask the running arrangement to rebuild NOW (coalesced, no hush) — the
 *  seamless in-place swap. The door uses it to land a live KEY change through
 *  `decorate` without restarting the transport (the restart was an audible
 *  break). No-op on the stepper or when nothing is playing. */
export function requestSongRebuild(): void {
  if (arrangement && songActive) requestRebuild(arrangement);
}

/** The section (part / break:<id>) the engine is sounding right now. */
export function currentSectionId(): string | null {
  return currentPartId;
}

/** Where the playhead is inside the sounding section — its id, the current bar
 *  (float, 0-based) and the section's span in bars. Null when not playing an
 *  arrangement. The unfold lanes read this each frame to draw a live playhead;
 *  it's pure math off the scheduler clock (never in the audio path). 1 cycle =
 *  1 bar, and a section is one span, so bar = pos − span.start. */
export function sectionPlayhead(): { id: string; bar: number; bars: number } | null {
  const a = arrangement;
  if (!a || !songActive || !transportActive) return null;
  const pos = contentPos(a); // seek-shift aware
  const span = spanAtCycle(a.spans, a.totalCycles, pos);
  if (!span) return null;
  return { id: span.id, bar: Math.max(0, pos - span.start), bars: span.end - span.start };
}

/** Nudge the playing arrangement to re-read its live specs NOW — the unfold
 *  editor calls this after an optimistic spec write (a painted lane, a sweep
 *  slider, a length swap) so the change is HEARD immediately instead of on
 *  the watcher's next slow tick. No-op when nothing arranged is playing. */
export function refreshArrangement(): void {
  const a = arrangement;
  if (!a || !songActive) return;
  requestRebuild(a);
}

/** SEEK: put the playhead at `bar` (0-based) of section `sectionId` — works
 *  for ANY span of the playing arrangement, so tapping bar 9 of another loop
 *  jumps the song there. The scheduler clock is never touched: the program is
 *  re-evaluated with a whole-cycle `.late(shift)` so the CONTENT rotates under
 *  the running clock — beat-grid preserved (integer shift), no hush, no gap.
 *  Returns false when nothing arranged is playing (stepper or idle). */
export function seekSectionBar(sectionId: string, bar: number): boolean {
  const a = arrangement;
  if (!a || !songActive || !transportActive) return false;
  const span = a.spans.find((s) => s.id === sectionId);
  if (!span) return false;
  const raw = schedulerCycle();
  if (raw <= 0) return false; // still settling a fresh evaluate
  const cur = contentPos(a);
  const target = Math.min(
    span.end - 1,
    span.start + Math.max(0, Math.floor(bar)),
  );
  const delta = Math.round(cur - target);
  if (delta === 0) return true;
  a.shift = (a.shift ?? 0) + delta;
  requestRebuild(a);
  return true;
}

export async function playSong(
  sections: SongSection[],
  opts: SongPlayOpts = {},
): Promise<void> {
  graceVisualYield(4000); // build + first compile stalls are transient, not jank
  const ready = sections.filter((s) => s.code && s.code.trim());
  // A LIVE zaltz session of the SAME owner hands over by CROSSFADE (old
  // music retires under the new downbeat) — keep it alive through the
  // teardown. A different owner's music is CUT at the tap (see programOwner);
  // the cut/hush machinery also covers superdough and dead-session starts.
  const sdTakeover =
    isZaltz() && zaltzActive() && opts.owner != null && opts.owner === programOwner;
  programOwner = opts.owner ?? null;
  if (sdTakeover) stopSong();
  else stop();
  if (ready.length === 0) return;
  songOpts = opts;
  songActive = true;
  const myRun = ++songRunId; // this call's identity — see songRunId
  transportActive = true; // visuals lock to the music while it plays (set AFTER stop() above)
  armPlayDiagnostic("playSong"); // klappnDebug only — records the first 4s
  installLimiter();
  if (!sdTakeover) {
    // TAKEOVER from a dead/superdough session: kill the frozen tails while
    // suspended, master to ~0 BEFORE the in-gesture resume below.
    hardKillTails();
    swallowTails(); // fresh start: don't carry the previous loop's tail into this one
  }
  kickResumeInGesture(); // unlock BEFORE the awaits below spend the tap's activation (iOS)
  const web = await ensureStarted();
  // A newer playSong() started while we awaited the engine — it owns the
  // transport (and already did its own stop()/hardKillTails()); bail before we
  // swallow tails or arm timers over it.
  if (songRunId !== myRun) return;
  await resumeAudio(); // in case a previous stop() suspended the context
  if (songRunId !== myRun) return;
  // Arm the mobile background session on EVERY play (idempotent; desktop
  // no-ops inside; must run AFTER the engine is up so the master exists):
  // the hidden <audio> sink + silent anchor are what let a phone keep
  // playing when the page hides — same as desktop. If the tap's activation
  // is already spent, the sink borrows the next one (armSinkGestureRetry).
  void enableBackgroundPlayback();
  if (sdTakeover) zaltzTakeoverNext = true; // the walker's first eval crossfades
  assertMaxPolyphony(); // cap voices AFTER the engine's NaN init (see the note)

  // ---- UNIT WALKER ------------------------------------------------------
  // The list partitions into UNITS: maximal same-tempo runs play as ONE
  // arrange() pattern (seams = pattern math, sample-exact — a whole song is
  // typically one unit), and only unit→unit boundaries (tempo changes: the
  // song hand-offs a set's breaks were written to mask) or non-embeddable
  // sections ride the stepper's hush→evaluate with lead compensation.

  // Arm the next stage of the chain, remembering it + its deadline so PAUSE can
  // hold the timer mid-stage and RESUME can re-arm exactly the time that's left.
  const arm = (fn: () => Promise<void> | void, ms: number) => {
    if (songRunId !== myRun) return; // a newer play took over during an await
    // CLEAR the prior stage's timer before arming the next. The watcher re-arms
    // unitEnd on hold stretches/trims; overwriting songTimer without clearing
    // leaked the old timer, which still fired at its stale deadline and walked
    // the song forward under a hold latch (or advanced the transport mid-pause).
    if (songTimer != null) clearAudioTimeout(songTimer);
    songStepRef = fn;
    songStepDeadline = Date.now() + ms;
    songTimer = audioSetTimeout(fn, ms);
  };

  // `i` is the FALLBACK cursor (used only when sectionsFor isn't supplied, or when the
  // just-played section vanished from the live list). When sectionsFor IS supplied we
  // advance by SECTION ID, so an inserted/removed break shifts the sequence live, no restart.
  let i = 0;
  let lastPlayedId: string | null = null;
  const liveReady = (): SongSection[] => {
    const live = songOpts.sectionsFor?.().filter((s) => s.code && s.code.trim());
    return live && live.length ? live : ready;
  };
  const decorated = (s: SongSection): ArrangeSection => ({
    id: s.id,
    code: songOpts.decorate ? songOpts.decorate(s.code, s.id) : s.code,
    seconds:
      Math.max(0.5, songOpts.secondsFor?.(s.id) ?? s.seconds) * sectionRepeats(s.id),
    // whether a dialled repeat keeps its arrangement is the CALLER's call —
    // arrOf() only attaches arr when it was authored for the current dial,
    // and its bars then equal repeats × natural, so the span math agrees.
    arr: s.arr,
  });

  // The song's OWN end (SongEnding "stop"): stop scheduling so the final hit
  // rings its tail out naturally, hand the UI its stopped state, then cut
  // residual energy once the tail has breathed. Mirrors stop() minus the
  // immediate suspend.
  const endSong = () => {
    if (!songActive || songRunId !== myRun) return;
    const { onEnded, onSection } = songOpts;
    stopSong(); // walker, watcher, timers — and songActive drops
    transportActive = false;
    armVisualClock();
    mod?.hush(); // stop scheduling; the ring-out decays on its own
    thawVisuals();
    micPauseHeldCps = null;
    currentPartId = null;
    onSection?.(null);
    onEnded?.();
    audioSetTimeout(() => {
      if (!songActive && !transportActive && !liveMicHoldsContext()) suspendAudio();
    }, 2500);
  };
  const trackEvalLead = (t0: number) => {
    // hush→evaluate is not free (compile + first schedule — 30ms desktop, a
    // few hundred on phones). EMA of the real cost; hard boundaries fire this
    // early so the incoming downbeat lands close to ON the seam.
    evalLeadMs = Math.max(
      30,
      Math.min(600, Math.round(evalLeadMs * 0.5 + (performance.now() - t0) * 0.5)),
    );
  };

  const step = async (): Promise<void> => {
    if (!songActive || songRunId !== myRun) return;
    const list = liveReady();
    if (!list.length) return;
    const endsStop = songOpts.ending?.mode === "stop";
    let from = 0;
    if (lastPlayedId != null) {
      const at = list.findIndex((s) => s.id === lastPlayedId);
      from = at >= 0 ? at + 1 : i;
    } else {
      from = i;
    }
    // An ending song plays THROUGH the list's end and stops — it never wraps
    // past it (starting mid-song still means "play to the end, then stop").
    if (endsStop && from >= list.length) {
      endSong();
      return;
    }
    from = from % list.length;
    const rotated = endsStop
      ? list.slice(from)
      : [...list.slice(from), ...list.slice(0, from)];
    const unit = nextUnit(rotated.map(decorated), 0, {
      ending: songOpts.ending,
      effects: songOpts.effectsFor?.() ?? null, overlays: songOpts.overlaysFor?.() ?? null,
      keepOrbits: songOpts.keepOrbits,
    });
    if (!unit.sections.length) return;

    if (unit.arrangement) {
      // warm the sounds the NEXT unit will need — a cold buffer at a unit
      // boundary plays as silence until it decodes (worst on phone networks)
      const upcoming = rotated
        .slice(unit.sections.length, unit.sections.length + 6)
        .map((s) => s.code);
      if (upcoming.length && !isZaltz()) void preloadSamples(upcoming); // zaltz loads its own
      await playUnit(unit.arrangement, rotated.slice(0, unit.sections.length), list.length);
      return;
    }

    // ---- STEPPER: one non-embeddable section ----
    const section = rotated[0];
    const evalT0 = performance.now();
    try {
      // PHASE RESET on a section change — hush() zeroes the cyclist so the new
      // section starts on ITS OWN downbeat (tails ring out). Same-id re-loops
      // skip the hush: re-firing cycle 0 under the still-sounding lookahead
      // double-hits the downbeat.
      if (section.id !== lastPlayedId) {
        web.hush();
        if (zaltzActive()) zaltzHush();
      }
      currentPartId = section.id; // set BEFORE eval so errors attribute to THIS section
      await evalProgram(
        (c, a) => web.evaluate(c, a),
        songOpts.decorate ? songOpts.decorate(section.code, section.id) : section.code,
      );
    } catch {
      // Skip a section that fails to evaluate rather than killing playback.
    }
    trackEvalLead(evalT0);
    releaseTails(); // the new section is scheduling — un-strangle the master
    if (!songActive) return;
    lastPlayedId = section.id;
    songOpts.onSection?.(section.id);
    i += 1;
    const dur = Math.max(
      800,
      (songOpts.secondsFor?.(section.id) ?? section.seconds) *
        sectionRepeats(section.id) *
        1000,
    );
    const tick = () => {
      if (!songActive || songRunId !== myRun) return;
      if (songOpts.holdSection?.(section.id)) {
        arm(tick, dur); // FULL dur — the lead was taken once, up front
        return;
      }
      void step();
    };
    arm(tick, Math.max(400, dur - evalLeadMs));
  };

  /** Play one arrangement unit; walk to the next unit at its end (if any). */
  const playUnit = async (
    built: NonNullable<ReturnType<typeof buildArrangement>>,
    rawSections: SongSection[],
    listLength: number,
  ): Promise<void> => {
    const a: ActiveArrangement = {
      spans: built.spans,
      totalCycles: built.totalCycles,
      cps: built.cps,
      watcherId: null,
      sig: "",
      heldId: null,
      heldCycles: null,
      overrides: new Map(),
      baseList: rawSections,
      anchorId: rawSections[0]?.id ?? "",
      rawPrint: rawPrintOf(rawSections),
      wholeList: rawSections.length >= listLength,
      ends: built.ends,
      evalFn: (c) => evalProgram((cc, x) => web.evaluate(cc, x), c),
      rebuildBusy: false,
      rebuildPending: false,
    };
    arrangement = a;
    a.sig = arrangementSig(a);
    currentPartId = a.anchorId || null; // errors attribute to the unit's head
    const evalT0 = performance.now();
    try {
      // a unit CHANGE needs its own downbeat + tempo pivot; a fresh play was
      // already hushed by stop()
      if (lastPlayedId !== null && lastPlayedId !== a.anchorId) {
        web.hush();
        if (zaltzActive()) zaltzHush();
      }
      await a.evalFn(built.program);
    } catch {
      stopArrangement();
    }
    trackEvalLead(evalT0);
    releaseTails(); // the unit is scheduling — un-strangle the master
    if (arrangement !== a || !songActive) return;
    lastPlayedId = a.anchorId;
    i += rawSections.length;
    if (currentPartId) songOpts.onSection?.(currentPartId);

    // the unit's END → walk to the next unit, firing early by the eval cost.
    // (A unit covering the whole list just loops — the song-page case.)
    const unitEnd = () => {
      if (!songActive || arrangement !== a) return;
      lastPlayedId = a.baseList[a.baseList.length - 1]?.id ?? lastPlayedId;
      void step();
    };
    // NB: the scheduler reads slightly NEGATIVE right after an evaluate (start
    // latency) — contentPos clamps that to 0 before applying the seek shift.
    const unitPos = (): number => contentPos(a);
    const remainingMs = (): number =>
      Math.max(250, ((a.totalCycles - unitPos()) / a.cps) * 1000 - evalLeadMs);
    // the song's OWN end (ending "stop"): a terminal timer instead of a walk —
    // no eval follows, so fire ON the boundary (plus a breath), not early.
    const songEndAt = () => {
      if (!songActive || arrangement !== a) return;
      endSong();
    };
    const endRemainingMs = (): number =>
      Math.max(250, ((a.totalCycles - unitPos()) / a.cps) * 1000 + 120);
    if (a.ends) arm(songEndAt, endRemainingMs());
    else if (!a.wholeList) arm(unitEnd, remainingMs());

    const WATCH_MS = 200;
    let watchTick = 0;
    const watch = () => {
      if (arrangement !== a || !songActive) return;
      // MIC-AWARE PAUSE (see pausePlayback): while the tempo holds at ~0 the
      // context — and so this audio-clock loop — keeps running. The watcher
      // must IDLE, not work: its unit-end re-arm below resurrected the song
      // boundary mid-pause (the set audibly walked on while "paused"). A
      // suspended context used to freeze this loop for free; the cps-hold
      // pause has to say so explicitly.
      if (!transportActive) {
        a.watcherId = audioSetTimeout(watch, WATCH_MS);
        return;
      }
      // ENDING IS LIVE (2026-07-14): the ends-here/loops-forever toggle must
      // apply MID-PLAY. A whole-list unit was born with `ends` frozen — when
      // the live setting disagrees, flip the unit and rebuild (the program
      // gains/loses its ring-out span); the boundary re-arm below then arms
      // the terminal stop — or the cancel here removes a stale one.
      const wantsEnd = songOpts.ending?.mode === "stop";
      if (a.wholeList && wantsEnd !== a.ends) {
        a.ends = wantsEnd;
        requestRebuild(a);
        if (!wantsEnd && songTimer != null && songStepRef === songEndAt) {
          clearAudioTimeout(songTimer);
          songTimer = null;
          songStepRef = null;
        }
      }
      const pos = unitPos();
      const span = spanAtCycle(a.spans, a.totalCycles, pos);
      // UI: which section is sounding (never in the audio path)
      if (span && span.id !== currentPartId) {
        currentPartId = span.id;
        lastPlayedId = span.id; // a restart/jump picks up AFTER what's sounding
        songOpts.onSection?.(span.id);
      }
      const wantHold = span ? !!songOpts.holdSection?.(span.id) : false;
      if (span && wantHold && a.heldId !== span.id) {
        // LATCH ON: stretch the held span in place. Everything before it keeps
        // its grid, the span's inner phase is untouched → seamless.
        a.heldId = span.id;
        a.heldCycles = Math.max(span.bars, span.end - span.start) + HOLD_STRETCH;
        requestRebuild(a);
      } else if (span && wantHold && a.heldId === span.id && a.heldCycles) {
        if (pos - span.start > a.heldCycles * 0.6) {
          a.heldCycles += HOLD_STRETCH; // re-extend long before it runs out
          requestRebuild(a);
        }
      } else if (a.heldId && span && a.heldId === span.id && !wantHold && a.heldCycles) {
        // LATCH OFF: trim to the NEXT whole-phrase boundary — the hold plays
        // out its phrase, then the song walks on.
        const phrase = Math.max(1, span.bars);
        const posIn = pos - span.start;
        const trimmed = Math.max(phrase, Math.ceil((posIn + 0.02) / phrase) * phrase);
        if (trimmed !== a.heldCycles) {
          a.heldCycles = trimmed;
          requestRebuild(a);
        }
      } else if (a.heldId && (!span || span.id !== a.heldId)) {
        // past the held span — restore its normal length once the grid BEFORE
        // our position can't change (i.e. after wrap)
        const held = a.spans.find((s) => s.id === a.heldId);
        if (!held || pos < held.start) {
          a.heldId = null;
          a.heldCycles = null;
          requestRebuild(a);
        }
      }
      // STRUCTURE + CONTENT checks run on a SLOW cadence and stay CHEAP by
      // default. The first version decorated EVERY section of the set on
      // every 200ms tick (full regex transforms, kilobytes each) — a constant
      // main-thread drain on the very thread the scheduler ticks on, which on
      // phones periodically starved audio ("random pauses while performing").
      // Now: a raw fingerprint (ids + code lengths — string ops only) every
      // ~1.2s; the EXPENSIVE decorated re-scope + sig run ONLY when the
      // fingerprint actually changed.
      watchTick += 1;
      if (watchTick % 6 === 0 && !a.rebuildBusy) {
        const live = songOpts.sectionsFor?.().filter((s) => s.code && s.code.trim());
        const rawPrint = rawPrintOf(live && live.length ? live : arrangementList(a));
        if (rawPrint !== a.rawPrint) {
          a.rawPrint = rawPrint;
          // shape may have changed — re-scope the unit from its anchor
          if (live && live.length) {
            const at = live.findIndex((s) => s.id === a.anchorId);
            if (at >= 0) {
              // an ending unit never re-scopes past the list's end (no wrap)
              const rot = a.ends
                ? live.slice(at)
                : [...live.slice(at), ...live.slice(0, at)];
              const fresh = nextUnit(rot.map(decorated), 0, {
                attachVisual: false,
                ending: songOpts.ending,
                effects: songOpts.effectsFor?.() ?? null, overlays: songOpts.overlaysFor?.() ?? null,
                keepOrbits: songOpts.keepOrbits,
              });
              const freshIds = fresh.sections.map((s) => s.id).join(" ");
              const baseIds = a.baseList.map((s) => s.id).join(" ");
              if (fresh.arrangement && freshIds !== baseIds) {
                a.baseList = rot.slice(0, fresh.sections.length);
                a.wholeList = fresh.sections.length >= live.length;
              }
            }
          }
          a.sig = arrangementSig(a);
          a.overrides.clear(); // stale tweaks must not shadow fresh code
          requestRebuild(a);
        }
      }
      // keep the boundary timer honest under hold stretches/trims — re-arm
      // only when it drifted enough to matter. An ending unit's boundary is
      // the terminal stop; a mid-set unit's is the walk to the next unit.
      const boundary = a.ends ? songEndAt : unitEnd;
      const boundaryMs = a.ends ? endRemainingMs : remainingMs;
      if ((a.ends || !a.wholeList) && songStepRef === boundary) {
        const want = boundaryMs();
        if (Math.abs(want - (songStepDeadline - Date.now())) > 250) arm(boundary, want);
      } else if ((a.ends || !a.wholeList) && songStepRef !== boundary && songTimer == null) {
        arm(boundary, boundaryMs()); // e.g. adopted from wholeList → needs an end
      }
      if (arrangement === a && songActive) a.watcherId = audioSetTimeout(watch, WATCH_MS);
    };
    a.watcherId = audioSetTimeout(watch, WATCH_MS);
  };

  await step();
}

/** Stop only the whole-song scheduler. */
function stopSong(): void {
  songActive = false;
  songStepRef = null;
  songOpts = {};
  songPausedRemaining = 0;
  stopArrangement();
  if (songTimer != null) {
    clearAudioTimeout(songTimer);
    songTimer = null;
  }
}

// --- pause / resume ----------------------------------------------------------
// PAUSE is not stop: these are LOOPS — restarting from bar 1 every time is
// pointless. The Strudel scheduler runs on the AUDIO clock, so suspending the
// context halts scheduling exactly where it is (no hush, no re-eval); the
// visuals freeze on their frame; a running mix holds its section timer.
// resume() lets the very same phrase carry on mid-bar.
let songStepRef: (() => Promise<void> | void) | null = null;
let songStepDeadline = 0;
let songPausedRemaining = 0;

// --- mic-aware pause (field failure 2026-07-12) --------------------------------
// suspend() freezes the WHOLE context — including the live-mic path and the
// broadcast tap. A DJ who pauses the mix to talk to the crowd (the classic
// move) kept a lit MIC pill and a glowing level dot (the analyser freezes at
// its last frame, so the dot lies) while listeners got dead air. While the
// mic is open on a live broadcast, pause must hold the MUSIC while the
// context keeps rendering the voice. The hold rides the scheduler's own
// supported mid-flight pivot (setCps — the same lever the tempo dial uses):
// cps ≈ 0 freezes the cycle position in place, so no new notes schedule, the
// sounding ones ring their tails out (musical, not a hard cut), the playhead
// holds, and resume restores the held cps and the same phrase carries on.
// NOT scheduler.pause(): that flips `started` → onToggle fires → the
// playback-state machinery treats it as a stop and restarts the program
// (measured: music back within a beat, transport UI dropped to "Play").
const MIC_PAUSE_CPS = 1e-4; // setCps guards cps > 0; at 1e-4 a cycle takes ~3h
let micPauseHeldCps: number | null = null;

/** True while pausing the mix must NOT freeze the AudioContext: the DJ's mic
 *  is open and a broadcast tap exists — listeners are owed the voice. */
function liveMicHoldsContext(): boolean {
  return !!micNodes && !!broadcastDest;
}
function schedulerCps(): number | null {
  const v = (replInstance as { scheduler?: { cps?: number } } | null)?.scheduler?.cps;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

export function pausePlayback(): void {
  if (zaltzActive()) zaltzPause();
  if (songActive && songTimer != null) {
    clearAudioTimeout(songTimer);
    songTimer = null;
    songPausedRemaining = Math.max(250, songStepDeadline - Date.now());
  }
  // Pause = the music holds, but the visual KEEPS gently drifting (slower/calmer) — never frozen.
  transportActive = false;
  armVisualClock();
  thawVisuals();
  const cps = schedulerCps();
  const setCps = (replInstance as { setCps?: (v: number) => void } | null)?.setCps;
  if (liveMicHoldsContext() && cps != null && cps > MIC_PAUSE_CPS * 2 && setCps) {
    micPauseHeldCps = cps;
    try {
      setCps(MIC_PAUSE_CPS); // scheduler only — arrangement.cps keeps the real tempo
    } catch {
      micPauseHeldCps = null;
      suspendAudio(); // the hold failed — silence for everyone beats a lying pause
    }
  } else {
    micPauseHeldCps = null;
    suspendAudio();
  }
}

export async function resumePlayback(): Promise<void> {
  if (zaltzActive()) zaltzResume();
  transportActive = true; // visuals re-lock to the music (resume doesn't evaluate, so set it here)
  thawVisuals();
  await resumeAudio(); // no-op when the mic-aware pause kept the context running
  if (micPauseHeldCps != null) {
    const held = micPauseHeldCps;
    micPauseHeldCps = null;
    const cur = schedulerCps();
    // restore only while the hold is still in force — an evaluate/tempo write
    // in between re-asserted the real cps already and must win
    if (cur != null && cur <= MIC_PAUSE_CPS * 2) {
      try {
        (replInstance as { setCps?: (v: number) => void } | null)?.setCps?.(held);
      } catch {
        /* the next evaluate re-asserts tempo */
      }
    }
  }
  if (songActive && songTimer == null && songStepRef && songPausedRemaining > 0) {
    songTimer = audioSetTimeout(songStepRef, songPausedRemaining);
    songPausedRemaining = 0;
  }
}

export function isSongPlaying(): boolean {
  return songActive;
}

/** Stop all audio (single part or whole song). */
export function stop(): void {
  if (zaltzActive()) zaltzStop();
  stopSong();
  // Hand the visuals to the calm idle drift instead of freezing: capture where the music is and
  // re-install our clock BEFORE hush() zeroes scheduler.now() (and before the next play's
  // evaluate re-points setTime back to the scheduler).
  transportActive = false;
  armVisualClock();
  // Use the module export, not a window global: @strudel/web installs
  // `window.initStrudel` but NOT `window.hush`, so the old window.hush?.() was a
  // silent no-op — which is why Stop didn't stop anything.
  mod?.hush(); // stop scheduling new notes
  // The visual keeps gently DRIFTING when stopped (the idle clock drives it) instead of
  // freezing — hush() zeroes scheduler.now(), so the global clock falls through to the slow
  // idle wall-clock. thaw() makes sure Hydra's render loop is live to show it.
  thawVisuals();
  // hush() leaves sounding notes to finish their release/reverb tails. Suspend
  // the audio context to cut ALL sound immediately (resumed on next play) —
  // UNLESS the DJ's mic is open on a live broadcast: suspend would freeze the
  // voice for every listener (see pausePlayback). hush already silenced the
  // music; the tails ringing out on the stream is the lesser cost.
  micPauseHeldCps = null; // a stop invalidates any held pause tempo
  if (!liveMicHoldsContext()) suspendAudio();
  currentPartId = null;
  programOwner = null; // a stopped engine belongs to nobody — the next play starts fresh
}

export function playingPartId(): string | null {
  return currentPartId;
}

// --- WAV export --------------------------------------------------------------

export interface RenderSection {
  /** Stable id (part id) — lets the arrangement path key sections. */
  id?: string;
  code: string;
  /** seconds this section plays before the next */
  seconds: number;
  /** Optional hand-off variant for the final stretch (see SongSection.outro) —
   *  exported audio transitions exactly like the live mix. */
  outro?: { code: string; seconds: number };
  /** The section's model-authored arrangement — exported audio unfolds exactly
   *  like the live mix (layer moves, sweeps, overlays). */
  arr?: SectionArrange | null;
}

/**
 * Render the arrangement to a 16-bit stereo WAV. There is no offline path: the
 * Strudel scheduler runs on the live audio clock, so we play the whole song
 * through ONCE in real time while tapping superdough's master output
 * (`destinationGain`) into a recorder, then encode the captured PCM. Export
 * therefore takes about as long as the song and is audible while it renders.
 */
export async function renderSongToWav(
  sections: RenderSection[],
  opts: {
    onProgress?: (done: number, total: number) => void;
    /** The song's ending (plan.arrangement.ending) — a "stop" ending renders
     *  its ring-out at the file's tail, exactly like the live mix. */
    ending?: SongEnding | null;
    /** Song-level effects (plan.effects) — baked in exactly like the live mix. */
    effects?: SongFx[] | null;
    overlays?: import('./breaks-catalog').BreakOverlay[] | null;
  } = {},
): Promise<Blob> {
  const ready = sections.filter((s) => s.code && s.code.trim());
  if (ready.length === 0) throw new Error("Nothing to export yet.");

  stop(); // take over from any current playback
  // A render must open on SILENCE: stop() only freezes ringing reverb/delay
  // tails, and the recorder taps the same master they'd thaw back into. Cut
  // the master and DROP the old energy outright; the first unit's eval
  // releases the master again (releaseTails below), so nothing of the
  // previous playback bleeds into the file.
  swallowTails();
  hardKillTails();
  const web = await ensureStarted();
  await resumeAudio();
  const ac = audioContext();
  if (!ac) throw new Error("Audio engine unavailable.");
  installLimiter(); // export the limited signal — same as what you hear
  const master = outputTap ?? web.getSuperdoughAudioController?.()?.output?.destinationGain;
  if (!master) throw new Error("Could not tap the audio output for export.");

  const leftChunks: Float32Array[] = [];
  const rightChunks: Float32Array[] = [];
  const processor = ac.createScriptProcessor(4096, 2, 2);
  let recording = true;
  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    if (!recording) return;
    leftChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    rightChunks.push(
      new Float32Array(
        e.inputBuffer.getChannelData(Math.min(1, e.inputBuffer.numberOfChannels - 1)),
      ),
    );
  };
  // Pull the processor with a muted sink so it runs without double-outputting
  // (the master is already wired to ac.destination, so playback stays audible).
  const sink = ac.createGain();
  sink.gain.value = 0;
  master.connect(processor);
  processor.connect(sink);
  sink.connect(ac.destination);

  songActive = true; // so stop() can abort an in-flight export
  try {
    // ARRANGEMENT-FIRST: render the SAME gapless arrange() program the live
    // mix plays (layer moves, sweeps, overlays, the ending's ring-out) — the
    // per-section stepper below stays the fallback for non-embeddable
    // sections and for the outro hand-off (which lives outside arrange()).
    const anyOutro = ready.some((s) => s.outro);
    const asArrange = (s: RenderSection, idx: number): ArrangeSection => ({
      id: s.id ?? `s${idx}`,
      code: s.code,
      seconds: s.seconds,
      arr: s.arr,
    });
    await new Promise<void>((resolve) => {
      let i = 0;
      const step = async () => {
        if (!recording || !songActive || i >= ready.length) {
          resolve();
          return;
        }
        const unit = anyOutro
          ? { sections: [], arrangement: null }
          : nextUnit(ready.map(asArrange), i, {
              ending: opts.ending ?? null,
              effects: opts.effects ?? null,
              overlays: opts.overlays ?? null,
            });
        if (unit.arrangement && unit.sections.length) {
          const a = unit.arrangement;
          try {
            web.hush(); // phase reset — export transitions exactly like the live mix
            await web.evaluate(a.program, true);
            releaseTails(); // the render is scheduling — un-strangle the master
          } catch {
            /* skip a unit that fails to evaluate */
          }
          const at = i;
          // progress ticks as each span's END passes on the audio clock
          a.spans.forEach((sp, k) => {
            audioSetTimeout(() => {
              if (recording && songActive)
                opts.onProgress?.(Math.min(at + k + 1, ready.length), ready.length);
            }, (sp.end / a.cps) * 1000);
          });
          i += unit.sections.length;
          songTimer = audioSetTimeout(
            step,
            Math.max(800, (a.totalCycles / a.cps) * 1000),
          );
          return;
        }
        const s = ready[i];
        try {
          web.hush(); // phase reset — export transitions exactly like the live mix
          await web.evaluate(s.code, true);
          releaseTails(); // the render is scheduling — un-strangle the master
        } catch {
          /* skip a section that fails to evaluate */
        }
        opts.onProgress?.(i + 1, ready.length);
        i += 1;
        const dur = Math.max(800, s.seconds * 1000);
        // Same hand-off as live playback: the last section has no successor, so
        // it plays clean to the end (no filter-down into silence).
        const isLast = i >= ready.length;
        const outroMs = s.outro ? Math.min(s.outro.seconds * 1000, dur / 2) : 0;
        if (!isLast && s.outro && outroMs > 400 && dur - outroMs > 1500) {
          const outroCode = s.outro.code;
          songTimer = audioSetTimeout(async () => {
            if (!recording || !songActive) {
              resolve();
              return;
            }
            try {
              await web.evaluate(outroCode, true);
            } catch {
              /* keep the body playing */
            }
            songTimer = audioSetTimeout(step, outroMs);
          }, dur - outroMs);
        } else {
          songTimer = audioSetTimeout(step, dur);
        }
      };
      step();
    });
    // let release/reverb tails ring out before we cut the recording
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    recording = false;
    if (songTimer != null) {
      clearAudioTimeout(songTimer);
      songTimer = null;
    }
    songActive = false;
    try {
      web.hush();
    } catch {
      /* ignore */
    }
    try {
      master.disconnect(processor);
    } catch {
      /* ignore */
    }
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
      sink.disconnect();
    } catch {
      /* ignore */
    }
  }

  const left = concatFloat32(leftChunks);
  const right = concatFloat32(rightChunks);
  if (left.length === 0) throw new Error("No audio was captured.");
  return new Blob([encodeWavStereo(left, right, ac.sampleRate)], {
    type: "audio/wav",
  });
}

// --- video export (audio + Hydra visuals) ------------------------------------

/** The best container/codec this browser's MediaRecorder supports. webm (VP9/VP8
 *  + Opus) on Chrome/Firefox; mp4 (H.264) on recent Safari. "" = let the browser
 *  decide. */
function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  // Prefer MP4 (H.264) — it plays natively everywhere (macOS QuickTime/Finder,
  // phones, etc.). webm is the fallback (Chrome/Firefox always have it, but macOS
  // can't play webm without VLC/Chrome).
  for (const c of [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]) {
    try {
      if (MediaRecorder.isTypeSupported?.(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function videoExt(mime: string): string {
  return mime.includes("mp4") ? "mp4" : "webm";
}

/**
 * Render ONE loop to a VIDEO — its Hydra visuals AND audio together. Like the
 * WAV path there's no offline mode: we play the loop in real time with visuals
 * on, capture the Hydra canvas (`captureStream`) + the master audio (a
 * MediaStreamDestination tap) into one stream, and record it with MediaRecorder.
 * Takes roughly the loop's length and is audible/visible while it records.
 */
export async function renderMixToVideo(
  sections: RenderSection[],
  opts: {
    onProgress?: (elapsed: number, total: number) => void;
    /** The song's ending — the video ends exactly like the live mix. */
    ending?: SongEnding | null;
    /** Song-level effects (plan.effects) — baked in exactly like the live mix. */
    effects?: SongFx[] | null;
    overlays?: import('./breaks-catalog').BreakOverlay[] | null;
  } = {},
): Promise<{ blob: Blob; mime: string }> {
  const ready = sections.filter((s) => s.code && s.code.trim());
  if (ready.length === 0) throw new Error("Nothing to render yet.");
  if (!ready.some((s) => extractHydra(s.code)))
    throw new Error("This piece has no visuals to render.");
  if (typeof MediaRecorder === "undefined")
    throw new Error("Your browser can't record video.");

  stop();
  // Open on SILENCE — drop any previous playback's ringing energy so nothing
  // bleeds into the recording (same cut as the WAV path).
  swallowTails();
  hardKillTails();
  const web = await ensureStarted();
  await resumeAudio();
  const ac = audioContext();
  if (!ac) throw new Error("Audio engine unavailable.");

  const prevVisuals = visualsEnabled;
  visualsEnabled = true;
  if (!(await ensureHydra())) {
    visualsEnabled = prevVisuals;
    throw new Error("Visuals failed to start.");
  }
  const canvas = document.getElementById(
    "hydra-canvas",
  ) as HTMLCanvasElement | null;
  installLimiter(); // export the limited signal — same as what you hear
  const master = outputTap ?? web.getSuperdoughAudioController?.()?.output?.destinationGain;
  if (!canvas || !master) {
    visualsEnabled = prevVisuals;
    throw new Error("Could not tap the visuals/audio for the video.");
  }

  // Render the export at a clean 1080p regardless of window size, for a crisp,
  // consistent video (restored to the viewport on cleanup via clearVisuals).
  try {
    hydraInstance?.setResolution?.(1920, 1080);
  } catch {
    /* ignore */
  }

  const audioDest = ac.createMediaStreamDestination();
  master.connect(audioDest);
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mime = pickVideoMime();
  const chunks: BlobPart[] = [];
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 12_000_000, // ~12 Mbps — high quality
    audioBitsPerSecond: 256_000,
  });
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const recorded = new Promise<void>((res) => {
    rec.onstop = () => res();
  });

  songActive = true;
  try {
    // PRE-ROLL: paint the first look BEFORE the recorder starts — a video that
    // opens on a black frame can never loop cleanly (the black head becomes a
    // visible seam every time it wraps). Run the first visuals, let the canvas
    // draw a couple of frames, THEN record; the music enters right after.
    const firstHydra = ready.map((s) => extractHydra(s.code)).find(Boolean);
    if (firstHydra) {
      try {
        new Function(firstHydra)();
      } catch {
        /* the section loop will surface visual problems */
      }
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
    }
    rec.start();

    // The whole MIX, exactly like live playback: ARRANGEMENT-FIRST (the same
    // gapless arrange() program the live mix plays — layer moves, sweeps,
    // overlays, the ending), with the per-section stepper as the fallback for
    // non-embeddable sections and the outro hand-off.
    const anyOutro = ready.some((s) => s.outro);
    const asArrange = (s: RenderSection, idx: number): ArrangeSection => ({
      id: s.id ?? `s${idx}`,
      code: s.code,
      seconds: s.seconds,
      arr: s.arr,
    });
    const total = ready.reduce((s, x) => s + Math.max(0.8, x.seconds), 0);
    const start = performance.now();
    let i = 0;
    while (i < ready.length && songActive) {
      const unit = anyOutro
        ? { sections: [], arrangement: null }
        : nextUnit(ready.map(asArrange), i, {
            ending: opts.ending ?? null,
            effects: opts.effects ?? null,
            overlays: opts.overlays ?? null,
          });
      let ms: number;
      if (unit.arrangement && unit.sections.length) {
        const a = unit.arrangement;
        try {
          web.hush(); // phase reset — the unit enters on its own bar 1
          await evalProgram((c, x) => web.evaluate(c, x), a.program);
          releaseTails(); // the render is scheduling — un-strangle the master
        } catch {
          /* skip a unit that fails to evaluate */
        }
        ms = Math.max(800, (a.totalCycles / a.cps) * 1000);
        i += unit.sections.length;
      } else {
        const s = ready[i];
        try {
          web.hush(); // phase reset — sections enter on their own bar 1
          await evalProgram((c, x) => web.evaluate(c, x), s.code);
          releaseTails(); // the render is scheduling — un-strangle the master
        } catch {
          /* skip a section that fails to evaluate */
        }
        ms = Math.max(800, s.seconds * 1000);
        i += 1;
      }
      const end = performance.now() + ms;
      await new Promise<void>((resolve) => {
        const tick = () => {
          opts.onProgress?.(
            Math.min(total, (performance.now() - start) / 1000),
            total,
          );
          if (!songActive || performance.now() >= end) return resolve();
          songTimer = audioSetTimeout(tick, 100);
        };
        tick();
      });
    }
    await new Promise((r) => setTimeout(r, 250)); // let the tail land
  } finally {
    songActive = false;
    if (songTimer != null) {
      clearAudioTimeout(songTimer);
      songTimer = null;
    }
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      /* ignore */
    }
  }
  await recorded;
  try {
    web.hush();
  } catch {
    /* ignore */
  }
  try {
    master.disconnect(audioDest);
  } catch {
    /* ignore */
  }
  try {
    videoStream.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  clearVisuals();
  suspendAudio();
  visualsEnabled = prevVisuals;

  if (chunks.length === 0) throw new Error("Nothing was recorded.");
  return { blob: new Blob(chunks, { type: mime || "video/webm" }), mime };
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Float32Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function encodeWavStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const frames = Math.min(left.length, right.length);
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] || 0));
    const r = Math.max(-1, Math.min(1, right[i] || 0));
    view.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(off + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    off += 4;
  }
  return buffer;
}
