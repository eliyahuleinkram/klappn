/**
 * THE CONTROL CONTRACT — every control Strudel can put on a hap, and what the
 * zaltz bridge does with it.
 *
 * WHY THIS FILE EXISTS (2026-07-29): three separate bugs shipped because the
 * bridge dropped a control in SILENCE — `.stretch()` was ignored, `.rdim()`
 * was ignored, and `.duck()` never reached the engine at all because Strudel
 * writes it to the hap as `duckorbit` while the bridge only read `duck`. Each
 * one sounded like "zaltz is just different from strudel.cc", and none of them
 * failed a test, because nothing tested COVERAGE — only behaviour we had
 * already thought of.
 *
 * So coverage is a contract now. Every canonical hap key Strudel can emit must
 * appear in exactly one bucket below, and lib/zaltz-controls.test.ts derives
 * that key list FROM STRUDEL ITSELF (it calls each control and reads the hap)
 * rather than from a list we maintain by hand. A control we forget, or one
 * Strudel adds in an upgrade, fails the test with its name. A control we
 * declare unsupported also warns ONCE at runtime when a patch actually uses it
 * — the coder hears about it instead of wondering why the room sounds wrong.
 */

/** Forwarded verbatim as `key/value` — the engine parses the same name. */
export const NUM_KEYS = [
  "attack", "decay", "sustain", "release", "gain", "velocity", "postgain", "pan",
  "lpattack", "lpdecay", "lpsustain", "lprelease", "lpenv", "vib", "vibmod",
  "unison", "spread", "detune", "speed", "begin", "end", "loop", "loopBegin", "loopEnd",
  "orbit", "room", "roomlp", "roomdim", "delay", "delaytime", "delayfeedback",
  "shape", "shapevol", "duckonset", "duckattack", "duckdepth",
  "distort", "distortvol", "tremolodepth", "tremoloskew", "tremolophase",
  "penv", "pattack", "pdecay", "psustain", "prelease", "panchor", "stretch",
  "crush", "coarse", "cut", "drive", "density",
  "phaserrate", "phaserdepth", "phasercenter", "phasersweep",
] as const;

/** Forwarded under a different name (Strudel's key → the engine's key). */
export const RENAME: Record<string, string> = {
  cutoff: "lpf", lpf: "lpf", resonance: "lpq", lpq: "lpq",
  hcutoff: "hpf", hpf: "hpf", hresonance: "hpq", hpq: "hpq",
  size: "roomsize", roomsize: "roomsize", rsize: "roomsize", sz: "roomsize",
};

/** Handled by dedicated logic in hapKv (sound resolution, pitch, the duck
 *  target list, the effect families with string/derived values, timing). */
export const DERIVED = new Set([
  "s", "bank", "n", "note", "freq", "duration",
  "duckorbit", // .duck() AND .duckorbit() both land here — the 07-29 bug
  "distorttype", "tremolo", "tremolosync",
  "ftype", "clip",
]);

/** Consumed by the PATTERN layer before audio (voicing/tonal inputs, editor
 *  metadata). If one survives onto a hap it is inert for sound — forwarding it
 *  would be meaningless, and warning about it would be noise. */
export const PATTERN_LEVEL = new Set([
  "chord", "dictionary", "mode", "anchor", "offset", "octaves",
  "ctranspose", "mtranspose", "degree", "scram", "stepsPerOctave",
  "activeLabel", "label", "color", "uid", "val", "source",
  "cps", "analyze", "fft", "hours", "minutes", "seconds", "frames", "frameRate",
]);

/**
 * NOT PORTED — the honest gaps. Value = why, shown once in the console when a
 * pattern actually uses one, so a coder never has to guess whether zaltz heard
 * them. Adding DSP means moving the key out of here into NUM_KEYS/DERIVED.
 */
export const UNSUPPORTED: Record<string, string> = {};
const gap = (reason: string, ...keys: string[]) => {
  for (const k of keys) UNSUPPORTED[k] = reason;
};

