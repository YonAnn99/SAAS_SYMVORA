import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { consumirRateLimit, obtenerIpCliente } from "@/lib/rate-limit";
import { codigoDesdeEscaneo } from "./lealtad";
import type { TarjetaPublica } from "./types";

/**
 * Datos de la tarjeta publica (`tarjeta_publica`, migracion 115) para la
 * pagina /tarjeta/<codigo> y su manifest.
 *
 * Cliente ANONIMO a proposito, sin cookies: la pagina la abre el cliente final
 * sin cuenta, y la funcion solo devuelve lo que se pinta en la tarjeta.
 *
 * `null` si el codigo no es valido, no existe o se paso del limite de
 * consultas (60 por minuto por IP): para quien prueba codigos al azar, las
 * tres cosas se ven igual.
 *
 * Con `cache` de React: la pagina y su `generateMetadata` la piden en la misma
 * peticion y se consulta (y se cuenta en el limite) UNA vez.
 */
export const obtenerTarjetaPublica = cache(async function obtenerTarjetaPublica(
  codigoCrudo: string
): Promise<TarjetaPublica | null> {
  const codigo = codigoDesdeEscaneo(codigoCrudo);
  if (!codigo) return null;

  const cabeceras = await headers();
  const ip = obtenerIpCliente(new Request("http://tarjeta.local", { headers: cabeceras }));
  const limite = await consumirRateLimit(`tarjeta-publica:${ip}`, 60, 60);
  if (!limite.permitido) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase.rpc("tarjeta_publica", { p_codigo: codigo });
  if (error) {
    console.error("[tarjeta-publica] fallo el RPC:", error.message);
    return null;
  }
  return (data as TarjetaPublica | null) ?? null;
});
