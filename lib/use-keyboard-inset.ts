"use client";

import { useEffect, useState } from "react";

/**
 * Px of the layout viewport currently covered by the on-screen keyboard
 * (0 while it's closed).
 *
 * Phones OVERLAY the keyboard instead of shrinking the layout viewport
 * (iOS Safari always; Android Chrome by default), so `position: fixed;
 * bottom: 0` UI disappears BEHIND the keyboard the moment a field focuses —
 * on the song page you'd be typing an edit request into a bar you can't see.
 * The visual viewport is the part that actually remains visible; lift
 * bottom-docked surfaces by this inset while it's up.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // Small deltas are browser chrome (URL bar collapse), not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
