"use client";

import { useEffect, useRef, useState } from "react";
import { CHANNELS, filterDisplay, type Channel } from "@/lib/set-live";
import { MIDI_INSTRUMENTS, type MidiSnapshot } from "@/lib/midi-live";
import type { LiveMicVoice } from "@/lib/strudel-client";
import DeckSlider from "./DeckSlider";
import { MicDeckGroup, type MicDevice, type MicFx } from "./DeckKit";
import SaltShaker from "./SaltShaker";

/**
 * THE MIXER — the zaltz IDE's performance desk (the Sets deck's own
 * machinery, worn by the instrument): channel kills on orbit buses, momentary
 * pads, master-chain dials, video FX on the canvas. Ephemeral, deterministic,
 * zero AI — the pane's code is never touched. Its door is the SALT SHAKER,
 * one circle in the corner; the desk floats up over the panes.
 *
 * This is a pure view: every value and every move belongs to the parent
 * (ZaltzIDE owns the audio wiring); the desk only shows and asks.
 */

/** The music dials the desk moves — see ZaltzIDE.movePerf / lib setLivePerf.
 *  time/tail rest at the echo chain's build values (0.375s / 0.4), so "—" on
 *  the dial means untouched. */
export interface PerfDials {
  filter: number;
  echo: number;
  punch: number;
  space: number;
  time: number;
  tail: number;
}

/** The visuals dials — CSS filters on the hydra canvas (video-DJ light desk). */
export interface LightDials {
  hue: number;
  sat: number;
  contrast: number;
  bright: number;
  blur: number;
  invert: number;
}

/** The swarm dials — zissl's compute colony worn as a desk section (see
 *  lib/strudel-client setLiveSwarm). WebGPU rooms only. */
export interface SwarmDials {
  on: boolean;
  colony: number;
  rush: number;
  hunger: number;
}

export type MixerTab = "music" | "light" | "midi" | "mic";

// THE KIT — every desk control a knob or pad can ride (MIDI learn). The desk
// renders the chips; the parent owns the bindings and the applying.
export type KitTargetId =
  | "master" | "tempo" | "key" | "filter" | "echo" | "space" | "drive" | "time" | "tail"
  | "kill-drums" | "kill-bass" | "kill-melody"
  | "hue" | "colour" | "contrast" | "glow" | "smear" | "invert";
export interface KitBinding {
  kind: "cc" | "note";
  num: number;
}
export type KitMap = Partial<Record<KitTargetId, KitBinding>>;
export const KIT_TARGETS: { id: KitTargetId; label: string; pad?: boolean }[] = [
  { id: "master", label: "Master" },
  { id: "tempo", label: "Tempo" },
  { id: "key", label: "Key" },
  { id: "filter", label: "Filter" },
  { id: "echo", label: "Echo" },
  { id: "space", label: "Space" },
  { id: "drive", label: "Drive" },
  { id: "time", label: "Time" },
  { id: "tail", label: "Tail" },
  { id: "kill-drums", label: "Drums", pad: true },
  { id: "kill-bass", label: "Bass", pad: true },
  { id: "kill-melody", label: "Melody", pad: true },
  { id: "hue", label: "Hue" },
  { id: "colour", label: "Colour" },
  { id: "contrast", label: "Contrast" },
  { id: "glow", label: "Glow" },
  { id: "smear", label: "Smear" },
  { id: "invert", label: "Invert" },
];

