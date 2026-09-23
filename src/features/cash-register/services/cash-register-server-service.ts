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
  /** Nombre comercial del negocio (antes al cajero le llegaba el UUID). */
  tenantName: string;
  /** Solo si el negocio tiene 2 o mas sucursales activas; si no, `null`. */
  sucursalNombre: string | null;
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
/** Mexico no tiene horario de verano desde octubre de 2022: siempre UTC-6. */
const CDMX_OFFSET = "-06:00";

/**
 * La hora "de reloj" de CDMX expresada como fecha LOCAL del proceso. Sirve
 * para leer dia/hora (`getDate()`, `getHours()`), NUNCA como instante: su
 * `getTime()` depende de la zona del servidor.
 */
function getCdmxDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: CDMX_TIMEZONE }));
}

/**
 * El INSTANTE en que empezo el dia de hoy en CDMX (00:00 hora de Mexico).
 *
 * ⚠️ Antes se hacia con `getCdmxDate(...).setHours(0)`, que pone a cero la
 * hora EN LA ZONA DEL SERVIDOR. En la maquina del desarrollador (CDMX) daba
 * bien y los tests pasaban; en Vercel (UTC) el corte caia a las 18:00 CDMX del
 * dia anterior, y las cajas se cerraban un dia tarde. Paso en produccion: una
 * caja abierta el 21 sep a las 14:30 se cerro el 23 sep a las 00:38.
 *
 * Ahora la fecha de CDMX se saca con Intl y el instante se construye con el
 * desfase explicito: el resultado es el mismo en cualquier servidor.
 */
function getCdmxMidnight(date: Date = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: CDMX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return new Date(`${valor("year")}-${valor("month")}-${valor("day")}T00:00:00${CDMX_OFFSET}`);
}

/**
 * La hora que se guarda como cierre automatico: las 23:59:59 del dia que
 * termino. El cron corre pasada la medianoche (y Vercel puede retrasarlo
 * minutos), pero la caja se cerro "al final del dia": asi lo dicen la nota,
 * los reportes y los correos, sin depender de cuando llego a ejecutarse.
 */
function horaCierreAutomatico(corte: Date): Date {
  return new Date(corte.getTime() - 1000);
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

/**
 * Nombre de la sucursal para los avisos, solo si el negocio tiene 2 o mas
 * sucursales activas. Con una sola, decir "Principal" en cada correo es ruido.
 */
export async function fetchSucursalParaAviso(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
  sucursalId: string | null
): Promise<string | null> {
  if (!sucursalId) return null;
  const { data } = await supabase
    .from("sucursales")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .eq("activa", true);
  const activas = data ?? [];
  if (activas.length < 2) return null;
  if (activas.some((s) => s.id === sucursalId)) {
    return activas.find((s) => s.id === sucursalId)?.nombre ?? null;
  }
  // La de la caja se cerro despues: su nombre sigue sirviendo para el aviso.
  const { data: cerrada } = await supabase
    .from("sucursales")
    .select("nombre")
    .eq("id", sucursalId)
    .maybeSingle();
  return cerrada?.nombre ?? null;
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

/**
 * Cajas abiertas antes de `corte` (la medianoche CDMX con la que corre el
 * cron). Se recibe de fuera para que la seleccion y la hora de cierre que se
 * guarda salgan del MISMO instante.
 */
export async function fetchOpenRegistersFromPreviousDays(
  corte: Date = getCdmxMidnight()
): Promise<RegisterToClose[]> {
  const supabase = createSupabaseServiceRoleClient();

  const cdmxMidnight = corte.toISOString();

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

    const [tenantName, sucursalNombre] = await Promise.all([
      fetchTenantName(supabase, caja.tenant_id),
      fetchSucursalParaAviso(supabase, caja.tenant_id, caja.sucursal_id ?? null),
    ]);

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
      tenantName,
      sucursalNombre,
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
    /** Ver `horaCierreAutomatico`: 23:59:59 del dia que termino. */
    fechaCierre: Date;
  }
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();
  const ahora = payload.fechaCierre.toISOString();

  const { data: actualizadas, error: updateError } = await supabase
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
    .eq("id", cajaId)
    // Si alguien la cerro a mano mientras corria el cron, no se pisa su corte
    // (ni se le manda un aviso de un cierre que no hizo el sistema).
    .eq("estado", "ABIERTA")
    .select("id");

  if (updateError) throw updateError;
  if (!actualizadas || actualizadas.length === 0) return false;

  const { error: movementError } = await supabase.from("movimientos_caja").insert({
    caja_id: cajaId,
    tipo: "SALIDA",
    monto: 0,
    descripcion: "Cierre automático del sistema",
    fecha: ahora,
  });

  if (movementError) throw movementError;
  return true;
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

export { isRegisterFromPreviousDay, getCdmxMidnight, getCdmxDate, horaCierreAutomatico };