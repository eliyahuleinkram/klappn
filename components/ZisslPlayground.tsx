"use client";

/**
 * zissl.klappn.com — the playground. A full-screen zissl canvas and a text
 * box, in the same spirit as zaltz.klappn.com: type a chain, the room lights
 * up. The hero preset is the SWARM — a million physarum agents on compute
 * shaders, sensing the picture and drawing living filaments over it — the
 * extension that shows why the new machine matters (WebGL Hydra has no
 * compute; this is simply outside its physics).
 *
 * WebGPU only, deliberately: this page is the demo of the new engine. The
 * app itself (klappn.com, zaltz.klappn.com) falls back to hydra-synth for
 * older browsers — see lib/zissl-boot.ts.
 */

import { useEffect, useRef, useState } from "react";

const PRESETS: { name: string; code: string }[] = [
  {
    name: "swarm",
    code: `// one million agents on compute — the part WebGL never had
osc(6, 0.08, 1.4).kaleid(5).rotate(0, 0.02).out(o0);
swarm(1000000, o0, 1.4, 1.6)
  .color(0.45, 0.8, 1.5)
  .add(src(o0).brightness(-0.42), 0.35)
  .out(o1);
render(o1);`,
  },
  {
    name: "feedback",
    code: `osc(10, 0.1, 1.4)
  .kaleid(5)
  .modulate(noise(3), 0.05)
  .blend(src(o0), 0.72)
  .rotate(0, 0.04)
  .out(o0);
render(o0);`,
  },
  {
    name: "voronoi",
    code: `voronoi(6, 0.3)
  .modulate(noise(3), 0.2)
  .color(0.55, 0.75, 1.1)
  .contrast(1.4)
  .modulateRotate(osc(2, 0.2), 0.4)
  .out(o0);
render(o0);`,
  },
  {
    name: "grid",
    code: `osc(30, 0.05, 1.2).out(o0);
noise(4, 0.2).thresh(0.4, 0.1).out(o1);
voronoi(8, 0.5).colorama(0.008).out(o2);
shape(5, 0.4, 0.05).repeat(4, 3).rotate(0, 0.15).out(o3);
render();`,
  },
  {
    name: "swarm × swarm",
    code: `// the colony eats its own trail — pure emergence, no oscillator at all
swarm.tune({ senseAng: 0.5, senseDist: 14 });
swarm(1500000, null, 1.6, 1.8)
  .color(1.4, 0.6, 1.1)
  .modulateRotate(osc(1, 0.05, 0), 0.15)
  .out(o0);
render(o0);`,
  },
];

