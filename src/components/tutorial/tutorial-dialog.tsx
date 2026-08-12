"use client";

import { useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTutorialContext } from "./tutorial-provider";
import { TutorialProgress } from "./tutorial-progress";
import { TutorialArrow } from "./tutorial-arrow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, X, Sparkles, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export function TutorialDialog() {
  const t = useTranslations();
  const router = useRouter();
  const {
    currentStep,
    isActive,
    isFirstStep,
    isLastStep,
    progress,
    totalSteps,
    currentStepData,
    waitingForRoute,
    next,
    prev,
    minimize,
    skip,
  } = useTutorialContext();

  const step = currentStepData;
  const Icon = step?.icon ?? Sparkles;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const isCentered = !step?.targetSelector || step.position === "center";
  const needsNavigation = !!(step?.navigates && step?.route);
  const showWaiting = waitingForRoute && needsNavigation;

  // Measure target element and position dialog after DOM update
  useLayoutEffect(() => {
    if (isCentered) return;

    const measure = () => {
      const el = step?.targetSelector ? document.querySelector(step.targetSelector) : null;
      if (!el) {
        setPos(null);
        return;
      }

      const r = el.getBoundingClientRect();
      const dialogWidth = 380;
      const dialogHeight = showWaiting ? 240 : 320;
      const gap = 24;

      let top: number;
      let left: number;

      switch (step.position) {
        case "right":
          top = r.top + r.height / 2 - dialogHeight / 2;
          left = r.right + gap;
          if (left + dialogWidth > window.innerWidth - 16) {
            left = r.left - dialogWidth - gap;
          }
          break;
        case "bottom":
          top = r.bottom + gap;
          left = r.left + r.width / 2 - dialogWidth / 2;
          break;
        default:
          top = window.innerHeight / 2 - dialogHeight / 2;
          left = window.innerWidth / 2 - dialogWidth / 2;
      }

      top = Math.max(16, Math.min(top, window.innerHeight - dialogHeight - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - dialogWidth - 16));

      setPos({ top, left });
    };

    measure();
  }, [step, currentStep, isCentered, showWaiting]);

  const handleGoToModule = () => {
    if (needsNavigation) {
      router.push(step.route);
    }
  };

  const handleClose = () => {
    minimize();
  };

  const handleNext = () => {
    if (showWaiting) return;
    next(needsNavigation && !showWaiting);
  };

  if (!step) return null;

  return (
    <>
      {/* Arrow pointing to the target element */}
      {!isCentered && (
        <TutorialArrow
          selector={step.targetSelector}
          visible={isActive}
          position={step.position}
        />
      )}

      <Dialog open={isActive} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          noBlur
          showCloseButton={false}
          className={cn(
            "sm:max-w-[380px] p-0 gap-0 overflow-hidden",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-1",
            "duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            !isCentered && "fixed z-[999]"
          )}
          style={
            !isCentered && pos
              ? {
                  top: pos.top,
                  left: pos.left,
                  transform: "none",
                  translate: "none",
                }
              : undefined
          }
        >
          {/* Header with icon and step counter */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-primary/5 px-5 pt-4 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.3)]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                {t(step.titleKey)}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("tutorial.stepOf", { current: currentStep + 1, total: totalSteps })}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              aria-label={t("tutorial.skip")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-5 py-2">
            <TutorialProgress
              current={currentStep}
              total={totalSteps}
              progress={progress}
            />
          </div>

          {/* Content: waiting state or description */}
          <div className="px-5 py-3">
            {showWaiting ? (
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Navigation className="h-5 w-5 animate-bounce" />
                </div>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {t("tutorial.waitingDescription", {
                    module: t(step.moduleKey),
                  })}
                </DialogDescription>
              </div>
            ) : (
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {t(step.descriptionKey)}
              </DialogDescription>
            )}
          </div>

          {/* Footer with navigation */}
          <DialogFooter className="px-5 py-3 bg-muted/30 border-t border-border/50">
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prev}
                disabled={isFirstStep}
                className="gap-1.5 text-muted-foreground disabled:opacity-30"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("common.back")}
              </Button>

              <div className="flex items-center gap-2">
                {!isLastStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skip}
                    className="text-muted-foreground"
                  >
                    {t("tutorial.skip")}
                  </Button>
                )}
                {showWaiting ? (
                  <Button
                    size="sm"
                    onClick={handleGoToModule}
                    className="gap-1.5 shadow-[0_2px_8px_rgba(91,159,237,0.25)] active:scale-[0.97] transition-transform duration-150"
                  >
                    {t("tutorial.goToModule", { module: t(step.moduleKey) })}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="gap-1.5 shadow-[0_2px_8px_rgba(91,159,237,0.25)] active:scale-[0.97] transition-transform duration-150"
                  >
                    {isLastStep ? t("tutorial.finish") : t("common.next")}
                    {!isLastStep && <ArrowRight className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
