"use client";

/**
 * THE DECK'S FADER — one slider, worn everywhere a dial rides a live mix
 * (the Sets deck, the zaltz IDE's season-to-taste desk). Whispered uppercase
 * label, mono readout, accent fill; `bipolar` dials (TEMPO, KEY, FILTER)
 * grow their fill from the centre detent and double-tap back to zero.
 */
export default function DeckSlider({
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
