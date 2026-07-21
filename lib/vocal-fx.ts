/**
 * VOCAL FX — the production chain a finished take plays through, over the song.
 *
 * Topology (serial, then four parallel sends into the output bus):
 *   in → HPF → main comp
 *      → saturation (tanh, drive-scaled) → presence/air EQ
 *      → live character stage (true bypass at rest — see setLiveCharacter)
 *      → [ dry | glow doubler | ping-pong echo | plate ] → master (level)
 *      → soft-clip guard (transparent below ±0.9; the output node)
 *
 * PHASE-SAFE BY CONSTRUCTION — the chain is strictly serial into the sends.
 * The old two-band de-esser (LR2 split + a 6 ms delay matching an ASSUMED
 * DynamicsCompressor look-ahead) combed (~166 Hz spacing = hollow/underwater)
 * on any engine where that assumption was off, so it's GONE, replaced by
 * nothing: the echo loop already darkens its repeats with its own lowpass,
 * and the air knob's shelf is 0-centered — sibilance is a knob you never
 * turned up, not a band we split and re-glue.
 *
 * Contracts:
 *   - BaseAudioContext only: also runs on OfflineAudioContext for offline
 *     bounces, so LFOs start immediately and nothing touches live-ctx APIs.
 *   - set() ramps every audible param over 30 ms — no zipper noise.
 *   - dispose() stops oscillators and breaks the echo feedback cycle; a
 *     convolver tail with a live feedback loop would otherwise keep the
 *     graph alive after the caller lets go.
 */

export interface VocalFxSettings {
  level: number; // 0..1.5 output gain
  air: number; // 0..1 presence + air EQ (and de-esser relief at low values)
  glow: number; // 0..1 stereo doubler/chorus wet
  drive: number; // 0..1 saturation amount
  echo: number; // 0..1 tempo-synced ping-pong delay wet
  space: number; // 0..1 plate-style reverb wet
}

export const defaultVocalFx: VocalFxSettings = {
  level: 1,
  air: 0.35,
  glow: 0.15,
  drive: 0.1,
  echo: 0.15,
  space: 0.25,
};

export interface VocalChain {
  input: AudioNode; // connect the source here
  output: AudioNode; // caller connects this to the sink
  set(fx: Partial<VocalFxSettings>): void;
  /** LIVE CHARACTER — the instant approximation of a VOICES chip while the
   *  PSOLA re-render bakes: a granular pitch shifter (ratio 2^(semis/12),
   *  formant ignored — artifacts read as intent) plus a 30 Hz ring-mod for
   *  Robot, inserted before the sends. `{}`/undefined fields = true bypass
   *  (dry path, LFOs frozen — the stage costs nothing at rest). The baked
   *  render replaces this: reset to bypass when it hot-swaps in. */
  setLiveCharacter(c: { semis?: number; robot?: boolean }): void;
  dispose(): void;
}

const RAMP = 0.03;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function ramp(ac: BaseAudioContext, p: AudioParam, v: number): void {
  const now = ac.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(v, now + RAMP);
}

// --- saturation ----------------------------------------------------------

/** The WaveShaper only interpolates over input [-1, 1]; anything hotter gets
 *  hard-clamped to the endpoints (= digital clipping, not tanh). So the tanh
 *  curve is baked over a wider span and a fixed 1/SPAN gain sits in front:
 *  effective transfer stays exactly tanh(v) for |v| ≤ SPAN, which covers the
 *  max pre-gain (1 + 3·drive ≤ 4) with headroom. */
const SHAPER_SPAN = 5;

function tanhCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * SHAPER_SPAN);
  }
  return curve;
}

// --- output guard -----------------------------------------------------------

/** Safety soft-clip on the bus: dead-transparent below ±0.9 (exact identity —
 *  normal program never touches it), then a tanh knee asymptoting at ±1.2.
 *  Extreme knob stacks (level 1.5 × drive × echo+plate sends landing in
 *  phase) can push peaks past full scale; without this the sink hard-clips
 *  with digital foldover harshness. Same wide-span trick as the drive shaper:
 *  curve baked over ±GUARD_SPAN with a 1/GUARD_SPAN gain in front, so hot
 *  signals stay inside the shaper's interpolated input range. Knee slope is 1
 *  at the ±0.9 junction (tanh'(0)=1), so there's no kink to alias. */
