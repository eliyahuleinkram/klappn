import { layerAppendPos, layerSignature, stripDuckFamily } from "./reverb-orbits";
import { SOUND_CATALOG } from "./sound-catalog";
import { barSeconds, beatsPerBar, transformForPlayback, type MixSound } from "./playback";
import { computeLoopBars } from "./loop-length";

/** Every device plays the full original — the low-CPU mobile twin is retired
 *  (ZALTZ synthesizes on the audio thread; phones keep up with the real mix). */
function pickCode(strudel: string | null | undefined): string {
  return strudel || "";
}
import {
  attachHydraBlock,
  extractHydra,
  hasHydra,
  type SongVisual,
} from "./hydra-embed";
import type { PartRow, SongRow } from "./songs";
import type { SetEntry, SetTransition } from "./sets";

/**
 * LIVE SET channel routing — the machinery behind the deck's three kill
 * switches (Drums · Bass · Melody).
 *
 * A kill must be INSTANT — this is a live set. Pattern-level muting
 * (`.gain(0)`) only affects notes triggered AFTER the next evaluate, so a
 * sustained bass note (or a reverb wash) rings on for seconds. Instead, every
 * layer is routed to an ORBIT DECADE by channel — drums → 10–19, bass → 20–29,
 * melody → 30–39 — and a kill is a Web Audio gain ramp on those orbit buses:
 * immediate, tails included, and un-killing brings the music back mid-note,
 * exactly like the kill EQ on a real mixer (the set keeps running underneath).
 *
 * Within a decade, layers with DIFFERENT reverb/delay signatures get different
 * orbits (same crackle rule as assignReverbOrbits: one effect bus is built
 * exactly once); identical signatures share.
 */

export type Channel = "drums" | "bass" | "melody";
export const CHANNELS: Channel[] = ["drums", "bass", "melody"];

export const CHANNEL_ORBIT_BASE: Record<Channel, number> = {
  drums: 10,
  bass: 20,
  melody: 30,
};
const DECADE = 10;

/** The channel an orbit number belongs to, or null for orbits outside the
 *  set's decades (e.g. the song page's 1..n merge-assigned orbits). */
export function channelOfOrbit(orbit: number): Channel | null {
  for (const ch of CHANNELS) {
    const base = CHANNEL_ORBIT_BASE[ch];
    if (orbit >= base && orbit < base + DECADE) return ch;
  }
  return null;
}

// Word-boundary'd where a bare substring bites (`hat`→"that", `tom`→"tomorrow",
// `low`→"slow", `sub`→"subtle"); prefix-open where suffixes are wanted
// ("kicks", "percussion", "breakbeat").
const DRUM_LABEL =
  /kick|snare|hi-?hats?\b|\bhats?\b|perc|drum|clap|shaker|cymbal|\btoms?\b|\bride\b|crash|\brim|cowbell|conga|bongo|cajon|darbuka|djembe|taiko|tabla|mridangam|timpani|tambourine|clave|woodblock|guiro|\bkits?\b|\bbeats?\b|groove|\bbreak/;
const BASS_LABEL = /\bbass|\bsubs?\b|\b808|\blow\b/;

// The classifier's sound knowledge comes from SOUND_CATALOG — the same
// annotated roster the chooser prompt is built from — so every loadable sample
// (all 218 Dirt-Samples folders, gm_* soundfonts, synths) is covered and the
// sets can never drift from what actually plays.
const DRUM_ROLES = new Set(["kick", "snare", "clap", "hat", "cymbal", "tom", "perc"]);
// world-role names that are hand percussion (mridangam strokes + the world
// grab-bag) as opposed to melodic world instruments (sitar, koto, dan tranh…)
const WORLD_PERC =
  /^(?:mridangam_)?(?:ardha|chaapu|dhi|dhin|dhum|gumki|ka|ki|na|nam|ta|tha|thom)$|^world$/;
const DRUM_SOUNDS = new Set<string>();
const BASS_SOUNDS = new Set<string>();
for (const s of SOUND_CATALOG) {
  if (DRUM_ROLES.has(s.role) || (s.role === "world" && WORLD_PERC.test(s.name)))
    DRUM_SOUNDS.add(s.name);
  else if (s.role === "bass") BASS_SOUNDS.add(s.name);
}

/** Does the layer explicitly play the bass register? note() letter pitches in
 *  octave 1–2, an all-numeric note() in MIDI 12–47 (C0–B2), or a scale()
 *  rooted in octave 1–2. */
