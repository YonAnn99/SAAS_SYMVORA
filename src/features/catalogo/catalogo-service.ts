import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CatalogoConfig } from "./types";

/**
 * Configuración del catálogo en línea (tabla `catalogos_en_linea`, migración
 * 124). Se escribe directo con el cliente de Supabase: la RLS exige
 * `org.manage_settings` (SUPER_ADMIN y ORG_ADMIN).
 */

const COLUMNAS = "tenant_id, activo, slug, whatsapp, mostrar_precios, mostrar_agotados, mensaje";

export async function obtenerConfigCatalogo(tenantId: string): Promise<CatalogoConfig | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("catalogos_en_linea")
    .select(COLUMNAS)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as CatalogoConfig | null) ?? null;
}

export async function guardarConfigCatalogo(config: CatalogoConfig): Promise<CatalogoConfig> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("catalogos_en_linea")
    .upsert(config, { onConflict: "tenant_id" })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return data as CatalogoConfig;
}

/** Mensaje para el usuario según el error de la base. */
export function mensajeErrorCatalogo(error: unknown): string {
  const e = error as { code?: string; message?: string; hint?: string } | null;
  if (e?.code === "23505") return "Ese enlace ya lo usa otro negocio. Prueba con otro.";
  if (e?.hint === "CUENTA_SOLO_LECTURA") return e.message ?? "Tu cuenta está en solo lectura.";
  if (e?.code === "42501") return "No tienes permiso para cambiar el catálogo.";
  if (e?.code === "23514") return "Revisa el enlace y el WhatsApp: hay un dato que no es válido.";
  return "No se pudo guardar el catálogo. Intenta de nuevo.";
}
