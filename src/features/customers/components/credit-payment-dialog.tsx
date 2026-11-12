"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clavePagoI18n } from "@/features/pos/ticket-format";
import { useMoneda } from "@/hooks/use-moneda";
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
  const { formatear } = useMoneda();
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
            {cliente?.nombre} — {t("finances.balance")}: {formatear(saldo)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("customers.paymentMethod")}</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => setMetodoPago(v as CreditMetodoPago)}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue>{(v: string) => (v ? t(clavePagoI18n(v)) : "")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">{t(clavePagoI18n("EFECTIVO"))}</SelectItem>
                <SelectItem value="TRANSFERENCIA">{t(clavePagoI18n("TRANSFERENCIA"))}</SelectItem>
                <SelectItem value="TARJETA">{t(clavePagoI18n("TARJETA"))}</SelectItem>
                <SelectItem value="TARJETA_TERMINAL">
                  {t(clavePagoI18n("TARJETA_TERMINAL"))}
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
              placeholder={t("customers.form.optional")}
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
            {saving ? t("customers.form.saving") : t("common.confirm")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
