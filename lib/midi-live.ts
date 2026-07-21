/**
 * LIVE MIDI INSTRUMENTS — a hardware keyboard played OVER a live set.
 *
 * Web MIDI note-ons become one-off engine voices via triggerLiveNote
 * (lib/strudel-client): each note fires superdough directly on the engine's
 * own AudioContext, so it lands on the same master chain as the music
 * (limiter → perf FX → broadcast tap) — the performer hears it locally AND
 * every stream listener hears it on the one broadcast stream, automatically.
 *
 * LATENCY: direct triggers BYPASS the pattern scheduler — no compile, no
 * cycle-boundary wait — a note costs ~12ms of onset lead-in plus the
 * context's output latency. That's the right trade for live playing;
 * quantized patterns stay the music's domain.
 *
 * GATE: superdough one-shots take their whole envelope at trigger time —
 * there is no live gate to release on note-off. So durations are FIXED by
 * instrument family (percussive/bass/lead 0.8s, keys 1.2s, pads 1.5s) and
 * note-off does nothing; the sustain pedal (CC64) stretches the duration of
 * notes struck WHILE it's down (×2.5) — it can't retro-extend a sounding one.
 *
 * SET-ONLY by design: the deck (components/SetClient.tsx) is the sole caller.
 */
import {
  preloadSamples,
  registerMidiActiveProbe,
  triggerLiveNote,
} from "./strudel-client";

export interface MidiInstrument {
  /** The engine sound — every name verified against GM_SOUNDS in
   *  lib/sound-palette.ts (an unknown name would play silence). */
  s: string;
  name: string;
  hint: string;
  /** Fixed voice length (sec) — see the GATE note above. */
  duration: number;
}

/** The deck's six curated instruments — one tap each, no menus. */
export const MIDI_INSTRUMENTS: MidiInstrument[] = [
  { s: "gm_epiano1", name: "Keys", hint: "Warm electric piano", duration: 1.2 },
  { s: "gm_piano", name: "Piano", hint: "Grand piano", duration: 1.2 },
  { s: "gm_synth_bass_1", name: "Bass", hint: "Round synth bass", duration: 0.8 },
  { s: "gm_lead_2_sawtooth", name: "Lead", hint: "Bright saw lead", duration: 0.8 },
  { s: "gm_pad_warm", name: "Pad", hint: "Soft warm pad", duration: 1.5 },
  { s: "gm_kalimba", name: "Pluck", hint: "Plucky thumb piano", duration: 0.8 },
];

export interface MidiInputInfo {
  id: string;
  name: string;
}

export interface MidiSnapshot {
  supported: boolean;
  enabled: boolean;
  inputs: MidiInputInfo[];
  activeInputId: string | null;
  instrument: MidiInstrument;
}

let access: MIDIAccess | null = null;
let accessPromise: Promise<MIDIAccess | null> | null = null;
let enabled = false;
let activeInputId: string | null = null;
let instrument: MidiInstrument = MIDI_INSTRUMENTS[0];
let sustain = false;
let mockInputs: MidiInputInfo[] | null = null; // dev-only (see __mockMidi)
const subs = new Set<(s: MidiSnapshot) => void>();

function supported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.requestMIDIAccess === "function"
  );
}

function inputList(): MidiInputInfo[] {
  if (mockInputs) return mockInputs;
  if (!access) return [];
  const out: MidiInputInfo[] = [];
  access.inputs.forEach((inp) =>
    out.push({ id: inp.id, name: inp.name || "MIDI keyboard" }),
  );
  return out;
}

/** The whole live-MIDI state, one snapshot — what the deck renders from. */
export function midiState(): MidiSnapshot {
  return {
    supported: supported() || !!mockInputs,
    enabled,
    inputs: inputList(),
    activeInputId,
    instrument,
  };
}

/** The currently known inputs (empty until the device watch has opened). */
export function listMidiInputs(): MidiInputInfo[] {
  return inputList();
}

function notify(): void {
  const snap = midiState();
  for (const cb of subs) {
    try {
      cb(snap);
    } catch {
      /* a broken subscriber never mutes the keyboard */
    }
  }
}

function onMessage(e: MIDIMessageEvent): void {
  if (!enabled) return;
  // handlers sit on EVERY input; only the chosen one plays
  const src = e.target as MIDIInput | null;
  if (src && activeInputId && src.id !== activeInputId) return;
  const d = e.data;
  if (!d || d.length < 2) return;
  const status = d[0] & 0xf0;
  if (status === 0x90 && (d[2] ?? 0) > 0) {
    noteOn(d[1], d[2] ?? 100);
  } else if (status === 0xb0 && d[1] === 64) {
    sustain = (d[2] ?? 0) >= 64;
  }
  // note-off (0x80, or 0x90 at velocity 0): nothing to do — one-shot
  // envelopes, see the GATE note in the header.
}

// POLYPHONY CAP — live must never overload. Superdough voices are one-shots
// that self-expire (there is no live gate to steal), so the honest cap is on
// the TRIGGER rate: each fired note is tracked until its fixed duration ends,
// and a note-on while 8 are still notionally sounding is REFUSED — an arm
// mashed across the keys costs at most 8 voices per longest-duration window,
// never an unbounded pile of overlapping envelopes.
const MAX_LIVE_VOICES = 8;
let liveVoiceExpiry: number[] = [];

