"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  NARRATION_SECTIONS,
  SECTION_ID_SET,
  type AudioSection,
} from "./audio-config";

interface UseSectionAudioReturn {
  isPlaying: boolean;
  currentSection: AudioSection | null;
  togglePlay: () => void;
}

export function useSectionAudio(): UseSectionAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSection, setCurrentSection] = useState<AudioSection | null>(
    null
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visibleSectionsRef = useRef<Map<string, number>>(new Map());
  const currentSectionIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const playSection = useCallback(
    (section: AudioSection) => {
      stopAudio();
      const audio = new Audio(section.src);
      audioRef.current = audio;
      setCurrentSection(section);
      currentSectionIdRef.current = section.id;

      audio.addEventListener("ended", () => {
        const idx = NARRATION_SECTIONS.findIndex((s) => s.id === section.id);
        const next = NARRATION_SECTIONS[idx + 1];
        if (next) {
          const el = document.getElementById(next.id);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setCurrentSection(null);
          currentSectionIdRef.current = null;
        }
      });

      audio.play().catch(() => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      });
    },
    [stopAudio]
  );

  const getMostVisibleSection = useCallback((): string | null => {
    let bestId: string | null = null;
    let bestRatio = 0;
    visibleSectionsRef.current.forEach((ratio, id) => {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    });
    return bestId;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (!SECTION_ID_SET.has(id)) return;

          if (entry.isIntersecting) {
            visibleSectionsRef.current.set(id, entry.intersectionRatio);
          } else {
            visibleSectionsRef.current.delete(id);
          }
        });

        if (isPlayingRef.current) {
          let bestId: string | null = null;
          let bestRatio = 0;
          visibleSectionsRef.current.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          });

          if (bestId && bestId !== currentSectionIdRef.current) {
            const section = NARRATION_SECTIONS.find((s) => s.id === bestId);
            if (section) {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
              }
              const audio = new Audio(section.src);
              audioRef.current = audio;
              setCurrentSection(section);
              currentSectionIdRef.current = section.id;

              audio.addEventListener("ended", () => {
                const idx = NARRATION_SECTIONS.findIndex(
                  (s) => s.id === section.id
                );
                const next = NARRATION_SECTIONS[idx + 1];
                if (next) {
                  const el = document.getElementById(next.id);
                  if (el) {
                    el.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                } else {
                  isPlayingRef.current = false;
                  setIsPlaying(false);
                  setCurrentSection(null);
                  currentSectionIdRef.current = null;
                }
              });

              audio.play().catch(() => {
                isPlayingRef.current = false;
                setIsPlaying(false);
              });
            }
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    SECTION_ID_SET.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentSection(null);
      currentSectionIdRef.current = null;
    } else {
      const mostVisible = getMostVisibleSection();
      const section = NARRATION_SECTIONS.find(
        (s) => s.id === (mostVisible || NARRATION_SECTIONS[0].id)
      );
      if (section) {
        isPlayingRef.current = true;
        setIsPlaying(true);

        const audio = new Audio(section.src);
        audioRef.current = audio;
        setCurrentSection(section);
        currentSectionIdRef.current = section.id;

        audio.addEventListener("ended", () => {
          const idx = NARRATION_SECTIONS.findIndex(
            (s) => s.id === section.id
          );
          const next = NARRATION_SECTIONS[idx + 1];
          if (next) {
            const el = document.getElementById(next.id);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } else {
            isPlayingRef.current = false;
            setIsPlaying(false);
            setCurrentSection(null);
            currentSectionIdRef.current = null;
          }
        });

        audio.play().catch(() => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        });
      }
    }
  }, [getMostVisibleSection]);

  return { isPlaying, currentSection, togglePlay };
}
