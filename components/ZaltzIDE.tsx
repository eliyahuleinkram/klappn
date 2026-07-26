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
  ensurePerfFx,
  fadeMaster,
  playPart,
  setLiveCps,
  setLivePerf,
  setExplicitVisualsDrive,
  setHydraErrorSink,
  setStrudelErrorSink,
  setVisuals,
  startIdleVisual,
  stop,
  updateVisuals,
} from "@/lib/strudel-client";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  assignChannelOrbits,
  channelOfOrbit,
  type Channel,
} from "@/lib/set-live";
import ZaltzMixer from "./ZaltzMixer";
import { transformForPlayback } from "@/lib/playback";
import {
  cardFeeCents,
  CREDIT_PACK_USD,
  TOKENS_PER_GHOST,
  tokensForUsdCents,
} from "@/lib/pricing";
import { ZALTZ_GITHUB_URL, ZALTZ_NPM_URL } from "@/lib/links";

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

interface Sketch {
  id: string;
  title: string;
  strudel: string;
  hydra: string;
  updated_at: string;
}

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

/** The copilot's mark — a spark trailing a smaller one, cut as an SVG so it
 *  scales crisp and wears the house gradient while the copilot rides along.
 *  The gradient id is per-instance (useId): two marks render (desktop pill +
 *  mobile row), and a shared id resolved into the display:none twin, which
 *  left the visible mark unpainted on phones (2026-07-27). */
