"use client";

/**
 * Los proveedores en celular: una pastilla por proveedor en lugar de la tabla
 * (ver `components/ui/fila-deslizable.tsx`).
 *
 *   a la mitad  -> Eliminar | Editar
 *   completo    -> Eliminar (con confirmacion)
 *   tocar       -> Editar
 *
 * Un proveedor con compras u ordenes no se borra (lo rechaza la base): la
 * pastilla reaparece y se explica por que.
 */

import { Pencil, Trash2 } from "lucide-react";
import {
  COLOR_EDITAR,
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import type { Proveedor } from "../../types/inventory.types";

interface SupplierSwipeListProps {
  proveedores: Proveedor[];
  onEdit: (supplier: Proveedor) => void;
  /** `false` si no se pudo: la pastilla reaparece. */
  onDelete: (supplier: Proveedor) => Promise<boolean>;
}

export function SupplierSwipeList({ proveedores, onEdit, onDelete }: SupplierSwipeListProps) {
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          Desliza a la izquierda para editar o eliminar
        </p>
      )}

      {proveedores.map((supplier) => (
        <FilaDeslizable
          key={supplier.id}
          label={supplier.nombre}
          acciones={[
            {
              id: "eliminar",
              etiqueta: "Eliminar",
              color: COLOR_ELIMINAR,
              icono: <Trash2 size={18} strokeWidth={2} />,
              alElegir: () => onDelete(supplier),
              confirmar: {
                titulo: `¿Eliminar a ${supplier.nombre}?`,
                descripcion: "Sus productos se quedan, sin proveedor asignado.",
              },
            },
            {
              id: "editar",
              etiqueta: "Editar",
              color: COLOR_EDITAR,
              icono: <Pencil size={18} strokeWidth={2} />,
              alElegir: () => onEdit(supplier),
              // Deslizar completo colapsa la fila; el proveedor sigue ahi,
              // asi que reaparece al abrir el dialogo.
              permanece: true,
            },
          ]}
          onTap={() => onEdit(supplier)}
          onOpenChange={alAbrir}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{supplier.nombre}</p>
            <p className="truncate text-xs opacity-60">
              <span className="font-mono">{supplier.telefono || "Sin celular"}</span>
              {" · "}
              {supplier.email || "Sin correo"}
            </p>
          </div>
        </FilaDeslizable>
      ))}
    </div>
  );
}
