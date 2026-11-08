import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { consumirRateLimit, cabecerasRateLimit } from "@/lib/rate-limit";
import { actualizarPaseGoogleWallet } from "@/features/lealtad/google-wallet/client";
import { obtenerConfigGoogleWallet } from "@/features/lealtad/google-wallet/jwt";

export const maxDuration = 15;

/**
 * Sincroniza con Google Wallet el pase de una tarjeta de lealtad despues de una
 * venta en el POS (lo llama `pos-service.ts`, sin esperar la respuesta).
 *
 * SEGURIDAD: solo quien vende en ese negocio (`sales.create`), y del cuerpo solo
 * se toman `tenantId` y `tarjetaId`. Sellos, meta, premio y codigo se LEEN de la
 * base: nadie puede poner un saldo inventado ni mandar avisos al telefono de
 * clientes de otro negocio. En la demo no hace nada.
 */
export async function POST(request: Request) {
  const { tenantId, tarjetaId } = await request.json().catch(() => ({}));
  if (typeof tenantId !== "string" || typeof tarjetaId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const auth = await requireTenantAccess(request, { tenantId, permission: "sales.create" });
  if (!auth.ok) return auth.response;
  if (auth.isDemo || !obtenerConfigGoogleWallet()) {
    return NextResponse.json({ resultado: "sin-configurar" });
  }

  const limite = await consumirRateLimit(`wallet-sync:${auth.userId}`, 240, 3600);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Demasiadas actualizaciones seguidas" },
      { status: 429, headers: cabecerasRateLimit(limite) },
    );
  }

  // Service role sin RLS: el filtro por tenant impide tocar la tarjeta de otro negocio.
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("tarjetas_lealtad")
    .select(
      "codigo, sellos, premios_canjeados, programa:programas_lealtad(sellos_meta, premio_descripcion), tenant:tenants(nombre_comercial)",
    )
    .eq("id", tarjetaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const fila = data as {
    codigo: string;
    sellos: number;
    premios_canjeados: number;
    programa: { sellos_meta: number; premio_descripcion: string } | null;
    tenant: { nombre_comercial: string } | null;
  } | null;
  if (!fila || !fila.programa || !fila.tenant) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  const listo = fila.sellos >= fila.programa.sellos_meta;
  const resultado = await actualizarPaseGoogleWallet({
    codigo: fila.codigo,
    sellos: fila.sellos,
    sellosMeta: fila.programa.sellos_meta,
    premio: fila.programa.premio_descripcion,
    premiosCanjeados: fila.premios_canjeados,
    aviso: {
      titulo: fila.tenant.nombre_comercial,
      texto: listo
        ? `¡Completaste tu tarjeta! Ya puedes canjear: ${fila.programa.premio_descripcion}`
        : `Llevas ${fila.sellos} de ${fila.programa.sellos_meta} sellos.`,
    },
  });

  return NextResponse.json({ resultado });
}
