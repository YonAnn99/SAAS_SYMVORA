"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("finances.required");

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
              {t("dialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("dialogDesc")}
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
            {t("cancel")}
          </Button>
          <SpecularActionButton
            tone="money"
            className="h-8 text-xs font-medium cursor-pointer"
            onClick={handleGoToFinances}
          >
            {t("goOpen")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
