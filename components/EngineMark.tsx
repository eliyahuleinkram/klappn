"use client";

import { useId } from "react";

/** THE ENGINE'S MARK (2026-07-29) — a ROTOR: the Reuleaux triangle of a
 *  Wankel, with the eccentric shaft knocked out of its middle.
 *
 *  It replaced a piston assembly (bore + slug + rod + crank throw + pin) that
 *  was five hairlines pretending to be a drawing: correct machinery, and a
 *  smudge at 16px. One glyph, one meaning — so this is ONE closed shape,
 *  filled, no strokes to thin out. A rotor is unmistakably an engine to anyone
 *  who knows engines and confident geometry to everyone who doesn't, and its
 *  curved-triangle silhouette is unlike anything else in a browser chrome (a
 *  circle reads as a clock, a triangle reads as play).
 *
 *  The hole is knocked through with fill-rule evenodd rather than painted over,
 *  so the mark carries the page's own background and never assumes a dark one.
 *  Arc geometry is exact: vertices on r=9.4, each arc centred on the opposite
 *  vertex with radius = side = r√3 (which is also the shape's constant width).
 *  It is nudged DOWN by 0.134r — a Reuleaux triangle's bounding box does not
 *  centre on its circumcircle, and left alone the mark floats with a gap under
 *  it. The bore sits on the true centroid, not the box centre. House gradient, per-instance ids — two
 *  marks on one page must never share a def. */
export default function EngineMark({ className = "h-[16px] w-[16px]" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `engine${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="5" y1="3" x2="19" y2="21">
          <stop offset="0" stopColor="#ff63c1" />
          <stop offset="1" stopColor="#e0319c" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.86A16.28 16.28 0 0 1 20.14 17.96A16.28 16.28 0 0 1 3.86 17.96A16.28 16.28 0 0 1 12 3.86ZM15 13.26a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z"
        fill={`url(#${g})`}
        fillRule="evenodd"
        stroke="none"
      />
    </svg>
  );
}
