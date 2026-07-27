"use client";

import { useRef, useState } from "react";
import { CHANNELS, filterDisplay, type Channel } from "@/lib/set-live";
import DeckSlider from "./DeckSlider";

/** THE SALT SHAKER — the mixer's door, drawn not written: an UPRIGHT glass
 *  shaker you'd recognise on any table (user 07-27: it must LITERALLY look
 *  like one) — steel cap with punched holes, glass body with a settled bed
 *  of salt and a few loose grains above it. Tapping it SHAKES it (the
 *  .shaker-shaking keyframes ride the FAB's wrapper). */
function SaltShaker() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      {/* cap — a steel dome, cinched to screw onto the neck */}
      <path
        d="M9 6.4 L9.35 3.7 C9.48 2.72 10.32 2 11.31 2 L12.69 2 C13.68 2 14.52 2.72 14.65 3.7 L15 6.4 Z"
        fill="#c9ccd6"
      />
      <circle cx="12" cy="3.5" r="0.52" fill="#41444d" />
      <circle cx="10.75" cy="4.8" r="0.52" fill="#41444d" />
      <circle cx="13.25" cy="4.8" r="0.52" fill="#41444d" />
      {/* the glass — flaring gently to a rounded foot */}
      <path
        d="M8.9 7.3 L15.1 7.3 L16.3 18.9 C16.46 20.45 15.25 21.8 13.7 21.8 L10.3 21.8 C8.75 21.8 7.54 20.45 7.7 18.9 Z"
        fill="rgba(255,255,255,0.07)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* the salt — a settled bed, and loose grains still in the air */}
      <path
        d="M8.4 13.8 L15.6 13.8 L16.05 18.9 C16.15 19.95 15.3 20.85 13.7 20.85 L10.3 20.85 C8.7 20.85 7.85 19.95 7.95 18.9 Z"
        fill="rgba(255,255,255,0.92)"
      />
      <circle cx="10.5" cy="11.9" r="0.55" fill="rgba(255,255,255,0.85)" />
      <circle cx="13.1" cy="10.7" r="0.5" fill="rgba(255,255,255,0.7)" />
      <circle cx="11.9" cy="12.8" r="0.45" fill="rgba(255,255,255,0.6)" />
      {/* one long glass highlight */}
      <path
        d="M9.75 8.4 L9.3 18.4"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

export type MixerTab = "music" | "light";

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
}) {
  // The tap's shake — the shaker keeps shaking while the desk rises, and only
  // then hands the circle over to the ✕.
  const [shaking, setShaking] = useState(false);
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
      {open && (
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
          <div className="h-[440px] max-h-[74dvh] overflow-y-auto rounded-[22px] border border-white/[0.14] bg-black/35 p-4 shadow-[0_0_70px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-2xl backdrop-saturate-[1.6] sm:h-[360px] sm:max-h-[56dvh]">
          {/* ONE segmented capsule — two equal halves of the same machined
              control, not two loose pills. */}
          <div className="mb-3.5 flex rounded-full bg-white/[0.04] p-1">
            {(["music", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTab(t)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition active:scale-[.98] ${
                  tab === t
                    ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                    : "text-muted/60 hover:text-foreground"
                }`}
              >
                {t === "light" ? "Visual" : "Sound"}
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
          ) : (
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
          )}
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
            ? "Put the desk down — the picture stays"
            : "The show — the picture full-on, the desk in hand"
        }
        aria-expanded={open}
        className={`fixed z-20 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[.94] ${
          open
            ? "border-accent/50 bg-black/70 text-accent-strong shadow-[0_0_44px_-10px_rgba(224,49,156,.8)]"
            : playing
              ? "border-accent/40 bg-black/55 text-accent-strong shadow-[0_0_36px_-10px_rgba(224,49,156,.7)] hover:border-accent/60"
              : "border-white/[0.1] bg-black/50 text-muted/80 hover:border-accent/40 hover:text-accent-strong"
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
