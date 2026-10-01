"use client";

/**
 * Scroll Stack de React Bits (reactbits.dev/components/scroll-stack): al hacer
 * scroll las tarjetas se apilan, la de atras se encoge y la nueva queda encima.
 *
 * Vendoreado con adaptaciones marcadas `// SYMVORA`:
 *   - Se desplaza con la PAGINA: busca el ancestro desplazable mas cercano (en
 *     la landing es el <main> de `AppFrame`, no `window`) y escucha su scroll.
 *     El original creaba su propio contenedor con scroll: dentro de la landing
 *     quedaba un scroll dentro de otro y en celular atrapaba el dedo.
 *   - Sin Lenis: el scroll se queda nativo (inercia del celular, anclas suaves
 *     de `scroll-smooth`). Lenis tomaba el control de toda la pagina.
 *   - ResizeObserver: se recalcula al rotar el celular o cambiar la ventana.
 *   - "Reducir movimiento": sin transformaciones, lista normal.
 *   - Rellenos responsivos (el original traia `px-20` y un espaciador de 50rem)
 *     y `ScrollStackItem` sin alto fijo: lo define el contenido.
 *
 * La matematica de `actualizar` (disparo, escala, anclado y liberacion con
 * `.scroll-stack-end`) es la del original.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScrollStackItemProps {
  className?: string;
  children: ReactNode;
}

export function ScrollStackItem({ children, className }: ScrollStackItemProps) {
  return (
    <div
      className={cn(
        "scroll-stack-card relative w-full box-border origin-top will-change-transform",
        className
      )}
      style={{ backfaceVisibility: "hidden", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

interface ScrollStackProps {
  className?: string;
  children: ReactNode;
  /** Separacion entre tarjetas antes de apilarse (px). */
  itemDistance?: number;
  /** Cuanto mas chica queda cada tarjeta respecto a la siguiente. */
  itemScale?: number;
  /** Cuanto asoma cada tarjeta de la pila (px). */
  itemStackDistance?: number;
  /** Altura de la pantalla donde se ancla la pila ("18%" o "120px"). */
  stackPosition?: string;
  /** Altura donde la tarjeta termina de encogerse. */
  scaleEndPosition?: string;
  baseScale?: number;
  rotationAmount?: number;
  blurAmount?: number;
  onStackComplete?: () => void;
}

interface Transformacion {
  translateY: number;
  scale: number;
  rotation: number;
  blur: number;
}

// SYMVORA: el contenedor que de verdad se desplaza.
function ancestroDesplazable(el: HTMLElement): HTMLElement | null {
  let actual = el.parentElement;
  while (actual && actual !== document.body) {
    const { overflowY } = getComputedStyle(actual);
    if (overflowY === "auto" || overflowY === "scroll") return actual;
    actual = actual.parentElement;
  }
  return null;
}

function aPixeles(valor: string, alto: number): number {
  return valor.includes("%") ? (parseFloat(valor) / 100) * alto : parseFloat(valor);
}

function progreso(scroll: number, inicio: number, fin: number): number {
  if (scroll < inicio) return 0;
  if (scroll > fin) return 1;
  return (scroll - inicio) / (fin - inicio);
}

