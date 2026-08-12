"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTutorial } from "@/hooks/use-tutorial";
import { tutorialSteps } from "./steps-data";

interface TutorialContextValue {
  currentStep: number;
  isActive: boolean;
  completed: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  totalSteps: number;
  steps: typeof tutorialSteps;
  start: () => void;
  startFromStep: (step: number) => void;
  next: () => void;
  prev: () => void;
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

  return (
    <TutorialContext.Provider
      value={{ ...tutorial, totalSteps: tutorialSteps.length, steps: tutorialSteps }}
    >
      {children}
    </TutorialContext.Provider>
  );
}
