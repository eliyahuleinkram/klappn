"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
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
  fadeMaster,
  playPart,
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
  cardFeeCents,
  CREDIT_PACK_USD,
  TOKENS_PER_LOOP,
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
 * whole take, and NOTHING lands until you drop it in. Asks burn tokens
 * (prepaid, price in open code); the first taste is free — no account needed.
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

/** The hydra params worth a fader — curated so every row means something and
 *  ranges stay musical. First numeric arg of each call becomes the dial. */
const VISUAL_PARAMS: Record<string, { label: string; min: number; max: number }> = {
  kaleid: { label: "facets", min: 1, max: 12 },
  contrast: { label: "contrast", min: 0.2, max: 3 },
  saturate: { label: "saturation", min: 0, max: 3 },
  brightness: { label: "brightness", min: -0.5, max: 0.5 },
  luma: { label: "luma cut", min: 0, max: 1 },
  thresh: { label: "threshold", min: 0, max: 1 },
  pixelate: { label: "pixelate", min: 2, max: 200 },
  colorama: { label: "colorama", min: 0, max: 2 },
  posterize: { label: "posterize", min: 2, max: 12 },
  hue: { label: "hue shift", min: 0, max: 1 },
};

/** A layer line's identity for the AI-name map: mute-prefix and whitespace
 *  don't change what the voice IS; any other edit does (name falls back until
 *  the next clean run re-hears it). */
