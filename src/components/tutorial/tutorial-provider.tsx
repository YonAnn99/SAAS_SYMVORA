"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useTutorial } from "@/hooks/use-tutorial";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { tutorialSteps, type TutorialStep } from "./steps-data";
import { pasosParaUsuario } from "./pasos-por-usuario";

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
  next: () => void;
  onRouteReady: () => void;
  setWaitingForRoute: (value: boolean) => void;
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
  const { role, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();
  // Solo los pasos de los modulos a los que esta persona entra (el cajero no
  // ve Configuracion, Usuarios, Dashboard...). Mientras rol y permisos cargan
  // no hay paso: si no, se veria un instante el tutorial del dueño (como le
  // paso al menu lateral el 2026-09-04).
  const listo = !tenantLoading && !permsLoading;
  const pasos = useMemo(
    () => (listo ? pasosParaUsuario(tutorialSteps, role, can) : tutorialSteps),
    [listo, role, can]
  );
  const tutorial = useTutorial(pasos.length);
  const pathname = usePathname();
  // Recortado: el paso guardado puede venir de una lista mas larga (otro rol
  // en este navegador, o permisos que cambiaron).
  const pasoActual = Math.min(tutorial.currentStep, pasos.length - 1);
  const stepData = listo ? pasos[pasoActual] : undefined;

  // Decide si el paso actual necesita que el usuario navegue a otra ruta,
  // comparando el paso contra la URL real — no contra lo que hizo el paso
  // anterior (eso quedaba desfasado un paso: el prompt "Ir a X" aparecía
  // o no según de dónde venías, no según a dónde ibas).
  useEffect(() => {
    if (!tutorial.isActive || !stepData) return;

    const atTarget = pathname.includes(stepData.route);

    if (stepData.navigates && !atTarget) {
      tutorial.setWaitingForRoute(true);
    } else if (tutorial.waitingForRoute && atTarget) {
      tutorial.onRouteReady();
    }
  }, [pathname, tutorial, stepData]);

  return (
    <TutorialContext.Provider
      value={{
        ...tutorial,
        currentStep: pasoActual,
        progress: ((pasoActual + 1) / pasos.length) * 100,
        totalSteps: pasos.length,
        steps: pasos,
        currentStepData: stepData,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}
