"use client";

import { useMemo } from "react";
import { useModulos } from "@/hooks/use-modulos";
import { usePlan } from "@/hooks/use-plan";
import type { TicketConfig } from "@/lib/types/database";
import { puedeQuitarMarcaTicket, ticketConfigEfectiva } from "./ticket-config";

/**
 * La configuración del ticket que de verdad se usa (pantalla e impresión).
 *
 * Mientras el plan no está listo, la marca SE QUEDA: quitarla es función de Pro y Premium, así que
 * solo se permite con el nivel confirmado.
 */
export function useTicketConfigEfectiva(): TicketConfig {
  const { ticketConfig } = useModulos();
  const { funciones, listo } = usePlan();
  return useMemo(
    () => ticketConfigEfectiva(ticketConfig, listo && puedeQuitarMarcaTicket(funciones)),
    [ticketConfig, funciones, listo]
  );
}