const layerSig = (line: string) => line.trim().replace(/^_/, "").slice(0, 120);

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
  const lastCue = useRef({ key: "", empty: false });
  // Copilot-speed trick #2: an LRU of recent completions — revisiting a spot
  // (dismissed ghost, caret wander-and-return) re-shows instantly, no call.
  const ghostLRU = useRef(new Map<string, string>());
  const strudelPane = useRef<CodePaneHandle>(null);
  const hydraPane = useRef<CodePaneHandle>(null);

  // THE NAMER — after a clean run, every `$:` line gets its human name.
  const namesMeta = useRef({ lastCode: "", at: 0, inflight: false });
  // runMusic (declared above the namer) calls through this ref.
  const namesAfterRun = useRef<() => Promise<void> | void>(() => {});

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
      if (sketch.trim()) void startIdleVisual(hydraProgram(sketch));
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
      await playPart("zaltz-ide", code, "zaltz-ide");
      if (runId.current !== id) {
        try {
          stop();
        } catch {
          /* superseded */
        }
        return;
      }
      setPlaying(true);
      if (sketch.trim()) void updateVisuals(hydraProgram(sketch));
      // It runs clean — let the machine name some next moves (throttled).
      setTimeout(() => void namesAfterRun.current(), 1500);
    } catch (e) {
      if (runId.current === id) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (runId.current === id) setBusy(false);
    }
  }, [busy]);

  const runVisuals = useCallback(() => {
    const { hydra: sketch, playing: live } = stateRef.current;
    setErr(null);
    setHFlash((f) => f + 1);
    if (!sketch.trim()) return;
    const program = hydraProgram(sketch);
    if (live) void updateVisuals(program);
    else void startIdleVisual(program);
    // A repaint is a run too — the light deserves its own tweak round.
    setTimeout(() => void namesAfterRun.current(), 1500);
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
    setTitle("untitled sketch");
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
      if (ghostRef.current) return; // one ghost at a time — take it or bin it
      const cueKey = `${pane}:${ctx.before.length}:${ctx.after.length}:${ctx.before.slice(-40)}`;
      // An explicit ✦/⌥\ summon is a direct order — it re-asks even where an
      // auto-cue already came back empty.
      if (!ctx.forced && lastCue.current.key === cueKey && lastCue.current.empty)
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
      const cached = ghostLRU.current.get(cacheKey);
      if (cached !== undefined) {
        lastCue.current = { key: cueKey, empty: !cached.trim() };
        let g = cached;
        if (!ctx.atEnd) {
          const lines = g.split("\n");
          g = lines[0] || (lines[1] !== undefined ? "\n" + lines[1] : "");
        }
        if (g.trim()) setGhost({ pane, text: g });
        return;
      }
      const seq = ++ghostSeq.current;
      ghostAbort.current?.abort();
      const ac = new AbortController();
      ghostAbort.current = ac;
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
        if (!res.ok) return; // 402/429 → quiet; the meter chip tells the story
        const d = openDeep((await res.json().catch(() => ({}))) as { ghost?: string });
        let g = d.ghost ?? "";
        ghostLRU.current.set(cacheKey, g);
        if (ghostLRU.current.size > 16) {
          const oldest = ghostLRU.current.keys().next().value;
          if (oldest !== undefined) ghostLRU.current.delete(oldest);
        }
        if (!ctx.atEnd) {
          // Alignment law (see CodePane): mid-file, the ghost may not push
          // later lines around — keep ONE line. But a completion that OPENS
          // with a newline (the comment-to-code move: "// acid line" → "\n$:
          // …") would truncate to nothing, so keep newline + first real line.
          const lines = g.split("\n");
          g = lines[0] || (lines[1] !== undefined ? "\n" + lines[1] : "");
        }
        lastCue.current = { key: cueKey, empty: !g.trim() };
        if (!g.trim()) return;
        if (seq !== ghostSeq.current) return; // superseded by newer typing
        const cur = pane === "strudel" ? stateRef.current.strudel : stateRef.current.hydra;
        if (cur !== ctx.before + ctx.after) return; // the file moved on
        setGhost({ pane, text: g });
      } catch {
        /* aborted or offline — a missing ghost is nothing */
      }
    },
    [copilot, ensureSession],
  );

  const killGhost = useCallback(() => {
    ghostSeq.current++;
    setGhost(null);
  }, []);

  // ── THE DIALS — zero-AI live control over the code itself ────────────────
  // Each `$:` line is a fader row: mute rewrites the prefix to `_$:` (the
  // language's own mute), the slider rewrites that line's .gain(n). Commits
  // re-eval mid-play, so the change crossfades into the running mix like any
  // live edit. Master is engine-level (fadeMaster) and moves DURING the drag.
  const [master, setMaster] = useState(1);
  // Collapsed by default — the desk is a slim handle you pull up, never a
  // wall. Two pages under one roof: music (voices) and light (the sketch's
  // own numbers, grown into faders).
  const [mixerOpen, setMixerOpen] = useState(false);
  const [mixerTab, setMixerTab] = useState<"music" | "light">("music");
  // AI names per layer (line-signature → "Deep kick"), refreshed by the namer.
  const [layerNames, setLayerNames] = useState<Map<string, string>>(new Map());

  interface LayerDial {
    idx: number;
    muted: boolean;
    label: string;
    /** null = patterned gain ("0.3 0.42") — the fader steps aside for it. */
    gain: number | null;
  }
  const layers = useMemo<LayerDial[]>(() => {
    let n = 0;
    return strudel
      .split("\n")
      .map((line, idx) => ({ line, idx }))
      .filter((x) => /^\s*_?\$:/.test(x.line))
      .map((x) => {
        n++;
        const muted = /^\s*_\$:/.test(x.line);
        const sound = x.line.match(/\.s\(\s*["'`]([\w:]+)["'`]/)?.[1];
        const drum = x.line
          .match(/\bs\(\s*["'`]([^"'`]+)["'`]/)?.[1]
          ?.split(/[\s*!,<>[\]()~]+/)
          .filter(Boolean)[0];
        const bank = x.line.match(/\.bank\(\s*["'`](\w+)["'`]/)?.[1];
        const label = (sound ?? drum ?? bank ?? `layer ${n}`)
          .replace(/^gm_/, "")
          .replace(/_/g, " ")
          .slice(0, 16);
        const num = x.line.match(/\.gain\(\s*([0-9.]+)\s*\)/);
        const patterned = /\.gain\(\s*["'`]/.test(x.line);
        return {
          idx: x.idx,
          muted,
          // The machine's human name when it has heard this exact line;
          // the code sniff only until then.
          label: layerNames.get(layerSig(x.line)) ?? label,
          gain: num ? parseFloat(num[1]) : patterned ? null : 0.8,
        };
      });
  }, [strudel, layerNames]);

  const applyLine = useCallback(
    (idx: number, fn: (line: string) => string) => {
      const lines = stateRef.current.strudel.split("\n");
      if (idx < 0 || idx >= lines.length) return;
      lines[idx] = fn(lines[idx]);
      setStrudel(lines.join("\n"));
      markDirty();
      // Mid-set, the turn lands in the running mix (same-owner crossfade).
      if (stateRef.current.playing) setTimeout(() => void runMusic(), 40);
    },
    [markDirty, runMusic],
  );
  const toggleLayerMute = (idx: number) =>
    applyLine(idx, (l) =>
      /^\s*_\$:/.test(l) ? l.replace("_$:", "$:") : l.replace("$:", "_$:"),
    );
  const commitLayerGain = (idx: number, v: number) => {
    const g = Math.round(v * 100) / 100;
    applyLine(idx, (l) =>
      /\.gain\(\s*[0-9.]+\s*\)/.test(l)
        ? l.replace(/\.gain\(\s*[0-9.]+\s*\)/, `.gain(${g})`)
        : l.replace(/\s*$/, `.gain(${g})`),
    );
  };

  // THE LIGHT PAGE — the hydra sketch's own numbers, grown into faders. Live
  // during the drag: the rewrite repaints through updateVisuals' 120ms
  // coalescer, so the picture follows the finger without a single flash.
  interface LightDial {
    method: string;
    occ: number;
    value: number;
    label: string;
    min: number;
    max: number;
  }
  const lightDials = useMemo<LightDial[]>(() => {
    const rows: LightDial[] = [];
    for (const [method, meta] of Object.entries(VISUAL_PARAMS)) {
      const re = new RegExp(`\\.${method}\\(\\s*(-?[0-9.]+)`, "g");
      let m: RegExpExecArray | null;
      let occ = 0;
      while ((m = re.exec(hydra)) && rows.length < 10) {
        rows.push({
          method,
          occ,
          value: parseFloat(m[1]),
          label: occ ? `${meta.label} ${occ + 1}` : meta.label,
          min: meta.min,
          max: meta.max,
        });
        occ++;
      }
    }
    return rows;
  }, [hydra]);

  const setVisualParam = useCallback(
    (method: string, occ: number, v: number) => {
      const g = Math.round(v * 100) / 100;
      const re = new RegExp(`(\\.${method}\\(\\s*)(-?[0-9.]+)`, "g");
      let i = -1;
      const next = stateRef.current.hydra.replace(re, (all, pre: string) => {
        i++;
        return i === occ ? `${pre}${g}` : all;
      });
      if (next === stateRef.current.hydra) return;
      setHydra(next);
      markDirty();
      const program = hydraProgram(next);
      if (stateRef.current.playing) void updateVisuals(program);
      else void startIdleVisual(program);
    },
    [markDirty],
  );

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

  // ── the namer — human names on the faders, after a clean run ───────────────
  // The mixer stays CONSISTENT across edits: names key on the line itself
  // (layerSig), so untouched lines keep their names and only changed lines
  // fall back to the code sniff until the next clean run re-hears them.
  const maybeNames = useCallback(async () => {
    const { strudel: s } = stateRef.current;
    const meta = namesMeta.current;
    if (meta.inflight || s === meta.lastCode) return;
    if (Date.now() - meta.at < 30_000) return;
    const m = meRef.current;
    if (!m?.signedIn) return; // names wait for a session; never mint one for this
    if (!m.owner && (m.remainingTokens ?? 0) <= 0) return;
    meta.inflight = true;
    try {
      const res = await fetch("/api/names", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strudel: s }),
      });
      if (!res.ok) return;
      const d = (await res.json().catch(() => ({}))) as { layerNames?: string[] };
      if (Array.isArray(d.layerNames) && d.layerNames.length) {
        meta.lastCode = s;
        meta.at = Date.now();
        const sigs = s
          .split("\n")
          .filter((l) => /^\s*_?\$:/.test(l))
          .map(layerSig);
        setLayerNames((prev) => {
          const next = new Map(prev);
          sigs.forEach((sig, i) => {
            const name = d.layerNames?.[i];
            if (name) next.set(sig, name);
          });
          return next;
        });
      }
    } catch {
      /* the sniffed labels carry on */
    } finally {
      meta.inflight = false;
    }
  }, []);
  namesAfterRun.current = maybeNames;

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
  const tokenChip = !me
    ? "…"
    : me.owner
      ? "∞"
      : me.signedIn
        ? fmtTokens(Math.max(0, remaining ?? 0))
        : me.poolOpen === false
          ? "0"
          : "free taste";

  // The run button IS the transport (user's law: hit run, it turns into
  // stop, that is it): `stop` given + active → the same button reads ■ stop.
  const paneHeader = (
    label: string,
    hint: string,
    run: () => void,
    active: boolean,
    summon: () => void,
    stop?: () => void,
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
      {!touch && (
        <span className="hidden text-[11px] text-muted/45 sm:inline">{hint}</span>
      )}
      {/* THE button-shaped answer to "how do I complete this?" — works the
          same on a phone, where no ⌥\ exists. */}
      <button
        onClick={summon}
        className="rounded-full bg-accent/[0.12] px-2.5 py-1 text-[11.5px] text-accent-strong transition hover:bg-accent/[0.22] active:scale-[.96]"
        title="Conjure a ghost at the caret — ⇥ (or the pill) takes it"
      >
        ✦ complete
      </button>
      <button
        onClick={stop && active ? stop : run}
        className={`rounded-full px-2.5 py-1 text-[11.5px] transition active:scale-[.96] ${
          stop && active
            ? "bg-accent/[0.16] text-accent-strong ring-1 ring-inset ring-accent/40 hover:bg-accent/[0.24]"
            : "bg-white/[0.06] text-foreground/85 hover:bg-accent/20 hover:text-accent-strong"
        }`}
        title={stop && active ? "Stop (⌘.)" : "Evaluate this pane (⌘↵)"}
      >
        {stop && active ? "■ stop" : waking ? "waking…" : "▶ run"}
      </button>
    </div>
  );

  return (
    <main
      className="relative flex h-dvh flex-col overflow-hidden px-3 pb-3 sm:px-4"
      style={kbInset ? { paddingBottom: kbInset + 12 } : undefined}
    >
      {/* legibility scrims — the picture burns behind; the words never sit on panels */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[1] bg-[linear-gradient(to_bottom,rgba(0,0,0,.42),transparent_22%,transparent_62%,rgba(0,0,0,.55))]"
      />

      {/* ── top bar ─────────────────────────────────────────────────────── */}
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
          className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-[14px] text-foreground/90 outline-none transition placeholder:text-muted/40 hover:bg-white/[0.04] focus:bg-white/[0.05]"
          placeholder="name this sketch"
        />
        {/* No Save button — work is simply KEPT. The dot breathes while the
            bench writes itself; steel once it's in the crate. */}
        <span
          aria-hidden
          title={
            me?.signedIn
              ? dirty || saving
                ? "keeping…"
                : "kept"
              : "kept in this browser — a session picks it up the moment you touch the machine"
          }
          className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500 ${
            me?.signedIn
              ? dirty || saving
                ? "animate-pulse bg-accent-strong"
                : "bg-white/25"
              : "bg-white/15"
          }`}
        />
        <button
          onClick={toggleCopilot}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition active:scale-[.97] ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60 hover:text-foreground"
          }`}
          title="Ghosts as you type — ⇥ takes them, ⌥\ summons one, Esc bins them"
        >
          copilot
        </button>
        <button
          onClick={() => setSheet(sheet === "sketches" ? null : "sketches")}
          className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12.5px] text-muted transition hover:text-foreground active:scale-[.97]"
        >
          Sketches
        </button>
        <button
          onClick={() => setSheet(sheet === "tokens" ? null : "tokens")}
          className="shrink-0 rounded-full border border-accent/25 bg-black/40 px-3 py-1.5 text-[12.5px] tabular-nums text-foreground/90 shadow-[0_0_30px_-14px_rgba(224,49,156,.6)] backdrop-blur-xl transition hover:border-accent/45 active:scale-[.97]"
          title="Tokens"
        >
          <span className="mr-1 text-accent-strong">✦</span>
          {tokenChip}
        </button>
        {me?.signedIn && !me.isGuest ? (
          <span
            className="hidden max-w-[9rem] truncate text-[12px] text-muted/60 sm:inline"
            title={me.email ?? undefined}
          >
            {me.email}
          </span>
        ) : (
          <button
            onClick={() => setSheet("signin")}
            className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12.5px] text-muted transition hover:text-accent-strong active:scale-[.97]"
            title="Sign in — everything you make here becomes yours forever"
          >
            Claim
          </button>
        )}
      </header>

      {/* ── mobile pane tabs ────────────────────────────────────────────── */}
      <div className="mb-2 flex gap-1.5 sm:hidden">
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
            {p === "strudel" ? "music" : "light"}
          </button>
        ))}
      </div>

      {/* ── the panes ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-3">
        <section
          className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 backdrop-blur-xl transition focus-within:border-accent/30 focus-within:shadow-[0_0_60px_-24px_rgba(224,49,156,.5)] sm:flex sm:w-[58%] ${
            mobilePane === "strudel" ? "flex w-full" : "hidden"
          }`}
        >
          {paneHeader(
            "music · strudel",
            ghost?.pane === "strudel" ? "⇥ takes the ghost" : "⌘↵ plays it",
            () => void runMusic(),
            playing,
            () => strudelPane.current?.summon(),
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
            ghost={ghost?.pane === "strudel" ? ghost.text : null}
            onGhostAccept={killGhost}
            onGhostDismiss={killGhost}
            onCaretIdle={(ctx) => void requestGhost("strudel", ctx)}
            placeholder={`setcpm(128/4)\n$: s("bd*4").bank("RolandTR909")\n\n// type, then hit ▶ run — the room hears you\n// stuck? ✦ complete writes the next line${
              touch ? "" : "\n// on keys: ⌘↵ runs · ⇥ takes a ghost"
            }`}
          />
        </section>
        <section
          className={`min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 backdrop-blur-xl transition focus-within:border-accent/30 focus-within:shadow-[0_0_60px_-24px_rgba(224,49,156,.5)] sm:flex ${
            mobilePane === "hydra" ? "flex w-full" : "hidden"
          }`}
        >
          {paneHeader(
            "light · hydra",
            ghost?.pane === "hydra" ? "⇥ takes the ghost" : "⌘↵ paints it",
            runVisuals,
            playing && !!hydra.trim(),
            () => hydraPane.current?.summon(),
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
            ghost={ghost?.pane === "hydra" ? ghost.text : null}
            onGhostAccept={killGhost}
            onGhostDismiss={killGhost}
            onCaretIdle={(ctx) => void requestGhost("hydra", ctx)}
            placeholder={`osc(4, 0, 1).color(1, .3, .7)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .out()\n\n// the walls, in code — ▶ run paints them`}
          />
        </section>
      </div>

      {/* ── errors / notices ────────────────────────────────────────────── */}
      {(err || notice) && (
        <div className="mt-2 flex items-start gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-[12.5px] leading-snug ${
              err ? "text-red-300/85" : "text-accent-strong/90"
            }`}
            title={err ?? notice ?? undefined}
          >
            {err ?? notice}
          </p>
          <button
            onClick={() => {
              setErr(null);
              setNotice(null);
            }}
            className="text-[12px] text-muted/60 transition hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}


      {/* ── the mixer — a slim handle you pull up; never a wall. Rides the
          copilot (manual mode = no machine hands at all). Two pages: music
          (the voices) and light (the sketch's numbers, grown into faders). */}
      {copilot && (layers.length > 0 || lightDials.length > 0) && (
        <div className="mt-2 shrink-0">
          <button
            onClick={() => setMixerOpen((o) => !o)}
            className={`group flex w-full items-center justify-center gap-2.5 rounded-full border px-4 py-1.5 backdrop-blur-xl transition active:scale-[.99] ${
              mixerOpen
                ? "border-accent/35 bg-black/60 shadow-[0_0_44px_-16px_rgba(224,49,156,.5)]"
                : "border-white/[0.07] bg-black/45 hover:border-accent/30"
            }`}
            aria-expanded={mixerOpen}
          >
            <span
              className={`text-[10.5px] font-semibold uppercase tracking-[0.24em] transition ${
                mixerOpen ? "text-accent-strong" : "text-muted/60 group-hover:text-accent-strong"
              }`}
            >
              mixer
            </span>
            <span className="flex items-center gap-1" aria-hidden>
              {layers.slice(0, 8).map((l) => (
                <span
                  key={l.idx}
                  className={`rounded-full transition-all duration-300 ${
                    l.muted
                      ? "h-1 w-1 bg-white/20"
                      : "h-1.5 w-1.5 bg-gradient-to-br from-[#ff63c1] to-[#b3126f] shadow-[0_0_8px_rgba(224,49,156,.8)]"
                  }`}
                />
              ))}
            </span>
            <span className="text-[10px] text-muted/40" aria-hidden>
              {mixerOpen ? "▾" : "▴"}
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              mixerOpen ? "mt-2 max-h-[36dvh] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="max-h-[36dvh] overflow-y-auto rounded-[22px] border border-accent/25 bg-gradient-to-b from-black/75 to-black/55 p-4 shadow-[0_0_70px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl">
              <div className="mb-3 flex items-center gap-1.5">
                {(["music", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMixerTab(t)}
                    className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] transition active:scale-[.96] ${
                      mixerTab === t
                        ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40"
                        : "bg-white/[0.04] text-muted/60 hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {mixerTab === "music" ? (
                <>
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#ff63c1] to-[#b3126f] shadow-[0_0_16px_rgba(224,49,156,.9)]" />
                    </span>
                    <span className="wordmark text-gradient w-24 shrink-0 truncate text-[15px] sm:w-32">
                      master
                    </span>
                    <Dial
                      value={master}
                      max={1}
                      onLive={(v) => {
                        setMaster(v);
                        try {
                          fadeMaster(v, 0.05);
                        } catch {
                          /* engine not up yet — the dial still remembers */
                        }
                      }}
                    />
                  </div>
                  {layers.length > 0 ? (
                    <ul className="mt-3 space-y-2.5">
                      {layers.map((l, i) => (
                        <li
                          key={`${l.idx}:${l.muted}:${l.gain ?? "p"}`}
                          style={{ "--i": i } as CSSProperties}
                          className="animate-rise group flex items-center gap-3.5 rounded-xl px-1 py-0.5 transition hover:bg-white/[0.03]"
                        >
                          <button
                            onClick={() => toggleLayerMute(l.idx)}
                            title={
                              l.muted
                                ? "Unmute — the voice steps back in on the next phrase"
                                : "Mute this voice (its line stays, silenced)"
                            }
                            aria-label={l.muted ? `Unmute ${l.label}` : `Mute ${l.label}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-[.9]"
                          >
                            <span
                              className={`rounded-full transition-all duration-300 ${
                                l.muted
                                  ? "h-2 w-2 border border-white/30 bg-transparent"
                                  : "h-2.5 w-2.5 bg-gradient-to-br from-[#ff63c1] to-[#b3126f] shadow-[0_0_14px_rgba(224,49,156,.9)]"
                              }`}
                            />
                          </button>
                          <span
                            className={`w-24 shrink-0 truncate text-[13px] transition sm:w-32 ${
                              l.muted ? "text-muted/40 line-through" : "text-foreground/90"
                            }`}
                            title={l.label}
                          >
                            {l.label}
                          </span>
                          <Dial
                            value={l.gain ?? 0.8}
                            disabled={l.muted || l.gain === null}
                            onCommit={(v) => commitLayerGain(l.idx, v)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-muted/60">
                      Write a <span className="font-mono text-accent-strong/80">$:</span>{" "}
                      line and it grows a fader here — every voice under a finger.
                    </p>
                  )}
                </>
              ) : lightDials.length > 0 ? (
                <ul className="space-y-2.5">
                  {lightDials.map((d, i) => (
                    <li
                      key={`${d.method}:${d.occ}`}
                      style={{ "--i": i } as CSSProperties}
                      className="animate-rise flex items-center gap-3.5 rounded-xl px-1 py-0.5 transition hover:bg-white/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                        <span className="h-2 w-2 rotate-45 bg-gradient-to-br from-[#ff63c1] to-[#b3126f] shadow-[0_0_12px_rgba(224,49,156,.9)]" />
                      </span>
                      <span
                        className="w-24 shrink-0 truncate text-[13px] text-foreground/90 sm:w-32"
                        title={`.${d.method}()`}
                      >
                        {d.label}
                      </span>
                      <Dial
                        value={d.value}
                        min={d.min}
                        max={d.max}
                        onLive={(v) => setVisualParam(d.method, d.occ, v)}
                        onCommit={(v) => setVisualParam(d.method, d.occ, v)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-muted/60">
                  Paint something in the light pane — its numbers grow faders
                  here, live under your finger.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── sheets ──────────────────────────────────────────────────────── */}
      {sheet && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => setSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl border border-accent/20 bg-black/70 p-5 shadow-[0_0_80px_-18px_rgba(224,49,156,.5),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl"
          >
            {sheet === "sketches" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-medium text-foreground">Sketches</h2>
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
                    Nothing in the crate yet — touch the bench and it keeps
                    itself here.
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
                        ? `${fmtTokens(Math.max(0, remaining ?? 0))} left · ~${Math.floor(
                            Math.max(0, remaining ?? 0) / TOKENS_PER_LOOP,
                          )} asks`
                        : me?.poolOpen === false
                          ? "the free tastes are spoken for"
                          : "your first taste is on the house"}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  The machine writes when you feed it. $10 per million, flat, never
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

/** One machined fader — the door's pink-filled range, wired for live hands:
 *  onLive fires every movement (master rides it), onCommit on release (layer
 *  gains rewrite code once, not per pixel). */
function Dial({
  value,
  min = 0,
  max = 1.2,
  disabled = false,
  onLive,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onLive?: (v: number) => void;
  onCommit?: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      type="range"
      className="door-range min-w-0 flex-1 disabled:opacity-30"
      min={min}
      max={max}
      step={0.01}
      value={v}
      disabled={disabled}
      style={{ "--p": `${((v - min) / (max - min)) * 100}%` } as CSSProperties}
      onChange={(e) => {
        const nv = Number(e.target.value);
        setV(nv);
        onLive?.(nv);
      }}
      onPointerUp={() => onCommit?.(v)}
      onKeyUp={(e) => {
        if (e.key.startsWith("Arrow")) onCommit?.(v);
      }}
    />
  );
}

