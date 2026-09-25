import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sol y luna que se cruzan al cambiar de tema, con el gesto "blur" del
 * `ActionSwapIcon` de beUI (opacidad, escala 0.25 -> 1 y desenfoque 8px -> 0 en
 * 200 ms), pero en CSS: sin `motion`, asi funciona igual en la landing y en el
 * sistema. Muestra el tema AL QUE se cambia: luna en claro, sol en oscuro.
 */
export function IconoTema({
  oscuro,
  montado,
  className = "h-4 w-4",
}: {
  oscuro: boolean;
  /** Hasta montar no se sabe el tema: se reserva el hueco sin icono. */
  montado: boolean;
  className?: string;
}) {
  const capa =
    "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-200 ease-in-out motion-reduce:transition-none";
  const visible = "opacity-100 scale-100 blur-0";
  const oculto = "opacity-0 scale-25 blur-[8px]";

  return (
    <span className={cn("inline-grid place-items-center", className)} aria-hidden="true">
      {montado && (
        <>
          <Moon className={cn(className, capa, oscuro ? oculto : visible)} />
          <Sun className={cn(className, capa, oscuro ? visible : oculto)} />
        </>
      )}
    </span>
  );
}
