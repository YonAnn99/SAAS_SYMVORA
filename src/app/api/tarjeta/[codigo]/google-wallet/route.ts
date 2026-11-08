import { NextResponse } from "next/server";
import { obtenerTarjetaPublica } from "@/features/lealtad/tarjeta-publica.server";
import { obtenerConfigGoogleWallet } from "@/features/lealtad/google-wallet/jwt";
import { generarEnlaceGoogleWallet } from "@/features/lealtad/google-wallet/pass-builder";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { getAppUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Enlace «Guardar en Google Wallet» de una tarjeta. Publica, como la tarjeta:
 * quien tiene el codigo ya ve la tarjeta. La lectura pasa por
 * `obtenerTarjetaPublica`, que lleva el rate limit por IP y no devuelve tarjetas
 * de demos ni de negocios en solo lectura.
 *
 * Con `?redirect=true` responde con 302 al enlace de Google.
 */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const config = obtenerConfigGoogleWallet();
  if (!config) {
    return NextResponse.json({ configurado: false }, { status: 503 });
  }

  const { codigo } = await params;
  const tarjeta = await obtenerTarjetaPublica(codigo);
  if (!tarjeta) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  // El id del programa (para el id estable de la clase) no esta en la lectura publica.
  const { data } = await createSupabaseServiceRoleClient()
    .from("tarjetas_lealtad")
    .select("programa_id")
    .eq("codigo", tarjeta.codigo)
    .maybeSingle();
  if (!data?.programa_id) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  const saveUrl = generarEnlaceGoogleWallet(tarjeta, data.programa_id as string, config, getAppUrl());

  if (new URL(request.url).searchParams.get("redirect") === "true") {
    return NextResponse.redirect(saveUrl, { status: 302 });
  }
  return NextResponse.json({ configurado: true, saveUrl });
}