const GUARD_SPAN = 4;

function guardCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const T = 0.9;
  const LIM = 1.2;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = ((i / (n - 1)) * 2 - 1) * GUARD_SPAN;
    const a = Math.abs(v);
    curve[i] =
      a <= T ? v : Math.sign(v) * (T + (LIM - T) * Math.tanh((a - T) / (LIM - T)));
  }
  return curve;
}

// --- plate impulse --------------------------------------------------------

/** Generated stereo plate: 24 ms pre-delay, 2.4 s decorrelated noise tail
 *  with pow(1-t, 2.2) amplitude decay and a one-pole lowpass whose smoothing
 *  tightens over the tail — bright early reflections, dark tail, like a real
 *  plate losing its top end as it rings out. */
function makePlateImpulse(ac: BaseAudioContext): AudioBuffer {
  const rate = ac.sampleRate;
  const pre = Math.floor(rate * 0.024);
  const tail = Math.floor(rate * 2.4);
  const buf = ac.createBuffer(2, pre + tail, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0; // one-pole state
    for (let i = 0; i < tail; i++) {
      const t = i / tail;
      // Fresh noise per channel — decorrelation is what makes it wide.
      const x = Math.random() * 2 - 1;
      // Smoothing coefficient falls bright→dark across the tail.
      const k = 0.65 - 0.6 * t;
      y += k * (x - y);
      d[pre + i] = y * Math.pow(1 - t, 2.2);
    }
    // Zero the tail's DC: one-pole-filtered noise carries a small random DC
    // residue, and a convolver whose IR sums non-zero passes (and colors) any
    // low-frequency lean in the input. Subtract it ENVELOPE-WEIGHTED — a flat
    // subtraction would leave the IR ending on a step (= a click baked into
    // the impulse); scaling the correction by the decay shape keeps both
    // endpoints exactly where the envelope put them. The pre-delay region is
    // untouched createBuffer zeros — truly silent by construction.
    let sumD = 0;
    let sumE = 0;
    for (let i = 0; i < tail; i++) {
      const e = Math.pow(1 - i / tail, 2.2);
      sumD += d[pre + i];
      sumE += e;
    }
    const lean = sumE > 0 ? sumD / sumE : 0;
    for (let i = 0; i < tail; i++)
      d[pre + i] -= lean * Math.pow(1 - i / tail, 2.2);
  }
  return buf;
}

// --- live character: dual-delay granular pitch shifter ----------------------

interface LiveShifter {
  input: GainNode;
  output: GainNode;
  setRatio(r: number): void;
  dispose(): void;
}

/** The classic dual-delay granular ("Doppler") pitch shifter — a local port of
 *  the live-mic shifter (strudel-client's mic block; reimplemented here so the
 *  vocal chain owns its own copy). Two delay taps whose delayTime rides a
 *  sawtooth ramp — a steadily changing delay IS a pitch shift (rate =
 *  1 − d(delay)/dt) — with the two ramps 180° apart and each tap
 *  amplitude-windowed by a triangle LFO whose trough sits exactly on its
 *  ramp's wrap, so the delay-time jump is never audible. ~90 ms grains:
 *  audible warble on sustained notes, but this is a live APPROXIMATION of a
 *  baked character on purpose.
 *
 *  Phase trick: an OscillatorNode has no phase knob, so the 180° offset and
 *  the window alignment are built from START TIMES at a fixed startup rate.
 *  Offsets in RADIANS survive later frequency writes as long as every LFO
 *  gets the same frequency at the same time — which setRatio guarantees.
 *  setRatio(1) is a TRUE bypass: dry through, LFOs frozen at frequency 0. */