gap("FM synthesis is not ported (superdough fm* operator stack)",
  ...["", 2, 3, 4, 5, 6, 7, 8].flatMap((i) =>
    ["fmattack", "fmdecay", "fmenv", "fmh", "fmi", "fmrelease", "fmsustain", "fmwave"].map((b) => `${b}${i}`)));
gap("wavetable oscillators are not ported",
  "wt", "wtattack", "wtdc", "wtdecay", "wtdepth", "wtenv", "wtphaserand",
  "wtrate", "wtrelease", "wtshape", "wtskew", "wtsustain", "wtsync");
gap("the band-pass filter is not ported (lpf/hpf are)",
  "bandf", "bandq", "bpattack", "bpdc", "bpdecay", "bpdepth", "bpdepthfrequency",
  "bpenv", "bprate", "bprelease", "bpshape", "bpskew", "bpsustain", "bpsync");
gap("filter LFO/shape modulation is not ported (the ADSR envelope is)",
  "lpdc", "lpdepth", "lpdepthfrequency", "lprate", "lpshape", "lpskew", "lpsync",
  "hpattack", "hpdc", "hpdecay", "hpdepth", "hpdepthfrequency", "hpenv",
  "hprate", "hprelease", "hpshape", "hpskew", "hpsustain", "hpsync");
gap("the warp (formant) section is not ported",
  "warp", "warpattack", "warpdc", "warpdecay", "warpdepth", "warpenv", "warpmode",
  "warprate", "warprelease", "warpshape", "warpskew", "warpsustain", "warpsync");
gap("zzfx voices are not ported", "zzfx", "zcrush", "zdelay", "zmod", "znoise", "zrand");
gap("byte-beat sources are not ported", "byteBeatExpression", "byteBeatStartTime");
gap("the per-voice compressor is not ported",
  "compressor", "compressorAttack", "compressorKnee", "compressorRatio", "compressorRelease");
gap("MIDI/OSC output is a browser-side concern, never an engine event",
  "midibend", "midichan", "midicmd", "midimap", "midiport", "miditouch",
  "ccn", "ccv", "ctlNum", "nrpnn", "nrpv", "polyTouch", "progNum", "songPtr",
  "sustainpedal", "sysexdata", "sysexid", "oschost", "oscport", "channel", "channels");
gap("convolution reverb from a sample IR is not ported (the FDN room is)",
  "ir", "irbegin", "irspeed", "roomfade");
gap("spectral/creative effects are not ported",
  "binshift", "bmod", "hbrick", "lbrick", "fshift", "fshiftnote", "fshiftphase",
  "octer", "octersub", "octersubsub", "waveloss", "smear", "freeze", "enhance",
  "comb", "chorus", "leslie", "lrate", "lsize", "djf", "ring", "ringdf", "ringf",
  "vowel", "squiz", "triode", "krush", "kcutoff", "noise", "transient");
gap("per-voice gain shaping beyond gain/velocity/postgain is not ported",
  "overgain", "overshape", "amp", "gate", "hold", "curve", "env", "FXrelease",
  "dry", "bus", "busgain", "expression", "fadeInTime", "fadeTime", "unit", "voice");
gap("sample playback modulation is not ported",
  "accelerate", "deltaSlide", "pitchJump", "pitchJumpTime", "slide",
  "tsdelay", "xsdelay", "delayspeed", "delaysync");
gap("oscillator shaping is not ported",
  "harmonic", "imag", "real", "pw", "pwrate", "pwsweep", "lfo", "lock");
gap("pitch offsets outside note/freq are not ported", "octave", "octaveR", "semitone");
gap("multi-channel panning is not ported (equal-power stereo pan is)",
  "panorient", "panspan", "pansplay", "panwidth");
gap("envelope curve shaping is not ported (linear/exponential are fixed)",
  "pcurve", "fanchor", "nudge");
gap("only the default triangle tremolo shape is ported", "tremoloshape");

/** Every key the bridge knows about, in any capacity. */
export function isClassified(key: string): boolean {
  return (
    (NUM_KEYS as readonly string[]).includes(key) ||
    key in RENAME ||
    Object.values(RENAME).includes(key) ||
    DERIVED.has(key) ||
    PATTERN_LEVEL.has(key) ||
    key in UNSUPPORTED
  );
}
