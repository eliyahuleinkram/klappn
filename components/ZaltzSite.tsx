"use client";

/**
 * zaltz.klappn.com — the ENGINE's own front door.
 *
 * Not the instrument. The instrument is klappn.com/boiler-room, and this page
 * deliberately isn't it: no copilot, no tape, no lineup, no second pane. This
 * is the shop window for the open-source part — the same shape as
 * zissl.klappn.com, which shows off the picture engine.
 *
 * zissl's demo is a canvas, because zissl paints. zaltz's demo is SOUND, so
 * the stage is a scope drawn from the engine's own output: the proof isn't a
 * screenshot, it's the waveform the C is producing in your browser right now.
 * Each preset is a short patch chosen to put one part of the DSP in the open —
 * the drum kit, the distortion family, the phase vocoder, the room.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getTakeTap, playPart, stop, unlockAudio } from "@/lib/strudel-client";
import { ZALTZ_GITHUB_URL, ZALTZ_NPM_URL } from "@/lib/links";

type Demo = { name: string; blurb: string; code: string };

/** Each one exists to make a specific piece of the engine audible. */
const DEMOS: Demo[] = [
  {
    name: "the kit",
    blurb: "Sample voices, per-orbit buses, a sidechain that pumps.",
    code: `setcpm(126/4)
$: s("bd*4").gain(.9).duck("2").duckattack(.18)
$: s("~ cp").room(.3)
$: s("hh*8").vel("[.9 .5]*4").pan(sine.range(.35,.65))
$: note("<c2 c2 g1 a#1>").s("sawtooth").lpf(420)
  .attack(.005).decay(.18).sustain(0).orbit(2)`,
  },
  {
    name: "distortion ×9",
    blurb: "scurve, soft, hard, cubic, diode, asym, fold, sinefold, chebyshev.",
    code: `setcpm(120/4)
$: note("<c2 e2 g2 a#2>*2").s("sawtooth")
  .attack(.005).decay(.3).sustain(.2).release(.1)
  .diode("<1.2 2.4 3.1 1.8>").lpf(2600).gain(.75)
$: s("bd*2").hard(.4).postgain(1.1)`,
  },
  {
    name: "stretch",
    blurb: "A phase vocoder in C — phaze, ported butterfly for butterfly.",
    code: `setcpm(112/4)
$: s("bd*2").gain(.9)
$: s("~ cp").stretch("<.1 -.3 .4>").vel(.9)
$: s("hh*8").stretch(.15).vel(.5)`,
  },
  {
    name: "the room",
    blurb: "An 8-line FDN that decays for exactly as long as it says.",
    code: `setcpm(84/4)
$: note("<c3 g3 a#3 f3>").s("triangle")
  .attack(.01).decay(.4).sustain(.3).release(.6)
  .room(.85).roomsize("<2 6>").rdim(1200).gain(.5).orbit(2)
$: s("~ ~ ~ bd").room(.4).gain(.8)`,
  },
  {
    name: "tremolo + pitch",
    blurb: "A skewed triangle LFO, and envelopes that bend the pitch itself.",
    code: `setcpm(96/4)
$: note("<a#2 f2>").s("sawtooth").lpf(900)
  .trem(4.5).tremdepth(.85).tremoloskew(.4)
  .attack(.02).sustain(.6).release(.3).gain(.6).orbit(2)
$: note("c4*4").s("square").penv("<0 .8 -.6 1>").patt(.12)
  .attack(.004).decay(.14).sustain(0).gain(.35)`,
  },
];

