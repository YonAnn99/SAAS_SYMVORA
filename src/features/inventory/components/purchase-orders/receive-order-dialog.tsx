"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DetalleOrdenCompra,
  OrdenCompra,
} from "../../types/inventory.types";
import {
  parsearCantidadRecibida,
  pendientePorLinea,
  tasaIvaDeOrden,
  totalesRecepcion,
} from "../../purchase-receipt";
import type { ItemRecepcion } from "../../services/purchase-order-service";

/**
 * El diálogo que faltaba para recibir mercancía.
 *
 * Hasta ahora "Recibir" era un cambio de etiqueta: no sumaba stock ni registraba
 * qué llegó. Esto captura la entrega renglón a renglón y deja que el RPC
 * `recibir_orden_compra` haga el resto en una sola transacción.
 */

interface ReceiveOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrdenCompra | null;
  details: DetalleOrdenCompra[];
  /** Nombre a mostrar en el renglón, ya con la variante si la lleva. */
  nombreProducto: (productoId: string, varianteId: string | null) => string;
  saving: boolean;
  onConfirm: (items: ItemRecepcion[], numeroFactura: string | null) => void;
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function ReceiveOrderDialog({
  open,
  onOpenChange,
  order,
  details,
  nombreProducto,
  saving,
  onConfirm,
}: ReceiveOrderDialogProps) {
  /** Lo que se escribe en cada renglón, como texto. Clave: id del detalle. */
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [numeroFactura, setNumeroFactura] = useState("");

  // Al abrir se precarga cada renglón con lo PENDIENTE: el caso normal es que
  // llegue todo lo que falta, y así recibir completo es un solo clic. Diferido
  // igual que en el resto del proyecto (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      const inicial: Record<string, string> = {};
      for (const d of details) {
        inicial[d.id] = String(pendientePorLinea(d));
      }
      setCantidades(inicial);
      setNumeroFactura("");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, details]);

  const tasaIva = order ? tasaIvaDeOrden(order) : 0;

  const lineas = useMemo(
    () =>
      details.map((d) => {
        const pendiente = pendientePorLinea(d);
        const parseo = parsearCantidadRecibida(cantidades[d.id] ?? "", pendiente);
        return {
          detalle: d,
          pendiente,
          parseo,
          valor: parseo.ok ? parseo.valor : 0,
        };
      }),
    [details, cantidades]
  );

  const errores = lineas.filter((l) => !l.parseo.ok);

  const totales = useMemo(
    () =>
      totalesRecepcion(
        lineas.map((l) => ({
          detalle_id: l.detalle.id,
          cantidad_recibida: l.valor,
          costo_unitario: Number(l.detalle.costo_unitario),
        })),
        tasaIva
      ),
    [lineas, tasaIva]
  );

  const algoQueRecibir = lineas.some((l) => l.valor > 0);

  // Se mira la orden ENTERA, no solo lo que se escribió: un renglón que quedó a
  // medias en una entrega anterior mantiene la orden parcial aunque hoy no se
  // toque.
  const quedaraPendiente = lineas.some(
    (l) =>
      Number(l.detalle.cantidad_recibida) + l.valor <
      Number(l.detalle.cantidad_solicitada)
  );

  function confirmar() {
    const items: ItemRecepcion[] = lineas
      .filter((l) => l.valor > 0)
      .map((l) => ({ detalle_id: l.detalle.id, cantidad_recibida: l.valor }));
    onConfirm(items, numeroFactura.trim() || null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Recibir mercancía {order ? `· ${order.numero_orden}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase">Producto</TableHead>
                <TableHead className="text-right text-xs uppercase">
                  Pedido
                </TableHead>
                <TableHead className="text-right text-xs uppercase">
                  Ya recibido
                </TableHead>
                <TableHead className="text-right text-xs uppercase">
                  Pendiente
                </TableHead>
                <TableHead className="text-right text-xs uppercase">
                  Llegó ahora
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l) => (
                <TableRow key={l.detalle.id}>
                  <TableCell className="text-sm">
                    {nombreProducto(l.detalle.producto_id, l.detalle.variante_id ?? null)}
                    {!l.parseo.ok && (
                      <span className="block text-xs text-destructive">
                        {l.parseo.error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(l.detalle.cantidad_solicitada)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {Number(l.detalle.cantidad_recibida)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {l.pendiente}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      value={cantidades[l.detalle.id] ?? ""}
                      onChange={(e) =>
                        setCantidades((prev) => ({
                          ...prev,
                          [l.detalle.id]: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      // Un renglón ya completo no se puede volver a recibir.
                      disabled={l.pendiente === 0 || saving}
                      aria-invalid={!l.parseo.ok}
                      className="h-7 w-24 text-right font-mono text-sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Número de factura</Label>
          <Input
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
            placeholder="La que trae la mercancía (opcional)"
            disabled={saving}
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal de la entrega</span>
            <span className="font-mono">{money(totales.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA</span>
            <span className="font-mono">{money(totales.impuesto)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
            <span>Total</span>
            <span className="font-mono">{money(totales.total)}</span>
          </div>
        </div>

        {/* Se avisa ANTES de confirmar, no después: recibir parcialmente es
            legítimo, pero conviene saber que la orden seguirá abierta. */}
        {algoQueRecibir && quedaraPendiente && (
          <p className="text-xs text-muted-foreground">
            Quedará como <strong>recibida parcial</strong>: todavía falta
            mercancía por llegar.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={saving || errores.length > 0 || !algoQueRecibir}
          >
            {saving ? "Recibiendo..." : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
