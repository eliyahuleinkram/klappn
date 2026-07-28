"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import CodePane, {
  type CaretContext,
  type CodePaneHandle,
} from "@/components/CodePane";
import { authClient } from "@/lib/auth-client";
import { attachHydraBlock } from "@/lib/hydra-embed";
import { openDeep } from "@/lib/seal";
import {
  applyOrbitGains,
  disableLiveMic,
  enableLiveMic,
  ensurePerfFx,
  fadeMaster,
  getBroadcastStream,
  playPart,
  setLiveCps,
  setLiveMicDevice,
  setLiveMicFx,
  setLiveMicVoice,
  setLivePerf,
  setLiveSwarm,
  setExplicitVisualsDrive,
  setHydraErrorSink,
  setStrudelErrorSink,
  setVisuals,
  startIdleVisual,
  stop,
  swarmReady,
  unlockAudio,
  updateVisuals,
  type LiveMicVoice,
} from "@/lib/strudel-client";
import {
  MIC_DEVICE_KEY,
  MIC_HINT_KEY,
  MIC_LOOKS,
  type MicDevice,
  type MicFx,
} from "@/components/DeckKit";
import { isDead, publishStream, type Broadcast } from "@/lib/rtc";
import { extractHydra } from "@/lib/hydra-embed";
import BoilerLineup, { type LineupHit } from "@/components/BoilerLineup";
import {
  disableLiveMidi,
  enableLiveMidi,
  midiState,
  recentMidiNotes,
  setMidiCCSink,
  setMidiInput,
  setMidiInstrument,
  setMidiNoteTap,
  subscribeMidi,
  type MidiSnapshot,
} from "@/lib/midi-live";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  assignChannelOrbits,
  channelOfOrbit,
  type Channel,
} from "@/lib/set-live";
import ZaltzMixer, {
  KIT_TARGETS,
  type KitBinding,
  type KitMap,
  type KitTargetId,
  type MixerTab,
  type SwarmDials,
} from "./ZaltzMixer";
import { startTake, stopTake, type TakeFile, type TakeResult } from "@/lib/take-record";
import { transformForPlayback } from "@/lib/playback";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  TOKENS_PER_GHOST,
  tokensForUsdCents,
} from "@/lib/pricing";
import BoilerMark from "@/components/BoilerMark";

/**
 * THE ZALTZ IDE — a live-coding surface where the picture is the room and the
 * code floats on glass. Strudel on the left (the music), Hydra on the right
 * (the light). ⌘↵ evaluates the pane under your fingers; the running set
 * crossfades to the new take, it never cuts.
 *
 * The AI is a bandmate, not an autocomplete: you type an ask, it proposes a
 * whole take, and NOTHING lands until you drop it in. The instrument is free —
 * no account needed; the machine's asks burn PREPAID tokens (price in open
 * code; the launch taste pool closed 2026-07-26, holders grandfathered).
 * A guest session is minted the moment you need one, and everything you make
 * rides onto your email whenever you claim it.
 */

interface Me {
  signedIn: boolean;
  poolOpen?: boolean;
  isGuest?: boolean;
  email?: string | null;
  owner?: boolean;
  remainingTokens?: number | null;
  allowanceTokens?: number;
}

type PaneId = "strudel" | "hydra";

const STARTERS: { name: string; strudel: string; hydra: string }[] = [
  {
    name: "Basement pressure",
    strudel: `setcpm(122/4)
$: s("bd*4").bank("RolandTR909").lpf(300).shape(.15).gain(.9).duck("2").duckdepth(.4)
$: note("a1 [~ a1] ~ [a1 ~]").s("sine").attack(.01).decay(.15).sustain(.7).release(.12).lpf(200).shape(.1).gain(.8)
$: note("[~ <[a3,c4,e4]!2 [g3,c4,e4] [g3,b3,e4]>]*2").s("sawtooth").attack(.004).decay(.2).sustain(0).release(.1).lpf(sine.range(700,1600).slow(8)).delay(.6).delaytime(.3689).delayfeedback(.6).room(.5).roomsize(6).gain(.32).orbit(2)
$: s("[~ hh]*4").bank("RolandTR909").hpf(6500).decay(.05).sustain(0).gain("0.3 0.42").pan(sine.range(.4,.6).slow(3))
$: s("~ ~ rim ~ ~ [~ rim] ~ ~").bank("RolandTR909").hpf(900).delay(.7).delaytime(.3689).delayfeedback(.55).room(.6).roomsize(5).gain(.3).orbit(3)
$: note("<a2 a2 g2 e2>").s("triangle").attack(1.5).release(2).lpf(sine.range(400,900).slow(8)).room(.8).roomsize(8).gain(.22).pan(sine.range(.35,.65).slow(6)).orbit(4)`,
    hydra: `osc(5, 0, 1.4)
  .color(1, .2, .62)
  .rotate(H(saw.slow(4).range(0, 6.283)))
  .modulate(noise(2.5, 0), .22)
  .kaleid(2)
  .contrast(1.4)
  .mult(shape(4, .6, .6).scale(H(sine.slow(2).range(1.1, 1.5))))
  .out()`,
  },
  {
    name: "Supersaw sunrise",
    strudel: `setcpm(138/4)
$: s("bd*4").bank("RolandTR909").shape(.25).gain(.9).duck("2").duckdepth(.5)
$: note("[~ f1]*4").s("sawtooth").lpf(450).decay(.14).sustain(.4).release(.08).gain(.7)
$: note("[~ <[f3,af3,c4]!2 [df3,f3,af3] [ef3,g3,bf3]>]*2").s("supersaw").unison(7).detune(.15).spread(.9).attack(.005).decay(.22).sustain(0).release(.15).lpf(2200).room(.4).roomsize(5).gain(.38).orbit(2)
$: note("f4 c5 af4 f5 c5 af5 g4 c5").s("triangle").decay(.1).sustain(0).release(.1).hpf(400).delay(.7).delaytime(.3261).delayfeedback(.55).room(.5).roomsize(6).gain(.28).pan(sine.range(.35,.65).slow(4)).orbit(3)
$: note("<[f4,af4,c5,ef5] [df4,f4,af4,c5]>").s("supersaw").unison(5).detune(.1).spread(1).attack(1.2).release(1.8).lpf(sine.range(800,2000).slow(8)).phaser(.6).phaserdepth(.7).phasercenter(900).room(.7).roomsize(7).gain(.2).orbit(4)
$: s("[~ hh]*4").bank("RolandTR909").hpf(7500).gain(.35)
$: s("~ cp ~ cp").bank("RolandTR909").room(.45).roomsize(4).gain(.35).orbit(3)`,
    hydra: `osc(3, 0, 1.1)
  .color(1, .45, .75)
  .saturate(1.3)
  .scale(H(sine.slow(4).range(1, 1.35)))
  .kaleid(6)
  .rotate(H(saw.slow(4).range(0, 6.283)))
  .brightness(H(sine.slow(2).range(-.08, .08)))
  .out()`,
  },
  {
    name: "Acid stairwell",
    strudel: `setcpm(132/4)
$: s("bd*4").bank("RolandTR909").shape(.3).gain(.95).duck("2").duckdepth(.55)
$: note("<[a1 a1 a2 a1 [~ a1] a1 c2 a1] [a1 a1 a2 a1 [~ a1] g1 e2 g1]>").s("sawtooth").ftype("ladder").lpf(saw.range(300,2600).slow(4)).lpq(20).lpenv(2.5).lpattack(.002).lpdecay(.12).decay(.15).sustain(0).release(.08).shape(.25).gain("[.55 .7]*4").orbit(2)
$: s("hh*8").bank("RolandTR909").hpf(7000).crush(8).gain("0.25 0.4").pan(sine.range(.42,.58).slow(2))
$: s("~ cp ~ cp").bank("RolandTR909").room(.5).roomsize(4).gain(.38).orbit(3)
$: s("~ ~ ~ [~ oh]").bank("RolandTR909").hpf(5000).gain(.3).room(.3)`,
    hydra: `voronoi(4, 0, .6)
  .color(1, .18, .6)
  .modulateScrollY(osc(2, 0, 0), H(saw.slow(2).range(0, .4)))
  .thresh(H(sine.slow(1).range(.35, .6)))
  .kaleid(3)
  .out()`,
  },
  {
    name: "Dust on the Rhodes",
    strudel: `setcpm(82/4)
$: note("<[f2,af2,c3,g3] [db3,f3,af3,c4] [ef3,g3,bf3,ef4] [c3,ef3,g3,bf3]>").s("gm_epiano1").lpf(sine.range(600,1400).slow(8)).vib("0.8:0.15").attack(.3).release(2).room(.7).roomsize(4).gain(.6).orbit(1)
$: s("crackle*8").density(.4).lpf(3200).hpf(300).room(.5).roomsize(3).gain(.28).orbit(2)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").lpf(400).shape(.1).release(.4).gain(.5).orbit(3)
$: note("<f1 db1 ef1 c1>").s("gm_acoustic_bass").lpf(500).attack(.02).release(1.5).gain(.55).orbit(3)
$: note("<[af4 c5 ~ g4] [f4 ~ af4 ~] [bf4 ~ g4 ef4] [g4 ~ ef4 ~]>").s("gm_vibraphone").lpf(2200).attack(.05).release(1.2).vib("0.6:0.1").delay(.3).delaytime(.5488).room(.8).roomsize(5).gain(.4).orbit(4)
$: s("hh*8").bank("RolandTR808").gain(saw.range(.05,.18).fast(2)).hpf(500).lpf(6000).release(.08).pan(sine.range(.3,.7).slow(4)).room(.4).roomsize(3).orbit(2)`,
    hydra: "",
  },
  {
    name: "A moving room",
    strudel: `setcpm(70/4)
$: note("<[e4 ~ ~ ~ b4 ~ ~ ~] [~ ~ g4 ~ ~ ~ d5 ~] [~ b3 ~ ~ e5 ~ ~ ~] [~ ~ ~ a4 ~ ~ c5 ~]>").s("gm_tubular_bells").attack(.005).decay(1.5).sustain(0).release(.8).lpf(3800).room(.92).roomsize("<4 10 6 14>").gain(.5).pan(sine.range(.3,.7).slow(5)).orbit(2)
$: note("<e2 c2 g1 a1>").s("sine").attack(1).sustain(.8).release(1.5).lpf(150).shape(.1).gain(.5)
$: s("brown*2").attack(1.2).decay(.8).sustain(.4).release(1).lpf(sine.range(300,1200).slow(8)).hpf(60).gain(.2).pan(sine.range(.4,.6).slow(7)).room(.6).roomsize(8).orbit(3)
$: note("<[e3,g3,b3] [c3,e3,g3] [g2,b2,d3] [a2,c3,e3]>").s("triangle").attack(2).release(3).lpf(900).phaser(.3).phaserdepth(.5).room(.85).roomsize(10).gain(.25).orbit(4)`,
    hydra: `noise(1.6, 0)
  .color(.75, .3, .7)
  .modulateScale(shape(3, .4, 1), H(sine.slow(4).range(.2, .6)))
  .luma(.08)
  .scale(H(sine.slow(4).range(1, 1.18)))
  .out()`,
  },
];

const DRAFT_KEY = "zaltz-ide-draft-v1";

/** Engine errors arrive as raw JS strings — translate the known classes into
 *  one line a live coder can act on mid-set. The raw text stays in the
 *  tooltip; unknown classes pass through untouched (never hide the truth). */
/** Still typing, not stuck: the pane ends mid-thought — an unclosed bracket
 *  or quote, or a line hanging on an operator. The error chip holds its
 *  tongue while this is true (user 07-27: `s("` is not a mistake yet). */
function midThought(code: string): boolean {
  const t = code.trimEnd();
  if (!t) return false;
  if ("([{,.:+-*/&|=<>".includes(t[t.length - 1])) return true;
  const line = t.slice(t.lastIndexOf("\n") + 1);
  for (const q of ['"', "'", "`"])
    if ((line.split(q).length - 1) % 2 === 1) return true;
  let open = 0;
  for (const c of t) {
    if (c === "(" || c === "[" || c === "{") open++;
    else if (c === ")" || c === "]" || c === "}") open--;
  }
  return open > 0;
}

