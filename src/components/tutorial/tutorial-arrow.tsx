"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface TutorialArrowProps {
  selector: string | null;
  visible: boolean;
  /** Where the dialog is positioned relative to target */
  position: "right" | "bottom" | "center";
}

interface ArrowStyle {
  top: number;
  left: number;
  rotation: number;
}

export function TutorialArrow({ selector, visible, position }: TutorialArrowProps) {
  const arrowRef = useRef<HTMLDivElement>(null);
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle | null>(null);

  useLayoutEffect(() => {
    if (!selector || !visible || position === "center") return;

    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setArrowStyle(null);
        return;
      }

      const r = el.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      const centerY = r.top + r.height / 2;

      let top: number;
      let left: number;
      let rotation: number;

      switch (position) {
        case "right":
          // Arrow points left, positioned at the left edge of the dialog
          top = centerY;
          left = r.right + 12;
          rotation = 180; // point left
          break;
        case "bottom":
          // Arrow points up, positioned at the top edge of the dialog
          top = r.bottom + 12;
          left = centerX;
          rotation = 90; // point up
          break;
        default:
          setArrowStyle(null);
          return;
      }

      setArrowStyle({ top, left, rotation });
    };

    measure();

    const raf = { current: 0 };
    const handleUpdate = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [selector, visible, position]);

  if (!visible || !arrowStyle) return null;

  return (
    <div
      ref={arrowRef}
      className="fixed z-[1000] pointer-events-none transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
      style={{
        top: arrowStyle.top,
        left: arrowStyle.left,
        transform: `translate(-50%, -50%) rotate(${arrowStyle.rotation}deg)`,
      }}
    >
      {/* Arrow body */}
      <div
        className="w-3 h-3 bg-primary rotate-45 shadow-[0_2px_8px_rgba(91,159,237,0.4)]"
        style={{ borderRadius: "2px" }}
      />
    </div>
  );
}
