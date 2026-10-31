import { cn } from "@/lib/utils";

/**
 * Pastilla «Nuevo» junto a un módulo recién lanzado (`lib/novedades.ts`).
 * Sólida, del color primario: se lee igual sobre el menú oscuro y sobre la
 * pastilla clara de la opción activa.
 */
export function EtiquetaNuevo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-primary-foreground",
        className
      )}
    >
      Nuevo
    </span>
  );
}

/** Punto para cuando no cabe la palabra (menú colapsado, botón «+»). */
export function PuntoNuevo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-primary", className)}
    />
  );
}
