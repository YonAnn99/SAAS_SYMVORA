"use client";

/**
 * El desglose de una compra: que se compro, a quien, donde entro y cuanto
 * costo. Mismo patron que el detalle de una venta en Reportes
 * (`sale-detail-dialog.tsx`): se abre al hacer clic en la fila.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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
import { formatMXN } from "@/lib/money";
import {
  correoDeMiembro,
  fetchPurchaseDetail,
  purchaseStatusColors,
  type CompraDetalle,
} from "../../services/purchase-service";
import { DatoDetalle, TablaRenglones, fechaLarga } from "../detalle-pedido";

interface PurchaseDetailDialogProps {
  /** Id de la compra a mostrar, o `null` para cerrar. */
  compraId: string | null;
  tenantId: string;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDetailDialog({
  compraId,
  tenantId,
  onOpenChange,
}: PurchaseDetailDialogProps) {
  const t = useTranslations();
  const [compra, setCompra] = useState<CompraDetalle | null>(null);
  const [registro, setRegistro] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!compraId) return;
    let vigente = true;
    // Diferido, convención del repo: setState síncrono en un efecto encadena
    // renders.
    const t0 = window.setTimeout(async () => {
      setCargando(true);
      setCompra(null);
      setRegistro(null);
      const detalle = await fetchPurchaseDetail(compraId);
      const correo = detalle
        ? await correoDeMiembro(tenantId, detalle.usuario_id)
        : null;
      if (!vigente) return;
      setCompra(detalle);
      setRegistro(correo);
      setCargando(false);
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [compraId, tenantId]);

  const impuesto = Number(compra?.impuesto ?? 0);

  return (
    <Dialog open={Boolean(compraId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Compra
            {compra?.numero_factura && ` · Factura ${compra.numero_factura}`}
            {compra && (
              <Badge
                className={`${purchaseStatusColors[compra.estado]} px-1.5 py-0 text-[10px]`}
              >
                {t(`purchases.statuses.${compra.estado}`)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {compra ? fechaLarga(compra.fecha_compra) : "Cargando..."}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!cargando && !compra && compraId && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se encontró la compra.
          </p>
        )}

        {!cargando && compra && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <DatoDetalle etiqueta="Proveedor">
                {compra.proveedor?.nombre ?? "—"}
                {compra.proveedor?.telefono && (
                  <span className="block font-normal text-muted-foreground">
                    {compra.proveedor.telefono}
                  </span>
                )}
              </DatoDetalle>
              <DatoDetalle etiqueta="Número de factura">
                {compra.numero_factura || "—"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Origen">
                {compra.orden
                  ? `Orden ${compra.orden.numero_orden}`
                  : "Compra directa"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Sucursal que recibió">
                {compra.sucursal?.nombre ?? "—"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Registró">{registro ?? "—"}</DatoDetalle>
              <DatoDetalle etiqueta="Recepción">
                {compra.fecha_recepcion ? fechaLarga(compra.fecha_recepcion) : "—"}
              </DatoDetalle>
            </div>

            {compra.renglones.length === 0 ? (
              // Cabeceras de la pantalla vieja, que pedia solo un total: no
              // tienen productos y no movieron inventario.
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Registrada antes del desglose: esta compra no tiene productos
                y no sumó existencias.
              </p>
            ) : (
              <TablaRenglones
                renglones={compra.renglones.map((r) => ({
                  producto: r.producto,
                  variante: r.variante,
                  cantidad: Number(r.cantidad),
                  costo: Number(r.costo_unitario),
                  importe: Number(r.subtotal),
                }))}
              />
            )}

            <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
              {compra.subtotal !== null && (
                <span className="text-muted-foreground">
                  Subtotal: {formatMXN(Number(compra.subtotal))}
                </span>
              )}
              {compra.subtotal !== null && (
                <span className="text-muted-foreground">
                  {impuesto > 0 ? `IVA: ${formatMXN(impuesto)}` : "Sin IVA"}
                </span>
              )}
              <span className="text-sm font-semibold">
                Total: {formatMXN(Number(compra.total))}
              </span>
            </div>

            {compra.notas?.trim() && (
              <DatoDetalle etiqueta="Notas">
                <span className="whitespace-pre-line font-normal">
                  {compra.notas}
                </span>
              </DatoDetalle>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
