"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useIsDemo } from "@/hooks/use-is-demo";

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

  /**
   * EN EL DEMO EL TUTORIAL NO EXISTE.
   *
   * Recorre 16 pasos por modulos que en el demo estan restringidos: `/billing`
   * devuelve el aviso de demo en vez de la pantalla, y el paso de Configuracion
   * apunta a un selector que puede no existir, con lo que el `MutationObserver`
   * reintenta para siempre y la flecha nunca se coloca. El boton "Siguiente"
   * queda muerto mientras se espera la ruta, asi que el visitante se atasca
   * justo cuando esta evaluando el producto.
   */
  const isDemo = useIsDemo();

  /**
   * Si ESTE arranque automatico escribio la clave de progreso.
   *
   * Hace falta por una carrera real: `useIsDemo()` no tiene bandera de carga y
   * su fuente definitiva —el correo del usuario— es asincrona. Quien entra al
   * demo por una URL directa, sin `?demo=1` ni la marca de sesion, ve `isDemo`
   * en `false` durante el primer render, que es justo cuando corre este efecto.
   *
   * Sin deshacer esa escritura, la clave quedaria puesta y CONTAMINARIA la
   * sesion real posterior en el mismo navegador: el usuario no volveria a ver
   * el tutorial nunca.
   */
  const autoarrancado = useRef(false);

  // Hydration-safe: read localStorage only after mount to avoid SSR/client mismatch
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isDemo) {
      // Puede llegar aqui DESPUES de haber autoarrancado, si la comprobacion
      // asincrona resolvio tarde. Se deshace lo que hizo este arranque y nada
      // mas: `STORAGE_KEY_COMPLETED` no se toca jamas, porque es de un usuario
      // real que ya lo termino y borrarlo se lo repetiria.
      if (autoarrancado.current) {
        setIsActive(false);
        localStorage.removeItem(STORAGE_KEY_STEP);
        autoarrancado.current = false;
      }
      return;
    }

    if (isCompleted()) {
      setCompleted(true);
      // Se restaura el paso solo para que el progreso siga siendo coherente si
      // alguien reabre el tutorial desde el header. NO se reactiva: un
      // tutorial ya completado no debe reaparecer solo.
      //
      // Antes esta rama hacía `setIsActive(true)` cuando el paso guardado era
      // > 0, y como al terminar queda COMPLETED=true junto con el último paso
      // (14), el diálogo se reabría en "Paso 15 de 15" en CADA carga. Se notaba
      // sobre todo en la PWA instalada, que se abre muchas veces al día.
      // `setMinimized(true)` tampoco servía de nada ahí: TutorialMinimized se
      // oculta si `completed` es true.
      const step = getStoredStep();
      if (step > 0) {
        setCurrentStep(step);
      }
    } else if (localStorage.getItem(STORAGE_KEY_STEP) === null) {
      // Nunca se tocó el tutorial en este navegador (ni completado, ni
      // saltado, ni un paso guardado) — es la primera vez que alguien
      // entra al sistema, así que se activa solo.
      setIsActive(true);
      localStorage.setItem(STORAGE_KEY_STEP, "0");
      autoarrancado.current = true;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // `isDemo` en las dependencias NO es opcional: es lo que hace que el efecto
    // se reevalue cuando la comprobacion asincrona resuelve. Con `[]` el corte
    // por demo solo funcionaria en quien llega con `?demo=1`.
  }, [isDemo]);

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
    () => {
      setCurrentStep((prev) => {
        const nextStep = Math.min(prev + 1, totalSteps - 1);
        localStorage.setItem(STORAGE_KEY_STEP, String(nextStep));
        // No se decide aquí si el siguiente paso necesita navegar — eso lo
        // calcula TutorialProvider de forma reactiva comparando el paso
        // nuevo contra la ruta actual (ver ese archivo). Decidirlo aquí
        // según el paso que se está dejando (el único dato disponible en
        // este callback) quedaba desfasado un paso.
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
    setWaitingForRoute,
    prev,
    minimize,
    skip,
    reset,
    goToStep,
  };
}
