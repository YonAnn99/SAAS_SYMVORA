"use client";

import { useTranslations } from "next-intl";
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
import type { Producto } from "../../types/inventory.types";

interface ProductDeleteDialogProps {
  product: Producto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (product: Producto) => void;
}

export function ProductDeleteDialog({
  product,
  onOpenChange,
  onConfirm,
}: ProductDeleteDialogProps) {
  const t = useTranslations();

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Eliminar producto</DialogTitle>
          <DialogDescription className="text-xs">
            ¿Estás seguro de eliminar <strong>{product?.nombre}</strong>? Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
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
            onClick={() => product && onConfirm(product)}
          >
            Eliminar
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}