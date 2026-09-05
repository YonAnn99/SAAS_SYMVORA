"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Cliente } from "@/lib/types/database";
import type { CreditMetodoPago } from "../types/customer.types";

interface CreditPaymentDialogProps {
  cliente: Cliente | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    monto: number,
    metodoPago: CreditMetodoPago,
    notas: string
  ) => void;
  saving: boolean;
}

export function CreditPaymentDialog({
  cliente,
  onOpenChange,
  onConfirm,
  saving,
}: CreditPaymentDialogProps) {
  const t = useTranslations();
  const [metodoPago, setMetodoPago] = useState<CreditMetodoPago>("EFECTIVO");
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (cliente) {
      setMetodoPago("EFECTIVO");
      setMonto("");
      setNotas("");
    }
  }, [cliente]);

  const montoNumber = parseFloat(monto) || 0;
  const saldo = cliente?.saldo_pendiente ?? 0;
  const exceedsBalance = montoNumber > saldo;
  const isValid = montoNumber > 0 && !exceedsBalance;

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("finances.addPayment")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {cliente?.nombre} — {t("finances.balance")}: ${saldo.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("customers.paymentMethod")}</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => setMetodoPago(v as CreditMetodoPago)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                <SelectItem value="TARJETA">Tarjeta</SelectItem>
                <SelectItem value="TARJETA_TERMINAL">
                  Tarjeta (terminal)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.total")}</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              max={saldo}
              className="h-8 text-sm font-mono"
            />
            {exceedsBalance && (
              <p className="text-[11px] text-destructive">
                {t("customers.exceedsBalance")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.description")}</Label>
            <Input
              placeholder="Opcional"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <SpecularActionButton
            tone="money"
            className="h-8"
            disabled={!isValid || saving}
            onClick={() => onConfirm(montoNumber, metodoPago, notas)}
          >
            {saving ? "Guardando..." : t("common.confirm")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
