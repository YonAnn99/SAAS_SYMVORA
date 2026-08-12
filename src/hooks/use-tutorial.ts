"use client";

import { useState, useCallback, useEffect } from "react";

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

export function useTutorial(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [waitingForRoute, setWaitingForRoute] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Hydration-safe: read localStorage only after mount to avoid SSR/client mismatch
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isCompleted()) {
      setCompleted(true);
      const step = getStoredStep();
      if (step > 0) {
        setCurrentStep(step);
        setIsActive(true);
        setMinimized(true);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setCompleted(false);
    setMinimized(false);
    setWaitingForRoute(false);
    localStorage.setItem(STORAGE_KEY_STEP, "0");
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
  }, []);

  const startFromStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
      setIsActive(true);
      setMinimized(false);
      setWaitingForRoute(false);
    },
    [totalSteps]
  );

  const resume = useCallback(() => {
    setIsActive(true);
    setMinimized(false);
    setWaitingForRoute(false);
  }, []);

  const next = useCallback(
    (waitForRoute?: boolean) => {
      setCurrentStep((prev) => {
        const nextStep = Math.min(prev + 1, totalSteps - 1);
        localStorage.setItem(STORAGE_KEY_STEP, String(nextStep));
        setWaitingForRoute(!!waitForRoute);
        if (nextStep >= totalSteps - 1) {
          localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
          setCompleted(true);
          setMinimized(false);
          setTimeout(() => setIsActive(false), 300);
        }
        return nextStep;
      });
    },
    [totalSteps]
  );

  const onRouteReady = useCallback(() => {
    setWaitingForRoute(false);
  }, []);

  const prev = useCallback(() => {
    setCurrentStep((prev) => {
      const prevStep = Math.max(prev - 1, 0);
      localStorage.setItem(STORAGE_KEY_STEP, String(prevStep));
      setWaitingForRoute(false);
      return prevStep;
    });
  }, []);

  const minimize = useCallback(() => {
    setIsActive(false);
    setMinimized(true);
    setWaitingForRoute(false);
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    setMinimized(false);
    setWaitingForRoute(false);
    localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
    setCompleted(true);
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsActive(false);
    setCompleted(false);
    setMinimized(false);
    setWaitingForRoute(false);
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_STEP);
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(0, Math.min(step, totalSteps - 1));
      setCurrentStep(clamped);
      setWaitingForRoute(false);
      localStorage.setItem(STORAGE_KEY_STEP, String(clamped));
    },
    [totalSteps]
  );

  return {
    currentStep,
    isActive,
    completed,
    minimized,
    waitingForRoute,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep >= totalSteps - 1,
    progress: ((currentStep + 1) / totalSteps) * 100,
    start,
    startFromStep,
    resume,
    next,
    onRouteReady,
    prev,
    minimize,
    skip,
    reset,
    goToStep,
  };
}
