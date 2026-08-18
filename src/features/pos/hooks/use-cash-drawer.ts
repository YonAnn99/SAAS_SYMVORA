"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelTerminalOrder,
  createTerminalOrder,
  getTerminalOrderStatus,
} from "@/features/payments/services/mercadopago/browser";
import type { CartItem, TerminalOrderState, TerminalStatus } from "../types/pos.types";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 48;

interface UseCashDrawerParams {
  tenantId: string | null;
  tenantReady: boolean;
  onSaleCompleted: () => void;
  onTerminalStarted: () => void;
}

export interface CashDrawerState {
  mpReady: boolean | null;
  terminalOrder: TerminalOrderState | null;
  terminalStatus: TerminalStatus;
  cancellingTerminal: boolean;
  startTerminalSale: (clienteId: string | null, items: CartItem[]) => Promise<void>;
  handleCancelTerminal: () => Promise<void>;
  closeTerminalDialog: () => Promise<void>;
}

export function useCashDrawer({
  tenantId,
  tenantReady,
  onSaleCompleted,
  onTerminalStarted,
}: UseCashDrawerParams): CashDrawerState {
  const [mpReady, setMpReady] = useState<boolean | null>(null);
  const [terminalOrder, setTerminalOrder] = useState<TerminalOrderState | null>(
    null
  );
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>(null);
  const [cancellingTerminal, setCancellingTerminal] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);
  const cancelPendingRef = useRef<() => Promise<boolean>>(async () => false);

  useEffect(() => {
    if (!tenantReady) return;
    let cancelled = false;
    fetch("/api/mercadopago/config", { method: "GET" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const cfg = data?.config;
        setMpReady(
          Boolean(
            cfg?.habilitado &&
              cfg?.access_token_set &&
              cfg?.webhook_secret_set &&
              cfg?.terminal_id
          )
        );
      })
      .catch(() => {
        if (!cancelled) setMpReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantReady]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const cancelTerminalOrderIfPending = useCallback(async () => {
    if (!tenantId || !terminalOrder) return false;
    if (terminalStatus !== "waiting" && terminalStatus !== "timeout") {
      return false;
    }
    stopPolling();
    try {
      const result = await cancelTerminalOrder(
        tenantId,
        terminalOrder.mpOrderId
      );
      return Boolean(result.pagado);
    } catch {
      return false;
    }
  }, [tenantId, terminalOrder, terminalStatus, stopPolling]);

  useEffect(() => {
    cancelPendingRef.current = cancelTerminalOrderIfPending;
  }, [cancelTerminalOrderIfPending]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
      // Al desmontar con una orden pendiente de pago, se cancela la orden
      // en Mercado Pago para que un pago tardio no cree una venta fantasma.
      void cancelPendingRef.current();
    };
  }, []);

  const startPolling = useCallback(
    (mpOrderId: string, monto: number) => {
      let pollsElapsed = 0;
      stopPolling();
      pollIntervalRef.current = window.setInterval(async () => {
        if (!tenantId) return;
        pollsElapsed += 1;
        if (pollsElapsed > MAX_POLLS) {
          stopPolling();
          setTerminalStatus("timeout");
          // Cancelar la orden en MP: un pago tardio no debe crear una venta fantasma.
          const pagado = await cancelTerminalOrderIfPending();
          if (pagado) {
            setTerminalStatus("pagado");
            toast.success("El pago ya fue procesado en la terminal");
            onSaleCompleted();
          }
          return;
        }
        try {
          const status = await getTerminalOrderStatus(tenantId, mpOrderId);
          if (status.estado === "PAGADA") {
            stopPolling();
            setTerminalStatus("pagado");
            toast.success(`Pago recibido en terminal: $${monto.toFixed(2)}`);
            onSaleCompleted();
          } else if (status.estado === "RECHAZADA") {
            stopPolling();
            setTerminalStatus("rechazada");
          } else if (status.estado === "CANCELADA") {
            stopPolling();
            setTerminalStatus("cancelada");
          }
        } catch {
          // Errores transitorios de red se ignoran durante el polling
        }
      }, POLL_INTERVAL_MS);
    },
    [tenantId, stopPolling, cancelTerminalOrderIfPending, onSaleCompleted]
  );

  const startTerminalSale = useCallback(
    async (clienteId: string | null, items: CartItem[]) => {
      if (!tenantId) return;
      try {
        // Si queda una orden previa pendiente/timeout, se cancela antes de
        // crear otra: evita que un pago tardio cree venta + stock fantasma.
        if (
          terminalOrder &&
          (terminalStatus === "waiting" || terminalStatus === "timeout")
        ) {
          await cancelTerminalOrderIfPending();
        }
        const order = await createTerminalOrder({
          tenantId,
          clienteId,
          items: items.map((item) => ({
            productId: item.productId,
            cantidad: item.cantidad,
            descuento: item.descuento,
          })),
        });
        onTerminalStarted();
        setTerminalOrder({ mpOrderId: order.mp_order_id, monto: order.monto });
        setTerminalStatus("waiting");
        startPolling(order.mp_order_id, order.monto);
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Error al iniciar el cobro con terminal"
        );
      }
    },
    [
      tenantId,
      terminalOrder,
      terminalStatus,
      cancelTerminalOrderIfPending,
      onTerminalStarted,
      startPolling,
    ]
  );

  const handleCancelTerminal = useCallback(async () => {
    if (!tenantId || !terminalOrder) return;
    setCancellingTerminal(true);
    try {
      const result = await cancelTerminalOrder(
        tenantId,
        terminalOrder.mpOrderId
      );
      stopPolling();
      if (result.pagado) {
        setTerminalStatus("pagado");
        toast.success("El pago ya fue procesado en la terminal");
        onSaleCompleted();
      } else {
        setTerminalStatus("cancelada");
        toast.info("Cobro cancelado");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error al cancelar el cobro"
      );
    } finally {
      setCancellingTerminal(false);
    }
  }, [tenantId, terminalOrder, stopPolling, onSaleCompleted]);

  const closeTerminalDialog = useCallback(async () => {
    if (terminalStatus === "waiting") return;
    stopPolling();
    if (terminalStatus === "timeout") {
      const pagado = await cancelTerminalOrderIfPending();
      if (pagado) {
        toast.success("El pago ya fue procesado en la terminal");
        onSaleCompleted();
      }
    }
    setTerminalOrder(null);
    setTerminalStatus(null);
  }, [
    terminalStatus,
    stopPolling,
    cancelTerminalOrderIfPending,
    onSaleCompleted,
  ]);

  return {
    mpReady,
    terminalOrder,
    terminalStatus,
    cancellingTerminal,
    startTerminalSale,
    handleCancelTerminal,
    closeTerminalDialog,
  };
}