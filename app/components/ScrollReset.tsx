"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The app scrolls inside #app-scroll rather than the document (see globals.css
 * — that's what keeps Safari's toolbar, and with it the tab bar, still). Next
 * only resets the DOCUMENT's scroll position on navigation, so the shell has
 * to reset its own: without this, opening a page after scrolling another
 * starts you halfway down.
 */
function ScrollResetInner() {
  const path = usePathname();
  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo(0, 0);
  }, [path]);
  return null;
}

export function ScrollReset() {
  return (
    <Suspense fallback={null}>
      <ScrollResetInner />
    </Suspense>
  );
}
