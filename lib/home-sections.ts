/**
 * GALLERY PLAYBACK — how a song plays anywhere that isn't its own page: the
 * home gallery and the signed-out door both sequence a whole song from one
 * small (sealed) payload. Extracted from HomeClient so the two galleries share
 * ONE builder — this MUST agree with SongClient.buildSections; a song has to
 * sound the same wherever you pressed play.
 */

import { sentenceLabel } from "@/lib/labels";
import type { SongSection } from "@/lib/strudel-client";
import type { SongArrangement, SongEnding, SongFx } from "@/lib/arrange";
import type { BreakOverlay } from "@/lib/breaks-catalog";
import { barSeconds, transformForPlayback, type MixSound } from "@/lib/playback";
import { computeLoopBars } from "@/lib/loop-length";
import {
  attachHydraBlock,
  extractHydra,
  hasHydra,
} from "@/lib/hydra-embed";

// What the song payload hands back, narrowed to what playback needs.
export interface HomePart {
  id: string;
  label?: string | null;
  strudel?: string | null;
  strudel_mobile?: string | null;
  status?: string;
}
export interface HomeBreakSet {
  options: { label: string; strudel: string; strudelMobile?: string | null }[];
  chosen: number | null;
}
export interface HomePlan {
  bpm?: number;
  timeSignature?: string | null;
  transpose?: number;
  sound?: MixSound;
  breaks?: Record<string, HomeBreakSet>;
  holdCycles?: Record<string, number>;
  /** The model-authored song arrangement — galleries play it exactly like the
   *  song page (lib/arrange renders it inside playSong). */
  arrangement?: SongArrangement | null;
}

/** A saved repeat latch: -1 on the wire = Forever (Infinity), 2/4/8 = a count,
 *  key absent = off. Mirrors SongClient's decodeHolds. */
export function decodeHolds(raw?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const d = Number(v) === -1 ? Infinity : Number(v);
    if (d === Infinity || (Number.isFinite(d) && d > 1)) out[k] = d;
  }
  return out;
}

/** THE SONG, as the song page plays it: every ready loop in order, each followed by
 *  its chosen one-bar break. This MUST agree with SongClient.buildSections — a song
 *  has to sound the same wherever you pressed play. Galleries have no live dials, so
 *  the plan's saved tempo/key/tone bake straight into the section code. */
export function buildHomeSections(parts: HomePart[], plan: HomePlan): SongSection[] {
  const bpm = plan.bpm || 120;
  const timeSignature = plan.timeSignature || "4/4";
  const transpose = plan.transpose || 0;
  const sound = plan.sound;
  const bar = barSeconds(bpm, timeSignature);

  // A still-composing loop is half a thought — the gallery only plays finished ones
  // (the song page, where you watch it build, plays them as they stream).
  // Blueprints (plan.chapters values) are the songs' raw material — kept on
  // the song page, never played. Same exclusion as SongClient.buildSections.
  const blueprints = new Set(
    Object.values((plan as { chapters?: Record<string, string> })?.chapters ?? {}),
  );
  const playable = parts.filter(
    (p) => p.strudel?.trim() && p.status === "ready" && !blueprints.has(p.id),
  );
  const sections: SongSection[] = [];
  // The section's arrangement — MIRRORS SongClient.arrOf: under a transposed
  // mix the one-way overlay lines are dropped (they'd play in the original key
  // against the shifted song); moves/sweeps/bars are pitch-free and stay.
  // (Loop repeats are gone — the unfold's bars ARE the span; plan.holdCycles
  // now only means anything for breaks.)
  const arrOf = (p: HomePart) => {
    const a = plan.arrangement?.sections?.[p.id];
    if (!a) return undefined;
    return transpose !== 0 ? { ...a, overlays: undefined } : a;
  };
  playable.forEach((p, i) => {
    const code = p.strudel as string; // every device plays the original (twin retired)
    sections.push({
      id: p.id,
      code: transformForPlayback(code, { transpose, bpm, timeSignature, sound }),
      // The regex estimate, not the engine measurement the song page refines it to —
      // pressing play in a gallery must not wait on evaluating every loop.
      seconds: computeLoopBars(p.strudel) * bar,
      arr: arrOf(p),
    });
    const next = playable[(i + 1) % playable.length];
    const set = plan.breaks?.[p.id];
    const br =
      set && set.chosen !== null && set.chosen !== undefined
        ? set.options[set.chosen]
        : null;
    if (br && next && next.id !== p.id) {
      const bcode = br.strudel;
      sections.push({
        id: `break:${p.id}`,
        code: transformForPlayback(bcode, {
          transpose,
          bpm,
          timeSignature,
          sound,
          isBreak: true,
        }),
        seconds: bar, // one bar, played once
      });
    }
  });
  // THE song's visual is the first loop carrying a @hydra block — often a LATER loop
  // than the one that starts the mix. buildArrangement() picks the first block it finds,
  // but a song that falls to the stepper paints per section, so stamp it on the head too.
  if (sections.length && !hasHydra(sections[0].code)) {
    const songHydra = sections.map((s) => extractHydra(s.code)).find(Boolean);
    if (songHydra)
      sections[0] = {
        ...sections[0],
        code: attachHydraBlock(sections[0].code, songHydra),
      };
  }
  return sections;
}

/** What the dock whispers as each section sounds. Mirrors SongClient.sectionLabelOf. */
export function sectionLabels(parts: HomePart[], plan: HomePlan): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts)
    out[p.id] = p.label?.trim() ? sentenceLabel(p.label) : "Loop";
  for (const [partId, set] of Object.entries(plan.breaks ?? {})) {
    const br =
      set.chosen !== null && set.chosen !== undefined ? set.options[set.chosen] : null;
    if (br) out[`break:${partId}`] = "≋";
  }
  return out;
}

/** Everything a gallery needs to hand playSong, built once per song and cached
 *  by the caller. Null when the song has nothing ready to play. */
export interface PlayEntry {
  sections: SongSection[];
  labels: Record<string, string>;
  holds: Record<string, number>;
  effects: SongFx[];
  overlays: BreakOverlay[];
  visual: boolean;
  ending?: SongEnding | null;
  /** Each loop section's RAW strudel + the bar length — so a gallery can
   *  refine the baked regex seconds to the ENGINE-MEASURED period after play
   *  starts (loopCycles), the same truth the song page plays by. */
  raw: { id: string; code: string }[];
  bar: number;
}

export function buildPlayEntry(parts: HomePart[], plan: HomePlan): PlayEntry | null {
  const sections = buildHomeSections(parts, plan);
  if (!sections.length) return null;
  const byId = new Map(parts.map((p) => [p.id, p.strudel ?? ""]));
  return {
    sections,
    raw: sections
      .filter((s) => !String(s.id).startsWith("break:"))
      .map((s) => ({ id: s.id, code: byId.get(s.id) ?? "" })),
    bar: barSeconds(plan.bpm || 120, plan.timeSignature || "4/4"),
    labels: sectionLabels(parts, plan),
    holds: decodeHolds(plan.holdCycles),
    effects: (plan as { effects?: SongFx[] }).effects ?? [],
    overlays: (plan as { overlays?: BreakOverlay[] }).overlays ?? [],
    visual: hasHydra(sections[0].code),
    // Mirrors SongClient.endingOf: a transposed mix drops the ending's
    // pitched one-shot but keeps the stop itself.
    ending:
      (plan.transpose || 0) !== 0 && plan.arrangement?.ending?.code
        ? { ...plan.arrangement.ending, code: undefined }
        : (plan.arrangement?.ending ?? null),
  };
}
