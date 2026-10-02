import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  DIAS_LIMPIEZA_BORRADORES,
  DIAS_MAX_ONBOARDING_ATASCADO,
  DIAS_MAX_REGISTRO_ABANDONADO,
  HORAS_MAX_PAGO_ABANDONADO,
  HORAS_ONBOARDING_ATASCADO,
  HORAS_PAGO_ABANDONADO,
  HORAS_REGISTRO_ABANDONADO,
  tocaOnboardingAtascado,
  tocaPagoAbandonado,
  tocaRegistroAbandonado,
} from "@/lib/seguimiento-whatsapp";
import {
  avisarDuenoPorWhatsApp,
  enviarPlantillaWhatsApp,
  nombreDePila,
  whatsappActivo,
} from "@/lib/whatsapp-api";
import { PRECIO_PROMO_MXN, precioListaMXN, promoAplica } from "@/features/payments/promocion";
import { getAppUrl, getSiteUrl } from "@/lib/site";

/**
 * Seguimiento por WhatsApp de registros, arranques y pagos que se quedaron a
 * medias. Lo dispara el cron de Vercel (`vercel.json`); las reglas de a quien
 * le toca viven en `lib/seguimiento-whatsapp.ts` (con tests).
 *
 * APAGADO sin las llaves de Meta (`lib/whatsapp-api.ts`): no envia NI MARCA
 * nada, asi nadie queda como "contactado" sin haberlo sido. Solo hace la
 * limpieza de borradores viejos. `?dry=1` calcula a quien le tocaria.
 *
 * HORARIO: diario a las 17:00 UTC (11:00 en CDMX). El registro abandonado
 * querria correr cada hora, pero el plan Hobby de Vercel solo admite cron
 * diarios y uno por hora haria fallar el deploy. Con Pro basta cambiar el
 * `schedule` a "0 * * * *": las ventanas ya estan en horas.
 *
 * REQUIERE `CRON_SECRET`, como los demas cron.
 */

export const maxDuration = 60;

const MAX_POR_FLUJO = 100;
const MS_POR_HORA = 3_600_000;

type Supabase = ReturnType<typeof createSupabaseServiceRoleClient>;
type Resultado = { enviados: number; candidatos: number; omitidos: number };

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

const haceHoras = (ahora: Date, horas: number) => new Date(ahora.getTime() - horas * MS_POR_HORA).toISOString();

/** Flujo 1: dejo nombre, negocio y celular en "Crear cuenta" y no termino. */
async function registrosAbandonados(supabase: Supabase, ahora: Date, enviar: boolean): Promise<Resultado> {
  const r: Resultado = { enviados: 0, candidatos: 0, omitidos: 0 };
  const { data } = await supabase
    .from("registros_pendientes")
    .select("id, telefono, nombre, negocio, estado, whatsapp_enviado_en, actualizado_en")
    .eq("estado", "borrador")
    .is("whatsapp_enviado_en", null)
    .lte("actualizado_en", haceHoras(ahora, HORAS_REGISTRO_ABANDONADO))
    .gte("actualizado_en", haceHoras(ahora, DIAS_MAX_REGISTRO_ABANDONADO * 24))
    .limit(MAX_POR_FLUJO);

  for (const b of data ?? []) {
    if (!tocaRegistroAbandonado(b, ahora)) continue;

    // Ya tiene cuenta con ese celular (p.ej. termino con Google): se cierra.
    const { data: yaRegistrado } = await supabase
      .from("contacto_usuarios")
      .select("user_id")
      .eq("telefono", b.telefono)
      .limit(1)
      .maybeSingle();
    if (yaRegistrado) {
      if (enviar) await supabase.from("registros_pendientes").update({ estado: "completado" }).eq("id", b.id);
      continue;
    }

    r.candidatos++;
    if (!enviar) continue;
    const envio = await enviarPlantillaWhatsApp(b.telefono, "registro_incompleto", {
      nombre: b.nombre.split(/\s+/)[0] || b.nombre,
      negocio: b.negocio,
    });
    if (!envio.enviado) {
      r.omitidos++;
      console.error(`[cron:seguimiento-whatsapp] registro ${b.id}: ${envio.motivo} ${envio.error ?? ""}`);
      continue;
    }
    await supabase
      .from("registros_pendientes")
      .update({ estado: "contactado", whatsapp_enviado_en: ahora.toISOString() })
      .eq("id", b.id);
    r.enviados++;
  }
  return r;
}

