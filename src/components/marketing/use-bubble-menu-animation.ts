"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

interface BubbleMenuOptions {
  containerRef: RefObject<HTMLElement | null>;
  itemRefs: RefObject<HTMLElement[]>;
  labelRefs: RefObject<HTMLElement[]>;
  isOpen: boolean;
  ease?: gsap.EaseFunction | string;
  duration?: number;
  staggerDelay?: number;
}

export function useBubbleMenuAnimation({
  containerRef,
  itemRefs,
  labelRefs,
  isOpen,
  ease = "back.out(1.5)",
  duration = 0.5,
  staggerDelay = 0.12,
}: BubbleMenuOptions) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1024) return;

    const container = containerRef.current;
    const items = itemRefs.current?.filter(Boolean) ?? [];
    const labels = labelRefs.current?.filter(Boolean) ?? [];
    if (!container || items.length === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(container, { autoAlpha: isOpen ? 1 : 0 });
      return;
    }

    if (isOpen) {
      gsap.set(container, { autoAlpha: 1 });
      gsap.killTweensOf([...items, ...labels]);
      gsap.set(items, { scale: 0, transformOrigin: "50% 50%" });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      items.forEach((item, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });
        tl.to(item, { scale: 1, duration, ease });
        if (labels[i]) {
          tl.to(
            labels[i],
            { y: 0, autoAlpha: 1, duration, ease: "power3.out" },
            `-=${duration * 0.9}`
          );
        }
      });
    } else {
      gsap.killTweensOf([...items, ...labels]);
      gsap.to(labels, { y: 24, autoAlpha: 0, duration: 0.2, ease: "power3.in" });
      gsap.to(items, {
        scale: 0,
        duration: 0.2,
        ease: "power3.in",
        onComplete: () => gsap.set(container, { autoAlpha: 0 }),
      });
    }
  }, [isOpen, ease, duration, staggerDelay, containerRef, itemRefs, labelRefs]);
}
