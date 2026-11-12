"use client";

/**
 * El desglose de una venta ya cobrada, y desde aqui se reimprime su ticket.
 *
 * Es la unica pantalla del sistema donde se puede ver que se vendio en una
 * venta concreta: hasta ahora el detalle existia solo el instante posterior al
 * cobro, dentro del Punto de Venta.
 */

import { formatearCantidad } from "@/lib/unidades";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";
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
import { useMoneda } from "@/hooks/use-moneda";
import { logActivity } from "@/lib/supabase/activity-logger";
import { useSaleDetail } from "../hooks/use-sales-history";
import { fetchLotesDeVenta, textoLotes, type LoteDeVenta } from "../services/lotes-de-venta";
import {
  fetchInsumosDeVenta,
  type InsumoDeVenta,
} from "@/features/inventory/services/insumos-service";

interface SaleDetailDialogProps {
  /** Id de la venta a mostrar, o `null` para cerrar. */
  ventaId: string | null;
  onOpenChange: (open: boolean) => void;
}

function fechaLarga(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
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
  const { formatear } = useMoneda();
  const t = useTranslations();
  const locale = useLocale();
  const { venta, receipt, cargando, abrir, cerrar } = useSaleDetail();
  const [ticketAbierto, setTicketAbierto] = useState(false);
  // Lotes que salieron con esta venta (116). Solo informativo: si falla, no
  // estorba al detalle ni a la reimpresion.
  const [lotes, setLotes] = useState<LoteDeVenta[]>([]);
  // Insumos que uso cada servicio (117), con lo que falto en existencias.
  const [insumos, setInsumos] = useState<InsumoDeVenta[]>([]);

  useEffect(() => {
    if (!ventaId) return;
    let vigente = true;
    const t0 = window.setTimeout(() => {
      setLotes([]);
      setInsumos([]);
      fetchLotesDeVenta(ventaId)
        .then((l) => vigente && setLotes(l))
        .catch(() => undefined);
      fetchInsumosDeVenta(ventaId)
        .then((i) => vigente && setInsumos(i))
        .catch(() => undefined);
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [ventaId]);

  const insumosDe = (servicioId: string) => insumos.filter((i) => i.servicio_id === servicioId);
  const lotesDeInsumo = (productoId: string, varianteId: string | null) =>
    lotes.filter(
      (l) => l.tipo === "INSUMO" && l.producto_id === productoId && (l.variante_id ?? null) === varianteId
    );

  const lotesDe = (productoId: string, varianteId: string | null) =>
    lotes.filter(
      (l) => l.tipo === "VENTA" && l.producto_id === productoId && (l.variante_id ?? null) === varianteId
    );

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
              {t("reports.sale.title")}
              {venta && ` #${numeroOperacion(venta.id) ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {venta ? fechaLarga(venta.fecha_venta, localeIntl(locale)) : t("common.loading")}
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
                  <span className="text-muted-foreground">{t("reports.history.colCashier")}</span>
                  <p className="font-medium">
                    {venta.cajero_nombre?.trim() || venta.cajero_email || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("reports.history.colCustomer")}</span>
                  <p className="font-medium">
                    {venta.cliente_nombre ?? t("reports.generalCustomer")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("reports.sale.paymentMethod")}</span>
                  <p className="font-medium">
                    {t(clavePagoI18n(venta.metodo_pago))}
                  </p>
                </div>
              </div>

              {/* Una venta marcada para revisión se cobró con un total que no
                  coincide con lo que recalculó el servidor. Quedan las que se
                  marcaron cuando existía la cola de ventas diferidas; el flujo
                  actual no puede producir nuevas, pero el aviso se conserva
                  para que las viejas no pasen desapercibidas. */}
              {venta.requiere_revision && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {t("reports.sale.review")}
                </p>
              )}

              <div className="rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("reports.sale.product")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reports.sale.qty")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reports.sale.price")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reports.sale.amount")}</th>
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
                          {lotesDe(r.producto_id, r.variante_id ?? null).length > 0 && (
                            <span className="block text-[11px] text-muted-foreground">
                              {t("reports.sale.lot", { lotes: textoLotes(lotesDe(r.producto_id, r.variante_id ?? null)) })}
                            </span>
                          )}
                          {insumosDe(r.producto_id).length > 0 && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {t("reports.sale.used")}{" "}
                              {insumosDe(r.producto_id)
                                .map((ins) => {
                                  const lotesIns = lotesDeInsumo(ins.producto_id, ins.variante_id);
                                  return `${Math.round((ins.cantidad + ins.faltante) * 1000) / 1000} ${ins.nombre}${
                                    lotesIns.length > 0 ? ` (${t("reports.sale.lotLower", { lotes: textoLotes(lotesIns) })})` : ""
                                  }`;
                                })
                                .join(" · ")}
                            </span>
                          )}
                          {insumosDe(r.producto_id).some((ins) => ins.faltante > 0) && (
                            <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                              {t("reports.sale.outOfStock")}{" "}
                              {insumosDe(r.producto_id)
                                .filter((ins) => ins.faltante > 0)
                                .map((ins) => `${ins.faltante} ${ins.nombre}`)
                                .join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatearCantidad(Number(r.cantidad), r.unidad_medida)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatear(Number(r.precio_unitario))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatear(Number(r.subtotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
                <span className="text-muted-foreground">
                  {t("reports.sale.subtotal", { monto: formatear(Number(venta.subtotal ?? 0)) })}
                </span>
                {Number(venta.descuento ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    {t("reports.sale.discount", { monto: formatear(Number(venta.descuento)) })}
                  </span>
                )}
                {Number(venta.impuesto ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    {t("reports.sale.tax", { monto: formatear(Number(venta.impuesto)) })}
                  </span>
                )}
                <span className="text-sm font-semibold">
                  {t("reports.sale.total", { monto: formatear(Number(venta.total)) })}
                </span>
                {venta.monto_recibido !== null && (
                  <>
                    <span className="text-muted-foreground">
                      {t("reports.sale.received", { monto: formatear(Number(venta.monto_recibido)) })}
                    </span>
                    <span className="text-muted-foreground">
                      {t("reports.sale.change", { monto: formatear(Number(venta.cambio ?? 0)) })}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.close")}
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
                    cobro_original: venta.cajero_nombre?.trim() || venta.cajero_email,
                  },
                });
              }}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              {t("reports.sale.reprint")}
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
  const t = useTranslations("reports.saleStatus");
  if (estado === "COMPLETADA") return null;
  return (
    <Badge variant="secondary" className="text-[10px]">
      {t.has(estado) ? t(estado) : estado}
    </Badge>
  );
}
