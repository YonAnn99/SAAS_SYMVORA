"use client";

import { useTranslations } from "next-intl";
import { useTutorialContext } from "./tutorial-provider";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function TutorialMinimized() {
  const t = useTranslations();
  const { minimized, currentStep, totalSteps, resume, completed, isActive } = useTutorialContext();

  if (completed || isActive || !minimized) return null;

  const nextStep = currentStep + 1;

  return (
    <div className="fixed bottom-6 right-6 z-[997] animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]">
      <Button
        onClick={resume}
        size="sm"
        className="gap-2 rounded-full shadow-[0_4px_24px_rgba(91,159,237,0.35)] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-transform duration-150 pl-4 pr-5 h-11"
      >
        <Play className="h-4 w-4 fill-current" />
        <span className="text-sm font-medium">
          {t("tutorial.continueTutorial")} ({nextStep}/{totalSteps})
        </span>
      </Button>
    </div>
  );
}
