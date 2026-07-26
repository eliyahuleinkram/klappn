"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import CodePane, { type CaretContext } from "@/components/CodePane";
import { authClient } from "@/lib/auth-client";
import { attachHydraBlock } from "@/lib/hydra-embed";
import { openDeep } from "@/lib/seal";
import {
  playPart,
  setExplicitVisualsDrive,
  setHydraErrorSink,
  setStrudelErrorSink,
  setVisuals,
  startIdleVisual,
  stop,
  updateVisuals,
} from "@/lib/strudel-client";
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

interface Proposal {
  strudel?: string;
  hydra?: string;
  note?: string;
  issues?: string[];
}

interface Tweak {
  name: string;
  ask: string;
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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toLocaleString()}M`;
  return `${Math.round(n / 1000)}k`;
}

/** Which lines of `next` are new/changed vs `prev` (LCS on lines) — the
 *  proposal preview lights exactly what the machine touched. */
function changedLines(prev: string, next: string): boolean[] {
  const a = prev.split("\n");
  const b = next.split("\n");
  const n = a.length;
  const m = b.length;
  if (n * m > 250_000) return b.map(() => false); // never burn the UI on a diff
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keep = new Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      keep[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return keep.map((k) => !k);
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

  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState<string | null>(null); // the ask in flight
  const [proposal, setProposal] = useState<Proposal | null>(null);

  // THE COPILOT — ghost completions at the caret (Tab takes, Esc bins).
  const [copilot, setCopilot] = useState(true);
  const [ghost, setGhost] = useState<{ pane: PaneId; text: string } | null>(null);
  const ghostSeq = useRef(0);
  const ghostAbort = useRef<AbortController | null>(null);
  const mintTried = useRef(false); // one silent guest-mint attempt per visit

  // TWEAK CHIPS — offered after a clean run, never auto-applied.
  const [tweaks, setTweaks] = useState<Tweak[]>([]);
  const tweaksMeta = useRef({ lastCode: "", at: 0, inflight: false });
  // runMusic (declared above the tweaks logic) calls through this ref.
  const tweaksAfterRun = useRef<() => Promise<void> | void>(() => {});

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
    busyWithTake: false,
  });
  stateRef.current = {
    strudel,
    hydra,
    title,
    sketchId,
    playing,
    // While a take is on the table (or being conjured) the copilot stays quiet.
    busyWithTake: proposal !== null || asking !== null,
  };

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
        if (typeof d.strudel === "string") setStrudel(d.strudel);
        if (typeof d.hydra === "string") setHydra(d.hydra);
        if (typeof d.title === "string" && d.title) setTitle(d.title);
        setSketchId(d.sketchId ?? null);
      }
    } catch {
      /* a bad draft never blocks the bench */
    }
    void refreshMe();
    void refreshSketches();
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
    try {
      const res = await fetch("/api/sketches");
      if (!res.ok) return; // signed out — nothing saved yet
      const d = openDeep((await res.json()) as { sketches: Sketch[] });
      setSketches(d.sketches ?? []);
    } catch {
      /* list is cosmetic */
    }
  }

  /** A session on demand: the visitor plays first; identity appears the moment
   *  it's needed (first save / first ask) as a silent guest — no form, no wall. */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (meRef.current?.signedIn) return true;
    try {
      const { error } = await authClient.signIn.anonymous();
      if (error) throw new Error(String(error.message ?? "guest sign-in failed"));
    } catch {
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
      setTimeout(() => void tweaksAfterRun.current(), 1500);
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
        setProposal(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [halt]);

  // ── save / load ────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (saving) return;
    if (!(await ensureSession())) return;
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
        setNotice(d.error || "Couldn't save — try again.");
        return;
      }
      setSketchId(d.sketch.id);
      setDirty(false);
      void refreshSketches();
    } finally {
      setSaving(false);
    }
  }, [ensureSession, saving]);
  const saveRef = useRef(save);
  saveRef.current = save;

  function loadSketch(s: Sketch) {
    setStrudel(s.strudel);
    setHydra(s.hydra);
    setTitle(s.title);
    setSketchId(s.id);
    setDirty(false);
    setProposal(null);
    setSheet(null);
  }

  function loadStarter(p: (typeof STARTERS)[number]) {
    setStrudel(p.strudel);
    setHydra(p.hydra);
    setTitle(p.name);
    setSketchId(null);
    setDirty(false);
    setProposal(null);
    setSheet(null);
  }

  function newSketch() {
    setStrudel("");
    setHydra("");
    setTitle("untitled sketch");
    setSketchId(null);
    setDirty(false);
    setProposal(null);
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
      if (stateRef.current.busyWithTake) return; // never whisper over a take
      // Nothing left to spend → the copilot goes quiet instead of 402-spamming.
      const m = meRef.current;
      if (m?.signedIn && !m.owner && (m.remainingTokens ?? 0) <= 0) return;
      if (!m?.signedIn) {
        if (mintTried.current) return;
        mintTried.current = true;
        if (!(await ensureSession())) return;
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
          body: JSON.stringify({ pane, before: ctx.before, after: ctx.after }),
        });
        if (!res.ok) return; // 402/429 → quiet; the meter chip tells the story
        const d = openDeep((await res.json().catch(() => ({}))) as { ghost?: string });
        let g = d.ghost ?? "";
        if (!ctx.atEnd) g = g.split("\n")[0]; // alignment law — see CodePane
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

  // ── tweak chips — the machine's "next moves", after a clean run ────────────
  const maybeTweaks = useCallback(async () => {
    const { strudel: s, hydra: h } = stateRef.current;
    const code = s + " " + h;
    const meta = tweaksMeta.current;
    if (meta.inflight || code === meta.lastCode) return;
    if (Date.now() - meta.at < 45_000) return;
    const m = meRef.current;
    if (!m?.signedIn) return; // chips wait for a session; never mint one for this
    if (!m.owner && (m.remainingTokens ?? 0) <= 0) return;
    meta.inflight = true;
    try {
      const res = await fetch("/api/tweaks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strudel: s, hydra: h }),
      });
      if (!res.ok) return;
      const d = (await res.json().catch(() => ({}))) as { tweaks?: Tweak[] };
      if (Array.isArray(d.tweaks) && d.tweaks.length) {
        setTweaks(d.tweaks);
        meta.lastCode = code;
        meta.at = Date.now();
      }
    } catch {
      /* chips just don't appear */
    } finally {
      meta.inflight = false;
    }
  }, []);
  tweaksAfterRun.current = maybeTweaks;

  // ── the bandmate (the Ask path — a whole take, yours to drop in or bin) ────
  async function conjure(askText: string, retried = false) {
    const asked = askText.trim();
    if (!asked || asking) return;
    if (!(await ensureSession())) return;
    setAsking(asked);
    setNotice(null);
    killGhost();
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          strudel: stateRef.current.strudel,
          hydra: stateRef.current.hydra,
          ask: asked,
        }),
      });
      const d = openDeep(
        (await res.json().catch(() => ({}))) as Proposal & {
          error?: string;
          code?: string;
        },
      );
      if (res.status === 401 && d.code === "session_required" && !retried) {
        setMe(null);
        meRef.current = null;
        setAsking(null);
        return conjure(asked, true);
      }
      if (res.status === 402) {
        setSheet("tokens");
        setNotice(d.error || "Tokens spent — top up to keep the machine talking.");
        return;
      }
      if (!res.ok) {
        setNotice(d.error || "The machine dropped the take — ask again.");
        return;
      }
      setProposal({ strudel: d.strudel, hydra: d.hydra, note: d.note, issues: d.issues });
      if (ask.trim() === asked) setAsk("");
      void refreshMe(); // the meter moved
    } catch {
      setNotice("Network hiccup — ask again.");
    } finally {
      setAsking(null);
    }
  }

  function takeProposal() {
    if (!proposal) return;
    const wasPlaying = stateRef.current.playing;
    if (proposal.strudel !== undefined) setStrudel(proposal.strudel);
    if (proposal.hydra !== undefined) setHydra(proposal.hydra);
    setDirty(true);
    const p = proposal;
    setProposal(null);
    // Mid-set, the take drops straight into the running mix — that's the point.
    if (wasPlaying) {
      setTimeout(() => {
        if (p.strudel !== undefined) void runMusic();
        else if (p.hydra !== undefined) runVisuals();
      }, 30);
    }
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
  const tokenChip = !me
    ? "…"
    : me.owner
      ? "∞"
      : me.signedIn
        ? fmtTokens(Math.max(0, remaining ?? 0))
        : me.poolOpen === false
          ? "0"
          : "free taste";

  const paneHeader = (
    label: string,
    hint: string,
    run: () => void,
    active: boolean,
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
      <span className="hidden text-[11px] text-muted/45 sm:inline">{hint}</span>
      <button
        onClick={run}
        className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11.5px] text-foreground/85 transition hover:bg-accent/20 hover:text-accent-strong active:scale-[.96]"
        title="Evaluate this pane (⌘↵)"
      >
        ▶ run
      </button>
    </div>
  );

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden px-3 pb-3 sm:px-4">
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
            setDirty(true);
          }}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-[14px] text-foreground/90 outline-none transition placeholder:text-muted/40 hover:bg-white/[0.04] focus:bg-white/[0.05]"
          placeholder="name this sketch"
        />
        <button
          onClick={() => void save()}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition active:scale-[.97] ${
            dirty
              ? "bg-accent/20 text-accent-strong ring-1 ring-inset ring-accent/40 hover:bg-accent/30"
              : "bg-white/[0.05] text-muted hover:text-foreground"
          }`}
          title="Save (⌘S)"
        >
          {saving ? <span className="shimmer-text">Saving…</span> : dirty ? "Save ·" : "Saved"}
        </button>
        <button
          onClick={toggleCopilot}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition active:scale-[.97] ${
            copilot
              ? "bg-accent/[0.14] text-accent-strong ring-1 ring-inset ring-accent/30"
              : "bg-white/[0.05] text-muted/60 hover:text-foreground"
          }`}
          title="Ghost completions as you type — ⇥ takes them, Esc bins them"
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
          )}
          <CodePane
            value={strudel}
            onChange={(v) => {
              if (ghost?.pane === "strudel") killGhost();
              setStrudel(v);
              setDirty(true);
            }}
            onRun={() => void runMusic()}
            onSave={() => void save()}
            flash={sFlash}
            ghost={ghost?.pane === "strudel" ? ghost.text : null}
            onGhostAccept={killGhost}
            onGhostDismiss={killGhost}
            onCaretIdle={(ctx) => void requestGhost("strudel", ctx)}
            placeholder={`setcpm(128/4)\n$: s("bd*4").bank("RolandTR909")\n\n// type, then ⌘↵ — the room hears you`}
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
          )}
          <CodePane
            value={hydra}
            onChange={(v) => {
              if (ghost?.pane === "hydra") killGhost();
              setHydra(v);
              setDirty(true);
            }}
            onRun={runVisuals}
            onSave={() => void save()}
            flash={hFlash}
            ghost={ghost?.pane === "hydra" ? ghost.text : null}
            onGhostAccept={killGhost}
            onGhostDismiss={killGhost}
            onCaretIdle={(ctx) => void requestGhost("hydra", ctx)}
            placeholder={`osc(4, 0, 1).color(1, .3, .7)\n  .rotate(H(saw.slow(4).range(0, 6.283)))\n  .out()\n\n// the walls, in code`}
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

      {/* ── the proposal — the machine's take, yours to drop in or bin ──── */}
      {proposal && (
        <div className="mt-2 max-h-[38dvh] overflow-y-auto rounded-2xl border border-accent/30 bg-black/60 p-3.5 shadow-[0_0_70px_-20px_rgba(224,49,156,.55)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
              the machine&apos;s take
            </span>
            {proposal.note && (
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted" title={proposal.note}>
                {proposal.note}
              </span>
            )}
            <button
              onClick={takeProposal}
              className="btn-primary shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium active:scale-[.97]"
            >
              {playing ? "Drop it in" : "Take it"}
            </button>
            <button
              onClick={() => setProposal(null)}
              className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-muted transition hover:text-foreground active:scale-[.97]"
              aria-label="Dismiss the take"
            >
              ✕
            </button>
          </div>
          {proposal.issues && proposal.issues.length > 0 && (
            <p className="mt-2 text-[12px] leading-snug text-amber-300/80">
              Told straight — it still flags: {proposal.issues.join(" · ")}
            </p>
          )}
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {proposal.strudel !== undefined && (
              <ProposalPane label="music" prev={strudel} next={proposal.strudel} />
            )}
            {proposal.hydra !== undefined && (
              <ProposalPane label="light" prev={hydra} next={proposal.hydra} />
            )}
          </div>
        </div>
      )}

      {/* ── tweak chips — the machine's next moves, offered never applied ── */}
      {tweaks.length > 0 && !proposal && (
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[12px] text-accent-strong/80" title="One tap asks for the change — you still take it or leave it">
            ✦
          </span>
          {tweaks.map((t) => (
            <button
              key={t.name + t.ask}
              onClick={() => void conjure(t.ask)}
              disabled={!!asking}
              title={t.ask}
              className={`shrink-0 rounded-full border border-accent/25 bg-accent/[0.07] px-3 py-1.5 text-[12.5px] text-foreground/90 transition hover:bg-accent/[0.16] hover:text-accent-strong active:scale-[.97] disabled:opacity-40 ${
                asking === t.ask ? "border-accent/50 text-accent-strong" : ""
              }`}
            >
              {asking === t.ask ? (
                <span className="shimmer-text">{t.name}…</span>
              ) : (
                t.name
              )}
            </button>
          ))}
          <button
            onClick={() => setTweaks([])}
            className="shrink-0 px-1.5 text-[12px] text-muted/50 transition hover:text-foreground"
            aria-label="Hide tweaks"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── transport + the ask bar ─────────────────────────────────────── */}
      <footer className="mt-2.5 flex items-center gap-2.5">
        <button
          onClick={playing ? halt : () => void runMusic()}
          disabled={busy}
          className={`btn-primary min-w-[5.5rem] rounded-full px-5 py-2.5 text-[14px] font-medium transition active:scale-[.97] ${
            waking ? "opacity-60" : ""
          }`}
        >
          {waking ? "Waking…" : playing ? "Stop" : "Play"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void conjure(ask);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.1] bg-black/45 py-1 pl-4 pr-1 backdrop-blur-xl transition focus-within:border-accent/40 focus-within:shadow-[0_0_44px_-16px_rgba(224,49,156,.55)]"
        >
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="or ask in your own words — it proposes a take, you take it or leave it"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted/45"
          />
          <button
            type="submit"
            disabled={!!asking || !ask.trim()}
            className="shrink-0 rounded-full bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] px-4 py-1.5 text-[13px] font-medium text-white transition active:scale-[.97] disabled:opacity-40"
          >
            {asking && asking === ask.trim() ? (
              <span className="shimmer-text">Asking…</span>
            ) : (
              "✦ Ask"
            )}
          </button>
        </form>
      </footer>

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
                    Nothing in the crate yet — save a take and it lives here.
                    {me?.signedIn && me.isGuest
                      ? " Saves stay with this browser until you claim them."
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

/** One pane of the machine's take — full code, changed lines lit. */
function ProposalPane({
  label,
  prev,
  next,
}: {
  label: string;
  prev: string;
  next: string;
}) {
  const changed = changedLines(prev, next);
  const lines = next.split("\n");
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-black/40">
      <p className="border-b border-white/[0.05] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted/60">
        {label}
      </p>
      <pre className="max-h-[24dvh] overflow-auto p-3 font-mono text-[12px] leading-[1.55] text-foreground/80">
        {lines.map((l, i) => (
          <div
            key={i}
            className={changed[i] ? "-mx-3 bg-accent/[0.12] px-3 text-foreground" : undefined}
          >
            {l || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
