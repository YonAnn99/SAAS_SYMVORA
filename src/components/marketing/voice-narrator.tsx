"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSectionAudio } from "./use-section-audio";

export function VoiceNarrator() {
  const { isPlaying, currentSection, togglePlay } = useSectionAudio();
  const t = useTranslations();
  const tAudio = useTranslations("landing.audio");

  return (
    <div className="absolute bottom-[4.75rem] left-5 items-start lg:bottom-5 lg:left-auto lg:right-5 lg:items-end z-[110] flex flex-col gap-2">
      {isPlaying && currentSection && (
        <div
          aria-live="polite"
          className="animate-fade-in-up rounded-lg bg-black/80 dark:bg-white/90 px-3 py-1.5 text-xs font-medium text-white dark:text-black backdrop-blur-sm shadow-lg max-w-[200px] truncate"
        >
          {t(currentSection.labelKey)}
        </div>
      )}

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? tAudio("pause") : tAudio("play")}
        aria-pressed={isPlaying}
        className={`
          group relative h-11 w-11 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.12)]
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${
            isPlaying
              ? "bg-black text-white dark:bg-white dark:text-black scale-110"
              : "bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/10 hover:scale-105 active:scale-95"
          }
        `}
      >
        {isPlaying ? (
          <>
            <VolumeX className="h-4 w-4" />
            <span className="absolute inset-0 rounded-full animate-ping bg-black/20 dark:bg-white/20" />
          </>
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
