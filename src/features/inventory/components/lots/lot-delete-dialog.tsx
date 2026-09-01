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
import type { Lote } from "../../types/inventory.types";

interface LotDeleteDialogProps {
  lot: Lote | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (lot: Lote) => void;
}

export function LotDeleteDialog({
  lot,
  onOpenChange,
  onConfirm,
}: LotDeleteDialogProps) {
  return (
    <Dialog open={Boolean(lot)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Eliminar lote</DialogTitle>
          <DialogDescription className="text-xs">
            ¿Estás seguro de eliminar este lote? Esta acción no se puede
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
            onClick={() => lot && onConfirm(lot)}
          >
            Eliminar
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}