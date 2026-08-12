"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useTutorial } from "@/hooks/use-tutorial";
import { tutorialSteps, type TutorialStep } from "./steps-data";

interface TutorialContextValue {
  currentStep: number;
  isActive: boolean;
  completed: boolean;
  minimized: boolean;
  waitingForRoute: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  totalSteps: number;
  steps: TutorialStep[];
  currentStepData: TutorialStep | undefined;
  start: () => void;
  startFromStep: (step: number) => void;
  resume: () => void;
  next: (waitForRoute?: boolean) => void;
  onRouteReady: () => void;
  prev: () => void;
  minimize: () => void;
  skip: () => void;
  reset: () => void;
  goToStep: (step: number) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorialContext() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorialContext must be used within TutorialProvider");
  }
  return ctx;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const tutorial = useTutorial(tutorialSteps.length);
  const pathname = usePathname();
  const stepData = tutorialSteps[tutorial.currentStep];

  // Auto-detect when user arrives at the target route
  useEffect(() => {
    if (!tutorial.isActive || !tutorial.waitingForRoute || !stepData) return;

    if (pathname.includes(stepData.route)) {
      tutorial.onRouteReady();
    }
  }, [pathname, tutorial, stepData]);

  return (
    <TutorialContext.Provider
      value={{
        ...tutorial,
        totalSteps: tutorialSteps.length,
        steps: tutorialSteps,
        currentStepData: stepData,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}
