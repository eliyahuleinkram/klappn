"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PartRow, SongRow, BreakSet } from "@/lib/songs";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import type { SetEntry, SetRow, SetTransition } from "@/lib/sets";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  applyOrbitGains,
  currentSectionId,
  disableLiveMic,
  enableBackgroundPlayback,
  enableLiveMic,
  ensurePerfFx,
  fadeMaster,
  getLiveMicLevel,
  isSongPlaying,
  liveMicActive,
  liveUpdate,
  loopCycles,
  outputLatencyMs,
  pausePlayback,
  playSong,
  preloadSamples,
  rebindSong,
  getBroadcastStream,
  resumePlayback,
  setLiveCps,
  setLiveMicDevice,
  setLiveMicEchoBpm,
  setLiveMicFx,
  setLiveMicKey,
  setLiveMicVoice,
  setLivePerf,
  type LiveMicVoice,
  stop,
  stopBroadcastStream,
  warmEngine,
} from "@/lib/strudel-client";
import {
  liveRecordingState,
  startLiveRecording,
  stopLiveRecording,
} from "@/lib/live-record";
import {
  disableLiveMidi,
  enableLiveMidi,
  midiState,
  MIDI_INSTRUMENTS,
  setMidiInput,
  setMidiInstrument,
  subscribeMidi,
  type MidiSnapshot,
} from "@/lib/midi-live";
import {
  clearNowPlaying,
  nowPlaying,
  publishNowPlaying,
  updateNowPlaying,
  type DeckSnapshot,
} from "@/lib/now-playing";
import { isOwnSession, useNowPlayingValue } from "@/lib/use-now-playing";
import { scaleFromKey, shiftScale } from "@/lib/vocal-pipeline";
import { publishStream, type Broadcast } from "@/lib/rtc";
import { barSeconds } from "@/lib/playback";
import {
  buildSetSections,
  channelOfOrbit,
  CHANNELS,
  decorateSetSection,
  filterDisplay,
  holdTargetOf,
  makeClockSync,
  PERF_ZERO,
  sectionCps,
  sectionHoldTarget,
  setSectionLabel,
  type Channel,
  type SetLiveCtx,
  type SetSection,
} from "@/lib/set-live";
import { computeLoopBars } from "@/lib/loop-length";

/**
 * A SET: the user's songs in a chosen order, played as ONE continuous
 * performance. Playback rides the same whole-song sequencer as a single song —
 * each song's loops (and its own chosen breaks) become sections, with an
 * AI-composed HAND-OFF section at each song boundary. Every live control here
 * (tempo nudge, mix dials, layer mutes, hold, jump) is a PERFORMANCE gesture:
 * applied at play time via decorate()/liveUpdate, never written to the songs.
 */

interface SongBundle {
  song: SongRow;
  parts: PartRow[];
}


interface SongPlanish {
  bpm?: number;
  key?: string;
  genre?: string;
  transpose?: number;
  timeSignature?: string | null;
  breaks?: Record<string, BreakSet>;
  /** Per-loop repeat latches saved on the song page (−1 = forever), keyed by
   *  part id (loops) or `break:<partId>` (the song's own breaks). The set is the
   *  song WITH its arrangement — DJing honours these exactly like song playback. */
  holdCycles?: Record<string, number>;
}

const planOf = (song: SongRow | undefined): SongPlanish =>
  song?.plan && typeof song.plan === "object" ? (song.plan as SongPlanish) : {};

/** One playable step of the set — the SHARED shape (lib/set-live.ts): the same
 *  builder feeds this deck, a live listener's phone and the sets-page player. */
type FlatSection = SetSection;

const TRANSITION = "~";
const sectionEntryId = (id: string) => id.split("|")[0];