function makeLiveShifter(ac: BaseAudioContext): LiveShifter {
  const W = 0.09; // grain window (sec) — the delay sweep span
  const F0 = 4; // startup LFO rate; only the start-time phase math uses it
  const T0 = 1 / F0;
  const input = ac.createGain();
  const output = ac.createGain();
  // dry switch: bypass routes AROUND the delays (and freezes the LFOs at
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
    const rampOsc = ac.createOscillator();
    rampOsc.type = "sawtooth";
    rampOsc.frequency.value = F0;
    const slope = ac.createGain(); // ±W/2 — the sign picks shift direction
    slope.gain.value = W / 2;
    rampOsc.connect(slope);
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
    rampOsc.start(t0 + k * (T0 / 2));
    winOsc.start(t0 + k * (T0 / 2) + 0.75 * T0);
    freqs.push(rampOsc.frequency, winOsc.frequency);
    slopes.push(slope.gain);
    stoppable.push(rampOsc, winOsc);
    all.push(d, rampOsc, slope, winOsc, winScale, amp);
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

// --- the chain ------------------------------------------------------------

export function createVocalChain(
  ac: BaseAudioContext,
  bpm: number,
): VocalChain {
  const fx: VocalFxSettings = { ...defaultVocalFx };

  // 1. rumble filter
  const input = ac.createGain();
  const hpf = ac.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 90;
  // WebAudio quirk: for lowpass/highpass ONLY, Q is in DECIBELS (the spec
  // computes alpha with 10^(Q/20)). −3.01 dB = linear 0.7071 = Butterworth,
  // maximally flat. (The old 0.7 meant +0.7 dB ≈ Q 1.08 — a subtle resonant
  // bump right at the cut, the opposite of a cleanup filter's job.)
  hpf.Q.value = -3.01;
  input.connect(hpf);

  // 2. main compressor (straight off the HPF — see the header note on why
  //    there is deliberately NO band-split de-esser in this chain)
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.12;
  hpf.connect(comp);

  // 4. saturation: rampable pre/post gains around a FIXED tanh curve — drive
  //    changes never rebuild the curve (that would click).
  const satPre = ac.createGain();
  const satSpan = ac.createGain();
  satSpan.gain.value = 1 / SHAPER_SPAN;
  const shaper = ac.createWaveShaper();
  shaper.curve = tanhCurve();
  shaper.oversample = "2x";
  const satPost = ac.createGain();
  comp.connect(satPre);
  satPre.connect(satSpan);
  satSpan.connect(shaper);
  shaper.connect(satPost);

  // 5. tone
  const presence = ac.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 3500;
  presence.Q.value = 1;
  presence.gain.value = 0;
  const airShelf = ac.createBiquadFilter();
  airShelf.type = "highshelf";
  airShelf.frequency.value = 11000;
  airShelf.gain.value = 0;
  satPost.connect(presence);
  presence.connect(airShelf);

  // 5b. LIVE CHARACTER STAGE — bookends between the tone section and the
  //     sends, so a chip tap changes the sound INSTANTLY while the PSOLA
  //     re-render bakes. At rest it's one pass-through gain (charDry = 1);
  //     the shifter + ring-mod rig is built LAZILY on the first non-bypass
  //     setLiveCharacter — a take that never wears a live character pays
  //     nothing. Every send below taps charOut, not airShelf.
  const charIn = ac.createGain();
  const charDry = ac.createGain();
  charDry.gain.value = 1;
  const charOut = ac.createGain();
  airShelf.connect(charIn);
  charIn.connect(charDry);
  charDry.connect(charOut);
  interface CharRig {
    shifter: LiveShifter;
    wet: GainNode;
    ringDry: GainNode;
    ringGain: GainNode;
    ringScale: GainNode;
    ringCarrier: OscillatorNode;
    ringWet: GainNode;
  }
  let charRig: CharRig | null = null;
  const ensureCharRig = (): CharRig => {
    if (charRig) return charRig;
    // serial: shifter (its own internal bypass at ratio 1) → ring stage
    // (parallel dry/wet around the multiply — a frozen carrier outputs 0, so
    // the multiply path alone would halve the voice) → whole-stage wet.
    const shifter = makeLiveShifter(ac);
    charIn.connect(shifter.input);
    const wet = ac.createGain();
    wet.gain.value = 0;
    const ringDry = ac.createGain();
    ringDry.gain.value = 1;
    // ROBOT — ring mod: voice × (0.5 + 0.5·sin 30 Hz), the Dalek tremor.
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
    shifter.output.connect(ringDry);
    ringDry.connect(wet);
    shifter.output.connect(ringGain);
    ringGain.connect(ringWet);
    ringWet.connect(wet);
    wet.connect(charOut);
    charRig = { shifter, wet, ringDry, ringGain, ringScale, ringCarrier, ringWet };
    return charRig;
  };
  const setLiveCharacter = (c: { semis?: number; robot?: boolean }): void => {
    const semis = Number.isFinite(c.semis) ? (c.semis as number) : 0;
    const robot = !!c.robot;
    const active = semis !== 0 || robot;
    if (!active && !charRig) return; // nothing built = already true bypass
    const rig = ensureCharRig();
    const t = ac.currentTime;
    const setP = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, 0.02);
    };
    setP(charDry.gain, active ? 0 : 1);
    setP(rig.wet.gain, active ? 1 : 0);
    // ratio 2^(semis/12); 1 = the shifter's own true bypass (LFOs frozen).
    rig.shifter.setRatio(active ? Math.pow(2, semis / 12) : 1);
    setP(rig.ringDry.gain, robot ? 0 : 1);
    setP(rig.ringWet.gain, robot ? 1 : 0);
    // the ring carrier only spins while Robot is on — frozen otherwise
    rig.ringCarrier.frequency.setValueAtTime(robot ? 30 : 0, t);
  };

  // 7. output bus (sends sum here; master gain = level), then the safety
  //    soft-clip guard (see guardCurve) — the guard is the chain's OUTPUT so
  //    nothing hotter than a rounded ±1.2 can ever reach the sink.
  const master = ac.createGain();
  const guardIn = ac.createGain();
  guardIn.gain.value = 1 / GUARD_SPAN;
  const guard = ac.createWaveShaper();
  guard.curve = guardCurve();
  guard.oversample = "2x";
  master.connect(guardIn);
  guardIn.connect(guard);

  // 6a. dry
  const dry = ac.createGain();
  dry.gain.value = 1;
  charOut.connect(dry);
  dry.connect(master);

  // 6b. glow: two short modulated delays panned wide — a doubled take, not a
  //     wobble (depth 1.8 ms stays under pitch-warble territory).
  const glowWet = ac.createGain();
  glowWet.gain.value = 0;
  const lfos: OscillatorNode[] = [];
  const glowVoice = (base: number, rateHz: number, pan: number) => {
    const delay = ac.createDelay(0.05);
    delay.delayTime.value = base;
    const lfo = ac.createOscillator();
    lfo.frequency.value = rateHz;
    const depth = ac.createGain();
    depth.gain.value = 0.0018;
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start(); // immediately — OfflineAudioContext renders from t=0
    lfos.push(lfo);
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    charOut.connect(delay);
    delay.connect(panner);
    panner.connect(glowWet);
  };
  glowVoice(0.014, 0.55, -0.6);
  glowVoice(0.021, 0.7, 0.6);
  glowWet.connect(master);

  // 6c. echo: dotted-eighth ping-pong; lowpass INSIDE the feedback loop so
  //     each repeat darkens — repeats recede instead of stacking sibilance.
  const beat = bpm > 0 ? (60 / bpm) * 0.75 : 0.375;
  const echoTime = clamp(beat, 0.12, 1.2);
  const echoL = ac.createDelay(1.5);
  echoL.delayTime.value = echoTime;
  const echoR = ac.createDelay(1.5);
  echoR.delayTime.value = echoTime;
  const echoFb = ac.createGain();
  echoFb.gain.value = 0.35;
  const echoLp = ac.createBiquadFilter();
  echoLp.type = "lowpass";
  echoLp.frequency.value = 3800;
  const echoPanL = ac.createStereoPanner();
  echoPanL.pan.value = -0.7;
  const echoPanR = ac.createStereoPanner();
  echoPanR.pan.value = 0.7;
  const echoWet = ac.createGain();
  echoWet.gain.value = 0;
  charOut.connect(echoL);
  echoL.connect(echoPanL);
  echoL.connect(echoR); // L feeds R…
  echoR.connect(echoPanR);
  echoR.connect(echoFb); // …and R feeds back into L, darkened
  echoFb.connect(echoLp);
  echoLp.connect(echoL);
  echoPanL.connect(echoWet);
  echoPanR.connect(echoWet);
  echoWet.connect(master);

  // 6d. space
  const verb = ac.createConvolver();
  verb.buffer = makePlateImpulse(ac);
  const spaceWet = ac.createGain();
  spaceWet.gain.value = 0;
  charOut.connect(verb);
  verb.connect(spaceWet);
  spaceWet.connect(master);

  const apply = (next: Partial<VocalFxSettings>) => {
    if (next.level !== undefined) fx.level = clamp(next.level, 0, 1.5);
    if (next.air !== undefined) fx.air = clamp(next.air, 0, 1);
    if (next.glow !== undefined) fx.glow = clamp(next.glow, 0, 1);
    if (next.drive !== undefined) fx.drive = clamp(next.drive, 0, 1);
    if (next.echo !== undefined) fx.echo = clamp(next.echo, 0, 1);
    if (next.space !== undefined) fx.space = clamp(next.space, 0, 1);

    ramp(ac, master.gain, fx.level);
    ramp(ac, presence.gain, fx.air * 3);
    ramp(ac, airShelf.gain, fx.air * 5);
    ramp(ac, glowWet.gain, fx.glow * 0.8);
    const pre = 1 + 3 * fx.drive;
    ramp(ac, satPre.gain, pre);
    // Compensate the tanh peak loss so drive changes color, not loudness.
    ramp(ac, satPost.gain, 1 / Math.tanh(pre));
    ramp(ac, echoWet.gain, fx.echo * 0.85);
    ramp(ac, spaceWet.gain, fx.space * 0.9);
  };
  apply(fx); // snap the graph to defaults before anything plays

  return {
    input,
    output: guard,
    set: apply,
    setLiveCharacter,
    dispose() {
      for (const lfo of lfos) {
        try {
          lfo.stop();
        } catch {
          /* offline ctx may have finished */
        }
      }
      if (charRig) {
        charRig.shifter.dispose();
        try {
          charRig.ringCarrier.stop();
        } catch {
          /* already stopped */
        }
        for (const n of [
          charRig.wet,
          charRig.ringDry,
          charRig.ringGain,
          charRig.ringScale,
          charRig.ringCarrier,
          charRig.ringWet,
        ]) {
          try {
            n.disconnect();
          } catch {
            /* already gone */
          }
        }
        charRig = null;
      }
      // Break the feedback cycle FIRST — a connected loop keeps ringing (and
      // keeps the nodes alive) even after the rest is disconnected.
      echoLp.disconnect();
      echoFb.disconnect();
      for (const node of [
        input,
        hpf,
        comp,
        satPre,
        satSpan,
        shaper,
        satPost,
        presence,
        airShelf,
        charIn,
        charDry,
        charOut,
        dry,
        glowWet,
        echoL,
        echoR,
        echoPanL,
        echoPanR,
        echoWet,
        verb,
        spaceWet,
        master,
        guardIn,
        guard,
      ]) {
        node.disconnect();
      }
    },
  };
}

// --- presets ---------------------------------------------------------------

export interface VocalPreset {
  id: string;
  label: string;
  settings: VocalFxSettings;
}

export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: "true",
    label: "True",
    settings: { level: 1, air: 0.25, glow: 0.05, drive: 0.05, echo: 0.08, space: 0.18 },
  },
  {
    id: "silk",
    label: "Silk",
    settings: { level: 1, air: 0.6, glow: 0.2, drive: 0.08, echo: 0.12, space: 0.38 },
  },
  {
    id: "neon",
    label: "Neon",
    settings: { level: 1, air: 0.5, glow: 0.5, drive: 0.25, echo: 0.45, space: 0.3 },
  },
  {
    id: "cathedral",
    label: "Cathedral",
    settings: { level: 1, air: 0.4, glow: 0.15, drive: 0.05, echo: 0.2, space: 0.85 },
  },
  {
    id: "tape",
    label: "Tape",
    settings: { level: 1, air: 0.15, glow: 0.25, drive: 0.5, echo: 0.35, space: 0.25 },
  },
  {
    id: "close",
    label: "Close",
    settings: { level: 1, air: 0.45, glow: 0, drive: 0.15, echo: 0.04, space: 0.08 },
  },
];
