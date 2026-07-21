import { hardKillTails } from "./strudel-client";
import {
  createVocalChain,
  defaultVocalFx,
  type VocalChain,
  type VocalFxSettings,
} from "./vocal-fx";

/**
 * THE VOCAL LAYER — the song page's one voice, managed like an instrument.
 *
 * A song has at most ONE active voice (the newest take). This module owns its
 * playback: the song page attaches the decoded take once, then starts it
 * whenever the mix starts, at the offset matching WHERE in the mix playback
 * began. The source loops over the mix's full length (`loopSec`) — the buffer
 * is padded with silence out to exactly that length, so a take shorter than
 * the song re-enters each pass IN TIME instead of drifting by its own
 * duration.
 *
 * Module-level singleton, same shape as the engine bridge: the voice rides
 * the ENGINE's AudioContext (never a second one), so the transport's pause
 * (context suspend) freezes it in perfect sync and resume carries it on
 * without this module doing anything.
 *
 * Mute is a dedicated gain in FRONT of the chain (not the level knob — that
 * belongs to the user) so muting never loses the mix the knobs describe.
 */

interface Attached {
  ac: AudioContext;
  buffer: AudioBuffer;
  chain: VocalChain;
  muteGain: GainNode;
  /** Buffer padded to the last startVocal's loopSec (cached by length). */
  padded: AudioBuffer | null;
  paddedLoopSec: number;
  src: AudioBufferSourceNode | null;
  muted: boolean;
  /** ac.currentTime when the source started (null = not playing) — with the
   *  start offset and loop period this yields vocalPosition(). Pause needs no
   *  bookkeeping: suspending the context freezes currentTime with the audio. */
  startedAt: number | null;
  startOffset: number;
  loopSec: number;
  /** SOLO — the voice alone, no song: a second source straight into the chain
   *  (PAST the mute gain — solo means "let me hear it", whatever the song's
   *  mute chip says), unpadded and un-looped, from an exact offset. */
  soloSrc: AudioBufferSourceNode | null;
  soloStartedAt: number | null;
  soloOffset: number;
}

let at: Attached | null = null;

/** Silence-pad (or truncate the loop window of) the take to exactly loopSec. */
function padTo(ac: AudioContext, buffer: AudioBuffer, loopSec: number): AudioBuffer {
  const want = Math.max(1, Math.round(loopSec * buffer.sampleRate));
  if (buffer.length >= want) return buffer;
  const out = ac.createBuffer(buffer.numberOfChannels, want, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++)
    out.getChannelData(ch).set(buffer.getChannelData(ch));
  return out;
}

/**
 * Seat the take: decoded audio + its saved knobs onto the engine's context.
 * Replaces any previously attached voice. `bpm` times the echo send.
 */
export function attachVocal(
  ac: AudioContext,
  buffer: AudioBuffer,
  fx: Partial<VocalFxSettings> & { muted?: boolean },
  sink: AudioNode,
  bpm: number,
): void {
  detachVocal();
  const chain = createVocalChain(ac, bpm);
  chain.set({ ...defaultVocalFx, ...fx });
  const muteGain = ac.createGain();
  muteGain.gain.value = fx.muted ? 0 : 1;
  muteGain.connect(chain.input);
  chain.output.connect(sink);
  at = {
    ac,
    buffer,
    chain,
    muteGain,
    padded: null,
    paddedLoopSec: 0,
    src: null,
    muted: !!fx.muted,
    startedAt: null,
    startOffset: 0,
    loopSec: 0,
    soloSrc: null,
    soloStartedAt: null,
    soloOffset: 0,
  };
}

/**
 * Start (or restart) the voice `offsetSec` into the mix, looping every
 * `loopSec` seconds. Call after the engine is actually sounding — the source
 * shares its clock.
 */
export function startVocal(offsetSec: number, loopSec: number): void {
  if (!at) return;
  stopVocal();
  stopSolo(); // the mix took over — one voice, one source
  const loop = Math.max(0.5, loopSec);
  if (!at.padded || Math.abs(at.paddedLoopSec - loop) > 1e-3) {
    at.padded = padTo(at.ac, at.buffer, loop);
    at.paddedLoopSec = loop;
  }
  const src = at.ac.createBufferSource();
  src.buffer = at.padded;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = loop;
  src.connect(at.muteGain);
  const off = ((offsetSec % loop) + loop) % loop;
  const now = at.ac.currentTime;
  src.start(now, off);
  at.src = src;
  at.startedAt = now;
  at.startOffset = off;
  at.loopSec = loop;
}

export function stopVocal(): void {
  if (!at?.src) return;
  try {
    at.src.stop();
  } catch {
    /* not started */
  }
  try {
    at.src.disconnect();
  } catch {
    /* already */
  }
  at.src = null;
  at.startedAt = null;
}

/** SOLO: play JUST the voice from `fromSec` — no song, no loop, straight
 *  through the same chain and sink the mix uses (so the knobs land on it
 *  live). Bypasses the mute gain: soloing IS the request to hear it. */
