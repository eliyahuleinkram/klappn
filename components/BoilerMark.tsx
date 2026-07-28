"use client";

import { useId } from "react";

/** THE BOILER ROOM'S MARK — a machined pressure gauge: the needle leaning
 *  into the red, the room under steam. Same family as the nav's ticket and
 *  headphones (gradient stroke, 1.8, round caps); per-instance gradient ids
 *  (the SVG gradient law — a shared def id loses its paint to a hidden twin). */
export default function BoilerMark({ className = "h-[16px] w-[16px]" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `boiler${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${g})`}
      strokeWidth="1.8"
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
      <circle cx="12" cy="12" r="8.4" />
      {/* the marks — low · noon · hot */}
      <path d="M5.6 15.4l1.55-.75M12 5.4v1.8M18.4 15.4l-1.55-.75" />
      {/* the needle, leaning hot */}
      <path d="M12 12l3.4-3.4" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.15" fill={`url(#${g})`} stroke="none" />
    </svg>
  );
}
