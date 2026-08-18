"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { SaleReceipt } from "../types/pos.types";

interface TicketReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: SaleReceipt | null;
}

export function TicketReceipt({
  open,
  onOpenChange,
  receipt,
}: TicketReceiptProps) {
  if (!receipt) return null;
  const date = new Date().toLocaleString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Check className="h-4 w-4 text-emerald-500" />
            Venta completada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3 space-y-1.5">
            {receipt.items.map((item) => (
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
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">${receipt.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Método de pago</span>
            <span>{receipt.paymentMethod}</span>
          </div>
          {receipt.customerName && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cliente</span>
              <span>{receipt.customerName}</span>
            </div>
          )}
          <div className="text-right text-xs font-mono text-muted-foreground">
            {date}
          </div>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            className="h-8 w-full"
            onClick={() => onOpenChange(false)}
          >
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}