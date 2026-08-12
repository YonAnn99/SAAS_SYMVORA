"use client";

import { useTranslations } from "next-intl";
import { useTutorialContext } from "./tutorial-provider";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function TutorialTrigger() {
  const t = useTranslations();
  const { start, completed, isActive } = useTutorialContext();

  // Don't show if tutorial is currently active
  if (isActive) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={completed ? undefined : start}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      title={completed ? t("tutorial.replayHelp") : t("tutorial.startHelp")}
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden md:inline">
        {completed ? t("tutorial.replayHelp") : t("tutorial.startHelp")}
      </span>
    </Button>
  );
}
