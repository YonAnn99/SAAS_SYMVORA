"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Piezas compartidas por las escenas de scroll fijo (escena POS y capítulos):
 * contenedor desplazable, desplazamiento a una fracción del recorrido y los
 * controles anterior / pausa / siguiente.
 */

/** Contenedor desplazable más cercano (la landing scrollea dentro de `<main>`). */
export function contenedorDeScroll(el: HTMLElement): HTMLElement | null {
  let e = el.parentElement;
  while (e) {
    const oy = getComputedStyle(e).overflowY;
    if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight) return e;
    e = e.parentElement;
  }
  return null;
}

/**
 * Lleva el scroll a la mitad del tramo `i` de `n` (misma fórmula que lee `progresoEscena`,
 * así al llegar el tramo queda activo).
 */
export function irATramo(el: HTMLElement, i: number, n: number) {
  const scroller = contenedorDeScroll(el);
  const range = el.offsetHeight - window.innerHeight;
  const p = (i + 0.5) / n;
  if (scroller) {
    const base = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: base + p * range, behavior: "smooth" });
  } else {
    const base = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: base + p * range, behavior: "smooth" });
  }
}

export function ControlesRecorrido({
  total,
  actual,
  reproduciendo,
  onAnterior,
  onSiguiente,
  onAlternar,
}: {
  total: number;
  actual: number;
  reproduciendo: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  onAlternar: () => void;
}) {
  const t = useTranslations("landing.features");
  const boton =
    "flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40";
  return (
    <div className="mt-4 flex items-center gap-3">
      <button type="button" className={boton} onClick={onAnterior} disabled={actual === 0} aria-label={t("controles.anterior")}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={boton} onClick={onAlternar} aria-label={reproduciendo ? t("controles.pausar") : t("controles.reproducir")}>
        {reproduciendo ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      <button type="button" className={boton} onClick={onSiguiente} disabled={actual === total - 1} aria-label={t("controles.siguiente")}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="ml-2 flex flex-1 gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <span className="block h-full bg-blue-600 dark:bg-blue-400 transition-[width] duration-300" style={{ width: i <= actual ? "100%" : "0%" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
