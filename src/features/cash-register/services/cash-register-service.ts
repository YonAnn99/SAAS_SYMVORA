import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Caja, MovimientoCaja } from "../types/cash-register.types";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchActiveRegister(
  userId: string
): Promise<Caja | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("cajas")
    .select("*")
    .eq("usuario_id", userId)
    .eq("estado", "ABIERTA")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .single();
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

export async function fetchVentasTotal(
  tenantId: string,
  userId: string,
  desde: string
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("ventas")
    .select("total")
    .eq("tenant_id", tenantId)
    .eq("usuario_id", userId)
    .eq("estado", "COMPLETADA")
    .gte("fecha_venta", desde);

  return (data ?? []).reduce((sum, v) => sum + v.total, 0);
}

export async function openRegister(
  userId: string,
  tenantId: string,
  fondoInicial: number
): Promise<Caja> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("cajas")
    .insert({
      usuario_id: userId,
      tenant_id: tenantId,
      fondo_inicial: fondoInicial,
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
      else acc.totalSalidas += m.monto;
      return acc;
    },
    { totalEntradas: 0, totalSalidas: 0 }
  );
}