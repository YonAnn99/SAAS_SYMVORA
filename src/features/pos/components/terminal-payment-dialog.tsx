"use client";

import {
  AlertTriangle,
  Banknote,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <Dialog
      open={status !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Cobro con terminal</DialogTitle>
          <DialogDescription className="text-xs">
            Pago por tarjeta con terminal Mercado Pago Point
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {status === "waiting" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Esperando pago en la terminal…
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicita al cliente que acerque su tarjeta o dispositivo
                </p>
              </div>
              <p className="font-mono text-xl font-semibold">
                ${order?.monto.toFixed(2)}
              </p>
            </>
          )}
          {status === "pagado" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Pago recibido</p>
                <p className="text-xs text-muted-foreground mt-1">
                  La venta se registró correctamente
                </p>
              </div>
              <p className="font-mono text-xl font-semibold">
                ${order?.monto.toFixed(2)}
              </p>
            </>
          )}
          {status === "rechazada" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-center">
                El pago fue rechazado en la terminal. Puedes intentar de nuevo.
              </p>
            </>
          )}
          {status === "cancelada" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Banknote className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-center">Cobro cancelado.</p>
            </>
          )}
          {status === "timeout" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-center">
                La terminal no respondió. Puedes cancelar el cobro o cerrar.
              </p>
            </>
          )}
          {status === "error" && (
            <p className="text-sm text-center">
              Ocurrió un error con el cobro.
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
              {cancelling ? "Cancelando..." : "Cancelar cobro"}
            </Button>
          )}
          {(status === "timeout" ||
            status === "rechazada" ||
            status === "error") && (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
                Cerrar
              </Button>
              {status === "timeout" && (
                <Button
                  size="sm"
                  className="h-8"
                  onClick={onCancel}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelando..." : "Cancelar cobro"}
                </Button>
              )}
            </>
          )}
          {(status === "pagado" || status === "cancelada") && (
            <Button size="sm" className="h-8" onClick={onClose}>
              Aceptar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}