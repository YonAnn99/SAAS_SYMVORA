"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const t = useTranslations();
  const [saldoReal, setSaldoReal] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const diferencia = (parseFloat(saldoReal) || 0) - saldoEsperado;
  const diferenciaNegativa = diferencia < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Cerrar caja</DialogTitle>
          <DialogDescription className="text-xs">
            Ingresa el saldo real para cerrar la caja
          </DialogDescription>
        </DialogHeader>
        {register && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fondo inicial</span>
                <span className="font-mono">
                  ${register.fondo_inicial.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventas</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  +${totalVentas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entradas</span>
                <span className="font-mono text-[#346538] dark:text-[#7BC67E]">
                  +${totalEntradas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salidas</span>
                <span className="font-mono text-[#9F2F2D] dark:text-[#F2A5A4]">
                  -${totalSalidas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Saldo esperado</span>
                <span className="font-mono">${saldoEsperado.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Saldo real (contado) *</Label>
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
                Diferencia: ${Math.abs(diferencia).toFixed(2)}{" "}
                {diferenciaNegativa ? "(faltante)" : "(sobrante)"}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas de cierre</Label>
              <Input
                placeholder="Observaciones (opcional)"
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
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={() =>
              onConfirm(parseFloat(saldoReal) || 0, closingNotes)
            }
          >
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}