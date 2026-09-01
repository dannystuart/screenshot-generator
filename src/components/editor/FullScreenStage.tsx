"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * A box the size of the window, with the page behind it held still.
 *
 * The editor fills whatever container it is given and never touches the
 * document. This is the caller that asks for the whole screen, and the only
 * place the scroll lock lives — added as a class so other routes under the same
 * layout still scroll.
 */
export function FullScreenStage({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("scr-locked");
    return () => root.classList.remove("scr-locked");
  }, []);

  return (
    <main id="main-content" className="fixed inset-0 overflow-hidden">
      {children}
    </main>
  );
}
