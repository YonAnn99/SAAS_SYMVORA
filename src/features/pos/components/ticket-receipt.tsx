"use client";

import { useTranslations } from "next-intl";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SaleReceipt } from "../types/pos.types";

const PAYMENT_LABEL_KEY: Record<string, string> = {
  EFECTIVO: "CASH",
  TARJETA: "CARD",
  TRANSFERENCIA: "TRANSFER",
  CREDITO: "CREDIT",
  TARJETA_TERMINAL: "TERMINAL",
};

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
  const t = useTranslations();
  const { tenantName } = useCurrentTenant();
  if (!receipt) return null;
  const date = new Date().toLocaleString();
  const paymentLabel = t(
    `pos.paymentMethods.${PAYMENT_LABEL_KEY[receipt.paymentMethod] ?? receipt.paymentMethod}`
  );

  const handleSendWhatsapp = () => {
    const lines = [
      `*${tenantName}*`,
      `Fecha: ${date}`,
      "---",
      ...receipt.items.map(
        (item) =>
          `- ${item.nombre} x${item.cantidad}  $${(item.precioUnitario * item.cantidad).toFixed(2)}`
      ),
      "---",
      `Total: $${receipt.total.toFixed(2)}`,
      `Método de pago: ${paymentLabel}`,
    ];
    if (receipt.montoRecibido != null) {
      lines.push(`Recibido: $${receipt.montoRecibido.toFixed(2)}`);
    }
    if (receipt.cambio != null) {
      lines.push(`Cambio: $${receipt.cambio.toFixed(2)}`);
    }
    if (receipt.customerName) {
      lines.push(`Cliente: ${receipt.customerName}`);
    }
    lines.push("", t("pos.thanksMessage"));

    window.open(buildWhatsAppLink(lines.join("\n"), receipt.customerPhone), "_blank");
  };

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
            <span>{paymentLabel}</span>
          </div>
          {receipt.montoRecibido != null && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("pos.amountReceived")}</span>
              <span className="font-mono">${receipt.montoRecibido.toFixed(2)}</span>
            </div>
          )}
          {receipt.cambio != null && (
            <div className="flex justify-between text-xs font-medium">
              <span>{t("pos.change")}</span>
              <span className="font-mono">${receipt.cambio.toFixed(2)}</span>
            </div>
          )}
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
            variant="outline"
            className="h-8 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Aceptar
          </Button>
          <SpecularActionButton
            tone="money"
            className="h-8 w-full sm:w-auto"
            onClick={handleSendWhatsapp}
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            {t("pos.sendWhatsapp")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}