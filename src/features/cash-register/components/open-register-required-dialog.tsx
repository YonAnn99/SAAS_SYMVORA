"use client";

import { Wallet } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
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

interface OpenRegisterRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: () => void;
}

/**
 * Ventana emergente que se muestra cuando un usuario intenta acceder al Punto de Venta
 * sin tener una caja abierta.
 */
export function OpenRegisterRequiredDialog({
  open,
  onOpenChange,
  onCancel,
}: OpenRegisterRequiredDialogProps) {
  const router = useRouter();

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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-base font-semibold">
              Apertura de caja requerida
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Para utilizar el Punto de Venta necesitas tener una caja abierta.
              Esto asegura que todas las ventas y cobros queden registrados
              correctamente en el corte del día.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs cursor-pointer"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <SpecularActionButton
            tone="money"
            className="h-8 text-xs font-medium cursor-pointer"
            onClick={handleGoToFinances}
          >
            Ir a Finanzas y abrir caja
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
