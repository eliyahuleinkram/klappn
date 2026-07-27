"use client";

/**
 * ZISSL-FIRST — the one gate every visual boot path asks before choosing its
 * renderer. zissl is our own engine (Hydra's synth language rebuilt on
 * WebGPU — github.com/eliyahuleinkram/zissl, the sweet counterpart of zaltz):
 * same vocabulary, same H() bridge, plus the compute layer (swarm) WebGL
 * never had. hydra-synth stays as the fallback for browsers without WebGPU,
 * so nobody loses the picture.
 *
 * Kill switches (support levers, not features): `?zissl=0` on the URL or
 * localStorage klappnZissl="0" force the hydra-synth path for a session —
 * the first thing to try if a machine's WebGPU driver misbehaves.
 */
export function zisslAllowed(): boolean {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    if (new URLSearchParams(window.location.search).get("zissl") === "0") return false;
    if (localStorage.getItem("klappnZissl") === "0") return false;
  } catch {
    /* storage may be walled off — WebGPU presence alone decides */
  }
  return true;
}

/** The exact canvas @strudel/draw's getDrawContext would have made — same id,
 *  same styling — so every existing show/hide/resize/CSS path is none the
 *  wiser about which engine paints it. */
export function ensureVisualCanvas(id = "hydra-canvas", pixelRatio = 1): HTMLCanvasElement {
  let canvas = document.getElementById(id) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = id;
    canvas.width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
    canvas.style.cssText =
      "pointer-events:none;width:100%;height:100%;position:fixed;top:0;left:0";
    document.body.prepend(canvas);
  }
  return canvas;
}
