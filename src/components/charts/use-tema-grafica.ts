"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Colores reales del tema para Chart.js.
 *
 * El canvas no entiende `var(--x)` (Recharts pintaba SVG y si los resolvia),
 * asi que se leen los valores calculados del `:root`. Los tokens son hex en
 * `globals.css`.
 *
 * Se vuelven a leer cuando cambia la clase del <html> (next-themes pone o
 * quita `dark` ahi) y al cruzar el corte de celular o cambiar la preferencia de
 * movimiento. Se escucha el DOM y no `resolvedTheme`: next-themes aplica la
 * clase DESPUES de actualizar su estado, y leer en ese momento daria los
 * colores del tema anterior.
 */
export interface TemaGrafica {
  principal: string;
  serie: [string, string, string, string, string];
  texto: string;
  textoSuave: string;
  borde: string;
  fondoTarjeta: string;
  /** El usuario pidio menos movimiento en su sistema: sin animaciones. */
  reducirMovimiento: boolean;
  /** Pantalla chica (< 640 px, el `sm` de Tailwind): menos marcas en los ejes. */
  compacto: boolean;
}

const RESPALDO: TemaGrafica = {
  principal: "#0F172A",
  serie: ["#0F172A", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  texto: "#0F172A",
  textoSuave: "#52525B",
  borde: "#E4E4E7",
  fondoTarjeta: "#FFFFFF",
  reducirMovimiento: false,
  compacto: false,
};

const CONSULTA_COMPACTO = "(max-width: 639px)";
const CONSULTA_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

function leerTema(): TemaGrafica {
  if (typeof window === "undefined") return RESPALDO;
  const estilo = getComputedStyle(document.documentElement);
  const v = (nombre: string, respaldo: string) =>
    estilo.getPropertyValue(nombre).trim() || respaldo;

  return {
    principal: v("--chart-principal", RESPALDO.principal),
    serie: [
      v("--chart-principal", RESPALDO.serie[0]),
      v("--chart-2", RESPALDO.serie[1]),
      v("--chart-3", RESPALDO.serie[2]),
      v("--chart-4", RESPALDO.serie[3]),
      v("--chart-5", RESPALDO.serie[4]),
    ],
    texto: v("--foreground", RESPALDO.texto),
    textoSuave: v("--muted-foreground", RESPALDO.textoSuave),
    borde: v("--border", RESPALDO.borde),
    fondoTarjeta: v("--card", RESPALDO.fondoTarjeta),
    reducirMovimiento: window.matchMedia(CONSULTA_MOVIMIENTO).matches,
    compacto: window.matchMedia(CONSULTA_COMPACTO).matches,
  };
}

function suscribir(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  const consultas = [CONSULTA_COMPACTO, CONSULTA_MOVIMIENTO].map((q) => window.matchMedia(q));
  consultas.forEach((c) => c.addEventListener("change", avisar));
  return () => {
    observador.disconnect();
    consultas.forEach((c) => c.removeEventListener("change", avisar));
  };
}

/** Lo que cambia los colores o el tamaño: si esta firma no cambia, el tema tampoco. */
function firma(): string {
  return [
    document.documentElement.className,
    window.matchMedia(CONSULTA_COMPACTO).matches,
    window.matchMedia(CONSULTA_MOVIMIENTO).matches,
  ].join("|");
}

export function useTemaGrafica(): TemaGrafica {
  const actual = useSyncExternalStore(suscribir, firma, () => "");
  // `actual` solo sirve para recalcular cuando cambia la firma.
  return useMemo(() => (actual ? leerTema() : RESPALDO), [actual]);
}
