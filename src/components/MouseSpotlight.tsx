"use client";

import { useEffect } from "react";

/**
 * Fixed-position cinematic spotlight that follows the cursor. Sets two CSS
 * custom properties on <html> so any element can react to cursor position.
 *
 * Disables itself on touch-only devices and respects prefers-reduced-motion.
 */
export default function MouseSpotlight() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (reduced || isTouch) return;

    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const root = document.documentElement;

    const update = () => {
      root.style.setProperty("--mouse-x", `${lastX}px`);
      root.style.setProperty("--mouse-y", `${lastY}px`);
      raf = 0;
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div aria-hidden className="mouse-spotlight" />;
}
