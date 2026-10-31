import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { sendCorreoInterno } from "@/lib/email";

/**
 * Ejecuta las solicitudes de eliminacion de cuenta cuyo plazo de 30 dias ya
 * vencio (migracion 128). Diario; requiere `CRON_SECRET` (falla cerrada).
 *
 * Por cada una:
 *   1. Si es del dueño, borra los archivos del negocio en Storage (fotos, logo,
 *      PDFs de ordenes). Va ANTES de la base: borrar la fila de `storage.objects`
 *      por SQL no borra el archivo.
 *   2. `ejecutar_baja`: guarda el contacto (si lo permitio) y los pagos, borra
 *      el negocio o saca al colaborador, y cierra las cuentas.
 * Un error en una no frena las demas: queda en `solicitudes_baja.error` y se
 * avisa a hola@ para revisarla a mano.
 *
 * `?dry=1` lista las que tocaria sin hacer nada.
 */

export const maxDuration = 60;

const MAX_POR_EJECUCION = 10;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

type Servicio = ReturnType<typeof createSupabaseServiceRoleClient>;

async function borrarArchivos(servicio: Servicio, tenantId: string): Promise<number> {
  const { data, error } = await servicio.rpc("archivos_de_negocio", { p_tenant_id: tenantId });
  if (error) throw new Error(`No se pudieron listar los archivos: ${error.message}`);
  const filas = (data ?? []) as { bucket_id: string; nombre: string }[];
  const porBucket = new Map<string, string[]>();
  for (const f of filas) porBucket.set(f.bucket_id, [...(porBucket.get(f.bucket_id) ?? []), f.nombre]);
  for (const [bucket, nombres] of porBucket) {
    for (let i = 0; i < nombres.length; i += 100) {
      const { error: e } = await servicio.storage.from(bucket).remove(nombres.slice(i, i + 100));
      if (e) throw new Error(`No se pudieron borrar archivos de ${bucket}: ${e.message}`);
    }
  }
  return filas.length;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const servicio = createSupabaseServiceRoleClient();
  const { data: vencidas, error } = await servicio
    .from("solicitudes_baja")
    .select("id, tenant_id, es_dueno, ejecutar_en")
    .is("cancelada_en", null)
    .is("ejecutada_en", null)
    .lte("ejecutar_en", new Date().toISOString())
    .order("ejecutar_en")
    .limit(MAX_POR_EJECUCION);

  if (error) {
    console.error("[cron ejecutar-bajas] no se pudieron leer:", error.message);
    return NextResponse.json({ error: "Error leyendo solicitudes" }, { status: 500 });
  }

  if (new URL(request.url).searchParams.get("dry") === "1") {
    return NextResponse.json({ dry: true, vencidas });
  }

  const hechas: { id: string; resultado: string; archivos: number }[] = [];
  const fallidas: { id: string; error: string }[] = [];

  for (const s of vencidas ?? []) {
    try {
      const archivos = s.es_dueno && s.tenant_id ? await borrarArchivos(servicio, s.tenant_id) : 0;
      const { data, error: e } = await servicio.rpc("ejecutar_baja", { p_solicitud_id: s.id });
      if (e) throw new Error(e.message);
      hechas.push({ id: s.id, resultado: (data as { resultado?: string })?.resultado ?? "?", archivos });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      fallidas.push({ id: s.id, error: mensaje });
      await servicio.from("solicitudes_baja").update({ error: mensaje.slice(0, 500) }).eq("id", s.id);
    }
  }

  if (hechas.length || fallidas.length) {
    const texto = [
      `Cuentas eliminadas: ${hechas.length}.`,
      ...fallidas.map((f) => `FALLÓ ${f.id}: ${f.error}`),
    ].join("\n");
    await sendCorreoInterno({
      subject: fallidas.length
        ? `Eliminación de cuentas: ${fallidas.length} con error`
        : `Eliminación de cuentas: ${hechas.length} ejecutadas`,
      text: texto,
      html: `<pre>${texto.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ hechas, fallidas });
}
