"use client";

/**
 * El boton de eliminar de todo el sistema: se MANTIENE presionado (Hold
 * Button de React Bits, `hold-button.tsx`) y, al completarse, abre la ventana
 * "¿Seguro?" (`useConfirmar`): dos pasos a proposito, porque borrar no se
 * deshace. Soltarlo antes no hace nada, y un toque corto solo avisa como se
 * usa.
 *
 * Solo para borrar datos GUARDADOS (productos, ordenes, usuarios...). Quitar
 * un renglon de un formulario sin guardar (carrito del POS, renglones de una
 * compra) sigue siendo un clic: no borra nada y se deshace volviendo a
 * agregarlo.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import HoldButton from "@/components/ui/hold-button";
import { useConfirmar } from "@/components/ui/confirmar";
import { cn } from "@/lib/utils";

interface BotonEliminarProps {
  /** Lo que se borra: va en el `aria-label` y en el `title`. */
  nombre: string;
  onEliminar: () => void | Promise<void>;
  /** Con texto ("Mantén para eliminar") en vez de solo el icono. */
  conTexto?: boolean;
  /** Aviso extra en el `title` (p. ej. "No se puede deshacer"). */
  detalle?: string;
  disabled?: boolean;
  className?: string;
}

export function BotonEliminar({
  nombre,
  onEliminar,
  conTexto = false,
  detalle,
  disabled = false,
  className,
}: BotonEliminarProps) {
  const [borrando, setBorrando] = useState(false);
  const confirmar = useConfirmar();
  const ayuda = `Mantén presionado para eliminar ${nombre}${detalle ? `. ${detalle}` : ""}`;

  const eliminar = async () => {
    const si = await confirmar({
      titulo: `¿Eliminar ${nombre}?`,
      descripcion: detalle ? `${detalle}.` : undefined,
    });
    if (!si) return;
    setBorrando(true);
    try {
      await onEliminar();
    } finally {
      setBorrando(false);
    }
  };

  return (
    <span title={ayuda} aria-label={ayuda} className={cn("inline-flex", className)}>
      <HoldButton
        size="sm"
        radius={8}
        holdTime={1500}
        backgroundColor="transparent"
        fillColor="#e5484d"
        textColor="#e5484d"
        fillTextColor="#ffffff"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        // Al completarse NO muestra palomita: todavia falta confirmar en la
        // ventana, y una palomita diria que ya se borro.
        doneIcon={<Trash2 className="h-3.5 w-3.5" />}
        doneLabel={conTexto ? "Eliminado" : undefined}
        disabled={disabled || borrando}
        onHold={() => void eliminar()}
        onTap={() => toast.info("Mantén presionado para eliminar")}
        className={cn(!conTexto && "!h-7 !px-2")}
      >
        {conTexto ? "Mantén para eliminar" : null}
      </HoldButton>
    </span>
  );
}
