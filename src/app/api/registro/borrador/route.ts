import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import {
  cabecerasRateLimit,
  consumirRateLimit,
  obtenerIpCliente,
} from "@/lib/rate-limit";
import { aE164 } from "@/lib/telefono";

/**
 * Borrador del registro ("Crear cuenta" a medias).
 *
 * El formulario lo manda al salir de los campos de contacto, en cuanto hay
 * nombre, negocio y un celular valido. Si la persona no termina, el cron
 * `seguimiento-whatsapp` le escribe para ayudarla (ver
 * `lib/seguimiento-whatsapp.ts`).
 *
 * Es una ruta PUBLICA (aun no hay cuenta), asi que:
 *   - limite por IP (Postgres, migracion 058) y un campo trampa (`sitio_web`)
 *     que una persona no ve y un bot llena;
 *   - solo escribe la service role: `registros_pendientes` no tiene politicas;
 *   - nunca devuelve lo guardado ni dice si el numero ya existia.
 *
 * Con `completado: true` (lo llama `crearNegocio` ya con sesion) marca el
 * borrador como terminado para que nadie reciba el "¿tuviste algun problema?".
 */

export const maxDuration = 15;

const LIMITE_POR_IP = 20;
const VENTANA_SEGUNDOS = 3600;

const cuerpoSchema = z.object({
  pais: z.string().max(2),
  telefono: z.string().max(25),
  nombre: z.string().trim().max(120).optional().default(""),
  negocio: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().max(200).optional(),
  sitio_web: z.string().optional(),
  completado: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = cuerpoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const datos = parsed.data;

  // Campo trampa lleno: se responde "ok" para no darle pistas al bot.
  if (datos.sitio_web) return NextResponse.json({ ok: true });

  const telefono = aE164(datos.pais, datos.telefono);
  if (!telefono) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createSupabaseServiceRoleClient();

  if (datos.completado) {
    // Solo quien ya tiene sesion puede cerrar su borrador.
    const auth = await createSupabaseServerClient();
    const { data } = await auth.auth.getUser();
    if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
    await supabase
      .from("registros_pendientes")
      .update({ estado: "completado", actualizado_en: new Date().toISOString() })
      .eq("telefono", telefono);
    return NextResponse.json({ ok: true });
  }

  const limite = await consumirRateLimit(
    `registro-borrador:${obtenerIpCliente(request)}`,
    LIMITE_POR_IP,
    VENTANA_SEGUNDOS
  );
  if (!limite.permitido) {
    return NextResponse.json({ ok: false }, { status: 429, headers: cabecerasRateLimit(limite) });
  }

  if (!datos.nombre || datos.negocio.length < 2) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = datos.email && z.string().email().safeParse(datos.email).success ? datos.email : null;

  // Upsert por telefono, sin pisar un borrador que ya se completo o contacto:
  // reescribirlo a "borrador" haria que se le volviera a escribir.
  const { data: existente } = await supabase
    .from("registros_pendientes")
    .select("estado")
    .eq("telefono", telefono)
    .maybeSingle();

  const ahora = new Date().toISOString();
  if (!existente) {
    await supabase.from("registros_pendientes").insert({
      telefono,
      email,
      nombre: datos.nombre,
      negocio: datos.negocio,
    });
  } else if (existente.estado === "borrador") {
    await supabase
      .from("registros_pendientes")
      .update({ email, nombre: datos.nombre, negocio: datos.negocio, actualizado_en: ahora })
      .eq("telefono", telefono);
  }

  return NextResponse.json({ ok: true });
}