/** A note's stage name (C-1-anchored) — the kit chip wears it once a pad binds. */
function noteName(n: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `${names[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

// THE ONE PINK — the deck's hot gradient, worn by every lit control.
const HOT_GRADIENT =
  "linear-gradient(135deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)";

/** Hold: on · release: back — the deck's momentary throws, plus one of ours. */
const PADS: { name: string; hint: string; patch: Partial<PerfDials> }[] = [
  { name: "DIVE", hint: "filter down", patch: { filter: -78 } },
  { name: "AIR", hint: "bass away", patch: { filter: 62 } },
  { name: "ECHO", hint: "throw", patch: { echo: 0.6 } },
  { name: "WASH", hint: "drown it", patch: { space: 0.55, echo: 0.25 } },
];

/** The light desk's own momentary throws — same grammar as the sound holds:
 *  press and the room changes, let go and it snaps back. All of them ride the
 *  existing CSS-filter dials, so release restores the dialled look exactly. */
const LIGHT_PADS: { name: string; hint: string; patch: Partial<LightDials> }[] = [
  { name: "CUT", hint: "lights out", patch: { bright: 0 } },
  { name: "XRAY", hint: "negative", patch: { invert: 1 } },
  { name: "SMEAR", hint: "wet glass", patch: { blur: 7 } },
  { name: "BLEACH", hint: "overexpose", patch: { bright: 1.8, sat: 0.25 } },
];

/** One momentary pad — the desk's shared hold control (sound and light wear
 *  the same button; lit = the hot gradient, always). */
function HoldPad({
  name,
  hint,
  held,
  onDown,
  onUp,
}: {
  name: string;
  hint: string;
  held: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={() => held && onUp()}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      title="Hold — release to snap back"
      className={`flex h-11 select-none flex-col items-center justify-center rounded-2xl transition ${
        held ? "text-white" : "bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
      style={{
        touchAction: "none",
        ...(held
          ? {
              backgroundImage: HOT_GRADIENT,
              boxShadow: "0 0 30px -8px rgba(224,49,156,0.9)",
            }
          : {}),
      }}
    >
      <span
        className={`text-[11px] font-medium tracking-[0.12em] ${
          held ? "text-white" : "text-foreground/85"
        }`}
      >
        {name}
      </span>
      <span
        className={`max-w-full overflow-hidden whitespace-nowrap px-1 text-[8px] uppercase tracking-[0.08em] sm:text-[9px] sm:tracking-[0.14em] ${
          held ? "text-white/70" : "text-muted/45"
        }`}
      >
        hold · {hint}
      </span>
    </button>
  );
}

