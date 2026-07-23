"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { playPart, stop } from "@/lib/strudel-client";
import { ZALTZ_GITHUB_URL, ZALTZ_NPM_URL } from "@/lib/links";

/**
 * THE ZALTZ PLAYGROUND — type a Strudel pattern, hear our engine render it.
 * Public, no account: this page is the demo for the open-source release.
 * Playback rides the app's own zaltz path (playPart), so what you hear here
 * is byte-for-byte the engine under every Klappn song.
 */

const PRESETS: { name: string; code: string }[] = [
  {
    name: "Basement pressure",
    code: `setcpm(122/4)
$: s("bd*4").bank("RolandTR909").lpf(300).shape(.15).gain(.9).duck("2").duckdepth(.4)
$: note("a1 [~ a1] ~ [a1 ~]").s("sine").attack(.01).decay(.15).sustain(.7).release(.12).lpf(200).shape(.1).gain(.8)
$: note("[~ <[a3,c4,e4]!2 [g3,c4,e4] [g3,b3,e4]>]*2").s("sawtooth").attack(.004).decay(.2).sustain(0).release(.1).lpf(sine.range(700,1600).slow(8)).delay(.6).delaytime(.3689).delayfeedback(.6).room(.5).roomsize(6).gain(.32).orbit(2)
$: s("[~ hh]*4").bank("RolandTR909").hpf(6500).decay(.05).sustain(0).gain("0.3 0.42").pan(sine.range(.4,.6).slow(3))
$: s("~ ~ rim ~ ~ [~ rim] ~ ~").bank("RolandTR909").hpf(900).delay(.7).delaytime(.3689).delayfeedback(.55).room(.6).roomsize(5).gain(.3).orbit(3)
$: note("<a2 a2 g2 e2>").s("triangle").attack(1.5).release(2).lpf(sine.range(400,900).slow(8)).room(.8).roomsize(8).gain(.22).pan(sine.range(.35,.65).slow(6)).orbit(4)`,
  },
  {
    name: "Supersaw sunrise",
    code: `setcpm(138/4)
$: s("bd*4").bank("RolandTR909").shape(.25).gain(.9).duck("2").duckdepth(.5)
$: note("[~ f1]*4").s("sawtooth").lpf(450).decay(.14).sustain(.4).release(.08).gain(.7)
$: note("[~ <[f3,af3,c4]!2 [df3,f3,af3] [ef3,g3,bf3]>]*2").s("supersaw").unison(7).detune(.15).spread(.9).attack(.005).decay(.22).sustain(0).release(.15).lpf(2200).room(.4).roomsize(5).gain(.38).orbit(2)
$: note("f4 c5 af4 f5 c5 af5 g4 c5").s("triangle").decay(.1).sustain(0).release(.1).hpf(400).delay(.7).delaytime(.3261).delayfeedback(.55).room(.5).roomsize(6).gain(.28).pan(sine.range(.35,.65).slow(4)).orbit(3)
$: note("<[f4,af4,c5,ef5] [df4,f4,af4,c5]>").s("supersaw").unison(5).detune(.1).spread(1).attack(1.2).release(1.8).lpf(sine.range(800,2000).slow(8)).phaser(.6).phaserdepth(.7).phasercenter(900).room(.7).roomsize(7).gain(.2).orbit(4)
$: s("[~ hh]*4").bank("RolandTR909").hpf(7500).gain(.35)
$: s("~ cp ~ cp").bank("RolandTR909").room(.45).roomsize(4).gain(.35).orbit(3)`,
  },
  {
    name: "Acid stairwell",
    code: `setcpm(132/4)
$: s("bd*4").bank("RolandTR909").shape(.3).gain(.95).duck("2").duckdepth(.55)
$: note("<[a1 a1 a2 a1 [~ a1] a1 c2 a1] [a1 a1 a2 a1 [~ a1] g1 e2 g1]>").s("sawtooth").ftype("ladder").lpf(saw.range(300,2600).slow(4)).lpq(20).lpenv(2.5).lpattack(.002).lpdecay(.12).decay(.15).sustain(0).release(.08).shape(.25).gain("[.55 .7]*4").orbit(2)
$: s("hh*8").bank("RolandTR909").hpf(7000).crush(8).gain("0.25 0.4").pan(sine.range(.42,.58).slow(2))
$: s("~ cp ~ cp").bank("RolandTR909").room(.5).roomsize(4).gain(.38).orbit(3)
$: s("~ ~ ~ [~ oh]").bank("RolandTR909").hpf(5000).gain(.3).room(.3)`,
  },
  {
    name: "Dust on the Rhodes",
    code: `setcpm(82/4)
$: note("<[f2,af2,c3,g3] [db3,f3,af3,c4] [ef3,g3,bf3,ef4] [c3,ef3,g3,bf3]>").s("gm_epiano1").lpf(sine.range(600,1400).slow(8)).vib("0.8:0.15").attack(.3).release(2).room(.7).roomsize(4).gain(.6).orbit(1)
$: s("crackle*8").density(.4).lpf(3200).hpf(300).room(.5).roomsize(3).gain(.28).orbit(2)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").lpf(400).shape(.1).release(.4).gain(.5).orbit(3)
$: note("<f1 db1 ef1 c1>").s("gm_acoustic_bass").lpf(500).attack(.02).release(1.5).gain(.55).orbit(3)
$: note("<[af4 c5 ~ g4] [f4 ~ af4 ~] [bf4 ~ g4 ef4] [g4 ~ ef4 ~]>").s("gm_vibraphone").lpf(2200).attack(.05).release(1.2).vib("0.6:0.1").delay(.3).delaytime(.5488).room(.8).roomsize(5).gain(.4).orbit(4)
$: s("hh*8").bank("RolandTR808").gain(saw.range(.05,.18).fast(2)).hpf(500).lpf(6000).release(.08).pan(sine.range(.3,.7).slow(4)).room(.4).roomsize(3).orbit(2)`,
  },
  {
    name: "A moving room",
    code: `setcpm(70/4)
$: note("<[e4 ~ ~ ~ b4 ~ ~ ~] [~ ~ g4 ~ ~ ~ d5 ~] [~ b3 ~ ~ e5 ~ ~ ~] [~ ~ ~ a4 ~ ~ c5 ~]>").s("gm_tubular_bells").attack(.005).decay(1.5).sustain(0).release(.8).lpf(3800).room(.92).roomsize("<4 10 6 14>").gain(.5).pan(sine.range(.3,.7).slow(5)).orbit(2)
$: note("<e2 c2 g1 a1>").s("sine").attack(1).sustain(.8).release(1.5).lpf(150).shape(.1).gain(.5)
$: s("brown*2").attack(1.2).decay(.8).sustain(.4).release(1).lpf(sine.range(300,1200).slow(8)).hpf(60).gain(.2).pan(sine.range(.4,.6).slow(7)).room(.6).roomsize(8).orbit(3)
$: note("<[e3,g3,b3] [c3,e3,g3] [g2,b2,d3] [a2,c3,e3]>").s("triangle").attack(2).release(3).lpf(900).phaser(.3).phaserdepth(.5).room(.85).roomsize(10).gain(.25).orbit(4)`,
  },
];

