"use client";

/**
 * El desglose de una venta ya cobrada, y desde aqui se reimprime su ticket.
 *
 * Es la unica pantalla del sistema donde se puede ver que se vendio en una
 * venta concreta: hasta ahora el detalle existia solo el instante posterior al
 * cobro, dentro del Punto de Venta.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { TicketReceipt } from "@/features/pos/components/ticket-receipt";
import { clavePagoI18n, numeroOperacion } from "@/features/pos/ticket-format";
import { formatMXN } from "@/lib/money";
import { logActivity } from "@/lib/supabase/activity-logger";
import { useSaleDetail } from "../hooks/use-sales-history";

interface SaleDetailDialogProps {
  /** Id de la venta a mostrar, o `null` para cerrar. */
  ventaId: string | null;
  onOpenChange: (open: boolean) => void;
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function SaleDetailDialog({
  ventaId,
  onOpenChange,
}: SaleDetailDialogProps) {
  const t = useTranslations();
  const { venta, receipt, cargando, abrir, cerrar } = useSaleDetail();
  const [ticketAbierto, setTicketAbierto] = useState(false);

  useEffect(() => {
    if (!ventaId) {
      cerrar();
      return;
    }
    // Diferido, convención del repo: pedir el detalle de forma síncrona dentro
    // del efecto encadena renders.
    const t0 = window.setTimeout(() => void abrir(ventaId), 0);
    return () => window.clearTimeout(t0);
  }, [ventaId, abrir, cerrar]);

  return (
    <>
      <Dialog open={Boolean(ventaId)} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Venta
              {venta && ` #${numeroOperacion(venta.id) ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {venta ? fechaLarga(venta.fecha_venta) : "Cargando..."}
            </DialogDescription>
          </DialogHeader>

          {cargando && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!cargando && venta && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Atendió</span>
                  <p className="font-medium">{venta.cajero_email ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <p className="font-medium">
                    {venta.cliente_nombre ?? "Cliente general"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Forma de pago</span>
                  <p className="font-medium">
                    {t(clavePagoI18n(venta.metodo_pago))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Origen</span>
                  <p className="font-medium">
                    {venta.origen === "offline" ? "Sin conexión" : "En línea"}
                  </p>
                </div>
              </div>

              {/* Una venta marcada para revisión se cobró con un total que no
                  coincide con lo que recalculó el servidor: casi siempre una
                  venta offline cuyo precio cambió mientras no había red. */}
              {venta.requiere_revision && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Esta venta quedó marcada para revisión: el total cobrado no
                  coincidió con el recalculado al subirla.
                </p>
              )}

              <div className="rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-right font-medium">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-3 py-2 text-right font-medium">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venta.renglones.map((r, i) => (
                      <tr
                        key={`${r.producto_id}-${r.variante_id ?? "base"}-${i}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">
                          {r.nombre}
                          {(r.talla || r.color) && (
                            <span className="block text-muted-foreground">
                              {[r.talla, r.color].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {Number(r.cantidad)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMXN(Number(r.precio_unitario))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMXN(Number(r.subtotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
                <span className="text-muted-foreground">
                  Subtotal: {formatMXN(Number(venta.subtotal ?? 0))}
                </span>
                {Number(venta.descuento ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    Descuento: −{formatMXN(Number(venta.descuento))}
                  </span>
                )}
                {Number(venta.impuesto ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    IVA: {formatMXN(Number(venta.impuesto))}
                  </span>
                )}
                <span className="text-sm font-semibold">
                  Total: {formatMXN(Number(venta.total))}
                </span>
                {venta.monto_recibido !== null && (
                  <>
                    <span className="text-muted-foreground">
                      Recibido: {formatMXN(Number(venta.monto_recibido))}
                    </span>
                    <span className="text-muted-foreground">
                      Cambio: {formatMXN(Number(venta.cambio ?? 0))}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <SpecularActionButton
              tone="money"
              className="h-8"
              disabled={!receipt}
              onClick={() => {
                setTicketAbierto(true);
                if (!venta) return;
                // Deja rastro en la Bitácora. Un ticket reimpreso sirve para
                // justificar una devolución falsa, así que tiene que constar
                // quién lo sacó y de qué venta. No se espera al registro para
                // abrir el ticket: que falle la Bitácora no puede impedir
                // atender al cliente que está enfrente.
                void logActivity({
                  action: "REIMPRIMIR",
                  entity: "venta",
                  entityId: venta.id,
                  entityName: `Venta #${numeroOperacion(venta.id) ?? ""}`,
                  details: {
                    total: Number(venta.total),
                    fecha_venta: venta.fecha_venta,
                    cobro_original: venta.cajero_email,
                  },
                });
              }}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Reimprimir ticket
            </SpecularActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* El MISMO componente que imprime el ticket al cobrar. El receipt viene
          reconstruido desde la base, con la fecha original y marcado como
          reimpresión. */}
      <TicketReceipt
        open={ticketAbierto}
        onOpenChange={setTicketAbierto}
        receipt={receipt}
      />
    </>
  );
}

/** Estado de la venta, con el mismo color que usa el resto del panel. */
export function EstadoVentaBadge({ estado }: { estado: string }) {
  if (estado === "COMPLETADA") return null;
  return (
    <Badge variant="secondary" className="text-[10px]">
      {estado}
    </Badge>
  );
}
