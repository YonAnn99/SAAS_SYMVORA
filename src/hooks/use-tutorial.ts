"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY_COMPLETED = "symvora_tutorial_completed";
const STORAGE_KEY_STEP = "symvora_tutorial_step";

function getStoredStep(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(STORAGE_KEY_STEP);
  return stored ? parseInt(stored, 10) : 0;
}

function isCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY_COMPLETED) === "true";
}

function getInitialStep(): number {
  if (typeof window === "undefined") return 0;
  if (isCompleted()) return 0;
  return getStoredStep();
}

function getInitialActive(): boolean {
  if (typeof window === "undefined") return false;
  if (isCompleted()) return false;
  const step = getStoredStep();
  return step > 0;
}

export function useTutorial(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [isActive, setIsActive] = useState(getInitialActive);
  const [completed, setCompleted] = useState(isCompleted);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.setItem(STORAGE_KEY_STEP, "0");
  }, []);

  const startFromStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
      setIsActive(true);
    },
    [totalSteps]
  );

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      const nextStep = Math.min(prev + 1, totalSteps - 1);
      localStorage.setItem(STORAGE_KEY_STEP, String(nextStep));
      if (nextStep >= totalSteps - 1) {
        localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
        setCompleted(true);
        setTimeout(() => setIsActive(false), 300);
      }
      return nextStep;
    });
  }, [totalSteps]);

  const prev = useCallback(() => {
    setCurrentStep((prev) => {
      const prevStep = Math.max(prev - 1, 0);
      localStorage.setItem(STORAGE_KEY_STEP, String(prevStep));
      return prevStep;
    });
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
    setCompleted(true);
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsActive(false);
    setCompleted(false);
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_STEP);
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(0, Math.min(step, totalSteps - 1));
      setCurrentStep(clamped);
      localStorage.setItem(STORAGE_KEY_STEP, String(clamped));
    },
    [totalSteps]
  );

  return {
    currentStep,
    isActive,
    completed,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep >= totalSteps - 1,
    progress: ((currentStep + 1) / totalSteps) * 100,
    start,
    startFromStep,
    next,
    prev,
    skip,
    reset,
    goToStep,
  };
}
