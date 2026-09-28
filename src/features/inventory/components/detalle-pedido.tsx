import type { ReactNode } from "react";
import { formatearCantidad } from "@/lib/unidades";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Piezas comunes de las ventanas de detalle de Compras y de Órdenes de compra.
 * Mismo aspecto que el detalle de una venta en Reportes.
 */

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Una fecha sin hora (`fecha_estimada_recepcion` es DATE). */
export function fechaSinHora(fecha: string): string {
  // Mediodia: con medianoche UTC, en Mexico la fecha retrocederia un dia.
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DatoDetalle({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground">{etiqueta}</span>
      <div className="break-words font-medium">{children}</div>
    </div>
  );
}

export interface RenglonTabla {
  producto: { nombre: string; unidad_medida: string | null } | null;
  variante: { talla: string | null; color: string | null } | null;
  cantidad: number;
  /** Solo en ordenes: lo que ya llego. Sin el, no se pinta la columna. */
  recibido?: number;
  costo: number;
  importe: number;
}

export function TablaRenglones({ renglones }: { renglones: RenglonTabla[] }) {
  const conRecibido = renglones.some((r) => r.recibido !== undefined);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Producto</th>
            <th className="px-3 py-2 text-right font-medium">
              {conRecibido ? "Pedido" : "Cant."}
            </th>
            {conRecibido && (
              <th className="px-3 py-2 text-right font-medium">Recibido</th>
            )}
            <th className="px-3 py-2 text-right font-medium">Costo</th>
            <th className="px-3 py-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {renglones.map((r, i) => {
            const unidad = r.producto?.unidad_medida;
            const completo =
              r.recibido !== undefined && r.recibido >= r.cantidad;
            return (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  {r.producto?.nombre ?? "Producto eliminado"}
                  {(r.variante?.talla || r.variante?.color) && (
                    <span className="block text-muted-foreground">
                      {[r.variante.talla, r.variante.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                  {formatearCantidad(r.cantidad, unidad)}
                </td>
                {conRecibido && (
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums",
                      r.recibido === 0
                        ? "text-muted-foreground"
                        : completo
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {formatearCantidad(r.recibido ?? 0, unidad)}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                  {formatMXN(r.costo)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                  {formatMXN(r.importe)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
