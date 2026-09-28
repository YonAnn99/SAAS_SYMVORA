"use client";

/**
 * El desglose de una orden de compra: lo pedido, lo que ya llego, las compras
 * que genero cada recepcion y el PDF que se le mando al proveedor. Mismo
 * patron que el detalle de una venta en Reportes: se abre al hacer clic en la
 * fila.
 */

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
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
  fetchOrderFullDetail,
  orderEstadoColors,
  orderEstadoLabels,
  type OrdenDetalle,
} from "../../services/purchase-order-service";
import { correoDeMiembro } from "../../services/purchase-service";
import {
  datosPdfDeOrden,
  descargarPdf,
  generarPdfOrdenCompra,
  nombreConVariante,
} from "../../purchase-order-pdf";
import {
  DatoDetalle,
  TablaRenglones,
  fechaLarga,
  fechaSinHora,
} from "../detalle-pedido";

interface PurchaseOrderDetailDialogProps {
  /** Id de la orden a mostrar, o `null` para cerrar. */
  ordenId: string | null;
  tenantId: string;
  /** Para el encabezado del PDF. */
  nombreNegocio: string;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailDialog({
  ordenId,
  tenantId,
  nombreNegocio,
  onOpenChange,
}: PurchaseOrderDetailDialogProps) {
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [creador, setCreador] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!ordenId) return;
    let vigente = true;
    // Diferido, convención del repo: setState síncrono en un efecto encadena
    // renders.
    const t0 = window.setTimeout(async () => {
      setCargando(true);
      setOrden(null);
      setCreador(null);
      const detalle = await fetchOrderFullDetail(ordenId);
      const correo = detalle
        ? await correoDeMiembro(tenantId, detalle.usuario_id)
        : null;
      if (!vigente) return;
      setOrden(detalle);
      setCreador(correo);
      setCargando(false);
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [ordenId, tenantId]);

  const descargar = () => {
    if (!orden) return;
    const pdf = generarPdfOrdenCompra(
      datosPdfDeOrden({
        negocio: nombreNegocio,
        proveedor: orden.proveedor?.nombre ?? "",
        orden,
        renglones: orden.detalle.map((d) => ({
          ...d,
          nombre: nombreConVariante(d.producto?.nombre ?? "Producto", d.variante),
        })),
      })
    );
    descargarPdf(pdf, `Orden-${orden.numero_orden}.pdf`);
  };

  const impuesto = Number(orden?.impuesto ?? 0);

  return (
    <Dialog open={Boolean(ordenId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Orden {orden?.numero_orden ?? ""}
            {orden && (
              <Badge
                className={`${orderEstadoColors[orden.estado]} px-1.5 py-0 text-[10px]`}
              >
                {orderEstadoLabels[orden.estado]}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {orden ? `Creada el ${fechaLarga(orden.creado_en)}` : "Cargando..."}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!cargando && !orden && ordenId && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se encontró la orden.
          </p>
        )}

        {!cargando && orden && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <DatoDetalle etiqueta="Proveedor">
                {orden.proveedor?.nombre ?? "—"}
                {orden.proveedor?.telefono && (
                  <span className="block font-normal text-muted-foreground">
                    {orden.proveedor.telefono}
                  </span>
                )}
              </DatoDetalle>
              <DatoDetalle etiqueta="Sucursal destino">
                {orden.sucursal?.nombre ?? "—"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Creada por">{creador ?? "—"}</DatoDetalle>
              <DatoDetalle etiqueta="Entrega estimada">
                {orden.fecha_estimada_recepcion
                  ? fechaSinHora(orden.fecha_estimada_recepcion)
                  : "—"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Recepción">
                {orden.fecha_recepcion ? fechaLarga(orden.fecha_recepcion) : "—"}
              </DatoDetalle>
            </div>

            <TablaRenglones
              renglones={orden.detalle.map((d) => ({
                producto: d.producto,
                variante: d.variante,
                cantidad: Number(d.cantidad_solicitada),
                recibido: Number(d.cantidad_recibida),
                costo: Number(d.costo_unitario),
                importe: Number(d.subtotal),
              }))}
            />

            <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
              <span className="text-muted-foreground">
                Subtotal: {formatMXN(Number(orden.subtotal))}
              </span>
              <span className="text-muted-foreground">
                {impuesto > 0 ? `IVA: ${formatMXN(impuesto)}` : "Sin IVA"}
              </span>
              <span className="text-sm font-semibold">
                Total: {formatMXN(Number(orden.total))}
              </span>
            </div>

            {orden.notas?.trim() && (
              <DatoDetalle etiqueta="Notas">
                <span className="whitespace-pre-line font-normal">
                  {orden.notas}
                </span>
              </DatoDetalle>
            )}

            {/* Cada recepcion registra una compra; con entregas parciales hay
                varias. Es la liga entre la orden y lo que entro al stock. */}
            {orden.recepciones.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">Recepciones</span>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {orden.recepciones.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span>
                        {fechaLarga(c.fecha_compra)}
                        {c.numero_factura && (
                          <span className="text-muted-foreground">
                            {" "}
                            · Factura {c.numero_factura}
                          </span>
                        )}
                        {c.estado === "CANCELADA" && (
                          <span className="text-destructive"> · Cancelada</span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatMXN(Number(c.total))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button variant="outline" disabled={!orden} onClick={descargar}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
