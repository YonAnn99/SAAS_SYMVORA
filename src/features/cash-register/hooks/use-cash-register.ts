"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type { Caja, MovimientoCaja } from "../types/cash-register.types";
import {
  addMovement,
  calculateRegisterTotals,
  closeRegister,
  fetchActiveRegister,
  fetchMovements,
  fetchVentasTotal,
  getCurrentUserId,
  openRegister,
} from "../services/cash-register-service";
import { notifyCashRegisterChanged } from "./use-open-register";

export interface CashRegisterHookState {
  activeRegister: Caja | null;
  movements: MovimientoCaja[];
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
  loading: boolean;
  showOpenDialog: boolean;
  showMovementDialog: boolean;
  showCloseDialog: boolean;
  setShowOpenDialog: (open: boolean) => void;
  setShowMovementDialog: (open: boolean) => void;
  setShowCloseDialog: (open: boolean) => void;
  refetch: () => Promise<void>;
  handleOpenRegister: (
    fondoInicial: number,
    sucursalId?: string | null
  ) => Promise<Caja | null>;
  handleAddMovement: (
    tipo: "ENTRADA" | "SALIDA",
    monto: number,
    descripcion: string
  ) => Promise<void>;
  handleCloseRegister: (saldoReal: number, notasCierre: string) => Promise<void>;
}

/**
 * Abre la caja del usuario, con los avisos y el registro de actividad. Fuera
 * del hook para que el punto de venta la abra sin cargar todo el estado de
 * Finanzas (el dueño que cambia de sucursal la abre desde el propio POS).
 * Avisa a quien escuche (`notifyCashRegisterChanged`) para que recargue.
 */
export async function abrirCaja(
  tenantId: string | null,
  fondoInicial: number,
  sucursalId: string | null = null
): Promise<Caja | null> {
  if (!tenantId) {
    toast.error("No se pudo identificar el tenant");
    return null;
  }
  if (!(fondoInicial >= 0)) {
    toast.error("El fondo inicial no puede ser negativo");
    return null;
  }
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      toast.error("No se pudo identificar el usuario");
      return null;
    }

    const register = await openRegister(userId, tenantId, fondoInicial, sucursalId);
    await logActivity({
      action: "CREATE",
      entity: "caja",
      entityId: register.id,
      details: { fondo_inicial: fondoInicial, sucursal_id: sucursalId },
    });
    toast.success("Caja abierta correctamente. ¡Listo para vender!");
    notifyCashRegisterChanged();
    return register;
  } catch (error) {
    // Postgres 23505: ya tiene una caja abierta en ese local (migracion 086).
    const code = (error as { code?: string } | null)?.code;
    toast.error(
      code === "23505"
        ? "Ya tienes una caja abierta en esa sucursal"
        : error instanceof Error
          ? error.message
          : (error as { message?: string } | null)?.message ?? "Error al abrir la caja"
    );
    return null;
  }
}

/**
 * La caja del usuario que se muestra y se opera.
 *
 * `sucursalId`: el usuario puede tener una caja abierta en cada local
 * (migracion 086). Con un local elegido se trabaja con la de ese local; con
 * `null` ("Todas", o un negocio de un solo local), con la mas reciente.
 */
export function useCashRegister(
  tenantId: string | null,
  sucursalId: string | null = null
): CashRegisterHookState {
  const [activeRegister, setActiveRegister] = useState<Caja | null>(null);
  const [movements, setMovements] = useState<MovimientoCaja[]>([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // Al cambiar de sucursal rapido, la respuesta de la anterior puede llegar
  // despues: solo se aplica la de la ultima peticion.
  const peticion = useRef(0);
  const sucursalCargada = useRef<string | null | undefined>(undefined);

  const refetch = useCallback(async () => {
    const id = ++peticion.current;
    // Al cambiar de local no se deja a la vista (ni con "Cerrar caja" a mano)
    // la caja del anterior mientras llega la nueva.
    if (sucursalCargada.current !== sucursalId) {
      sucursalCargada.current = sucursalId;
      setLoading(true);
    }
    const userId = await getCurrentUserId();
    if (!userId) return;

    const register = await fetchActiveRegister(userId, sucursalId);
    if (register) {
      const [movementData, ventasTotal] = await Promise.all([
        fetchMovements(register.id),
        fetchVentasTotal(
          register.tenant_id,
          userId,
          register.fecha_apertura,
          register.sucursal_id ?? null
        ),
      ]);
      if (id !== peticion.current) return;
      setActiveRegister(register);
      setMovements(movementData);
      setTotalVentas(ventasTotal);
    } else {
      if (id !== peticion.current) return;
      setActiveRegister(null);
      setMovements([]);
      setTotalVentas(0);
    }

    setLoading(false);
  }, [sucursalId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [refetch]);

  const handleOpenRegister = useCallback(
    async (
      fondoInicial: number,
      sucursalId: string | null = null
    ): Promise<Caja | null> => {
      const register = await abrirCaja(tenantId, fondoInicial, sucursalId);
      if (register) {
        setActiveRegister(register);
        setShowOpenDialog(false);
        void refetch();
      }
      return register;
    },
    [tenantId, refetch]
  );

  const handleAddMovement = useCallback(
    async (tipo: "ENTRADA" | "SALIDA", monto: number, descripcion: string) => {
      if (!activeRegister) return;
      if (!(monto > 0)) {
        toast.error("El monto debe ser mayor a 0");
        return;
      }
      if (!descripcion.trim()) {
        toast.error("La descripción es requerida");
        return;
      }
      await addMovement(activeRegister.id, tipo, monto, descripcion);
      await logActivity({
        action: "CREATE",
        entity: "movimiento_caja",
        entityName: descripcion,
        details: { tipo, monto, caja_id: activeRegister.id },
      });
      setShowMovementDialog(false);
      void refetch();
    },
    [activeRegister, refetch]
  );

  const { totalEntradas, totalSalidas } = useMemo(
    () => calculateRegisterTotals(movements),
    [movements]
  );

  const saldoEsperado =
    (activeRegister?.fondo_inicial ?? 0) +
    totalEntradas -
    totalSalidas +
    totalVentas;

  const handleCloseRegister = useCallback(
    async (saldoReal: number, notasCierre: string) => {
      if (!activeRegister) return;

      await closeRegister(activeRegister.id, {
        totalVentas,
        totalEntradas,
        totalSalidas,
        saldoEsperado,
        saldoReal,
        notasCierre: notasCierre || null,
      });
      await logActivity({
        action: "UPDATE",
        entity: "caja",
        entityId: activeRegister.id,
        details: { saldo_real: saldoReal, saldo_esperado: saldoEsperado, diferencia: saldoReal - saldoEsperado },
      });

      setActiveRegister(null);
      setMovements([]);
      setTotalVentas(0);
      setShowCloseDialog(false);
      notifyCashRegisterChanged();
    },
    [activeRegister, totalVentas, totalEntradas, totalSalidas, saldoEsperado]
  );

  return {
    activeRegister,
    movements,
    totalVentas,
    totalEntradas,
    totalSalidas,
    saldoEsperado,
    loading,
    showOpenDialog,
    showMovementDialog,
    showCloseDialog,
    setShowOpenDialog,
    setShowMovementDialog,
    setShowCloseDialog,
    refetch,
    handleOpenRegister,
    handleAddMovement,
    handleCloseRegister,
  };
}