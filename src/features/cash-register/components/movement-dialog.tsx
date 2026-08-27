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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    tipo: "ENTRADA" | "SALIDA",
    monto: number,
    descripcion: string
  ) => void;
}

export function MovementDialog({
  open,
  onOpenChange,
  onConfirm,
}: MovementDialogProps) {
  const t = useTranslations();
  const [movementType, setMovementType] = useState<"ENTRADA" | "SALIDA">(
    "ENTRADA"
  );
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("finances.addMovement")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registra un movimiento de entrada o salida
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.status")}</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as "ENTRADA" | "SALIDA")}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">
                  {t("finances.movementTypes.ENTRADA")}
                </SelectItem>
                <SelectItem value="SALIDA">
                  {t("finances.movementTypes.SALIDA")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.total")}</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.description")}</Label>
            <Input
              placeholder="Descripción del movimiento"
              value={movementDescription}
              onChange={(e) => setMovementDescription(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
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
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={() =>
              onConfirm(
                movementType,
                parseFloat(movementAmount) || 0,
                movementDescription
              )
            }
          >
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}