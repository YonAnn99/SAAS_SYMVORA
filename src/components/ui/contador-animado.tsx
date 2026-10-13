"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  DURACION_MS,
  RETRASO_MS,
  easeOutExpo,
  formatearContador,
  type FormatoContador,
} from "@/lib/contador";
import { cn } from "@/lib/utils";

/**
 * Numero que cuenta desde 0 hasta `valor` (expo-out, 1.1 s, tras 120 ms). Si
 * `valor` cambia despues (actualizar, otro periodo, datos frescos tras la
 * cache), anima desde lo que se ve, sin volver a 0. Con "reducir movimiento"
 * pinta el valor directo. El lector de pantalla solo oye el valor final.
 */
export function ContadorAnimado({
  valor,
  className,
  ...formato
}: FormatoContador & { valor: number; className?: string }) {
  const reducir = useReducedMotion();
  const [mostrado, setMostrado] = useState(0);
  // Lo que se ve en este momento: de ahi parte la siguiente animacion.
  const actual = useRef(0);

  useEffect(() => {
    if (reducir) {
      actual.current = valor;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrado(valor);
      return;
    }
    const desde = actual.current;
    if (desde === valor) return;

    const inicio = performance.now() + RETRASO_MS;
    let cuadro = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, Math.max(0, (ahora - inicio) / DURACION_MS));
      // Al terminar se fija el valor exacto, sin restos de la interpolacion.
      const v = t >= 1 ? valor : desde + (valor - desde) * easeOutExpo(t);
      actual.current = v;
      setMostrado(v);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, reducir]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{formatearContador(mostrado, formato)}</span>
      <span className="sr-only">{formatearContador(valor, formato)}</span>
    </span>
  );
}