export default function ZaltzMixer({
  open,
  onToggle,
  tab,
  onTab,
  playing,
  kills,
  onKill,
  heldPad,
  onPadDown,
  onPadUp,
  master,
  onMaster,
  nudge,
  onNudge,
  keyShift,
  onKeyShift,
  perf,
  onPerf,
  light,
  onLight,
  canSwarm,
  swarm,
  onSwarm,
  midi,
  kitMap,
  learn,
  onMidiToggle,
  onMidiInstrument,
  onMidiInput,
  onLearn,
  onUnbind,
  canMic,
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
  micDotRef,
}: {
  open: boolean;
  onToggle: () => void;
  tab: MixerTab;
  onTab: (t: MixerTab) => void;
  playing: boolean;
  kills: Record<Channel, boolean>;
  onKill: (ch: Channel) => void;
  heldPad: string | null;
  onPadDown: (name: string, patch: Partial<PerfDials>) => void;
  onPadUp: () => void;
  master: number;
  onMaster: (v: number) => void;
  nudge: number;
  onNudge: (v: number) => void;
  keyShift: number;
  onKeyShift: (v: number) => void;
  perf: PerfDials;
  onPerf: (patch: Partial<PerfDials>) => void;
  light: LightDials;
  onLight: (patch: Partial<LightDials>) => void;
  /** The room's engine has the compute layer (zissl) — the swarm section shows. */
  canSwarm: boolean;
  swarm: SwarmDials;
  onSwarm: (patch: Partial<SwarmDials>) => void;
  /** null = this browser has no Web MIDI — the tab never shows. */
  midi: MidiSnapshot | null;
  kitMap: KitMap;
  /** The kit chip currently listening for a knob/pad (MIDI learn). */
  learn: KitTargetId | null;
  onMidiToggle: () => void;
  onMidiInstrument: (s: string) => void;
  onMidiInput: () => void;
  onLearn: (id: KitTargetId | null) => void;
  onUnbind: (id: KitTargetId) => void;
  /** false = this browser can't open a mic — the tab never shows. */
  canMic: boolean;
  micOn: boolean;
  onMic: () => void;
  /** The mic's world — the Sets deck's own contract, verbatim (DeckKit). */
  micFx: MicFx;
  onMicFx: (patch: Partial<MicFx>) => void;
  micVoice: LiveMicVoice;
  onMicVoice: (v: LiveMicVoice) => void;
  micLook: string | null;
  onMicLook: (id: string) => void;
  micHint: "in" | "out" | null;
  mics: MicDevice[];
  micDeviceId: string | null;
  onMicDevice: (id: string) => void;
  /** The pill's hot-mic dot — MicDeckGroup's poll makes it breathe. */
  micDotRef: React.RefObject<HTMLSpanElement | null>;
}) {
  // The tap's shake — the shaker keeps shaking while the desk rises.
  const [shaking, setShaking] = useState(false);
  // FOLDED (user 07-27: "hide the DJ controls from the panel itself"): the
  // desk's own grabber lays the controller flat — a slim glass bar stays
  // centre-stage where the desk was, one tap raises it again. The shaker
  // never learns this verb; a fresh show always opens with the desk up.
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!open) setFolded(false);
  }, [open]);
  // The light holds are the desk's own (pure view): press remembers the
  // dialled look, release hands it back exactly.
  const [heldLight, setHeldLight] = useState<string | null>(null);
  const prevLight = useRef<LightDials | null>(null);
  const lightPadDown = (name: string, patch: Partial<LightDials>) => {
    if (!prevLight.current) prevLight.current = { ...light };
    setHeldLight(name);
    onLight(patch);
  };
  const lightPadUp = () => {
    setHeldLight(null);
    if (prevLight.current) {
      onLight(prevLight.current);
      prevLight.current = null;
    }
  };
  return (
    <>
      {/* THE DESK — centre-stage now (user 07-27: "it does not need to remain
          in the corner — the whole page is clear"): the desk only ever rises
          inside the show, where the writing room has stepped aside, so it
          takes the natural DJ position — front and centre, the picture
          burning all around it. Phones keep full width. */}
      {open && folded && (
        /* THE DESK, FOLDED FLAT — the grabber alone stays where the desk
           was: the universal "something rises from here" object. One tap
           and the controller is back in your hands. */
        <button
          onClick={() => setFolded(false)}
          aria-label="Raise the desk"
          title="Raise the desk"
          className="desk-pour fixed z-20 flex h-7 w-28 items-center justify-center rounded-full border border-white/[0.14] bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-xl backdrop-saturate-[1.6] transition hover:bg-black/50 active:scale-[.96]"
          style={{
            left: "calc(50% - 3.5rem)",
            bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 3.9rem)",
          }}
        >
          <span className="h-1 w-10 rounded-full bg-white/30" />
        </button>
      )}
      {open && !folded && (
        <div
          className="desk-pour fixed inset-x-3 z-20 sm:inset-x-0 sm:mx-auto sm:w-[640px]"
          style={{
            bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 3.9rem)",
          }}
        >
          {/* FIXED height — Sound and Visual are the same size slab, so the
              tab switch never jolts the glass (user 07-27: "feels glitchy"). */}
          {/* Taller on the phone so every control is IN VIEW — a desk you
              scroll isn't a desk (user 07-27); desktop keeps its 360. */}
          {/* GLASS DESK (user 07-27, the show pass — walks back the solid
              smoke): in fullscreen the desk floats ON the picture, so the
              picture must pour through it — thin smoke, saturated backdrop
              (same alive-glass law as the panes), machined top highlight.
              The controls carry their own contrast (white/[0.06] pills). */}
          <div className="h-[464px] max-h-[78dvh] overflow-y-auto rounded-[22px] border border-white/[0.14] bg-black/35 p-4 pt-1.5 shadow-[0_0_70px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-2xl backdrop-saturate-[1.6] sm:h-[384px] sm:max-h-[60dvh]">
          {/* THE GRABBER — the sheet's universal fold: tap and the desk lies
              flat (the picture stays; the bar below raises it again). */}
          <button
            onClick={() => setFolded(true)}
            aria-label="Fold the desk"
            title="Fold the desk — the picture stays"
            className="group mb-1 flex w-full items-center justify-center py-1.5"
          >
            <span className="h-1 w-10 rounded-full bg-white/20 transition group-hover:bg-white/40" />
          </button>
          {/* ONE segmented capsule — equal slices of the same machined
              control, not loose pills. MIDI earns its slice only where the
              browser can actually speak it. */}
          <div className="mb-3.5 flex rounded-full bg-white/[0.04] p-1">
            {([
              "music",
              "light",
              ...(midi ? (["midi"] as const) : []),
              ...(canMic ? (["mic"] as const) : []),
            ] as MixerTab[]).map((t) => (
              <button
                key={t}
                onClick={() => onTab(t)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition active:scale-[.98] ${
                  tab === t
                    ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                    : "text-muted/60 hover:text-foreground"
                }`}
              >
                {t === "light" ? "Visual" : t === "midi" ? "MIDI" : t === "mic" ? "Mic" : "Sound"}
              </button>
            ))}
          </div>
          {tab === "music" ? (
            <>
              {/* THE CHANNELS — three fixed kill switches, the deck's own
                  row: instant, tails included, back mid-note. */}
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                kills
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CHANNELS.map((ch) => {
                  const off = kills[ch];
                  return (
                    <button
                      key={ch}
                      onClick={() => onKill(ch)}
                      aria-pressed={!off}
                      title={off ? `Bring the ${ch} back` : `Kill the ${ch}`}
                      className={`flex h-9 items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition active:scale-[.97] ${
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
              {/* THE PADS — hold: on · release: snap back. */}
              <div className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                holds
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PADS.map((pad) => (
                  <HoldPad
                    key={pad.name}
                    name={pad.name}
                    hint={pad.hint}
                    held={heldPad === pad.name}
                    onDown={() => onPadDown(pad.name, pad.patch)}
                    onUp={onPadUp}
                  />
                ))}
              </div>
              {/* the dials — the deck's grid: whispered label, mono readout,
                  TEMPO/KEY/FILTER centre-detent (double-tap zeroes them) */}
              <div className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                dials
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 sm:gap-x-6">
                <DeckSlider
                  label="Master"
                  value={master}
                  min={0}
                  max={1}
                  step={0.02}
                  display={`${Math.round(master * 100)}%`}
                  onChange={onMaster}
                />
                <DeckSlider
                  label="Tempo"
                  value={nudge}
                  min={-8}
                  max={8}
                  step={1}
                  bipolar
                  display={nudge === 0 ? "—" : `${nudge > 0 ? "+" : ""}${nudge}%`}
                  onChange={onNudge}
                />
                <DeckSlider
                  label="Key"
                  value={keyShift}
                  min={-7}
                  max={7}
                  step={1}
                  bipolar
                  display={keyShift === 0 ? "—" : `${keyShift > 0 ? "+" : ""}${keyShift} st`}
                  onChange={onKeyShift}
                />
                <DeckSlider
                  label="Filter"
                  value={perf.filter}
                  min={-100}
                  max={100}
                  step={2}
                  bipolar
                  display={filterDisplay(perf.filter)}
                  onChange={(v) => onPerf({ filter: v })}
                />
                <DeckSlider
                  label="Echo"
                  value={perf.echo}
                  min={0}
                  max={0.7}
                  step={0.05}
                  display={perf.echo === 0 ? "—" : `${Math.round((perf.echo / 0.7) * 100)}%`}
                  onChange={(v) => onPerf({ echo: v })}
                />
                <DeckSlider
                  label="Space"
                  value={perf.space}
                  min={0}
                  max={0.6}
                  step={0.05}
                  display={perf.space === 0 ? "—" : `${Math.round((perf.space / 0.6) * 100)}%`}
                  onChange={(v) => onPerf({ space: v })}
                />
                {/* The dirt-and-dub row — desktop completes the 3×3; the
                    phone keeps its even six (2×3) and skips these. */}
                <div className="hidden sm:contents">
                  <DeckSlider
                    label="Drive"
                    value={perf.punch}
                    min={0}
                    max={0.5}
                    step={0.05}
                    display={perf.punch === 0 ? "—" : `${Math.round((perf.punch / 0.5) * 100)}%`}
                    onChange={(v) => onPerf({ punch: v })}
                  />
                  <DeckSlider
                    label="Time"
                    value={perf.time}
                    min={0.08}
                    max={0.75}
                    step={0.005}
                    display={perf.time === 0.375 ? "—" : `${Math.round(perf.time * 1000)}ms`}
                    onChange={(v) => onPerf({ time: v })}
                  />
                  <DeckSlider
                    label="Tail"
                    value={perf.tail}
                    min={0}
                    max={0.85}
                    step={0.05}
                    display={perf.tail === 0.4 ? "—" : `${Math.round(perf.tail * 100)}%`}
                    onChange={(v) => onPerf({ tail: v })}
                  />
                </div>
              </div>
            </>
          ) : tab === "light" ? (
            // VISUAL — the light desk speaks the sound desk's grammar: a row
            // of momentary holds up top (press changes the room, release
            // hands the dialled look straight back), then the six dials with
            // the rest of the slab's air.
            <div className="flex h-[calc(100%-3.25rem)] flex-col">
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                holds
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {LIGHT_PADS.map((pad) => (
                  <HoldPad
                    key={pad.name}
                    name={pad.name}
                    hint={pad.hint}
                    held={heldLight === pad.name}
                    onDown={() => lightPadDown(pad.name, pad.patch)}
                    onUp={lightPadUp}
                  />
                ))}
              </div>
              <div className="flex flex-1 flex-col justify-center">
              {/* THE SWARM — zissl's compute colony as a desk section: wake it
                  and a living culture senses the picture and grows filaments
                  of its own light over it. WebGPU rooms only — where there is
                  no compute there is no section, not a dead switch. */}
              {canSwarm && (
                <>
                  <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                    swarm
                  </div>
                  <div className="mb-4 grid grid-cols-2 items-end gap-x-5 gap-y-3 sm:grid-cols-4 sm:gap-x-6">
                    <button
                      onClick={() => onSwarm({ on: !swarm.on })}
                      aria-pressed={swarm.on}
                      title={
                        swarm.on
                          ? "Put the colony to sleep"
                          : "Wake the swarm — a living colony grows over the picture"
                      }
                      className={`flex h-9 items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition active:scale-[.97] ${
                        swarm.on
                          ? "text-white"
                          : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
                      }`}
                      style={
                        swarm.on
                          ? {
                              backgroundImage: HOT_GRADIENT,
                              boxShadow: "0 0 30px -8px rgba(224,49,156,0.9)",
                            }
                          : undefined
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full transition ${
                          swarm.on ? "bg-white" : "bg-white/[0.12]"
                        }`}
                        style={
                          swarm.on
                            ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" }
                            : undefined
                        }
                      />
                      swarm
                    </button>
                    {/* asleep, the dials rest dim — the pill is the one door */}
                    <div className={swarm.on ? "transition-opacity" : "pointer-events-none opacity-35 transition-opacity"}>
                      <DeckSlider
                        label="Colony"
                        value={swarm.colony}
                        min={0.05}
                        max={1}
                        step={0.05}
                        display={swarm.colony === 0.5 ? "—" : `${Math.round(swarm.colony * 100)}%`}
                        onChange={(v) => onSwarm({ colony: v })}
                      />
                    </div>
                    <div className={swarm.on ? "transition-opacity" : "pointer-events-none opacity-35 transition-opacity"}>
                      <DeckSlider
                        label="Rush"
                        value={swarm.rush}
                        min={0.2}
                        max={3.5}
                        step={0.05}
                        display={swarm.rush === 1.25 ? "—" : `${swarm.rush.toFixed(2)}×`}
                        onChange={(v) => onSwarm({ rush: v })}
                      />
                    </div>
                    <div className={swarm.on ? "transition-opacity" : "pointer-events-none opacity-35 transition-opacity"}>
                      <DeckSlider
                        label="Hunger"
                        value={swarm.hunger}
                        min={0}
                        max={3}
                        step={0.05}
                        display={swarm.hunger === 1.2 ? "—" : `${swarm.hunger.toFixed(2)}×`}
                        onChange={(v) => onSwarm({ hunger: v })}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                dials
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 sm:gap-x-6">
              <DeckSlider
                label="Hue"
                value={light.hue}
                min={0}
                max={360}
                step={2}
                display={light.hue === 0 ? "—" : `${Math.round(light.hue)}°`}
                onChange={(v) => onLight({ hue: v })}
              />
              <DeckSlider
                label="Colour"
                value={light.sat}
                min={0}
                max={3}
                step={0.05}
                display={light.sat === 1 ? "—" : `${light.sat.toFixed(2)}×`}
                onChange={(v) => onLight({ sat: v })}
              />
              <DeckSlider
                label="Contrast"
                value={light.contrast}
                min={0.4}
                max={2.5}
                step={0.05}
                display={light.contrast === 1 ? "—" : `${light.contrast.toFixed(2)}×`}
                onChange={(v) => onLight({ contrast: v })}
              />
              <DeckSlider
                label="Glow"
                value={light.bright}
                min={0.4}
                max={2}
                step={0.05}
                display={light.bright === 1 ? "—" : `${light.bright.toFixed(2)}×`}
                onChange={(v) => onLight({ bright: v })}
              />
              <DeckSlider
                label="Smear"
                value={light.blur}
                min={0}
                max={8}
                step={0.25}
                display={light.blur === 0 ? "—" : `${light.blur.toFixed(1)}px`}
                onChange={(v) => onLight({ blur: v })}
              />
              <DeckSlider
                label="Invert"
                value={light.invert}
                min={0}
                max={1}
                step={0.02}
                display={light.invert === 0 ? "—" : `${Math.round(light.invert * 100)}%`}
                onChange={(v) => onLight({ invert: v })}
              />
              </div>
              </div>
            </div>
          ) : tab === "mic" ? (
            // MIC — your voice in the room, THE SETS DECK'S OWN WORLD verbatim
            // (DeckKit MicDeckGroup: meter, five voices, six looks, dials,
            // device capsule — the DJ is learned once). Monitor is OPEN here:
            // in zaltz there is no audience yet, the room itself hears you.
            <div className="flex h-[calc(100%-3.25rem)] flex-col overflow-y-auto">
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                the voice
              </div>
              <button
                onClick={onMic}
                aria-pressed={micOn}
                title={
                  micOn
                    ? "Put the mic down"
                    : "Open the mic — sing or speak over the room"
                }
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition active:scale-[.97] ${
                  micOn
                    ? "text-white"
                    : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
                }`}
                style={
                  micOn
                    ? {
                        backgroundImage: HOT_GRADIENT,
                        boxShadow: "0 0 30px -8px rgba(224,49,156,0.9)",
                      }
                    : undefined
                }
              >
                <span
                  ref={micDotRef}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    micOn ? "bg-white" : "bg-white/[0.12]"
                  }`}
                  style={
                    micOn
                      ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" }
                      : undefined
                  }
                />
                mic
              </button>
              <MicDeckGroup
                on={micOn}
                fx={micFx}
                onFx={onMicFx}
                voice={micVoice}
                onVoice={onMicVoice}
                look={micLook}
                onLook={onMicLook}
                hint={micHint}
                mics={mics}
                deviceId={micDeviceId}
                onDevice={onMicDevice}
                dotRef={micDotRef}
              />
              {/* before the mic is up, say the one thing worth saying */}
              {!micOn && (
                <div className="mt-auto pt-3 text-[11px] leading-relaxed text-muted/50">
                  🎧 Headphones keep the mic yours — speakers bleed back in.
                </div>
              )}
            </div>
          ) : midi ? (
            // MIDI — the hardware door. One arm switch and your gear is IN
            // the room: keys play over the mix on the engine's own master
            // chain (the Sets deck's contract, lib/midi-live), and the kit's
            // knobs and pads ride the desk itself — tap a control, twist a
            // knob, it's bound (the map keeps across sessions).
            <div className="flex h-[calc(100%-3.25rem)] flex-col">
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                the wire
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onMidiToggle}
                  aria-pressed={midi.enabled}
                  title={
                    midi.enabled
                      ? "Put the hardware down"
                      : "Arm your gear — keys play over the mix, knobs ride the desk"
                  }
                  className={`flex h-9 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium uppercase tracking-[0.12em] transition active:scale-[.97] ${
                    midi.enabled
                      ? "text-white"
                      : "bg-white/[0.06] text-foreground/90 hover:bg-white/[0.1]"
                  }`}
                  style={
                    midi.enabled
                      ? {
                          backgroundImage: HOT_GRADIENT,
                          boxShadow: "0 0 30px -8px rgba(224,49,156,0.9)",
                        }
                      : undefined
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition ${
                      midi.enabled ? "bg-white" : "bg-white/[0.12]"
                    }`}
                    style={
                      midi.enabled
                        ? { boxShadow: "0 0 10px rgba(255,255,255,0.9)" }
                        : undefined
                    }
                  />
                  live
                </button>
                {/* the device: which gear is on the wire — tap cycles when
                    several are plugged in (hot-plug keeps this honest) */}
                <button
                  onClick={onMidiInput}
                  disabled={midi.inputs.length < 2}
                  title={
                    midi.inputs.length > 1
                      ? "Switch which device plays"
                      : midi.inputs.length === 1
                        ? "The connected device"
                        : "Plug in your keys or kit — it lights up here"
                  }
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted/70 transition enabled:hover:bg-white/[0.08] disabled:cursor-default"
                >
                  <span className="max-w-full truncate">
                    {midi.inputs.find((i) => i.id === midi.activeInputId)?.name ??
                      midi.inputs[0]?.name ??
                      "no device — plug one in"}
                  </span>
                  {midi.inputs.length > 1 && (
                    <span className="shrink-0 text-muted/40">⇄</span>
                  )}
                </button>
              </div>
              {/* Unarmed, the whole board rests dim — the LIVE pill is the
                  one door (same grammar as the swarm's own pill). */}
              <div
                className={
                  midi.enabled
                    ? "transition-opacity"
                    : "pointer-events-none opacity-35 transition-opacity"
                }
              >
                <div className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                  voice
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {MIDI_INSTRUMENTS.map((inst) => {
                    const worn = midi.instrument.s === inst.s;
                    return (
                      <button
                        key={inst.s}
                        onClick={() => onMidiInstrument(inst.s)}
                        title={inst.hint}
                        aria-pressed={worn}
                        className={`h-8 rounded-full text-[11px] font-medium transition active:scale-[.97] ${
                          worn
                            ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                            : "bg-white/[0.04] text-foreground/85 hover:bg-white/[0.08]"
                        }`}
                      >
                        {inst.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/40">
                  the kit — tap a control, twist a knob
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {KIT_TARGETS.map((t) => {
                    const bound = kitMap[t.id];
                    const armed = learn === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`flex h-8 items-stretch overflow-hidden rounded-full transition ${
                          armed
                            ? "text-white"
                            : bound
                              ? "bg-white/[0.07]"
                              : "bg-white/[0.04] hover:bg-white/[0.07]"
                        }`}
                        style={
                          armed
                            ? {
                                backgroundImage: HOT_GRADIENT,
                                boxShadow: "0 0 26px -8px rgba(224,49,156,0.9)",
                              }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => onLearn(armed ? null : t.id)}
                          title={
                            armed
                              ? "Listening… move a control on your kit (tap again to cancel)"
                              : bound
                                ? `${bound.kind === "cc" ? `CC ${bound.num}` : noteName(bound.num)} rides this — tap to rebind`
                                : t.pad
                                  ? "Tap, then hit a pad or twist a knob on your kit"
                                  : "Tap, then twist a knob on your kit"
                          }
                          className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-1.5 text-[10px] font-medium uppercase tracking-[0.1em] ${
                            armed
                              ? "animate-pulse text-white"
                              : bound
                                ? "text-foreground/90"
                                : "text-muted/70"
                          }`}
                        >
                          <span className="truncate">{armed ? "twist…" : t.label}</span>
                          {!armed && bound && (
                            <span className="shrink-0 font-mono text-[9px] normal-case tracking-normal text-accent-strong">
                              {bound.kind === "cc" ? bound.num : noteName(bound.num)}
                            </span>
                          )}
                        </button>
                        {/* the seam — bound chips fold a quiet ✕ into the same
                            capsule: one hairline, one glyph, one meaning */}
                        {!armed && bound && (
                          <>
                            <span className="my-1.5 w-px shrink-0 bg-white/[0.12]" />
                            <button
                              onClick={() => onUnbind(t.id)}
                              title="Cut the binding"
                              className="w-6 shrink-0 text-[10px] text-muted/50 transition hover:text-foreground"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      )}
      {/* THE SHAKER — one circle in the corner, always in thumb's reach:
          zaltz's own object as the door to the desk. Open, it becomes the ✕
          (one glyph, one meaning). */}
      <button
        onClick={() => {
          setShaking(true); // a shaker SHAKES every time you grab it
          setTimeout(() => setShaking(false), 700); // backstop if the animation can't run
          onToggle();
        }}
        title={
          open
            ? "Leave the show — back to the bench (Esc)"
            : "The show — the picture full-on, the desk in hand"
        }
        aria-expanded={open}
        className={`fixed z-20 flex h-12 w-12 items-center justify-center rounded-full border bg-black/35 backdrop-blur-xl backdrop-saturate-[1.6] transition active:scale-[.94] ${
          open
            ? "border-accent/50 text-accent-strong shadow-[0_0_44px_-10px_rgba(224,49,156,.8),inset_0_1px_0_rgba(255,255,255,.16)]"
            : playing
              ? "border-accent/40 text-accent-strong shadow-[0_0_36px_-10px_rgba(224,49,156,.7),inset_0_1px_0_rgba(255,255,255,.14)] hover:border-accent/60"
              : "border-white/[0.14] text-muted/80 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] hover:border-accent/40 hover:text-accent-strong hover:shadow-[0_0_30px_-10px_rgba(224,49,156,.6),inset_0_1px_0_rgba(255,255,255,.14)]"
        }`}
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* The shaker never becomes an ✕ (user 07-27): it IS the mixer —
            tap again and the desk goes away, the shaker stays itself. */}
        <span
          className={shaking ? "shaker-shaking" : ""}
          onAnimationEnd={() => setShaking(false)}
        >
          <SaltShaker />
        </span>
      </button>
    </>
  );
}