/** Notionally sounding voices right now (the perf probe's counter). */
function activeVoices(): number {
  const now = performance.now();
  if (liveVoiceExpiry.length && liveVoiceExpiry[0] <= now)
    liveVoiceExpiry = liveVoiceExpiry.filter((t) => t > now);
  return liveVoiceExpiry.length;
}
registerMidiActiveProbe(activeVoices);

function noteOn(note: number, velocity: number): void {
  const duration = instrument.duration * (sustain ? 2.5 : 1);
  if (activeVoices() >= MAX_LIVE_VOICES) return; // see the cap note above
  liveVoiceExpiry.push(performance.now() + duration * 1000);
  liveVoiceExpiry.sort((a, b) => a - b);
  // velocity → gain: a perceptual-ish power curve WITH a floor, so ghost
  // notes still speak and a full strike sits at ~0.9 (superdough's own
  // pattern default is 0.8 — the keyboard may ride just over the mix).
  const v = Math.min(Math.max(velocity, 1), 127) / 127;
  const gain = 0.12 + 0.78 * Math.pow(v, 1.6);
  triggerLiveNote({
    s: instrument.s,
    note,
    gain,
    duration,
  });
}

/** Keep every input's handler bound and the active pick honest — called at
 *  open and on every statechange (HOT-PLUG: keyboards come and go mid-set). */
function bindInputs(): void {
  if (!access) return;
  access.inputs.forEach((inp) => {
    inp.onmidimessage = onMessage;
  });
  const list = inputList();
  if (!list.some((i) => i.id === activeInputId))
    activeInputId = list[0]?.id ?? null;
}

async function ensureAccess(): Promise<MIDIAccess | null> {
  if (!supported()) return null;
  if (access) return access;
  if (!accessPromise) {
    accessPromise = (async () => {
      try {
        // Skip when this origin was already told no — requestMIDIAccess
        // would reject anyway; this keeps consoles clean across deck opens.
        try {
          const p = await navigator.permissions?.query?.({
            name: "midi" as PermissionName,
          });
          if (p?.state === "denied") return null;
        } catch {
          /* browsers without a 'midi' permission name — just try below */
        }
        const a = await navigator.requestMIDIAccess({ sysex: false });
        access = a;
        a.onstatechange = () => {
          bindInputs();
          notify();
        };
        bindInputs();
        return a;
      } catch {
        return null; // denied / platform failure → the deck shows no pill
      }
    })();
  }
  const a = await accessPromise;
  if (!a) accessPromise = null; // a later open may retry (permission flips)
  notify();
  return a;
}

/** Deck-side subscription: starts the device watch and streams every state
 *  change — hot-plug included — to the UI. Returns an unsubscribe.
 *  NB: on Chromium ≥124 the FIRST requestMIDIAccess shows a permission
 *  prompt (remembered per-origin); a deny keeps the deck MIDI-free — the
 *  same posture as having no device. */
export function subscribeMidi(cb: (s: MidiSnapshot) => void): () => void {
  subs.add(cb);
  cb(midiState());
  void ensureAccess();
  return () => {
    subs.delete(cb);
  };
}

/** Arm the keyboard: open access (if the watch hasn't already), pick the
 *  first input, and warm every curated soundfont. True once armed. */
export async function enableLiveMidi(): Promise<boolean> {
  const a = await ensureAccess();
  if (!a && !mockInputs) return false;
  enabled = true;
  sustain = false;
  if (!activeInputId) activeInputId = inputList()[0]?.id ?? null;
  // Warm ALL six fonts now — each is one tap away, and an unwarmed pick
  // would fetch+parse its soundfont on the first played note (a limp).
  void preloadSamples(MIDI_INSTRUMENTS.map((i) => `s("${i.s}")`));
  notify();
  return true;
}

/** Put the keyboard down. Access (and the hot-plug watch) stays open — it's
 *  cheap, and the pill needs to keep tracking devices. Safe if never armed. */
export function disableLiveMidi(): void {
  enabled = false;
  sustain = false;
  notify();
}

/** Pick the instrument by engine sound name (one of MIDI_INSTRUMENTS). */
export function setMidiInstrument(s: string): void {
  instrument =
    MIDI_INSTRUMENTS.find((i) => i.s === s) ??
    // an uncurated name still plays (verified names only reach here from the
    // deck, but the module shouldn't dead-end on a caller's experiment)
    { s, name: s, hint: s, duration: 1 };
  notify();
}

/** Choose which connected input plays (the deck capsule cycles these). */
export function setMidiInput(id: string): void {
  if (!inputList().some((i) => i.id === id)) return;
  activeInputId = id;
  notify();
}

// --- DEV-ONLY test surface --------------------------------------------------
// The preview pane has no MIDI hardware. These drive the exact note-on path
// (velocity curve, sustain, instrument) and force the deck row visible for
// screenshots. NODE_ENV is inlined at build — prod bundles compile these to
// no-ops and never install the window handle.

/** Dev-only: dispatch a fake note-on through the real path. */
export function __testNote(note = 60, velocity = 100): void {
  if (process.env.NODE_ENV === "production") return;
  noteOn(note, velocity);
}

/** Dev-only: pretend a keyboard is connected (pill + row appear). */
export function __mockMidi(on: boolean): void {
  if (process.env.NODE_ENV === "production") return;
  mockInputs = on ? [{ id: "mock", name: "Mock MK-249" }] : null;
  if (!on && activeInputId === "mock") activeInputId = null;
  notify();
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__klappnMidi = {
    testNote: __testNote,
    mock: __mockMidi,
    enable: enableLiveMidi,
    disable: disableLiveMidi,
    state: midiState,
  };
}
