import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { consumirRateLimit, obtenerIpCliente } from "@/lib/rate-limit";
import { codigoAltaValido } from "./lealtad";
import type { ProgramaAltaPublica } from "./types";

/**
 * Datos del programa para la pagina del cartel (/tarjeta/unirse/<codigo>,
 * migracion 121): lo que se pinta antes de que el cliente se registre.
 *
 * Mismo esquema que `obtenerTarjetaPublica`: cliente ANONIMO sin cookies,
 * rate limit de 60 por minuto por IP y `null` para codigo invalido, programa
 * apagado o limite superado (para quien prueba codigos se ven igual). Con
 * `cache` de React: la pagina y su `generateMetadata` consultan UNA vez.
 */
export const obtenerProgramaAlta = cache(async function obtenerProgramaAlta(
  codigoCrudo: string
): Promise<ProgramaAltaPublica | null> {
  const codigo = codigoAltaValido(codigoCrudo);
  if (!codigo) return null;

  const cabeceras = await headers();
  const ip = obtenerIpCliente(new Request("http://alta.local", { headers: cabeceras }));
  const limite = await consumirRateLimit(`programa-alta:${ip}`, 60, 60);
  if (!limite.permitido) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase.rpc("programa_alta_publica", { p_codigo_alta: codigo });
  if (error) {
    console.error("[programa-alta] fallo el RPC:", error.message);
    return null;
  }
  return (data as ProgramaAltaPublica | null) ?? null;
});
