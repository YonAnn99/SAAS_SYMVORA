"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { fetchPedidos } from "./pedidos-service";
import type { Pedido } from "./types";

/**
 * Los pedidos del catálogo del negocio. Se vuelven a pedir al volver a la pestaña y cada minuto: un pedido nuevo
 * también llega por la campana (`pedido_nuevo`). Sin caché entre módulos: es lo que cambia cuando el cliente manda.
 */
export function usePedidos() {
  const { tenantId } = useCurrentTenant();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const peticion = useRef(0);

  const refrescar = useCallback(async () => {
    if (!tenantId) return;
    const id = ++peticion.current;
    try {
      const filas = await fetchPedidos(tenantId);
      if (id !== peticion.current) return;
      setPedidos(filas);
      setError(false);
    } catch {
      if (id === peticion.current) setError(true);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refrescar(), 0);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void refrescar();
    }, 60_000);
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [refrescar]);

  return { tenantId, pedidos, cargando, error, refrescar };
}
