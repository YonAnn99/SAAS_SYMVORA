"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPrograma, tarjetaDeCliente, tarjetaPorCodigo, type TarjetaConCliente } from "./lealtad-service";
import type { ProgramaLealtad } from "./types";

/**
 * Tarjeta de lealtad adjunta a la venta en curso del POS (migracion 115).
 *
 * Sin programa activo todo queda en `null` y el POS se comporta como siempre.
 * La tarjeta se adjunta al escanear su QR o al elegir un cliente que ya tiene
 * una; cambiar de cliente la suelta.
 */
export function usePosLealtad(tenantId: string | null) {
  const [programa, setPrograma] = useState<ProgramaLealtad | null>(null);
  const [tarjeta, setTarjeta] = useState<TarjetaConCliente | null>(null);
  const [canjear, setCanjear] = useState(false);
  // La ultima busqueda gana: elegir dos clientes seguidos no debe dejar
  // adjunta la tarjeta del primero si su respuesta llega tarde.
  const turno = useRef(0);

  useEffect(() => {
    if (!tenantId) return;
    let vigente = true;
    fetchPrograma(tenantId)
      .then((p) => vigente && setPrograma(p))
      .catch(() => vigente && setPrograma(null));
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const activo = Boolean(programa?.activo);

  const soltar = useCallback(() => {
    turno.current++;
    setTarjeta(null);
    setCanjear(false);
  }, []);

  /** Busca la tarjeta por su codigo y la adjunta. `null` si no existe en este negocio. */
  const adjuntarPorCodigo = useCallback(
    async (codigo: string): Promise<TarjetaConCliente | null> => {
      if (!activo) return null;
      const mio = ++turno.current;
      const encontrada = await tarjetaPorCodigo(codigo).catch(() => null);
      if (mio !== turno.current) return encontrada;
      setTarjeta(encontrada);
      setCanjear(false);
      return encontrada;
    },
    [activo]
  );

  /** Al elegir cliente en el selector: adjunta su tarjeta si tiene, si no suelta la anterior. */
  const adjuntarPorCliente = useCallback(
    async (clienteId: string | null) => {
      const mio = ++turno.current;
      setCanjear(false);
      if (!activo || !clienteId) {
        setTarjeta(null);
        return;
      }
      if (tarjeta?.cliente_id === clienteId) return;
      setTarjeta(null);
      const encontrada = await tarjetaDeCliente(clienteId).catch(() => null);
      if (mio === turno.current) setTarjeta(encontrada);
    },
    [activo, tarjeta?.cliente_id]
  );

  return {
    programa: activo ? programa : null,
    tarjeta: activo ? tarjeta : null,
    canjear: activo && tarjeta ? canjear : false,
    setCanjear,
    adjuntarPorCodigo,
    adjuntarPorCliente,
    soltar,
  };
}
