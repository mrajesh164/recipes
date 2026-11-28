"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./icons";

/**
 * A way back up from the bottom of a long list.
 *
 * Browse shows 120 tiles and loads 120 more at a time, so the page can get
 * genuinely long -- and the filter, the sort and the jump links all live at
 * the top, which means every change of mind is a scroll back. Fixed to the
 * corner rather than placed at the end of the list, because the point is to
 * leave from the middle.
 *
 * Hidden until there is something to go back to. A control that does nothing
 * is worse than no control, and at the top of the page this one does nothing.
 */
export function BackToTop({ showAfter = 700 }: { showAfter?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > showAfter);
    onScroll();
    // passive: this listener never calls preventDefault, and saying so lets
    // the browser scroll without waiting to find out.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border-2
                 border-clay-deep bg-paper px-4 py-3 text-sm font-semibold text-clay-deep
                 shadow-sm transition-colors hover:bg-cream-deep
                 motion-safe:animate-none"
    >
      <ArrowUpIcon />
      Top
    </button>
  );
}
