"use client";

import { useEffect } from "react";

export interface ToastProps {
  message: string | null;
  onDone: () => void;
  ms?: number;
}

/** One line over the scene that says what just went wrong, then goes away. */
export function Toast({ message, onDone, ms = 4200 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, onDone, ms]);
  if (!message) return null;
  return (
    <div role="status" className="scr-toast" key={message}>
      {message}
    </div>
  );
}
