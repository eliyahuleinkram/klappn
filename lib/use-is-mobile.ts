"use client";

import { useEffect, useState } from "react";

/**
 * True on phone-width screens (≤640px). SSR-safe: renders false on the server
 * and the first client paint, then corrects on mount — so it never mismatches
 * hydration. Used to drop UI that's meaningless on mobile (e.g. the Hydra
 * visuals panel + full-screen Immerse — visuals don't run on phones).
 */
export function useIsMobile(query = "(max-width: 640px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return isMobile;
}