export default function ZisslPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zRef = useRef<{ hush: () => void } | null>(null);
  const [code, setCode] = useState(PRESETS[0].code);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [noGpu, setNoGpu] = useState(false);
  // Phones open with the editor tucked away — the picture is the show; the
  // `code` pill unfolds it. Desktop's rail always shows it (md:block).
  const [codeOpen, setCodeOpen] = useState(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    let disposed = false;
    let z: { hush: () => void; dispose: () => void; onerror: unknown } | null = null;
    (async () => {
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        setNoGpu(true);
        return;
      }
      try {
        const { default: Zissl } = await import("zissl");
        // A pane measured mid-layout can report 0 — floor to a real stage.
        // NATIVE resolution: the playground is the engine's portrait, and a
        // soft upscale reads as a cheap one. Full devicePixelRatio (≤2),
        // bounded by an AREA budget instead of hard edges — 1:1 pixels on
        // ordinary retina fullscreens, proportional on cinema displays.
        const dims = () => {
          const s = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(640, window.innerWidth * s);
          const h = Math.max(360, window.innerHeight * s);
          const k = Math.min(1, Math.sqrt((3456 * 2160) / (w * h)));
          return { w: Math.floor(w * k), h: Math.floor(h * k) };
        };
        const d0 = dims();
        const created = await Zissl.create({
          canvas: canvasRef.current!,
          width: d0.w,
          height: d0.h,
          makeGlobal: true,
        });
        if (disposed) {
          created.dispose();
          return;
        }
        z = created as unknown as typeof z;
        zRef.current = created;
        created.onerror = (m: string) => setErr(m);
        let resizeTimer: ReturnType<typeof setTimeout> | null = null;
        window.addEventListener("resize", () => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const d = dims();
            created.setResolution(d.w, d.h);
          }, 200);
        });
        setReady(true);
        run(codeRef.current, created);
      } catch (e) {
        setNoGpu(true);
        console.error("[zissl] boot failed", e);
      }
    })();
    return () => {
      disposed = true;
      try {
        z?.dispose();
      } catch {
        /* leaving the page */
      }
    };
     
  }, []);

  function run(src?: string, engine?: { hush: () => void } | null) {
    const zi = engine ?? zRef.current;
    if (!zi) return;
    setErr(null);
    try {
      zi.hush(); // fresh outputs + a resting swarm — each run stands alone
      new Function(src ?? codeRef.current)();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const link = "underline decoration-[#7c63ff]/40 underline-offset-2 hover:text-[#cfc4ff] transition-colors";

  return (
    <div className="fixed inset-0 bg-[#07070c] text-[#e8e6f2] overflow-hidden font-mono text-[13px] leading-relaxed">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* the canvas is the show — the rail only borrows its left edge */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[560px] bg-gradient-to-r from-black/70 via-black/25 to-transparent md:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52vh] bg-gradient-to-t from-black/80 via-black/30 to-transparent md:hidden" />

      {/* THE RAIL — a studio column on desktop, a bottom sheet on phones */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-[#7c63ff]/25 bg-[#0a0a10]/80 backdrop-blur-2xl md:inset-x-auto md:inset-y-0 md:left-0 md:max-h-none md:w-[440px] md:rounded-none md:border-t-0 md:border-r md:border-[#7c63ff]/20 md:bg-[#0a0a10]/70">
        <div className="flex flex-1 flex-col overflow-y-auto p-5 md:p-7">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[26px] font-bold tracking-[0.04em] text-[#cfc4ff] md:text-[34px]">
              zissl
            </span>
            <a href="https://zaltz.klappn.com" className={`text-[11px] text-[#6f6a85] ${link}`}>
              zaltz&apos;s sweet counterpart ↗
            </a>
          </div>
          <p className="mb-4 text-[12px] text-[#8d87a8] md:mb-6">
            Hydra&apos;s language, WebGPU&apos;s machine. Type a chain — the room
            lights up.
          </p>

          {noGpu ? (
            <p className="py-6 text-sm text-[#a9a4c0]">
              This page needs WebGPU (Chrome, Edge, Safari 26, Firefox 141+).
              Inside Klappn the engine falls back gracefully — but the
              playground is the new machine, undiluted.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setCode(p.code);
                      run(p.code);
                    }}
                    disabled={!ready}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors disabled:opacity-40 ${
                      i === 0
                        ? "border-[#7c63ff]/70 bg-[#7c63ff]/15 text-[#cfc4ff] hover:bg-[#7c63ff]/25"
                        : "border-[#7c63ff]/30 text-[#a89ee0] hover:bg-[#7c63ff]/10 hover:text-[#cfc4ff]"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
                spellCheck={false}
                className={`mt-3 h-[19vh] min-h-[110px] w-full flex-none resize-none rounded-lg border border-[#7c63ff]/15 bg-black/40 p-3 text-[12.5px] leading-[1.55] text-[#e8e6f2] outline-none focus:border-[#7c63ff]/40 md:block md:h-auto md:flex-1 md:text-[13px] ${codeOpen ? "" : "hidden"}`}
                style={{ tabSize: 2 }}
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => run()}
                  disabled={!ready}
                  className="rounded-lg bg-[#7c63ff] px-6 py-2 font-semibold text-[#07070c] transition-colors hover:bg-[#9280ff] disabled:opacity-40"
                >
                  run
                </button>
                <button
                  onClick={() => setCodeOpen((v) => !v)}
                  className="rounded-lg border border-[#7c63ff]/40 px-4 py-2 text-[#a89ee0] transition-colors hover:bg-[#7c63ff]/10 md:hidden"
                >
                  {codeOpen ? "hide code" : "code"}
                </button>
                <span className="hidden text-[11px] text-[#6f6a85] md:inline">⌘⏎ runs it</span>
                {!ready && !noGpu && <span className="ml-auto text-[11px] text-[#6f6a85]">warming the device…</span>}
              </div>
              {err && (
                <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] text-[#ff8da3]">{err}</pre>
              )}
            </>
          )}

          <div className="mt-4 border-t border-[#7c63ff]/12 pt-3 text-[11px] leading-relaxed text-[#6f6a85] md:mt-auto">
            <span className="hidden md:inline">
              One file of WGSL. Every Hydra source and transform — 55/55
              sketches pixel-identical to hydra-synth, 52 bit-exact. H() locked
              to Strudel&apos;s clock, and a million-agent swarm the old
              machine could never run. The same package paints{" "}
              <a href="https://klappn.com" className={link}>
                klappn.com
              </a>{" "}
              behind the scenes.{" "}
            </span>
            <span className="md:hidden">
              55/55 pixel-identical to hydra-synth · paints{" "}
              <a href="https://klappn.com" className={link}>
                klappn.com
              </a>{" "}
              ·{" "}
            </span>
            <a href="https://github.com/eliyahuleinkram/zissl" className={link}>
              AGPL, on GitHub
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
