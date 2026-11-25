import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { consumirRateLimit } from "@/lib/rate-limit";
import { clavePlanDeNivel } from "@/features/payments/promocion";
import {
  modoDeCambio,
  nivelCambiaAhora,
  precioDesdeProximoCobroMXN,
  tipoDeCambio,
} from "@/features/payments/cambio-de-plan";
import { esNivel, funcionesDe, nivelesActivos, NIVELES_ORDEN } from "@/lib/niveles";

// Presupuesto de ejecucion explicito (llama a Conekta).
export const maxDuration = 30;

const esquema = z.object({
  tenant_id: z.string().uuid(),
  nivel: z.string(),
});

/**
 * Cambio de nivel de quien YA paga, desde Suscripcion. Reglas en `features/payments/cambio-de-plan.ts`:
 * subir cambia el nivel ya; bajar y los pagos unicos esperan al siguiente cobro (`nivel_pendiente`, que el
 * webhook confirma). Sin promocion. Lo anual va por soporte (409 `cambio_por_soporte`).
 *
 * FALLA CERRADO: la base solo se toca despues de que Conekta respondio bien. Si Conekta rechaza, nada local
 * cambia. El endpoint de Conekta para cambiar el plan de una suscripcion esta marcado como deprecado y su
 * prorrateo no esta documentado; es el mismo que el webhook ya usa para cerrar la promocion.
 */
export async function POST(request: Request) {
  try {
    const parsed = esquema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "peticion_invalida" }, { status: 400 });
    }
    const { tenant_id } = parsed.data;
    if (!esNivel(parsed.data.nivel)) {
      return NextResponse.json({ error: "nivel_invalido", niveles: NIVELES_ORDEN }, { status: 400 });
    }
    const nivelNuevo = parsed.data.nivel;

    if (!nivelesActivos()) {
      return NextResponse.json({ error: "niveles_no_disponibles" }, { status: 409 });
    }

    // `subscription.manage` es SUPER_ADMIN-only: igual que cancelar.
    const auth = await requireTenantAccess(request, {
      tenantId: tenant_id,
      permission: "subscription.manage",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const limite = await consumirRateLimit(`cambiar-plan:${tenant_id}`, 10, 60 * 60);
    if (!limite.permitido) {
      return NextResponse.json({ error: "demasiados_intentos" }, { status: 429 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id, status, billing_period, last_payment_at, nivel, conekta_customer_id, conekta_subscription_id")
      .eq("tenant_id", tenant_id)
      .single();
    if (subError || !sub) {
      return NextResponse.json({ error: "sin_suscripcion" }, { status: 404 });
    }
    // Solo cambia de plan quien ya paga y sigue activo; el resto contrata desde el checkout.
    if (sub.status !== "active" || !sub.last_payment_at) {
      return NextResponse.json({ error: "sin_suscripcion_activa" }, { status: 409 });
    }

    const periodo = sub.billing_period === "yearly" ? "yearly" : "monthly";
    const modo = modoDeCambio({ periodo, tieneSuscripcionRecurrente: Boolean(sub.conekta_subscription_id) });
    if (modo === "soporte") {
      return NextResponse.json({ error: "cambio_por_soporte" }, { status: 409 });
    }

    const actual = esNivel(sub.nivel) ? sub.nivel : null;
    const tipo = tipoDeCambio(actual, nivelNuevo);
    if (tipo === "igual") {
      return NextResponse.json({ ok: true, sin_cambio: true });
    }

    // Que sus sucursales activas quepan en el nivel nuevo (nada se borra: se le pide cerrar alguna).
    const max = funcionesDe(nivelNuevo).sucursalesMax;
    if (max !== null) {
      const { count } = await supabase
        .from("sucursales")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("activa", true);
      if ((count ?? 0) > max) {
        return NextResponse.json(
          { error: "demasiadas_sucursales", max, usadas: count ?? 0 },
          { status: 409 }
        );
      }
    }

    // 1) Conekta primero (solo con suscripcion recurrente): si falla, no se cambia nada.
    if (modo === "tarjeta") {
      if (!sub.conekta_customer_id) {
        return NextResponse.json({ error: "cambio_por_soporte" }, { status: 409 });
      }
      try {
        const { ensurePlanExists } = await import("@/features/payments/services/conekta/plans");
        const { cambiarPlan } = await import("@/features/payments/services/conekta/subscriptions");
        const planId = await ensurePlanExists(clavePlanDeNivel(nivelNuevo, "monthly"));
        await cambiarPlan(sub.conekta_customer_id, planId);
      } catch (error) {
        console.error(`[cambiar-plan] Conekta rechazo el cambio de ${tenant_id}:`, error);
        return NextResponse.json({ error: "conekta_no_pudo_cambiar" }, { status: 502 });
      }
    }

    // 2) La base. El cambio cierra la promocion en curso (es solo para suscripciones nuevas).
    const { error: updError } = await supabase
      .from("subscriptions")
      .update({
        promo_cobros_restantes: 0,
        promo_plan: null,
        nivel_pendiente: nivelNuevo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (updError) {
      console.error(`[cambiar-plan] Conekta cambio pero la base no: ${tenant_id}`, updError.message);
      return NextResponse.json({ error: "no_se_pudo_guardar" }, { status: 500 });
    }

    // Subir con tarjeta cambia el nivel YA; todo lo demas lo confirma el siguiente cobro (webhook).
    let aplicadoYa = false;
    if (modo === "tarjeta" && nivelCambiaAhora(tipo)) {
      const { error: nivelError } = await supabase.rpc("asignar_nivel", {
        p_tenant_id: tenant_id,
        p_nivel: nivelNuevo,
      });
      if (nivelError) {
        // El plan ya cambio en Conekta: se queda `nivel_pendiente` y el siguiente cobro lo confirma.
        console.error(`[cambiar-plan] asignar_nivel fallo (${tenant_id}):`, nivelError.message);
      } else {
        aplicadoYa = true;
      }
    }

    return NextResponse.json({
      ok: true,
      tipo,
      modo,
      aplicado_ya: aplicadoYa,
      precio_desde_proximo_cobro: precioDesdeProximoCobroMXN(nivelNuevo, "monthly"),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cambiar-plan] error inesperado:", msg);
    return NextResponse.json({ error: "error_inesperado" }, { status: 500 });
  }
}