export default function ZaltzSite() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // THE SCOPE — an analyser on the engine's own final tap. It exists to prove
  // the thing is running: no sound, no line.
  useEffect(() => {
    let raf = 0;
    let analyser: AnalyserNode | null = null;
    let buf: Float32Array<ArrayBuffer> | null = null;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(cv.clientWidth * dpr);
      const h = Math.floor(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      const g = cv.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, w, h);

      if (!analyser) {
        const tap = getTakeTap();
        if (tap) {
          try {
            const ac = (tap as AudioNode).context as AudioContext;
            analyser = ac.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.6;
            tap.connect(analyser);
            buf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
          } catch {
            analyser = null; // the tap isn't up yet — try again next frame
          }
        }
      }

      const mid = h / 2;
      g.lineWidth = Math.max(1, dpr);
      if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        const grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "#ff63c1");
        grad.addColorStop(0.5, "#e0319c");
        grad.addColorStop(1, "#b3126f");
        g.strokeStyle = grad;
        g.shadowColor = "rgba(224,49,156,.55)";
        g.shadowBlur = 18 * dpr;
        g.beginPath();
        for (let i = 0; i < buf.length; i++) {
          const x = (i / (buf.length - 1)) * w;
          const y = mid - buf[i] * mid * 0.92;
          i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
        g.shadowBlur = 0;
        if (peak < 0.0005) {
          // silent: a resting line, so the stage never looks broken
          g.strokeStyle = "rgba(224,49,156,.22)";
          g.beginPath();
          g.moveTo(0, mid);
          g.lineTo(w, mid);
          g.stroke();
        }
      } else {
        g.strokeStyle = "rgba(224,49,156,.22)";
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(w, mid);
        g.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      try {
        analyser?.disconnect();
      } catch {
        /* context already gone */
      }
    };
  }, []);

  useEffect(() => () => void stop(), []);

  // NO "busy" LATCH. An earlier version disabled every pill while one await
  // was in flight, and the first click on a cold page hung inside the audio
  // unlock — which left the whole page dead, every button greyed, with no way
  // back. A control that can be frozen by a pending promise is a trap: the
  // pills stay live, and the LAST press wins.
  const playDemo = useCallback(async (i: number) => {
    if (activeRef.current === i) {
      stop();
      setActive(null);
      return;
    }
    setActive(i); // the press answers immediately; sound catches up
    try {
      await unlockAudio();
      await playPart("zaltz-site", DEMOS[i].code, "zaltz-site", false);
    } catch {
      if (activeRef.current === i) setActive(null);
    }
  }, []);

  const link = "underline decoration-white/20 underline-offset-4 hover:decoration-white/60 transition";
  const demo = active != null ? DEMOS[active] : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#08070a] font-mono text-[13px] leading-relaxed text-[#efe9ef]">
      {/* THE STAGE — the engine's own waveform, full bleed */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[620px] bg-gradient-to-r from-black/80 via-black/35 to-transparent md:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58vh] bg-gradient-to-t from-black/85 via-black/35 to-transparent md:hidden" />

      {/* THE RAIL — zissl's shape, in the grain's colours */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[76vh] flex-col rounded-t-2xl border-t border-accent/25 bg-[#0a090c]/85 backdrop-blur-2xl md:inset-x-auto md:inset-y-0 md:left-0 md:max-h-none md:w-[460px] md:rounded-none md:border-r md:border-t-0 md:border-accent/20 md:bg-[#0a090c]/75">
        <div className="flex flex-1 flex-col overflow-y-auto p-5 md:p-7">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[26px] font-bold tracking-[0.04em] text-accent-strong md:text-[34px]">
              zaltz
            </span>
            <a href="https://zissl.klappn.com" className={`text-[11px] text-[#8a8290] ${link}`}>
              zissl, its light ↗
            </a>
          </div>
          <p className="mb-5 text-[12px] text-[#9c93a4] md:mb-6">
            A live-coding audio engine written in C, compiled to WebAssembly,
            running on the audio thread. Superdough&apos;s sound, rebuilt so
            nothing allocates while it plays. Free software — press a patch and
            the line below is the engine talking.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {DEMOS.map((d, i) => (
              <button
                key={d.name}
                onClick={() => void playDemo(i)}
                title={d.blurb}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${
                  active === i
                    ? "border-accent/60 bg-accent/[0.14] text-accent-strong"
                    : "border-white/[0.14] text-[#9c93a4] hover:border-white/30 hover:text-foreground"
                }`}
              >
                {active === i ? "■ " : "▶ "}
                {d.name}
              </button>
            ))}
          </div>

          {demo && (
            <>
              <p className="mt-4 text-[11.5px] text-[#8a8290]">{demo.blurb}</p>
              {/* READ-ONLY on purpose: the editor is the instrument's job, and
                  the instrument lives at klappn.com/boiler-room. */}
              <pre className="mt-2 max-h-[34vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-black/40 p-3 text-[11.5px] text-[#c9c0cd]">
                {demo.code}
              </pre>
            </>
          )}

          <div className="mt-auto pt-6 text-[11.5px] text-[#8a8290]">
            <div className="mb-3 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-[#c9c0cd]">
              npm i zaltz
            </div>
            <p className="mb-3">
              Want to play it rather than read it?{" "}
              <a href="https://klappn.com/boiler-room" className={`text-accent-strong ${link}`}>
                klappn.com/boiler-room
              </a>{" "}
              is the instrument built on this engine — two panes, a copilot, and
              a tape deck.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <a href={ZALTZ_GITHUB_URL} className={link}>
                source ↗
              </a>
              <a href={ZALTZ_NPM_URL} className={link}>
                npm ↗
              </a>
              <a href="https://klappn.com/open" className={link}>
                the whole machine ↗
              </a>
              <span className="text-[#5f5866]">AGPL-3.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
