"use client";

import { useEffect, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";
import { sentenceLabel } from "@/lib/labels";
import {
  buildPlayEntry,
  type HomePart,
  type HomePlan,
  type PlayEntry,
} from "@/lib/home-sections";
import {
  applyOrbitGains,
  ensurePerfFx,
  playSong,
  setLiveCps,
  setLivePerf,
  setVisuals,
  startIdleVisual,
  stop,
  teardownVisuals,
  updateVisuals,
} from "@/lib/strudel-client";
import {
  assignChannelOrbits,
  channelOfOrbit,
  CHANNELS,
  type Channel,
} from "@/lib/set-live";
import { beatsPerBar, transposePitched } from "@/lib/playback";
import { extractHydra } from "@/lib/hydra-embed";
import {
  clearNowPlaying,
  dockPause,
  dockResume,
  dockStop,
  nowPlaying,
  publishNowPlaying,
  updateNowPlaying,
} from "@/lib/now-playing";
import { useNowPlayingValue } from "@/lib/use-now-playing";

/** What /api/door lists — a whisper of identity, no code. */
export interface DoorSong {
  id: string;
  title: string;
  plan: { bpm?: number; key?: string; genre?: string; timeSignature?: string | null };
}

// The room chips — fixed, tasty amounts. One tap in, one tap out;
// setLivePerf ramps on the audio graph, so the change is INSTANT and clickless.
type FxKey = "filter" | "echo" | "punch" | "space";
const FX_KEYS: FxKey[] = ["filter", "echo", "punch", "space"];
const FX_LABEL: Record<FxKey, string> = {
  filter: "Filter",
  echo: "Echo",
  punch: "Punch",
  space: "Space",
};
function perfValues(f: Record<FxKey, boolean>) {
  return {
    filter: f.filter ? -55 : 0,
    echo: f.echo ? 0.45 : 0,
    punch: f.punch ? 0.4 : 0,
    space: f.space ? 0.5 : 0,
  };
}

/** The @vlooks grades a song ships (one-tap recolours of its picture). */
interface Look {
  name: string;
  set: Record<string, number>;
}
function parseLooks(code: string): Look[] {
  const m = code.match(/\/\*\s*@vlooks\n([\s\S]*?)\n\*\//);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]) as { looks?: Look[] };
    return Array.isArray(parsed.looks) ? parsed.looks.slice(0, 4) : [];
  } catch {
    return [];
  }
}
/** Re-grade a loop's sketch: swap the four const lines for the look's values. */
function regrade(code: string, set: Record<string, number>): string {
  let out = code;
  for (const k of ["vSaturation", "vContrast", "vBrightness", "vHue"]) {
    const v = set[k];
    if (typeof v === "number") {
      out = out.replace(new RegExp(`const ${k} = [-\\d.]+`), `const ${k} = ${v}`);
    }
  }
  return out;
}
/** A tiny swatch colour that EVOKES the look (hue-rotated from the house pink). */
function swatch(set: Record<string, number>): string {
  const hue = (320 + (set.vHue ?? 0) * 360) % 360;
  const sat = Math.max(12, Math.min(95, 40 + (set.vSaturation ?? 1) * 32));
  const lum = Math.max(24, Math.min(78, 52 + (set.vBrightness ?? 0) * 90));
  return `hsl(${Math.round(hue)}deg ${Math.round(sat)}% ${Math.round(lum)}%)`;
}

/**
 * THE DOOR — the signed-out page IS the instrument. One orb starts the run;
 * each song plays through once and hands the room to the next on its wrap
 * downbeat (new picture, new name). Hands-on: kill Drums/Bass/Melody on the
 * engine's own orbit gates, colour the room (Filter/Echo/Punch/Space on the
 * master graph), BEND THE TEMPO live (the scheduler itself pivots — no
 * re-evaluate), SHIFT THE KEY (the song re-enters the sounding section in the
 * new key — same-owner starts crossfade by the engine's takeover law), and
 * re-grade the picture with one tap (the song's own @vlooks).
 *
 * VISUALS ARE DRIVEN EXPLICITLY here (updateVisuals on play/hand-off): the
 * combined-program hydra path can die quietly on prod chunk splits, but the
 * direct sketch-run path always paints. The idle boot RETRIES until the canvas
 * has real pixels — the room must never open black.
 */
export default function DoorGallery({
  songs,
  onVisual,
}: {
  songs: DoorSong[];
  /** A picture holds the room (idle or playing) — the page's glow yields. */
  onVisual?: (up: boolean) => void;
}) {
  const [at, setAt] = useState(0);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [error, setError] = useState(false);
  // The journey's odometer — canonical first/last ids survive key-change
  // restarts that rotate the section list.
  const journeyRef = useRef({ sawLast: false, advancing: false });
  const canonRef = useRef<{ first: string | null; last: string | null }>({
    first: null,
    last: null,
  });
  // Ref-first for anything a gesture must read synchronously (SetClient law).
  const [kills, setKills] = useState<Record<Channel, boolean>>({
    drums: false,
    bass: false,
    melody: false,
  });
  const killsRef = useRef(kills);
  const [fx, setFx] = useState<Record<FxKey, boolean>>({
    filter: false,
    echo: false,
    punch: false,
    space: false,
  });
  const fxRef = useRef(fx);
  // Tempo = live multiplier on the scheduler; Key = semitone shift applied by
  // decorate at (re)evaluate. Refs so the engine reads the tap, not the render.
  const [tempo, setTempo] = useState(1);
  const tempoRef = useRef(1);
  const [keyUi, setKeyUi] = useState(0);
  const keyRef = useRef(0);
  const [look, setLook] = useState<string | null>(null);
  const lastHydraRef = useRef<string | null>(null);
  const codeCache = useRef(new Map<string, PlayEntry>());

  const playingId = useNowPlayingValue(
    (s) => (s?.kind === "song" ? s.id : null),
    null,
  );
  const paused = useNowPlayingValue(
    (s) => s?.kind === "song" && !!s.paused,
    false,
  );
  const [curSectionId, setCurSectionId] = useState<string | null>(null);

  const current = songs.find((s) => s.id === playingId) ?? songs[at % songs.length];
  const isPlaying = !!current && playingId === current.id;
  const sounding = isPlaying && !paused;

  /** The engine cps for a song under the live tempo multiplier. */
  function cpsFor(s: DoorSong, mult: number): number {
    const bpm = s.plan?.bpm || 120;
    return (bpm * mult) / (beatsPerBar(s.plan?.timeSignature) * 60);
  }

  /** Run a section's sketch directly (the path that always paints) — only when
   *  the sketch actually CHANGED, so section boundaries never jump-cut. */
  function pushVisual(code: string | undefined): void {
    if (!code) return;
    const h = extractHydra(code);
    if (h && h !== lastHydraRef.current) {
      lastHydraRef.current = h;
      void updateVisuals(code);
    }
  }

  /** Fetch + build (once per song): sealed payload → sections, then RE-BUS
   *  every layer onto its channel's orbit decade for the kill gates. */
  async function entryFor(s: DoorSong): Promise<PlayEntry | null> {
    let entry = codeCache.current.get(s.id) ?? null;
    if (entry) return entry;
    const res = await fetch(`/api/door/${s.id}`);
    const d = openDeep(
      (await res.json().catch(() => null)) as {
        song?: { plan?: HomePlan };
        parts?: HomePart[];
      } | null,
    );
    const built = buildPlayEntry(d?.parts ?? [], d?.song?.plan ?? {});
    if (!built) return null;
    entry = {
      ...built,
      sections: built.sections.map((sec) => ({
        ...sec,
        code: assignChannelOrbits(sec.code),
      })),
    };
    codeCache.current.set(s.id, entry);
    return entry;
  }

  /** The next stop (the list is already a per-visit shuffle). */
  function nextOf(s: DoorSong): DoorSong | null {
    if (songs.length < 2) return null;
    const from = songs.findIndex((x) => x.id === s.id);
    return songs[(from + 1 + songs.length) % songs.length] ?? null;
  }

  // THE ROOM BREATHES BEFORE THE TAP — prefetch the first song, mount its
  // picture, and RETRY until the canvas holds real pixels (the boot can lose a
  // silent race; the door must never open black).
  useEffect(() => {
    let dead = false;
    let tries = 0;
    const attempt = async () => {
      try {
        const first = songs[0];
        if (!first) return;
        const entry = await entryFor(first);
        if (dead || !entry || !entry.visual) return;
        setVisuals(true);
        await startIdleVisual(entry.sections[0].code);
        if (dead) return;
        lastHydraRef.current = extractHydra(entry.sections[0].code);
        onVisual?.(true);
        setTimeout(() => {
          if (dead || nowPlaying()) return;
          const c =
            document.getElementById("k1-canvas") ??
            document.getElementById("hydra-canvas");
          const painted = c instanceof HTMLCanvasElement && c.width > 0;
          if (!painted && ++tries < 4) void attempt();
        }, 1500);
      } catch {
        /* the door still works without a backdrop */
      }
    };
    void attempt();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section changes build fresh orbit buses at gain 1 — re-assert the kills on
  // a light tick (applyOrbitGains skips buses already at target; Sets' law).
  const killGainFor = (orbit: number): number | undefined => {
    const ch = channelOfOrbit(orbit);
    return ch ? (killsRef.current[ch] ? 0 : 1) : undefined;
  };
  useEffect(() => {
    if (!playingId) return;
    const t = setInterval(() => applyOrbitGains(killGainFor), 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);

  useEffect(() => {
    setLook(null); // a new song brings its own default grade
  }, [playingId]);

  // Leaving the door (signing in!): the music rides along — the dock carries
  // it into the signed-in home. Only a silent page tears the engine down. The
  // room chips reset either way: the app inside must open clean.
  useEffect(
    () => () => {
      const np = nowPlaying();
      if (np) {
        if (np.surfaceMounted) updateNowPlaying({ surfaceMounted: false });
      } else {
        stop();
        teardownVisuals();
      }
      setLivePerf({ filter: 0, echo: 0, punch: 0, space: 0 });
    },
    [],
  );

  async function onPlay(s: DoorSong, startAtId?: string, force = false) {
    if (!force && playingId === s.id) {
      if (paused) void dockResume();
      else dockPause();
      return;
    }
    if (loadingPlay) return;
    setLoadingPlay(true);
    setError(false);
    // CUT at tap time — except a same-song key re-entry, which stays a live
    // session so playSong's same-owner takeover CROSSFADES it.
    const sameSession = force && playingId === s.id;
    if (!sameSession && nowPlaying()) dockStop();
    try {
      const entry = await entryFor(s);
      if (!entry) {
        setError(true);
        return;
      }
      if (!entry.visual) teardownVisuals();
      else setVisuals(true);
      ensurePerfFx();
      setLivePerf(perfValues(fxRef.current));
      const { labels, holds } = entry;
      const cached = entry;
      canonRef.current = {
        first: entry.sections[0].id,
        last: entry.sections[entry.sections.length - 1].id,
      };
      // A key change re-enters the SOUNDING section, not the top of the song.
      const fromAt = startAtId
        ? Math.max(0, entry.sections.findIndex((x) => x.id === startAtId))
        : 0;
      const list = [
        ...entry.sections.slice(fromAt),
        ...entry.sections.slice(0, fromAt),
      ];
      journeyRef.current = { sawLast: false, advancing: false };
      setCurSectionId(list[0].id);
      await playSong(list, {
        owner: s.id,
        // The KEY, applied at evaluate — drums keep their sample pitch.
        decorate: (code) =>
          keyRef.current ? transposePitched(code, keyRef.current) : code,
        onSection: (id) => {
          updateNowPlaying({ sectionLabel: id ? (labels[id] ?? null) : null });
          if (!id) return;
          setCurSectionId(id);
          pushVisual(cached.sections.find((x) => x.id === id)?.code);
          // THE HAND-OFF: wrap detected → this downbeat belongs to the next
          // song. Canonical ids, so key-change rotations don't confuse it.
          const j = journeyRef.current;
          if (id === canonRef.current.first && j.sawLast && !j.advancing) {
            j.advancing = true;
            const upNext = nextOf(s);
            if (upNext) void onPlay(upNext);
            else j.advancing = false;
          } else if (id === canonRef.current.last) {
            j.sawLast = true;
          }
        },
        repeatsFor: (id) => {
          if (
            !id.startsWith("break:") &&
            cached.sections.find((x) => x.id === id)?.arr
          )
            return 1;
          const target = holds[id] ?? 1;
          return Number.isFinite(target) ? target : 1;
        },
        effectsFor: () => cached.effects,
        overlaysFor: () => cached.overlays,
        ending: entry.ending,
        onEnded: () => clearNowPlaying(),
      });
      // The picture is driven HERE — the path that always paints. UNGUARDED on
      // purpose: the combined program's (possibly dead) hydra half can clear
      // the running sketch during evaluate, so play always re-runs it — even
      // when it's the same sketch the idle boot already showed.
      lastHydraRef.current = extractHydra(list[0].code);
      void updateVisuals(list[0].code);
      onVisual?.(entry.visual);
      // The live tempo survives songs and key changes — re-assert on the fresh
      // program (each evaluate re-bakes the song's own setcpm).
      if (tempoRef.current !== 1) setLiveCps(cpsFor(s, tempoRef.current));
      publishNowPlaying({
        kind: "song",
        id: s.id,
        href: "/",
        title: s.title,
        sectionLabel: labels[list[0].id] ?? null,
        paused: false,
        surfaceMounted: true,
      });
      setAt(Math.max(0, songs.findIndex((x) => x.id === s.id)));
      const upNext = nextOf(s);
      if (upNext) void entryFor(upNext).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoadingPlay(false);
    }
  }

  function toggleKill(ch: Channel) {
    const out = { ...killsRef.current, [ch]: !killsRef.current[ch] };
    killsRef.current = out; // ref FIRST — the gate reads it synchronously
    applyOrbitGains(killGainFor);
    setKills(out);
  }

  function toggleFx(k: FxKey) {
    const out = { ...fxRef.current, [k]: !fxRef.current[k] };
    fxRef.current = out;
    ensurePerfFx();
    setLivePerf(perfValues(out));
    setFx(out);
  }

  function onTempo(mult: number) {
    tempoRef.current = mult;
    setTempo(mult);
    if (playingId && current) setLiveCps(cpsFor(current, mult));
  }

  /** Commit a key change: the song re-enters the sounding section transposed —
   *  a same-owner start, so the engine crossfades rather than cuts. */
  function commitKey(v: number) {
    if (v === keyRef.current) return;
    keyRef.current = v;
    setKeyUi(v);
    if (isPlaying && current) {
      void onPlay(current, curSectionId ?? undefined, true);
    }
  }

  function applyLook(l: Look) {
    const entry = current ? codeCache.current.get(current.id) : null;
    if (!entry) return;
    const code = regrade(entry.sections[0].code, l.set);
    lastHydraRef.current = extractHydra(code);
    void updateVisuals(code);
    setLook(l.name);
  }

  if (!songs.length || !current) return null;

  const meta = [
    current.plan?.genre?.trim() ? sentenceLabel(current.plan.genre) : null,
    current.plan?.bpm ? `${current.plan.bpm} BPM` : null,
    current.plan?.key || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const entryNow = isPlaying ? codeCache.current.get(current.id) : null;
  const looks = entryNow ? parseLooks(entryNow.sections[0].code) : [];

  const pill =
    "rounded-full px-4 py-2 text-[13px] font-medium backdrop-blur-xl transition active:scale-[.96]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {/* the whisper — where the run is right now. Re-keyed per song so every
          hand-off RISES in with its new name. */}
      <p
        key={current.id}
        className="animate-rise text-[13px] tabular-nums text-muted/80"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <span className="wordmark text-[17px] tracking-tight text-foreground/90">
          {current.title}
        </span>
        {meta && <span className="mt-0.5 block">{meta}</span>}
      </p>

      {/* THE ORB — one tap, the room fills. It burns while the music sounds. */}
      <button
        onClick={() => void onPlay(current)}
        disabled={loadingPlay}
        aria-label={
          isPlaying
            ? paused
              ? `Resume ${current.title}`
              : `Pause ${current.title}`
            : `Play ${current.title}`
        }
        className="group relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:opacity-70"
        style={{ marginTop: "1.75rem" }}
      >
        <span
          aria-hidden
          className={`absolute -inset-6 rounded-full bg-accent blur-[30px] transition-opacity duration-500 ${
            sounding ? "opacity-45" : "opacity-25 group-hover:opacity-40"
          } ${!isPlaying && !loadingPlay ? "glow-breathe" : ""}`}
        />
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#ff63c1] via-accent to-[#b3126f] transition-shadow duration-300 ${
            sounding
              ? "shadow-[0_0_60px_-6px_rgba(224,49,156,.95),inset_0_2px_0_rgba(255,255,255,.35)]"
              : "shadow-[0_22px_60px_-14px_rgba(224,49,156,.85),inset_0_2px_0_rgba(255,255,255,.35)]"
          }`}
        />
        <span className="relative">
          {loadingPlay ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.6" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          ) : sounding ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4.4" height="14" rx="1.5" />
              <rect x="13.6" y="5" width="4.4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.4v13.2L19 12z" />
            </svg>
          )}
        </span>
      </button>

      {/* Fixed-height stage below the orb: the idle line and the whole deck
          share the SAME reserved space, so the orb never moves. */}
      <div className="mt-7 flex min-h-[13.5rem] w-full flex-col items-center justify-start">
        {!isPlaying ? (
          <p className="mt-9 text-[15px] text-muted">It sounds like this.</p>
        ) : (
          <>
            {/* THE PARTS — lit = in the mix; tap = gone, instantly, tails and all. */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleKill(ch)}
                  aria-pressed={!kills[ch]}
                  className={`${pill} ${
                    kills[ch]
                      ? "border border-white/[0.08] bg-white/[0.03] text-muted/50 line-through"
                      : "border border-accent/25 bg-accent/[0.12] text-foreground shadow-[0_0_24px_-8px_rgba(224,49,156,.8)]"
                  }`}
                >
                  {ch === "drums" ? "Drums" : ch === "bass" ? "Bass" : "Melody"}
                </button>
              ))}
            </div>
            {/* THE ROOM — colour the sound */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              {FX_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleFx(k)}
                  aria-pressed={fx[k]}
                  className={`${pill} ${
                    fx[k]
                      ? "border border-accent/30 bg-accent/20 text-accent"
                      : "border border-white/[0.08] bg-white/[0.04] text-muted hover:text-foreground"
                  }`}
                >
                  {FX_LABEL[k]}
                </button>
              ))}
            </div>
            {/* THE LIGHT — the song's own looks, one tap each */}
            {looks.length > 0 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                {looks.map((l) => (
                  <button
                    key={l.name}
                    title={l.name}
                    aria-label={`Look: ${l.name}`}
                    aria-pressed={look === l.name}
                    onClick={() => applyLook(l)}
                    className={`h-[18px] w-[18px] rounded-full transition active:scale-90 ${
                      look === l.name
                        ? "ring-2 ring-accent/70 ring-offset-2 ring-offset-black"
                        : "ring-1 ring-white/20 hover:ring-white/50"
                    }`}
                    style={{ background: swatch(l.set) }}
                  />
                ))}
              </div>
            )}
            {/* THE PHYSICS — bend the tempo live; shift the key on release */}
            <div className="mt-4 flex w-full max-w-sm flex-col gap-2.5 px-2">
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-left text-[11px] uppercase tracking-widest text-muted/60">
                  Tempo
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.01}
                  value={tempo}
                  onChange={(e) => onTempo(Number(e.target.value))}
                  aria-label="Tempo"
                  className="h-1 min-w-0 flex-1 cursor-pointer accent-[#e0319c]"
                />
                <button
                  onClick={() => onTempo(1)}
                  title="Back to the song's tempo"
                  className="w-16 shrink-0 text-right text-[12px] tabular-nums text-foreground/80 transition hover:text-accent"
                >
                  {Math.round((current.plan?.bpm || 120) * tempo)} BPM
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-left text-[11px] uppercase tracking-widest text-muted/60">
                  Key
                </span>
                <input
                  type="range"
                  min={-7}
                  max={7}
                  step={1}
                  value={keyUi}
                  onChange={(e) => setKeyUi(Number(e.target.value))}
                  onPointerUp={() => commitKey(keyUi)}
                  onKeyUp={() => commitKey(keyUi)}
                  onTouchEnd={() => commitKey(keyUi)}
                  aria-label="Key"
                  className="h-1 min-w-0 flex-1 cursor-pointer accent-[#e0319c]"
                />
                <button
                  onClick={() => commitKey(0)}
                  title="Back to the song's key"
                  className="w-16 shrink-0 text-right text-[12px] tabular-nums text-foreground/80 transition hover:text-accent"
                >
                  {keyUi > 0 ? `+${keyUi}` : keyUi} st
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[13px] text-red-400">
          The run stumbled — tap the orb.
        </p>
      )}
    </div>
  );
}