export default function ScrollStack({
  children,
  className,
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  rotationAmount = 0,
  blurAmount = 0,
  onStackComplete,
}: ScrollStackProps) {
  const raizRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onStackComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onStackComplete;
  });

  useLayoutEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;

    const tarjetas = Array.from(raiz.querySelectorAll<HTMLElement>(".scroll-stack-card"));
    const fin = raiz.querySelector<HTMLElement>(".scroll-stack-end");

    tarjetas.forEach((t, i) => {
      t.style.marginBottom = i < tarjetas.length - 1 ? `${itemDistance}px` : "";
    });

    // SYMVORA: con "reducir movimiento" se queda como lista normal.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => tarjetas.forEach((t) => (t.style.marginBottom = ""));
    }

    tarjetas.forEach((t) => {
      t.style.willChange = "transform, filter";
      t.style.transformOrigin = "top center";
      t.style.transform = "translateZ(0)";
    });

    // El contenedor se vuelve a buscar si el que teniamos ya no esta en la
    // pagina (el marco puede re-montarse al cambiar de celular a escritorio).
    let contenedor = ancestroDesplazable(raiz);
    const vigente = () => {
      if (!contenedor || !contenedor.isConnected) contenedor = ancestroDesplazable(raiz);
      return contenedor;
    };
    const ultimas = new Map<number, Transformacion>();
    let completada = false;
    let cuadro = 0;

    const datos = () => {
      const c = vigente();
      return c
        ? { scroll: c.scrollTop, alto: c.clientHeight, top: c.getBoundingClientRect().top }
        : { scroll: window.scrollY, alto: window.innerHeight, top: 0 };
    };

    // Posicion del elemento dentro del contenido desplazable, sin contar la
    // transformacion que le pusimos (se resta para no medir donde ya se movio).
    const posicion = (el: HTMLElement, scroll: number, top: number, desplazado = 0) =>
      el.getBoundingClientRect().top - top + scroll - desplazado;

    const actualizar = () => {
      cuadro = 0;
      const { scroll, alto, top } = datos();
      const ancla = aPixeles(stackPosition, alto);
      const finEscala = aPixeles(scaleEndPosition, alto);
      const finTop = fin ? posicion(fin, scroll, top) : 0;
      const tops = tarjetas.map((t, i) => posicion(t, scroll, top, ultimas.get(i)?.translateY ?? 0));

      tarjetas.forEach((tarjeta, i) => {
        const tarjetaTop = tops[i];
        const inicioDisparo = tarjetaTop - ancla - itemStackDistance * i;
        const finDisparo = tarjetaTop - finEscala;
        const inicioAncla = inicioDisparo;
        const finAncla = finTop - alto / 2;

        const p = progreso(scroll, inicioDisparo, finDisparo);
        const escala = 1 - p * (1 - (baseScale + i * itemScale));
        const rotacion = rotationAmount ? i * rotationAmount * p : 0;

        let desenfoque = 0;
        if (blurAmount) {
          let arriba = 0;
          tops.forEach((tj, j) => {
            if (scroll >= tj - ancla - itemStackDistance * j) arriba = j;
          });
          if (i < arriba) desenfoque = (arriba - i) * blurAmount;
        }

        let y = 0;
        if (scroll >= inicioAncla && scroll <= finAncla) {
          y = scroll - tarjetaTop + ancla + itemStackDistance * i;
        } else if (scroll > finAncla) {
          y = finAncla - tarjetaTop + ancla + itemStackDistance * i;
        }

        const nueva: Transformacion = {
          translateY: Math.round(y * 100) / 100,
          scale: Math.round(escala * 1000) / 1000,
          rotation: Math.round(rotacion * 100) / 100,
          blur: Math.round(desenfoque * 100) / 100,
        };
        const previa = ultimas.get(i);
        if (
          !previa ||
          Math.abs(previa.translateY - nueva.translateY) > 0.1 ||
          Math.abs(previa.scale - nueva.scale) > 0.001 ||
          Math.abs(previa.rotation - nueva.rotation) > 0.1 ||
          Math.abs(previa.blur - nueva.blur) > 0.1
        ) {
          tarjeta.style.transform = `translate3d(0, ${nueva.translateY}px, 0) scale(${nueva.scale}) rotate(${nueva.rotation}deg)`;
          tarjeta.style.filter = nueva.blur > 0 ? `blur(${nueva.blur}px)` : "";
          ultimas.set(i, nueva);
        }

        if (i === tarjetas.length - 1) {
          const enVista = scroll >= inicioAncla && scroll <= finAncla;
          if (enVista && !completada) {
            completada = true;
            onCompleteRef.current?.();
          } else if (!enVista && completada) {
            completada = false;
          }
        }
      });
    };

    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    };

    // En fase de captura sobre `document`: escucha el scroll de CUALQUIER
    // contenedor (el evento no burbujea), asi no depende de haber encontrado
    // el correcto al montar.
    document.addEventListener("scroll", pedir, { passive: true, capture: true });
    window.addEventListener("resize", pedir);
    const observador = new ResizeObserver(pedir);
    observador.observe(raiz);
    actualizar();

    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      document.removeEventListener("scroll", pedir, { capture: true });
      window.removeEventListener("resize", pedir);
      observador.disconnect();
      tarjetas.forEach((t) => {
        t.style.transform = "";
        t.style.filter = "";
        t.style.willChange = "";
        t.style.marginBottom = "";
      });
    };
  }, [itemDistance, itemScale, itemStackDistance, stackPosition, scaleEndPosition, baseScale, rotationAmount, blurAmount]);

  return (
    <div ref={raizRef} className={cn("relative w-full", className)}>
      {children}
      {/* Espaciador para que la ultima tarjeta se suelte limpia. */}
      <div className="scroll-stack-end h-[35vh] w-full" aria-hidden="true" />
    </div>
  );
}
