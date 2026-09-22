import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  sendAutoCloseToUserEmail,
  sendAutoCloseToSuperAdminEmail,
} from "@/lib/email";
import {
  fetchOpenRegistersFromPreviousDays,
  autoCloseRegister,
  logAutoCloseActivity,
  type AutoCloseResult,
} from "@/features/cash-register/services/cash-register-server-service";

/**
 * Cierre automático de cajas a las 23:59 (hora CDMX).
 *
 * Lo dispara el cron diario de Vercel (`vercel.json`) programado a las 05:59 UTC
 * (que son las 23:59 en Ciudad de México — México no tiene horario de verano).
 *
 * Cierra TODAS las cajas ABIERTA cuya fecha_apertura sea de un día anterior
 * al día actual en CDMX. Para cada caja:
 *   - Calcula totales (ventas, entradas, salidas, saldo esperado)
 *   - Cierra con saldo_real = saldo_esperado (diferencia = 0)
 *   - Crea movimiento "Cierre automático del sistema"
 *   - Registra activity_log
 *   - Envía email al usuario dueño de la caja
 *   - Envía email al SUPER_ADMIN del negocio
 *
 * HORARIO: `vercel.json` la programa a las 05:59 UTC.
 * Los cron de Vercel SOLO entienden UTC.
 *
 * REQUIERE `CRON_SECRET` en las variables de entorno de Vercel.
 */

// El envío es secuencial y puede tocar varias cuentas; con el timeout de Resend
// (5s) esto da margen de sobra sin dejar la función colgada indefinidamente.
export const maxDuration = 60;

/** Tope de cajas por ejecución. Ver la nota en el bucle. */
const MAX_POR_EJECUCION = 100;

interface SuperAdminInfo {
  email: string;
  businessName: string;
}

/** Busca el SUPER_ADMIN del tenant para notificarle. */
async function getSuperAdmin(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<SuperAdminInfo | null> {
  const { data: owner } = await supabase
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "SUPER_ADMIN")
    .limit(1)
    .maybeSingle();

  if (!owner) return null;

  const { data: user } = await supabase.auth.admin.getUserById(owner.user_id);
  const email = user?.user?.email;
  if (!email) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nombre_comercial")
    .eq("id", tenantId)
    .maybeSingle();

  return {
    email,
    businessName: tenant?.nombre_comercial || "tu negocio",
  };
}

/** Autenticación del cron. Vercel manda `Authorization: Bearer $CRON_SECRET`. */
function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  const supabase = createSupabaseServiceRoleClient();

  const registersToClose = await fetchOpenRegistersFromPreviousDays();

  const candidatas = registersToClose.slice(0, MAX_POR_EJECUCION);

  const cerradas: AutoCloseResult[] = [];
  const omitidas: Array<{ cajaId: string; motivo: string }> = [];
  const errores: Array<{ cajaId: string; error: string }> = [];

  for (const reg of candidatas) {
    try {
      if (dryRun) {
        cerradas.push({
          cajaId: reg.caja.id,
          userId: reg.caja.usuario_id,
          userEmail: reg.userEmail,
          userRole: reg.userRole,
          userName: reg.userName,
          tenantId: reg.caja.tenant_id,
          tenantName: reg.caja.tenant_id, // se resolverá en dry-run
          success: true,
          totalVentas: reg.totalVentas,
          totalEntradas: reg.totalEntradas,
          totalSalidas: reg.totalSalidas,
          saldoEsperado: reg.saldoEsperado,
        });
        continue;
      }

      // 1. Cerrar la caja en BD
      await autoCloseRegister(reg.caja.id, {
        totalVentas: reg.totalVentas,
        totalEntradas: reg.totalEntradas,
        totalSalidas: reg.totalSalidas,
        saldoEsperado: reg.saldoEsperado,
        userId: reg.caja.usuario_id,
        tenantId: reg.caja.tenant_id,
      });

      // 2. Log de actividad
      await logAutoCloseActivity(reg.caja.id, reg.caja.usuario_id, reg.caja.tenant_id, {
        totalVentas: reg.totalVentas,
        totalEntradas: reg.totalEntradas,
        totalSalidas: reg.totalSalidas,
        saldoEsperado: reg.saldoEsperado,
      });

      // 3. Obtener SUPER_ADMIN para notificar
      const superAdmin = await getSuperAdmin(supabase, reg.caja.tenant_id);

      // 4. Enviar emails (en paralelo)
      const emailPromises: Promise<{ ok: boolean; error?: string }>[] = [];

      // Email al usuario dueño de la caja
      if (reg.userEmail) {
        emailPromises.push(
          sendAutoCloseToUserEmail({
            to: reg.userEmail,
            userName: reg.userName,
            businessName: reg.caja.tenant_id, // será resuelto por tenantName
            cajaId: reg.caja.id,
            fechaApertura: reg.caja.fecha_apertura,
            totalVentas: reg.totalVentas,
            totalEntradas: reg.totalEntradas,
            totalSalidas: reg.totalSalidas,
            saldoEsperado: reg.saldoEsperado,
          })
        );
      }

      // Email al SUPER_ADMIN
      if (superAdmin?.email) {
        emailPromises.push(
          sendAutoCloseToSuperAdminEmail({
            to: superAdmin.email,
            businessName: superAdmin.businessName,
            userName: reg.userName,
            userRole: reg.userRole,
            userEmail: reg.userEmail,
            cajaId: reg.caja.id,
            fechaApertura: reg.caja.fecha_apertura,
            totalVentas: reg.totalVentas,
            totalEntradas: reg.totalEntradas,
            totalSalidas: reg.totalSalidas,
            saldoEsperado: reg.saldoEsperado,
          })
        );
      }

      await Promise.allSettled(emailPromises);

      cerradas.push({
        cajaId: reg.caja.id,
        userId: reg.caja.usuario_id,
        userEmail: reg.userEmail,
        userRole: reg.userRole,
        userName: reg.userName,
        tenantId: reg.caja.tenant_id,
        tenantName: superAdmin?.businessName || reg.caja.tenant_id,
        success: true,
        totalVentas: reg.totalVentas,
        totalEntradas: reg.totalEntradas,
        totalSalidas: reg.totalSalidas,
        saldoEsperado: reg.saldoEsperado,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[cron:auto-close] Error cerrando caja ${reg.caja.id}:`, errorMsg);
      errores.push({ cajaId: reg.caja.id, error: errorMsg });
    }
  }

  // Un tope alcanzado significa que hay más cajas esperando
  if (registersToClose.length > MAX_POR_EJECUCION) {
    console.warn(
      `[cron:auto-close] se alcanzó el tope de ${MAX_POR_EJECUCION} cajas (${registersToClose.length} totales)`
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    revisadas: registersToClose.length,
    procesadas: candidatas.length,
    cerradas: cerradas.length,
    omitidas: omitidas.length,
    errores: errores.length,
    detalle: {
      cerradas,
      omitidas,
      errores,
    },
  });
}