/** Flujo 2: 48 h en prueba con 0 productos o 0 ventas. */
async function onboardingAtascado(supabase: Supabase, ahora: Date, enviar: boolean): Promise<Resultado> {
  const r: Resultado = { enviados: 0, candidatos: 0, omitidos: 0 };
  // `trial_start` nace con el negocio (complete_onboarding), asi que sirve de
  // "creado en" sin cruzar con `tenants`.
  const { data } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, status, trial_start, aviso_onboarding_en")
    .eq("status", "trial")
    .is("aviso_onboarding_en", null)
    .lte("trial_start", haceHoras(ahora, HORAS_ONBOARDING_ATASCADO))
    .gte("trial_start", haceHoras(ahora, DIAS_MAX_ONBOARDING_ATASCADO * 24))
    .limit(MAX_POR_FLUJO);

  for (const s of data ?? []) {
    const [{ count: productos }, { count: ventas }] = await Promise.all([
      supabase.from("productos").select("id", { count: "exact", head: true }).eq("tenant_id", s.tenant_id),
      supabase.from("ventas").select("id", { count: "exact", head: true }).eq("tenant_id", s.tenant_id),
    ]);
    const negocio = {
      status: s.status as string,
      aviso_onboarding_en: s.aviso_onboarding_en,
      creado_en: s.trial_start,
      productos: productos ?? 0,
      ventas: ventas ?? 0,
    };
    if (!tocaOnboardingAtascado(negocio, ahora)) continue;

    r.candidatos++;
    if (!enviar) continue;
    const envio = await avisarDuenoPorWhatsApp(supabase, s.tenant_id, "onboarding_ayuda", async (ownerId) => ({
      nombre: await nombreDePila(supabase, ownerId),
      enlace: `${getSiteUrl()}/es/aprende`,
    }));
    if (!envio.enviado) {
      // Sin celular no se marca: si lo agrega en estos dias, aun le llega.
      r.omitidos++;
      continue;
    }
    await supabase.from("subscriptions").update({ aviso_onboarding_en: ahora.toISOString() }).eq("id", s.id);
    r.enviados++;
  }
  return r;
}

/** Flujo 3: abrio el pago en /billing y no lo completo. */
async function pagosAbandonados(supabase: Supabase, ahora: Date, enviar: boolean): Promise<Resultado> {
  const r: Resultado = { enviados: 0, candidatos: 0, omitidos: 0 };
  const { data } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, status, checkout_iniciado_en, aviso_pago_abandonado_en, last_payment_at")
    .neq("status", "active")
    .lte("checkout_iniciado_en", haceHoras(ahora, HORAS_PAGO_ABANDONADO))
    .gte("checkout_iniciado_en", haceHoras(ahora, HORAS_MAX_PAGO_ABANDONADO))
    .limit(MAX_POR_FLUJO);

  const lista = precioListaMXN("monthly");
  const precio = promoAplica("monthly")
    ? `$${PRECIO_PROMO_MXN} al mes con la tarifa promocional, en vez de $${lista}`
    : `$${lista} al mes`;

  for (const s of data ?? []) {
    if (!tocaPagoAbandonado({ ...s, status: s.status as string }, ahora)) continue;

    r.candidatos++;
    if (!enviar) continue;
    const envio = await avisarDuenoPorWhatsApp(supabase, s.tenant_id, "pago_pendiente", async (ownerId) => ({
      nombre: await nombreDePila(supabase, ownerId),
      precio,
      enlace: `${getAppUrl()}/es/billing`,
    }));
    if (!envio.enviado) {
      r.omitidos++;
      continue;
    }
    await supabase
      .from("subscriptions")
      .update({ aviso_pago_abandonado_en: ahora.toISOString() })
      .eq("id", s.id);
    r.enviados++;
  }
  return r;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const activo = whatsappActivo();
  const enviar = activo && !dryRun;
  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date();

  // Limpieza: los borradores de registro no se guardan para siempre.
  let borradoresBorrados = 0;
  if (!dryRun) {
    const { count } = await supabase
      .from("registros_pendientes")
      .delete({ count: "exact" })
      .lt("creado_en", haceHoras(ahora, DIAS_LIMPIEZA_BORRADORES * 24));
    borradoresBorrados = count ?? 0;
  }

  // Apagado y sin `dry`: no hay nada que calcular ni marcar.
  if (!activo && !dryRun) {
    return NextResponse.json({ ok: true, desactivado: true, borradoresBorrados });
  }

  try {
    const registro = await registrosAbandonados(supabase, ahora, enviar);
    const onboarding = await onboardingAtascado(supabase, ahora, enviar);
    const pago = await pagosAbandonados(supabase, ahora, enviar);
    return NextResponse.json({
      ok: true,
      dryRun,
      desactivado: !activo,
      borradoresBorrados,
      registro,
      onboarding,
      pago,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron:seguimiento-whatsapp] fallo:", msg);
    return NextResponse.json({ error: "Error en el seguimiento" }, { status: 500 });
  }
}
