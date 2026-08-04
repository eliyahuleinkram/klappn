"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * THE DISMISS LAW — one way out of everything (2026-08-04c, the user: "we click
 * buttons and they do not behave in a consistent way… tap on a pill, tap it
 * again to close it").
 *
 * Every temporary thing in this app — an anchored menu, a picker that blooms on
 * a seam, a sheet, a composer — closes THE SAME THREE WAYS, everywhere:
 *
 *   1. TAP THE THING THAT OPENED IT. Its trigger is a toggle, always. A hand
 *      that opened something reaches back for the same button; it must not have
 *      to hunt for an ✕ it didn't need on the way in.
 *   2. TAP OUTSIDE IT. `<Scrim>` is the one catcher — it also sits ABOVE the
 *      trigger, so a second tap on the trigger lands here and closes once
 *      (never close-then-reopen, which is what "inconsistent" actually feels
 *      like under a finger).
 *   3. ESCAPE. And Escape closes the INNERMOST open thing only — a menu inside
 *      a sheet gives way first, the sheet survives, and one key never wipes the
 *      whole screen.
 *
 * The stack is module-level on purpose: overlays open across unrelated
 * components (a loop card's ⋯ over the page's Shape card), and "innermost" is a
 * fact about the screen, not about any one tree.
 */

const stack: { close: () => void }[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  // A field that is mid-composition owns its own Escape first (clear the text,
  // then leave) — it says so by preventing the default.
  if (e.defaultPrevented) return;
  e.preventDefault();
  stack[stack.length - 1].close();
}

/**
 * Arm Escape for an overlay while it is open. `onClose` may change every render
 * — only `open` re-registers, so the stack order is the order things OPENED,
 * which is the order a hand expects to unwind them.
 */
export function useDismiss(open: boolean, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => latest.current() };
    stack.push(entry);
    if (stack.length === 1)
      window.addEventListener("keydown", onKeyDown);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0)
        window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}

/**
 * THE OUTSIDE — an invisible full-screen catcher. Mount it beside an open card
 * and the overlay gets outside-tap AND Escape at once; that is the whole
 * contract.
 *
 * IT IS ALWAYS THE WHOLE SCREEN (2026-08-04c, measured, not assumed). Written
 * in place, `fixed inset-0` is a lie the moment ANY ancestor carries a
 * transform — a CSS animation that so much as touches translate makes that
 * element the containing block, and the "full-screen" catcher shrinks to the
 * row it was written in. The song's seam capsule sat inside `animate-fade-in`
 * and its catcher measured 504×50: tapping the page did nothing, while every
 * other menu on the same screen closed. So the catcher goes through a PORTAL to
 * <body>, where no ancestor can shrink it, and the law holds by construction
 * instead of by everyone remembering.
 *
 * The price of the portal is paint order: the catcher now sits in the page's
 * own stacking context, so the card it guards must ALSO be above `z` there. For
 * cards that already open at z-20 under a plain `relative` parent, that is
 * free. For a card living inside a transformed wrapper, put the z on the
 * WRAPPER (`relative z-20`) — the wrapper is what the page can see.
 */
export function Scrim({
  onClose,
  z = "z-10",
}: {
  onClose: () => void;
  /** Tailwind z-index class for the catcher — one step under its card. */
  z?: string;
}) {
  useDismiss(true, onClose);
  // The portal target only exists in the browser; the first client paint mounts
  // it (a scrim has nothing to say to the server anyway).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(
    <div className={`fixed inset-0 ${z}`} onClick={onClose} aria-hidden />,
    document.body,
  );
}