function humanizeEngineError(raw: string): string {
  let m = raw.match(/sound not found[:\s]*["'\u2018\u201c]?([\w:.-]+)/i);
  if (m) return `"${m[1]}" isn\u2019t a sound the engine knows \u2014 check the name (gm_\u2026, a bank\u2019s drum letters, or an oscillator).`;
  m = raw.match(/Cannot read propert(?:y|ies) of undefined \(reading ['"](\w+)['"]\)/);
  if (m) return `Something before .${m[1]}() returned nothing \u2014 check that chain (and remember: nothing chains after .out()).`;
  m = raw.match(/(\w+) is not a function/);
  if (m) return `.${m[1]}() isn\u2019t a real method here \u2014 it dies the moment it plays. Check the spelling.`;
  m = raw.match(/(\w+) is not defined/);
  if (m) return `${m[1]} doesn\u2019t exist in this room \u2014 transforms are METHODS, chained onto a source.`;
  if (/\[mini\]|parse error|unexpected token|unmatched|unbalanced/i.test(raw))
    return "The pattern won\u2019t parse \u2014 count your brackets and quotes in the mini-notation.";
  if (/hit max_tokens|max_tokens/.test(raw)) return raw;
  return raw;
}

// (The deck's pads, gradient and dial grid live in components/ZaltzMixer —
// this file keeps only the wiring they pull on.)

/** The Copilot's mark — one bold spark, the sign everyone reads as "AI"
 *  (the same ✦ that fronts the fix chip). Gradient id is per-instance
 *  (useId — the shared-id/display:none trap left the mobile twin
 *  unpainted once). */
function CopilotMark({ on }: { on: boolean }) {
  const uid = useId();
  const grad = `copilot-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const fill = on ? `url(#${grad})` : "currentColor";
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] shrink-0" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff63c1" />
          <stop offset="55%" stopColor="#e0319c" />
          <stop offset="100%" stopColor="#b3126f" />
        </linearGradient>
      </defs>
      <path
        d="M12 3 C13.2 8.6 15.4 10.8 21 12 C15.4 13.2 13.2 15.4 12 21 C10.8 15.4 8.6 13.2 3 12 C8.6 10.8 10.8 8.6 12 3 Z"
        fill={fill}
        opacity={on ? 1 : 0.55}
      />
    </svg>
  );
}




/** Earlier placeholder copy leaked into some saved buffers as real comments —
 *  and it named keyboard chords, which lied on phones. Scrub the known legacy
 *  lines from anything we LOAD (draft or sketch); user-written code is never
 *  touched (exact-line match only). */
const LEGACY_HINT_RE =
  /^[ \t]*\/\/ (?:type, then ⌘↵ — the room hears you|the walls, in code(?: — ⌘↵ paints them)?)[ \t]*\r?\n?/gm;
const scrubLegacyHints = (s: string) => s.replace(LEGACY_HINT_RE, "");

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toLocaleString()}M`;
  return `${Math.round(n / 1000)}k`;
}

const hydraProgram = (hydra: string) => attachHydraBlock("", hydra);

export default function ZaltzIDE({
  initialMe = null,
}: {
  /** Server-read identity so the avatar is right on FIRST paint (no "you"
   *  flash); the full meter still hydrates via /api/me. */
  initialMe?: Pick<Me, "signedIn" | "isGuest" | "email"> | null;
}) {
  const [strudel, setStrudel] = useState(STARTERS[0].strudel);
  const [hydra, setHydra] = useState(STARTERS[0].hydra);

  const [me, setMe] = useState<Me | null>(initialMe);

  // Phones OVERLAY the keyboard — without this the transport (and the ⇥ take
  // pill) vanish behind it the moment a pane focuses.
  const kbInset = useKeyboardInset();
  // Copy law: a phone is NEVER told to press keys it doesn't have — every
  // in-pane hint speaks buttons on touch, chords on desktop.
  const touch = useIsMobile("(pointer: coarse)");

  const [playing, setPlaying] = useState(false);
  const [visualsLive, setVisualsLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // THE COPILOT — ghost completions at the caret (Tab takes, Esc bins).
  const [copilot, setCopilot] = useState(true);
  // A whisper is an INSERTION (text) or a TRIM (an existing line + its
  // quieter rewrite, "" = let it go) — the machine offers subtraction the
  // same way it offers addition (user 07-28).
  const [ghost, setGhost] = useState<{
    pane: PaneId;
    text?: string;
    trim?: { find: string; replace: string };
  } | null>(null);
  const ghostRef = useRef<typeof ghost>(null);
  ghostRef.current = ghost;
  const ghostSeq = useRef(0);
  const ghostAbort = useRef<AbortController | null>(null);
  const mintTried = useRef(false); // one silent guest-mint attempt per visit
  // One cue per SPOT: a caret parked on the same unchanged code never re-asks
  // after the machine already came back empty there.
  const lastCue = useRef({ key: "", empty: false, at: 0 });
  // While a completion is in flight the caret wears a breathing ✦ — you SEE
  // the copilot thinking (cache hits skip it; they land instantly).
  const [pondering, setPondering] = useState<PaneId | null>(null);
  // Copilot-speed trick #2: an LRU of recent completions — revisiting a spot
  // (dismissed ghost, caret wander-and-return) re-shows instantly, no call.
  const ghostLRU = useRef(new Map<string, { g: string; t?: { find: string; replace: string } }>());
  // The out-of-tokens line is said ONCE per visit — after that the burning
  // chip and the redirected \u2726 buttons carry it.
  const spentToldRef = useRef(false);
  const strudelPane = useRef<CodePaneHandle>(null);
  const hydraPane = useRef<CodePaneHandle>(null);


  const [sheet, setSheet] = useState<null | "tokens" | "signin">(null);
  const [mobilePane, setMobilePane] = useState<PaneId>("strudel");

  const runId = useRef(0);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;
  const stateRef = useRef({
    strudel,
    hydra,
    playing,
    visualsLive,
  });
  stateRef.current = { strudel, hydra, playing, visualsLive };

  // ── boot / teardown ────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.add("ide-stage");
    setExplicitVisualsDrive(true); // this surface drives the canvas itself
    setVisuals(true);
    setStrudelErrorSink(({ error }) => setErr(error));
    setHydraErrorSink(({ error }) => setErr(`hydra: ${error}`));
    try {
      if (localStorage.getItem("zaltz-copilot") === "0") setCopilot(false);
    } catch {
      /* default on */
    }
    // ONE LIVE ROOM (user 07-28: projects/renaming/choosing are gone — the
    // page IS the piece, always live): the bench restores exactly where you
    // left it, else opens on the first starter. Nothing to name, nothing to
    // pick.
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { strudel?: string; hydra?: string };
        if (typeof d.strudel === "string") setStrudel(scrubLegacyHints(d.strudel));
        if (typeof d.hydra === "string") setHydra(scrubLegacyHints(d.hydra));
      }
    } catch {
      /* a bad draft never blocks the bench */
    }
    void refreshMe();
    return () => {
      document.body.classList.remove("ide-stage");
      runId.current++;
      try {
        stop();
      } catch {
        /* leaving */
      }
      setStrudelErrorSink(null);
      setHydraErrorSink(null);
      // Never leave a dead bus, a hot dial or a tinted canvas behind for the
      // next surface (the deck's own leave-clean law).
      try {
        applyOrbitGains((orbit) => (channelOfOrbit(orbit) ? 1 : undefined));
        setLivePerf({ filter: 0, echo: 0, punch: 0, space: 0 });
      } catch {
        /* engine already gone */
      }
      const canvas = document.getElementById("hydra-canvas");
      if (canvas) canvas.style.filter = "";
      setVisuals(false);
      setExplicitVisualsDrive(false);
      // The mic goes down with the room — hot capture past the door is a
      // trust problem (the Sets deck's own law).
      try {
        disableLiveMic();
      } catch {
        /* engine already gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The bench survives a reload — every keystroke lands in localStorage (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ strudel, hydra }));
      } catch {
        /* storage full/blocked — the bench just won't survive a reload */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [strudel, hydra]);

  useEffect(() => {
    if (!busy) {
      setWaking(false);
      return;
    }
    const t = setTimeout(() => setWaking(true), 350);
    return () => clearTimeout(t);
  }, [busy]);

  async function refreshMe() {
    try {
      const res = await fetch("/api/me");
      if (res.ok) setMe((await res.json()) as Me);
    } catch {
      /* offline — chips degrade */
    }
  }

  /** A session on demand: the visitor plays first; identity appears the moment
   *  it's needed (first save / first ask) as a silent guest — no form, no wall.
   *
   *  RESILIENCE (2026-07-26, seen live on mobile Safari): a session can EXIST
   *  while meRef still says otherwise — /api/me races the first tap on a slow
   *  network — and minting on top of a live anonymous session 403s (the plugin
   *  refuses guest-on-guest). So: re-read identity before minting, and after a
   *  failed mint re-read again — if a session is there after all, that's a win,
   *  not an error. */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (meRef.current?.signedIn) return true;
    await refreshMe();
    if (meRef.current?.signedIn) return true;
    try {
      const { error } = await authClient.signIn.anonymous();
      if (error) throw new Error(String(error.message ?? "guest sign-in failed"));
    } catch {
      await refreshMe();
      if (meRef.current?.signedIn) return true;
      setNotice("Couldn't open a guest session — try again in a moment.");
      return false;
    }
    await refreshMe();
    return true;
  }, []);

  // ── play / eval ────────────────────────────────────────────────────────────
  const runMusic = useCallback(async (auto = false) => {
    const { strudel: code, hydra: sketch } = stateRef.current;
    if (!code.trim()) {
      // No music yet — let the pane speak for itself; run visuals if present.
      if (sketch.trim()) {
        void startIdleVisual(hydraProgram(sketch));
        setVisualsLive(true);
      }
      return;
    }
    if (busy) return;
    const id = ++runId.current;
    setBusy(true);
    setErr(null);
    // An EXPLICIT send outranks any whisper — but the live room's own
    // auto re-eval must never touch the ghost: it fires 100ms after the
    // ghost cue on every typing pause, and killing here would silence the
    // copilot for as long as the music plays.
    if (!auto) {
      ghostSeq.current++;
      setGhost(null);
    }
    try {
      // THE DECK'S ROUTING, applied at play time only — the pane's code is
      // never touched. Every layer lands on its channel's orbit decade, so
      // the kills have buses to bite.
      await playPart(
        "zaltz-ide",
        transformForPlayback(assignChannelOrbits(code), {
          transpose: keyRef.current,
        }),
        "zaltz-ide",
        // SEAMLESS: a re-eval of the live session hot-swaps in place — no
        // cycle-0 restart, no retire. Takes and ⌘↵ land mid-set without a seam.
        true,
      );
      if (runId.current !== id) {
        try {
          stop();
        } catch {
          /* superseded */
        }
        return;
      }
      setPlaying(true);
      lastMusicRun.current = code;
      // The deck's posture survives every re-eval: kills back on their buses,
      // perf dials back on the master chain.
      try {
        applyOrbitGains(killGainFor);
        ensurePerfFx();
        setLivePerf(perfRef.current);
        if (nudgeRef.current !== 0) applyNudge(nudgeRef.current);
      } catch {
        /* deck re-asserts on the 200ms loop */
      }
      if (sketch.trim()) {
        try {
          setVisuals(true); // a play re-arms a stopped picture
        } catch {
          /* engine settles it */
        }
        void updateVisuals(hydraProgram(sketch));
        setVisualsLive(true);
      }
    } catch (e) {
      if (runId.current === id) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (runId.current === id) setBusy(false);
    }
  }, [busy]);

  // The visuals get their own transport too (user 07-27: "hydra should also
  // have a stop") — run paints, stop goes dark; either always re-arms the
  // global visuals gate first so a stop never sticks.
  const runVisuals = useCallback(() => {
    const { hydra: sketch, playing: live } = stateRef.current;
    setErr(null);
    if (!sketch.trim()) return;
    try {
      setVisuals(true);
    } catch {
      /* engine not up yet */
    }
    const program = hydraProgram(sketch);
    if (live) void updateVisuals(program);
    else void startIdleVisual(program);
    setVisualsLive(true);
    lastVisualRun.current = sketch;
  }, []);
  const stopVisuals = useCallback(() => {
    try {
      setVisuals(false); // soft-hide — the canvas stays, the paint stops
    } catch {
      /* already dark */
    }
    setVisualsLive(false);
  }, []);

  const halt = useCallback(() => {
    runId.current++;
    try {
      stop();
    } catch {
      /* already stopped */
    }
    setPlaying(false);
    setBusy(false);
  }, []);

  // ── THE LIVE ROOM (user 07-27) ────────────────────────────────────────────
  // While the transport is on, the code IS the mix: every edit — adds and
  // deletes alike — lands by itself, a breath after the last keystroke. Gated
  // on a clean static pass so half-typed lines never reach the engine (the
  // pane just waits for the sentence to finish), and riding the same seamless
  // swap as ⌘↵, so the set never restarts. An emptied pane is a move too:
  // no music code = silence, no hydra code = dark.
  const lastMusicRun = useRef<string | null>(null);
  const lastVisualRun = useRef<string | null>(null);
  useEffect(() => {
    // Gated on the MUSIC playing (07-27: the picture is ambient now, so it
    // no longer counts as "transport on") — an emptied pane that went silent
    // comes back the moment real code returns, but typing strudel into a
    // quiet room stays composing until ▶ says otherwise.
    if (!playing || busy) return;
    if (strudel === lastMusicRun.current) return;
    const t = setTimeout(async () => {
      const code = stateRef.current.strudel;
      if (code === lastMusicRun.current) return; // a take already landed it
      if (!code.trim()) {
        lastMusicRun.current = code;
        halt(); // silence is what the empty pane says
        return;
      }
      try {
        // Syntax ONLY — the generation pipeline's full validator also polices
        // sound names and audibility, which would silently refuse live edits
        // the engine plays fine. Here the only question is "can this eval?";
        // everything else is the error chip's job.
        const { parse } = await import("acorn");
        parse(code, { ecmaVersion: 2022, sourceType: "module" });
      } catch {
        return; // mid-sentence — wait for the line to finish
      }
      if (stateRef.current.strudel !== code) return; // superseded by typing
      void runMusic(true);
    }, 700);
    return () => clearTimeout(t);
  }, [strudel, playing, busy, runMusic, halt]);
  // THE PICTURE IS ALWAYS ON (user 07-27, klappn's own law): the sketch
  // paints from the moment the room opens — breathing on the idle clock,
  // unsynced — and LOCKS to the music the moment the transport runs (the
  // visual clock anchors to the audio clock; playhead-visual-sync law).
  // So this effect is UNGATED: hydra edits land ambiently whether or not
  // anything sounds, and the first paint arrives a breath after load. An
  // emptied pane is still dark — no code, no light.
  useEffect(() => {
    if (hydra === lastVisualRun.current) return;
    const t = setTimeout(async () => {
      const sketch = stateRef.current.hydra;
      if (sketch === lastVisualRun.current) return;
      if (!sketch.trim()) {
        lastVisualRun.current = sketch;
        if (stateRef.current.visualsLive) stopVisuals(); // emptied = dark
        return;
      }
      try {
        const { hydraServerErrors } = await import("@/lib/hydra-eval");
        if (hydraServerErrors(sketch).length) return; // mid-sentence — wait
      } catch {
        /* gate falls to the engine */
      }
      if (stateRef.current.hydra !== sketch) return;
      runVisuals();
    }, 700);
    return () => clearTimeout(t);
  }, [hydra, runVisuals, stopVisuals]);

  // THE TRANSPORT — one ▶/■ in the top bar for the WHOLE room (user 07-27:
  // music and picture play and stop together; per-pane transport is gone).
  // ⌘↵ still evals the pane under your fingers while the room runs.
  // THE TRANSPORT RULES SOUND, THE PICTURE IS AMBIENT (user 07-27, klappn's
  // law worn by the instrument): the sketch always paints — ▶ brings the
  // music in and the visuals LOCK to its clock; ■ stops the sound and the
  // picture drifts on, unsynced, still alive. The room is only dark when
  // the hydra pane is empty.
  const transportOn = playing;
  // The chip only speaks between thoughts — see the render note below.
  const liveErr =
    err && !midThought(err.startsWith("hydra:") ? hydra : strudel) ? err : null;
  // THE TAPE FOLLOWS THE TRANSPORT (user 07-27: "it does not make sense to
  // keep recording if we have stopped playing"): ■ — button, SPACE or ⌘. —
  // cuts a rolling take in the same gesture. One object, one life. (The live
  // room's auto-halt on an emptied pane is an EDIT, not a stop — it never
  // cuts; silence can be part of a take.)
  const cutTapeRef = useRef<() => void>(() => {});
  const transport = () => {
    if (playing) {
      halt();
      cutTapeRef.current();
    } else if (stateRef.current.strudel.trim()) {
      void runMusic(); // its tail re-evals the picture onto the synced clock
    }
  };
  const transportRef = useRef(transport);
  transportRef.current = transport;


  // ⌘. stops from anywhere (not just inside a pane); Esc closes whatever's
  // open. ⌘S is swallowed — the bench keeps itself; the browser's save
  // dialog mid-set would be a jump scare.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        halt();
        cutTapeRef.current(); // ⌘. is a stop — the tape follows the transport
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
      } else if (e.key === "Escape") {
        setSheet(null);
      } else if (e.key === " " || e.code === "Space") {
        // SPACE = the transport (user 07-27) — the player's oldest key. Never
        // while typing (space is a character there), and preventDefault stops
        // the browser re-firing whatever button was last clicked (the old
        // "space went fullscreen" surprise).
        const el = document.activeElement as HTMLElement | null;
        const editable =
          !!el &&
          (el.tagName === "TEXTAREA" ||
            el.tagName === "INPUT" ||
            el.isContentEditable);
        if (!editable) {
          e.preventDefault();
          transportRef.current();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [halt]);

  // (The whole projects apparatus — names, renaming, ＋ New, the saved-grains
  // crate and its /api/sketches calls — died 2026-07-28, user: "everything is
  // just on the one page… every time it is live, that is the whole point."
  // The bench persists itself to localStorage above; the tape ● is how a
  // moment is kept.)

  // ── the copilot (ghost completions) ────────────────────────────────────────
  const requestGhost = useCallback(
    async (pane: PaneId, ctx: CaretContext) => {
      if (!copilot) return;
      if (ghostRef.current) {
        // ✦/⌥\ while a ghost is up = ANOTHER TAKE: bin it and roll fresh (the
        // button must always DO something — a dead press reads as broken).
        // (killGhost is declared below — TDZ — so use its primitives.)
        if (!ctx.forced) return; // auto-cues still defer to the standing ghost
        ghostSeq.current++;
        setGhost(null);
      }
      const cueKey = `${pane}:${ctx.before.length}:${ctx.after.length}:${ctx.before.slice(-40)}`;
      // An explicit ✦/⌥\ summon is a direct order — it re-asks even where an
      // auto-cue already came back empty.
      // An empty answer only holds a spot for 10s — a parked caret gets the
      // copilot's attention again (one empty must never go permanent; that was
      // the "my cursor has been waiting forever" bug).
      if (
        !ctx.forced &&
        lastCue.current.key === cueKey &&
        lastCue.current.empty &&
        Date.now() - lastCue.current.at < 10_000
      )
        return;
      // Nothing left to spend → the copilot goes quiet instead of 402-spamming.
      const m = meRef.current;
      if (m?.signedIn && !m.owner && (m.remainingTokens ?? 0) <= 0) return;
      if (!m?.signedIn) {
        if (mintTried.current) return;
        mintTried.current = true;
        if (!(await ensureSession())) return;
      }
      // The played-notes ring joins the key — a ghost cached before a phrase
      // must not answer the cue that comes after it.
      const midiRecent = pane === "strudel" ? recentMidiNotes() : "";
      const cacheKey = `${pane}|${ctx.before.slice(-240)}|${ctx.after.slice(0, 80)}|${midiRecent.slice(-60)}`;
      // A DIRECT order (✦/⌥\) never answers from the cache — pressing the
      // button means "another take", never "show me the same one again" (and a
      // cached silence used to mute it entirely). Auto-cues still ride the
      // cache for free.
      const cached = ctx.forced ? undefined : ghostLRU.current.get(cacheKey);
      if (cached !== undefined) {
        const alive =
          !!cached.g.trim() ||
          (!!cached.t && (ctx.before + ctx.after).includes(cached.t.find));
        lastCue.current = { key: cueKey, empty: !alive, at: Date.now() };
        if (alive)
          setGhost(cached.t ? { pane, trim: cached.t } : { pane, text: cached.g });
        return;
      }
      const seq = ++ghostSeq.current;
      ghostAbort.current?.abort();
      const ac = new AbortController();
      ghostAbort.current = ac;
      setPondering(pane);
      try {
        const res = await fetch("/api/complete", {
          method: "POST",
          signal: ac.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pane,
            before: ctx.before,
            after: ctx.after,
            // The other pane rides along — a hydra ghost should know the loop
            // it lights; a strudel ghost, the light it moves under.
            context:
              pane === "strudel" ? stateRef.current.hydra : stateRef.current.strudel,
            // What the hands just played on the wire — the whisper can answer
            // the phrase on the keys. Sound pane only; quiet keys send nothing.
            midi: midiRecent,
          }),
        });
        if (res.status === 402) {
          // THE PAYING MOMENT — the machine never just goes quiet: it tells
          // you why, once, and the door to more is one tap away.
          if (!spentToldRef.current) {
            spentToldRef.current = true;
            setNotice(
              "The tokens ran dry \u2014 the whispers went quiet. Feed the machine and they come back.",
            );
          }
          void refreshMe(); // the chip flips to its burning 0
          return;
        }
        if (!res.ok) return; // 429 etc → quiet; the meter chip tells the story
        const d = openDeep(
          (await res.json().catch(() => ({}))) as {
            ghost?: string;
            trim?: { find: string; replace: string };
          },
        );
        const g = d.ghost ?? "";
        const t = d.trim && typeof d.trim.find === "string" ? d.trim : undefined;
        // NEVER cache silence (07-28, "the copilot is not doing anything"):
        // a cached empty made that caret position permanently mute — every
        // later park served the old silence, and phones have no ⌥\ to force
        // past it. The 10s lastCue window already stops rapid re-asks.
        if (g.trim() || t) ghostLRU.current.set(cacheKey, { g, t });
        if (ghostLRU.current.size > 16) {
          const oldest = ghostLRU.current.keys().next().value;
          if (oldest !== undefined) ghostLRU.current.delete(oldest);
        }
        // Multi-line ghosts render ANYWHERE (2026-07-26, user: hydra writes
        // one word per line — a one-line ghost said nothing): all visible
        // text lives in the <pre> (the textarea's text is transparent), so a
        // mid-file ghost pushes the picture down exactly like VS Code, while
        // the caret and every click keep answering to the REAL buffer — and
        // any keystroke or caret move dismisses the ghost and snaps back.
        lastCue.current = { key: cueKey, empty: !g.trim() && !t, at: Date.now() };
        if (!g.trim() && !t) return;
        if (seq !== ghostSeq.current) return; // superseded by newer typing
        const cur = pane === "strudel" ? stateRef.current.strudel : stateRef.current.hydra;
        if (cur !== ctx.before + ctx.after) return; // the file moved on
        if (t && !cur.includes(t.find)) return; // the doomed line already moved
        setGhost(t ? { pane, trim: t } : { pane, text: g });
      } catch {
        /* aborted or offline — a missing ghost is nothing */
      } finally {
        if (seq === ghostSeq.current) setPondering(null);
      }
    },
    [copilot, ensureSession],
  );

  const killGhost = useCallback(() => {
    ghostSeq.current++;
    setGhost(null);
  }, []);

  // THE PRE-WARM — the session's FIRST whisper used to carry the whole
  // rulebook ingestion (the ~14k-token spec's cache write) on the human path.
  // Fire it once in the background shortly after the room opens, while the
  // coder is still looking around: their first real whisper then lands on a
  // hot cache (~1.2s, the measured warm figure). Signed-in only — warming
  // must never mint a guest session for a lurker; net cost ≈ zero (the write
  // was owed by the first call either way).
  const warmedRef = useRef(false);
  useEffect(() => {
    if (warmedRef.current || !copilot || !me?.signedIn) return;
    const t = setTimeout(() => {
      // Marked at FIRE time, not schedule time — strict mode's double-mount
      // clears the first timer, and a pre-marked ref would skip the retry.
      if (warmedRef.current) return;
      warmedRef.current = true;
      void fetch("/api/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pane: "strudel",
          before: "setcpm(120/4)\n",
          after: "",
          context: "",
          midi: "",
          warm: true,
        }),
        keepalive: true,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [copilot, me?.signedIn]);

  // ── THE DECK — the Sets deck's machinery, verbatim concepts (lib/set-live):
  // deterministic, ephemeral, zero AI. Layers are re-bused onto channel orbit
  // DECADES at PLAY TIME (the pane's code is never touched); kills are Web
  // Audio gain ramps on those buses — instant, tails included; the perf dials
  // ride the master FX chain (setLivePerf) live, no recompile. The light page
  // is video-DJ: CSS filters on the canvas itself.
  const [master, setMaster] = useState(1);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [mixerTab, setMixerTab] = useState<MixerTab>("music");
  const [kills, setKills] = useState<Record<Channel, boolean>>({
    drums: false,
    bass: false,
    melody: false,
  });
  const killsRef = useRef(kills);
  killsRef.current = kills;
  // time/tail = the echo's own guts (delay seconds, regen 0..0.85) — they rest
  // at the chain's build values, so "—" on the dial means untouched.
  const [perf, setPerf] = useState({
    filter: 0,
    echo: 0,
    punch: 0,
    space: 0,
    time: 0.375,
    tail: 0.4,
  });
  const perfRef = useRef(perf);
  perfRef.current = perf;
  // TEMPO — the deck's nudge, driven straight into the scheduler (no re-eval);
  // KEY — rides the code (transposePitched) at play time, so a turn re-evals
  // (same-owner crossfade) a beat after the finger settles.
  const [nudge, setNudge] = useState(0);
  const nudgeRef = useRef(0);
  const [key, setKey] = useState(0);
  const keyRef = useRef(0);
  const keyReeval = useRef<ReturnType<typeof setTimeout> | null>(null);
  // THE PADS — hold: on · release: back (the deck's momentary throws).
  const [heldPad, setHeldPad] = useState<string | null>(null);
  const padPrev = useRef<typeof perf | null>(null);
  const [light, setLight] = useState({
    hue: 0,
    sat: 1,
    contrast: 1,
    bright: 1,
    blur: 0,
    invert: 0,
  });
  // ref'd like perf/kills — the MIDI kit rides this from a long-lived callback
  const lightRef = useRef(light);
  lightRef.current = light;

  // THE MIC — the Sets deck's own graph (lib live mic) with the monitor OPEN:
  // in zaltz there is no audience yet, the room itself is who hears you. The
  // voice rides the engine's broadcast tap, so the day the live door opens,
  // the mic is already on the wire.
  const [canMic, setCanMic] = useState(false);
  useEffect(() => {
    setCanMic(!!navigator.mediaDevices?.getUserMedia);
  }, []);
  const [micOn, setMicOn] = useState(false);
  const [micFx, setMicFx] = useState<MicFx>({
    level: 0.7,
    echo: 0,
    space: 0.15,
    drive: 0,
    glow: 0,
  });
  const [micVoice, setMicVoiceState] = useState<LiveMicVoice>("natural");
  const [micLook, setMicLook] = useState<string | null>(null);
  // THE HEADPHONES WHISPER — once ever (the Sets deck's own contract);
  // then only the 🎧 in the Voice header remembers.
  const [micHint, setMicHint] = useState<"in" | "out" | null>(null);
  useEffect(() => {
    if (!micHint) return;
    const t = setTimeout(
      () => setMicHint(micHint === "in" ? "out" : null),
      micHint === "in" ? 8000 : 700,
    );
    return () => clearTimeout(t);
  }, [micHint]);
  // THE MIC DEVICE — named audioinputs + the sticky pick (shared key, so the
  // choice made on the Sets deck IS the choice here).
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(MIC_DEVICE_KEY);
    } catch {
      return null;
    }
  });
  const micDeviceRef = useRef(micDeviceId);
  micDeviceRef.current = micDeviceId;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;
  const micDotRef = useRef<HTMLSpanElement | null>(null);
  const refreshMics = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const named = all.filter((d) => d.kind === "audioinput" && d.label);
      const real = named.filter(
        (d) => d.deviceId !== "default" && d.deviceId !== "communications",
      );
      const list = (real.length ? real : named).map((d) => ({
        deviceId: d.deviceId,
        label: d.label,
      }));
      setMics(list);
      // the picked device vanished → glide to the default, stay live
      if (
        micOnRef.current &&
        micDeviceRef.current &&
        list.length > 0 &&
        !list.some((m) => m.deviceId === micDeviceRef.current)
      ) {
        void setLiveMicDevice(null);
      }
    } catch {
      /* no device API — the capsule just never appears */
    }
  }, []);
  useEffect(() => {
    if (!micOn) return; // an open mic = permission granted = labels exist
    void refreshMics();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshMics();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [micOn, refreshMics]);
  const toggleMic = async () => {
    if (micOn) {
      disableLiveMic(); // also drops any worn character (lib resets too)
      setMicOn(false);
      setMicVoiceState("natural");
      setMicHint(null); // the whisper never outlives the mic it spoke for
      return;
    }
    // The mic needs the engine's tap — wake the room inside the gesture, then
    // only flip the pill once the mic is actually wired (permission granted).
    try {
      await unlockAudio();
    } catch {
      /* the engine will say so itself */
    }
    const ok = await enableLiveMic(micDeviceRef.current);
    if (ok) {
      setLiveMicFx({ ...micFx, monitor: true }); // monitor OPEN — see above
      setMicVoiceState("natural"); // the graph opened natural — match it
      setMicOn(true);
      try {
        if (!localStorage.getItem(MIC_HINT_KEY)) {
          localStorage.setItem(MIC_HINT_KEY, "1");
          setMicHint("in"); // said once, ever
        }
      } catch {
        /* private mode — the whisper just doesn't show */
      }
    }
  };
  const micDial = (patch: Partial<MicFx>) => {
    const next = { ...micFx, ...patch };
    setMicFx(next);
    setMicLook(null); // the hands moved the seat — no look owns it now
    setLiveMicFx(next);
  };
  const micVoiceTo = (v: LiveMicVoice) => {
    setMicVoiceState(v);
    setLiveMicVoice(v); // parameter ramps on the live chain — instant
  };
  const micLookTo = (id: string) => {
    const look = MIC_LOOKS.find((l) => l.id === id);
    if (!look) return;
    setMicFx(look.fx);
    setMicLook(id);
    setLiveMicFx(look.fx); // the seat lands in one tap (monitor untouched)
  };
  const micDeviceTo = (id: string) => {
    setMicDeviceId(id);
    try {
      localStorage.setItem(MIC_DEVICE_KEY, id);
    } catch {
      /* private mode — the choice just doesn't stick */
    }
    if (micOnRef.current) void setLiveMicDevice(id);
  };

  // THE LIVE DOOR (2026-07-28) — the room streams to the world, the Sets
  // contract verbatim: ONE mixed audio stream on the Realtime SFU (music +
  // mic + MIDI, post-limiter, exactly what the room hears) + a public link.
  // The hydra sketch travels as TEXT with the state heartbeat — listeners'
  // own GPUs paint it. Ending the wire leaves the tap AND the mic: they are
  // the room's own furniture, not the broadcast's.
  const [liveLink, setLiveLink] = useState<{ token: string; expiresAt: string } | null>(null);
  const liveLinkRef = useRef(liveLink);
  liveLinkRef.current = liveLink;
  const [liveBusy, setLiveBusy] = useState(false);
  const [endArmed, setEndArmed] = useState(false);
  const [liveCopied, setLiveCopied] = useState(false);
  const liveBroadcast = useRef<Broadcast | null>(null);
  const liveBroadcastBusy = useRef(false);
  const [broadcastEpoch, setBroadcastEpoch] = useState(0);
  // Still on air? A reloaded page asks — the broadcast outlives the tab.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/zaltz/live", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { token?: string | null; expiresAt?: string };
        if (d.token) setLiveLink({ token: d.token, expiresAt: d.expiresAt ?? "" });
      } catch {
        /* signed out / offline — the door just stays closed */
      }
    })();
  }, []);
  const publishLiveState = useCallback(() => {
    const link = liveLinkRef.current;
    if (!link) return;
    const b = liveBroadcast.current;
    const state = {
      sectionId: null,
      paused: !stateRef.current.playing,
      nudge: 0,
      perf: { filter: 0, echo: 0, punch: 0, space: 0 },
      kills: { drums: false, bass: false, melody: false },
      at: Date.now(),
      ...(b ? { broadcast: { session: b.sessionId, audio: b.audioTrack } } : {}),
    };
    void fetch(`/api/live/${link.token}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state, visual: stateRef.current.hydra.slice(0, 16000) }),
    }).catch(() => {});
  }, []);
  // Publish the mix onto the SFU the moment the door is open (retry while the
  // engine warms; re-publish when a dead connection is noticed).
  useEffect(() => {
    if (!liveLink || liveBroadcast.current || liveBroadcastBusy.current) return;
    liveBroadcastBusy.current = true;
    (async () => {
      try {
        const stream = getBroadcastStream();
        if (!stream) {
          setTimeout(() => setBroadcastEpoch((e) => e + 1), 1000);
          return;
        }
        const b = await publishStream(stream);
        liveBroadcast.current = b;
        b.pc.addEventListener("connectionstatechange", () => {
          if (isDead(b.pc) && liveBroadcast.current === b) {
            liveBroadcast.current = null;
            setTimeout(() => setBroadcastEpoch((e) => e + 1), 3000);
          }
        });
        publishLiveState();
      } catch (e) {
        console.error("[zaltz] live publish failed:", e);
        setTimeout(() => setBroadcastEpoch((e2) => e2 + 1), 3000);
      } finally {
        liveBroadcastBusy.current = false;
      }
    })();
  }, [liveLink, broadcastEpoch, publishLiveState]);
  // Heartbeat while on air (the listeners' poll feeds on it) + an immediate
  // word when the transport flips — silence is part of a live room, but the
  // "Holding…" label should tell the truth fast.
  useEffect(() => {
    if (!liveLink) return;
    publishLiveState();
    const id = setInterval(publishLiveState, 3000);
    return () => clearInterval(id);
  }, [liveLink, playing, publishLiveState]);
  useEffect(
    () => () => {
      if (liveBroadcast.current) {
        try {
          liveBroadcast.current.pc.close();
        } catch {
          /* leaving */
        }
      }
    },
    [],
  );
  const openLive = async () => {
    if (liveBusy) return;
    setLiveBusy(true);
    try {
      try {
        await unlockAudio(); // the tap needs the engine — wake it in the gesture
      } catch {
        /* the engine will say so itself */
      }
      if (!meRef.current?.signedIn && !(await ensureSession())) return;
      const r = await fetch("/api/zaltz/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) return;
      const d = (await r.json()) as { token: string; expiresAt: string };
      setLiveLink({ token: d.token, expiresAt: d.expiresAt });
      // the room going on air is a corpus moment — what was live-coded when
      snapRoom("strudel", "live", stateRef.current.strudel, {});
    } catch {
      /* quiet — the button is still there */
    } finally {
      setLiveBusy(false);
    }
  };
  const copyLive = () => {
    const link = liveLinkRef.current;
    if (!link) return;
    void navigator.clipboard
      ?.writeText(`${location.origin}/live/${link.token}`)
      .then(() => {
        setLiveCopied(true);
        setTimeout(() => setLiveCopied(false), 1600);
      })
      .catch(() => {});
  };
  const endLive = async () => {
    setEndArmed(false);
    setLiveLink(null);
    if (liveBroadcast.current) {
      try {
        liveBroadcast.current.pc.close();
      } catch {
        /* already down */
      }
      liveBroadcast.current = null;
    }
    try {
      await fetch("/api/zaltz/live", { method: "DELETE" });
    } catch {
      /* the link expires on its own anyway */
    }
  };
  const endLivePress = () => {
    if (!endArmed) {
      setEndArmed(true);
      setTimeout(() => setEndArmed(false), 3000);
      return;
    }
    void endLive();
  };

  // SAVE SAVE SAVE (2026-07-28, user: the future model eats the boiler room)
  // — the room's authored code lands in room_snapshots, throttled so the
  // corpus gets moments, not keystrokes: the evolving code while playing
  // (30s + only-when-changed), every accepted whisper (the strongest
  // signal), every pour, every go-live. Fire-and-forget; capture must never
  // slow the hands.
  const snapLast = useRef<Record<string, { at: number; code: string }>>({});
  const snapRoom = useCallback(
    (
      pane: "strudel" | "hydra",
      event: string,
      code: string,
      meta: Record<string, unknown> = {},
      throttleMs = 0,
    ) => {
      if (!meRef.current?.signedIn || !code.trim()) return;
      const key = `${pane}:${event}`;
      const last = snapLast.current[key];
      const now = Date.now();
      if (last && last.code === code) return; // nothing new to say
      if (throttleMs && last && now - last.at < throttleMs) return;
      snapLast.current[key] = { at: now, code };
      void fetch("/api/room/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pane, event, code, meta }),
        keepalive: true,
      }).catch(() => {});
    },
    [],
  );
  // The performance as it evolves — a settled edit while the room plays.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(
      () => snapRoom("strudel", "eval", stateRef.current.strudel, {}, 30_000),
      2000,
    );
    return () => clearTimeout(t);
  }, [strudel, playing, snapRoom]);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(
      () => snapRoom("hydra", "eval", stateRef.current.hydra, {}, 30_000),
      2000,
    );
    return () => clearTimeout(t);
  }, [hydra, playing, snapRoom]);

  // THE LINEUP — the boiler room's crate (2026-07-28, user: Sets folds into
  // the room). Your hits queue up; tapping a row POURS that song's first loop
  // into the panes (setcpm + music into sound, its hydra into visual) — the
  // whisper then reads the song for free (the pane IS the context), and
  // everything live-coded on top leaves with the next pour. The queue lives in
  // localStorage like the bench; the pour rides the master fade + the live
  // room's own seamless swap.
  const [lineup, setLineupState] = useState<{ id: string; title: string }[]>([]);
  // Hydrate AFTER mount — the page is server-rendered, and a localStorage
  // read in the initial state makes the header's count differ between the
  // server's HTML and the client's first paint (seen live: hydration error).
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("klappn-lineup-v1") || "[]");
      if (Array.isArray(raw))
        setLineupState(
          raw.filter((e) => e && typeof e.id === "string" && typeof e.title === "string"),
        );
    } catch {
      /* private mode / bad json — an empty night */
    }
  }, []);
  const setLineup = useCallback(
    (up: (prev: { id: string; title: string }[]) => { id: string; title: string }[]) => {
      setLineupState((prev) => {
        const next = up(prev);
        try {
          localStorage.setItem("klappn-lineup-v1", JSON.stringify(next));
        } catch {
          /* private mode — the night just doesn't stick */
        }
        return next;
      });
    },
    [],
  );
  const [lineupIdx, setLineupIdx] = useState<number | null>(null);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [lineupHits, setLineupHits] = useState<LineupHit[] | null>(null);
  const [arranging, setArranging] = useState(false);
  const hitsMetaRef = useRef(
    new Map<string, { bpm?: number; key?: string; genre?: string; summary?: string }>(),
  );
  const pourCache = useRef(new Map<string, { music: string; visual: string }>());
  const masterLevelRef = useRef(master);
  masterLevelRef.current = master;
  // The crate opens → the library loads once (a session appears if needed).
  useEffect(() => {
    if (!lineupOpen || lineupHits !== null) return;
    (async () => {
      try {
        if (!meRef.current?.signedIn && !(await ensureSession())) {
          setLineupHits([]);
          return;
        }
        const r = await fetch("/api/songs", { cache: "no-store" });
        if (!r.ok) {
          setLineupHits([]);
          return;
        }
        const d = openDeep(
          (await r.json().catch(() => ({}))) as {
            songs?: {
              id: string;
              title?: string | null;
              status?: string;
              plan?: { bpm?: number; key?: string; genre?: string; summary?: string };
            }[];
          },
        );
        const rows = (d.songs ?? []).map((s) => {
          hitsMetaRef.current.set(s.id, {
            bpm: s.plan?.bpm,
            key: s.plan?.key,
            genre: s.plan?.genre,
            summary: s.plan?.summary,
          });
          return { id: s.id, title: s.title || "Untitled", ready: s.status === "ready" };
        });
        setLineupHits(rows);
      } catch {
        setLineupHits([]);
      }
    })();
  }, [lineupOpen, lineupHits]);
  /** Pour lineup row i into the panes — the transition IS the master fade +
   *  the live room's seamless swap. */
  const pourSong = useCallback(
    async (i: number) => {
      const entry = lineup[i];
      if (!entry) return;
      let bundle = pourCache.current.get(entry.id);
      if (!bundle) {
        try {
          const r = await fetch(`/api/songs/${entry.id}`, { cache: "no-store" });
          if (!r.ok) return;
          const d = openDeep(
            (await r.json().catch(() => null)) as {
              song?: {
                plan?: {
                  bpm?: number;
                  timeSignature?: string;
                  visual?: { hydra?: string };
                };
              };
              parts?: { status?: string; strudel?: string | null }[];
            } | null,
          );
          const plan = d?.song?.plan ?? {};
          const part = (d?.parts ?? []).find(
            (p) => (p.strudel ?? "").trim() && (!p.status || p.status === "ready"),
          );
          if (!part?.strudel) {
            setNotice("Nothing playable in that one yet — it joins when a loop lands.");
            return;
          }
          const code = part.strudel;
          const metaIdx = code.search(
            /\/\*\s*@(?:hydra|controls|vcontrols|vlooks|swaps|edits)\b/,
          );
          const music = (metaIdx >= 0 ? code.slice(0, metaIdx) : code).trim();
          const visual = (
            extractHydra(code) ??
            (typeof plan.visual?.hydra === "string" ? plan.visual.hydra : "")
          ).trim();
          const bpm = typeof plan.bpm === "number" && plan.bpm > 0 ? Math.round(plan.bpm) : 120;
          const bpb = /^\s*(\d+)/.exec(plan.timeSignature ?? "")?.[1] ?? "4";
          // Some stored loops already open with their own setcpm — never stack
          // a second one on top (seen live: a doubled setcpm line).
          const hasCpm = /^\s*setcpm\s*\(/m.test(music);
          bundle = { music: hasCpm ? music : `setcpm(${bpm}/${bpb})\n${music}`, visual };
          pourCache.current.set(entry.id, bundle);
        } catch {
          return;
        }
      }
      // The FADE — the master dips under the swap and comes home after it
      // lands (the auto-eval's ~700ms debounce + evaluate sit inside the dip).
      if (stateRef.current.playing) {
        fadeMaster(0.06, 0.45);
        setTimeout(() => fadeMaster(masterLevelRef.current, 1.2), 1500);
      }
      // what was ON the bench leaves with the pour — its final form is corpus
      snapRoom("strudel", "pour", stateRef.current.strudel, {
        nextSongId: entry.id,
        nextTitle: entry.title,
      });
      setStrudel(bundle.music);
      setHydra(bundle.visual);
      setLineupIdx(i);
    },
    [lineup, snapRoom],
  );
  const addToLineup = useCallback(
    (id: string) => {
      const h = lineupHits?.find((x) => x.id === id);
      if (!h) return;
      setLineup((prev) => [...prev, { id, title: h.title }]);
    },
    [lineupHits, setLineup],
  );
  const removeFromLineup = useCallback(
    (i: number) => {
      setLineup((prev) => prev.filter((_, k) => k !== i));
      setLineupIdx((prev) =>
        prev == null ? prev : i === prev ? null : i < prev ? prev - 1 : prev,
      );
    },
    [setLineup],
  );
  const moveLineup = useCallback(
    (i: number, dir: -1 | 1) => {
      const j = i + dir;
      setLineup((prev) => {
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      setLineupIdx((prev) =>
        prev == null ? prev : prev === i ? j : prev === j ? i : prev,
      );
    },
    [setLineup],
  );
  const arrangeLineup = useCallback(async () => {
    if (arranging || lineup.length < 2) return;
    setArranging(true);
    try {
      // Index-as-id: a song queued twice stays two distinct slots (the Sets
      // entry-id trick, client-side).
      const songsMeta = lineup.map((e, idx) => ({
        id: String(idx),
        title: e.title,
        ...hitsMetaRef.current.get(e.id),
      }));
      const r = await fetch("/api/lineup/arrange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songs: songsMeta }),
      });
      if (r.status === 402) {
        setNotice(
          "The tokens ran dry — the whispers went quiet. Feed the machine and they come back.",
        );
        return;
      }
      if (!r.ok) return;
      const d = (await r.json().catch(() => ({}))) as { order?: string[] };
      const order = (Array.isArray(d.order) ? d.order : [])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n < lineup.length);
      for (let k = 0; k < lineup.length; k++) if (!order.includes(k)) order.push(k);
      const current = lineupIdx;
      setLineup(() => order.map((k) => lineup[k]));
      if (current != null) setLineupIdx(order.indexOf(current));
    } finally {
      setArranging(false);
    }
  }, [arranging, lineup, lineupIdx, setLineup]);

  const killGainFor = useCallback(
    (orbit: number): number | undefined => {
      const ch = channelOfOrbit(orbit);
      return ch ? (killsRef.current[ch] ? 0 : 1) : undefined;
    },
    [],
  );
  const toggleKill = (ch: Channel) => {
    const next = { ...killsRef.current, [ch]: !killsRef.current[ch] };
    killsRef.current = next;
    setKills(next);
    try {
      applyOrbitGains(killGainFor); // instant — the ramp lands mid-note
    } catch {
      /* engine not up — the pads still remember */
    }
  };
  // Orbit buses are born lazily (first hap), so a kill must be RE-ASSERTED
  // while playing — the deck's own 200ms no-op-when-at-target loop.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      try {
        applyOrbitGains(killGainFor);
      } catch {
        /* engine gone */
      }
    }, 200);
    return () => clearInterval(t);
  }, [playing, killGainFor]);

  const movePerf = (patch: Partial<typeof perf>) => {
    const next = { ...perfRef.current, ...patch };
    perfRef.current = next;
    setPerf(next);
    try {
      ensurePerfFx(); // the master dial chain — spliced once, post-limiter
      setLivePerf(next);
    } catch {
      /* engine not up — the dial still remembers; runMusic re-asserts */
    }
  };
  const moveMaster = (v: number) => {
    setMaster(v);
    try {
      fadeMaster(v, 0.05);
    } catch {
      /* engine not up yet — the dial still remembers */
    }
  };

  // The code's own tempo (its LAST setcpm) — what the nudge multiplies.
  const baseCps = useMemo(() => {
    let cpm: number | null = null;
    for (const m of strudel.matchAll(/\bsetcpm\(\s*([0-9.]+)\s*(?:\/\s*([0-9.]+))?\s*\)/g)) {
      cpm = Number(m[1]) / (m[2] ? Number(m[2]) : 1);
    }
    return cpm != null && cpm > 0 ? cpm / 60 : null;
  }, [strudel]);
  const applyNudge = useCallback(
    (n: number) => {
      if (baseCps == null) return;
      try {
        setLiveCps(baseCps * (1 + n / 100)); // scheduler-direct — no recompile
      } catch {
        /* engine not up — re-asserted after the next eval */
      }
    },
    [baseCps],
  );
  const moveNudge = (n: number) => {
    nudgeRef.current = n;
    setNudge(n);
    applyNudge(n);
  };
  const moveKey = (v: number) => {
    keyRef.current = v;
    setKey(v);
    // Key rides the CODE — re-eval a beat after the finger settles (crossfade).
    if (stateRef.current.playing) {
      if (keyReeval.current) clearTimeout(keyReeval.current);
      keyReeval.current = setTimeout(() => void runMusic(true), 350);
    }
  };
  const padDown = (name: string, patch: Partial<typeof perf>) => {
    if (padPrev.current === null) padPrev.current = { ...perfRef.current };
    setHeldPad(name);
    movePerf(patch);
  };
  const padUp = () => {
    setHeldPad(null);
    if (padPrev.current) {
      movePerf(padPrev.current);
      padPrev.current = null;
    }
  };

  // VIDEO DJ — deterministic, ephemeral, instant: CSS filters on the canvas.
  // (The build scrub renames "hydra-canvas" consistently in prod chunks, so
  // this literal finds the canvas on both dev and prod.)
  const moveLight = (patch: Partial<typeof light>) => {
    const next = { ...lightRef.current, ...patch };
    lightRef.current = next;
    setLight(next);
    const el = document.getElementById("hydra-canvas");
    if (!el) return;
    const f: string[] = [];
    if (next.hue) f.push(`hue-rotate(${Math.round(next.hue)}deg)`);
    if (next.sat !== 1) f.push(`saturate(${next.sat})`);
    if (next.contrast !== 1) f.push(`contrast(${next.contrast})`);
    if (next.bright !== 1) f.push(`brightness(${next.bright})`);
    if (next.blur > 0) f.push(`blur(${next.blur}px)`);
    if (next.invert > 0) f.push(`invert(${next.invert})`);
    el.style.filter = f.join(" ");
  };

  // ── THE SWARM — zissl's compute colony as a desk section (deterministic,
  // ephemeral, zero AI — lib/strudel-client composes it AROUND the pane's
  // picture and the sketch is never touched). The section only exists where
  // the painting engine has compute (WebGPU), checked while the desk is up.
  const [swarm, setSwarmDials] = useState<SwarmDials>({
    on: false,
    colony: 0.5,
    rush: 1.25,
    hunger: 1.2,
  });
  const swarmRef = useRef(swarm);
  swarmRef.current = swarm;
  const [canSwarm, setCanSwarm] = useState(false);
  useEffect(() => {
    if (!mixerOpen) return;
    const check = () => setCanSwarm(swarmReady());
    check(); // the engine may still be booting when the desk rises — keep asking
    const t = setInterval(check, 1200);
    return () => clearInterval(t);
  }, [mixerOpen]);
  const moveSwarm = (patch: Partial<SwarmDials>) => {
    const next = { ...swarmRef.current, ...patch };
    swarmRef.current = next;
    setSwarmDials(next);
    try {
      setLiveSwarm(next);
    } catch {
      /* engine not up — the dials still remember */
    }
  };

  // ── THE HARDWARE — lib/midi-live, the Sets deck's machinery worn by the
  // desk: keys play over the mix on the engine's own master chain, and the
  // kit's knobs/pads ride the desk's controls via MIDI learn. The tab only
  // exists where the browser speaks Web MIDI; the browser's permission ask
  // fires on the FIRST open of the tab (that tap is the consent moment),
  // never on page load.
  const [midiSnap, setMidiSnap] = useState<MidiSnapshot | null>(null);
  useEffect(() => {
    // capability probe only — no device watch, no permission prompt
    if (midiState().supported) setMidiSnap(midiState());
  }, []);
  const midiUnsub = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (mixerTab === "midi" && !midiUnsub.current)
      midiUnsub.current = subscribeMidi(setMidiSnap);
  }, [mixerTab]);
  const cycleMidiInput = () => {
    const s = midiSnap;
    if (!s || s.inputs.length < 2) return;
    const i = s.inputs.findIndex((x) => x.id === s.activeInputId);
    setMidiInput(s.inputs[(i + 1) % s.inputs.length].id);
  };

  // THE KIT MAP — which knob/pad rides which desk control. Kept across
  // sessions (a DJ's kit is wired once); ephemeral values, durable wiring.
  const MIDI_MAP_KEY = "zaltzMidiMap";
  const [kitMap, setKitMap] = useState<KitMap>({});
  const kitMapRef = useRef(kitMap);
  kitMapRef.current = kitMap;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MIDI_MAP_KEY);
      if (raw) setKitMap(JSON.parse(raw) as KitMap);
    } catch {
      /* fresh board */
    }
  }, []);
  const [learn, setLearn] = useState<KitTargetId | null>(null);
  const learnRef = useRef(learn);
  learnRef.current = learn;
  const saveKitMap = (next: KitMap) => {
    kitMapRef.current = next;
    setKitMap(next);
    try {
      localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(next));
    } catch {
      /* the wiring lives for the session anyway */
    }
  };
  const bindKit = (id: KitTargetId, b: KitBinding) => {
    saveKitMap({ ...kitMapRef.current, [id]: b });
    setLearn(null);
  };
  const unbindKit = (id: KitTargetId) => {
    const next = { ...kitMapRef.current };
    delete next[id];
    saveKitMap(next);
  };

  // The kit riding the desk: 0..127 → each control's own dial range (the
  // mixer's ranges, verbatim). Kills toggle on a pad hit / a CC rising edge.
  const applyKit = (id: KitTargetId, v: number) => {
    const t = v / 127;
    switch (id) {
      case "master": moveMaster(t); break;
      case "tempo": moveNudge(Math.round(-8 + t * 16)); break;
      case "key": moveKey(Math.round(-7 + t * 14)); break;
      case "filter": movePerf({ filter: Math.round(-100 + t * 200) }); break;
      case "echo": movePerf({ echo: t * 0.7 }); break;
      case "space": movePerf({ space: t * 0.6 }); break;
      case "drive": movePerf({ punch: t * 0.5 }); break;
      case "time": movePerf({ time: 0.08 + t * 0.67 }); break;
      case "tail": movePerf({ tail: t * 0.85 }); break;
      case "hue": moveLight({ hue: Math.round(t * 360) }); break;
      case "colour": moveLight({ sat: t * 3 }); break;
      case "contrast": moveLight({ contrast: 0.4 + t * 2.1 }); break;
      case "glow": moveLight({ bright: 0.4 + t * 1.6 }); break;
      case "smear": moveLight({ blur: t * 8 }); break;
      case "invert": moveLight({ invert: t }); break;
      default: break; // kills are edge-handled by the sinks below
    }
  };
  const lastCC = useRef<Record<number, number>>({});
  // Fresh closures every render (they read the latest movers); the sinks
  // registered once below always call through this ref.
  const kitHandlers = useRef<{
    cc: (cc: number, v: number) => void;
    note: (n: number) => boolean;
  }>({ cc: () => {}, note: () => false });
  kitHandlers.current = {
    cc: (cc, v) => {
      // learn first — the next thing you move IS the answer
      if (learnRef.current) {
        bindKit(learnRef.current, { kind: "cc", num: cc });
        return;
      }
      const prev = lastCC.current[cc] ?? 0;
      lastCC.current[cc] = v;
      for (const t of KIT_TARGETS) {
        const b = kitMapRef.current[t.id];
        if (!b || b.kind !== "cc" || b.num !== cc) continue;
        if (t.pad) {
          if (prev < 64 && v >= 64) toggleKill(t.id.slice(5) as Channel);
        } else applyKit(t.id, v);
      }
    },
    note: (n) => {
      const l = learnRef.current;
      if (l && KIT_TARGETS.find((t) => t.id === l)?.pad) {
        bindKit(l, { kind: "note", num: n });
        return true; // a binding pad must not also plink the piano
      }
      let took = false;
      for (const t of KIT_TARGETS) {
        const b = kitMapRef.current[t.id];
        if (!b || b.kind !== "note" || b.num !== n || !t.pad) continue;
        toggleKill(t.id.slice(5) as Channel);
        took = true;
      }
      return took;
    },
  };
  useEffect(() => {
    setMidiCCSink((cc, v) => kitHandlers.current.cc(cc, v));
    setMidiNoteTap((n) => kitHandlers.current.note(n));
    return () => {
      setMidiCCSink(null);
      setMidiNoteTap(null);
      midiUnsub.current?.();
      midiUnsub.current = null;
    };
  }, []);

  // THE SHOW (user 07-27, third steer — the movie rule and the ⛶ are DEAD):
  // the salt shaker is the one door. Press it and the writing room steps
  // aside — panes, bar, chips gone, the picture owns every pixel — and the
  // glass desk rises CENTRE-STAGE under your hands. You're not editing
  // anymore, you're performing. The show is its OWN state, not fullscreen's:
  // desktop rides requestFullscreen on top of it (denial is a rejected
  // promise, caught — the show goes on unfullscreened); phones have no API
  // and don't need one — the page already owns the screen, so the same
  // posture lands everywhere. Ways back, all equivalent: the ✕ that appears
  // top-right, Esc, or (desktop) the browser's own fullscreen exit. The
  // shaker itself only toggles the DESK inside the show — controller down,
  // picture stays: cinema.
  const [show, setShow] = useState(false);
  const exitShow = useCallback(() => {
    setShow(false);
    setMixerOpen(false);
    try {
      if (document.fullscreenElement) document.exitFullscreen()?.catch(() => {});
    } catch {
      /* already out */
    }
  }, []);
  useEffect(() => {
    // Desktop's native exits (Esc in fullscreen, the OS control) end the show.
    const on = () => {
      if (!document.fullscreenElement) {
        setShow(false);
        setMixerOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => {
    // Esc leaves the show even where fullscreen never engaged (phones with
    // keyboards, denied fullscreen) — same key, same meaning everywhere.
    if (!show) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitShow();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [show, exitShow]);
  const enterShow = () => {
    setShow(true);
    setMixerOpen(true);
    if (!touch) {
      try {
        document.documentElement.requestFullscreen?.()?.catch(() => {});
      } catch {
        /* older engines throw synchronously instead */
      }
    }
  };
  useEffect(() => {
    document.body.classList.toggle("ide-solo", show); // canvas to full brightness
    return () => document.body.classList.remove("ide-solo");
  }, [show]);

  // Does the pane have voices to mix at all? (The handle hides on an empty bench.)
  const hasVoices = useMemo(() => /^\s*_?\$:/m.test(strudel), [strudel]);

  // ── THE TAKE — ● tapes the room AS IT PLAYS: the master (exactly what you
  // hear) plus one 24-bit WAV per orbit straight off the engine's own buses
  // (lib/take-record). Never an offline render — the take can't lag, can't
  // cap out, and an hour-long set streams to disk, not memory.
  const [taping, setTaping] = useState(false);
  const [tapeStart, setTapeStart] = useState(0);
  const [tapePrinting, setTapePrinting] = useState(false);
  const [take, setTake] = useState<TakeResult | null>(null);
  // ✕ PUTS THEM AWAY (user 07-28, second steer — the fold came back): the
  // card tucks into a corner capsule and the grains wait there; the capsule
  // carries its OWN ✕ segment for letting them go completely. Two moves,
  // both legible before the tap.
  const [takeFolded, setTakeFolded] = useState(false);
  // The capsule's ✕ ARMS before it fires (user 07-28, third steer): first
  // tap turns the segment into the question — "let go?" — and only that
  // second, legible tap discards. A few quiet seconds un-ask it.
  const [discardArmed, setDiscardArmed] = useState(false);
  useEffect(() => {
    if (!discardArmed) return;
    const t = setTimeout(() => setDiscardArmed(false), 3000);
    return () => clearTimeout(t);
  }, [discardArmed]);
  const [, tapeTick] = useState(0);
  useEffect(() => {
    if (!taping) return;
    const t = setInterval(() => tapeTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [taping]);
  const toggleTape = async () => {
    if (tapePrinting) return;
    if (!taping) {
      setTake(null);
      const ok = await startTake();
      if (!ok) {
        setNotice("The tape can't roll in this browser.");
        return;
      }
      setTaping(true);
      setTapeStart(Date.now());
      // Frictionless: taping a silent room presses play for you — one
      // gesture, and the downbeat is already on tape. (The ambient picture
      // doesn't count as sound — only the music's transport matters here.)
      if (!stateRef.current.playing) transportRef.current();
    } else {
      setTaping(false);
      setTapePrinting(true);
      const r = await stopTake();
      setTapePrinting(false);
      if (r && r.files.length) {
        setTake(r);
        setTakeFolded(false); // fresh grains always arrive poured out
        setDiscardArmed(false);
      }
      else
        setNotice(
          r ? "The room never made a sound — nothing to keep." : "The take was lost mid-grind.",
        );
    }
  };
  cutTapeRef.current = () => {
    if (taping && !tapePrinting) void toggleTape();
  };
  const saveTakeFile = (f: TakeFile) => {
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const fmtMB = (b: number) =>
    b >= 1048576 * 100 ? `${Math.round(b / 1048576)} MB` : `${(b / 1048576).toFixed(1)} MB`;
  const fmtClock = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const tapeClock = fmtClock(Math.max(0, (Date.now() - tapeStart) / 1000));

  function toggleCopilot() {
    setCopilot((on) => {
      const next = !on;
      try {
        localStorage.setItem("zaltz-copilot", next ? "1" : "0");
      } catch {
        /* pref just won't stick */
      }
      if (!next) killGhost();
      return next;
    });
  }


  // ── tokens ─────────────────────────────────────────────────────────────────
  const [buying, setBuying] = useState<number | null>(null);
  async function buy(usd: number) {
    if (buying) return;
    if (me?.isGuest || !me?.signedIn) {
      setSheet("signin");
      setNotice("Money needs a name on the door — one email and your tokens are forever.");
      return;
    }
    setBuying(usd);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usd, back: "/boiler-room" }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (res.status === 401 && d.code === "account_required") {
        setSheet("signin");
        setNotice(d.error || "Sign in first — then the tokens are yours forever.");
        return;
      }
      if (!res.ok || !d.url) {
        setNotice(d.error || "Couldn't start checkout — try again.");
        return;
      }
      window.location.href = d.url;
    } catch {
      setNotice("Network error.");
    } finally {
      setBuying(null);
    }
  }

  // ── sign-in (claim) ────────────────────────────────────────────────────────
  const [siEmail, setSiEmail] = useState("");
  const [siCode, setSiCode] = useState("");
  const [siState, setSiState] = useState<"idle" | "sending" | "sent" | "verifying">(
    "idle",
  );
  const [siError, setSiError] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const to = siEmail.trim();
    if (!to || siState === "sending") return;
    setSiState("sending");
    setSiError(null);
    let error: unknown;
    try {
      ({ error } = await authClient.emailOtp.sendVerificationOtp({
        email: to,
        type: "sign-in",
      }));
    } catch {
      error = true;
    }
    if (error) {
      setSiState("idle");
      setSiError("Couldn't send the code — try again.");
      return;
    }
    setSiCode("");
    setSiState("sent");
  }

  async function verifyCode(otp: string) {
    setSiState("verifying");
    setSiError(null);
    let error: unknown;
    try {
      ({ error } = await authClient.signIn.emailOtp({ email: siEmail.trim(), otp }));
    } catch {
      error = true;
    }
    if (error) {
      setSiState("sent");
      setSiCode("");
      setSiError("That's not it — check the newest email.");
      return;
    }
    // The guest's whole bench just became the account's (server-side merge).
    setSheet(null);
    setSiState("idle");
    setSiEmail("");
    setNotice("Claimed — everything here is yours forever now.");
    await refreshMe();
  }

  // ── derived bits ───────────────────────────────────────────────────────────
  const remaining = me?.owner ? null : (me?.remainingTokens ?? null);
  // The wall, named: signed in, metered, and dry. The chip burns, the ✦
  // buttons redirect to the register — the machine never just goes mute.
  const spent = !!me?.signedIn && !me.owner && (remaining ?? 0) <= 0;

  // ⇥ ON AN EMPTY PANE — the hint text BECOMES the reality: the placeholder's
  // code lines land in the buffer (free, deterministic), then the copilot
  // continues from there.
  const MUSIC_SEED = 'setcpm(128/4)\n$: s("bd*4").bank("RolandTR909")\n';
  const VISUALS_SEED =
    "osc(4, 0, 1).color(1, .3, .7)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .out()\n";
  // The SEED is free and deterministic, so ⇥-on-the-hint lands it even for a
  // spent account (only the summon that follows costs anything — and a spent
  // summon goes quiet on its own). ✦ complete still routes the broke to the
  // register first.
  const seedMusic = () => {
    setStrudel(MUSIC_SEED);
    setTimeout(() => strudelPane.current?.summon(), 90);
  };
  const seedVisuals = () => {
    setHydra(VISUALS_SEED);
    setTimeout(() => hydraPane.current?.summon(), 90);
  };
  // (completeMusic/completeVisuals — the ✦ complete button's handlers — died
  // with the button; the seeds live on under ⇥-takes-the-hint.)

  // THE ONE-TAP FIX — ✦ on the error chip: the broken pane + its error go up,
  // the mended pane comes back and re-runs itself. The
  // machine either fixes it or says so — never a silent nothing.
  const [fixing, setFixing] = useState(false);
  const fixError = async () => {
    if (!err || fixing) return;
    if (spent) return setSheet("tokens");
    const pane: PaneId = err.startsWith("hydra:") ? "hydra" : "strudel";
    const code = pane === "hydra" ? stateRef.current.hydra : stateRef.current.strudel;
    const message = err.replace(/^hydra:\s*/, "");
    setFixing(true);
    try {
      if (!meRef.current?.signedIn && !(await ensureSession())) return;
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pane, code, error: message }),
      });
      if (res.status === 402) {
        void refreshMe();
        setSheet("tokens");
        return;
      }
      const d = openDeep((await res.json().catch(() => ({}))) as { code?: string });
      const fixed = d.code ?? "";
      if (!fixed.trim()) {
        setNotice("The machine couldn't mend this one — it may not be the code's fault.");
        setErr(null);
        return;
      }
      if (pane === "hydra") setHydra(fixed);
      else setStrudel(fixed);
      setErr(null);
      // The mend proves itself: re-run the pane it healed.
      setTimeout(() => {
        void (pane === "hydra" ? runVisuals() : runMusic());
      }, 80);
    } catch {
      setNotice("The mend didn't reach the machine — try again.");
    } finally {
      setFixing(false);
    }
  };
  // (The header token chip died 2026-07-27 — the profile orb + tokens sheet
  // carry the meter now; less chrome on the instrument.)

  // ✦ EXPLAIN — select code, tap the chip, the machine teaches THAT fragment
  // (2026-07-28). Strictly on-demand — nothing is annotated ahead of time —
  // and Sonnet no-thinking on the server: a teaching sentence, not a take.
  const [lesson, setLesson] = useState<{
    sel: string;
    text: string | null; // null = reading
  } | null>(null);
  const explainSel = async (pane: PaneId, sel: string) => {
    if (spent) return setSheet("tokens");
    setLesson({ sel, text: null });
    try {
      if (!meRef.current?.signedIn && !(await ensureSession())) {
        setLesson(null);
        return;
      }
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pane,
          code: pane === "hydra" ? stateRef.current.hydra : stateRef.current.strudel,
          sel,
        }),
      });
      if (res.status === 402) {
        setLesson(null);
        void refreshMe();
        setSheet("tokens");
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { text?: string };
      const text = (d.text ?? "").trim();
      if (!text) {
        setLesson(null);
        return;
      }
      setLesson({ sel, text });
    } catch {
      setLesson(null);
    }
  };

  // ✎ EDIT — select code, say the change, THE COPILOT PERFORMS IT (2026-07-28,
  // user: "with the AI copilot, you must be able to perform the edit"). An
  // editor's move, not a chat: the reply replaces exactly the selected span,
  // in place, ⌘Z undoes it as ONE step (CodePane's own history), and while
  // the room plays the live-room auto-eval lands it seamlessly.
  const [editSel, setEditSel] = useState<{
    pane: PaneId;
    start: number;
    end: number;
    text: string;
  } | null>(null);
  const [editAsk, setEditAsk] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const openEditSel = (pane: PaneId, sel: { text: string; start: number; end: number }) => {
    if (spent) return setSheet("tokens");
    setEditAsk("");
    setEditSel({ pane, ...sel });
  };
  const sendEditSel = async () => {
    const target = editSel;
    const ask = editAsk.trim();
    if (!target || !ask || editBusy) return;
    setEditBusy(true);
    try {
      if (!meRef.current?.signedIn && !(await ensureSession())) return;
      const base =
        target.pane === "hydra" ? stateRef.current.hydra : stateRef.current.strudel;
      // The pane may have moved under the ask (auto-eval never does, but the
      // hands might) — the span must still read exactly as selected.
      if (base.slice(target.start, target.end) !== target.text) {
        setNotice("The code moved under that selection — select it again.");
        setEditSel(null);
        return;
      }
      const res = await fetch("/api/edit-sel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pane: target.pane,
          code: base,
          start: target.start,
          end: target.end,
          ask,
        }),
      });
      if (res.status === 402) {
        void refreshMe();
        setSheet("tokens");
        return;
      }
      const d = openDeep(
        (await res.json().catch(() => ({}))) as { code?: string; gone?: boolean },
      );
      const out = d.code ?? "";
      // gone = the copilot judged the right edit is REMOVAL (subtraction is a
      // first-class move — "remove this layer" splices to nothing).
      if (!out.trim() && !d.gone) {
        setNotice("That edit wouldn't build — say it differently.");
        return;
      }
      const next = base.slice(0, target.start) + out + base.slice(target.end);
      if (target.pane === "hydra") setHydra(next);
      else setStrudel(next);
      snapRoom(target.pane, "edit", next, { ask }); // corpus gold — save save save
      setEditSel(null);
    } catch {
      setNotice("The edit didn't reach the machine — try again.");
    } finally {
      setEditBusy(false);
    }
  };

  // The run button IS the transport (user's law: hit run, it turns into
  // stop, that is it): `stop` given + active → the same button reads ■ stop.
  // (The "✦ complete" button lived here until 2026-07-26 — the user found it
  // confusing next to a copilot that already whispers on its own. The ghost
  // paths that remain: the caret-park auto-cue, ⌥\/⌃Space, and ⇥.)
  // Pane headers carry NO transport (user 07-27: music and picture play and
  // stop TOGETHER — the one ▶/■ lives in the top bar); a pane is a page of
  // code with a name, lit while its half of the room is live.
  // NO PANE HEADERS (user 07-27, final round: "people do not care about
  // underlying technologies" — STRUDEL/HYDRA retired from the furniture; the
  // code itself says what each pane is, and the row goes back to the code).
  // The whisper's handle survives as a FLOATING CHIP that exists only while
  // a whisper is up — no reserved row, no permanent words.
  const whisperChip = (onTake: () => void) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault(); // the pane must not blur — that hushes the very whisper being taken
        onTake();
      }}
      className="absolute right-2.5 top-2 z-[4] hidden rounded-full border border-white/[0.12] bg-black/30 px-2.5 py-1 text-[11px] text-muted/60 backdrop-blur-xl backdrop-saturate-[1.6] transition hover:text-accent-strong sm:block"
    >
      ⇥ take the whisper
    </button>
  );

  return (
    <main
      className={`ide-safe ide-root relative flex h-dvh flex-col overflow-hidden ${
        show ? "ide-dimmed" : ""
      }`}
      style={kbInset ? { paddingBottom: kbInset + 12 } : undefined}
    >
      {/* legibility scrims — the picture burns behind; the words never sit on
          panels. The movie rule fades them with everything else. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[1] bg-[linear-gradient(to_bottom,rgba(0,0,0,.42),transparent_22%,transparent_62%,rgba(0,0,0,.55))]"
      />

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      {/* CRISP (user 07-27: zaltz rides the same penthouse as klappn.com):
          the furniture wears klappn's own sizes — 15px type in the bar,
          machined /[0.12] edges on the glass — never smaller, never hazier. */}
      {/* A FEATURE PAGE, NOT A SECOND HOME (user 07-28 final): the room signs
          itself the way Tokens and Open do — the house ‹ back-link, then the
          feature's own mark and name. No logo, no code door up here (the
          brand and the GitHub both live at home). */}
      <header className="flex items-center gap-2.5 py-3">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-1 text-[15px] text-muted transition hover:text-foreground"
          title="Back to your hits"
        >
          <span className="text-lg leading-none transition group-hover:-translate-x-0.5">
            ‹
          </span>
          <span className="hidden sm:inline">Hits</span>
        </Link>
        <span className="flex min-w-0 shrink-0 items-center gap-2">
          <BoilerMark className="h-[17px] w-[17px] shrink-0" />
          <span className="truncate text-[15px] font-medium tracking-tight text-foreground">
            Boiler room
          </span>
        </span>
        {/* the air in the middle belongs to the room */}
        <span className="min-w-0 flex-1" />
        {/* THE LINEUP — the night's structure lives up top with the other
            room-level controls (user 07-28: the corner chip read wrong).
            Quiet word; the house dropdown opens beneath it. */}
        <div className="relative shrink-0">
          <button
            onClick={() => setLineupOpen((o) => !o)}
            aria-expanded={lineupOpen}
            title="The lineup — your hits, ordered for the night; pour one in and play on top"
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] transition active:scale-[.97] ${
              lineupOpen
                ? "bg-white/[0.1] text-foreground"
                : "bg-white/[0.05] text-muted/60 hover:text-foreground"
            }`}
          >
            Lineup
            {lineup.length > 0 && (
              <span className="tabular-nums text-muted/50">{lineup.length}</span>
            )}
          </button>
          <BoilerLineup
            open={lineupOpen}
            onClose={() => setLineupOpen(false)}
            queue={lineup}
            currentIdx={lineupIdx}
            hits={lineupHits}
            onAdd={addToLineup}
            onRemove={removeFromLineup}
            onMove={moveLineup}
            onPlay={(i) => void pourSong(i)}
            onNext={() => {
              if (lineupIdx != null) void pourSong(lineupIdx + 1);
            }}
            onArrange={() => void arrangeLineup()}
            arranging={arranging}
          />
        </div>
        {/* THE TRANSPORT CAPSULE — play and tape are ONE machined object
            (the seam law: one capsule, one hairline). ▶/■ rules the room;
            ● is its tape deck, fused to it because they share one life:
            stop cuts the take, ● on a silent room presses play. While the
            tape rolls the whole capsule burns — you can FEEL the room being
            rendered. */}
        {/* STATE LIVES IN THE MARK, NOT A SLAB (user 07-27: "all in pink
            like lipstick") — idle is the tape side's own quiet grey glass;
            playing turns the icon and the word pink. The capsule stays one
            calm object; only the ink changes. */}
        <div
          className={`flex shrink-0 items-stretch overflow-hidden rounded-full border transition ${
            taping
              ? "border-accent/60 shadow-[0_0_36px_-6px_rgba(224,49,156,.85)]"
              : transportOn
                ? "border-accent/40"
                : "border-white/[0.12]"
          }`}
        >
          <button
            onClick={transport}
            title={
              transportOn
                ? taping
                  ? "Stop (⌘.) — cuts the take"
                  : "Stop (⌘.)"
                : "Play the room — ⌘↵ evals a pane"
            }
            className={`px-4 py-2 text-[13.5px] font-medium backdrop-blur transition active:scale-[.96] ${
              transportOn
                ? "bg-accent/[0.1] text-accent-strong hover:bg-accent/[0.16]"
                : "bg-white/[0.08] text-muted/80 hover:bg-white/[0.14] hover:text-foreground"
            }`}
          >
            {/* REAL GEOMETRY, not font glyphs (user 07-27: "the stop icon is
                not centered on the same point as the play icon"): ▶ and ■
                were text, each with its own advance width and baseline, so
                the mark JUMPED when the state flipped. Now both marks are
                drawn on the same SVG center in a fixed slot, and the word
                sits in a fixed-width cell — play↔stop swaps with nothing
                moving but the shape itself. */}
            {waking ? (
              "waking…"
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <svg viewBox="0 0 14 14" className="h-[13px] w-[13px] shrink-0" aria-hidden>
                  {transportOn ? (
                    <rect x="2.5" y="2.5" width="9" height="9" rx="1.4" fill="currentColor" />
                  ) : (
                    <path d="M4 2.8 L11.4 7 L4 11.2 Z" fill="currentColor" />
                  )}
                </svg>
                <span className="w-[31px] text-left">{transportOn ? "stop" : "play"}</span>
              </span>
            )}
          </button>
          <span className="w-px bg-black/30" aria-hidden />
          <button
            onClick={() => void toggleTape()}
            disabled={tapePrinting}
            title={
              taping
                ? "Cut the take — it grinds into grains"
                : "Tape the take — the master + a WAV per layer, rendered live"
            }
            className={`group flex items-center gap-1.5 px-3.5 py-2 transition active:scale-[.96] ${
              taping
                ? "bg-accent/[0.14]"
                : transportOn
                  ? "bg-accent/[0.08] hover:bg-accent/[0.16]"
                  : "bg-white/[0.08] backdrop-blur hover:bg-white/[0.14]"
            }`}
          >
            {taping ? (
              <>
                <span className="relative flex h-[11px] w-[11px]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                  <span
                    className="relative inline-flex h-[11px] w-[11px] rounded-full shadow-[0_0_14px_rgba(224,49,156,.9)]"
                    style={{ backgroundImage: "linear-gradient(135deg,#ff63c1,#b3126f)" }}
                  />
                </span>
                <span className="text-[12.5px] font-medium tabular-nums text-accent-strong">
                  {tapeClock}
                </span>
              </>
            ) : tapePrinting ? (
              <span className="shimmer-text text-[12px]">grinding…</span>
            ) : (
              <span className="inline-flex h-[11px] w-[11px] rounded-full bg-white/40 transition group-hover:bg-accent group-hover:shadow-[0_0_12px_rgba(224,49,156,.8)]" />
            )}
          </button>
        </div>
        {/* THE LIVE DOOR — ◉ streams the room to anyone with the link (the
            Sets contract, worn here unchanged: one DJ flow to learn). */}
        {!liveLink ? (
          <button
            onClick={() => void openLive()}
            disabled={liveBusy}
            title="Go live — the room streams to anyone with the link"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-2 text-[13px] text-muted/60 transition hover:text-foreground active:scale-[.97] disabled:opacity-60 sm:inline-flex"
          >
            <span className="text-accent-strong/80">◉</span>
            {liveBusy ? "opening…" : "Go live"}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1.5 text-[12.5px]">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-strong" />
            </span>
            <span className="hidden text-accent-strong sm:inline">on air</span>
            <button
              onClick={copyLive}
              title="Copy the listener link"
              className="text-muted/80 transition hover:text-foreground"
            >
              {liveCopied ? "copied" : "copy link"}
            </button>
            <button
              onClick={endLivePress}
              title={endArmed ? "Yes — end the broadcast" : "End the broadcast"}
              className={
                endArmed
                  ? "rounded-full bg-red-400/[0.12] px-2 text-red-300"
                  : "text-muted/60 transition hover:text-foreground"
              }
            >
              {endArmed ? "sure?" : "end"}
            </button>
          </div>
        )}
        {/* No Save button, no save INDICATOR (user 07-27: "kept" confused —
            less is more): the work simply keeps itself, silently. */}
        <button
          onClick={toggleCopilot}
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] transition active:scale-[.97] sm:inline-flex ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60 hover:text-foreground"
          }`}
          title="Copilot — it whispers as you type: ⇥ takes it, ⌥\ summons one, Esc hushes it"
        >
          <CopilotMark on={copilot} />Copilot</button>
        {/* NO AVATAR (user 07-28): no other feature page wears one — the
            person's door lives at home. The paying moment still speaks here
            (the tokens-dry notice + the sign-in sheet the machine opens). */}
      </header>

      {/* ── mobile: ONE pill, "visuals" (user 07-27, final: sound is the
          room's resting pane; the pill is the door to the picture's code —
          lit while you're behind the lens, quiet when you're back on the
          beat). The eye is its mark; state lives in the ink. ────────────── */}
      <div className="mb-2 flex items-center gap-1.5 sm:hidden">
        <button
          onClick={() => setMobilePane(mobilePane === "hydra" ? "strudel" : "hydra")}
          aria-pressed={mobilePane === "hydra"}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] backdrop-blur transition active:scale-[.97] ${
            mobilePane === "hydra"
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60 ring-1 ring-inset ring-white/[0.1]"
          }`}
        >
          {/* A LENS, not an eye (user 07-27: "the eye looks creepy") — two
              machined rings and one specular glint: the photographer's own
              object for "the picture", clean as turned metal. */}
          <svg viewBox="0 0 14 14" className="h-[13px] w-[13px]" aria-hidden>
            <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.75" />
            <circle cx="4.9" cy="4.6" r="1" fill="currentColor" />
          </svg>
          visuals
        </button>
        <span className="flex-1" />
        <button
          onClick={toggleCopilot}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition active:scale-[.97] ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60"
          }`}
        >
          <CopilotMark on={copilot} />Copilot</button>
      </div>

      {/* ── the panes (all gone in solo — the picture alone) ────────────── */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* REAL GLASS (user 07-27: "they do not feel see-through"): the old
            black/45 smoke over a heavy blur ate the picture — nothing moved
            behind the pane, so it read as a panel. Glass is thin smoke, a
            SATURATED backdrop (the room's colors bleed through vivid, that's
            the "alive" tell), and a machined top highlight. The type carries
            its own shadow for bright frames — see .code-pane pre. */}
        <section
          className={`relative min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.14] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,.09),inset_0_-1px_0_rgba(255,255,255,.03)] backdrop-blur-2xl backdrop-saturate-[1.6] transition focus-within:border-accent/30 sm:flex sm:w-[58%] ${
            mobilePane === "strudel" ? "flex w-full" : "hidden"
          }`}
        >
          {ghost?.pane === "strudel" &&
            whisperChip(() => strudelPane.current?.take())}
          <CodePane
            ref={strudelPane}
            value={strudel}
            onChange={(v) => {
              if (ghost?.pane === "strudel") killGhost();
              setStrudel(v);
            }}
            onRun={() => void runMusic()}
            pondering={pondering === "strudel" && ghost?.pane !== "strudel"}
            ghost={ghost?.pane === "strudel" ? ghost.text ?? null : null}
            trim={ghost?.pane === "strudel" ? ghost.trim ?? null : null}
            onGhostAccept={() => {
              // an accepted whisper is the corpus's strongest signal
              snapRoom("strudel", "take", stateRef.current.strudel, {
                ghost: ghost?.text?.slice(0, 2000) ?? "",
                ...(ghost?.trim ? { trim: ghost.trim } : {}),
              });
              killGhost();
              // THE REAL-TIME LAW: a take made mid-set LANDS mid-set — the new
              // line crossfades into the running mix, no extra gesture.
              if (stateRef.current.playing) setTimeout(() => void runMusic(), 60);
            }}
            onGhostDismiss={killGhost}
            onTakeHint={seedMusic}
            onCaretIdle={(ctx) => void requestGhost("strudel", ctx)}
            onExplain={(sel) => void explainSel("strudel", sel)}
            onEditSel={(sel) => openEditSel("strudel", sel)}
            placeholder={`setcpm(128/4)\n$: s("bd*4").bank("RolandTR909")\n\n// type, then hit ▶ run — the room hears you\n// pause, and the machine whispers the next line${
              touch
                ? "\n// tap the grey — it becomes yours"
                : "\n// on keys: ⌘↵ runs · ⇥ takes what's grey — this starter too"
            }`}
          />
        </section>
        <section
          className={`relative min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.14] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,.09),inset_0_-1px_0_rgba(255,255,255,.03)] backdrop-blur-2xl backdrop-saturate-[1.6] transition focus-within:border-accent/30 sm:flex ${
            mobilePane === "hydra" ? "flex w-full" : "hidden"
          }`}
        >
          {ghost?.pane === "hydra" &&
            whisperChip(() => hydraPane.current?.take())}
          <CodePane
            ref={hydraPane}
            value={hydra}
            onChange={(v) => {
              if (ghost?.pane === "hydra") killGhost();
              setHydra(v);
            }}
            onRun={runVisuals}
            pondering={pondering === "hydra" && ghost?.pane !== "hydra"}
            ghost={ghost?.pane === "hydra" ? ghost.text ?? null : null}
            trim={ghost?.pane === "hydra" ? ghost.trim ?? null : null}
            onGhostAccept={() => {
              snapRoom("hydra", "take", stateRef.current.hydra, {
                ghost: ghost?.text?.slice(0, 2000) ?? "",
                ...(ghost?.trim ? { trim: ghost.trim } : {}),
              });
              killGhost();
              // A visual take repaints the room the moment it's taken.
              setTimeout(() => runVisuals(), 60);
            }}
            onGhostDismiss={killGhost}
            onTakeHint={seedVisuals}
            onCaretIdle={(ctx) => void requestGhost("hydra", ctx)}
            onExplain={(sel) => void explainSel("hydra", sel)}
            onEditSel={(sel) => openEditSel("hydra", sel)}
            placeholder={`osc(4, 0, 1).color(1, .3, .7)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .out()\n\n// the walls, in code — ▶ run paints them${
              touch
                ? "\n// tap the grey — it becomes yours"
                : "\n// ⇥ takes what's grey — this starter too"
            }`}
          />
        </section>
      </div>

      {/* ── errors / notices ──────────────────────────────────────────────
          THE CHIP WAITS FOR THE THOUGHT TO CLOSE (user 07-27: "we are typing
          s(\" ... it is annoying"): while the erroring pane ends on an open
          bracket, a dangling operator or an unclosed quote, the coder is
          mid-keystroke, not stuck — the complaint (and its ✦ fix) holds its
          tongue until the brackets balance. It vanishes DURING the fix too:
          type `(` and the chip steps back until you close it. */}
      {(liveErr || notice) && (
        /* A CAPSULE, not a banner (user 07-27): full-width on the phone, but
           on desktop it hugs its words and centres — so the ✦ fix sits right
           beside the complaint instead of a screen-width away. */
        <div
          className={`mt-2 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 backdrop-blur-xl sm:mx-auto sm:w-fit sm:max-w-2xl ${
            liveErr
              ? "border-red-400/25 bg-red-950/35 shadow-[0_0_44px_-18px_rgba(248,113,113,.5)]"
              : "border-accent/30 bg-black/55 shadow-[0_0_44px_-16px_rgba(224,49,156,.55)]"
          }`}
        >
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] ${
              liveErr
                ? "bg-red-400/[0.12] text-red-300/90"
                : "bg-accent/[0.14] text-accent-strong"
            }`}
          >
            {liveErr ? (liveErr.startsWith("hydra:") ? "hydra" : "strudel") : "✦"}
          </span>
          <p
            className={`min-w-0 flex-1 truncate text-[12.5px] leading-snug ${
              liveErr ? "text-red-200/90" : "text-accent-strong/95"
            }`}
            title={liveErr ?? notice ?? undefined}
          >
            {liveErr ? humanizeEngineError(liveErr.replace(/^hydra:\s*/, "")) : notice}
          </p>
          {liveErr && (
            <button
              onClick={() => void fixError()}
              disabled={fixing}
              title="The machine reads the error and mends the code — one tap"
              className="shrink-0 rounded-full border border-accent/40 bg-accent/[0.12] px-2.5 py-1 text-[12px] text-accent-strong shadow-[0_0_24px_-8px_rgba(224,49,156,.8)] transition hover:bg-accent/[0.2] active:scale-[.96] disabled:opacity-70"
            >
              {fixing ? <span className="shimmer-text">sifting…</span> : "✦ fix"}
            </button>
          )}
          <button
            onClick={() => {
              setErr(null);
              setNotice(null);
            }}
            className="shrink-0 text-[12px] text-muted/60 transition hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── the lesson — ✦ explain's answer: the selected line quoted, then
          what it does to the ear (or the eye), in plain words. A capsule like
          the error chip's; ✕ closes it (✕ = dismiss, everywhere). */}
      {/* ✎ THE ASK — the selection edit's command bar (07-28, "it must fuck
          cleanly"): ONE machined glass capsule floating centre-bottom, the
          house cmdbar idiom — pink-lit rim, inset crown, the span in mono
          behind a hairline, your words in the middle, the orb'd word spends.
          Rides above the shaker, lifts over the phone keyboard, pill-pops in.
          Esc or ✕ lets it go; nothing outside the selection is ever touched.
          Centred by INSETS, never transform — the pill-pop entrance owns the
          transform channel (its final keyframe stomped a translateX centring,
          seen live: the bar drifted off the right edge); the keyboard lift
          rides `bottom` for the same reason. */}
      {editSel && (
        <div
          className="pill-pop fixed inset-x-3 z-30 mx-auto max-w-xl transition-[bottom] duration-150"
          style={{
            bottom: `calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.4rem + ${kbInset}px)`,
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-black/60 py-1.5 pl-4 pr-1.5 shadow-[0_0_70px_-18px_rgba(224,49,156,.55),0_18px_50px_-20px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.1)] backdrop-blur-2xl backdrop-saturate-[1.6]">
            <span aria-hidden className="shrink-0 text-[13px] leading-none text-accent-strong/80">
              ✎
            </span>
            <span
              className="max-w-[24%] shrink-0 truncate font-mono text-[11.5px] text-muted/60"
              title={editSel.text}
            >
              {editSel.text}
            </span>
            <span className="h-4 w-px shrink-0 bg-white/[0.12]" aria-hidden />
            <input
              autoFocus
              value={editAsk}
              onChange={(e) => setEditAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendEditSel();
                if (e.key === "Escape") setEditSel(null);
              }}
              placeholder="say the change — it rewrites just this"
              disabled={editBusy}
              /* 16px on touch — under that, iOS zooms the whole page into the
                 input and the room lurches (the classic mobile form bug).
                 Inline outline:none — the GLOBAL :focus-visible ring boxed
                 the input inside its own capsule (the capsule's pink rim is
                 the focus cue); inline beats the unlayered global rule. */
              style={{ outline: "none" }}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground caret-accent placeholder:text-muted/40 disabled:opacity-60 sm:text-[13.5px]"
            />
            <button
              onClick={() => void sendEditSel()}
              disabled={editBusy || !editAsk.trim()}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition active:scale-[.95] disabled:opacity-40 ${
                editBusy
                  ? "text-accent-strong"
                  : "bg-accent/[0.12] text-accent-strong hover:bg-accent/[0.2]"
              }`}
            >
              {editBusy ? (
                <span className="shimmer-text">reworking…</span>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
                  />
                  edit
                </>
              )}
            </button>
            <button
              onClick={() => setEditSel(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] text-muted/60 transition hover:bg-white/[0.06] hover:text-foreground active:scale-[.92]"
              aria-label="Let it go"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {lesson && (
        <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-accent/25 bg-black/55 px-3.5 py-2.5 shadow-[0_0_44px_-16px_rgba(224,49,156,.45)] backdrop-blur-xl sm:mx-auto sm:max-w-2xl">
          <span className="mt-0.5 shrink-0 rounded-full bg-accent/[0.14] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
            ✦
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11.5px] text-muted/70" title={lesson.sel}>
              {lesson.sel}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">
              {lesson.text ?? <span className="shimmer-text">reading the line…</span>}
            </p>
          </div>
          <button
            onClick={() => setLesson(null)}
            className="shrink-0 text-[12px] text-muted/60 transition hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}


      {/* ── the GRAINS card (user 07-28: "it must fuck") — the tape, cut and
          ground into grains, presented like something machined: the house
          gradient poured along the crown, thin smoke over the live picture,
          the master on top of the pour. Every row is a file — the label says
          what it is, the size what it weighs, one tap and it's yours. The
          card's ✕ PUTS THEM AWAY (user 07-28, second steer: the corner
          keep-safe was right) — they tuck into the capsule below; letting
          them go completely is the capsule's own ✕ segment. */}
      {take && takeFolded && (
        /* THE GRAINS, PUT AWAY — one QUIET segmented capsule (user 07-28,
           third steer: the loud pour was wrong at rest — "it must fuck
           cleanly"). Slim glass, muted ink, one hairline seam: tap the
           grains to pour them back out; the ✕ segment ASKS first — it arms
           into "let go?" and only the second tap discards (saved files stay
           saved). */
        <div className="pill-pop fixed bottom-4 left-4 z-[18] flex items-stretch overflow-hidden rounded-full border border-white/[0.14] bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-xl backdrop-saturate-[1.6]">
          <button
            onClick={() => {
              setDiscardArmed(false);
              setTakeFolded(false);
            }}
            title="The grains — pour them back out"
            className="flex items-center gap-1.5 py-1.5 pl-3 pr-2.5 text-[11.5px] text-muted/70 transition hover:bg-white/[0.05] hover:text-accent-strong active:scale-[.97]"
          >
            grains
            <span className="tabular-nums text-muted/50">· {take.files.length}</span>
          </button>
          <span className="w-px self-stretch bg-white/[0.1]" aria-hidden />
          <button
            onClick={() => (discardArmed ? setTake(null) : setDiscardArmed(true))}
            aria-label={discardArmed ? "Yes — let the grains go" : "Let the grains go"}
            title={
              discardArmed
                ? "Tap again and they're gone — anything you saved stays saved"
                : "Let them go — it asks once first"
            }
            className={`py-1.5 transition active:scale-[.94] ${
              discardArmed
                ? "bg-red-400/[0.12] px-2.5 text-[11px] font-medium text-red-300 hover:bg-red-400/[0.2]"
                : "px-2.5 text-[11.5px] text-muted/50 hover:bg-white/[0.05] hover:text-foreground"
            }`}
          >
            {discardArmed ? "let go?" : "✕"}
          </button>
        </div>
      )}
      {take && !takeFolded && (
        <div className="pill-pop fixed bottom-4 left-4 z-[18] w-[290px] overflow-hidden rounded-[26px] border border-accent/30 bg-black/45 shadow-[0_24px_80px_-18px_rgba(224,49,156,.6),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl backdrop-saturate-[1.6]">
          {/* the crown — one thread of the hot gradient along the top edge,
              the same pour as every machined object in the house */}
          <span
            aria-hidden
            className="block h-[2px] w-full bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] opacity-90"
          />
          <div className="p-4">
            <div className="flex items-baseline gap-2">
              <span className="wordmark bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] bg-clip-text text-[17px] leading-none text-transparent">
                grains
              </span>
              <span className="text-[12px] tabular-nums text-muted/80">
                {fmtClock(take.seconds)}
              </span>
              <span className="flex-1" />
              <button
                onClick={() => setTakeFolded(true)}
                className="-m-1.5 p-1.5 text-[13px] text-muted/60 transition hover:text-foreground active:scale-[.92]"
                aria-label="Put the grains away"
                title="Put them away — they wait in the corner"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 space-y-0.5">
              {take.files.map((f) => (
                <li key={f.name}>
                  <button
                    onClick={() => saveTakeFile(f)}
                    className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-accent/[0.09] active:scale-[.99]"
                    title={`Save ${f.filename}`}
                  >
                    {/* the grain itself — a speck of the pour; the stems'
                        specks sit quieter than the master's */}
                    <span
                      className={`h-[7px] w-[7px] shrink-0 rounded-full transition ${
                        f.kind === "stem"
                          ? "bg-white/25 group-hover:bg-accent/70"
                          : "shadow-[0_0_10px_rgba(224,49,156,.8)]"
                      }`}
                      style={
                        f.kind === "stem"
                          ? undefined
                          : { backgroundImage: "linear-gradient(135deg,#ff63c1,#b3126f)" }
                      }
                      aria-hidden
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        f.kind === "stem"
                          ? "text-foreground/80"
                          : "font-semibold tracking-wide text-foreground"
                      }`}
                    >
                      {f.label}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted/55">
                      {fmtMB(f.bytes)}
                    </span>
                    <span className="shrink-0 text-[13px] text-muted/45 transition group-hover:text-accent-strong">
                      ⤓
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {take.files.length > 1 && (
              <button
                onClick={() =>
                  take.files.forEach((f, i) => setTimeout(() => saveTakeFile(f), i * 350))
                }
                className="btn-primary mt-3 w-full rounded-full px-3 py-2 text-[13px] font-medium transition active:scale-[.98]"
              >
                ⤓ every grain
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── the desk — the Sets deck's machinery worn by the instrument:
          SEASON TO TASTE (components/ZaltzMixer). Pure view; the audio wiring
          (kills, master chain, scheduler nudge, canvas filters) stays here.
          The .ide-live wrapper keeps the desk AND the shaker alive through
          the show's dim — they're the performance, not the furniture. The
          shaker is the show's door: opening the desk takes the room
          fullscreen (desktop; phones have no API and just get the desk). */}
      {(hasVoices || hydra.trim()) && (
        <div className="ide-live contents">
        {/* ONE object, ONE toggle (user 07-27, fourth steer — the ✕ is dead):
            the shaker opens the show and the shaker closes it. Wanting the
            picture without the desk is the DESK's own affair — its grabber
            folds it flat (ZaltzMixer), the shaker never learns a second
            verb. Esc stays as the keyboard's word for the same exit. */}
        <ZaltzMixer
          open={mixerOpen}
          onToggle={() => (show ? exitShow() : enterShow())}
          tab={mixerTab}
          onTab={setMixerTab}
          playing={playing}
          kills={kills}
          onKill={toggleKill}
          heldPad={heldPad}
          onPadDown={padDown}
          onPadUp={padUp}
          master={master}
          onMaster={moveMaster}
          nudge={nudge}
          onNudge={moveNudge}
          keyShift={key}
          onKeyShift={moveKey}
          perf={perf}
          onPerf={movePerf}
          light={light}
          onLight={moveLight}
          canSwarm={canSwarm}
          swarm={swarm}
          onSwarm={moveSwarm}
          midi={midiSnap}
          kitMap={kitMap}
          learn={learn}
          onMidiToggle={() => {
            if (midiSnap?.enabled) disableLiveMidi();
            else void enableLiveMidi();
          }}
          onMidiInstrument={setMidiInstrument}
          onMidiInput={cycleMidiInput}
          onLearn={setLearn}
          onUnbind={unbindKit}
          canMic={canMic}
          micOn={micOn}
          onMic={() => void toggleMic()}
          micFx={micFx}
          onMicFx={micDial}
          micVoice={micVoice}
          onMicVoice={micVoiceTo}
          micLook={micLook}
          onMicLook={micLookTo}
          micHint={micHint}
          mics={mics}
          micDeviceId={micDeviceId}
          onMicDevice={micDeviceTo}
          micDotRef={micDotRef}
        />
        </div>
      )}

      {/* ── sheets ──────────────────────────────────────────────────────── */}
      {sheet && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center"
          onClick={() => setSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl border border-accent/20 bg-black/70 p-5 shadow-[0_0_80px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl"
          >
            {/* (The sketches sheet died with the Grains pill — saved work
                lives in the ▾ beside the name now.) */}

            {sheet === "tokens" && (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[15px] font-medium text-foreground">Tokens</h2>
                  <span className="text-[12.5px] tabular-nums text-muted">
                    {me?.owner
                      ? "house account — unmetered"
                      : me?.signedIn
                        ? spent
                        ? "the machine waits — feed it"
                        : `${fmtTokens(Math.max(0, remaining ?? 0))} left · ~${Math.floor(
                            Math.max(0, remaining ?? 0) / TOKENS_PER_GHOST,
                          ).toLocaleString()} whispers`
                        : "the instrument is free — the machine is prepaid"}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  The machine writes when you feed it. $5 per million — the
                  model&apos;s own rate, passed straight through — flat, never
                  expiring — the whole price sheet is a screen of open code.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CREDIT_PACK_USD.map((usd, i) => {
                    const tokens = tokensForUsdCents(usd * 100);
                    const fee = cardFeeCents(usd * 100);
                    const anchor = usd === 10;
                    return (
                      <div
                        key={usd}
                        style={{ "--i": i } as CSSProperties}
                        className="animate-rise flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
                      >
                        <span className="wordmark text-[20px] leading-none text-foreground">
                          ${usd}
                        </span>
                        <span className="mt-1 text-[12px] text-foreground/80">
                          {fmtTokens(tokens)} tokens
                        </span>
                        <span className="text-[11px] tabular-nums text-muted/60">
                          + ${(fee / 100).toFixed(2)} card fee
                        </span>
                        <button
                          onClick={() => void buy(usd)}
                          disabled={buying !== null}
                          className={`mt-2.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[.97] disabled:opacity-40 ${
                            anchor
                              ? "btn-primary"
                              : "bg-white/[0.06] text-foreground hover:bg-white/[0.1]"
                          }`}
                        >
                          {buying === usd ? (
                            <span className="shimmer-text">Opening…</span>
                          ) : (
                            "Top up"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted/60">
                  The card fee is Stripe&apos;s, passed through to the cent.{" "}
                  <Link href="/open" className="underline decoration-white/20 transition hover:text-foreground">
                    Here&apos;s the whole deal
                  </Link>
                  .
                </p>
              </>
            )}

            {sheet === "signin" && (
              <>
                <h2 className="text-[15px] font-medium text-foreground">
                  {me?.isGuest ? "Claim your work" : "Sign in"}
                </h2>
                {siState === "sent" || siState === "verifying" ? (
                  <>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                      A 6-digit code is in your inbox — sent to{" "}
                      <span className="text-foreground/80">{siEmail.trim()}</span>.
                    </p>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      autoFocus
                      value={siCode}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setSiCode(digits);
                        setSiError(null);
                        if (digits.length === 6) void verifyCode(digits);
                      }}
                      placeholder="••••••"
                      disabled={siState === "verifying"}
                      className="mt-3 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-[22px] font-semibold tracking-[0.45em] text-foreground outline-none transition placeholder:text-muted/30 focus:border-accent/45 disabled:opacity-60"
                    />
                    {siState === "verifying" && (
                      <p className="mt-2 text-[13px] text-muted">
                        <span className="shimmer-text">Opening the door…</span>
                      </p>
                    )}
                    {siError && <p className="mt-2 text-[13px] text-red-400">{siError}</p>}
                    <button
                      onClick={() => {
                        setSiState("idle");
                        setSiCode("");
                        setSiError(null);
                      }}
                      className="mt-2.5 text-[13px] text-muted transition hover:text-foreground"
                    >
                      Different email
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                      One email.{" "}
                      <span className="text-foreground/85">
                        Everything you&apos;ve made here becomes yours forever
                      </span>{" "}
                      — your tokens, all of it, on any machine.
                    </p>
                    <form onSubmit={sendCode} className="mt-3 flex gap-2">
                      <input
                        type="email"
                        required
                        autoFocus
                        value={siEmail}
                        onChange={(e) => setSiEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[15px] text-foreground outline-none transition placeholder:text-muted/45 focus:border-accent/45"
                      />
                      <button
                        type="submit"
                        disabled={siState === "sending"}
                        className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-[14px] font-medium active:scale-[.98] disabled:opacity-50"
                      >
                        {siState === "sending" ? "Sending…" : "Send code"}
                      </button>
                    </form>
                    {siError && <p className="mt-2 text-[13px] text-red-400">{siError}</p>}
                    <p className="mt-2 text-[11.5px] leading-relaxed text-muted/55">
                      No password — a code lands in your inbox. Signing in agrees to
                      the{" "}
                      <a href="/terms" className="underline decoration-white/20">
                        Terms
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" className="underline decoration-white/20">
                        Privacy
                      </a>
                      .
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/** One deck dial (the Sets deck's own design): whispered label, live mono
 *  readout, accent fill drawn to the value — bipolar dials fill from centre
 *  and double-tap back to zero. */
