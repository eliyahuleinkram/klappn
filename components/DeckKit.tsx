"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import DeckSlider from "./DeckSlider";
import {
  getLiveMicLevel,
  type LiveMicVoice,
} from "@/lib/strudel-client";

/**
 * THE DECK KIT — the DJ surface's shared vocabulary, extracted 2026-07-28
 * (user's law: "the DJ part should be the same on both the sets and the live
 * coding experience — we do not want people to have to relearn it every
 * time"). The Sets deck and the zaltz desk render THESE, never their own
 * re-stylings: one pink, one chip, one machined group, one mic world.
 */

// THE ONE PINK — the house gradient, worn identically by every lit control.
export const HOT_GRADIENT =
  "linear-gradient(135deg, #ff63c1 0%, #e0319c 55%, #b3126f 100%)";
export const LIT_PILL: CSSProperties = {
  backgroundImage: HOT_GRADIENT,
  boxShadow: "0 0 22px -6px rgba(224,49,156,0.7)",
};
export const LIT_CHIP: CSSProperties = {
  backgroundImage: HOT_GRADIENT,
  boxShadow: "0 0 14px -4px rgba(224,49,156,0.7)",
};

/** One deck chip — VOICE, LOOK and SOUND all wear exactly this. */
export function DeckChip({
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
export function DeckRowLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
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
export function DeckGroup({ children }: { children: ReactNode }) {
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

// ── THE MIC WORLD ────────────────────────────────────────────────────────────

/** The mic's dial positions — plain 0..1; the Web Audio ranges live in
 *  lib/strudel-client (setLiveMicFx). */
export type MicFx = {
  level: number;
  echo: number;
  space: number;
  drive: number;
  glow: number;
};

export const MIC_DEVICE_KEY = "klappn:live-mic-device";
export const MIC_HINT_KEY = "klappn:live-mic-hint";
export const MIC_HINT_LINE =
  "Headphones keep the mic yours — speakers bleed back in.";

export interface MicDevice {
  deviceId: string;
  label: string;
}

/** Device labels arrive as hardware strings — strip the noise ("Default -"
 *  prefixes, "(Built-in)", USB vendor:product hex ids), keep the name. */
export function cleanMicLabel(label: string): string {
  return (
    label
      .replace(/^(default|communications)\s*[-–]\s*/i, "")
      .replace(/\s*\((built-?in|[0-9a-f]{4}:[0-9a-f]{4})\)\s*/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || "Microphone"
  );
}

// The VOICE characters — caricature filters on the live mic (lib/strudel-client
// setLiveMicVoice): tap one, it lands instantly, echo and space ride the
// character too. Natural is always first — the way back home.
export const MIC_VOICES: { id: LiveMicVoice; name: string; hint: string }[] = [
  { id: "natural", name: "Natural", hint: "Your own voice" },
  { id: "deep", name: "Deep", hint: "Pitched down — the trailer voice" },
  { id: "chipmunk", name: "Chip", hint: "Pitched up — helium" },
  { id: "robot", name: "Robot", hint: "Ring-mod metal" },
  { id: "phone", name: "Phone", hint: "Down the line" },
];

// The LOOKS — one-tap seats for the live voice, same names and order the
// studio's VOCAL_PRESETS wore (lib/vocal-fx), re-voiced for the live chain
// (no air shelf here; level 0.7 ≈ unity after the lib's ×1.5 headroom).
export const MIC_LOOKS: { id: string; name: string; fx: MicFx }[] = [
  { id: "true", name: "True", fx: { level: 0.7, echo: 0.08, space: 0.18, drive: 0.05, glow: 0.05 } },
  { id: "silk", name: "Silk", fx: { level: 0.7, echo: 0.12, space: 0.38, drive: 0.08, glow: 0.2 } },
  { id: "neon", name: "Neon", fx: { level: 0.7, echo: 0.45, space: 0.3, drive: 0.25, glow: 0.5 } },
  { id: "cathedral", name: "Cathedral", fx: { level: 0.7, echo: 0.2, space: 0.85, drive: 0.05, glow: 0.15 } },
  { id: "tape", name: "Tape", fx: { level: 0.7, echo: 0.35, space: 0.25, drive: 0.5, glow: 0.25 } },
  { id: "close", name: "Close", fx: { level: 0.7, echo: 0.04, space: 0.08, drive: 0.15, glow: 0 } },
];

/**
 * THE MIC'S WORLD — the whole unfolded group, ONE component worn by the Sets
 * deck and the zaltz desk alike: level meter first (you are the signal), the
 * five VOICE characters, the six LOOK seats, Level/Echo/Space dials, the
 * device capsule, and the once-ever headphones whisper. It owns its own meter
 * poll (150ms, style-written — no state, no re-render) and drives the
 * caller's pill dot through `dotRef` so the hot-mic light breathes with the
 * voice on every surface the same way.
 */
export function MicDeckGroup({
  on,
  fx,
  onFx,
  voice,
  onVoice,
  look,
  onLook,
  hint,
  mics,
  deviceId,
  onDevice,
  dotRef,
}: {
  on: boolean;
  fx: MicFx;
  onFx: (patch: Partial<MicFx>) => void;
  voice: LiveMicVoice;
  onVoice: (v: LiveMicVoice) => void;
  /** The worn LOOK's id, or null once a dial has moved off it. */
  look: string | null;
  onLook: (id: string) => void;
  /** The first-open whisper's phase: fading in, dissolving, or gone. */
  hint: "in" | "out" | null;
  /** Every named audioinput (labels exist once permission is granted). */
  mics: MicDevice[];
  /** The sticky device pick, or null for the browser default. */
  deviceId: string | null;
  onDevice: (id: string) => void;
  /** The caller's pill dot — glows with the voice (optional). */
  dotRef?: RefObject<HTMLSpanElement | null>;
}) {
  const meterFillRef = useRef<HTMLDivElement | null>(null);
  const meterPeakRef = useRef<HTMLDivElement | null>(null);
  const meter = useRef({ lvl: 0, peak: 0, peakAt: 0 });
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const lvl = getLiveMicLevel();
      const el = dotRef?.current;
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
      const el = dotRef?.current;
      if (el) {
        el.style.opacity = "";
        el.style.boxShadow = "";
      }
      const fill = meterFillRef.current;
      if (fill) fill.style.clipPath = "inset(0 100% 0 0)";
      const peak = meterPeakRef.current;
      if (peak) peak.style.opacity = "0";
    };
  }, [on, dotRef]);

  // the device list — open/closed is display posture, local to each render site
  const [devOpen, setDevOpen] = useState(false);
  const currentMic = mics.find((m) => m.deviceId === deviceId) ?? mics[0] ?? null;

  if (!on) return null;
  return (
    <DeckGroup>
      {/* THE LEVEL, FIRST — you are the signal. Fast attack / slow release,
          a peak tick that holds a breath; honest zero. */}
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
      {/* VOICE — the five characters. The 🎧 rides the header quietly,
          forever — hover says why. */}
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
              worn={voice === v.id}
              title={v.hint}
              onClick={() => onVoice(v.id)}
            >
              {v.name}
            </DeckChip>
          ))}
        </div>
      </div>
      {/* LOOK — one-tap seats, the studio's names carried live. A dial move
          un-wears the look (the hands own the seat now). */}
      <div>
        <DeckRowLabel>Look</DeckRowLabel>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {MIC_LOOKS.map((l) => (
            <DeckChip key={l.id} worn={look === l.id} onClick={() => onLook(l.id)}>
              {l.name}
            </DeckChip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-5 sm:gap-x-6">
        <DeckSlider
          label="Level"
          value={fx.level}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(fx.level * 100)}%`}
          onChange={(v) => onFx({ level: v })}
        />
        <DeckSlider
          label="Echo"
          value={fx.echo}
          min={0}
          max={1}
          step={0.05}
          display={fx.echo === 0 ? "—" : `${Math.round(fx.echo * 100)}%`}
          onChange={(v) => onFx({ echo: v })}
        />
        <DeckSlider
          label="Space"
          value={fx.space}
          min={0}
          max={1}
          step={0.05}
          display={fx.space === 0 ? "—" : `${Math.round(fx.space * 100)}%`}
          onChange={(v) => onFx({ space: v })}
        />
      </div>
      {/* THE DEVICE — which mic is live; tap for the machined list, the pick
          sticks and a live swap crossfades (lib setLiveMicDevice). */}
      {currentMic && (
        <div>
          <button
            onClick={() => setDevOpen((o) => !o)}
            aria-expanded={devOpen}
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
                devOpen ? "rotate-180" : ""
              }`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {devOpen && (
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
                      setDevOpen(false);
                      onDevice(m.deviceId);
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
      {hint && (
        <p
          className={`animate-fade-in text-center text-[11px] text-muted/50 transition-opacity duration-700 ${
            hint === "out" ? "opacity-0" : "opacity-100"
          }`}
        >
          {MIC_HINT_LINE}
        </p>
      )}
    </DeckGroup>
  );
}
