import type { ReactNode } from "react";

/**
 * Fondo de una sección de la landing. Las secciones alternan blanco y gris (en oscuro,
 * negro y gris oscuro) para que el cliente vea dónde termina una y empieza otra.
 *
 * La frontera no es un corte seco: una franja con degradado, dentro del margen superior
 * de la sección, pasa del color de la sección anterior al de esta. Va dentro de su
 * propia sección (no tapa el contenido de la anterior). `primera` no la pone.
 */

export type FondoAlterno = "blanco" | "gris";

const CLASE_FONDO: Record<FondoAlterno, string> = {
  blanco: "bg-white dark:bg-[#0a0a0a]",
  gris: "bg-neutral-100 dark:bg-neutral-900",
};

// Degradado de la franja: de la sección anterior a esta.
const CLASE_FRANJA: Record<FondoAlterno, string> = {
  blanco: "from-neutral-100 to-white dark:from-neutral-900 dark:to-[#0a0a0a]",
  gris: "from-white to-neutral-100 dark:from-[#0a0a0a] dark:to-neutral-900",
};

export function FondoSeccion({
  fondo,
  primera = false,
  children,
}: {
  fondo: FondoAlterno;
  primera?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`relative isolate ${CLASE_FONDO[fondo]}`}>
      {!primera && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 z-0 h-24 bg-gradient-to-b ${CLASE_FRANJA[fondo]}`}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
