"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  cancelTerminalOrder,
  createTerminalOrder,
  getTerminalOrderStatus,
} from "@/features/payments/services/mercadopago/browser";
import { insumosParaRpc } from "@/features/inventory/insumos";
import type { CartItem, TerminalOrderState, TerminalStatus } from "../types/pos.types";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 48;

interface UseCashDrawerParams {
  tenantId: string | null;
  tenantReady: boolean;
  /**
   * La terminal confirmo el pago. `ventaId` es la venta registrada (el numero
   * del ticket); puede faltar si respondio una version vieja del servidor.
   */
  onSaleCompleted: (ventaId: string | null) => void;
  onTerminalStarted: () => void;
}

export interface CashDrawerState {
  mpReady: boolean | null;
  terminalOrder: TerminalOrderState | null;
  terminalStatus: TerminalStatus;
  cancellingTerminal: boolean;
  startTerminalSale: (
    clienteId: string | null,
    items: CartItem[],
    listaPrecioId: string | null,
    includeIva: boolean
  ) => Promise<void>;
  handleCancelTerminal: () => Promise<void>;
  closeTerminalDialog: () => Promise<void>;
}

export function useCashDrawer({
  tenantId,
  tenantReady,
  onSaleCompleted,
  onTerminalStarted,
}: UseCashDrawerParams): CashDrawerState {
  const { formatear, moneda } = useMoneda();
  const t = useTranslations("pos.terminal");
  const [mpReady, setMpReady] = useState<boolean | null>(null);
  const [terminalOrder, setTerminalOrder] = useState<TerminalOrderState | null>(
    null
  );
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>(null);
  const [cancellingTerminal, setCancellingTerminal] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);
  const cancelPendingRef = useRef<
    () => Promise<{ ventaId: string | null } | null>
  >(async () => null);

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

  /**
   * Cancela la orden si sigue pendiente. Devuelve la venta si resulto que el
   * cliente ya habia pagado (`pagado`), o `null` si no.
   */
  const cancelTerminalOrderIfPending = useCallback(async (): Promise<
    { ventaId: string | null } | null
  > => {
    if (!tenantId || !terminalOrder) return null;
    if (terminalStatus !== "waiting" && terminalStatus !== "timeout") {
      return null;
    }
    stopPolling();
    try {
      const result = await cancelTerminalOrder(
        tenantId,
        terminalOrder.mpOrderId
      );
      return result.pagado ? { ventaId: result.venta_id ?? null } : null;
    } catch {
      return null;
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
            toast.success(t("alreadyProcessed"));
            onSaleCompleted(pagado.ventaId);
          }
          return;
        }
        try {
          const status = await getTerminalOrderStatus(tenantId, mpOrderId);
          if (status.estado === "PAGADA") {
            stopPolling();
            setTerminalStatus("pagado");
            toast.success(t("paymentReceived", { monto: formatear(monto) }));
            onSaleCompleted(status.venta_id ?? null);
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
    [tenantId, stopPolling, cancelTerminalOrderIfPending, onSaleCompleted, t, formatear]
  );

  const startTerminalSale = useCallback(
    async (
      clienteId: string | null,
      items: CartItem[],
      listaPrecioId: string | null,
      includeIva: boolean
    ) => {
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
          // Lo mismo que manda el cobro directo (`completeSale`): la variante
          // y los insumos ajustados. El monto lo calcula el servidor con la
          // misma funcion que registra la venta, con el IVA del carrito.
          items: items.map((item) => ({
            productId: item.productId,
            varianteId: item.varianteId ?? null,
            cantidad: item.cantidad,
            descuento: item.descuento,
            ...(item.insumos ? { insumos: insumosParaRpc(item.insumos) } : {}),
          })),
          listaPrecioId,
          includeIva,
        });
        onTerminalStarted();
        setTerminalOrder({ mpOrderId: order.mp_order_id, monto: order.monto });
        setTerminalStatus("waiting");
        startPolling(order.mp_order_id, order.monto);
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("startError")
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
      t,
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
      if (result.enTerminal) {
        // El cobro ya esta en la terminal: se le pidio cancelar o se cancela
        // ahi. Se sigue consultando: el servidor le pregunta a Mercado Pago y
        // esta ventana se cierra sola al quedar cancelada (o pagada).
        toast.info(result.message ?? t("cancelOnTerminal"));
        return;
      }
      stopPolling();
      if (result.pagado) {
        setTerminalStatus("pagado");
        toast.success(t("alreadyProcessed"));
        onSaleCompleted(result.venta_id ?? null);
      } else {
        setTerminalStatus("cancelada");
        toast.info("Cobro cancelado");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("cancelError")
      );
    } finally {
      setCancellingTerminal(false);
    }
  }, [tenantId, terminalOrder, stopPolling, onSaleCompleted, t]);

  const closeTerminalDialog = useCallback(async () => {
    if (terminalStatus === "waiting") return;
    stopPolling();
    if (terminalStatus === "timeout") {
      const pagado = await cancelTerminalOrderIfPending();
      if (pagado) {
        toast.success(t("alreadyProcessed"));
        onSaleCompleted(pagado.ventaId);
      }
    }
    setTerminalOrder(null);
    setTerminalStatus(null);
  }, [
    terminalStatus,
    stopPolling,
    cancelTerminalOrderIfPending,
    onSaleCompleted,
    t,
  ]);

  return {
    // Mercado Pago Point solo cobra en pesos mexicanos: con otra moneda no se
    // ofrece «Tarjeta (terminal)» (la tarjeta manual sigue con terminal externa).
    mpReady: moneda === "MXN" ? mpReady : false,
    terminalOrder,
    terminalStatus,
    cancellingTerminal,
    startTerminalSale,
    handleCancelTerminal,
    closeTerminalDialog,
  };
}