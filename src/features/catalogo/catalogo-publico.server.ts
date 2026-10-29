import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { consumirRateLimit, obtenerIpCliente } from "@/lib/rate-limit";
import { slugValido } from "./slug";
import type { CatalogoEncabezado, CatalogoPagina } from "./types";

/**
 * Datos del catálogo público (migración 124) para /catalogo/<slug> y su ruta de
 * búsqueda. Cliente ANÓNIMO a propósito, sin cookies: lo abre el cliente final
 * sin cuenta, y las funciones solo devuelven lo que se pinta.
 *
 * Límite de 120 consultas por minuto por IP (página, búsqueda y "cargar más"
 * cuentan). Pasado el límite se responde como si no existiera.
 */

export const POR_PAGINA = 48;

function clienteAnonimo() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function permitirConsultaCatalogo(cabeceras: Headers): Promise<boolean> {
  const ip = obtenerIpCliente(new Request("http://catalogo.local", { headers: cabeceras }));
  const limite = await consumirRateLimit(`catalogo:${ip}`, 120, 60);
  return limite.permitido;
}

export async function consultarProductosCatalogo(
  slug: string,
  opciones: { busqueda?: string | null; categoria?: string | null; offset?: number } = {}
): Promise<CatalogoPagina | null> {
  if (!slugValido(slug)) return null;
  const { data, error } = await clienteAnonimo().rpc("catalogo_publico_productos", {
    p_slug: slug,
    p_busqueda: opciones.busqueda?.slice(0, 80) || null,
    p_categoria: opciones.categoria?.slice(0, 120) || null,
    p_offset: Math.max(0, Math.floor(opciones.offset ?? 0)),
    p_limite: POR_PAGINA,
  });
  if (error) {
    console.error("[catalogo-publico] fallo catalogo_publico_productos:", error.message);
    return null;
  }
  return (data as CatalogoPagina | null) ?? null;
}

/**
 * Encabezado y primera página, para la carga en el servidor (y su
 * `generateMetadata`). Con `cache` de React: se consulta y se cuenta en el
 * límite UNA vez por petición.
 */
export const obtenerCatalogoPublico = cache(async function obtenerCatalogoPublico(
  slugCrudo: string
): Promise<{ encabezado: CatalogoEncabezado; pagina: CatalogoPagina } | null> {
  const slug = decodeURIComponent(slugCrudo).trim().toLowerCase();
  if (!slugValido(slug)) return null;
  if (!(await permitirConsultaCatalogo(await headers()))) return null;

  const { data, error } = await clienteAnonimo().rpc("catalogo_publico", { p_slug: slug });
  if (error) {
    console.error("[catalogo-publico] fallo catalogo_publico:", error.message);
    return null;
  }
  if (!data) return null;
  const pagina = await consultarProductosCatalogo(slug);
  if (!pagina) return null;
  return { encabezado: data as CatalogoEncabezado, pagina };
});
