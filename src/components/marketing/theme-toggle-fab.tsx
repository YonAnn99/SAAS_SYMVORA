"use client";

import { useCambioTema } from "@/hooks/use-cambio-tema";
import { IconoTema } from "@/components/icono-tema";

/**
 * Boton flotante de tema de la landing. El cambio usa el efecto "Circle blur"
 * (ver `useCambioTema`): el tema nuevo se revela en un circulo que nace de aqui.
 */
export function ThemeToggleFab() {
  const { oscuro, montado, alternar } = useCambioTema();

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="absolute bottom-5 left-5 z-[110] flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
    >
      <IconoTema oscuro={oscuro} montado={montado} />
    </button>
  );
}
