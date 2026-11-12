"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type { Cliente } from "@/lib/types/database";
import type { CreditMetodoPago } from "../types/customer.types";
import {
  fetchCustomers,
  getCurrentUserId,
  registerCreditPayment,
} from "../services/customer-service";
import { guardarCache, leerCache } from "@/lib/cache-datos";

const claveClientes = (tenantId: string | null) => ["clientes", tenantId] as const;

export function useCustomers(tenantId: string | null) {
  const { formatear } = useMoneda();
  const t = useTranslations("customers.msg");
  // Cache entre modulos (`lib/cache-datos.ts`): al volver se pinta la lista
  // anterior y `refresh` la reemplaza en cuanto llega.
  const [customers, setCustomers] = useState<Cliente[]>(
    () => leerCache<Cliente[]>(claveClientes(tenantId)) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [paymentDialogFor, setPaymentDialogFor] = useState<Cliente | null>(
    null
  );
  const [savingPayment, setSavingPayment] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    // Con lista en cache no se muestra el "cargando": se actualiza por detras.
    if (!leerCache(claveClientes(tenantId))) setLoading(true);
    try {
      const data = await fetchCustomers(tenantId);
      setCustomers(data);
      guardarCache(claveClientes(tenantId), data);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const handleRegisterPayment = useCallback(
    async (monto: number, metodoPago: CreditMetodoPago, notas: string) => {
      if (!tenantId || !paymentDialogFor) return;
      if (!(monto > 0)) {
        toast.error(t("amountPositive"));
        return;
      }
      setSavingPayment(true);
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          toast.error(t("noUser"));
          return;
        }
        await registerCreditPayment({
          tenantId,
          usuarioId: userId,
          clienteId: paymentDialogFor.id,
          monto,
          metodoPago,
          notas: notas.trim() || undefined,
        });
        await logActivity({
          action: "UPDATE",
          entity: "cliente",
          entityId: paymentDialogFor.id,
          entityName: paymentDialogFor.nombre,
          details: { tipo: "pago_credito", monto, metodo_pago: metodoPago },
        });
        toast.success(
          t("paymentRecorded", { monto: formatear(monto), nombre: paymentDialogFor.nombre })
        );
        setPaymentDialogFor(null);
        void refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("paymentError")
        );
      } finally {
        setSavingPayment(false);
      }
    },
    [tenantId, paymentDialogFor, refresh, t, formatear]
  );

  return {
    customers,
    loading,
    refresh,
    paymentDialogFor,
    setPaymentDialogFor,
    savingPayment,
    handleRegisterPayment,
  };
}