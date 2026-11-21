"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NARRATION_SECTIONS,
  type AudioSection,
} from "./audio-config";

interface UseSectionAudioReturn {
  isPlaying: boolean;
  currentSection: AudioSection | null;
  togglePlay: () => void;
}

const SCROLL_ROOT_SELECTOR = "[data-audio-scroll-root]";
const READING_LINE_RATIO = 0.45;

/**
 * Devuelve la sección narrada que está cruzando la línea de lectura del
 * contenedor. Se usa geometría, no solo el porcentaje visible, porque algunas
 * secciones son muy altas y podrían "ocultar" a la siguiente durante mucho
 * tiempo si se eligiera la de mayor área.
 */
function getActiveSectionId(root: HTMLElement | null): string | null {
  const rootRect = root?.getBoundingClientRect();
  const readingLine = rootRect
    ? rootRect.top + rootRect.height * READING_LINE_RATIO
    : window.innerHeight * READING_LINE_RATIO;

  let activeId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const section of NARRATION_SECTIONS) {
    const element = document.getElementById(section.id);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    if (rect.height === 0) continue;

    const distance =
      readingLine < rect.top
        ? rect.top - readingLine
        : readingLine > rect.bottom
          ? readingLine - rect.bottom
          : 0;

    if (distance < bestDistance) {
      bestDistance = distance;
      activeId = section.id;
    }
  }

  return activeId;
}

export function useSectionAudio(): UseSectionAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSection, setCurrentSection] = useState<AudioSection | null>(
    null
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSectionIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const resetSession = useCallback(() => {
    stopAudio();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentSection(null);
    currentSectionIdRef.current = null;
  }, [stopAudio]);

  const playSection = useCallback(
    (section: AudioSection) => {
      if (currentSectionIdRef.current === section.id) return;

      stopAudio();

      const audio = new Audio();
      audio.preload = "none";
      audio.src = section.src;
      audioRef.current = audio;

      isPlayingRef.current = true;
      setIsPlaying(true);
      setCurrentSection(section);
      currentSectionIdRef.current = section.id;

      const handleEnded = () => {
        if (audioRef.current !== audio) return;

        const index = NARRATION_SECTIONS.findIndex(
          (candidate) => candidate.id === section.id
        );
        const next = NARRATION_SECTIONS[index + 1];
        const nextElement = next
          ? document.getElementById(next.id)
          : null;

        audioRef.current = null;

        if (!next || !nextElement) {
          resetSession();
          return;
        }

        nextElement.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      const handleError = () => {
        if (audioRef.current === audio) resetSession();
      };

      audio.addEventListener("ended", handleEnded, { once: true });
      audio.addEventListener("error", handleError, { once: true });

      audio.play().catch(() => {
        if (audioRef.current === audio) resetSession();
      });
    },
    [resetSession, stopAudio]
  );

  useEffect(() => {
    if (!document.getElementById("hero-landing")) return;

    const root = document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
    const observer = new IntersectionObserver(
      () => {
        if (!isPlayingRef.current) return;

        const activeId = getActiveSectionId(root);
        if (!activeId || activeId === currentSectionIdRef.current) return;

        const section = NARRATION_SECTIONS.find(
          (candidate) => candidate.id === activeId
        );
        if (section) playSection(section);
      },
      {
        root,
        rootMargin: "-40% 0px -50% 0px",
        threshold: 0,
      }
    );

    for (const section of NARRATION_SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => {
      observer.disconnect();
      stopAudio();
      isPlayingRef.current = false;
      currentSectionIdRef.current = null;
    };
  }, [playSection, stopAudio]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      resetSession();
      return;
    }

    const root = document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
    const activeId = getActiveSectionId(root);
    const section = NARRATION_SECTIONS.find(
      (candidate) => candidate.id === activeId
    );

    if (section) playSection(section);
  }, [playSection, resetSession]);

  return { isPlaying, currentSection, togglePlay };
}
