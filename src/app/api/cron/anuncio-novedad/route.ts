import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { consumirRateLimit } from "@/lib/rate-limit";
import { construirCorreoNovedadCatalogo, sendNovedadCatalogoEmail } from "@/lib/email";
import type { Acceso } from "@/lib/acceso-suscripcion";
import {
  claveCorreoNovedad,
  elegirDestinatarios,
  type CandidatoNovedad,
} from "@/lib/anuncio-novedad";

/**
 * Correo a los dueños anunciando el Catálogo en línea (`lib/novedades.ts`).
 *
 * NO está en `vercel.json`: se corre a mano, una vez, después del deploy.
 * - Sin parámetros es un SIMULACRO: devuelve a quién le llegaría, a quién no y
 *   por qué, y el HTML del correo. No consume nada.
 * - Con `?enviar=1` manda. Cada dueño queda marcado (`consumirRateLimit`, 1 en
 *   60 días) ANTES de enviar, así que correrlo otra vez no duplica. Si Resend
 *   falla con alguien, sale en `fallidos` y no se reintenta solo.
 *
 * Quién recibe y quién no: `elegirDestinatarios` (`lib/anuncio-novedad.ts`).
 * Requiere `CRON_SECRET` (falla cerrada, como los demás).
 */

export const maxDuration = 60;

const NOVEDAD = "catalogo-en-linea";
const VENTANA_SEGUNDOS = 60 * 24 * 60 * 60;
/** Resend permite pocas peticiones por segundo: se manda de una en una. */
const PAUSA_MS = 600;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const [{ data: duenos, error }, { data: catalogos, error: errorCatalogos }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("user_id, tenant_id, tenants!inner(nombre_comercial, demo_expira_en)")
      .eq("role", "SUPER_ADMIN"),
    supabase.from("catalogos_en_linea").select("tenant_id"),
  ]);
  if (error || errorCatalogos || !duenos) {
    console.error("[anuncio-novedad] no se pudo leer:", error?.message ?? errorCatalogos?.message);
    return NextResponse.json({ error: "Error leyendo los negocios" }, { status: 500 });
  }

  const conCatalogo = new Set((catalogos ?? []).map((c) => c.tenant_id as string));
  const candidatos: CandidatoNovedad[] = [];
  for (const d of duenos) {
    const tenant = (Array.isArray(d.tenants) ? d.tenants[0] : d.tenants) as {
      nombre_comercial: string | null;
      demo_expira_en: string | null;
    } | null;
    const esDemo = !tenant || tenant.demo_expira_en !== null;
    // Las demos ni se consultan: se descartan igual y son las más numerosas.
    const [{ data: acceso }, { data: usuario }] = esDemo
      ? [{ data: null }, { data: null }]
      : await Promise.all([
          supabase.rpc("acceso_tenant", { p_tenant_id: d.tenant_id }),
          supabase.auth.admin.getUserById(d.user_id),
        ]);
    candidatos.push({
      tenantId: d.tenant_id,
      negocio: tenant?.nombre_comercial || "tu negocio",
      esDemo,
      acceso: (acceso as Acceso | null) ?? null,
      tieneCatalogo: conCatalogo.has(d.tenant_id),
      userId: d.user_id,
      email: usuario?.user?.email ?? null,
      meta: (usuario?.user?.user_metadata as Record<string, unknown> | undefined) ?? null,
      appMeta: (usuario?.user?.app_metadata as Record<string, unknown> | undefined) ?? null,
    });
  }

  const { destinatarios, excluidos } = elegirDestinatarios(candidatos);
  const enviar = new URL(request.url).searchParams.get("enviar") === "1";

  if (!enviar) {
    const muestra = construirCorreoNovedadCatalogo({
      nombre: destinatarios[0]?.nombre ?? "",
      negocio: destinatarios[0]?.negocio ?? "tu negocio",
    });
    return NextResponse.json({
      dry: true,
      total: destinatarios.length,
      destinatarios: destinatarios.map(({ to, nombre, negocio }) => ({ to, nombre, negocio })),
      // Las demos no se listan una por una: solo cuántas.
      excluidos: excluidos.filter((e) => e.motivo !== "demo"),
      demosExcluidas: excluidos.filter((e) => e.motivo === "demo").length,
      asunto: muestra.subject,
      html: muestra.html,
    });
  }

  const enviados: string[] = [];
  const yaEnviados: string[] = [];
  const fallidos: { to: string; error?: string }[] = [];
  for (const d of destinatarios) {
    const turno = await consumirRateLimit(claveCorreoNovedad(NOVEDAD, d.userId), 1, VENTANA_SEGUNDOS);
    if (!turno.permitido) {
      yaEnviados.push(d.to);
      continue;
    }
    const r = await sendNovedadCatalogoEmail({ to: d.to, nombre: d.nombre, negocio: d.negocio });
    if (r.ok) enviados.push(d.to);
    else fallidos.push({ to: d.to, error: r.error });
    await new Promise((listo) => setTimeout(listo, PAUSA_MS));
  }

  return NextResponse.json({ enviados, yaEnviados, fallidos });
}
