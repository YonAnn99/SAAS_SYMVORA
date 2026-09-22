"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useSucursal } from "@/contexts/sucursal-context";
import {
  fetchLastClosedRegister,
  getCurrentUserId,
} from "../services/cash-register-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OpenRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fondoInicial: number, sucursalId: string | null) => void;
}

export function OpenRegisterDialog({
  open,
  onOpenChange,
  onConfirm,
}: OpenRegisterDialogProps) {
  const t = useTranslations();
  const { tenantId } = useCurrentTenant();
  const { activas, hayVarias } = useSucursal();
  const [initialFund, setInitialFund] = useState("");
  const [lastClosedAmount, setLastClosedAmount] = useState<number | null>(null);
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setInitialFund("");
      setLastClosedAmount(null);
      return;
    }

    // Con un solo local se elige solo: el cajero no tiene por qué contestar una
    // pregunta que solo admite una respuesta. Con varios arranca vacío para que
    // sea una decisión consciente y no un valor heredado del turno anterior.
    setSucursalId(activas.length === 1 ? activas[0].id : null);

    let isCancelled = false;
    async function loadLastClosed() {
      if (!tenantId) return;
      try {
        const userId = await getCurrentUserId();
        if (!userId || isCancelled) return;
        const lastClosed = await fetchLastClosedRegister(userId, tenantId);
        if (!isCancelled && lastClosed && typeof lastClosed.saldo_real === "number") {
          setLastClosedAmount(lastClosed.saldo_real);
        }
      } catch (err) {
        console.error("Error fetching last closed register:", err);
      }
    }

    void loadLastClosed();

    return () => {
      isCancelled = true;
    };
  }, [open, tenantId, activas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{t("pos.openRegister")}</DialogTitle>
          <DialogDescription className="text-xs">
            Ingresa el fondo inicial para abrir la caja
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {hayVarias && (
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="caja-sucursal">
                Sucursal
              </Label>
              <select
                id="caja-sucursal"
                value={sucursalId ?? ""}
                onChange={(e) => setSucursalId(e.target.value || null)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Selecciona una sucursal…</option>
                {activas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Todas las ventas de este turno se contarán en esta sucursal.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t("pos.initialFund")}</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={initialFund}
              onChange={(e) => setInitialFund(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>

          {lastClosedAmount !== null && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setInitialFund(lastClosedAmount.toFixed(2))}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 hover:bg-muted px-2.5 py-1.5 text-xs text-foreground font-medium transition-colors border border-border/60 hover:border-border cursor-pointer group"
              >
                <History className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-muted-foreground group-hover:text-foreground">
                  Usar saldo de cierre anterior:
                </span>
                <span className="font-mono font-semibold text-primary">
                  ${lastClosedAmount.toFixed(2)}
                </span>
              </button>
            </div>
          )}
        </div>
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
            tone="add"
            className="h-8"
            disabled={hayVarias && !sucursalId}
            onClick={() => onConfirm(parseFloat(initialFund) || 0, sucursalId)}
          >
            {t("common.confirm")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}