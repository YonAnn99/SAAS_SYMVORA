"use client";

/**
 * La palabra que rota en el hero: "hecho para tu [farmacia]", pasando en bucle
 * por los 20 giros dentro de una pastilla azul SYMVORA (Rotating Text de React
 * Bits, `components/ui/rotating-text.tsx`).
 *
 * La pastilla cambia de ancho con una transicion CSS: un medidor oculto con la
 * palabra actual da el ancho. El original lo hacia con `layout` de motion, que
 * la landing no carga (usa `domAnimation`, mucho mas ligero).
 *
 * Con "reducir movimiento" se queda fija en el primer giro.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import RotatingText from "@/components/ui/rotating-text";
import { palabrasDelHero } from "./giro-giratorio-palabras";

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";

function useReducirMovimiento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_REDUCIR);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false
  );
}

/** Relleno horizontal de la pastilla (px-3 = 12px por lado). */
const RELLENO_X = 24;

export function GiroGiratorio() {
  const locale = useLocale();
  const palabras = palabrasDelHero(locale === "en" ? "en" : "es");
  const reducir = useReducirMovimiento();
  const [indice, setIndice] = useState(0);
  const [ancho, setAncho] = useState<number | null>(null);
  const medidor = useRef<HTMLSpanElement>(null);

  // El medidor tiene la palabra actual con la misma tipografia: su ancho (mas
  // el relleno) es el de la pastilla. ResizeObserver cubre tambien la carga de
  // la fuente y el cambio de tamaño entre celular y escritorio.
  useEffect(() => {
    const el = medidor.current;
    if (!el) return;
    const medir = () => setAncho(Math.ceil(el.getBoundingClientRect().width) + RELLENO_X);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [indice]);

  const alCambiar = useCallback((i: number) => setIndice(i), []);

  return (
    // `flex` (bloque): siempre en su propio renglon, ver `hero.tsx`.
    <span className="relative mt-2 flex w-fit max-w-full">
      {/* Medidor: invisible y fuera del flujo. */}
      <span
        ref={medidor}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      >
        {palabras[indice]}
      </span>
      <RotatingText
        texts={palabras}
        auto={!reducir}
        rotationInterval={2200}
        staggerFrom="last"
        staggerDuration={0.025}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "-120%" }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        onNext={alCambiar}
        mainClassName="max-w-full justify-center overflow-hidden rounded-xl bg-[#2563EB] px-3 pb-1 text-white transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        splitLevelClassName="overflow-hidden pb-1"
        style={ancho ? { width: ancho } : undefined}
      />
    </span>
  );
}
