"use client";

import { useEffect, useRef } from "react";

interface TutorialSpotlightProps {
  selector: string | null;
  visible: boolean;
}

export function TutorialSpotlight({ selector, visible }: TutorialSpotlightProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!selector || !visible) return;

    const updateOverlay = () => {
      const el = document.querySelector(selector);
      const overlay = overlayRef.current;
      if (!el || !overlay) return;

      const r = el.getBoundingClientRect();
      const pad = 8;
      const top = r.top - pad;
      const left = r.left - pad;
      const width = r.width + pad * 2;
      const height = r.height + pad * 2;

      overlay.style.boxShadow = `0 0 0 9999px rgba(0,0,0,0.5), 0 0 0 4px hsl(var(--primary) / 0.4)`;
      overlay.style.borderRadius = "12px";
      overlay.style.clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${left}px ${top}px, ${left}px ${top + height}px, ${left + width}px ${top + height}px, ${left + width}px ${top}px, ${left}px ${top}px)`;
    };

    updateOverlay();

    const handleUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateOverlay);
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [selector, visible]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[998] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
    />
  );
}
