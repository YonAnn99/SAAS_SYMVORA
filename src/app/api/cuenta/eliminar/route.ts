import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { consumirRateLimit } from "@/lib/rate-limit";
import { sendCorreoInterno } from "@/lib/email";

/**
 * Pedir (POST) o cancelar (DELETE) la eliminacion de la propia cuenta. Lo exige
 * Google Play para publicar la app (migracion 128).
 *
 * - El titular es quien tiene la sesion: no hay `user_id` en la peticion.
 * - Queda una solicitud con 30 dias para arrepentirse; la ejecuta el cron
 *   /api/cron/ejecutar-bajas.
 * - Si es el DUEÑO, se cierra el negocio entero: aqui mismo se cancela la
 *   suscripcion en Conekta, para que no se cobre otra mensualidad durante el
 *   plazo. Si se arrepiente, la suscripcion se reactiva desde Suscripcion.
 * - Se avisa a hola@ (correo interno).
 */

export const maxDuration = 30;

interface Cuerpo {
  conservar_contacto?: boolean;
  motivo?: string;
}

export async function POST(request: Request) {
  const auth = await requireTenantAccess(request);
  if (!auth.ok) return auth.response;

  const demo = await assertNotDemo();
  if (!demo.ok) return demo.response;

  const limite = await consumirRateLimit(`eliminar-cuenta:${auth.userId}`, 5, 3600);
  if (!limite.permitido) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un poco." }, { status: 429 });
  }

  let cuerpo: Cuerpo = {};
  try {
    cuerpo = (await request.json()) as Cuerpo;
  } catch {
    // Sin cuerpo: se conservan los valores por defecto.
  }

  // Con la sesion del usuario: `solicitar_baja` toma auth.uid().
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("solicitar_baja", {
    p_conservar_contacto: cuerpo.conservar_contacto !== false,
    p_motivo: typeof cuerpo.motivo === "string" ? cuerpo.motivo : null,
  });
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "No se pudo registrar la solicitud" },
      { status: 400 }
    );
  }

  const solicitud = data as {
    id: string;
    tenant_id: string | null;
    es_dueno: boolean;
    ejecutar_en: string;
  };

  const servicio = createSupabaseServiceRoleClient();
  let suscripcionCancelada = false;

  if (solicitud.es_dueno && solicitud.tenant_id) {
    suscripcionCancelada = await cancelarSuscripcion(servicio, solicitud.tenant_id);
  }

  after(async () => {
    try {
      const { data: tenant } = solicitud.tenant_id
        ? await servicio.from("tenants").select("nombre_comercial").eq("id", solicitud.tenant_id).maybeSingle()
        : { data: null };
      const negocio = tenant?.nombre_comercial ?? "(sin negocio)";
      const fecha = new Date(solicitud.ejecutar_en).toLocaleDateString("es-MX", {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const quien = solicitud.es_dueno ? "El DUEÑO" : "Un colaborador";
      const texto = `${quien} de «${negocio}» pidió eliminar su cuenta. Se ejecuta el ${fecha}.${
        solicitud.es_dueno ? " Se borrará el negocio completo." : ""
      } Conservar contacto: ${cuerpo.conservar_contacto !== false ? "sí" : "no"}. Motivo: ${
        cuerpo.motivo?.trim() || "(sin motivo)"
      }`;
      await sendCorreoInterno({
        subject: `Solicitud de eliminación de cuenta: ${negocio}`,
        text: texto,
        html: `<p>${texto.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</p>`,
      });
    } catch (e) {
      console.error("[eliminar-cuenta] no se pudo avisar a hola@:", e);
    }
  });

  return NextResponse.json({
    success: true,
    ejecutar_en: solicitud.ejecutar_en,
    es_dueno: solicitud.es_dueno,
    suscripcion_cancelada: suscripcionCancelada,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireTenantAccess(request);
  if (!auth.ok) return auth.response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancelar_baja");
  if (error) {
    return NextResponse.json({ error: "No se pudo cancelar la solicitud" }, { status: 500 });
  }
  return NextResponse.json({ success: true, cancelada: Boolean(data) });
}

/**
 * Cancela la suscripcion recurrente en Conekta y la marca cancelada. Un error
 * aqui NO detiene la solicitud: se registra y el cron vuelve a revisar antes de
 * borrar (un negocio borrado ya no tiene a quien cobrarle).
 */
async function cancelarSuscripcion(
  servicio: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<boolean> {
  try {
    const { data: sub } = await servicio
      .from("subscriptions")
      .select("id, conekta_customer_id, conekta_subscription_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!sub || sub.status === "canceled") return false;

    if (sub.conekta_subscription_id && sub.conekta_customer_id) {
      const { cancelSubscription } = await import(
        "@/features/payments/services/conekta/subscriptions"
      );
      try {
        await cancelSubscription(sub.conekta_customer_id);
      } catch (e) {
        // Ya no existe en Conekta: se sigue y se marca cancelada aqui.
        const status = (e as { response?: { status?: number } }).response?.status;
        if (status !== 404) throw e;
      }
    }

    const ahora = new Date().toISOString();
    await Promise.all([
      servicio.from("subscriptions").update({ status: "canceled", updated_at: ahora }).eq("id", sub.id),
      servicio.from("tenants").update({ subscription_status: "canceled" }).eq("id", tenantId),
    ]);
    return true;
  } catch (e) {
    console.error("[eliminar-cuenta] no se pudo cancelar la suscripción:", e);
    return false;
  }
}
