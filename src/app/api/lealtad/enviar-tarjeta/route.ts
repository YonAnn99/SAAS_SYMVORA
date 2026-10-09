import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { consumirRateLimit, cabecerasRateLimit } from "@/lib/rate-limit";
import { sendTarjetaLealtadEmail } from "@/lib/email";
import { urlTarjeta } from "@/features/lealtad/lealtad";
import { getAppUrl } from "@/lib/site";

export const maxDuration = 15;

/**
 * Envia por correo la tarjeta de lealtad a su cliente (Clientes → ventana de
 * la tarjeta). Lo puede hacer quien vende (`sales.create`), igual que emitirla.
 *
 * El correo destino sale de la base, nunca del cuerpo de la peticion: asi no
 * sirve para mandar correos de SYMVORA a cualquier direccion. Limite: 20 por
 * hora por usuario. En la demo no se envia nada.
 */
export async function POST(request: Request) {
  const { tenantId, tarjetaId, locale } = await request.json().catch(() => ({}));
  if (typeof tenantId !== "string" || typeof tarjetaId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const auth = await requireTenantAccess(request, { tenantId, permission: "sales.create" });
  if (!auth.ok) return auth.response;

  const demo = await assertNotDemo();
  if (!demo.ok) return demo.response;

  const limite = await consumirRateLimit(`lealtad-correo:${auth.userId}`, 20, 3600);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Enviaste muchas tarjetas seguidas. Intenta más tarde." },
      { status: 429, headers: cabecerasRateLimit(limite) }
    );
  }

  // Service role sin RLS: el filtro por tenant es lo que impide leer una
  // tarjeta de otro negocio.
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("tarjetas_lealtad")
    .select(
      "codigo, sellos, cliente:clientes(email), programa:programas_lealtad(nombre, sellos_meta, premio_descripcion, activo), tenant:tenants(nombre_comercial)"
    )
    .eq("id", tarjetaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const fila = data as {
    codigo: string;
    sellos: number;
    cliente: { email: string | null } | null;
    programa: { nombre: string; sellos_meta: number; premio_descripcion: string; activo: boolean } | null;
    tenant: { nombre_comercial: string } | null;
  } | null;

  if (!fila || !fila.programa || !fila.tenant) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }
  const email = fila.cliente?.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "El cliente no tiene correo capturado" }, { status: 400 });
  }

  const resultado = await sendTarjetaLealtadEmail({
    to: email,
    negocio: fila.tenant.nombre_comercial,
    programa: fila.programa.nombre,
    premio: fila.programa.premio_descripcion,
    sellos: fila.sellos,
    sellosMeta: fila.programa.sellos_meta,
    url: urlTarjeta(fila.codigo, locale === "en" ? "en" : "es", getAppUrl()),
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: "No se pudo enviar el correo, intenta de nuevo" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
