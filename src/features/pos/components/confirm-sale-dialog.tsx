"use client";

import { formatearCantidad } from "@/lib/unidades";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { precargarSonidoVenta } from "../celebracion-venta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { CartItem, SaleTotals } from "../types/pos.types";

interface ConfirmSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  totals: SaleTotals;
  selectedPayment: string;
  customerName: string | null;
  processing: boolean;
  includeIva: boolean;
  montoRecibido?: number | null;
  cambio?: number | null;
  /**
   * Registra la venta. Se resuelve si quedo registrada y se rechaza si no:
   * de eso depende que el slider muestre "Venta completada" o el error.
   */
  onConfirm: () => Promise<void>;
  /** Tras la animacion de exito, con la posicion del slider (origen del destello). */
  onVentaConfirmada?: (origen: DOMRect | null) => void;
}

export function ConfirmSaleDialog({
  open,
  onOpenChange,
  items,
  totals,
  selectedPayment,
  customerName,
  processing,
  includeIva,
  montoRecibido,
  cambio,
  onConfirm,
  onVentaConfirmada,
}: ConfirmSaleDialogProps) {
  const t = useTranslations();
  useEffect(() => {
    if (open) precargarSonidoVenta();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Confirmar venta</DialogTitle>
          <DialogDescription className="text-xs">
            Revisa los detalles antes de completar la venta
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3 space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span>
                  {item.nombre} x{formatearCantidad(item.cantidad, item.unidad_medida)}
                </span>
                <span className="font-mono">
                  ${(item.precioUnitario * item.cantidad).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.descuento > 0 && (
            <div className="flex justify-between text-xs text-destructive">
              <span>{t("common.discount")}</span>
              <span className="font-mono">-${totals.descuento.toFixed(2)}</span>
            </div>
          )}
          {includeIva && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">IVA (16%)</span>
              <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">${totals.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Método de pago</span>
            <span>{selectedPayment}</span>
          </div>
          {montoRecibido != null && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("pos.amountReceived")}</span>
              <span className="font-mono">${montoRecibido.toFixed(2)}</span>
            </div>
          )}
          {cambio != null && (
            <div className="flex justify-between text-xs font-medium">
              <span>{t("pos.change")}</span>
              <span className="font-mono">${cambio.toFixed(2)}</span>
            </div>
          )}
          {customerName && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cliente</span>
              <span>{customerName}</span>
            </div>
          )}
        </div>
        {/* Slide Commit de React Bits: se desliza para cobrar. Mientras se
            registra la venta la manija gira; al quedar, se vuelve la pastilla
            verde "Venta completada" (y la pagina suena y destella). */}
        <div className="flex flex-col items-stretch gap-2">
          <DeslizarParaConfirmar
            label={`Desliza para cobrar $${totals.total.toFixed(2)}`}
            doneLabel="Venta completada"
            successColor="#22c55e"
            disabled={items.length === 0}
            onConfirm={onConfirm}
            onDone={onVentaConfirmada}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 self-center text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}