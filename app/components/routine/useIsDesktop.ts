"use client";

import { useEffect, useState } from "react";

// Drives the Full Routine view's grid-on-desktop / list-on-mobile switch.
// Defaults to true so server/client first paint match (no window at SSR
// time); the effect corrects it immediately after mount and keeps tracking
// the breakpoint live as the window is resized.
export function useIsDesktop(breakpoint = 768): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isDesktop;
}
