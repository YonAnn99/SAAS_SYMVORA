"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ajustarSellos,
  emitirTarjeta,
  fetchPrograma,
  fetchResumen,
  fetchTarjetas,
  guardarPrograma,
  mensajeDeError,
  type ProgramaInput,
  type ResumenLealtad,
  type TarjetaConCliente,
} from "./lealtad-service";
import type { EstadoTarjeta, ProgramaLealtad } from "./types";

/**
 * Estado de la pestaña "Tarjetas de lealtad" de Clientes: el programa, las
 * tarjetas y el resumen del mes. Sin cache entre modulos: son pocos datos y
 * los sellos cambian con cada venta.
 */
export function useLealtad(tenantId: string | null) {
  const [programa, setPrograma] = useState<ProgramaLealtad | null>(null);
  const [tarjetas, setTarjetas] = useState<TarjetaConCliente[]>([]);
  const [resumen, setResumen] = useState<ResumenLealtad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const refrescar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [p, t, r] = await Promise.all([
        fetchPrograma(tenantId),
        fetchTarjetas(tenantId),
        fetchResumen(tenantId),
      ]);
      setPrograma(p);
      setTarjetas(t);
      setResumen(r);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudieron cargar las tarjetas de lealtad"));
    } finally {
      setCargando(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refrescar(), 0);
    return () => window.clearTimeout(t);
  }, [refrescar]);

  const guardar = useCallback(
    async (input: ProgramaInput): Promise<boolean> => {
      if (!tenantId) return false;
      setGuardando(true);
      try {
        setPrograma(await guardarPrograma(tenantId, input));
        toast.success(input.activo ? "Programa de lealtad guardado y activo" : "Programa de lealtad guardado");
        return true;
      } catch (error) {
        toast.error(mensajeDeError(error, "No se pudo guardar el programa"));
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [tenantId]
  );

  const emitir = useCallback(
    async (clienteId: string): Promise<EstadoTarjeta | null> => {
      try {
        const estado = await emitirTarjeta(clienteId);
        await refrescar();
        return estado;
      } catch (error) {
        toast.error(mensajeDeError(error, "No se pudo crear la tarjeta"));
        return null;
      }
    },
    [refrescar]
  );

  const ajustar = useCallback(
    async (tarjetaId: string, cantidad: number, nota: string): Promise<boolean> => {
      try {
        await ajustarSellos(tarjetaId, cantidad, nota);
        toast.success(cantidad > 0 ? `Se sumaron ${cantidad} sellos` : `Se quitaron ${-cantidad} sellos`);
        await refrescar();
        return true;
      } catch (error) {
        toast.error(mensajeDeError(error, "No se pudieron ajustar los sellos"));
        return false;
      }
    },
    [refrescar]
  );

  return { programa, tarjetas, resumen, cargando, guardando, refrescar, guardar, emitir, ajustar };
}
