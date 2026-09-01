"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onConfirm: () => void;
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
}: ConfirmSaleDialogProps) {
  const t = useTranslations();

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
                  {item.nombre} x{item.cantidad}
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
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            {t("common.cancel")}
          </Button>
          <SpecularActionButton
            tone="money"
            className="h-8"
            onClick={onConfirm}
            disabled={processing}
          >
            {processing ? (
              t("common.loading")
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Completar venta
              </>
            )}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}