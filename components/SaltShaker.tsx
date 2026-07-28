"use client";

import { useId } from "react";

/** THE SALT SHAKER — the house object, drawn not written: an UPRIGHT glass
 *  shaker you'd recognise on any table (user 07-27: it must LITERALLY look
 *  like one) — turned-steel cap with punched holes, glass body carrying
 *  light, a settled bed of salt, one kiss of the brand pink on the rim.
 *  Extracted 2026-07-28: it is the door to the live room from EVERY surface
 *  (the desk's FAB, klappn.com's brand bar, the signed-out door), so the ids
 *  are per-instance (the SVG gradient law — a shared def id resolves into the
 *  first, possibly hidden, twin and the visible mark loses its paint). */
export default function SaltShaker({ className = "h-7 w-7" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cap = `zsCap${uid}`;
  const glass = `zsGlass${uid}`;
  const salt = `zsSalt${uid}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={cap} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2f4f8" />
          <stop offset="0.45" stopColor="#c3c7d1" />
          <stop offset="1" stopColor="#8b8f9c" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="0.55" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
        </linearGradient>
        <linearGradient id={salt} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.98)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.72)" />
        </linearGradient>
      </defs>
      {/* cap — turned steel, cinched to screw onto the neck */}
      <path
        d="M9 6.4 L9.35 3.7 C9.48 2.72 10.32 2 11.31 2 L12.69 2 C13.68 2 14.52 2.72 14.65 3.7 L15 6.4 Z"
        fill={`url(#${cap})`}
      />
      {/* the specular sliver — the lathe's own light */}
      <path
        d="M10.1 2.6 L9.7 5.9"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3.5" r="0.52" fill="#2e3138" />
      <circle cx="10.75" cy="4.8" r="0.52" fill="#2e3138" />
      <circle cx="13.25" cy="4.8" r="0.52" fill="#2e3138" />
      {/* the neck's shadow line under the cap */}
      <path d="M9 6.4 L15 6.4" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      {/* the glass — flaring gently to a rounded foot, carrying light down */}
      <path
        d="M8.9 7.3 L15.1 7.3 L16.3 18.9 C16.46 20.45 15.25 21.8 13.7 21.8 L10.3 21.8 C8.75 21.8 7.54 20.45 7.7 18.9 Z"
        fill={`url(#${glass})`}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* the salt — a settled bed with depth, loose grains still in the air */}
      <path
        d="M8.4 13.8 L15.6 13.8 L16.05 18.9 C16.15 19.95 15.3 20.85 13.7 20.85 L10.3 20.85 C8.7 20.85 7.85 19.95 7.95 18.9 Z"
        fill={`url(#${salt})`}
      />
      <circle cx="10.5" cy="11.9" r="0.55" fill="rgba(255,255,255,0.85)" />
      <circle cx="13.1" cy="10.7" r="0.5" fill="rgba(255,255,255,0.7)" />
      <circle cx="11.9" cy="12.8" r="0.45" fill="rgba(255,255,255,0.6)" />
      {/* the long specular streak — glass answering the room's light */}
      <path
        d="M9.85 8.3 L9.35 18.2"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {/* one kiss of the brand on the right rim — salt lives in the brand */}
      <path
        d="M14.6 8.6 L15.35 15.6"
        stroke="rgba(255,99,193,0.5)"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
