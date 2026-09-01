"use client";

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
import type { VarianteProducto } from "../../types/inventory.types";

interface VariantDeleteDialogProps {
  variant: VarianteProducto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (variant: VarianteProducto) => void;
}

export function VariantDeleteDialog({
  variant,
  onOpenChange,
  onConfirm,
}: VariantDeleteDialogProps) {
  return (
    <Dialog open={Boolean(variant)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Eliminar variante</DialogTitle>
          <DialogDescription className="text-xs">
            ¿Estás seguro de eliminar esta variante? Esta acción no se puede
            deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <SpecularActionButton
            tone="destructive"
            className="h-8"
            onClick={() => variant && onConfirm(variant)}
          >
            Eliminar
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}