function CopilotMark({ on }: { on: boolean }) {
  const uid = useId();
  const grad = `copilot-spark-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] shrink-0" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff63c1" />
          <stop offset="55%" stopColor="#e0319c" />
          <stop offset="100%" stopColor="#b3126f" />
        </linearGradient>
      </defs>
      <path
        d="M10 1 C11.2 6.8 13.2 8.8 19 10 C13.2 11.2 11.2 13.2 10 19 C8.8 13.2 6.8 11.2 1 10 C6.8 8.8 8.8 6.8 10 1 Z"
        fill={on ? `url(#${grad})` : "currentColor"}
        opacity={on ? 1 : 0.55}
      />
      <path
        d="M19 15 C19.6 17.4 20.6 18.4 23 19 C20.6 19.6 19.6 20.6 19 23 C18.4 20.6 17.4 19.6 15 19 C17.4 18.4 18.4 17.4 19 15 Z"
        fill={on ? `url(#${grad})` : "currentColor"}
        opacity={on ? 0.9 : 0.45}
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

export default function ZaltzIDE() {
  const [strudel, setStrudel] = useState(STARTERS[0].strudel);
  const [hydra, setHydra] = useState(STARTERS[0].hydra);
  const [title, setTitle] = useState(STARTERS[0].name);
  const [sketchId, setSketchId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [me, setMe] = useState<Me | null>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);

  // Phones OVERLAY the keyboard — without this the transport (and the ⇥ take
  // pill) vanish behind it the moment a pane focuses.
  const kbInset = useKeyboardInset();
  // Copy law: a phone is NEVER told to press keys it doesn't have — every
  // in-pane hint speaks buttons on touch, chords on desktop.
  const touch = useIsMobile("(pointer: coarse)");

  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // THE COPILOT — ghost completions at the caret (Tab takes, Esc bins).
  const [copilot, setCopilot] = useState(true);
  const [ghost, setGhost] = useState<{ pane: PaneId; text: string } | null>(null);
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
  const ghostLRU = useRef(new Map<string, string>());
  // The out-of-tokens line is said ONCE per visit — after that the burning
  // chip and the redirected \u2726 buttons carry it.
  const spentToldRef = useRef(false);
  const strudelPane = useRef<CodePaneHandle>(null);
  const hydraPane = useRef<CodePaneHandle>(null);


  const [sheet, setSheet] = useState<null | "sketches" | "tokens" | "signin">(null);
  const [mobilePane, setMobilePane] = useState<PaneId>("strudel");
  const [sFlash, setSFlash] = useState(0);
  const [hFlash, setHFlash] = useState(0);

  const runId = useRef(0);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;
  const stateRef = useRef({
    strudel,
    hydra,
    title,
    sketchId,
    playing,
  });
  stateRef.current = { strudel, hydra, title, sketchId, playing };

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
    // Restore the last unsaved bench state, else open on the first starter.
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as {
          strudel?: string;
          hydra?: string;
          title?: string;
          sketchId?: string | null;
        };
        if (typeof d.strudel === "string") setStrudel(scrubLegacyHints(d.strudel));
        if (typeof d.hydra === "string") setHydra(scrubLegacyHints(d.hydra));
        if (typeof d.title === "string" && d.title) setTitle(d.title);
        setSketchId(d.sketchId ?? null);
      }
    } catch {
      /* a bad draft never blocks the bench */
    }
    // Identity first, then the crate — the sketches call is session-gated.
    void (async () => {
      await refreshMe();
      await refreshSketches();
    })();
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The bench survives a reload — every keystroke lands in localStorage (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ strudel, hydra, title, sketchId }),
        );
      } catch {
        /* storage full/blocked — the DB save still works */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [strudel, hydra, title, sketchId]);

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

  async function refreshSketches() {
    // Signed out there is nothing to list — and an uncaught 401 in the console
    // reads like a broken page to anyone who opens devtools.
    if (!meRef.current?.signedIn) return;
    try {
      const res = await fetch("/api/sketches");
      if (!res.ok) return;
      const d = openDeep((await res.json()) as { sketches: Sketch[] });
      setSketches(d.sketches ?? []);
    } catch {
      /* list is cosmetic */
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
  const runMusic = useCallback(async () => {
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
    setSFlash((f) => f + 1);
    ghostSeq.current++;
    setGhost(null); // the send outranks any whisper
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
  const [visualsLive, setVisualsLive] = useState(false);
  const runVisuals = useCallback(() => {
    const { hydra: sketch, playing: live } = stateRef.current;
    setErr(null);
    setHFlash((f) => f + 1);
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


  // ⌘. stops and ⌘S saves from anywhere (not just inside a pane); Esc closes
  // whatever's open.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        halt();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void saveRef.current();
      } else if (e.key === "Escape") {
        setSheet(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [halt]);

  // ── save / load ────────────────────────────────────────────────────────────
  // Every edit bumps the rev; a save only marks the bench clean if nothing
  // landed while it was in flight.
  const revRef = useRef(0);
  const markDirty = useCallback(() => {
    revRef.current++;
    setDirty(true);
  }, []);

  const save = useCallback(
    async (auto = false) => {
      if (saving) return;
      // Autosave rides an EXISTING session only; the explicit ⌘S may mint the
      // guest. (In practice the copilot mints one at the first typing pause,
      // so autosave engages almost immediately anyway.)
      if (!meRef.current?.signedIn) {
        if (auto) return;
        if (!(await ensureSession())) return;
      }
      const rev = revRef.current;
      setSaving(true);
      try {
        const { strudel: s, hydra: h, title: t, sketchId: id } = stateRef.current;
        const body = JSON.stringify({ title: t, strudel: s, hydra: h });
        let res = await fetch(id ? `/api/sketches/${id}` : "/api/sketches", {
          method: id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        // A stale id (another session's sketch, or one deleted elsewhere) 404s —
        // the work on the bench is still real: save it as a fresh sketch.
        if (id && res.status === 404) {
          res = await fetch("/api/sketches", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
        }
        const d = openDeep(
          (await res.json().catch(() => ({}))) as { sketch?: Sketch; error?: string },
        );
        if (!res.ok || !d.sketch) {
          if (!auto) setNotice(d.error || "Couldn't save — try again.");
          return;
        }
        setSketchId(d.sketch.id);
        if (revRef.current === rev) setDirty(false); // nothing landed mid-save
        void refreshSketches();
      } finally {
        setSaving(false);
      }
    },
    [ensureSession, saving],
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  // AUTOSAVE — there is no Save button; work is simply KEPT. 2.5s after the
  // last edit the bench writes itself to the crate (create-on-first-save).
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void saveRef.current(true), 2500);
    return () => clearTimeout(t);
  }, [dirty, strudel, hydra, title]);

  function loadSketch(s: Sketch) {
    setStrudel(scrubLegacyHints(s.strudel));
    setHydra(scrubLegacyHints(s.hydra));
    setTitle(s.title);
    setSketchId(s.id);
    setDirty(false);
    setSheet(null);
  }

  function loadStarter(p: (typeof STARTERS)[number]) {
    setStrudel(p.strudel);
    setHydra(p.hydra);
    setTitle(p.name);
    setSketchId(null);
    setDirty(false);
    setSheet(null);
  }

  function newSketch() {
    setStrudel("");
    setHydra("");
    setTitle("untitled");
    setSketchId(null);
    setDirty(false);
    setSheet(null);
  }

  async function removeSketch(id: string) {
    setSketches((xs) => xs.filter((x) => x.id !== id));
    if (stateRef.current.sketchId === id) setSketchId(null);
    await fetch(`/api/sketches/${id}`, { method: "DELETE" }).catch(() => {});
  }

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
      const cacheKey = `${pane}|${ctx.before.slice(-240)}|${ctx.after.slice(0, 80)}`;
      // A DIRECT order (✦/⌥\) never answers from the cache — pressing the
      // button means "another take", never "show me the same one again" (and a
      // cached silence used to mute it entirely). Auto-cues still ride the
      // cache for free.
      const cached = ctx.forced ? undefined : ghostLRU.current.get(cacheKey);
      if (cached !== undefined) {
        lastCue.current = { key: cueKey, empty: !cached.trim(), at: Date.now() };
        if (cached.trim()) setGhost({ pane, text: cached });
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
          }),
        });
        if (res.status === 402) {
          // THE PAYING MOMENT — the machine never just goes quiet: it tells
          // you why, once, and the door to more is one tap away.
          if (!spentToldRef.current) {
            spentToldRef.current = true;
            setNotice(
              "The tokens ran dry \u2014 the ghosts went quiet. Feed the machine and they come back.",
            );
          }
          void refreshMe(); // the chip flips to its burning 0
          return;
        }
        if (!res.ok) return; // 429 etc → quiet; the meter chip tells the story
        const d = openDeep((await res.json().catch(() => ({}))) as { ghost?: string });
        let g = d.ghost ?? "";
        ghostLRU.current.set(cacheKey, g);
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
        lastCue.current = { key: cueKey, empty: !g.trim(), at: Date.now() };
        if (!g.trim()) return;
        if (seq !== ghostSeq.current) return; // superseded by newer typing
        const cur = pane === "strudel" ? stateRef.current.strudel : stateRef.current.hydra;
        if (cur !== ctx.before + ctx.after) return; // the file moved on
        setGhost({ pane, text: g });
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

  // ── THE DECK — the Sets deck's machinery, verbatim concepts (lib/set-live):
  // deterministic, ephemeral, zero AI. Layers are re-bused onto channel orbit
  // DECADES at PLAY TIME (the pane's code is never touched); kills are Web
  // Audio gain ramps on those buses — instant, tails included; the perf dials
  // ride the master FX chain (setLivePerf) live, no recompile. The light page
  // is video-DJ: CSS filters on the canvas itself.
  const [master, setMaster] = useState(1);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [mixerTab, setMixerTab] = useState<"music" | "light">("music");
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
      keyReeval.current = setTimeout(() => void runMusic(), 350);
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
    const next = { ...light, ...patch };
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

  // Browser-fullscreen tracking — solo rides it where it exists (the header's
  // own fullscreen button died 07-27; solo's ⛶ is the one door).
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // SOLO VISUALS — the VJ posture (user 07-27, twice: JUST the picture, not
  // the pane): every panel vanishes and the canvas owns the room at full
  // brightness. Esc leaves (a whisper of an ✕ for hands with no keys). Rides
  // browser fullscreen where it exists; works in-page where it doesn't.
  const [soloVisuals, setSoloVisuals] = useState(false);
  useEffect(() => {
    if (!soloVisuals) return;
    document.body.classList.add("ide-solo"); // canvas to full brightness
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSoloVisuals(false);
        if (document.fullscreenElement) void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("ide-solo");
      window.removeEventListener("keydown", onKey);
    };
  }, [soloVisuals]);
  const toggleSoloVisuals = () => {
    setSoloVisuals((v) => {
      const next = !v;
      try {
        if (next && !document.fullscreenElement)
          void document.documentElement.requestFullscreen?.();
        else if (!next && document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* fullscreen denied — solo still works in-page */
      }
      return next;
    });
  };
  // Esc out of browser fullscreen leaves solo too (transition-edge only, so
  // devices that never entered fullscreen keep their in-page solo).
  const wasFullscreen = useRef(false);
  useEffect(() => {
    if (wasFullscreen.current && !fullscreen) setSoloVisuals(false);
    wasFullscreen.current = fullscreen;
  }, [fullscreen]);

  // Does the pane have voices to mix at all? (The handle hides on an empty bench.)
  const hasVoices = useMemo(() => /^\s*_?\$:/m.test(strudel), [strudel]);

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
        body: JSON.stringify({ usd, back: "/engine" }),
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
    await refreshSketches();
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
    markDirty();
    setSFlash((f) => f + 1); // you SEE the hint land
    setTimeout(() => strudelPane.current?.summon(), 90);
  };
  const seedVisuals = () => {
    setHydra(VISUALS_SEED);
    markDirty();
    setHFlash((f) => f + 1);
    setTimeout(() => hydraPane.current?.summon(), 90);
  };
  // (completeMusic/completeVisuals — the ✦ complete button's handlers — died
  // with the button; the seeds live on under ⇥-takes-the-hint.)

  // THE ONE-TAP FIX — ✦ on the error chip: the broken pane + its error go up,
  // the mended pane comes back, lands with a flash and re-runs itself. The
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
      markDirty();
      (pane === "hydra" ? setHFlash : setSFlash)((f) => f + 1);
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

  // The run button IS the transport (user's law: hit run, it turns into
  // stop, that is it): `stop` given + active → the same button reads ■ stop.
  // (The "✦ complete" button lived here until 2026-07-26 — the user found it
  // confusing next to a copilot that already whispers on its own. The ghost
  // paths that remain: the caret-park auto-cue, ⌥\/⌃Space, and ⇥.)
  const paneHeader = (
    label: string,
    hint: string,
    run: () => void,
    active: boolean,
    stop?: () => void,
    extra?: React.ReactNode,
  ) => (
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2">
      <span
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
          active ? "text-accent-strong" : "text-muted/70"
        }`}
      >
        {label}
      </span>
      <span className="flex-1" />
      {!touch && hint && (
        <span className="hidden text-[11px] text-muted/45 sm:inline">{hint}</span>
      )}
      {extra}
      <button
        onClick={stop && active ? stop : run}
        className={`rounded-full px-2.5 py-1 text-[11.5px] transition active:scale-[.96] ${
          stop && active
            ? "bg-accent/[0.16] text-accent-strong ring-1 ring-inset ring-accent/40 hover:bg-accent/[0.24]"
            : "bg-white/[0.06] text-foreground/85 hover:bg-accent/20 hover:text-accent-strong"
        }`}
        title={stop && active ? "Stop" : "Run this pane"}
      >
        {stop && active ? "■ stop" : waking ? "waking…" : "▶ run"}
      </button>
    </div>
  );

  return (
    <main
      className="ide-safe relative flex h-dvh flex-col overflow-hidden"
      style={kbInset ? { paddingBottom: kbInset + 12 } : undefined}
    >
      {/* legibility scrims — the picture burns behind; the words never sit on
          panels. Solo drops them: nothing may dim the picture. */}
      {!soloVisuals && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-[1] bg-[linear-gradient(to_bottom,rgba(0,0,0,.42),transparent_22%,transparent_62%,rgba(0,0,0,.55))]"
        />
      )}
      {soloVisuals && (
        <button
          onClick={toggleSoloVisuals}
          aria-label="Leave the picture"
          title="Leave (Esc)"
          className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-[14px] text-white/40 backdrop-blur-sm transition hover:bg-black/50 hover:text-white active:scale-[.95]"
        >
          ✕
        </button>
      )}

      {/* ── top bar (gone in solo — the picture owns the room) ──────────── */}
      {!soloVisuals && (
      <header className="flex items-center gap-2.5 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2" title="Klappn">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/zaltz-icon.svg"
            alt=""
            className="h-7 w-7 drop-shadow-[0_0_16px_rgba(224,49,156,.5)]"
          />
          <span className="hidden bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] bg-clip-text text-[19px] font-semibold tracking-tight text-transparent sm:inline">
            zaltz
          </span>
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-[14px] text-foreground/90 outline-none transition placeholder:text-muted/40 hover:bg-white/[0.04] focus:bg-white/[0.05] sm:w-64 sm:flex-none"
          placeholder="name it"
        />
        {/* Desktop: the name is a name, not a runway — fixed width, the air
            in the middle belongs to the room. */}
        <span className="hidden flex-1 sm:block" />
        {/* No Save button, no save INDICATOR (user 07-27: "kept" confused —
            less is more): the work simply keeps itself, silently. */}
        <button
          onClick={toggleCopilot}
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition active:scale-[.97] sm:inline-flex ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60 hover:text-foreground"
          }`}
          title="Ghosts as you type — ⇥ takes them, ⌥\ summons one, Esc bins them"
        >
          <CopilotMark on={copilot} />
          Copilot
        </button>
        <button
          onClick={() => setSheet(sheet === "sketches" ? null : "sketches")}
          className="hidden shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12.5px] text-muted transition hover:text-foreground active:scale-[.97] sm:inline-flex"
        >Grains</button>
        {/* (The header's own ⛶ died 2026-07-27 — two fullscreen glyphs read
            as confusion. ONE ⛶ lives on the visuals pane: solo the picture.) */}
        {/* ONE door for the person (user 07-27: the token pill was "a bit
            much" — less is more): a profile orb, like klappn.com. Everything
            about YOU — balance, top-ups, claim/sign-in — lives one tap deep
            in the tokens sheet. When the tokens run dry the orb burns. */}
        <button
          onClick={() => setSheet(sheet === "tokens" ? null : "tokens")}
          title={
            spent
              ? "The machine waits — feed it"
              : me?.signedIn && !me.isGuest
                ? (me.email ?? "You")
                : "You — tokens, and claiming your work"
          }
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12.5px] font-medium backdrop-blur-xl transition active:scale-[.95] ${
            spent
              ? "animate-pulse bg-accent/[0.18] text-accent-strong ring-2 ring-accent/60 shadow-[0_0_44px_-10px_rgba(224,49,156,.9)]"
              : "bg-white/[0.06] text-foreground/85 ring-1 ring-inset ring-accent/30 hover:ring-accent/60"
          }`}
        >
          {me?.signedIn && !me.isGuest && me.email ? (
            <span className="uppercase">{me.email[0]}</span>
          ) : (
            <span className="text-[10px] lowercase text-muted/80">you</span>
          )}
        </button>
      </header>
      )}

      {/* ── mobile pane tabs ────────────────────────────────────────────── */}
      {!soloVisuals && (
      <div className="mb-2 flex items-center gap-1.5 sm:hidden">
        {(["strudel", "hydra"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] uppercase tracking-[0.14em] transition ${
              mobilePane === p
                ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                : "bg-white/[0.04] text-muted/70"
            }`}
          >
            {p === "strudel" ? "strudel" : "hydra"}
          </button>
        ))}
        <span className="flex-1" />
        <button
          onClick={toggleCopilot}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition active:scale-[.97] ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60"
          }`}
        >
          <CopilotMark on={copilot} />
          Copilot
        </button>
        <button
          onClick={() => setSheet(sheet === "sketches" ? null : "sketches")}
          className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] text-muted transition active:scale-[.97]"
        >Grains</button>
      </div>
      )}

      {/* ── the panes (all gone in solo — the picture alone) ────────────── */}
      <div className={`min-h-0 flex-1 gap-3 ${soloVisuals ? "hidden" : "flex"}`}>
        <section
          className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 backdrop-blur-xl transition focus-within:border-accent/30 focus-within:shadow-[0_0_60px_-24px_rgba(224,49,156,.5)] sm:flex sm:w-[58%] ${
            mobilePane === "strudel" ? "flex w-full" : "hidden"
          }`}
        >
          {paneHeader(
            "strudel",
            ghost?.pane === "strudel" ? "⇥ takes the ghost" : "",
            () => void runMusic(),
            playing,
            halt,
          )}
          <CodePane
            ref={strudelPane}
            value={strudel}
            onChange={(v) => {
              if (ghost?.pane === "strudel") killGhost();
              setStrudel(v);
              markDirty();
            }}
            onRun={() => void runMusic()}
            onSave={() => void save()}
            flash={sFlash}
            pondering={pondering === "strudel" && ghost?.pane !== "strudel"}
            ghost={ghost?.pane === "strudel" ? ghost.text : null}
            onGhostAccept={() => {
              killGhost();
              // THE REAL-TIME LAW: a take made mid-set LANDS mid-set — the new
              // line crossfades into the running mix, no extra gesture.
              if (stateRef.current.playing) setTimeout(() => void runMusic(), 60);
            }}
            onGhostDismiss={killGhost}
            onTakeHint={seedMusic}
            onCaretIdle={(ctx) => void requestGhost("strudel", ctx)}
            placeholder={`setcpm(128/4)\n$: s("bd*4").bank("RolandTR909")\n\n// type, then hit ▶ run — the room hears you\n// pause, and the machine whispers the next line${
              touch ? "" : "\n// on keys: ⌘↵ runs · ⇥ takes what's grey — this starter too"
            }`}
          />
        </section>
        <section
          className={`min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 backdrop-blur-xl transition focus-within:border-accent/30 focus-within:shadow-[0_0_60px_-24px_rgba(224,49,156,.5)] sm:flex ${
            mobilePane === "hydra" ? "flex w-full" : "hidden"
          }`}
        >
          {paneHeader(
            "hydra",
            ghost?.pane === "hydra" ? "⇥ takes the ghost" : "",
            runVisuals,
            visualsLive && !!hydra.trim(),
            stopVisuals,
            // SOLO — the VJ posture: just the picture and this pane.
            <button
              key="solo"
              onClick={toggleSoloVisuals}
              title={
                soloVisuals
                  ? "Back to the desk"
                  : "Just the picture, fullscreen — Esc brings the room back"
              }
              className={`rounded-full px-2.5 py-1 text-[11.5px] leading-none transition active:scale-[.96] ${
                soloVisuals
                  ? "bg-accent/[0.16] text-accent-strong ring-1 ring-inset ring-accent/40"
                  : "bg-white/[0.06] text-foreground/85 hover:bg-accent/20 hover:text-accent-strong"
              }`}
            >
              ⛶
            </button>,
          )}
          <CodePane
            ref={hydraPane}
            value={hydra}
            onChange={(v) => {
              if (ghost?.pane === "hydra") killGhost();
              setHydra(v);
              markDirty();
            }}
            onRun={runVisuals}
            onSave={() => void save()}
            flash={hFlash}
            pondering={pondering === "hydra" && ghost?.pane !== "hydra"}
            ghost={ghost?.pane === "hydra" ? ghost.text : null}
            onGhostAccept={() => {
              killGhost();
              // A visual take repaints the room the moment it's taken.
              setTimeout(() => runVisuals(), 60);
            }}
            onGhostDismiss={killGhost}
            onTakeHint={seedVisuals}
            onCaretIdle={(ctx) => void requestGhost("hydra", ctx)}
            placeholder={`osc(4, 0, 1).color(1, .3, .7)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .out()\n\n// the walls, in code — ▶ run paints them${
              touch ? "" : "\n// ⇥ takes what's grey — this starter too"
            }`}
          />
        </section>
      </div>

      {/* ── errors / notices ────────────────────────────────────────────── */}
      {(err || notice) && (
        /* A CAPSULE, not a banner (user 07-27): full-width on the phone, but
           on desktop it hugs its words and centres — so the ✦ fix sits right
           beside the complaint instead of a screen-width away. */
        <div
          className={`mt-2 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 backdrop-blur-xl sm:mx-auto sm:w-fit sm:max-w-2xl ${
            err
              ? "border-red-400/25 bg-red-950/35 shadow-[0_0_44px_-18px_rgba(248,113,113,.5)]"
              : "border-accent/30 bg-black/55 shadow-[0_0_44px_-16px_rgba(224,49,156,.55)]"
          }`}
        >
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] ${
              err
                ? "bg-red-400/[0.12] text-red-300/90"
                : "bg-accent/[0.14] text-accent-strong"
            }`}
          >
            {err ? (err.startsWith("hydra:") ? "hydra" : "strudel") : "✦"}
          </span>
          <p
            className={`min-w-0 flex-1 truncate text-[12.5px] leading-snug ${
              err ? "text-red-200/90" : "text-accent-strong/95"
            }`}
            title={err ?? notice ?? undefined}
          >
            {err ? humanizeEngineError(err.replace(/^hydra:\s*/, "")) : notice}
          </p>
          {err && (
            <button
              onClick={() => void fixError()}
              disabled={fixing}
              title="The machine reads the error and mends the code — one tap"
              className="shrink-0 rounded-full border border-accent/40 bg-accent/[0.12] px-2.5 py-1 text-[12px] text-accent-strong shadow-[0_0_24px_-8px_rgba(224,49,156,.8)] transition hover:bg-accent/[0.2] active:scale-[.96] disabled:opacity-70"
            >
              {fixing ? <span className="shimmer-text">mending…</span> : "✦ fix"}
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


      {/* ── the desk — the Sets deck's machinery worn by the instrument:
          SEASON TO TASTE (components/ZaltzMixer). Pure view; the audio wiring
          (kills, master chain, scheduler nudge, canvas filters) stays here. */}
      {!soloVisuals && (hasVoices || hydra.trim()) && (
        <ZaltzMixer
          open={mixerOpen}
          onToggle={() => setMixerOpen((o) => !o)}
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
        />
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
            {sheet === "sketches" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-medium text-foreground">Grains</h2>
                  <button
                    onClick={newSketch}
                    className="rounded-full bg-accent/[0.14] px-3 py-1.5 text-[12.5px] text-foreground transition hover:bg-accent/[0.22] active:scale-[.97]"
                  >
                    ＋ New
                  </button>
                </div>
                {sketches.length > 0 ? (
                  <ul className="mt-3 max-h-[40dvh] space-y-1 overflow-y-auto">
                    {sketches.map((s) => (
                      <li key={s.id} className="group flex items-center gap-2">
                        <button
                          onClick={() => loadSketch(s)}
                          className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-[13.5px] transition hover:bg-white/[0.06] ${
                            s.id === sketchId ? "text-accent-strong" : "text-foreground/85"
                          }`}
                        >
                          {s.title}
                        </button>
                        <button
                          onClick={() => void removeSketch(s.id)}
                          className="rounded-full px-2 py-1 text-[12px] text-muted/50 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                          aria-label={`Delete ${s.title}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    No grains yet — play, and what you make keeps itself here.
                    {me?.signedIn && me.isGuest
                      ? " Guest work stays with this browser until you claim it."
                      : ""}
                  </p>
                )}
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                    Starters
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {STARTERS.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => loadStarter(p)}
                        className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-muted/80 transition hover:bg-accent/15 hover:text-accent-strong active:scale-[.97]"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted/60">
                  <a href={ZALTZ_GITHUB_URL} target="_blank" rel="noreferrer" className="transition hover:text-foreground">
                    Source on GitHub
                  </a>
                  <a href={ZALTZ_NPM_URL} target="_blank" rel="noreferrer" className="transition hover:text-foreground">
                    npm install zaltz
                  </a>
                  <Link href="/open" className="transition hover:text-foreground">
                    Why it&apos;s open
                  </Link>
                </div>
              </>
            )}

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
                          ).toLocaleString()} ghosts`
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
                      — sketches, tokens, all of it, on any machine.
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
