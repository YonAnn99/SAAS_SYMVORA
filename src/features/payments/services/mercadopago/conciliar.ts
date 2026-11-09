import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { getOrder } from "./orders";
import { getMercadoPagoPointConfig, readMercadoPagoSecrets } from "./secrets";
import { estadoTerminal, type EstadoTerminal } from "./webhook";

type ClienteServicio = ReturnType<typeof createSupabaseServiceRoleClient>;

/** Estados de `pagos_terminal` en los que la orden sigue viva en Mercado Pago. */
const ESTADOS_EN_CURSO = new Set(["CREADA", "ESPERANDO_PAGO"]);

export interface ResultadoConciliacion {
  estado: string;
  venta_id: string | null;
}

/**
 * Registra en la base un estado FINAL de la orden con
 * `confirm_terminal_payment`: si se pago, crea la venta (con su movimiento de
 * caja); si no, marca el pago cancelado o rechazado.
 *
 * Es idempotente: la funcion toma la fila con `FOR UPDATE` y, si ya tiene venta,
 * la devuelve sin crear otra. Por eso el webhook, la consulta del POS y el
 * cancelar pueden llegar al mismo tiempo sin duplicar la venta.
 */
export async function aplicarEstadoTerminal(
  supabase: ClienteServicio,
  mpOrderId: string,
  estado: EstadoTerminal
): Promise<{ venta_id: string | null }> {
  const { data, error } = await supabase.rpc("confirm_terminal_payment", {
    p_mp_order_id: mpOrderId,
    p_pagado: estado === "PAGADA",
    p_estado: estado,
  });
  if (error) throw error;
  const venta = data as { id?: string } | null;
  return { venta_id: venta?.id ?? null };
}

/**
 * La verdad del cobro es Mercado Pago, no el webhook. Antes el POS solo leia
 * `pagos_terminal`, que solo cambiaba con el webhook: si el aviso no llegaba
 * (o fallaba la firma), el punto de venta esperaba para siempre aunque el
 * cliente ya hubiera pagado o se hubiera cancelado en la terminal.
 *
 * Si la orden sigue en curso en la base, se pregunta a Mercado Pago y, con un
 * estado final, se registra. Si Mercado Pago no responde o la orden sigue en la
 * terminal, se devuelve lo que diga la base sin tocar nada.
 */
export async function conciliarPagoTerminal(
  tenantId: string,
  mpOrderId: string
): Promise<ResultadoConciliacion | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: pago } = await supabase
    .from("pagos_terminal")
    .select("estado, venta_id")
    .eq("mp_order_id", mpOrderId)
    .eq("tenant_id", tenantId)
    .single();

  if (!pago) return null;

  const enBase: ResultadoConciliacion = {
    estado: pago.estado,
    venta_id: pago.venta_id,
  };
  if (pago.venta_id || !ESTADOS_EN_CURSO.has(pago.estado)) return enBase;

  let estado: EstadoTerminal | null = null;
  try {
    const config = await getMercadoPagoPointConfig(tenantId);
    const secrets = await readMercadoPagoSecrets(tenantId, config);
    if (!secrets.accessToken) return enBase;
    const order = await getOrder(secrets.accessToken, mpOrderId);
    estado = estadoTerminal(order.status);
  } catch (error) {
    // Un fallo transitorio de Mercado Pago no cambia nada: el POS vuelve a
    // preguntar en la siguiente vuelta.
    console.warn("No se pudo consultar la orden en Mercado Pago:", error);
    return enBase;
  }

  if (!estado) return enBase;

  const { venta_id } = await aplicarEstadoTerminal(supabase, mpOrderId, estado);
  // Con venta, esta pagada aunque llegue otro estado: la funcion devuelve la
  // venta que ya existia (el webhook gano la carrera) sin tocar el pago.
  return { estado: venta_id ? "PAGADA" : estado, venta_id };
}
