"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSectionAudio } from "./use-section-audio";

export function VoiceNarrator() {
  const { isPlaying, currentSection, togglePlay } = useSectionAudio();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {isPlaying && currentSection && (
        <div className="animate-fade-in-up rounded-lg bg-black/80 dark:bg-white/90 px-3 py-1.5 text-xs font-medium text-white dark:text-black backdrop-blur-sm shadow-lg max-w-[200px] truncate">
          {currentSection.label}
        </div>
      )}

      <button
        onClick={togglePlay}
        className={`
          group relative h-12 w-12 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${
            isPlaying
              ? "bg-black text-white dark:bg-white dark:text-black scale-110"
              : "bg-white text-black dark:bg-neutral-800 dark:text-white hover:scale-110 hover:shadow-xl"
          }
        `}
        aria-label={isPlaying ? "Pausar narración" : "Narrar esta sección"}
      >
        {isPlaying ? (
          <>
            <VolumeX className="h-5 w-5" />
            <span className="absolute inset-0 rounded-full animate-ping bg-black/20 dark:bg-white/20" />
          </>
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
