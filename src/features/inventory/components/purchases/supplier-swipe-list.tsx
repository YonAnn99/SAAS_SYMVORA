"use client";

/**
 * Los proveedores en celular: una pastilla por proveedor en lugar de la tabla
 * (ver `components/ui/fila-deslizable.tsx`). Su UNICA accion es Editar, en
 * azul: deslizar (a la mitad y tocar, o completo) abre el dialogo de editar.
 * Tocar la pastilla tambien lo abre.
 */

import { Pencil } from "lucide-react";
import {
  COLOR_EDITAR,
  FilaDeslizable,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import type { Proveedor } from "../../types/inventory.types";

interface SupplierSwipeListProps {
  proveedores: Proveedor[];
  onEdit: (supplier: Proveedor) => void;
}

export function SupplierSwipeList({ proveedores, onEdit }: SupplierSwipeListProps) {
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          Desliza a la izquierda para editar
        </p>
      )}

      {proveedores.map((supplier) => (
        <FilaDeslizable
          key={supplier.id}
          label={supplier.nombre}
          acciones={[
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
