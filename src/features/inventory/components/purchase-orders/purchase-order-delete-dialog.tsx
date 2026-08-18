"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrdenCompra } from "../../types/inventory.types";

interface PurchaseOrderDeleteDialogProps {
  order: OrdenCompra | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (order: OrdenCompra) => void;
}

export function PurchaseOrderDeleteDialog({
  order,
  onOpenChange,
  onConfirm,
}: PurchaseOrderDeleteDialogProps) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            Eliminar orden de compra
          </DialogTitle>
          <DialogDescription className="text-xs">
            ¿Estás seguro de eliminar la orden {order?.numero_orden}? Esta
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
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={() => order && onConfirm(order)}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}