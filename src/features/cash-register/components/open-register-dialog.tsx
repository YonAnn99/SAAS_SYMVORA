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

interface OpenRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fondoInicial: number) => void;
}

export function OpenRegisterDialog({
  open,
  onOpenChange,
  onConfirm,
}: OpenRegisterDialogProps) {
  const t = useTranslations();
  const [initialFund, setInitialFund] = useState("");

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
            onClick={() => onConfirm(parseFloat(initialFund) || 0)}
          >
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}