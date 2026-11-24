"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useSucursal } from "@/contexts/sucursal-context";
import { abrirCaja } from "../hooks/use-cash-register";

interface OpenRegisterRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: () => void;
}

/**
 * Ventana emergente que se muestra cuando un usuario intenta acceder al Punto de Venta
 * sin tener una caja abierta. Permite abrirla con 1 clic aquí mismo o ir a Finanzas.
 */
export function OpenRegisterRequiredDialog({
  open,
  onOpenChange,
  onCancel,
}: OpenRegisterRequiredDialogProps) {
  const router = useRouter();
  const t = useTranslations("finances.required");
  const { tenantId } = useCurrentTenant();
  const { seleccionada: sucursalId } = useSucursal();

  const [fondo, setFondo] = useState("0");
  const [opening, setOpening] = useState(false);

  const handleAbrirRapido = async () => {
    if (!tenantId) return;
    setOpening(true);
    try {
      const monto = Math.max(0, parseFloat(fondo) || 0);
      const caja = await abrirCaja(tenantId, monto, sucursalId);
      if (caja) {
        onOpenChange(false);
      }
    } finally {
      setOpening(false);
    }
  };

  const handleGoToFinances = () => {
    onOpenChange(false);
    router.push("/finances");
  };

  const handleCancel = () => {
    onOpenChange(false);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center gap-3 text-center sm:text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-base font-semibold">
              {t("dialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("dialogDesc")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Apertura express en 1 clic */}
        <div className="rounded-lg border bg-muted/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Apertura rápida (Fondo inicial):
            </span>
            <span className="text-[11px] text-muted-foreground">Efectivo en cajón</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="50"
                value={fondo}
                onChange={(e) => setFondo(e.target.value)}
                className="pl-6 h-9 text-sm"
                placeholder="0"
                disabled={opening}
              />
            </div>
            <div className="flex gap-1">
              {["0", "200", "500"].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={fondo === preset ? "default" : "outline"}
                  className="h-9 px-2.5 text-xs font-normal"
                  onClick={() => setFondo(preset)}
                  disabled={opening}
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            className="w-full h-9 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            onClick={handleAbrirRapido}
            disabled={opening}
          >
            {opening ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Abriendo caja...
              </>
            ) : (
              "Abrir caja y empezar a cobrar aquí"
            )}
          </Button>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground cursor-pointer"
            onClick={handleCancel}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs text-muted-foreground cursor-pointer"
            onClick={handleGoToFinances}
          >
            {t("goOpen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
