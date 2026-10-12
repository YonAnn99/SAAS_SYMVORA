"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lo minimo que gira el icono: una recarga instantanea tambien se tiene que notar. */
const GIRO_MINIMO_MS = 400;

/**
 * "Actualizar": vuelve a pedir los datos del modulo sin recargar todo el
 * sistema (F5). Va en la fila de acciones del encabezado.
 *
 * `onActualizar` puede ser async: mientras corre, el icono gira y el boton se
 * desactiva (un doble clic no dispara dos cargas). Si falla, se avisa.
 */
export function BotonActualizar({
  onActualizar,
  className,
}: {
  onActualizar: () => unknown | Promise<unknown>;
  className?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const enCurso = useRef(false);

  const actualizar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setCargando(true);
    const inicio = Date.now();
    try {
      await onActualizar();
    } catch {
      toast.error("No se pudieron actualizar los datos");
    } finally {
      const resta = GIRO_MINIMO_MS - (Date.now() - inicio);
      if (resta > 0) await new Promise((r) => setTimeout(r, resta));
      enCurso.current = false;
      setCargando(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5", className)}
      onClick={() => void actualizar()}
      disabled={cargando}
      aria-label="Actualizar datos"
      title="Actualizar datos"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} aria-hidden="true" />
      <span className="hidden sm:inline">{cargando ? "Actualizando…" : "Actualizar"}</span>
    </Button>
  );
}
