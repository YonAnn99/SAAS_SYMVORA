import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import type { Caja, MovimientoCaja } from "../types/cash-register.types";
import { calculateRegisterTotals } from "./cash-register-service";

export interface RegisterToClose {
  caja: Caja;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
  userEmail: string;
  userRole: string;
  userName: string;
}

export interface AutoCloseResult {
  cajaId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
  tenantId: string;
  tenantName: string;
  success: boolean;
  error?: string;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
}

const CDMX_TIMEZONE = "America/Mexico_City";

function getCdmxDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: CDMX_TIMEZONE }));
}

function getCdmxMidnight(date: Date = new Date()): Date {
  const cdmxDate = getCdmxDate(date);
  cdmxDate.setHours(0, 0, 0, 0);
  return cdmxDate;
}

function isRegisterFromPreviousDay(fechaApertura: string): boolean {
  const apertura = new Date(fechaApertura);
  const cdmxMidnight = getCdmxMidnight();
  return apertura < cdmxMidnight;
}

async function fetchUserDetails(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string
): Promise<{ email: string; name: string; role: string } | null> {
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const { data: user } = await supabase.auth.admin.getUserById(userId);

  return {
    email: user?.user?.email ?? "",
    name: user?.user?.user_metadata?.nombre ?? user?.user?.email?.split("@")[0] ?? "Usuario",
    role: membership?.role ?? "CAJERO",
  };
}

async function fetchTenantName(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<string> {
  const { data } = await supabase
    .from("tenants")
    .select("nombre_comercial")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.nombre_comercial ?? "Negocio";
}

export async function fetchOpenRegistersFromPreviousDays(): Promise<RegisterToClose[]> {
  const supabase = createSupabaseServiceRoleClient();

  const cdmxMidnight = getCdmxMidnight().toISOString();

  const { data: openRegisters, error } = await supabase
    .from("cajas")
    .select("*")
    .eq("estado", "ABIERTA")
    .lt("fecha_apertura", cdmxMidnight)
    .order("fecha_apertura", { ascending: true });

  if (error) throw error;
  if (!openRegisters || openRegisters.length === 0) return [];

  const registersToClose: RegisterToClose[] = [];

  for (const caja of openRegisters) {
    const userDetails = await fetchUserDetails(supabase, caja.usuario_id);
    if (!userDetails) continue;

    const tenantName = await fetchTenantName(supabase, caja.tenant_id);

    const totalVentas = await fetchVentasTotalForAutoClose(
      supabase,
      caja.tenant_id,
      caja.usuario_id,
      caja.fecha_apertura,
      caja.sucursal_id ?? null
    );

    const movements = await fetchMovementsForAutoClose(supabase, caja.id);
    const { totalEntradas, totalSalidas } = calculateRegisterTotals(movements);

    const saldoEsperado =
      (caja.fondo_inicial ?? 0) + totalEntradas - totalSalidas + totalVentas;

    registersToClose.push({
      caja,
      totalVentas,
      totalEntradas,
      totalSalidas,
      saldoEsperado,
      userEmail: userDetails.email,
      userRole: userDetails.role,
      userName: userDetails.name,
    });
  }

  return registersToClose;
}

async function fetchVentasTotalForAutoClose(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
  userId: string,
  desde: string,
  sucursalId: string | null
): Promise<number> {
  // Por sucursal, igual que `fetchVentasTotal`: el usuario puede tener una caja
  // abierta en cada local y cada cierre cuenta solo lo suyo (migracion 086).
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

async function fetchMovementsForAutoClose(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  cajaId: string
): Promise<MovimientoCaja[]> {
  const { data } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("caja_id", cajaId)
    .order("fecha", { ascending: false });
  return data ?? [];
}

export async function autoCloseRegister(
  cajaId: string,
  payload: {
    totalVentas: number;
    totalEntradas: number;
    totalSalidas: number;
    saldoEsperado: number;
    userId: string;
    tenantId: string;
  }
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("cajas")
    .update({
      estado: "CERRADA",
      fecha_cierre: ahora,
      total_ventas: payload.totalVentas,
      total_entradas: payload.totalEntradas,
      total_salidas: payload.totalSalidas,
      saldo_esperado: payload.saldoEsperado,
      saldo_real: payload.saldoEsperado,
      diferencia: 0,
      notas_cierre: "Cierre automático del sistema a las 23:59",
    })
    .eq("id", cajaId);

  if (updateError) throw updateError;

  const { error: movementError } = await supabase.from("movimientos_caja").insert({
    caja_id: cajaId,
    tipo: "SALIDA",
    monto: 0,
    descripcion: "Cierre automático del sistema",
    fecha: ahora,
  });

  if (movementError) throw movementError;
}

export async function logAutoCloseActivity(
  cajaId: string,
  userId: string,
  tenantId: string,
  details: {
    totalVentas: number;
    totalEntradas: number;
    totalSalidas: number;
    saldoEsperado: number;
  }
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase.rpc("log_activity", {
    p_action: "AUTO_CLOSE",
    p_entity: "caja",
    p_entity_id: cajaId,
    p_details: {
      ...details,
      cerrado_por: "sistema",
      usuario_id: userId,
      diferencia: 0,
    },
    p_user_id: userId,
    p_tenant_id: tenantId,
  });

  if (error) console.error("[auto-close] Error logging activity:", error.message);
}

export { isRegisterFromPreviousDay, getCdmxMidnight, getCdmxDate };