"use client";

import { useState } from "react";
import { GITHUB_URL, ZALTZ_GITHUB_URL, ZISSL_GITHUB_URL } from "@/lib/links";

/**
 * THE CODE DOOR — one GitHub glyph, the whole machine behind it (2026-07-28,
 * user: a bare zaltz link on a Klappn page read wrong). Three names, one
 * machine, each with its own line — tap a row, read the source. Same glass
 * menu anatomy as AccountMenu (one dropdown idiom in the house).
 */
const REPOS: { name: string; line: string; href: string }[] = [
  { name: "Klappn", line: "the studio — every prompt, face up", href: GITHUB_URL },
  { name: "zaltz", line: "the audio engine — sound, byte by byte", href: ZALTZ_GITHUB_URL },
  { name: "zissl", line: "the light — a million-agent swarm", href: ZISSL_GITHUB_URL },
];

export default function OpenSourceMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Open source — the whole machine, face up"
        aria-label="Open source"
        aria-expanded={open}
        className={`px-1 transition active:scale-[.95] ${
          open ? "text-foreground" : "text-muted/70 hover:text-foreground"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/95 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-xl">
            <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted/50">
              Three names, one machine
            </div>
            {REPOS.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 transition hover:bg-white/[0.05]"
              >
                <span className="text-[13px] font-medium text-foreground/90">
                  {r.name}
                </span>
                <span className="block text-[11.5px] leading-snug text-muted/60">
                  {r.line}
                </span>
              </a>
            ))}
            <a
              href="/open"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-xl border-t border-white/[0.06] px-3 py-2 text-[12px] text-muted/70 transition hover:bg-white/[0.05] hover:text-foreground"
            >
              Open, all the way down →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
