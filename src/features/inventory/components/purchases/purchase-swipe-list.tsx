"use client";

/**
 * Las compras en celular: una pastilla deslizable por compra en lugar de la
 * tabla (ver `components/ui/fila-deslizable.tsx`).
 *
 * La accion principal (deslizar completo) es DEVOLVER, en naranja: cancela la
 * compra y regresa el stock (y el efectivo, si se pago con la caja abierta),
 * lo mismo que el boton de la tabla. Una compra heredada sin desglose no movio
 * inventario, asi que esa se elimina. Tocar la pastilla abre el desglose.
 */

import { CheckCircle, Pencil, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  COLOR_EDITAR,
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
  type AccionFila,
} from "@/components/ui/fila-deslizable";
import type { PurchaseWithRelations } from "../../types/inventory.types";
import { purchaseStatusColors } from "../../services/purchase-service";

const COLOR_DEVOLVER = "#f97316";
const COLOR_RECIBIDA = "#16a34a";

interface PurchaseSwipeListProps {
  compras: PurchaseWithRelations[];
  onOpen: (purchase: PurchaseWithRelations) => void;
  onEdit: (purchase: PurchaseWithRelations) => void;
  onUpdateStatus: (id: string, estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA") => void;
  onCancel: (id: string) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
}

/** Misma regla que la tabla: con renglones, la compra MOVIO inventario. */
const movioInventario = (p: PurchaseWithRelations) => (p.renglones?.length ?? 0) > 0;

export function PurchaseSwipeList({
  compras,
  onOpen,
  onEdit,
  onUpdateStatus,
  onCancel,
  onDelete,
}: PurchaseSwipeListProps) {
  const t = useTranslations();
  const { verPista, alAbrir } = usePistaDeslizar();

  const accionesDe = (compra: PurchaseWithRelations): AccionFila[] => {
    if (compra.estado === "CANCELADA") return [];

    const principal: AccionFila = movioInventario(compra)
      ? {
          id: "devolver",
          etiqueta: "Devolver",
          color: COLOR_DEVOLVER,
          icono: <Undo2 size={18} strokeWidth={2} />,
          alElegir: async () => {
            await onCancel(compra.id);
          },
          // La compra sigue ahi, ahora CANCELADA: la fila debe reaparecer.
          permanece: true,
          confirmar: {
            titulo: `¿Devolver la compra de ${compra.proveedor?.nombre || "este proveedor"}?`,
            descripcion: "La compra se cancela y el stock regresa al inventario. Si se pagó con la caja todavía abierta, el efectivo vuelve a la caja.",
            accion: "Devolver",
            tono: "aviso",
          },
        }
      : {
          id: "eliminar",
          etiqueta: "Eliminar",
          color: COLOR_ELIMINAR,
          icono: <Trash2 size={18} strokeWidth={2} />,
          alElegir: async () => {
            await onDelete(compra.id);
          },
          confirmar: {
            titulo: `¿Eliminar la compra de ${compra.proveedor?.nombre || "este proveedor"}?`,
          },
        };

    if (compra.estado !== "PENDIENTE") return [principal];

    return [
      principal,
      {
        id: "editar",
        etiqueta: "Editar",
        color: COLOR_EDITAR,
        icono: <Pencil size={18} strokeWidth={2} />,
        alElegir: () => onEdit(compra),
      },
      {
        id: "recibida",
        etiqueta: "Recibida",
        color: COLOR_RECIBIDA,
        icono: <CheckCircle size={18} strokeWidth={2} />,
        alElegir: () => onUpdateStatus(compra.id, "RECIBIDA"),
      },
    ];
  };

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          Toca para ver el desglose · desliza a la izquierda para devolver
        </p>
      )}

      {compras.map((compra) => {
        const proveedor = compra.proveedor?.nombre || "Sin proveedor";
        return (
          <FilaDeslizable
            key={compra.id}
            label={`Compra de ${proveedor}`}
            acciones={accionesDe(compra)}
            onTap={() => onOpen(compra)}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{proveedor}</p>
              <p className="truncate text-xs opacity-60">
                {new Date(compra.fecha_compra).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {!movioInventario(compra) && " · sin desglose"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm tabular-nums">
                ${Number(compra.total).toFixed(2)}
              </span>
              <Badge
                className={`${purchaseStatusColors[compra.estado]} text-[10px] px-1.5 py-0`}
              >
                {t(`purchases.statuses.${compra.estado}`)}
              </Badge>
            </div>
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
