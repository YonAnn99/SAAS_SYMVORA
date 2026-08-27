"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  handleOpenRegister: (fondoInicial: number) => Promise<void>;
  handleAddMovement: (
    tipo: "ENTRADA" | "SALIDA",
    monto: number,
    descripcion: string
  ) => Promise<void>;
  handleCloseRegister: (saldoReal: number, notasCierre: string) => Promise<void>;
}

export function useCashRegister(tenantId: string | null): CashRegisterHookState {
  const [activeRegister, setActiveRegister] = useState<Caja | null>(null);
  const [movements, setMovements] = useState<MovimientoCaja[]>([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const refetch = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const register = await fetchActiveRegister(userId);
    if (register) {
      setActiveRegister(register);
      const movementData = await fetchMovements(register.id);
      setMovements(movementData);
      const ventasTotal = await fetchVentasTotal(
        register.tenant_id,
        userId,
        register.fecha_apertura
      );
      setTotalVentas(ventasTotal);
    } else {
      setActiveRegister(null);
      setMovements([]);
      setTotalVentas(0);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [refetch]);

  const handleOpenRegister = useCallback(
    async (fondoInicial: number) => {
      if (!tenantId) {
        toast.error("No se pudo identificar el tenant");
        return;
      }
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          toast.error("No se pudo identificar el usuario");
          return;
        }

        const register = await openRegister(userId, tenantId, fondoInicial);
        await logActivity({
          action: "CREATE",
          entity: "caja",
          entityId: register.id,
          details: { fondo_inicial: fondoInicial },
        });
        setActiveRegister(register);
        setShowOpenDialog(false);
        toast.success("Caja abierta correctamente");
        void refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al abrir la caja"
        );
      }
    },
    [tenantId, refetch]
  );

  const handleAddMovement = useCallback(
    async (tipo: "ENTRADA" | "SALIDA", monto: number, descripcion: string) => {
      if (!activeRegister) return;
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