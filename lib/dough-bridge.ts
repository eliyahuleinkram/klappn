/**
 * THE DOUGH BRIDGE — superdough hap values → dough engine events.
 *
 * dough (codeberg.org/uzu/dough) speaks flat key/value events with a
 * `dough:"play"` verb; superdough haps carry the same musical intent under
 * slightly different names. This mapper is the WHOLE seam between the pattern
 * layer (unchanged, upstream) and the WASM engine: pure, synchronous,
 * unit-tested, and honest — anything it cannot express in dough yet is
 * returned in `dropped`, so the golden-master harness and the fidelity report
 * can COUNT divergence instead of hiding it.
 *
 * M1 scope (waveform songs): oscillator sources, ADSR, filters (+envelopes),
 * gain/pan, vib, delay, distortion. Samples/gm/reverb-orbit params pass
 * through `dropped` until their milestones land upstream.
 */

export interface DoughEvent {
  dough: "play";
  time: number;
  duration: number;
  [key: string]: string | number;
}

/** superdough → dough source names (dough's `sources` list). */
const SOURCE_MAP: Record<string, string> = {
  sawtooth: "sawtooth",
  saw: "saw",
  sine: "sine",
  triangle: "triangle",
  tri: "tri",
  square: "square",
  pulse: "pulse",
  white: "white",
  pink: "pink",
  brown: "brown",
  // best-effort stand-ins (counted as `approximated`, not dropped):
  supersaw: "sawtooth",
  z_sawtooth: "zawtooth",
  z_square: "zquare",
};

/** Controls that carry over 1:1 (same name, same meaning). */
const DIRECT = new Set([
  "gain",
  "pan",
  "attack",
  "decay",
  "sustain",
  "release",
  "lpf",
  "lpq",
  "hpf",
  "hpq",
  "lpenv",
  "lpattack",
  "lpdecay",
  "lpsustain",
  "lprelease",
  "hpenv",
  "bandf",
  "bandq",
  "delay",
  "delaytime",
  "delayfeedback",
  "vib",
  "vibmod",
  "speed",
  "coarse",
  "crush",
  "orbit",
  "glide",
  "begin",
  "end",
]);

/** superdough name → dough name, where they differ. */
const RENAME: Record<string, string> = {
  cutoff: "lpf",
  resonance: "lpq",
  hcutoff: "hpf",
  hresonance: "hpq",
  shape: "distort", // perceptual stand-in until dough grows a true soft-clip
  distort: "distort",
  postgain: "gain2", // applied by multiplying into gain below
  room: "verb",
};

/** Value keys that are pattern/engine plumbing, never sound (silently ignored). */
const PLUMBING = new Set([
  "s",
  "n",
  "note",
  "freq",
  "duration",
  "clip",
  "legato",
  "cps",
  "cycle",
  "delta",
  "channels",
  "analyze",
  "id",
  "_id_",
  "dough",
]);

export function noteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export interface BridgeResult {
  /** null = this hap has no dough voice yet (unsupported source). */
  event: DoughEvent | null;
  /** Controls dough can't express yet — counted, never hidden. */
  dropped: string[];
  /** Stand-ins in play (supersaw→sawtooth, shape→distort…). */
  approximated: string[];
}

/** One superdough hap value → one dough event at `time` (dough-clock seconds). */
export function hapToDoughEvent(
  value: Record<string, unknown>,
  time: number,
  duration: number,
): BridgeResult {
  const dropped: string[] = [];
  const approximated: string[] = [];
  const s = typeof value.s === "string" ? value.s : "";
  const source = SOURCE_MAP[s];
  if (!source) {
    // samples / gm / banks — later milestones
    return { event: null, dropped: [s ? `s:${s}` : "s:?"], approximated: [] };
  }
  if (source !== s) approximated.push(`${s}→${source}`);

  const ev: DoughEvent = {
    dough: "play",
    time: Math.max(0, time),
    duration: Math.max(0.01, duration),
    sound: source,
  } as DoughEvent;

  // pitch: superdough uses note (midi number, post-tonal) or freq
  const note = value.note ?? value.n;
  if (typeof value.freq === "number") ev.freq = value.freq;
  else if (typeof note === "number") ev.freq = noteToFreq(note);
  else ev.freq = 220;

  let gain = 1;
  for (const [key, raw] of Object.entries(value)) {
    if (raw == null || PLUMBING.has(key)) continue;
    const v = typeof raw === "number" ? raw : typeof raw === "string" ? raw : null;
    if (v === null) continue;
    if (key === "gain" || key === "postgain" || key === "velocity") {
      gain *= typeof v === "number" ? v : 1;
      if (key === "postgain") approximated.push("postgain→gain");
      continue;
    }
    if (DIRECT.has(key)) {
      ev[key] = v;
      continue;
    }
    const renamed = RENAME[key];
    if (renamed) {
      ev[renamed] = v;
      if (key === "shape") approximated.push("shape→distort");
      if (key === "room") approximated.push("room→verb");
      continue;
    }
    dropped.push(key);
  }
  // CALIBRATION PENDING (M1): superdough stages synth voices ×0.3 with ADSR
  // defaults [.001,.05,.6,.01]; dough has its own staging and its envelope
  // words may not mean the same thing (first blind attempt made levels AND
  // envelope correlation WORSE). Match analytically from dough.c, then
  // iterate against the golden harness — never by constant-guessing.
  ev.gain = gain;
  return { event: ev, dropped, approximated };
}

/** Serialize a dough event to its wire form ("key/value/…\0" latin-1 bytes). */
export function encodeDoughEvent(ev: DoughEvent): string {
  return (
    Object.entries(ev)
      .map(([k, v]) => `${k}/${v}`)
      .join("/") + "\0"
  );
}
