"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Banknote,
  Check,
  Loader2,
} from "lucide-react";
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
import type { TerminalOrderState, TerminalStatus } from "../types/pos.types";

interface TerminalPaymentDialogProps {
  status: TerminalStatus;
  order: TerminalOrderState | null;
  cancelling: boolean;
  onCancel: () => void;
  onClose: () => void;
}

export function TerminalPaymentDialog({
  status,
  order,
  cancelling,
  onCancel,
  onClose,
}: TerminalPaymentDialogProps) {
  const { formatear } = useMoneda();
  const t = useTranslations("pos.terminal");
  return (
    <Dialog
      open={status !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {status === "waiting" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {t("waiting")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("waitingHint")}
                </p>
              </div>
              <p className="font-mono text-xl font-semibold">
                {formatear(order?.monto ?? 0)}
              </p>
            </>
          )}
          {status === "pagado" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t("paid")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("paidHint")}
                </p>
              </div>
              <p className="font-mono text-xl font-semibold">
                {formatear(order?.monto ?? 0)}
              </p>
            </>
          )}
          {status === "rechazada" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-center">
                {t("rejected")}
              </p>
            </>
          )}
          {status === "cancelada" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Banknote className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-center">{t("cancelled")}</p>
            </>
          )}
          {status === "timeout" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-center">
                {t("timeout")}
              </p>
            </>
          )}
          {status === "error" && (
            <p className="text-sm text-center">
              {t("error")}
            </p>
          )}
        </div>
        <DialogFooter>
          {status === "waiting" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? t("cancelling") : t("cancelCharge")}
            </Button>
          )}
          {(status === "timeout" ||
            status === "rechazada" ||
            status === "error") && (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
                {t("close")}
              </Button>
              {status === "timeout" && (
                <SpecularActionButton
                  tone="destructive"
                  className="h-8"
                  onClick={onCancel}
                  disabled={cancelling}
                >
                  {cancelling ? t("cancelling") : t("cancelCharge")}
                </SpecularActionButton>
              )}
            </>
          )}
          {(status === "pagado" || status === "cancelada") && (
            <SpecularActionButton tone="add" className="h-8" onClick={onClose}>
              {t("accept")}
            </SpecularActionButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}