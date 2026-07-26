"use client";

import { useId } from "react";
import { CHANNELS, filterDisplay, type Channel } from "@/lib/set-live";
import DeckSlider from "./DeckSlider";

/** THE SALT SHAKER — the mixer's door, drawn not written: zaltz is salt, and
 *  this is where you salt the sound. Tilted mid-shake, grains falling; the
 *  body takes the house gradient while the music plays. Gradient id is
 *  per-instance (the shared-id/display:none trap — see CopilotMark). */
function SaltShaker({ lit }: { lit: boolean }) {
  const uid = useId();
  const g = `shaker-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const fill = lit ? `url(#${g})` : "currentColor";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff63c1" />
          <stop offset="55%" stopColor="#e0319c" />
          <stop offset="100%" stopColor="#b3126f" />
        </linearGradient>
      </defs>
      {/* the shaker, tilted mid-pour (cap toward the lower right) */}
      <g transform="rotate(130 11 11)">
        <path
          d="M8.7 7.6 L15.3 7.6 L16.4 17.1 C16.55 18.55 15.4 19.8 13.95 19.8 L10.05 19.8 C8.6 19.8 7.45 18.55 7.6 17.1 Z"
          fill={fill}
          opacity="0.95"
        />
        <rect x="8.2" y="3.4" width="7.6" height="3.1" rx="1.5" fill={fill} opacity="0.75" />
      </g>
      {/* the falling grains — alive while the music plays */}
      <g className={lit ? "animate-pulse" : ""} fill={fill}>
        <circle cx="17.6" cy="15.2" r="1" opacity="0.9" />
        <circle cx="19.6" cy="18.4" r="0.85" opacity="0.7" />
        <circle cx="16.4" cy="19.6" r="0.7" opacity="0.55" />
      </g>
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
  return (
    <>
      {/* THE DESK — a glass slab floating up from the shaker's corner (user
          07-27: the panes own the floor now; the mixer rises over them). */}
      {open && (
        <div
          className="fixed inset-x-3 z-20 sm:inset-x-auto sm:right-4 sm:w-[620px]"
          style={{
            bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 3.9rem)",
          }}
        >
          <div className="max-h-[56dvh] overflow-y-auto rounded-[22px] border border-accent/25 bg-gradient-to-b from-black/80 to-black/60 p-4 shadow-[0_0_70px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center gap-1.5">
            {(["music", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTab(t)}
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] transition active:scale-[.96] ${
                  tab === t
                    ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                    : "bg-white/[0.04] text-muted/60 hover:text-foreground"
                }`}
              >
                {t === "light" ? "hydra" : t}
              </button>
            ))}
          </div>
          {tab === "music" ? (
            <>
              {/* THE CHANNELS — three fixed kill switches, the deck's own
                  row: instant, tails included, back mid-note. */}
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
              <div className="mt-2 grid grid-cols-4 gap-1.5">
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
                        ? "text-white"
                        : "bg-white/[0.04] hover:bg-white/[0.08]"
                    }`}
                    style={{
                      touchAction: "none",
                      ...(heldPad === pad.name
                        ? {
                            backgroundImage: HOT_GRADIENT,
                            boxShadow: "0 0 30px -8px rgba(224,49,156,0.9)",
                          }
                        : {}),
                    }}
                  >
                    <span
                      className={`text-[11px] font-medium tracking-[0.12em] ${
                        heldPad === pad.name ? "text-white" : "text-foreground/85"
                      }`}
                    >
                      {pad.name}
                    </span>
                    <span
                      className={`max-w-full overflow-hidden whitespace-nowrap px-1 text-[8px] uppercase tracking-[0.08em] sm:text-[9px] sm:tracking-[0.14em] ${
                        heldPad === pad.name ? "text-white/70" : "text-muted/45"
                      }`}
                    >
                      hold · {pad.hint}
                    </span>
                  </button>
                ))}
              </div>
              {/* the dials — the deck's grid: whispered label, mono readout,
                  TEMPO/KEY/FILTER centre-detent (double-tap zeroes them) */}
              <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3 sm:gap-x-6">
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
            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3 sm:gap-x-6">
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
          )}
          </div>
        </div>
      )}
      {/* THE SHAKER — one circle in the corner, always in thumb's reach:
          zaltz's own object as the door to the desk. Open, it becomes the ✕
          (one glyph, one meaning). */}
      <button
        onClick={onToggle}
        title={open ? "Close the mixer" : "The mixer — kills, pads, dials"}
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
        {open ? (
          <span className="text-[15px] leading-none">✕</span>
        ) : (
          <SaltShaker lit={playing} />
        )}
      </button>
    </>
  );
}