// The deck's kill switches are THREE FIXED CHANNELS — Drums · Bass · Melody —
// like the kill EQ on a DJ mixer: they never appear, disappear, or reorder as
// the music moves. Every section's layers are routed onto per-channel orbit
// buses (lib/set-live.ts), so a kill is an INSTANT Web Audio gain gate — tails
// included, music running underneath — not a pattern rewrite that waits for
// the next evaluate.

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Three breathing bars — the sign that THIS is where the music is. */
function EqBars({ className = "" }: { className?: string }) {
  return (
    <span className={`flex h-3.5 items-end gap-[3px] ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-full bg-accent-strong"
          style={{ height: "100%", animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

/** One deck dial: whispered label, mono readout, the premium slider with its
 *  accent fill drawn to the value. */
function DeckSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  bipolar,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  /** Centre-detent dial (KEY, FILTER): the accent fill grows from the middle. */
  bipolar?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill = bipolar
    ? pct >= 50
      ? `linear-gradient(to right, rgba(255,255,255,0.08) 50%, var(--accent) 50%, var(--accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`
      : `linear-gradient(to right, rgba(255,255,255,0.08) ${pct}%, var(--accent) ${pct}%, var(--accent) 50%, rgba(255,255,255,0.08) 50%)`
    : `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] text-muted/60">
        {label}
        <span className="font-mono text-[11px] normal-case tracking-normal text-foreground/70">
          {display}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={bipolar ? () => onChange(0) : undefined}
        className="slider deck-slider"
        style={{ background: fill }}
      />
    </label>
  );
}

// THE HEADPHONES WHISPER — said once, quietly, the first time the mic opens
// (then never again); the 🎧 glyph in the mic header carries it forever.
const MIC_HINT_KEY = "klappn:live-mic-hint";
const MIC_HINT_LINE = "Headphones keep the mic yours — speakers bleed back in.";

// The DJ's mic pick, sticky across sets (the studio's contract, its own key).
const MIC_DEVICE_KEY = "klappn:live-mic-device";

interface MicDevice {
  deviceId: string;
  label: string;
}

/** Device labels arrive as hardware strings — strip the noise ("Default -"
 *  prefixes, "(Built-in)", USB vendor:product hex ids), keep the name.
 *  (The studio's cleaner, carried live — components/VoiceStudio.) */
function cleanMicLabel(label: string): string {
  return (
    label
      .replace(/^(default|communications)\s*[-–]\s*/i, "")
      .replace(/\s*\((built-?in|[0-9a-f]{4}:[0-9a-f]{4})\)\s*/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || "Microphone"
  );
}

// The VOICE characters — caricature filters on the live mic (lib/strudel-client
// setLiveMicVoice): tap one, the listeners hear it instantly, echo and space
// ride the character too. Natural is always first — the way back home.
const MIC_VOICES: { id: LiveMicVoice; name: string; hint: string }[] = [
  { id: "natural", name: "Natural", hint: "Your own voice" },
  { id: "deep", name: "Deep", hint: "Pitched down — the trailer voice" },
  { id: "chipmunk", name: "Chip", hint: "Pitched up — helium" },
  { id: "robot", name: "Robot", hint: "Ring-mod metal" },
  { id: "phone", name: "Phone", hint: "Down the line" },
];

/** The mic's dial positions — plain 0..1; the Web Audio ranges live in
 *  lib/strudel-client (setLiveMicFx). */
type MicFx = { level: number; echo: number; space: number; drive: number; glow: number };

// The LOOKS — one-tap seats for the live voice, same names and order the
// studio's VOCAL_PRESETS wore (lib/vocal-fx), re-voiced for the live chain
// (no air shelf here; level 0.7 ≈ unity after the lib's ×1.5 headroom).
const MIC_LOOKS: { id: string; name: string; fx: MicFx }[] = [
  { id: "true", name: "True", fx: { level: 0.7, echo: 0.08, space: 0.18, drive: 0.05, glow: 0.05 } },
  { id: "silk", name: "Silk", fx: { level: 0.7, echo: 0.12, space: 0.38, drive: 0.08, glow: 0.2 } },
  { id: "neon", name: "Neon", fx: { level: 0.7, echo: 0.45, space: 0.3, drive: 0.25, glow: 0.5 } },
  { id: "cathedral", name: "Cathedral", fx: { level: 0.7, echo: 0.2, space: 0.85, drive: 0.05, glow: 0.15 } },
  { id: "tape", name: "Tape", fx: { level: 0.7, echo: 0.35, space: 0.25, drive: 0.5, glow: 0.25 } },
  { id: "close", name: "Close", fx: { level: 0.7, echo: 0.04, space: 0.08, drive: 0.15, glow: 0 } },
];

// The performance pads: moments you HOLD — release snaps the dial back.
const PADS: { name: string; hint: string; patch: Partial<import("@/lib/set-live").PerfState> }[] = [
  { name: "DIVE", hint: "filter down", patch: { filter: -78 } },
  { name: "AIR", hint: "bass away", patch: { filter: 62 } },
  { name: "ECHO", hint: "throw", patch: { echo: 0.6 } },
];

// THE ONE PINK — the house gradient, worn identically by every lit control on
// the deck: the big pills, the small chips, the meter's fill.
const HOT_GRADIENT =
  "linear-gradient(135deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)";
const LIT_PILL: CSSProperties = {
  backgroundImage: HOT_GRADIENT,
  boxShadow: "0 0 22px -6px rgba(224,49,156,0.7)",
};
const LIT_CHIP: CSSProperties = {
  backgroundImage: HOT_GRADIENT,
  boxShadow: "0 0 14px -4px rgba(224,49,156,0.7)",
};

/** One deck chip — VOICE, LOOK and SOUND all wear exactly this. */
function DeckChip({
  worn,
  title,
  onClick,
  children,
}: {
  worn: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={worn}
      title={title}
      className={`h-7 overflow-hidden whitespace-nowrap rounded-full px-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${
        worn ? "text-white" : "bg-white/[0.04] text-muted/70 hover:bg-white/[0.08]"
      }`}
      style={worn ? LIT_CHIP : undefined}
    >
      {children}
    </button>
  );
}

/** A row's whispered label; `right` rides the far edge (the 🎧). */
function DeckRowLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/50">
      <span>{children}</span>
      {right}
    </p>
  );
}

/** A machined zone — the hairline-bounded group a pill unfolds into (the mic's
 *  world, the keyboard's world). One shared anatomy: same inset, same breath
 *  between rows, a 250ms rise as it arrives. */
function DeckGroup({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-2.5 min-w-0 space-y-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        animation: "rise 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      {children}
    </div>
  );
}

/** The instrument itself — channels, dials, pads — ONE implementation shared
 *  by the bottom deck and the fullscreen perform stage, so they can't drift. */
function DeckControls({
  kills,
  onKill,
  tempoNudge,
  onTempo,
  perf,
  onDial,
  heldPad,
  onPadDown,
  onPadUp,
  micOn,
  onMic,
  micFx,
  onMicFx,
  micVoice,
  onMicVoice,
  micLook,
  onMicLook,
  micHint,
  mics,
  micDeviceId,
  onMicDevice,
  midi,
  onMidi,
  onMidiInput,
  onMidiInstrument,
}: {
  kills: Record<Channel, boolean>;
  onKill: (ch: Channel) => void;
  tempoNudge: number;
  onTempo: (v: number) => void;
  perf: { key: number; filter: number; echo: number; punch: number; space: number };
  onDial: (patch: Partial<typeof perf>) => void;
  heldPad: string | null;
  onPadDown: (name: string, patch: Partial<typeof perf>) => void;
  onPadUp: () => void;
  micOn: boolean;
  onMic: () => void;
  micFx: MicFx;
  onMicFx: (patch: Partial<MicFx>) => void;
  micVoice: LiveMicVoice;
  onMicVoice: (v: LiveMicVoice) => void;
  /** The worn LOOK's id, or null once a dial has moved off it. */
  micLook: string | null;
  onMicLook: (id: string) => void;
  /** The first-open whisper's phase: fading in, dissolving, or gone. */
  micHint: "in" | "out" | null;
  /** Every named audioinput (labels exist once permission is granted). */
  mics: MicDevice[];
  /** The sticky device pick, or null for the browser default. */
  micDeviceId: string | null;
  onMicDevice: (id: string) => void;
  midi: MidiSnapshot;
  onMidi: () => void;
  /** Cycle to the next connected input (the device capsule's tap). */
  onMidiInput: () => void;
  onMidiInstrument: (s: string) => void;
}) {
  // THE MIDI KEYBOARD is a LIVE-SET instrument (this deck is the only place it
  // renders): hidden entirely unless Web MIDI is supported AND a device is
  // actually connected — no dead pill for the keyboard-less majority.
  const midiAvailable = midi.supported && midi.inputs.length > 0;
  // lit = armed AND connected; an unplug hides the section but keeps the arm,
  // so replugging mid-set brings the keyboard straight back.
  const midiOn = midi.enabled && midiAvailable;
  const midiInputName =
    midi.inputs.find((i) => i.id === midi.activeInputId)?.name ??
    midi.inputs[0]?.name ??
    "MIDI";
  // Hot-mic light + LEVEL METER, LEVEL-REACTIVE: getLiveMicLevel polled on ONE
  // slow interval, style writes straight onto the dot and the meter — no state,
  // no re-render, no rAF. The deck and the stage each run their own 6.7Hz read;
  // both are pennies. The meter is fast-attack (a syllable lands the very next
  // tick) / slow-release (it falls, not flickers), with a peak tick that holds
  // about a second — and it reads honestly: no signal, no bar (the mic-aware
  // pause keeps the context, so the analyser never freezes on a stale frame).
  const micDotRef = useRef<HTMLSpanElement | null>(null);
  const meterFillRef = useRef<HTMLDivElement | null>(null);
  const meterPeakRef = useRef<HTMLDivElement | null>(null);
  const meter = useRef({ lvl: 0, peak: 0, peakAt: 0 });
  useEffect(() => {
    if (!micOn) return;
    const id = setInterval(() => {
      const lvl = getLiveMicLevel();
      const el = micDotRef.current;
      if (el) {
        el.style.opacity = String(0.45 + 0.55 * lvl);
        el.style.boxShadow = `0 0 ${Math.round(6 + 16 * lvl)}px rgba(255,255,255,${(
          0.5 +
          0.5 * lvl
        ).toFixed(2)})`;
      }
      const s = meter.current;
      s.lvl = lvl >= s.lvl ? lvl : Math.max(lvl, s.lvl * 0.72); // attack fast, release ~1.5s
      const now = performance.now();
      if (lvl >= s.peak || now - s.peakAt > 1000) {
        s.peak = lvl;
        s.peakAt = now;
      }
      const fill = meterFillRef.current;
      if (fill)
        fill.style.clipPath = `inset(0 ${(100 - Math.min(1, s.lvl) * 100).toFixed(1)}% 0 0)`;
      const peak = meterPeakRef.current;
      if (peak) {
        peak.style.left = `calc(${(Math.min(1, s.peak) * 100).toFixed(1)}% - 2px)`;
        peak.style.opacity = s.peak > 0.02 ? "0.5" : "0";
      }
    }, 150);
    return () => {
      clearInterval(id);
      meter.current = { lvl: 0, peak: 0, peakAt: 0 };
      const el = micDotRef.current;
      if (el) {
        el.style.opacity = "";
        el.style.boxShadow = "";
      }
      const fill = meterFillRef.current;
      if (fill) fill.style.clipPath = "inset(0 100% 0 0)";
      const peak = meterPeakRef.current;
      if (peak) peak.style.opacity = "0";
    };
  }, [micOn]);
  // the device list — open/closed is display posture, local to each render site
  const [micDevOpen, setMicDevOpen] = useState(false);
  const currentMic = mics.find((m) => m.deviceId === micDeviceId) ?? mics[0] ?? null;
  return (
    <>
      {/* THE CHANNELS — three fixed kill switches, like a mixer's kill EQ. */}
      <div className="grid grid-cols-3 gap-1.5">
        {CHANNELS.map((ch) => {
          const off = kills[ch];
          return (
            <button
              key={ch}
              onClick={() => onKill(ch)}
              aria-pressed={!off}
              title={off ? `Bring the ${ch} back` : `Kill the ${ch}`}
              className={`flex h-9 items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition ${
                off
                  ? "bg-white/[0.02] text-muted/40"
                  : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition ${
                  off ? "bg-white/[0.12]" : "bg-accent-strong"
                }`}
                style={off ? undefined : { boxShadow: "0 0 10px rgba(255,99,193,0.8)" }}
              />
              {ch}
            </button>
          );
        })}
      </div>

      {/* the dials — KEY and FILTER are centre-detent (double-tap to zero) */}
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3 sm:gap-x-6">
        <DeckSlider
          label="Tempo"
          value={tempoNudge}
          min={-8}
          max={8}
          step={1}
          bipolar
          display={`${tempoNudge > 0 ? "+" : ""}${tempoNudge}%`}
          onChange={onTempo}
        />
        <DeckSlider
          label="Key"
          value={perf.key}
          min={-7}
          max={7}
          step={1}
          bipolar
          display={perf.key === 0 ? "—" : `${perf.key > 0 ? "+" : ""}${perf.key} st`}
          onChange={(v) => onDial({ key: v })}
        />
        <DeckSlider
          label="Filter"
          value={perf.filter}
          min={-100}
          max={100}
          step={2}
          bipolar
          display={filterDisplay(perf.filter)}
          onChange={(v) => onDial({ filter: v })}
        />
        <DeckSlider
          label="Echo"
          value={perf.echo}
          min={0}
          max={0.7}
          step={0.05}
          display={perf.echo === 0 ? "—" : `${Math.round((perf.echo / 0.7) * 100)}%`}
          onChange={(v) => onDial({ echo: v })}
        />
        <DeckSlider
          label="Drive"
          value={perf.punch}
          min={0}
          max={0.5}
          step={0.05}
          display={perf.punch === 0 ? "—" : `${Math.round((perf.punch / 0.5) * 100)}%`}
          onChange={(v) => onDial({ punch: v })}
        />
        <DeckSlider
          label="Space"
          value={perf.space}
          min={0}
          max={0.6}
          step={0.05}
          display={perf.space === 0 ? "—" : `${Math.round((perf.space / 0.6) * 100)}%`}
          onChange={(v) => onDial({ space: v })}
        />
      </div>

      {/* THE PADS — hold: on · release: back. Same 3-across grid as everything. */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {PADS.map((pad) => (
          <button
            key={pad.name}
            onPointerDown={() => onPadDown(pad.name, pad.patch)}
            onPointerUp={onPadUp}
            onPointerLeave={() => heldPad === pad.name && onPadUp()}
            onPointerCancel={onPadUp}
            onContextMenu={(e) => e.preventDefault()}
            title="Hold — release to snap back"
            className={`flex h-11 select-none flex-col items-center justify-center rounded-2xl transition ${
              heldPad === pad.name
                ? "bg-accent/[0.22]"
                : "bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
            style={{
              touchAction: "none",
              ...(heldPad === pad.name
                ? { boxShadow: "0 0 30px -8px rgba(224,49,156,0.8)" }
                : {}),
            }}
          >
            <span
              className={`text-[11px] font-medium tracking-[0.12em] ${
                heldPad === pad.name ? "text-accent-strong" : "text-foreground/85"
              }`}
            >
              {pad.name}
            </span>
            <span className="max-w-full overflow-hidden whitespace-nowrap px-1 text-[8px] uppercase tracking-[0.08em] text-muted/45 sm:text-[9px] sm:tracking-[0.16em]">
              hold · {pad.hint}
            </span>
          </button>
        ))}
      </div>

      {/* THE MIC — the DJ's voice, summed into the broadcast (lib/strudel-client
          enableLiveMic): talk or sing over the mix, listeners hear it on the
          same stream. Works between songs too — announcements need no music.
          THE MIDI pill sits beside it when a keyboard is connected (lib/midi-live):
          same posture, same live-over-the-mix contract. */}
      <div className="mt-3">
        <div
          className={`grid gap-1.5 ${midiAvailable ? "grid-cols-2" : "grid-cols-1"}`}
        >
        <button
          onClick={onMic}
          aria-pressed={micOn}
          title={micOn ? "Cut the mic" : "Open the mic — sing or talk over the mix"}
          className={`flex h-9 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition ${
            micOn
              ? "text-white"
              : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
          }`}
          style={micOn ? LIT_PILL : undefined}
        >
          {/* hot-mic light: glows WITH the voice (see the interval above) —
              the "this thing is LIVE, and landing" cue */}
          <span
            ref={micDotRef}
            className={`h-1.5 w-1.5 rounded-full transition ${micOn ? "bg-white" : "bg-white/[0.12]"}`}
            style={micOn ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" } : undefined}
          />
          MIC
        </button>
        {midiAvailable && (
          <button
            onClick={onMidi}
            aria-pressed={midiOn}
            title={
              midiOn
                ? "Put the keyboard down"
                : "Play your MIDI keyboard over the mix"
            }
            className={`flex h-9 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition ${
              midiOn
                ? "text-white"
                : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
            }`}
            style={midiOn ? LIT_PILL : undefined}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition ${midiOn ? "bg-white" : "bg-white/[0.12]"}`}
              style={
                midiOn
                  ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" }
                  : undefined
              }
            />
            MIDI
          </button>
        )}
        </div>
        {micOn && (
          <DeckGroup>
            {/* THE LEVEL, FIRST — you are the signal. A singer SEES the voice
                landing the moment it does: one-pink fill, fast attack / slow
                release, a peak tick that holds a breath. Style-written from
                the 150ms poll above; it reads zero the instant nothing flows. */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                ref={meterFillRef}
                className="absolute inset-0 rounded-full"
                style={{
                  clipPath: "inset(0 100% 0 0)",
                  transition: "clip-path 140ms linear",
                  backgroundImage:
                    "linear-gradient(90deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)",
                }}
              />
              <div
                ref={meterPeakRef}
                className="absolute inset-y-0 w-[2px] rounded-full bg-white"
                style={{ left: "-2px", opacity: 0, transition: "opacity 300ms ease" }}
              />
            </div>
            {/* VOICE — the five characters (lib/strudel-client setLiveMicVoice).
                The 🎧 rides the header quietly, forever — hover says why. */}
            <div>
              <DeckRowLabel
                right={
                  <span
                    title={MIC_HINT_LINE}
                    className="cursor-help text-[11px] leading-none opacity-50"
                  >
                    🎧
                  </span>
                }
              >
                Voice
              </DeckRowLabel>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
                {MIC_VOICES.map((v) => (
                  <DeckChip
                    key={v.id}
                    worn={micVoice === v.id}
                    title={v.hint}
                    onClick={() => onMicVoice(v.id)}
                  >
                    {v.name}
                  </DeckChip>
                ))}
              </div>
            </div>
            {/* LOOK — one-tap seats, the studio's names carried live. A dial
                move un-wears the look (the hands own the seat now). */}
            <div>
              <DeckRowLabel>Look</DeckRowLabel>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                {MIC_LOOKS.map((l) => (
                  <DeckChip
                    key={l.id}
                    worn={micLook === l.id}
                    onClick={() => onMicLook(l.id)}
                  >
                    {l.name}
                  </DeckChip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-5 sm:gap-x-6">
              <DeckSlider
                label="Level"
                value={micFx.level}
                min={0}
                max={1}
                step={0.05}
                display={`${Math.round(micFx.level * 100)}%`}
                onChange={(v) => onMicFx({ level: v })}
              />
              <DeckSlider
                label="Echo"
                value={micFx.echo}
                min={0}
                max={1}
                step={0.05}
                display={micFx.echo === 0 ? "—" : `${Math.round(micFx.echo * 100)}%`}
                onChange={(v) => onMicFx({ echo: v })}
              />
              <DeckSlider
                label="Space"
                value={micFx.space}
                min={0}
                max={1}
                step={0.05}
                display={micFx.space === 0 ? "—" : `${Math.round(micFx.space * 100)}%`}
                onChange={(v) => onMicFx({ space: v })}
              />
            </div>
            {/* THE DEVICE — which mic is live, the studio's quiet capsule
                carried onto the deck; tap for the machined list, the pick
                sticks and a live swap crossfades (lib setLiveMicDevice). */}
            {currentMic && (
              <div>
                <button
                  onClick={() => setMicDevOpen((o) => !o)}
                  aria-expanded={micDevOpen}
                  aria-haspopup="listbox"
                  title="Choose the microphone"
                  className="flex h-7 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted/70 transition hover:bg-white/[0.08]"
                >
                  <span className="max-w-full truncate">
                    {cleanMicLabel(currentMic.label)}
                  </span>
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className={`shrink-0 opacity-60 transition-transform duration-200 ${
                      micDevOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {micDevOpen && (
                  <div
                    role="listbox"
                    aria-label="Microphone"
                    className="mt-1.5 overflow-hidden rounded-2xl border border-white/[0.09] bg-black/40 backdrop-blur"
                  >
                    {mics.map((m, i) => {
                      const active = m.deviceId === currentMic.deviceId;
                      return (
                        <button
                          key={m.deviceId || i}
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setMicDevOpen(false);
                            onMicDevice(m.deviceId);
                          }}
                          className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[11px] transition active:scale-[.99] ${
                            i > 0 ? "border-t border-white/[0.06]" : ""
                          } ${
                            active
                              ? "bg-accent/[0.1] text-accent-strong"
                              : "text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {cleanMicLabel(m.label)}
                          </span>
                          {active && (
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                              className="shrink-0"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* the one whisper — first open only, ~8s, then it dissolves */}
            {micHint && (
              <p
                className={`animate-fade-in text-center text-[11px] text-muted/50 transition-opacity duration-700 ${
                  micHint === "out" ? "opacity-0" : "opacity-100"
                }`}
              >
                {MIC_HINT_LINE}
              </p>
            )}
          </DeckGroup>
        )}
        {midiOn && (
          <DeckGroup>
            {/* SOUND — six curated voices, one tap each (names verified
                against the GM manifest; see lib/midi-live). Same anatomy as
                the mic's world above: label, chips, quiet device footer. */}
            <div>
              <DeckRowLabel>Sound</DeckRowLabel>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                {MIDI_INSTRUMENTS.map((inst) => (
                  <DeckChip
                    key={inst.s}
                    worn={midi.instrument.s === inst.s}
                    title={inst.hint}
                    onClick={() => onMidiInstrument(inst.s)}
                  >
                    {inst.name}
                  </DeckChip>
                ))}
              </div>
            </div>
            {/* the device: which keyboard is live — tap cycles when several
                are plugged in (hot-plug keeps this honest, lib/midi-live) */}
            <button
              onClick={onMidiInput}
              disabled={midi.inputs.length < 2}
              title={
                midi.inputs.length > 1
                  ? "Switch MIDI input"
                  : "The connected MIDI input"
              }
              className="flex h-7 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted/70 transition enabled:hover:bg-white/[0.08] disabled:cursor-default"
            >
              <span className="max-w-full truncate">{midiInputName}</span>
              {midi.inputs.length > 1 && (
                <span className="shrink-0 text-muted/40">⇄</span>
              )}
            </button>
          </DeckGroup>
        )}
      </div>
    </>
  );
}

/** THE PULL — one gesture for every glass sheet. The surface follows the
 *  finger while it's down (pointer capture, so mouse and touch are the same
 *  hand), release snaps to the nearest detent with the throw's velocity
 *  carried in, and the ends are elastic. A still press stays a TAP — the
 *  native click passes through; guard click handlers with didDrag() so a
 *  released drag never double-fires as a toggle. */
function usePullSheet({
  resting,
  detents,
  onSnap,
}: {
  /** The current resting pull-down offset in px, read at gesture start. */
  resting: () => number;
  /** Ascending snap offsets in px, measured fresh at gesture start. */
  detents: () => number[];
  onSnap: (index: number) => void;
}) {
  const [dragOff, setDragOff] = useState<number | null>(null);
  const gesture = useRef<{
    y0: number;
    off0: number;
    dets: number[];
    lastY: number;
    lastT: number;
    v: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);

  const settle = () => {
    const s = gesture.current;
    gesture.current = null;
    if (!s) return;
    setDragOff(null);
    if (!s.moved) return; // a tap — the element's own click handles it
    draggedRef.current = true;
    const lo = s.dets[0];
    const hi = s.dets[s.dets.length - 1];
    const off = Math.min(hi, Math.max(lo, s.off0 + (s.lastY - s.y0)));
    const projected = off + s.v * 180; // carry the throw ~180ms forward
    let best = 0;
    for (let i = 1; i < s.dets.length; i++)
      if (Math.abs(s.dets[i] - projected) < Math.abs(s.dets[best] - projected))
        best = i;
    onSnap(best);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // a fresh press clears any unconsumed drag flag (a cancelled drag fires
      // no click, so nothing would ever read it — and it must not eat this tap)
      draggedRef.current = false;
      gesture.current = {
        y0: e.clientY,
        off0: resting(),
        dets: detents(),
        lastY: e.clientY,
        lastT: performance.now(),
        v: 0,
        moved: false,
      };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* a pointer that's already gone can't be captured — the drag still works */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = gesture.current;
      if (!s) return;
      const dy = e.clientY - s.y0;
      if (!s.moved && Math.abs(dy) < 6) return; // still a tap
      s.moved = true;
      const now = performance.now();
      const dt = now - s.lastT;
      if (dt > 0) s.v = (e.clientY - s.lastY) / dt;
      s.lastY = e.clientY;
      s.lastT = now;
      const lo = s.dets[0];
      const hi = s.dets[s.dets.length - 1];
      let off = s.off0 + dy;
      if (off < lo) off = lo - Math.pow(lo - off, 0.72); // elastic past the ends
      else if (off > hi) off = hi + Math.pow(off - hi, 0.72);
      setDragOff(off);
    },
    onPointerUp: settle,
    onPointerCancel: settle,
  };

  /** True exactly once after a drag — lets onClick ignore the synthetic click
   *  that the browser fires after a released drag. */
  const didDrag = () => {
    const d = draggedRef.current;
    draggedRef.current = false;
    return d;
  };

  return { dragOff, dragging: dragOff !== null, handlers, didDrag };
}

export default function SetClient({
  setId,
  initialSet,
  initialSongs,
}: {
  setId: string;
  initialSet: SetRow;
  initialSongs: SongBundle[];
}) {
  // Code arrives SEALED from the server (lib/seal.ts) — open it on entry;
  // openDeep is pass-through for anything unsealed, so this is always safe.
  const plan = openDeep(
    (initialSet.plan ?? {}) as {
      entries?: SetEntry[];
      transitions?: Record<string, SetTransition>;
    },
  );
  const [title, setTitle] = useState(initialSet.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [entries, setEntries] = useState<SetEntry[]>(plan.entries ?? []);
  const [transitions, setTransitions] = useState<Record<string, SetTransition>>(
    plan.transitions ?? {},
  );
  const [songs, setSongs] = useState<Record<string, SongBundle>>(() =>
    Object.fromEntries(openDeep(initialSongs).map((b) => [b.song.id, b])),
  );
  const [error, setError] = useState<string | null>(null);

  // Everything works on a phone now (2026-07-07): playing the set on-device AND
  // going live — a phone can capture its own audio + the Hydra canvas and publish
  // both to the SFU just like a laptop. So there's no mobile gate at all anymore.
  const isMobile = useIsMobile();

  // --- playback state ---------------------------------------------------------
  const [playing, setPlaying] = useState<string | null>(null); // section id
  // PAUSED is the APP's answer, not this page's: the engine pauses itself on a
  // backgrounded phone and the OS lock screen pauses it too, and a local copy
  // drifted (the deck sat showing ❚❚ over silence). A PRIMITIVE selector, so the
  // per-section label tick can't re-render the deck.
  const paused = useNowPlayingValue(
    (s) => isOwnSession(s, "set", setId) && !!s?.paused,
    false,
  );
  /** THIS set's performance is the music the app is carrying. */
  const owns = useNowPlayingValue((s) => isOwnSession(s, "set", setId), false);
  const [mixActive, setMixActive] = useState(false);

  // --- LIVE performance state — refs so decorate() reads the current values ---
  const [tempoNudge, setTempoNudge] = useState(0); // percent, −8..+8
  // The performance dials: key (±7 st), filter (bipolar LP/HP), echo, drive, space.
  const [perf, setPerf] = useState({ ...PERF_ZERO });
  // The three fixed channel kills — set-wide, they outlive every section change.
  const [kills, setKills] = useState<Record<Channel, boolean>>({
    drums: false,
    bass: false,
    melody: false,
  });
  // THE MIC — the DJ's voice over the mix. Hardware capture is DJ-LOCAL (it
  // never rides the deck snapshot listeners mirror — they hear the voice in
  // the broadcast audio itself); the fx are plain 0..1 dial positions, the
  // Web Audio ranges live in lib/strudel-client.
  const [micOn, setMicOn] = useState(false);
  // The worn VOICE character — display state only, the graph lives in
  // lib/strudel-client (setLiveMicVoice). Resets to natural with the mic:
  // a character must never ambush the NEXT open.
  const [micVoice, setMicVoiceState] = useState<LiveMicVoice>("natural");
  // level 0.7 ≈ unity after the lib's ×1.5 headroom scale — the voice sits ON
  // the mix by default, with room to push it over for announcements.
  // Defaults reviewed (quality pass): echo 0 is right — a delay tail on by
  // default would smear talk-over, and singing DJs dial it in deliberately;
  // space 0.15 gives just enough room that the dry mic doesn't sit bone-dry
  // in FRONT of a wet mix. Drive/glow 0: colour is a choice, never a default
  // (and at 0 their stages are never even built — lib/strudel-client).
  const [micFx, setMicFx] = useState<MicFx>({
    level: 0.7,
    echo: 0,
    space: 0.15,
    drive: 0,
    glow: 0,
  });
  // The worn LOOK — display state; the fx values above are the truth. Null
  // once a dial moves off it (the studio's activeLook contract).
  const [micLook, setMicLook] = useState<string | null>(null);
  // THE HEADPHONES WHISPER — a two-phase fade ("in" ~8s, "out" ~0.7s, gone);
  // armed once per browser, ever (MIC_HINT_KEY).
  const [micHint, setMicHint] = useState<"in" | "out" | null>(null);
  useEffect(() => {
    if (!micHint) return;
    const t = setTimeout(
      () => setMicHint(micHint === "in" ? "out" : null),
      micHint === "in" ? 8000 : 700,
    );
    return () => clearTimeout(t);
  }, [micHint]);
  // THE MIC DEVICE — every named audioinput (labels exist only once permission
  // is granted, i.e. once the mic has been opened) and the DJ's sticky pick.
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(MIC_DEVICE_KEY);
    } catch {
      return null;
    }
  });
  const micDeviceRef = useRef(micDeviceId);
  micDeviceRef.current = micDeviceId;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;
  const refreshMics = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const named = all.filter((d) => d.kind === "audioinput" && d.label);
      // Chrome aliases the system default as extra "default"/"communications"
      // rows — drop them when the real devices are listed too.
      const real = named.filter(
        (d) => d.deviceId !== "default" && d.deviceId !== "communications",
      );
      const list = (real.length ? real : named).map((d) => ({
        deviceId: d.deviceId,
        label: d.label,
      }));
      setMics(list);
      // the picked device vanished mid-set → glide to the default, stay live
      // (the pick stays saved: replugging brings it back on the next open)
      if (
        micOnRef.current &&
        micDeviceRef.current &&
        list.length > 0 &&
        !list.some((m) => m.deviceId === micDeviceRef.current)
      ) {
        void setLiveMicDevice(null);
      }
    } catch {
      /* no device API — the capsule just never appears */
    }
  }, []);
  useEffect(() => {
    if (!micOn) return; // an open mic = permission granted = labels exist
    void refreshMics();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshMics();
    md.addEventListener("devicechange", onChange); // plug/unplug refreshes
    return () => md.removeEventListener("devicechange", onChange);
  }, [micOn, refreshMics]);
  // THE TAKE — REC tapes the broadcast tap (lib/live-record: music + voice +
  // keys, exactly what listeners hear); the pill only exists while the door
  // is open. Display state here, the recorder itself lives in the module.
  const [recOn, setRecOn] = useState(false);
  useEffect(() => {
    if (!recOn) return;
    // honesty poll: if the recorder died underneath (track ended, encoder
    // error — it downloads what it had), the pill must follow, not lie
    const id = setInterval(() => {
      if (!liveRecordingState().recording) setRecOn(false);
    }, 1000);
    return () => clearInterval(id);
  }, [recOn]);
  // REC's elapsed mm:ss — the module owns the take (lib/live-record); this is
  // just the clock face, one lazy tick a second while it rolls.
  const [recSec, setRecSec] = useState(0);
  useEffect(() => {
    if (!recOn) {
      setRecSec(0);
      return;
    }
    const tick = () => {
      const { startedAt } = liveRecordingState();
      setRecSec(startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [recOn]);
  // THE MIDI KEYBOARD — live-set-only hardware instrument (lib/midi-live):
  // note-ons fire one-off engine voices on the master, so the room and every
  // stream listener hear them alike. This is a mirror of the module's state;
  // the module owns the Web MIDI wiring (hot-plug included).
  const [midi, setMidi] = useState<MidiSnapshot>(() => midiState());
  // LOOP is a MODE, not a per-section latch: while on, whatever is playing
  // keeps playing. It stays exactly as you set it until YOU change it.
  const [holdMode, setHoldMode] = useState(false);
  // PERFORM: the fullscreen stage — just the music, what's next, and the
  // instrument. The visuals lift to full opacity behind it (body.immersive).
  const [performMode, setPerformMode] = useState(false);
  // On stage, a tap on the open light hides the controls (just the visuals,
  // breathing); any tap brings them back. The video-player idiom, glass-clean.
  // And the glass is a sheet too: the SAME pull as the deck — grab the handle
  // or the header, ride it down, flick it away.
  const [stageControls, setStageControls] = useState(true);
  const stageClusterRef = useRef<HTMLDivElement | null>(null);
  // the glass cluster's height, kept in state so render never reads a ref —
  // ResizeObserver delivers the initial size on observe, then follows it
  const [stageClusterH, setStageClusterH] = useState(320);
  useEffect(() => {
    if (!performMode) return;
    const el = stageClusterRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageClusterH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [performMode, mixActive]);
  const stageTravel = stageClusterH + 24;
  const stagePull = usePullSheet({
    resting: () => 0, // pulls only start while the glass is up
    detents: () => [0, stageTravel],
    onSnap: (i) => setStageControls(i === 0),
  });
  const stageOff = stagePull.dragOff;
  const stageDragging = stageOff !== null;
  // The deck is a SHEET with three detents — OPEN (the whole instrument),
  // FOLDED (just the header strip), HIDDEN (off-screen; a small pill stays so
  // one tap brings it back). You PULL it — finger or mouse, on the handle or
  // the header — and it follows; a released throw snaps with its velocity, so
  // a gentle pull folds and a hard flick dismisses. Taps still toggle.
  const [deckStage, setDeckStage] = useState<"open" | "folded" | "hidden">(
    "open",
  );
  const deckWrapRef = useRef<HTMLDivElement | null>(null);
  const deckBodyRef = useRef<HTMLDivElement | null>(null);
  const [deckBodyH, setDeckBodyH] = useState(0);
  useEffect(() => {
    const el = deckBodyRef.current;
    if (!el) return;
    const measure = () => setDeckBodyH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mixActive]);
  /** Travel past the fold that clears the screen: the folded strip's own
   *  height (wrapper padding included) plus a little air. */
  const deckHideTravel = () => {
    const wrap = deckWrapRef.current;
    if (!wrap) return 240;
    const bodyNow = deckStage === "open" ? deckBodyH : 0;
    return wrap.offsetHeight - bodyNow + 16;
  };
  const deckPull = usePullSheet({
    resting: () =>
      deckStage === "open"
        ? 0
        : deckStage === "folded"
          ? deckBodyH
          : deckBodyH + deckHideTravel(),
    detents: () => [0, deckBodyH, deckBodyH + deckHideTravel()],
    onSnap: (i) =>
      setDeckStage(i === 0 ? "open" : i === 1 ? "folded" : "hidden"),
  });
  const deckOff = deckPull.dragOff;
  const deckDragging = deckOff !== null;
  // The three rendered strands of one gesture: the body's height (open↔folded),
  // the whole sheet's shift (folded↔hidden), and the body's opacity riding the
  // fold. Mid-drag they're the finger, verbatim; at rest they're the detent.
  const deckBodyHeight: number | string = deckDragging
    ? Math.max(0, Math.min(deckBodyH, deckBodyH - (deckOff as number)))
    : deckStage === "open"
      ? deckBodyH || "auto"
      : 0;
  const deckShift = deckDragging
    ? `translateY(${Math.max(0, (deckOff as number) - deckBodyH)}px)`
    : deckStage === "hidden"
      ? "translateY(calc(100% + 24px))"
      : "translateY(0px)";
  const deckBodyOpacity = deckDragging
    ? Math.max(0, Math.min(1, (deckBodyH - (deckOff as number)) / Math.max(1, deckBodyH)))
    : deckStage === "open"
      ? 1
      : 0;
  const toggleDeckFold = () =>
    setDeckStage((s) => (s === "open" ? "folded" : "open"));
  useEffect(() => {
    document.body.classList.toggle("immersive", performMode);
    return () => document.body.classList.remove("immersive");
  }, [performMode]);
  useEffect(() => {
    if (!performMode) return;
    setStageControls(true); // every entrance starts with the controls up
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPerformMode(false);
    };
    // The browser CONSUMES Escape to leave native fullscreen — the keydown
    // above never fires for that press, and the stage used to stay up until a
    // second Escape. Syncing to fullscreenchange (like the song page) makes
    // the FIRST Escape drop the whole stage. webkit prefix = older Safari.
    const onFs = () => {
      if (!document.fullscreenElement) setPerformMode(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [performMode]);

  // Which performance pad is held (styling + release bookkeeping).
  const [heldPad, setHeldPad] = useState<string | null>(null);
  const padRestoreRef = useRef<Partial<{
    key: number; filter: number; echo: number; punch: number; space: number;
  }> | null>(null);
  const jumpingRef = useRef(false); // one NEXT at a time — a fade mustn't stack

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const transitionsRef = useRef(transitions);
  transitionsRef.current = transitions;
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const nudgeRef = useRef(tempoNudge);
  nudgeRef.current = tempoNudge;
  const perfRef = useRef(perf);
  perfRef.current = perf;
  // Debounce the ONE deck control that re-evaluates (KEY) on mobile — see `dial`.
  const dialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const killsRef = useRef(kills);
  killsRef.current = kills;
  const holdRef = useRef(holdMode);
  holdRef.current = holdMode;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const lastPlayedRef = useRef<string | null>(null);
  // Loops elapsed in the CURRENT section — the counter behind the saved repeat
  // latches (reset on every fresh section entry, exactly like the song page).
  const holdPlaysRef = useRef(0);

  /** The live ctx the shared set-live helpers read — always the CURRENT refs,
   *  so sections/labels/hold targets track every mid-play edit. */
  const liveCtx = (): SetLiveCtx => ({
    entries: entriesRef.current,
    songs: songsRef.current,
    transitions: transitionsRef.current,
  });

  /** The saved repeat target for a section id (`entry|part`, `entry|break:part`,
   *  `entry|~`) — read live from the song's plan so it's always the arrangement
   *  the user last saved on the song page. */
  const holdTargetFor = (id: string): number => sectionHoldTarget(id, liveCtx());

  // EXACT loop length per part, measured from the real pattern — the same truth
  // the song page plays by. Until measured, buildSetSections falls back to the
  // regex estimate (computeLoopBars), which over-counts loops with repeating
  // slowcat elements — the set held every loop past its real period, playing a
  // 54-second song out past two minutes.
  const [measuredBars, setMeasuredBars] = useState<Record<string, number>>({});
  const measuredBarsRef = useRef(measuredBars);
  measuredBarsRef.current = measuredBars;
  const barsForPart = (part: PartRow): number | undefined =>
    measuredBarsRef.current[`${part.id}:${(part.strudel || "").length}`];
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const b of Object.values(songsRef.current)) {
        for (const p of b?.parts ?? []) {
          const code = p.strudel;
          if (!code?.trim()) continue;
          const key = `${p.id}:${code.length}`;
          if (measuredBarsRef.current[key]) continue;
          const n = await loopCycles(code);
          if (cancelled) return;
          if (n && n > 0) setMeasuredBars((m) => (m[key] ? m : { ...m, [key]: n }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songs]);

  // The kill gains, pushed straight onto the orbit buses (instant — see
  // lib/set-live.ts). Orbits outside our decades are left untouched.
  const killGainFor = (orbit: number): number | undefined => {
    const ch = channelOfOrbit(orbit);
    return ch ? (killsRef.current[ch] ? 0 : 1) : undefined;
  };
  const releaseAllKills = () =>
    applyOrbitGains((orbit) => (channelOfOrbit(orbit) ? 1 : undefined));

  useEffect(() => {
    warmEngine();
    return () => {
      // Leaving mid-performance: the SET COMES WITH YOU — the sequencer keeps
      // driving it, the deck's exact posture (kills, dials, nudge, loop mode)
      // is stashed on the session so returning restores what the audio is
      // ALREADY wearing, and the dock carries the transport meanwhile.
      const np = nowPlaying();
      if (!np || !isSongPlaying()) {
        // Nothing is sounding — leave the engine and the buses clean.
        stop();
        releaseAllKills(); // never leave a dead bus behind for the song page
        clearNowPlaying();
      } else if (np.kind === "set" && np.id === setId) {
        // OUR performance: it comes with you, deck posture stashed on the session.
        updateNowPlaying({
          surfaceMounted: false,
          deck: {
            kills: { ...killsRef.current },
            perf: { ...perfRef.current },
            tempoNudge: nudgeRef.current,
            holdMode: holdRef.current,
          },
        });
      }
      // else: someone else's music is riding along in the dock — this page never
      // started it, so it is not ours to stop.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SPACE = the transport, like every instrument since the tape deck: start
  // the set, pause it, resume it. Never while typing. Routed through a ref so
  // the listener (mounted once) always calls the CURRENT closure, not the
  // first render's (which would forever see mixActive=false and restart).
  const onPlaySetRef = useRef<() => Promise<void>>(async () => {});
  onPlaySetRef.current = onPlaySet; // refreshed every render (fn decls hoist)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return;
      // Someone ELSE'S music is riding the dock — the DOCK owns the spacebar then,
      // or one press pauses their music AND starts this set.
      const np = nowPlaying();
      if (np && !(np.kind === "set" && np.id === setId)) return;
      e.preventDefault();
      void onPlaySetRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ENFORCE the kill gains while the set plays: orbit buses are created lazily
  // (first hap on a new bus), so a freshly-entered section needs its channel
  // gains re-asserted. applyOrbitGains skips buses already at target, so this
  // is a no-op ~5×/second — reliability for free.
  useEffect(() => {
    if (!mixActive) return;
    const t = setInterval(() => applyOrbitGains(killGainFor), 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixActive]);

  // --- the flat section list ----------------------------------------------------
  // RAW code here; decorate() applies every transform (per-song plan + live dials)
  // at the moment each section starts, so mid-play tweaks always win. ONE shared
  // builder (lib/set-live.ts) — the sets-page player sequences the same list.
  function buildFlat(): FlatSection[] {
    return buildSetSections(liveCtx(), barsForPart);
  }

  /** Every live transform, applied fresh as a section starts (and on hot-swaps).
   *  ONE shared implementation (lib/set-live.ts) — listeners on a live link run
   *  the exact same decorate, so every device plays the same performance. */
  function decorate(code: string, id: string): string {
    // KEY rides the code (it re-pitches notes); every OTHER perf dial lives on
    // the master FX chain (setLivePerf) — baking them here too would apply
    // them twice AND make every dial move recompile the arrangement (the
    // main-thread freeze that silenced phones mid-performance).
    return decorateSetSection(code, id, liveCtx(), {
      nudge: nudgeRef.current,
      perf: { ...PERF_ZERO, key: perfRef.current.key },
    });
  }

  /** Hot-swap the playing section with freshly-decorated code — how a dial/mute
   *  lands mid-loop (next cycle boundary) instead of waiting for the section. */
  function applyLiveNow() {
    const id = playingRef.current;
    if (!id || pausedRef.current) return;
    const sec = buildFlat().find((s) => s.id === id);
    if (sec) void liveUpdate(decorate(sec.code, id));
  }

  const buildRotated = (anchor: string) => {
    const secs = buildFlat();
    const at = secs.findIndex((s) => s.id === anchor);
    return at > 0 ? [...secs.slice(at), ...secs.slice(0, at)] : secs;
  };

  /** What the dock whispers for a set section: the song's name (breaks and
   *  hand-offs wear their ≋). */
  const sectionLabelOf = (id: string | null): string | null =>
    setSectionLabel(id, liveCtx());

  // The set's callback set over THIS instance's live refs — used by a fresh
  // start AND by adoption (rebindSong) when the page remounts mid-performance.
  const setPlayOpts = (sectionId: string) => ({
    // THIS set owns the program — same-owner replays crossfade, another
    // session's music gets cut at the tap.
    owner: setId,
    sectionsFor: () => buildRotated(lastPlayedRef.current ?? sectionId),
    onSection: (id: string | null) => {
      lastPlayedRef.current = id ?? lastPlayedRef.current;
      holdPlaysRef.current = 0; // fresh section → restart its repeat count
      // cycle 0 of this section — stamped on the server clock, at the
      // AUDIBLE moment (this device's output latency added: a DJ on a
      // Bluetooth speaker sounds 150–300ms after the engine). Listeners
      // lead by their own output latency, so what locks across the room
      // is what everyone HEARS.
      sectionStartedAtRef.current =
        Date.now() + clockRef.current.offset() + outputLatencyMs();
      setPlaying(id);
      updateNowPlaying({ sectionLabel: sectionLabelOf(id) });
    },
    decorate: (c: string, id: string) => decorate(c, id),
    // HOLD is a pure LEVEL, polled at any frequency (the arrangement watcher
    // reads it ~5×/s — no counting here!): the deck's LOOP mode pins whatever
    // is playing; a saved ∞ latch pins its section until a jump.
    holdSection: (id: string) => holdRef.current || holdTargetFor(id) === Infinity,
    // FINITE saved repeats (2×/4×/8×) bake into the pattern as extra cycles —
    // they play natively, no re-eval, and listeners derive the same timeline.
    repeatsFor: (id: string) => {
      const target = holdTargetFor(id);
      return Number.isFinite(target) ? target : 1;
    },
    secondsFor: (id: string) => {
      const sec = buildFlat().find((s) => s.id === id)?.seconds;
      if (sec == null) return undefined;
      return sec / (1 + nudgeRef.current / 100); // live tempo → live boundary
    },
    // decorateSetSection already bused every layer onto its channel's kill
    // decade (drums 10–19 · bass 20–29 · melody 30–39) — the arrangement's
    // global re-bus would fold them back onto 1..n and the deck's three kills
    // would gate buses nothing plays on (the dead-kills bug).
    keepOrbits: true,
  });

  async function startFrom(sectionId: string) {
    // playing is allowed on mobile now (on-device); only go-live is desktop-only.
    const rotated = buildRotated(sectionId);
    if (rotated.length === 0) return;
    setMixActive(true);
    // (no setPaused — publishNowPlaying below carries `paused: false`, and that
    // descriptor IS the paused state now.)
    setDeckStage("open"); // every performance starts with the instrument up
    lastPlayedRef.current = sectionId;
    // Screen-off survival: become a real media player (lock screen included).
    void enableBackgroundPlayback({ title });
    // The performance belongs to the APP — the dock carries it anywhere.
    publishNowPlaying({
      kind: "set",
      id: setId,
      href: `/set/${setId}`,
      title,
      sectionLabel: sectionLabelOf(sectionId),
      paused: false,
      surfaceMounted: true,
    });
    try {
      await playSong(rotated, setPlayOpts(sectionId));
      ensurePerfFx(); // master dial chain — spliced once, post-limiter
    } catch (e) {
      setError("Audio engine failed to start.");
      console.error(e);
    }
  }

  // ADOPTION — the page reopened while ITS OWN set is still sounding: re-own it
  // in place (state + deck posture restored to what the audio already wears)
  // and rebind the sequencer's callbacks to this instance. Audio never blinks.
  useEffect(() => {
    const np = nowPlaying();
    if (!np || np.kind !== "set" || np.id !== setId) return;
    if (!isSongPlaying()) {
      // OUR session, but the engine is dead — a ghost. Clear it, or the dock floats
      // over the very page that owns it, wearing a transport that drives nothing.
      clearNowPlaying();
      return;
    }
    const cur = currentSectionId();
    setMixActive(true);
    setPlaying(cur);
    setDeckStage("open");
    if (cur) lastPlayedRef.current = cur;
    const deck = np.deck as DeckSnapshot | undefined;
    if (deck) {
      setKills(deck.kills as Record<Channel, boolean>);
      killsRef.current = deck.kills as Record<Channel, boolean>;
      setPerf(deck.perf as unknown as typeof PERF_ZERO);
      perfRef.current = deck.perf as unknown as typeof PERF_ZERO;
      setTempoNudge(deck.tempoNudge);
      nudgeRef.current = deck.tempoNudge;
      setHoldMode(deck.holdMode);
      holdRef.current = deck.holdMode;
    }
    rebindSong(setPlayOpts(cur ?? (buildFlat()[0]?.id ?? "")));
    ensurePerfFx(); // adoption mid-performance — the chain may not exist yet
    updateNowPlaying({ surfaceMounted: true, deck: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LET GO. The session can end without this page touching it — the OS lock
  // screen's stop, a song taking the engine. The lit card and its ❚❚ must go dark,
  // or the deck keeps claiming to perform music that isn't there.
  useEffect(() => {
    if (owns) return;
    setPlaying((p) => (p === null ? p : null));
    setMixActive((m) => (m ? false : m));
  }, [owns]);

  function firstSectionOf(entryId: string): FlatSection | undefined {
    return buildFlat().find((s) => s.entryId === entryId && !s.isBreak);
  }

  /** EVERY jump while music plays goes under the master fader dip — tapping a
   *  song card mid-set is a mix move, never a restart. (There is no NEXT
   *  button: the next song IS its card, and how a boundary lands is chosen on
   *  the arrangement — the ✦ node between songs — exactly like a song's own
   *  breaks between loops.) */
  async function smoothJump(sectionId: string) {
    if (jumpingRef.current) return;
    jumpingRef.current = true;
    try {
      if (mixActive && !pausedRef.current) {
        fadeMaster(0.08, 0.5);
        await new Promise((r) => setTimeout(r, 510));
      }
      await startFrom(sectionId);
    } finally {
      jumpingRef.current = false;
    }
  }

  async function onPlaySet() {
    if (mixActive) {
      if (!paused) {
        pausePlayback();
        updateNowPlaying({ paused: true });
      } else {
        await resumePlayback();
        updateNowPlaying({ paused: false });
        applyLiveNow(); // pick up anything tweaked while paused
      }
      return;
    }
    const first = buildFlat()[0];
    if (first) await startFrom(first.id);
  }

  /** The perform stage's GO NEXT: honour the boundary. An armed hand-off IS
   *  the transition — jump straight into it (it eases, then the next song
   *  lands); with none, ride the master fader dip into the next song. */
  async function goNext() {
    if (jumpingRef.current) return;
    const cur = playingRef.current;
    if (!cur) return;
    const es = entriesRef.current;
    const at = es.findIndex((e) => e.id === sectionEntryId(cur));
    if (at < 0 || es.length < 2) return;
    const t = transitionsRef.current[es[at].id];
    const armed = t && t.chosen != null && !cur.endsWith(`|${TRANSITION}`);
    if (armed) {
      const target = buildFlat().find((s) => s.id === `${es[at].id}|${TRANSITION}`);
      if (target) {
        jumpingRef.current = true;
        try {
          await startFrom(target.id);
        } finally {
          jumpingRef.current = false;
        }
        return;
      }
    }
    const first = firstSectionOf(es[(at + 1) % es.length].id);
    if (first) await smoothJump(first.id);
  }

  // There is deliberately NO stop button here: a set pauses, like any
  // instrument — and leaving the page no longer ends it either (the music
  // rides along; the dock's ✕ is the one true stop).

  // --- persistence --------------------------------------------------------------
  async function persistEntries(next: SetEntry[]) {
    // Prune hand-offs whose PAIR changed (composed for specific neighbours) —
    // mirrors the server's setSetEntries, so UI and truth never disagree.
    const nextOf = (list: SetEntry[]) => {
      const m = new Map<string, string>();
      if (list.length > 1)
        list.forEach((e, i) => m.set(e.id, list[(i + 1) % list.length].id));
      return m;
    };
    const oldNext = nextOf(entriesRef.current);
    const newNext = nextOf(next);
    setEntries(next);
    setTransitions((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(
          ([k]) => newNext.has(k) && oldNext.get(k) === newNext.get(k),
        ),
      ),
    );
    try {
      await fetch(`/api/sets/${setId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: next }),
      });
    } catch {
      setError("Couldn’t save the arrangement — check your connection.");
    }
  }

  function moveEntry(i: number, dir: -1 | 1) {
    const next = [...entries];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void persistEntries(next);
  }

  function removeEntry(i: number) {
    void persistEntries(entries.filter((_, x) => x !== i));
  }

  async function saveTitle() {
    setEditingTitle(false);
    const t = title.trim() || "untitled set";
    setTitle(t);
    await fetch(`/api/sets/${setId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: t }),
    }).catch(() => {});
  }

  // --- the live door: an expiring public link listeners follow ---------------------
  const [liveLink, setLiveLink] = useState<{ token: string; expiresAt: string } | null>(
    null,
  );
  const liveLinkRef = useRef(liveLink);
  liveLinkRef.current = liveLink;
  const [copied, setCopied] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  // The broadcast outlives the tab: a reloaded page asks whether it's still on
  // air, so the chip never lies about a door that's open.
  useEffect(() => {
    fetch(`/api/sets/${setId}/live`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { token?: string | null; expiresAt?: string } | null) => {
        if (j?.token && j.expiresAt)
          setLiveLink({ token: j.token, expiresAt: j.expiresAt });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ending the broadcast cuts every listener off — so "end" ARMS first
  // (one breath to be sure), and only a second press actually closes the door.
  const [endArmed, setEndArmed] = useState(false);
  const endArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onEndPress() {
    if (!endArmed) {
      setEndArmed(true);
      if (endArmTimer.current) clearTimeout(endArmTimer.current);
      endArmTimer.current = setTimeout(() => setEndArmed(false), 3000);
      return;
    }
    if (endArmTimer.current) clearTimeout(endArmTimer.current);
    setEndArmed(false);
    void closeInvite();
  }

  async function openInvite() {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const r = await fetch(`/api/sets/${setId}/live`, { method: "POST" });
      const j = (await r.json()) as { token?: string; expiresAt?: string };
      if (r.ok && j.token && j.expiresAt)
        setLiveLink({ token: j.token, expiresAt: j.expiresAt });
    } catch {
      setError("Couldn’t open the live link.");
    } finally {
      setInviteBusy(false);
    }
  }
  async function closeInvite() {
    setLiveLink(null);
    await fetch(`/api/sets/${setId}/live`, { method: "DELETE" }).catch(() => {});
  }
  function copyInvite() {
    if (!liveLink) return;
    navigator.clipboard
      .writeText(`${location.origin}/live/${liveLink.token}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }

  // PUBLISH the performance while a link is open: debounced on every gesture,
  // plus a 3s heartbeat — a listener joining mid-set gets the current picture.
  // Section starts are stamped on the SERVER clock (offset estimated from
  // response timestamps) so listeners can seek to the DJ's phase.
  const clockRef = useRef(makeClockSync()); // serverNow − localNow, best-RTT sample
  const sectionStartedAtRef = useRef<number | null>(null);
  // The live BROADCAST: the DJ's computer publishes the rendered mix to the
  // Cloudflare Realtime SFU, and every state publish carries where to find it
  // so listeners just play the stream (no per-phone engine).
  const broadcastRef = useRef<Broadcast | null>(null);
  const broadcastBusyRef = useRef(false);
  const [broadcastEpoch, setBroadcastEpoch] = useState(0); // bump → re-publish
  const publishState = () => {
    const link = liveLinkRef.current;
    if (!link) return;
    const b = broadcastRef.current;
    const t0 = Date.now();
    fetch(`/api/live/${link.token}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: {
          sectionId: playingRef.current,
          paused: pausedRef.current,
          nudge: nudgeRef.current,
          perf: perfRef.current,
          kills: killsRef.current,
          at: Date.now() + clockRef.current.offset(),
          sectionStartedAt: sectionStartedAtRef.current ?? undefined,
          broadcast: b
            ? { session: b.sessionId, audio: b.audioTrack }
            : undefined,
        },
      }),
    })
      .then((r) => r.json())
      .then((j: { now?: number }) => {
        if (typeof j.now === "number") clockRef.current.sample(t0, j.now, Date.now());
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (!liveLink) return;
    const t = setTimeout(publishState, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLink, playing, paused, tempoNudge, perf, kills]);
  useEffect(() => {
    if (!liveLink) return;
    const t = setInterval(publishState, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLink]);
  // ESTABLISH THE BROADCAST once we're live AND sounding: tap the mix and
  // publish it to the SFU. One-shot per go-live; a fresh publishState then
  // carries the session so listeners can subscribe. Torn down on end/unmount.
  // AUDIO ONLY — the VISUALS are rendered natively on each listener (they run the
  // DJ's Hydra locally, synced to the streamed sound; see lib/hydra-live), so we
  // never ship video frames: full quality, no bandwidth, nothing to glitch.
  useEffect(() => {
    if (!liveLink || !mixActive || broadcastRef.current || broadcastBusyRef.current)
      return;
    broadcastBusyRef.current = true;
    (async () => {
      try {
        const stream = getBroadcastStream();
        if (!stream) {
          // Engine still warming (go-live raced play — the master chain isn't
          // built yet). mixActive never RE-fires while it stays true, so this
          // early return used to be a DEAD END: no broadcast ever published,
          // every listener stranded on "Tuning in…". Retry on a timer instead.
          broadcastBusyRef.current = false;
          setTimeout(() => setBroadcastEpoch((e) => e + 1), 1000);
          return;
        }
        const b = await publishStream(stream);
        broadcastRef.current = b;
        // DJ-side recovery: if OUR uplink to the SFU dies, every listener drops
        // with no way back — tear down and re-establish (bump epoch → re-run
        // this effect). A brief hiccup that self-heals never reaches 'failed'.
        b.pc.addEventListener("connectionstatechange", () => {
          const st = b.pc.connectionState;
          if ((st === "failed" || st === "closed") && liveLinkRef.current) {
            if (broadcastRef.current === b) {
              try {
                b.pc.close();
              } catch {
                /* already closed */
              }
              broadcastRef.current = null;
              setBroadcastEpoch((e) => e + 1);
            }
          }
        });
        publishState(); // announce the broadcast immediately
      } catch (e) {
        // A transient SFU/network failure must not strand the whole audience —
        // same dead-end as the null-stream case above. Keep retrying while the
        // door is open.
        console.error("[klappn] broadcast publish failed", e);
        setTimeout(() => {
          if (liveLinkRef.current && !broadcastRef.current) setBroadcastEpoch((e2) => e2 + 1);
        }, 3000);
      } finally {
        broadcastBusyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLink, mixActive, broadcastEpoch]);
  // Tear the broadcast down when the door closes (or the page leaves).
  useEffect(() => {
    if (liveLink) return;
    // Door closed: the take ends WITH the broadcast it was taping — stop
    // first (the file downloads itself) while the tap still exists.
    stopLiveRecording();
    setRecOn(false);
    // Nobody is left to hear the mic — cut it (and keep the
    // pill honest) even if the broadcast never got established.
    if (liveMicActive()) {
      disableLiveMic();
      setMicOn(false);
      setMicVoiceState("natural"); // the pills must match the torn-down graph
    }
    if (broadcastRef.current) {
      try {
        broadcastRef.current.pc.close();
      } catch {
        /* already closed */
      }
      broadcastRef.current = null;
      stopBroadcastStream();
    }
  }, [liveLink]);
  useEffect(
    () => () => {
      // unmount: drop the peer connection but LEAVE the tap — the set may keep
      // playing via the dock, and a remount re-publishes. The MIC though never
      // outlives its controls: hot capture with no pill to cut it is a trust
      // problem, not a playback feature. Same for the TAKE — it stops (and
      // downloads) rather than roll on with no pill to end it.
      stopLiveRecording();
      disableLiveMic();
      if (broadcastRef.current) {
        try {
          broadcastRef.current.pc.close();
        } catch {
          /* ignore */
        }
        broadcastRef.current = null;
      }
    },
    [],
  );

  // --- AI arrange ------------------------------------------------------------------
  const [arranging, setArranging] = useState(false);
  async function onArrange() {
    if (arranging || entries.length < 2) return;
    setArranging(true);
    setError(null);
    try {
      const r = await fetch(`/api/sets/${setId}/arrange`, { method: "POST" });
      const j = openDeep(
        (await r.json()) as {
          entries?: SetEntry[];
          plan?: { transitions?: Record<string, SetTransition> };
          error?: string;
        },
      );
      if (!r.ok || !j.entries) throw new Error(j.error || "couldn’t arrange the set");
      setEntries(j.entries);
      setTransitions(j.plan?.transitions ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t arrange the set.");
    } finally {
      setArranging(false);
    }
  }

  // --- add songs -----------------------------------------------------------------
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [library, setLibrary] = useState<
    { id: string; title: string; status: string }[] | null
  >(null);
  useEffect(() => {
    if (!pickerOpen || library) return;
    fetch("/api/songs", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { songs?: { id: string; title: string; status: string }[] }) =>
        setLibrary((j.songs ?? []).filter((s) => s.status === "ready")),
      )
      .catch(() => setLibrary([]));
  }, [pickerOpen, library]);

  async function addSong(songId: string) {
    const entry: SetEntry = { id: crypto.randomUUID(), songId };
    void persistEntries([...entries, entry]);
    if (!songs[songId]) {
      // Hydrate the new song (parts included) so it can play without a reload.
      try {
        const r = await fetch(`/api/songs/${songId}`, { cache: "no-store" });
        if (r.ok) {
          const j = openDeep((await r.json()) as { song: SongRow; parts: PartRow[] });
          setSongs((prev) => ({ ...prev, [songId]: { song: j.song, parts: j.parts } }));
        }
      } catch {
        /* it'll hydrate on next page load */
      }
    }
  }

  // --- transitions ------------------------------------------------------------------
  const [transBusy, setTransBusy] = useState<Set<string>>(new Set());

  async function composeTransition(fromEntryId: string, regenerate = false) {
    setTransBusy((s) => new Set(s).add(fromEntryId));
    setError(null);
    try {
      const r = await fetch(`/api/sets/${setId}/transitions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromEntryId, regenerate }),
      });
      const j = openDeep((await r.json()) as { set?: SetTransition; error?: string });
      if (!r.ok || !j.set) throw new Error(j.error || "transition failed");
      setTransitions((prev) => ({ ...prev, [fromEntryId]: j.set as SetTransition }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t compose the transition.");
    } finally {
      setTransBusy((s) => {
        const n = new Set(s);
        n.delete(fromEntryId);
        return n;
      });
    }
  }

  async function clearTransition(fromEntryId: string) {
    setTransitions((prev) => {
      const t = prev[fromEntryId];
      return t ? { ...prev, [fromEntryId]: { ...t, chosen: null } } : prev;
    });
    await fetch(`/api/sets/${setId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transitionChoice: { fromEntryId, choice: null } }),
    }).catch(() => {});
  }

  async function wearTransition(fromEntryId: string) {
    const t = transitions[fromEntryId];
    if (!t?.options.length) return composeTransition(fromEntryId);
    setTransitions((prev) => ({ ...prev, [fromEntryId]: { ...t, chosen: 0 } }));
    await fetch(`/api/sets/${setId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transitionChoice: { fromEntryId, choice: 0 } }),
    }).catch(() => {});
  }

  // --- preload every sound the set can play ------------------------------------------
  const preloadKey = entries.map((e) => e.songId).join(",");
  useEffect(() => {
    const codes = entries.flatMap((e) => {
      const b = songs[e.songId];
      const t = transitions[e.id];
      const tr = t && t.chosen != null ? [t.options[t.chosen].strudel] : [];
      return [
        ...(b?.parts ?? [])
          .map((p) => p.strudel)
          .filter((c): c is string => !!c?.trim()),
        ...tr,
      ];
    });
    if (codes.length) preloadSamples(codes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadKey]);

  // --- derived, for render -------------------------------------------------------------
  const flat = useMemo(
    () => buildFlat(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, transitions, songs, measuredBars],
  );
  // The set's REAL length: every section × its saved repeat. A ∞ hold anywhere
  // makes the set open-ended — say ∞, never a made-up number.
  const totalLength = (() => {
    let seconds = 0;
    let infinite = false;
    for (const s of flat) {
      const target = holdTargetFor(s.id);
      if (target === Infinity) infinite = true;
      seconds += s.seconds * (target === Infinity ? 1 : target);
    }
    return { seconds, infinite };
  })();
  const playingEntryId = playing ? sectionEntryId(playing) : null;
  const playingEntry = entries.find((e) => e.id === playingEntryId);
  const playingBundle = playingEntry ? songs[playingEntry.songId] : undefined;
  const playingPartId = playing?.includes("|") ? playing.split("|")[1] : null;
  const playingPart =
    playingPartId && !playingPartId.startsWith("break:") && playingPartId !== TRANSITION
      ? playingBundle?.parts.find((p) => p.id === playingPartId)
      : null;
  const playingIsHandoff = playing?.endsWith(`|${TRANSITION}`) ?? false;
  const playingIsBreak = playingPartId?.startsWith("break:") ?? false;
  // Breaks and hand-offs carry their AI-given NAMES — announce those, not a
  // generic word ("· Tape stop", not "· break").
  const playingMomentLabel = (() => {
    if (playingIsBreak && playingEntry) {
      const pid = (playingPartId as string).slice("break:".length);
      const set = planOf(songs[playingEntry.songId]?.song).breaks?.[pid];
      const worn = set && set.chosen != null ? set.options[set.chosen] : null;
      return worn?.label ? sentenceLabel(worn.label) : "break";
    }
    if (playingIsHandoff && playingEntryId) {
      const t = transitions[playingEntryId];
      const worn = t && t.chosen != null ? t.options[t.chosen] : null;
      return worn?.label ? sentenceLabel(worn.label) : "hand-off";
    }
    return null;
  })();
  const nextEntry = (() => {
    if (!playingEntryId || entries.length < 2) return null;
    const at = entries.findIndex((e) => e.id === playingEntryId);
    return at >= 0 ? entries[(at + 1) % entries.length] : null;
  })();
  function toggleKill(ch: Channel) {
    // Ref FIRST, synchronously — a setState updater runs at render time, so
    // updating the ref inside it leaves this gesture reading the OLD state
    // (the kill would wait for the next enforcement tick — the delay bug).
    const out = { ...killsRef.current, [ch]: !killsRef.current[ch] };
    killsRef.current = out;
    // INSTANT: gate the channel's orbit buses on the audio graph right now —
    // no re-evaluate, no cycle boundary, tails included.
    applyOrbitGains(killGainFor);
    setKills(out);
  }

  function toggleHold() {
    holdRef.current = !holdRef.current; // ref first — same gesture (see toggleKill)
    setHoldMode(holdRef.current);
  }

  async function toggleMic() {
    if (micOn) {
      disableLiveMic(); // also drops any worn character (lib resets too)
      setMicOn(false);
      setMicVoiceState("natural");
      setMicHint(null); // the whisper never outlives the mic it spoke for
      return;
    }
    // enable is async (permission prompt) — only flip the pill once the mic
    // is actually wired, so the UI never claims a voice nobody can hear.
    // The remembered device rides along; a vanished pick opens the default.
    const ok = await enableLiveMic(micDeviceRef.current);
    if (ok) {
      setLiveMicFx(micFx); // assert the current dials on the fresh graph
      setMicVoiceState("natural"); // the graph opened natural — match it
      setMicOn(true);
      try {
        if (!localStorage.getItem(MIC_HINT_KEY)) {
          localStorage.setItem(MIC_HINT_KEY, "1");
          setMicHint("in"); // said once, ever — then only the 🎧 remembers
        }
      } catch {
        /* private mode — the whisper just doesn't show */
      }
    }
  }

  // The device pick: sticks in localStorage; a LIVE mic swaps its source in
  // place (30ms crossfade, lib setLiveMicDevice) — the set never hears a gap.
  const micDeviceTo = (id: string) => {
    setMicDeviceId(id);
    try {
      localStorage.setItem(MIC_DEVICE_KEY, id);
    } catch {
      /* private mode — the choice just doesn't stick */
    }
    if (liveMicActive()) void setLiveMicDevice(id);
  };

  function toggleRec() {
    if (liveRecordingState().recording) {
      stopLiveRecording(); // the take assembles and downloads itself
      setRecOn(false);
      return;
    }
    if (startLiveRecording()) setRecOn(true);
  }

  const micDial = (patch: Partial<MicFx>) => {
    const next = { ...micFx, ...patch };
    setMicFx(next);
    setMicLook(null); // the hands moved the seat — no look owns it now
    // parameter writes on the mic graph — instant, no compile (see dial)
    setLiveMicFx(next);
  };

  const micVoiceTo = (v: LiveMicVoice) => {
    setMicVoiceState(v);
    setLiveMicVoice(v); // parameter ramps on the live chain — instant
  };

  const micLookTo = (id: string) => {
    const look = MIC_LOOKS.find((l) => l.id === id);
    if (!look) return;
    setMicFx(look.fx);
    setMicLook(id);
    setLiveMicFx(look.fx); // parameter ramps — the seat lands in one tap
  };

  // THE MIDI device watch runs only while the deck is live — MIDI is a SET
  // instrument, not an app-wide one; leaving the mix puts the keyboard down
  // (handlers unbound from playing, access stays open for next time).
  useEffect(() => {
    if (!mixActive) return;
    const unsub = subscribeMidi(setMidi);
    return () => {
      unsub();
      disableLiveMidi();
    };
  }, [mixActive]);

  async function toggleMidi() {
    if (midiState().enabled) {
      disableLiveMidi(); // the subscription streams the flip back into state
      return;
    }
    await enableLiveMidi();
  }

  // The device capsule's tap: cycle to the next connected input.
  const midiInputCycle = () => {
    const st = midiState();
    if (st.inputs.length < 2) return;
    const at = st.inputs.findIndex((i) => i.id === st.activeInputId);
    setMidiInput(st.inputs[(at + 1) % st.inputs.length].id);
  };

  // Tempo-sync the mic echo to the PLAYING song — a dotted eighth lands the
  // throws on the groove. Nudge counts: the ear hears the nudged tempo. The
  // KEY rides the same wire: the voice characters steer onto the scale the
  // listeners actually hear — the plan's key moved by the song's own
  // transpose AND the deck's live KEY dial (set-live stacks them the same
  // way). Null (nothing playing, or an unparsable key) = no steering.
  const playingPlan = playingBundle ? planOf(playingBundle.song) : null;
  const playingBpm = playingPlan?.bpm;
  const playingKey = playingPlan?.key;
  const playingShift = (playingPlan?.transpose ?? 0) + perf.key;
  useEffect(() => {
    if (!micOn) return;
    if (playingBpm) setLiveMicEchoBpm(playingBpm * (1 + tempoNudge / 100));
    setLiveMicKey(shiftScale(scaleFromKey(playingKey), playingShift));
  }, [micOn, playingBpm, tempoNudge, playingKey, playingShift]);

  const dial = (patch: Partial<typeof perf>) => {
    // Ref first, synchronously (see toggleKill) — so whatever this gesture
    // triggers is built from the value just dialled, not the previous one.
    const out = { ...perfRef.current, ...patch };
    perfRef.current = out;
    setPerf(out);
    // Filter/echo/punch/space are PARAMETER writes on the master FX chain —
    // instant, no compile, no freeze. Only KEY (note re-pitch) needs a re-eval.
    const applied = setLivePerf(out);
    if (applied && !("key" in patch)) return; // pure FX move — done, no re-eval
    // KEY (or an FX write that couldn't apply) needs a code re-eval — a main-thread
    // compile. On MOBILE a dial DRAG fires this per step and would stutter the
    // audio, so debounce: one re-eval when the drag settles. Desktop applies live.
    if (isMobile) {
      if (dialTimer.current) clearTimeout(dialTimer.current);
      dialTimer.current = setTimeout(applyLiveNow, 220);
    } else {
      applyLiveNow();
    }
  };

  /** Tempo nudge — drives the scheduler DIRECTLY (its own supported pivot):
   *  no re-evaluate, no main-thread freeze. Future evaluates re-assert the
   *  tempo via decorate's nudged setcpm, so rebuilds stay consistent. */
  const nudgeTo = (v: number) => {
    nudgeRef.current = v;
    setTempoNudge(v);
    const id = playingRef.current;
    if (id && !pausedRef.current) setLiveCps(sectionCps(id, liveCtx(), v));
  };

  // PERFORMANCE PADS — press and HOLD: the effect lives while your finger is
  // down and snaps back to whatever the dials held on release. A different
  // gesture from the sliders on purpose: pads are moments, sliders are sweeps.
  function padDown(name: string, patch: Partial<typeof perf>) {
    if (heldPad) return; // one moment at a time
    const restore: Partial<typeof perf> = {};
    for (const k of Object.keys(patch) as (keyof typeof perf)[])
      restore[k] = perfRef.current[k];
    padRestoreRef.current = restore;
    setHeldPad(name);
    dial(patch);
  }
  function padUp() {
    const restore = padRestoreRef.current;
    padRestoreRef.current = null;
    setHeldPad(null);
    if (restore) dial(restore);
  }

  // Keep the playing song gently in view as the set walks the arrangement —
  // "nearest" so it never yanks the page while you're working elsewhere.
  useEffect(() => {
    if (!playingEntryId || !mixActive) return;
    document
      .getElementById(`set-entry-${playingEntryId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playingEntryId, mixActive]);

  const entryMeta = (e: SetEntry) => {
    const b = songs[e.songId];
    if (!b)
      return { title: "(missing song)", meta: "", seconds: 0, infinite: false, ready: false };
    const p = planOf(b.song);
    const bs = barSeconds(p.bpm || 120, p.timeSignature);
    const playable = b.parts.filter((x) => x.strudel?.trim());
    // The song as the set plays it: loops × their saved repeats, plus its own
    // chosen breaks × theirs. Any ∞ hold makes this song open-ended here too.
    let seconds = 0;
    let infinite = false;
    const mult = (key: string) => {
      const t = holdTargetOf(p.holdCycles?.[key]);
      if (t === Infinity) {
        infinite = true;
        return 1;
      }
      return t;
    };
    playable.forEach((x, i) => {
      seconds += (barsForPart(x) ?? computeLoopBars(x.strudel || "")) * bs * mult(x.id);
      const set = p.breaks?.[x.id];
      const br = set && set.chosen != null ? set.options[set.chosen] : null;
      if (br && i < playable.length - 1) seconds += bs * mult(`break:${x.id}`);
    });
    return {
      title: b.song.title,
      meta: [p.bpm ? `${p.bpm} bpm` : "", p.key || ""].filter(Boolean).join(" · "),
      seconds,
      infinite,
      ready: playable.length > 0,
    };
  };

  const live = mixActive && !paused;

  return (
    <>
    <main
      className={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-[27rem] pt-6 transition-opacity duration-500 sm:pb-96 sm:pt-8 ${
        performMode ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/sets"
          className="group -ml-1 flex items-center gap-1 text-[15px] text-muted transition hover:text-foreground"
        >
          <span className="text-lg leading-none transition group-hover:-translate-x-0.5">
            ‹
          </span>
          Sets
        </Link>
        {/* Set-level acts live up here, not on the instrument: share the set
            (Go live) and stage it (Perform — fullscreen visuals). */}
        <div className="flex items-center gap-2">
        {mixActive && (
          <button
            onClick={() => setPerformMode(true)}
            aria-label="Perform — fullscreen visuals"
            title="Perform — the visuals full screen, controls floating"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-[13px] text-foreground/70 transition hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent-strong"
          >
            ⛶
          </button>
        )}
        {flat.length > 0 &&
          (liveLink ? (
            <span
              className="flex items-center gap-1 whitespace-nowrap rounded-full border border-accent/40 bg-accent/[0.08] py-1 pl-3 pr-1 text-[12px] text-foreground/90"
              style={{ boxShadow: "0 0 24px -8px rgba(224,49,156,0.5)" }}
            >
              <span className="relative mr-1 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-strong" />
              </span>
              {/* on a phone the words yield to the dots — the capsule must
                  never wrap (REC + perform ⛶ squeeze a 375px top bar) */}
              <span className="hidden sm:inline">on air</span>
              {/* THE TAKE — REC tapes the broadcast (lib/live-record), so it
                  lives with the broadcast's own controls, not on the deck. */}
              <button
                onClick={toggleRec}
                aria-pressed={recOn}
                title={
                  recOn
                    ? "Stop — the take downloads"
                    : "Tape the broadcast — music and voice, exactly what listeners hear"
                }
                className={`ml-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                  recOn
                    ? "text-white"
                    : "text-muted hover:bg-white/[0.08] hover:text-foreground"
                }`}
                style={recOn ? LIT_PILL : undefined}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    recOn ? "animate-pulse bg-white" : "bg-white/[0.12]"
                  }`}
                  style={
                    recOn ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" } : undefined
                  }
                />
                {/* rolling on a phone, the word yields to the clock — the
                    cluster must never wrap */}
                <span className={recOn ? "hidden sm:inline" : ""}>rec</span>
                {recOn && (
                  <span className="tabular-nums tracking-[0.04em]">
                    {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, "0")}
                  </span>
                )}
              </button>
              <button
                onClick={copyInvite}
                title="Copy the listener link"
                className={`ml-1 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                  copied
                    ? "text-accent-strong"
                    : "text-muted hover:bg-white/[0.08] hover:text-foreground"
                }`}
              >
                {copied ? "copied" : "copy link"}
              </button>
              <button
                onClick={onEndPress}
                title={
                  endArmed
                    ? "Press again — the link stops working for everyone"
                    : "End the broadcast"
                }
                className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
                  endArmed
                    ? "bg-rose-500/[0.22] text-rose-200"
                    : "text-muted hover:bg-rose-500/[0.15] hover:text-rose-300"
                }`}
                style={
                  endArmed
                    ? { boxShadow: "0 0 20px -4px rgba(244,63,94,0.65)" }
                    : undefined
                }
              >
                {endArmed ? "sure?" : "end"}
              </button>
            </span>
          ) : (
            <button
              onClick={() => void openInvite()}
              disabled={inviteBusy}
              title="Open a link anyone can join on their phone — they hear the set live, in their own headphones"
              className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent-strong disabled:opacity-50"
            >
              {inviteBusy ? (
                <span className="shimmer-text">opening</span>
              ) : (
                <>
                  <span className="text-accent-strong/80">◉</span> Go live
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* title — with the room's light breathing behind it, so the page is
          alive before a single note plays */}
      <header className="relative mt-10">
        <span
          aria-hidden
          className="glow-breathe pointer-events-none absolute -left-24 -top-24 h-64 w-[30rem] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(224,49,156,0.16), transparent)",
            filter: "blur(10px)",
          }}
        />
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="wordmark w-full bg-transparent text-[36px] leading-tight tracking-tight text-foreground outline-none sm:text-[46px]"
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            className="wordmark text-gradient text-glow cursor-text text-[36px] leading-tight tracking-tight sm:text-[46px]"
            title="Rename set"
          >
            {title}
          </h1>
        )}
        <p className="mt-2.5 flex items-center gap-2 text-[14px] text-muted">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-strong" />
            </span>
          )}
          {entries.length} song{entries.length === 1 ? "" : "s"}
          {totalLength.infinite ? (
            <> · ∞</>
          ) : (
            totalLength.seconds > 0 && <> · {fmtTime(totalLength.seconds)}</>
          )}
        </p>
      </header>

      {error && (
        <p className="mt-4 text-[13px] leading-relaxed text-rose-300/90">{error}</p>
      )}

      {/* play + add — the inline Play pill, on every device. */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void onPlaySet()}
          disabled={flat.length === 0}
          className="btn-primary inline-flex items-center gap-2.5 rounded-full px-7 py-3 text-[15px] font-medium transition active:scale-[.98] disabled:opacity-40"
        >
          {live ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-full border border-white/[0.1] bg-white/[0.03] px-5 py-3 text-[14px] font-medium text-foreground/80 transition hover:border-white/[0.18] hover:bg-white/[0.06] active:scale-[.98]"
        >
          + Add songs
        </button>
        {entries.length >= 2 && (
          <button
            onClick={() => void onArrange()}
            disabled={arranging}
            title="Let the AI order the songs into one flowing night"
            className="rounded-full border border-white/[0.1] bg-white/[0.03] px-5 py-3 text-[14px] font-medium text-foreground/80 transition hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent-strong active:scale-[.98] disabled:opacity-60"
          >
            {arranging ? (
              <span className="shimmer-text">hearing the flow</span>
            ) : (
              "Arrange"
            )}
          </button>
        )}
      </div>

      {/* the arrangement — one continuous thread from the first song to the last */}
      <div className="mt-10 flex flex-col">
        {entries.length === 0 && (
          <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] px-8 py-16 text-center">
            <div
              className="glow-breathe pointer-events-none absolute -top-24 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(224,49,156,0.18), transparent)",
              }}
            />
            <p className="relative text-[15px] text-muted">
              Nothing here yet.
              <br />
              <span className="text-foreground/80">
                Add your songs and shape the night.
              </span>
            </p>
          </div>
        )}
        {entries.map((e, i) => {
          const m = entryMeta(e);
          const isCurrent = playingEntryId === e.id;
          const audible = isCurrent && !paused;
          const t = transitions[e.id];
          const worn = t && t.chosen != null ? t.options[t.chosen] : null;
          const busy = transBusy.has(e.id);
          const hasNext = entries.length > 1;
          const isLast = i === entries.length - 1;
          return (
            <Fragment key={e.id}>
              <div
                id={`set-entry-${e.id}`}
                className={`group animate-rise relative rounded-[20px] border px-3.5 py-3.5 transition sm:px-5 sm:py-4 ${
                  isCurrent
                    ? "playing-glow border-accent/40 bg-accent/[0.05]"
                    : "border-white/[0.06] bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.045] hover:shadow-[0_14px_40px_-18px_rgba(0,0,0,0.8)]"
                }`}
                style={{ "--i": i } as CSSProperties}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                {/* ghost numeral — the order, whispered */}
                <span className="w-4 shrink-0 text-right text-[18px] font-light leading-none tracking-tight text-white/[0.14] tabular-nums sm:w-6 sm:text-[22px]">
                  {i + 1}
                </span>
                <button
                  onClick={() => {
                    // The playing song's button is the TRANSPORT (pause/resume);
                    // any other card is a smooth jump into that song.
                    if (isCurrent) return void onPlaySet();
                    const first = firstSectionOf(e.id);
                    if (first) void smoothJump(first.id);
                  }}
                  disabled={!m.ready}
                  title={
                    isCurrent
                      ? paused
                        ? "Resume"
                        : "Pause"
                      : "Bring the set here"
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] transition disabled:opacity-30 sm:h-10 sm:w-10 ${
                    isCurrent
                      ? "border-accent/50 bg-accent/[0.12] text-accent-strong"
                      : "border-white/[0.12] bg-white/[0.04] text-foreground/90 hover:border-white/[0.24] hover:bg-white/[0.08]"
                  }`}
                >
                  {audible ? <EqBars /> : "▶"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-foreground sm:text-[15px]">
                    {m.title}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted/90">
                    {m.meta}
                    {m.infinite ? <> · ∞</> : m.seconds > 0 && <> · {fmtTime(m.seconds)}</>}
                    {isCurrent && playingPart?.label && (
                      <span className="text-accent-strong"> · {playingPart.label}</span>
                    )}
                    {isCurrent && playingMomentLabel && (
                      <span className="text-accent-strong">
                        {" "}
                        · {playingMomentLabel}
                      </span>
                    )}
                  </div>
                </div>
                {/* arrange controls — quiet until the card is touched */}
                <div className="flex shrink-0 items-center gap-0.5 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    onClick={() => moveEntry(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="flex h-8 w-7 items-center justify-center rounded-full text-[13px] text-muted transition hover:bg-white/[0.07] hover:text-foreground disabled:opacity-25 sm:w-8"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveEntry(i, 1)}
                    disabled={i === entries.length - 1}
                    aria-label="Move down"
                    className="flex h-8 w-7 items-center justify-center rounded-full text-[13px] text-muted transition hover:bg-white/[0.07] hover:text-foreground disabled:opacity-25 sm:w-8"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeEntry(i)}
                    aria-label="Remove from set"
                    className="flex h-8 w-7 items-center justify-center rounded-full text-[12px] text-muted transition hover:bg-white/[0.07] hover:text-rose-300 sm:w-8"
                  >
                    ✕
                  </button>
                </div>
                </div>
                {/* the playhead — the SAME one the song page wears: a visible
                    track filling once per loop pass, frozen in place on pause */}
                {isCurrent && (
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      key={playing ?? "-"}
                      className="h-full w-full origin-left bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_10px_rgba(224,49,156,.5)]"
                      style={{
                        animation: `playhead-sweep ${Math.max(
                          1,
                          (flat.find((s) => s.id === playing)?.seconds ?? 4) /
                            (1 + tempoNudge / 100),
                        )}s linear infinite`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* the seam — the thread the music travels, with the hand-off on it */}
              {hasNext && (
                <div className="flex flex-col items-center py-0.5">
                  <span className="h-3 w-px bg-gradient-to-b from-transparent via-white/[0.14] to-accent/40" />
                  {worn ? (
                    <span
                      className="group/t flex items-center gap-1 rounded-full border border-accent/35 bg-accent/[0.08] py-1 pl-3.5 pr-1.5 text-[12px] text-foreground/90"
                      style={{
                        boxShadow: "0 0 26px -10px rgba(224,49,156,0.55)",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-accent-strong"
                        style={{ boxShadow: "0 0 8px rgba(255,99,193,0.8)" }}
                      />
                      {sentenceLabel(worn.label)}
                      <span className="flex items-center transition sm:opacity-0 sm:group-hover/t:opacity-100">
                        <button
                          onClick={() => void composeTransition(e.id, true)}
                          disabled={busy}
                          title="Recompose this hand-off"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40"
                        >
                          {busy ? "…" : "↻"}
                        </button>
                        <button
                          onClick={() => void clearTransition(e.id)}
                          title="Remove (hard cut)"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-foreground"
                        >
                          ✕
                        </button>
                      </span>
                    </span>
                  ) : busy ? (
                    <span className="shimmer-text py-1 text-[12px]">
                      composing the hand-off
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        t?.options.length
                          ? void wearTransition(e.id)
                          : void composeTransition(e.id)
                      }
                      className="rounded-full px-3.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted/50 transition hover:text-accent-strong"
                    >
                      transition{isLast ? " · loops back" : ""}
                    </button>
                  )}
                  <span className="h-3 w-px bg-gradient-to-b from-accent/40 via-white/[0.14] to-transparent" />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* song picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="cmdbar-in max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/[0.09] bg-surface/95 p-6 backdrop-blur-2xl sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="wordmark text-[17px] text-foreground">Add songs</h2>
              <button
                onClick={() => setPickerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white/[0.06] hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {(library?.length ?? 0) > 6 && (
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setPickerQuery("")}
                placeholder="Search your songs"
                className="mt-4 w-full rounded-2xl bg-white/[0.04] px-4 py-2.5 text-[14px] text-foreground outline-none transition placeholder:text-muted/45 focus:bg-white/[0.07]"
              />
            )}
            <div className="mt-4 flex flex-col gap-2">
              {library === null && (
                <p className="shimmer-text py-8 text-center text-[13px]">
                  finding your songs
                </p>
              )}
              {library?.length === 0 && (
                <p className="py-8 text-center text-[13px] text-muted">
                  No finished songs yet — compose some loops first.
                </p>
              )}
              {library
                ?.filter(
                  (s) =>
                    !pickerQuery.trim() ||
                    s.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
                )
                .map((s, i) => {
                const times = entries.filter((e) => e.songId === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => void addSong(s.id)}
                    title={times ? "Already in this set — tap to add it again" : "Add to the set"}
                    className={`group/s animate-rise flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition hover:bg-white/[0.06] ${
                      times
                        ? "border-accent/25 bg-accent/[0.05]"
                        : "border-white/[0.06] bg-white/[0.03] hover:border-accent/30"
                    }`}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <span className="truncate text-[14px] text-foreground">
                      {s.title}
                    </span>
                    {times ? (
                      <span className="ml-3 shrink-0 text-[12px] text-accent-strong">
                        ✓ in set{times > 1 ? ` ×${times}` : ""}
                        <span className="text-muted/60 transition group-hover/s:text-foreground/80">
                          {" "}
                          · again
                        </span>
                      </span>
                    ) : (
                      <span className="ml-3 shrink-0 text-[13px] text-muted transition group-hover/s:text-accent-strong">
                        +
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* THE DECK — live performance surface, present only while the set plays.
          A sheet you PULL: handle or header, finger or mouse — it follows, and
          a throw snaps it open / folded / away. */}
      {mixActive && (
        <div
          ref={deckWrapRef}
          className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-5 sm:pb-5"
          style={{
            transform: deckShift,
            transition: deckDragging
              ? "none"
              : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className="cmdbar-in relative mx-auto w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0c0d12]/85 px-4 pb-4 pt-4 backdrop-blur-2xl sm:px-5 sm:pb-5"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.07), 0 -18px 90px -26px rgba(224,49,156,0.55), 0 24px 60px -24px rgba(0,0,0,0.8)",
            }}
          >
            {/* the machined edge — light catching the top of the glass,
                breathing while the deck is powered */}
            <div className="glow-breathe pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

            {/* the grab handle — the sheet pill every thumb knows. Pull it and
                the deck rides your finger; tap it and the fold toggles. */}
            <button
              {...deckPull.handlers}
              onClick={() => {
                if (deckPull.didDrag()) return;
                toggleDeckFold();
              }}
              aria-expanded={deckStage === "open"}
              aria-label={deckStage === "open" ? "Fold the deck" : "Open the deck"}
              title={
                deckStage === "open"
                  ? "Pull down to fold · flick to hide"
                  : "Pull up to open"
              }
              className="group/pull mx-auto -mt-2 mb-1.5 block h-6 w-28 cursor-grab touch-none active:cursor-grabbing"
            >
              <span className="mx-auto mt-2.5 block h-1 w-12 rounded-full bg-white/[0.16] transition group-hover/pull:bg-white/[0.28]" />
            </button>

            <div
              {...deckPull.handlers}
              className="flex touch-none flex-wrap items-center justify-between gap-x-4 gap-y-3"
            >
              {/* the header strip IS the sheet — grab anywhere on it and pull;
                  a still tap folds or opens, same as the handle. */}
              <div
                onClick={() => {
                  if (deckPull.didDrag()) return;
                  toggleDeckFold();
                }}
                role="button"
                aria-expanded={deckStage === "open"}
                title={
                  deckStage === "open"
                    ? "Pull or tap to fold the deck away"
                    : "Pull or tap to open the deck"
                }
                className="flex min-w-0 flex-1 basis-32 cursor-grab select-none items-center gap-3 active:cursor-grabbing sm:basis-48"
              >
                {!paused ? <EqBars className="shrink-0" /> : (
                  <span className="h-3.5 w-[15px] shrink-0 text-center text-[10px] leading-[14px] text-muted">
                    ❚❚
                  </span>
                )}
                <div className="min-w-0">
                  <div
                    key={playing ?? "-"}
                    className="animate-fade-in truncate text-[14px] font-medium text-foreground"
                  >
                    {playingBundle?.song.title ?? "—"}
                    {playingPart?.label && (
                      <span className="text-muted"> · {playingPart.label}</span>
                    )}
                    {playingMomentLabel && (
                      <span className="text-accent-strong">
                        {" "}
                        · {playingMomentLabel}
                      </span>
                    )}
                  </div>
                  {nextEntry && (
                    <div className="truncate text-[11px] uppercase tracking-[0.14em] text-muted/60">
                      next · {songs[nextEntry.songId]?.song.title ?? "…"}
                    </div>
                  )}
                </div>
              </div>
              {/* real controls live here — a press on them is a press, never
                  the start of a pull */}
              <div
                className="flex shrink-0 items-center gap-1.5"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => void onPlaySet()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[11px] text-foreground transition hover:bg-white/[0.1]"
                  title={paused ? "Resume" : "Pause"}
                >
                  {paused ? "▶" : "❚❚"}
                </button>
                <button
                  onClick={toggleHold}
                  className={`h-9 rounded-full px-3.5 text-[11px] font-medium tracking-[0.08em] transition ${
                    holdMode
                      ? "bg-accent/[0.2] text-accent-strong"
                      : "bg-white/[0.06] text-foreground/80 hover:bg-white/[0.1]"
                  }`}
                  style={
                    holdMode
                      ? { boxShadow: "0 0 22px -6px rgba(224,49,156,0.7)" }
                      : undefined
                  }
                  title="Stay on what's playing until released"
                >
                  LOOP
                </button>
              </div>
            </div>

            {/* the fold — the body's height IS the gesture: mid-drag it's the
                finger verbatim (no transition), released it glides to the
                detent. Always mounted, so the dials never lose their state
                mid-pull. */}
            <div
              className="overflow-hidden"
              style={{
                height: deckBodyHeight,
                opacity: deckBodyOpacity,
                transition: deckDragging
                  ? "none"
                  : "height 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease",
              }}
              aria-hidden={deckStage !== "open"}
            >
              <div
                ref={deckBodyRef}
                className={
                  deckStage === "open" || deckDragging
                    ? ""
                    : "pointer-events-none"
                }
              >
                <div className="pt-3">
                  <DeckControls
                    kills={kills}
                    onKill={toggleKill}
                    tempoNudge={tempoNudge}
                    onTempo={nudgeTo}
                    perf={perf}
                    onDial={dial}
                    heldPad={heldPad}
                    onPadDown={padDown}
                    onPadUp={padUp}
                    micOn={micOn}
                    onMic={toggleMic}
                    micFx={micFx}
                    onMicFx={micDial}
                    micVoice={micVoice}
                    onMicVoice={micVoiceTo}
                    micLook={micLook}
                    onMicLook={micLookTo}
                    micHint={micHint}
                    mics={mics}
                    micDeviceId={micDeviceId}
                    onMicDevice={micDeviceTo}
                    midi={midi}
                    onMidi={toggleMidi}
                    onMidiInput={midiInputCycle}
                    onMidiInstrument={setMidiInstrument}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* the deck's WAKE PILL — all that remains after a flick-away: what's
          playing, breathing. One tap and the instrument rises back. */}
      {mixActive && deckStage === "hidden" && (
        <button
          onClick={() => setDeckStage("open")}
          aria-label="Bring the deck back"
          title="Bring the deck back"
          className="cmdbar-in fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/[0.09] bg-[#0c0d12]/85 py-2.5 pl-4 pr-5 backdrop-blur-2xl transition hover:border-white/[0.18]"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.07), 0 -10px 50px -14px rgba(224,49,156,0.5), 0 12px 30px -12px rgba(0,0,0,0.8)",
          }}
        >
          {!paused ? (
            <EqBars className="shrink-0" />
          ) : (
            <span className="text-[9px] leading-none text-muted">❚❚</span>
          )}
          <span className="max-w-44 truncate text-[12px] font-medium text-foreground/85">
            {playingBundle?.song.title ?? "Deck"}
          </span>
          <span className="text-[10px] text-muted/60">▲</span>
        </button>
      )}

    </main>

      {/* THE PERFORM STAGE — the visuals ARE the screen (body.immersive lifts
          them to full opacity while the page fades out). Floating on the light:
          what's playing, what's NEXT — with the blend chosen right on the card —
          and the WHOLE instrument in glass. */}
      {performMode && mixActive && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto p-4 sm:p-6"
          onClick={(e) => {
            // A tap on the open light (not on any control) toggles the glass
            // away — just the visuals. Any tap brings it back.
            if (e.target === e.currentTarget) setStageControls((v) => !v);
          }}
        >
          {/* top: the room, and the way out — it lifts away with the glass */}
          <div
            className={`flex items-start justify-between transition-all duration-500 ${
              stageControls
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-3 opacity-0"
            }`}
          >
            <span className="flex items-center gap-2 rounded-full bg-black/30 px-3.5 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground/70 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-strong" />
              </span>
              {liveLink ? "on air" : "live"} · {title}
            </span>
            <button
              onClick={() => setPerformMode(false)}
              aria-label="Leave the stage"
              title="Leave the stage (Esc)"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-[13px] text-foreground/70 backdrop-blur-md transition hover:bg-black/50 hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {/* bottom: next in advance, then the whole instrument in glass.
              The clip wrapper keeps the slide inside its own box — the glass
              pulls down THROUGH the bottom edge, never into scroll space. */}
          <div
            className="mx-auto mt-4 w-full max-w-2xl overflow-hidden pt-1"
            onClick={(e) => {
              // the empty light where the glass was — a tap brings it back
              if (e.target === e.currentTarget) setStageControls((v) => !v);
            }}
          >
          <div
            ref={stageClusterRef}
            className={`flex w-full flex-col gap-2 ${
              stageControls || stageDragging ? "" : "pointer-events-none"
            }`}
            style={{
              transform: stageDragging
                ? `translateY(${Math.max(0, stageOff as number)}px)`
                : stageControls
                  ? "translateY(0px)"
                  : "translateY(calc(100% + 24px))",
              opacity: stageDragging
                ? Math.max(0, 1 - (stageOff as number) / stageTravel)
                : stageControls
                  ? 1
                  : 0,
              transition: stageDragging
                ? "none"
                : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease",
            }}
          >
            {/* the stage's grab handle — pull the whole instrument off the
                light; tap does the same. Any tap on the light returns it. */}
            <button
              {...stagePull.handlers}
              onClick={() => {
                if (stagePull.didDrag()) return;
                setStageControls(false);
              }}
              aria-label="Pull the controls away"
              title="Pull down or tap — just the visuals"
              className="group/pull mx-auto -mb-1 block h-6 w-28 cursor-grab touch-none active:cursor-grabbing"
            >
              <span className="mx-auto mt-2.5 block h-1 w-12 rounded-full bg-white/[0.22] transition group-hover/pull:bg-white/[0.4]" />
            </button>

            {/* NEXT — see it coming, choose the blend, one tap to go */}
            {nextEntry && (
              <div className="flex items-stretch gap-1.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-black/35 px-4 py-2.5 backdrop-blur-md">
                  <span className="min-w-0">
                    <span className="block text-[9px] uppercase tracking-[0.22em] text-foreground/45">
                      Next
                    </span>
                    <span className="mt-0.5 block truncate text-[14px] font-medium text-foreground">
                      {songs[nextEntry.songId]?.song.title ?? "…"}
                    </span>
                  </span>
                  {/* how it lands — chosen here, played there */}
                  <span className="flex shrink-0 items-center gap-1">
                    {(() => {
                      const eid = playingEntryId ?? "";
                      const t = transitions[eid];
                      const busy = transBusy.has(eid);
                      const worn = t && t.chosen != null;
                      if (busy)
                        return (
                          <span className="shimmer-text px-2 text-[11px]">
                            composing
                          </span>
                        );
                      if (!t?.options.length)
                        return (
                          <>
                            <button
                              onClick={() => void composeTransition(eid)}
                              className="rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/60 transition hover:bg-white/[0.1] hover:text-accent-strong"
                              title="Compose a hand-off into the next song"
                            >
                              blend
                            </button>
                            <span className="rounded-full bg-accent/[0.2] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-accent-strong">
                              fade
                            </span>
                          </>
                        );
                      return (
                        <>
                          <button
                            onClick={() => void wearTransition(eid)}
                            className={`max-w-36 truncate rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                              worn
                                ? "bg-accent/[0.2] text-accent-strong"
                                : "text-foreground/60 hover:bg-white/[0.1] hover:text-foreground"
                            }`}
                            title="Land through the composed hand-off"
                          >
                            {t.options[t.chosen ?? 0]?.label ?? "blend"}
                          </button>
                          <button
                            onClick={() => void clearTransition(eid)}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                              worn
                                ? "text-foreground/60 hover:bg-white/[0.1] hover:text-foreground"
                                : "bg-accent/[0.2] text-accent-strong"
                            }`}
                            title="Land on a master fade"
                          >
                            fade
                          </button>
                        </>
                      );
                    })()}
                  </span>
                </div>
                <button
                  onClick={() => void goNext()}
                  aria-label="Go to the next song"
                  title="Go — land the way you chose"
                  className="group/next flex w-16 shrink-0 items-center justify-center rounded-2xl bg-black/35 text-[19px] text-foreground/60 backdrop-blur-md transition hover:bg-accent/[0.25] hover:text-accent-strong"
                >
                  <span className="transition group-hover/next:translate-x-0.5">→</span>
                </button>
              </div>
            )}

            {/* the WHOLE instrument, in glass over the light */}
            <div
              className="rounded-[26px] border border-white/[0.08] bg-black/40 px-5 pb-5 pt-4 backdrop-blur-xl"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
            >
              <div
                {...stagePull.handlers}
                className="mb-3.5 flex touch-none flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <div className="flex min-w-0 flex-1 basis-48 cursor-grab select-none items-center gap-3 active:cursor-grabbing">
                  {!paused ? (
                    <EqBars className="shrink-0" />
                  ) : (
                    <span className="h-3.5 w-[15px] shrink-0 text-center text-[10px] leading-[14px] text-muted">
                      ❚❚
                    </span>
                  )}
                  <div
                    key={playing ?? "-"}
                    className="animate-fade-in min-w-0 truncate text-[14px] font-medium text-foreground"
                  >
                    {playingBundle?.song.title ?? "—"}
                    {playingPart?.label && (
                      <span className="text-foreground/60"> · {playingPart.label}</span>
                    )}
                    {playingMomentLabel && (
                      <span className="text-accent-strong"> · {playingMomentLabel}</span>
                    )}
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1.5"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => void onPlaySet()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[11px] text-foreground transition hover:bg-white/[0.1]"
                    title={paused ? "Resume" : "Pause"}
                  >
                    {paused ? "▶" : "❚❚"}
                  </button>
                  <button
                    onClick={toggleHold}
                    className={`h-9 rounded-full px-3.5 text-[11px] font-medium tracking-[0.08em] transition ${
                      holdMode
                        ? "bg-accent/[0.2] text-accent-strong"
                        : "bg-white/[0.06] text-foreground/80 hover:bg-white/[0.1]"
                    }`}
                    style={
                      holdMode
                        ? { boxShadow: "0 0 22px -6px rgba(224,49,156,0.7)" }
                        : undefined
                    }
                    title="Stay on what's playing until released"
                  >
                    LOOP
                  </button>
                </div>
              </div>
              <DeckControls
                kills={kills}
                onKill={toggleKill}
                tempoNudge={tempoNudge}
                onTempo={nudgeTo}
                perf={perf}
                onDial={dial}
                heldPad={heldPad}
                onPadDown={padDown}
                onPadUp={padUp}
                micOn={micOn}
                onMic={toggleMic}
                micFx={micFx}
                onMicFx={micDial}
                micVoice={micVoice}
                onMicVoice={micVoiceTo}
                micLook={micLook}
                onMicLook={micLookTo}
                micHint={micHint}
                mics={mics}
                micDeviceId={micDeviceId}
                onMicDevice={micDeviceTo}
                midi={midi}
                onMidi={toggleMidi}
                onMidiInput={midiInputCycle}
                onMidiInstrument={setMidiInstrument}
              />
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