function playsBassRegister(code: string): boolean {
  for (const m of code.matchAll(/\bnote\(\s*["'`]([^"'`]*)["'`]/g)) {
    const p = m[1];
    // sharps spell both ways in strudel: c#2 and cs2
    if (/\b[a-g](?:#|b|s)?[12]\b/i.test(p)) return true;
    if (!/[a-g]/i.test(p) && /\b(?:1[2-9]|2\d|3\d|4[0-7])\b/.test(p)) return true;
  }
  // scale("E1:minor") — also as a pattern, scale("<e1:minor e1:phrygian>")
  return /\.scale\(\s*["'`][\s<]*[a-g](?:#|b|s)?[12]\b/i.test(code);
}

/** Deterministic layer → channel: label first (the track's own name), code
 *  second — so it also works on breaks/hand-offs, which carry no per-track
 *  metadata. Sound names are looked up in the catalog roster above. */
export function classifyLayer(code: string, label?: string): Channel {
  const l = (label || "").toLowerCase();
  if (DRUM_LABEL.test(l)) return "drums";
  if (BASS_LABEL.test(l)) return "bass";
  if (/\.bank\(/.test(code)) return "drums";
  // Every name in every s()/sound() string: mini-notation splits into tokens
  // (`bd:3` → `bd`, `<house:2 house:4>` → `house`); unknowns match nothing.
  let drum = 0;
  let bassy = 0;
  for (const m of code.matchAll(/\b(?:s|sound)\(\s*["'`]([^"'`]*)["'`]/g)) {
    for (const t of m[1].toLowerCase().split(/[^a-z0-9_]+/)) {
      if (!t) continue;
      if (DRUM_SOUNDS.has(t)) drum++;
      else if (BASS_SOUNDS.has(t)) bassy++;
    }
  }
  // note() = pitched; n() is only pitched with a scale — on a raw sample it
  // just picks the variant, so n("0 2").s("tabla") stays drums.
  const pitched =
    /\bnote\(/.test(code) || (/\bn\(/.test(code) && /\.scale\(/.test(code));
  if (drum && !bassy && !pitched) return "drums";
  if (bassy) return "bass";
  if (playsBassRegister(code)) return "bass"; // incl. a re-pitched 808-kick bassline
  if (drum) return "drums"; // pitched drum sample above the bass register
  return "melody";
}

/** Re-bus every `$:` layer onto its channel's orbit decade (stripping any
 *  merge-baked `.orbit(n)` first). `labels` is index-aligned with the `$:`
 *  lines when the loop has per-track metadata. */
export function assignChannelOrbits(
  code: string,
  labels?: (string | undefined)[],
): string {
  if (!code) return code;
  // MUSIC ONLY: stop before the embedded comment blocks (@hydra, @controls,
  // @vcontrols, @vlooks, @swaps, @edits). Without this cap, the LAST layer's
  // segment runs to end-of-code and `.orbit(n)` lands inside the visual code —
  // where `osc(...).out().orbit(31)` is `undefined.orbit`, killing the whole
  // evaluate (a real prod bug: sets wouldn't start on songs with visuals).
  const metaAt = code.search(/\/\*\s*@(?:hydra|controls|vcontrols|vlooks|swaps|edits)\b/);
  const musicEnd = metaAt >= 0 ? metaAt : code.length;
  const tail = code.slice(musicEnd);
  code = code.slice(0, musicEnd);
  const starts: number[] = [];
  for (const m of code.matchAll(/\$:/g)) starts.push(m.index ?? 0);
  if (starts.length === 0) return code + tail;

  // Per-channel: distinct effect signature → distinct slot in the decade.
  const slotOf: Record<Channel, Map<string, number>> = {
    drums: new Map(),
    bass: new Map(),
    melody: new Map(),
  };

  const head = code.slice(0, starts[0]);
  const out: string[] = [head];
  for (let li = 0; li < starts.length; li++) {
    const end = li + 1 < starts.length ? starts[li + 1] : code.length;
    // The stored code carries merge-baked orbits (reverb dedup) — replace them
    // with the channel decade, which preserves the same signature separation.
    // The duck family goes too: its targets were the MERGE orbits, which no
    // longer exist after re-busing (the deck's kills own dynamics here).
    const layer = stripDuckFamily(
      code.slice(starts[li], end).replace(/\.orbit\(\s*\d+\s*\)/g, ""),
    );
    const ch = classifyLayer(layer, labels?.[li]);
    const slots = slotOf[ch];
    const sig = layerSignature(layer);
    let slot = slots.get(sig);
    if (slot === undefined) {
      slot = Math.min(slots.size, DECADE - 1); // decade overflow: share the last bus
      slots.set(sig, slot);
    }
    const at = layerAppendPos(layer);
    out.push(`${layer.slice(0, at)}.orbit(${CHANNEL_ORBIT_BASE[ch] + slot})${layer.slice(at)}`);
  }
  return out.join("") + tail;
}

// --- the shared PERFORMANCE layer -----------------------------------------------
// Both surfaces speak this: the DJ's deck decorates sections with it, and a
// listener's phone (following a live link) decorates the SAME sections with the
// DJ's published state — so every device synthesizes the same performance.

export interface PerfState {
  key: number; // ± semitones on top of each song's own transpose
  filter: number; // bipolar: −100 (LP down) .. +100 (HP up), 0 = flat
  echo: number; // master delay send 0..0.7
  punch: number; // master drive 0..0.5
  space: number; // master reverb 0..0.6
}
export const PERF_ZERO: PerfState = { key: 0, filter: 0, echo: 0, punch: 0, space: 0 };

/** The live DJ filter, one bipolar dial: negative sweeps the low-pass down
 *  (kill the highs), positive sweeps the high-pass up (kill the lows), centre
 *  is flat. Log-mapped so the sweep feels even across the range. */
export function filterFreqs(v: number): { brightness?: number; edge?: number } {
  if (v < 0) return { brightness: Math.round(12000 * Math.pow(400 / 12000, -v / 100)) };
  if (v > 0) return { edge: Math.round(20 * Math.pow(100, v / 100)) };
  return {};
}
export function filterDisplay(v: number): string {
  if (v === 0) return "—";
  const f = filterFreqs(v);
  return v < 0 ? `LP ${((f.brightness ?? 0) / 1000).toFixed(1)}k` : `HP ${f.edge}`;
}

export function perfToSound(f: PerfState): MixSound {
  return {
    ...filterFreqs(f.filter),
    echo: f.echo || undefined,
    punch: f.punch || undefined,
    space: f.space || undefined,
  };
}

/** Server-clock estimation for live sync — BOTH sides (DJ publish loop and
 *  listener poll loop) run one of these. Each response yields an NTP-midpoint
 *  sample (serverNow vs the request's local before/after); we TRUST THE SAMPLE
 *  WITH THE SMALLEST ROUND-TRIP rather than the latest, because one slow,
 *  asymmetric response skews the midpoint by half its delay — audibly shifting
 *  the whole crowd's bar grid. A stale best is re-taken so clock drift can't
 *  fossilize an old estimate. */
export function makeClockSync(): {
  sample: (localBefore: number, serverNow: number, localAfter: number) => void;
  /** serverNow − localNow, from the most trusted sample so far. */
  offset: () => number;
} {
  let best = { offset: 0, rtt: Infinity, at: 0 };
  return {
    sample(localBefore, serverNow, localAfter) {
      const rtt = localAfter - localBefore;
      if (rtt < 0) return;
      const offset = serverNow - (localBefore + localAfter) / 2;
      if (rtt <= best.rtt || localAfter - best.at > 60_000)
        best = { offset, rtt, at: localAfter };
    },
    offset: () => best.offset,
  };
}

/** The state the DJ's browser publishes to a live link, and a listener applies. */
export interface LiveState {
  sectionId: string | null;
  paused: boolean;
  nudge: number; // tempo nudge in percent
  perf: PerfState;
  kills: Record<Channel, boolean>;
  at: number; // DJ's clock when published (drift diagnostics)
  /** When the current section's cycle 0 began, in SERVER-clock ms (both sides
   *  estimate their offset to the server from response timestamps) — lets a
   *  listener seek to the DJ's phase instead of starting at bar 1. */
  sectionStartedAt?: number;
  /** LIVE STREAM (Cloudflare Realtime SFU): where the DJ is publishing the AUDIO
   *  mix. A listener subscribes to `session`+`audio` and just plays it — no local
   *  engine, no synthesis. (Visuals are rendered natively on each listener.) */
  broadcast?: { session: string; audio: string };
}

/** Cycles/second for a section (1 cycle = 1 bar): the owning song's tempo ×
 *  the live nudge over its beats-per-bar. What phase-seek converts time with. */
export function sectionCps(id: string, ctx: SetLiveCtx, nudge: number): number {
  const [entryId, rest] = id.split("|");
  const at = ctx.entries.findIndex((e) => e.id === entryId);
  const ownerSongId =
    rest === TRANSITION_REST
      ? ctx.entries[(at + 1) % Math.max(1, ctx.entries.length)]?.songId
      : ctx.entries[at]?.songId;
  const p = planish(ctx.songs[ownerSongId ?? ""]?.song);
  return ((p.bpm || 120) * (1 + nudge / 100)) / 60 / beatsPerBar(p.timeSignature);
}

export interface SetLiveCtx {
  entries: SetEntry[];
  songs: Record<string, { song: SongRow; parts: PartRow[] } | undefined>;
  transitions: Record<string, SetTransition>;
}

interface Planish {
  bpm?: number;
  key?: string;
  transpose?: number;
  timeSignature?: string | null;
  breaks?: Record<string, { options: { label: string; strudel: string; strudelMobile?: string | null }[]; chosen: number | null }>;
  /** Per-loop repeat latches saved on the song page (−1 = forever), keyed by
   *  part id (loops) or `break:<partId>` (the song's own breaks). */
  holdCycles?: Record<string, number>;
  /** The song's ONE canonical visual (see lib/hydra-embed.ts). */
  visual?: Partial<SongVisual>;
}
const planish = (song: SongRow | undefined): Planish =>
  song?.plan && typeof song.plan === "object" ? (song.plan as Planish) : {};

/** A song's ONE visual for set playback: the canonical plan.visual, else the
 *  first loop that carries its own @hydra block (songs painted before
 *  plan.visual became canonical). Null → the song truly has no picture. */
export function songVisualHydra(
  bundle: { song: SongRow; parts: PartRow[] } | undefined,
): string | null {
  if (!bundle) return null;
  const v = planish(bundle.song).visual?.hydra?.trim();
  if (v) return v;
  for (const p of bundle.parts) {
    const h = extractHydra(p.strudel);
    if (h) return h;
  }
  return null;
}

/** Does any song in the set carry a visual? (Whether the set plays under a
 *  picture — the sets-page card player arms/tears the canvas on this.) */
export function setHasVisual(ctx: SetLiveCtx): boolean {
  return Object.values(ctx.songs).some((b) => songVisualHydra(b) !== null);
}

/** Section ids are `${entryId}|${partId}`, `${entryId}|break:${partId}` or
 *  `${entryId}|~` (the hand-off leaving the entry). */
export const TRANSITION_REST = "~";

/** Every live transform for one section: fresh code, channel-orbit routing,
 *  the owning song's plan (a hand-off wears the INCOMING song's), the tempo
 *  nudge and the perf dials. ONE implementation for deck and listeners. */
export function decorateSetSection(
  code: string,
  id: string,
  ctx: SetLiveCtx,
  dials: { nudge: number; perf: PerfState },
): string {
  // dev forensics: visible only alongside the gated __klappnEngine surface
  try {
    if ((globalThis as Record<string, unknown>).__klappnEngine)
      (globalThis as Record<string, unknown>).__klappnLastDials = { id, ...dials };
  } catch {
    /* diagnostics only */
  }
  const [entryId, rest] = id.split("|");
  const at = ctx.entries.findIndex((e) => e.id === entryId);
  const entry = ctx.entries[at];
  const isTransition = rest === TRANSITION_REST;
  const ownerSongId = isTransition
    ? ctx.entries[(at + 1) % Math.max(1, ctx.entries.length)]?.songId
    : entry?.songId;
  const p = planish(ctx.songs[ownerSongId ?? ""]?.song);
  let src = code;
  let labels: (string | undefined)[] | undefined;
  if (!isTransition && rest && !rest.startsWith("break:")) {
    const part = ctx.songs[entry?.songId ?? ""]?.parts.find((x) => x.id === rest);
    if (part?.strudel?.trim()) src = pickCode(part.strudel);
    labels = Array.isArray(part?.tracks)
      ? (part.tracks as { label?: string }[]).map((t) => t.label)
      : undefined;
  }
  src = assignChannelOrbits(src, labels);
  const out = transformForPlayback(src, {
    transpose: (p.transpose || 0) + dials.perf.key,
    bpm: (p.bpm || 120) * (1 + dials.nudge / 100),
    timeSignature: p.timeSignature,
    sound: perfToSound(dials.perf),
    isBreak: isTransition || (rest ?? "").startsWith("break:"),
  });
  // The song's visual rides EVERY section, the way home plays it: a loop that
  // predates the painted visual — or a break/hand-off, which never carries one —
  // still plays under the song's picture. A hand-off wears the INCOMING song's
  // visual, same as its plan. Grafted AFTER the audio transforms so the visual
  // code never rides through them.
  if (!hasHydra(out)) {
    const hydra = songVisualHydra(ctx.songs[ownerSongId ?? ""]);
    if (hydra) return attachHydraBlock(out, hydra);
  }
  return out;
}

// --- the flat section list ----------------------------------------------------
// ONE implementation of "a set as ordered playable sections" — the deck, a
// listener's phone and the sets-page card player all sequence the same list.

/** One playable step of the set. `id` is `${entryId}|${partId}`,
 *  `${entryId}|break:${partId}` (a song's own break) or `${entryId}|~`
 *  (the hand-off leaving this entry) — parsed back by decorateSetSection(). */
export interface SetSection {
  id: string;
  code: string;
  seconds: number;
  entryId: string;
  partId?: string;
  isBreak: boolean;
}

/** Every entry's playable loops in order (RAW code — decorateSetSection applies
 *  the transforms at the moment a section starts), each song's own chosen
 *  breaks between its loops, and the chosen hand-off leaving each entry
 *  (played at the INCOMING song's tempo). `barsFor` lets the caller supply the
 *  ENGINE-MEASURED loop period (lib/strudel-client loopCycles) — the same truth
 *  the song page plays by. Without it the regex estimate over-counts loops with
 *  repeating slowcat elements, and the set held every loop past its real length
 *  (a 54s song stretched past two minutes). */
export function buildSetSections(
  ctx: SetLiveCtx,
  barsFor?: (part: PartRow) => number | undefined,
): SetSection[] {
  const es = ctx.entries;
  const out: SetSection[] = [];
  es.forEach((e, ei) => {
    const bundle = ctx.songs[e.songId];
    if (!bundle) return;
    const p = planish(bundle.song);
    const bs = barSeconds(p.bpm || 120, p.timeSignature);
    const playable = bundle.parts.filter((x) => x.strudel?.trim());
    playable.forEach((part, i) => {
      out.push({
        id: `${e.id}|${part.id}`,
        code: pickCode(part.strudel),
        seconds: (barsFor?.(part) ?? computeLoopBars(part.strudel || "")) * bs,
        entryId: e.id,
        partId: part.id,
        isBreak: false,
      });
      // The song's OWN chosen one-bar break after this loop (within the song only).
      const set = p.breaks?.[part.id];
      const br = set && set.chosen != null ? set.options[set.chosen] : null;
      if (br && i < playable.length - 1) {
        out.push({
          id: `${e.id}|break:${part.id}`,
          code: pickCode(br.strudel),
          seconds: bs,
          entryId: e.id,
          partId: part.id,
          isBreak: true,
        });
      }
    });
    // The HAND-OFF leaving this entry (plays at the INCOMING song's tempo).
    const t = ctx.transitions[e.id];
    const chosen = t && t.chosen != null ? t.options[t.chosen] : null;
    const next = es[(ei + 1) % es.length];
    if (chosen && next && es.length > 1 && playable.length) {
      const np = planish(ctx.songs[next.songId]?.song);
      out.push({
        id: `${e.id}|${TRANSITION_REST}`,
        code: chosen.strudel,
        seconds: barSeconds(np.bpm || 120, np.timeSignature),
        entryId: e.id,
        isBreak: true,
      });
    }
  });
  return out;
}

/** How many times a section plays before the set moves on, from a raw saved
 *  latch: Infinity (forever), a count ≥ 2, or 1 (play once). */
export function holdTargetOf(raw: number | undefined): number {
  const n = Number(raw);
  if (n === -1) return Infinity;
  return Number.isFinite(n) && n > 1 ? Math.trunc(n) : 1;
}

/** The saved repeat target for a section id, read live from its song's plan —
 *  always the arrangement the user last saved on the song page. Hand-offs play
 *  once. */
export function sectionHoldTarget(id: string, ctx: SetLiveCtx): number {
  const [entryId, rest] = id.split("|");
  if (!rest || rest === TRANSITION_REST) return 1;
  const e = ctx.entries.find((x) => x.id === entryId);
  const holds = planish(ctx.songs[e?.songId ?? ""]?.song).holdCycles;
  return holdTargetOf(holds?.[rest]);
}

/** What the dock whispers for a set section: the song's name (breaks and
 *  hand-offs wear their ≋). */
export function setSectionLabel(id: string | null, ctx: SetLiveCtx): string | null {
  if (!id) return null;
  const [entryId, rest] = id.split("|");
  const e = ctx.entries.find((x) => x.id === entryId);
  const songTitle = ctx.songs[e?.songId ?? ""]?.song.title;
  if (rest === TRANSITION_REST) return "≋ Hand-off";
  if (rest?.startsWith("break:")) return songTitle ? `≋ ${songTitle}` : "≋ Break";
  return songTitle ?? "Live set";
}
