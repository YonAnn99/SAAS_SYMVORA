import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Caja, MovimientoCaja } from "../types/cash-register.types";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * La caja abierta del usuario.
 *
 * Un usuario puede tener UNA abierta por sucursal (migracion 086): el dueño que
 * va a cobrar a Norte abre alli la suya sin cerrar la de Principal. Con
 * `sucursalId` se pide la de ese local; sin el, la mas reciente (el caso de
 * siempre: un solo local, o el cajero que solo abre una).
 */
export async function fetchActiveRegister(
  userId: string,
  sucursalId: string | null = null
): Promise<Caja | null> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("cajas")
    .select("*")
    .eq("usuario_id", userId)
    .eq("estado", "ABIERTA");
  if (sucursalId) query = query.eq("sucursal_id", sucursalId);
  const { data } = await query
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function fetchLastClosedRegister(
  userId: string,
  tenantId?: string
): Promise<Caja | null> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("cajas")
    .select("*")
    .eq("usuario_id", userId)
    .eq("estado", "CERRADA")
    .order("fecha_cierre", { ascending: false })
    .limit(1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data } = await query.maybeSingle();
  return data ?? null;
}

export async function fetchMovements(cajaId: string): Promise<MovimientoCaja[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("caja_id", cajaId)
    .order("fecha", { ascending: false });
  return data ?? [];
}

/**
 * Lo cobrado en una caja: ventas del usuario desde la apertura EN SU SUCURSAL.
 * Sin el filtro por sucursal, con dos cajas abiertas a la vez (una por local,
 * migracion 086) cada corte sumaba tambien las ventas de la otra.
 */
export async function fetchVentasTotal(
  tenantId: string,
  userId: string,
  desde: string,
  sucursalId: string | null = null
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("ventas")
    .select("total")
    .eq("tenant_id", tenantId)
    .eq("usuario_id", userId)
    .eq("estado", "COMPLETADA")
    .neq("metodo_pago", "CREDITO")
    .gte("fecha_venta", desde);
  if (sucursalId) query = query.eq("sucursal_id", sucursalId);
  const { data } = await query;

  return (data ?? []).reduce((sum, v) => sum + v.total, 0);
}

/**
 * Abre la caja del turno.
 *
 * `sucursalId` es el LOCAL donde esta este mostrador, y se pregunta aqui —una
 * sola vez por turno— en vez de en cada venta: todas las ventas que se cobren
 * mientras la caja siga abierta la heredan, dentro de
 * `_crear_venta_desde_items`. Va como `null` en un negocio de un solo local.
 */
export async function openRegister(
  userId: string,
  tenantId: string,
  fondoInicial: number,
  sucursalId: string | null = null
): Promise<Caja> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("cajas")
    .insert({
      usuario_id: userId,
      tenant_id: tenantId,
      fondo_inicial: fondoInicial,
      sucursal_id: sucursalId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addMovement(
  cajaId: string,
  tipo: "ENTRADA" | "SALIDA",
  monto: number,
  descripcion: string
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("movimientos_caja").insert({
    caja_id: cajaId,
    tipo,
    monto,
    descripcion,
  });
  if (error) throw error;
}

export async function closeRegister(
  cajaId: string,
  payload: {
    totalVentas: number;
    totalEntradas: number;
    totalSalidas: number;
    saldoEsperado: number;
    saldoReal: number;
    notasCierre: string | null;
  }
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("cajas")
    .update({
      estado: "CERRADA",
      fecha_cierre: new Date().toISOString(),
      total_ventas: payload.totalVentas,
      total_entradas: payload.totalEntradas,
      total_salidas: payload.totalSalidas,
      saldo_esperado: payload.saldoEsperado,
      saldo_real: payload.saldoReal,
      diferencia: payload.saldoReal - payload.saldoEsperado,
      notas_cierre: payload.notasCierre,
    })
    .eq("id", cajaId);
  if (error) throw error;
}

export function calculateRegisterTotals(
  movements: MovimientoCaja[]
): { totalEntradas: number; totalSalidas: number } {
  return movements.reduce(
    (acc, m) => {
      if (m.tipo === "ENTRADA") acc.totalEntradas += m.monto;
      else if (m.tipo === "SALIDA") acc.totalSalidas += m.monto;
      // "VENTA" se excluye a propósito: el ingreso por ventas ya se
      // contabiliza por separado (fetchVentasTotal / tarjeta "Ventas" y
      // saldoEsperado), sumarlo aquí también lo duplicaría.
      return acc;
    },
    { totalEntradas: 0, totalSalidas: 0 }
  );
}