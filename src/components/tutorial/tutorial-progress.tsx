"use client";

import { useTranslations } from "next-intl";

interface TutorialProgressProps {
  current: number;
  total: number;
  progress: number;
}

export function TutorialProgress({ current, total, progress }: TutorialProgressProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-250 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {t("tutorial.progress", { current: current + 1, total })}
      </span>
    </div>
  );
}
