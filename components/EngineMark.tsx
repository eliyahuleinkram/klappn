"use client";

import { useId } from "react";

/** THE ENGINE'S MARK (2026-07-29, replacing the boiler room's pressure gauge)
 *  — a PISTON at the top of its stroke. The bore, the rod, and the crank
 *  throw: the smallest drawing that still says "something is being driven".
 *
 *  It reads as an engine at 14px because the silhouette is asymmetric — a
 *  filled slug high in a hollow bore, weight up top, the throw swinging off
 *  the bottom left. (A circle with spokes reads as a wheel or a clock; the
 *  gauge it replaces had exactly that problem.) House gradient, and
 *  per-instance gradient ids — the SVG law: two marks on one page must never
 *  share a def. */
export default function EngineMark({ className = "h-[16px] w-[16px]" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `engine${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${g})`}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="5" y1="3" x2="19" y2="21">
          <stop offset="0" stopColor="#ff63c1" />
          <stop offset="1" stopColor="#e0319c" />
        </linearGradient>
      </defs>
      {/* the bore — open at the top, so the piston reads as travelling INTO it */}
      <path d="M6.6 3.2v9.4a5.4 5.4 0 0 0 10.8 0V3.2" strokeWidth="1.7" />
      {/* the piston itself: a solid slug at the top of the stroke */}
      <rect x="8.4" y="5" width="7.2" height="3.5" rx="1.1" fill={`url(#${g})`} stroke="none" />
      {/* the rod, dropping out of the slug */}
      <path d="M12 8.5v6.6" strokeWidth="2.1" />
      {/* the crank throw — the swing that turns the stroke into rotation */}
      <path d="M12 15.1 7.7 19.2" strokeWidth="2.1" />
      <circle cx="6.5" cy="20.4" r="1.45" fill={`url(#${g})`} stroke="none" />
    </svg>
  );
}
