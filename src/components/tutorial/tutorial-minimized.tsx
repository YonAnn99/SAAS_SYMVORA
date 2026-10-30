"use client";

import { useTranslations } from "next-intl";
import { useTutorialContext } from "./tutorial-provider";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { stripLocale } from "@/lib/navigation";

export function TutorialMinimized() {
  const t = useTranslations();
  const { minimized, currentStep, totalSteps, resume, completed, isActive } = useTutorialContext();
  // Por debajo de lg se apila encima del botón flotante "+" del dock
  // (`BOTON_MAS` en dock-movil.tsx: 56 px de alto), que en el POS va más arriba.
  const enPos = stripLocale(usePathname()) === "/pos";

  if (completed || isActive || !minimized) return null;

  const nextStep = currentStep + 1;

  return (
    <div
      className={cn(
        "fixed right-4 z-[997] animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:bottom-20 lg:right-6",
        enPos
          ? "bottom-[calc(4rem+env(safe-area-inset-bottom)+9.25rem)]"
          : "bottom-[calc(4rem+env(safe-area-inset-bottom)+5.25rem)]"
      )}
    >
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