export default function ZaltzPlayground() {
  const [code, setCode] = useState(PRESETS[0].code);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Waking the engine…" only when the start is ACTUALLY slow (cold boot).
  // A warm replay resolves in ~100-300ms — swapping the label for that blink
  // made the button flash and jump width on every play/stop.
  const [waking, setWaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (!busy) {
      setWaking(false);
      return;
    }
    const t = setTimeout(() => setWaking(true), 350);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    return () => {
      try {
        stop();
      } catch {
        /* leaving the page — best effort */
      }
    };
  }, []);

  async function play() {
    if (busy) return; // a boot is already in flight — never race two playParts
    const id = ++runId.current;
    setBusy(true);
    setErr(null);
    try {
      await playPart("zaltz-playground", code);
      if (runId.current !== id) {
        // superseded mid-boot (halt or a newer run) — playPart has no
        // cancellation, so the boot that just landed must be silenced here
        try { stop(); } catch { /* already stopped */ }
        return;
      }
      setPlaying(true);
    } catch (e) {
      if (runId.current === id)
        setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (runId.current === id) setBusy(false);
    }
  }

  function halt() {
    runId.current++;
    try {
      stop();
    } catch {
      /* already stopped */
    }
    setPlaying(false);
    setBusy(false);
  }

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-24 pt-10 sm:pt-16">
      {/* the scatter — a table dusted with grains, catching the light. Fixed,
          faint, and behind everything: texture, never noise. */}
      <svg
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="#fff">
          <rect x="12" y="18" width=".7" height=".7" opacity=".10" transform="rotate(24 12 18)" />
          <rect x="26" y="9" width=".5" height=".5" opacity=".07" transform="rotate(51 26 9)" />
          <rect x="44" y="14" width=".6" height=".6" opacity=".08" transform="rotate(12 44 14)" />
          <rect x="71" y="8" width=".8" height=".8" opacity=".09" transform="rotate(38 71 8)" />
          <rect x="88" y="21" width=".5" height=".5" opacity=".07" transform="rotate(64 88 21)" />
          <rect x="7" y="47" width=".6" height=".6" opacity=".06" transform="rotate(45 7 47)" />
          <rect x="93" y="44" width=".7" height=".7" opacity=".08" transform="rotate(18 93 44)" />
          <rect x="17" y="76" width=".8" height=".8" opacity=".07" transform="rotate(30 17 76)" />
          <rect x="38" y="88" width=".5" height=".5" opacity=".06" transform="rotate(57 38 88)" />
          <rect x="63" y="82" width=".6" height=".6" opacity=".08" transform="rotate(9 63 82)" />
          <rect x="84" y="70" width=".7" height=".7" opacity=".07" transform="rotate(42 84 70)" />
          <rect x="55" y="38" width=".4" height=".4" opacity=".05" transform="rotate(21 55 38)" />
        </g>
        <g fill="#ff63c1">
          <rect x="33" y="27" width=".7" height=".7" opacity=".16" transform="rotate(33 33 27)" />
          <rect x="79" y="33" width=".6" height=".6" opacity=".13" transform="rotate(15 79 33)" />
          <rect x="24" y="61" width=".6" height=".6" opacity=".12" transform="rotate(48 24 61)" />
          <rect x="69" y="58" width=".5" height=".5" opacity=".11" transform="rotate(27 69 58)" />
          <rect x="49" y="7" width=".5" height=".5" opacity=".13" transform="rotate(60 49 7)" />
          <rect x="90" y="86" width=".7" height=".7" opacity=".12" transform="rotate(36 90 86)" />
        </g>
      </svg>
      <h1 className="flex items-center gap-3.5">
        {/* the grain — zaltz's mark */}
        <img
          src="/zaltz-icon.svg"
          alt=""
          className="h-11 w-11 drop-shadow-[0_0_24px_rgba(224,49,156,.45)] sm:h-14 sm:w-14"
        />
        <span className="bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          zaltz
        </span>
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        One grain of C — 165&nbsp;KB of wasm living on the audio thread,
        where your browser can&apos;t touch it. This box is the exact engine
        under every{" "}
        <Link href="/" className="text-accent transition hover:text-foreground">
          Klappn
        </Link>{" "}
        song. Type. Play. Try to make it glitch.
      </p>

      <div className="mt-7 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => setCode(p.code)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] transition active:scale-[.97] ${
              code === p.code
                ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                : "bg-white/[0.04] text-muted/70 hover:bg-accent/15 hover:text-accent"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={10}
        className="mt-3 w-full resize-y rounded-2xl bg-white/[0.04] px-4 py-3.5 font-mono text-[13px] leading-relaxed text-foreground/90 outline-none backdrop-blur-lg transition placeholder:text-muted/40 focus:bg-white/[0.06]"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={playing ? halt : play}
          disabled={busy}
          className={`min-w-[6.5rem] rounded-full bg-gradient-to-r from-[#ff63c1] via-[#e0319c] to-[#b3126f] px-6 py-2.5 text-[14.5px] font-medium text-white transition active:scale-[.97] ${
            waking ? "opacity-60" : ""
          }`}
        >
          {waking ? "Waking the engine…" : playing ? "Stop" : "Play"}
        </button>
        {/* mounted always — popping in/out shifted the row on every play/stop */}
        <button
          onClick={() => void play()}
          tabIndex={playing ? 0 : -1}
          aria-hidden={!playing}
          className={`rounded-full bg-white/[0.05] px-4 py-2.5 text-[13.5px] text-muted transition hover:text-foreground active:scale-[.97] ${
            playing ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          Re-run
        </button>
      </div>
      {err && (
        <p className="mt-3 text-[13px] leading-snug text-red-300/80">{err}</p>
      )}

      <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted/70">
        <a
          href={ZALTZ_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-foreground"
        >
          Source on GitHub
        </a>
        <a
          href={ZALTZ_NPM_URL}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-foreground"
        >
          npm install zaltz
        </a>
        <Link href="/open" className="transition hover:text-foreground">
          Why it&apos;s open
        </Link>
      </div>
      <p className="mt-4 max-w-lg text-[12.5px] leading-relaxed text-muted/50">
        Three generations of one kitchen: SuperDirt → superdough → zaltz.
        AGPL-3.0 — the pattern language is{" "}
        <a
          href="https://strudel.cc"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-white/20 transition hover:text-foreground"
        >
          Strudel
        </a>
        , untouched upstream.
      </p>
    </main>
  );
}
