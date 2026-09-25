"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

/**
 * Alterna entre modo claro y oscuro con el efecto "Circle blur" de beUI
 * (beui.dev/components/motion/theme-toggle): el tema nuevo se revela en un
 * circulo que nace del boton pulsado y se enfoca al crecer. El CSS de la
 * transicion vive en globals.css (`data-transicion-tema`).
 *
 * Adaptado del `useThemeToggle` de beUI sin `motion`: el boton de la landing
 * vive bajo `LazyMotion` y el del sistema no, y asi sirve en los dos sin volver
 * a meter `motion` completo en el JS inicial de la landing.
 */

const montado = () => () => {};

export function useCambioTema() {
  const { resolvedTheme, setTheme } = useTheme();
  // `resolvedTheme` no se conoce al renderizar en el servidor: hasta montar,
  // el icono no debe depender de el (evita un desajuste de hidratacion).
  const estaMontado = useSyncExternalStore(montado, () => true, () => false);
  // `resolvedTheme` y no `theme`: con el tema "system", `theme` vale "system"
  // y el primer clic no invertia lo que se veia.
  const oscuro = estaMontado && resolvedTheme === "dark";

  const alternar = (evento?: MouseEvent<HTMLElement>) => {
    const siguiente = oscuro ? "light" : "dark";
    const raiz = document.documentElement;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducir || !("startViewTransition" in document)) {
      setTheme(siguiente);
      return;
    }

    // El circulo nace en el centro del boton; sin boton (atajo), abajo al centro.
    const boton = evento?.currentTarget.getBoundingClientRect();
    raiz.style.setProperty(
      "--tema-origen",
      boton
        ? `${Math.round(boton.left + boton.width / 2)}px ${Math.round(boton.top + boton.height / 2)}px`
        : "50% 100%"
    );
    raiz.dataset.transicionTema = "";

    const transicion = (
      document as Document & {
        startViewTransition(cb: () => void): { finished: Promise<void> };
      }
    ).startViewTransition(() => {
      flushSync(() => setTheme(siguiente));
      // next-themes aplica la clase en un efecto: se aplica tambien aqui para
      // que la captura "nueva" de la transicion ya tenga el tema cambiado.
      raiz.classList.remove("light", "dark");
      raiz.classList.add(siguiente);
      raiz.style.colorScheme = siguiente;
    });

    transicion.finished.finally(() => {
      delete raiz.dataset.transicionTema;
    });
  };

  return { oscuro, montado: estaMontado, alternar };
}
