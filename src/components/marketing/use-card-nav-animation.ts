"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { gsap } from "gsap";

interface CardNavOptions {
  containerRef: RefObject<HTMLElement | null>;
  cardRefs: RefObject<HTMLElement[]>;
  isOpen: boolean;
  onClose?: () => void;
  ease?: string;
  duration?: number;
  stagger?: number;
  breakpoint?: number;
}

export function useCardNavAnimation({
  containerRef,
  cardRefs,
  isOpen,
  onClose,
  ease = "power3.out",
  duration = 0.4,
  stagger = 0.08,
  breakpoint = 1024,
}: CardNavOptions) {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < breakpoint) return;

    const container = containerRef.current;
    const cards = cardRefs.current?.filter(Boolean) ?? [];
    if (!container || cards.length === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const targetHeight = isOpen ? container.scrollHeight : 0;
      gsap.set(container, { height: targetHeight, autoAlpha: isOpen ? 1 : 0 });
      gsap.set(cards, { y: isOpen ? 0 : 50, opacity: isOpen ? 1 : 0 });
      return;
    }

    gsap.set(cards, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(container, {
      height: isOpen ? container.scrollHeight : 0,
      opacity: isOpen ? 1 : 0,
      duration,
      ease,
    });

    tl.to(
      cards,
      {
        y: 0,
        opacity: 1,
        duration,
        ease,
        stagger,
      },
      `-=${duration * 0.25}`
    );

    tl.eventCallback("onReverseComplete", () => {
      onCloseRef.current?.();
    });

    if (isOpen) {
      tl.play(0);
    } else {
      tl.reverse();
    }

    timelineRef.current = tl;

    return () => {
      tl.kill();
      timelineRef.current = null;
    };
  }, [isOpen, ease, duration, stagger, breakpoint, containerRef, cardRefs]);
}
