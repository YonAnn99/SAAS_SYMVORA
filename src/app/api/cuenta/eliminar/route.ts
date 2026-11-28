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
import { nombreCompleto } from "@/lib/nombre-usuario";
import { construirAvisoBaja } from "@/lib/aviso-baja";

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
      const datos = await datosDeBaja(servicio, auth.userId, solicitud.tenant_id);
      await sendCorreoInterno(
        construirAvisoBaja({
          tipo: "solicitud",
          ...datos,
          conservarContacto: cuerpo.conservar_contacto !== false,
          motivo: typeof cuerpo.motivo === "string" ? cuerpo.motivo : null,
          ejecutarEn: solicitud.ejecutar_en,
        })
      );
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

  // Antes de cancelar: la solicitud viva de esta persona, para poder avisar qué se canceló.
  const servicio = createSupabaseServiceRoleClient();
  const { data: viva } = await servicio
    .from("solicitudes_baja")
    .select("tenant_id, motivo, conservar_contacto, solicitada_en")
    .eq("user_id", auth.userId)
    .is("cancelada_en", null)
    .is("ejecutada_en", null)
    .order("solicitada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancelar_baja");
  if (error) {
    return NextResponse.json({ error: "No se pudo cancelar la solicitud" }, { status: 500 });
  }
  const cancelada = Boolean(data);

  if (cancelada && viva) {
    const canceladaEn = new Date().toISOString();
    after(async () => {
      try {
        const datos = await datosDeBaja(servicio, auth.userId, viva.tenant_id);
        await sendCorreoInterno(
          construirAvisoBaja({
            tipo: "cancelacion",
            ...datos,
            conservarContacto: viva.conservar_contacto !== false,
            motivo: viva.motivo,
            solicitadaEn: viva.solicitada_en,
            canceladaEn,
          })
        );
      } catch (e) {
        console.error("[eliminar-cuenta] no se pudo avisar la cancelación:", e);
      }
    });
  }

  return NextResponse.json({ success: true, cancelada });
}

/**
 * Quién pide la baja, en qué negocio y cuántas personas tiene con acceso. Solo con service role: los datos
 * salen de la base, no de la petición.
 */
async function datosDeBaja(
  servicio: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  tenantId: string | null
) {
  const [usuario, tenant, membresia, miembros] = await Promise.all([
    servicio.auth.admin.getUserById(userId),
    tenantId
      ? servicio.from("tenants").select("nombre_comercial").eq("id", tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    tenantId
      ? servicio.from("tenant_memberships").select("role").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    tenantId
      ? servicio.from("tenant_memberships").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId)
      : Promise.resolve({ count: 0 }),
  ]);
  const cuenta = usuario.data?.user;
  return {
    persona: {
      nombre: nombreCompleto((cuenta?.user_metadata ?? {}) as Parameters<typeof nombreCompleto>[0]) || null,
      correo: cuenta?.email ?? null,
      rol: (membresia.data?.role as string | undefined) ?? null,
    },
    negocio: tenant.data?.nombre_comercial ?? "(sin negocio)",
    miembros: miembros.count ?? 0,
  };
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
