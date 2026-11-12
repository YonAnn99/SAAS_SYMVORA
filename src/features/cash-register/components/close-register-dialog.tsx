"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useTranslations } from "next-intl";
import { useState } from "react";
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
import type { Caja } from "../types/cash-register.types";

interface CloseRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: Caja | null;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
  onConfirm: (saldoReal: number, notasCierre: string) => void;
}

export function CloseRegisterDialog({
  open,
  onOpenChange,
  register,
  totalVentas,
  totalEntradas,
  totalSalidas,
  saldoEsperado,
  onConfirm,
}: CloseRegisterDialogProps) {
  const { formatear } = useMoneda();
  const t = useTranslations();
  const [saldoReal, setSaldoReal] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const diferencia = (parseFloat(saldoReal) || 0) - saldoEsperado;
  const diferenciaNegativa = diferencia < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{t("finances.close.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("finances.close.desc")}
          </DialogDescription>
        </DialogHeader>
        {register && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.initialFund")}</span>
                <span className="font-mono">
                  {formatear(register.fondo_inicial)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("finances.close.sales")}</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  +{formatear(totalVentas)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("finances.close.inflows")}</span>
                <span className="font-mono text-[#346538] dark:text-[#7BC67E]">
                  +{formatear(totalEntradas)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("finances.close.outflows")}</span>
                <span className="font-mono text-[#9F2F2D] dark:text-[#F2A5A4]">
                  -{formatear(totalSalidas)}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("finances.close.expected")}</span>
                <span className="font-mono">{formatear(saldoEsperado)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("finances.close.actual")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={saldoReal}
                onChange={(e) => setSaldoReal(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            {saldoReal && (
              <div
                className={`rounded-lg p-3 text-sm font-medium ${
                  diferencia >= 0
                    ? "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                    : "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]"
                }`}
              >
                {t(diferenciaNegativa ? "finances.close.shortage" : "finances.close.surplus", {
                  monto: formatear(Math.abs(diferencia)),
                })}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("finances.close.notes")}</Label>
              <Input
                placeholder={t("finances.close.notesPlaceholder")}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <SpecularActionButton
            tone="destructive"
            className="h-8"
            onClick={() =>
              onConfirm(parseFloat(saldoReal) || 0, closingNotes)
            }
          >
            {t("finances.close.title")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}