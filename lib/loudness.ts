/**
 * Loudness ESTIMATE (not true LUFS — no audio is rendered). We can't synthesize
 * audio on the server, but the eval-free interpreter gives us the resolved events
 * with their controls (gain, cutoff, velocity, duration). Combined with a per-
 * sound "how loud is this sound intrinsically" baseline, that's enough to judge
 * the things that actually go wrong in a mix: balance, a buried/inaudible layer,
 * and clip-headroom. It is a PROXY, directionally useful, not exact.
 *
 * The intrinsic baseline is role-based by default (a kick is loud, a hat quiet, a
 * pad mid). It can be made far more accurate by dropping in real measured values
 * (render each sound solo in a browser, measure RMS) into MEASURED — keyed by the
 * exact Strudel name. Until then the role baseline is used.
 */
import { SOUND_CATALOG, type Role } from "./sound-catalog";

// Perceptual baseline per role, 0..1 (rough; relative comparison is what matters).
const ROLE_BASE: Record<Role, number> = {
  kick: 1.0,
  snare: 0.95,
  clap: 0.85,
  hat: 0.4,
  cymbal: 0.65,
  tom: 0.8,
  perc: 0.6,
  bass: 0.95,
  keys: 0.72,
  pad: 0.5,
  lead: 0.8,
  pluck: 0.7,
  guitar: 0.72,
  strings: 0.6,
  brass: 0.85,
  wind: 0.6,
  mallet: 0.58,
  organ: 0.75,
  choir: 0.55,
  synth: 0.75,
  texture: 0.28,
  world: 0.6,
  fx: 0.45,
};

const NAME_ROLE = new Map<string, Role>(
  SOUND_CATALOG.map((e) => [e.name, e.role]),
);

/** Real measured intrinsic loudness (0..1) per EXACT Strudel name. Empty until a
 *  browser render pass fills it; overrides the role baseline when present. */
export const MEASURED: Record<string, number> = {};

/** Intrinsic loudness of a sound, 0..1 — measured value if we have one, else the
 *  role baseline, else a neutral default. */
export function intrinsicLoudness(sound: string): number {
  if (sound in MEASURED) return MEASURED[sound];
  const role = NAME_ROLE.get(sound);
  return role ? ROLE_BASE[role] : 0.6;
}

/** A low-pass cutoff makes a sound quieter/duller; estimate the energy it keeps. */
export function filterWeight(cutoff: unknown): number {
  if (typeof cutoff !== "number" || !Number.isFinite(cutoff)) return 1;
  if (cutoff >= 2000) return 1;
  return Math.max(0.35, 0.35 + (0.65 * cutoff) / 2000);
}
