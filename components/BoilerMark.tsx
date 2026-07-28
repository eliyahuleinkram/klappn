"use client";

import { useId } from "react";

/** THE BOILER ROOM'S MARK — a pressure gauge under steam: the dial, a THICK
 *  hot-zone arc burning up the right side, the needle buried in it. Bold
 *  enough to read at 14px (v1's thin ticks read as a clock — dead). House
 *  gradient; per-instance ids (the SVG gradient law). */
export default function BoilerMark({ className = "h-[16px] w-[16px]" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `boiler${uid}`;
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
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="3" y1="5" x2="21" y2="20">
          <stop offset="0" stopColor="#ff63c1" />
          <stop offset="1" stopColor="#e0319c" />
        </linearGradient>
      </defs>
      {/* the dial */}
      <circle cx="12" cy="12" r="8.7" strokeWidth="1.7" />
      {/* the RED ZONE — a thick arc burning up the top-right quarter */}
      <path d="M13.8 3.7 A8.7 8.7 0 0 1 20.3 12" strokeWidth="3.2" />
      {/* two calm marks on the cold side */}
      <path d="M4.8 9.4l1.7.6M6.2 5.9l1.35 1.15" strokeWidth="1.7" />
      {/* the needle, buried in the hot zone */}
      <path d="M12 12l4.1-4.6" strokeWidth="2.3" />
      <circle cx="12" cy="12" r="1.5" fill={`url(#${g})`} stroke="none" />
    </svg>
  );
}
