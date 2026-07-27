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
    code: `// one MILLION agents on compute shaders — sensing the picture,
// steering toward light, drawing living filaments over it.
// WebGL Hydra has no compute; this is the new machine talking.
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
        const dims = () => {
          const s = Math.min(window.devicePixelRatio || 1, 1.5);
          return {
            w: Math.min(1600, Math.max(640, Math.floor(window.innerWidth * s))),
            h: Math.min(900, Math.max(360, Math.floor(window.innerHeight * s))),
          };
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

  return (
    <div className="fixed inset-0 bg-[#07070c] text-[#e8e6f2] overflow-hidden font-mono text-[13px] leading-relaxed">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute left-4 bottom-4 md:left-6 md:bottom-6 w-[min(600px,calc(100vw-2rem))] rounded-xl border border-[#7c63ff]/35 bg-[#0a0a10]/85 backdrop-blur-xl p-4">
        <div className="flex items-baseline gap-3 mb-2.5">
          <span className="text-[15px] font-bold tracking-[0.06em] text-[#b9aaff]">zissl</span>
          <span className="text-xs text-[#6f6a85]">
            Hydra&apos;s language, WebGPU&apos;s machine — the sweet counterpart of{" "}
            <a href="https://zaltz.klappn.com" className="underline decoration-[#7c63ff]/50 hover:text-[#b9aaff]">
              zaltz
            </a>
          </span>
        </div>

        {noGpu ? (
          <p className="text-sm text-[#a9a4c0] py-4">
            This page needs WebGPU (Chrome, Edge, Safari 26, Firefox 141+). The
            engine itself degrades gracefully inside Klappn — but the playground
            is the new machine, undiluted.
          </p>
        ) : (
          <>
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
              className="w-full h-[150px] md:h-[170px] resize-y bg-transparent outline-none border-none text-[#e8e6f2]"
              style={{ tabSize: 2 }}
            />
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <button
                onClick={() => run()}
                disabled={!ready}
                className="rounded-md bg-[#7c63ff] px-3.5 py-1.5 text-[#07070c] font-semibold hover:bg-[#9280ff] disabled:opacity-40"
              >
                run
              </button>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setCode(p.code);
                    run(p.code);
                  }}
                  disabled={!ready}
                  className="rounded-md border border-[#7c63ff]/50 px-3 py-1.5 text-[#b9aaff] hover:bg-[#7c63ff]/15 disabled:opacity-40"
                >
                  {p.name}
                </button>
              ))}
              <span className="ml-auto text-xs text-[#6f6a85]">⌘⏎ runs</span>
            </div>
            {err && (
              <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-[#ff8da3]">{err}</pre>
            )}
          </>
        )}

        <div className="mt-3 border-t border-[#7c63ff]/15 pt-2.5 text-xs text-[#6f6a85]">
          One file of WGSL, every Hydra source and transform, H() locked to
          Strudel&apos;s clock — and a million-agent swarm the old machine could
          never run. This same package paints{" "}
          <a href="https://klappn.com" className="underline decoration-[#7c63ff]/50 hover:text-[#b9aaff]">
            klappn.com
          </a>{" "}
          behind the scenes.{" "}
          <a
            href="https://github.com/eliyahuleinkram/zissl"
            className="underline decoration-[#7c63ff]/50 hover:text-[#b9aaff]"
          >
            AGPL, on GitHub
          </a>
          .
        </div>
      </div>
    </div>
  );
}