export function soloVocal(fromSec: number): void {
  if (!at) return;
  stopVocal();
  stopSolo();
  // TAKEOVER: the mix that just stopped left its reverb/delay tails FROZEN in
  // the engine's suspended orbit buses — the resume below would thaw them
  // right under the solo (the "loop still ringing under the voice" bug). Drop
  // that energy for real, exactly like a loop switch does. No-op when the
  // engine never booted (studio-owned fallback context has no orbits).
  hardKillTails();
  const dur = at.buffer.duration;
  const off = Math.max(0, Math.min(fromSec, Math.max(0, dur - 0.05)));
  const src = at.ac.createBufferSource();
  src.buffer = at.buffer;
  src.connect(at.chain.input); // past the mute gain — see the doc note
  const a = at;
  src.onended = () => {
    if (a.soloSrc !== src) return; // superseded — a newer solo owns the state
    try {
      src.disconnect();
    } catch {
      /* already */
    }
    a.soloSrc = null;
    a.soloStartedAt = null;
  };
  // The engine context may be suspended (the mix was stopped before soloing);
  // solo is its own transport — wake the clock.
  if (at.ac.state !== "running") void at.ac.resume();
  const now = at.ac.currentTime;
  src.start(now, off);
  at.soloSrc = src;
  at.soloStartedAt = now;
  at.soloOffset = off;
}

export function stopSolo(): void {
  if (!at?.soloSrc) return;
  const src = at.soloSrc;
  at.soloSrc = null;
  at.soloStartedAt = null;
  try {
    src.stop();
  } catch {
    /* not started */
  }
  try {
    src.disconnect();
  } catch {
    /* already */
  }
}

export function soloActive(): boolean {
  return !!at?.soloSrc;
}

/** Seconds into the take's own timeline right now (position in the mix,
 *  modulo the loop period — or the exact un-looped position while SOLOING),
 *  or null when the voice isn't playing. Derived from the engine clock, so
 *  it's exact under pause/resume (a suspended context freezes currentTime
 *  along with the audio). */
export function vocalPosition(): number | null {
  if (at?.soloSrc && at.soloStartedAt !== null) {
    const t = at.ac.currentTime - at.soloStartedAt + at.soloOffset;
    return t <= at.buffer.duration ? t : null;
  }
  if (!at?.src || at.startedAt === null) return null;
  const loop = at.loopSec > 0 ? at.loopSec : at.paddedLoopSec;
  if (!(loop > 0)) return null;
  const t = at.ac.currentTime - at.startedAt + at.startOffset;
  return ((t % loop) + loop) % loop;
}

/** Swap in a re-rendered take WITHOUT losing the seat or the beat: same
 *  chain, same knobs, and if the voice is playing it restarts at the exact
 *  position the old render was at (cuts are silence-in-place and re-tunes
 *  preserve the time base, so old and new timelines align sample-for-sample). */
export function updateVocalBuffer(buffer: AudioBuffer): void {
  if (!at) return;
  // The incoming render carries the take's character BAKED in — the live
  // approximation (a VOICES chip tap, see setLiveVocalCharacter) must drop to
  // bypass in the same beat or the voice would be double-shifted.
  at.chain.setLiveCharacter({});
  if (process.env.NODE_ENV !== "production")
    console.log("[klappn] live voice character: reset to bypass (render hot-swap)");
  const pos = vocalPosition();
  const wasSolo = !!at.soloSrc;
  const loop = at.loopSec;
  at.buffer = buffer;
  at.padded = null;
  at.paddedLoopSec = 0;
  if (pos === null) return;
  if (wasSolo) soloVocal(pos);
  else if (loop > 0) startVocal(pos, loop);
}

/** Mute like an instrument — a fast ramp, chain and knobs untouched. */
export function setVocalMuted(muted: boolean): void {
  if (!at) return;
  at.muted = muted;
  const now = at.ac.currentTime;
  const g = at.muteGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(muted ? 0 : 1, now + 0.03);
}

export function setVocalFx(fx: Partial<VocalFxSettings>): void {
  at?.chain.set(fx);
}

/** LIVE CHARACTER — the instant voice-chip approximation on the playing
 *  chain (granular shift + ring-mod, lib/vocal-fx). `{}` = bypass. The baked
 *  PSOLA render resets this automatically when it hot-swaps in
 *  (updateVocalBuffer). No-op when no voice is seated. */
export function setLiveVocalCharacter(c: { semis?: number; robot?: boolean }): void {
  at?.chain.setLiveCharacter(c);
  if (process.env.NODE_ENV !== "production")
    console.log(
      `[klappn] live voice character: semis=${c.semis ?? 0} robot=${!!c.robot} (seated=${!!at})`,
    );
}

export function vocalState(): { attached: boolean; playing: boolean; muted: boolean } {
  return { attached: !!at, playing: !!at?.src, muted: !!at?.muted };
}

/** Let the voice go entirely (a new voice incoming, page unmount, delete). */
export function detachVocal(): void {
  if (!at) return;
  stopVocal();
  stopSolo();
  try {
    at.chain.output.disconnect();
  } catch {
    /* already */
  }
  try {
    at.muteGain.disconnect();
  } catch {
    /* already */
  }
  at.chain.dispose();
  at = null;
}
