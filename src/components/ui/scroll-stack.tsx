"use client";

/**
 * Scroll Stack de React Bits (reactbits.dev/components/scroll-stack): al hacer
 * scroll las tarjetas se apilan, la de atras se encoge y la nueva queda encima.
 *
 * Misma interfaz que el original, con el mecanismo cambiado (`// SYMVORA`):
 *
 *   - El ANCLADO es CSS `position: sticky`, no un `translateY` calculado en
 *     cada cuadro. En celular el scroll lo mueve el compositor (otro hilo) y el
 *     evento `scroll` llega despues: la tarjeta movida por JS iba siempre un
 *     cuadro atras del dedo y temblaba. `sticky` lo mueve el navegador junto
 *     con el scroll.
 *   - `top` en `svh`: el alto de pantalla CON la barra del navegador visible.
 *     No cambia cuando la barra se esconde; con `%` del alto real, al
 *     esconderse (justo al final de la pila) todas las tarjetas brincaban.
 *   - Solo la ESCALA va por JS: la tarjeta `i` se encoge conforme la siguiente
 *     la cubre. Con `transform-origin: top` la orilla de arriba no se mueve,
 *     asi que medirla no se retroalimenta.
 *   - Se desplaza con la pagina (sin contenedor propio ni Lenis): escucha el
 *     scroll de cualquier contenedor en fase de captura.
 *   - "Reducir movimiento": se apilan igual (es el scroll del usuario), pero
 *     no se encogen.
 *
 * Requisito de `sticky`: ningun ancestro entre la tarjeta y el contenedor que
 * se desplaza puede tener `overflow` distinto de `visible`.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScrollStackItemProps {
  className?: string;
  children: ReactNode;
}

export function ScrollStackItem({ children, className }: ScrollStackItemProps) {
  return (
    <div className={cn("scroll-stack-card relative w-full box-border origin-top", className)}>
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
  /** Altura de la pantalla donde se ancla la pila: "18%" (= 18svh) o "120px". */
  stackPosition?: string;
  baseScale?: number;
  rotationAmount?: number;
  blurAmount?: number;
  onStackComplete?: () => void;
}

// "18%" -> "18svh"; "120px" o "120" -> "120px".
function aLongitudCss(valor: string): string {
  return valor.includes("%") ? `${parseFloat(valor)}svh` : `${parseFloat(valor)}px`;
}

const limitar = (n: number) => Math.min(1, Math.max(0, n));

export default function ScrollStack({
  children,
  className,
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
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
    const base = aLongitudCss(stackPosition);

    tarjetas.forEach((t, i) => {
      t.style.position = "sticky";
      t.style.top = `calc(${base} + ${i * itemStackDistance}px)`;
      t.style.marginBottom = i < tarjetas.length - 1 ? `${itemDistance}px` : "";
      t.style.transformOrigin = "top center";
    });

    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cuadro = 0;
    let completada = false;
    const ultimas: string[] = [];

    const actualizar = () => {
      cuadro = 0;
      const tops = tarjetas.map((t) => t.getBoundingClientRect().top);

      if (!reducir) {
        tarjetas.forEach((tarjeta, i) => {
          const siguiente = tops[i + 1];
          let p = 0;
          if (siguiente !== undefined) {
            const alto = tarjeta.offsetHeight;
            p = limitar((tops[i] + alto - siguiente) / Math.max(1, alto - itemStackDistance));
          }
          const escala = 1 - p * (1 - (baseScale + i * itemScale));
          const rotacion = rotationAmount ? i * rotationAmount * p : 0;
          const desenfoque = blurAmount ? p * blurAmount * (tarjetas.length - 1 - i) : 0;
          const transform = `scale(${escala.toFixed(4)})${rotacion ? ` rotate(${rotacion.toFixed(2)}deg)` : ""}`;
          if (ultimas[i] !== transform) {
            tarjeta.style.transform = transform;
            tarjeta.style.filter = desenfoque > 0.05 ? `blur(${desenfoque.toFixed(2)}px)` : "";
            ultimas[i] = transform;
          }
        });
      }

      // La ultima ya llego a su lugar en la pila.
      const n = tarjetas.length;
      if (n > 1) {
        const llego = tops[n - 1] - tops[n - 2] <= itemStackDistance + 1;
        if (llego && !completada) {
          completada = true;
          onCompleteRef.current?.();
        } else if (!llego) {
          completada = false;
        }
      }
    };

    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    };

    document.addEventListener("scroll", pedir, { passive: true, capture: true });
    window.addEventListener("resize", pedir);
    actualizar();

    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      document.removeEventListener("scroll", pedir, { capture: true });
      window.removeEventListener("resize", pedir);
      tarjetas.forEach((t) => {
        t.style.position = "";
        t.style.top = "";
        t.style.marginBottom = "";
        t.style.transform = "";
        t.style.filter = "";
        t.style.transformOrigin = "";
      });
    };
  }, [itemDistance, itemScale, itemStackDistance, stackPosition, baseScale, rotationAmount, blurAmount]);

  return (
    <div ref={raizRef} className={cn("relative w-full", className)}>
      {children}
      {/* La ultima tarjeta alcanza a verse apilada antes de que la pila siga. */}
      <div className="h-[15svh] w-full" aria-hidden="true" />
    </div>
  );
}
