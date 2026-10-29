import type { MetadataRoute } from "next";
import { GIROS, rutaGiro } from "@/features/marketing/giros";
import { GUIAS, rutaGuia } from "@/features/marketing/aprende";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

const BASE_URL = "https://www.symvora.com.mx";

// Los catálogos en línea se encienden y apagan cualquier día: se regenera a
// diario en lugar de quedar fijo hasta el siguiente despliegue.
export const revalidate = 86400;

/**
 * Catálogos en línea activos (migración 124), sin negocios demo. Si la consulta
 * falla, el sitemap sale sin ellos: nunca se rompe por esto.
 */
async function catalogosActivos(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await createSupabaseServiceRoleClient()
      .from("catalogos_en_linea")
      .select("slug, actualizado_en, tenants!inner(demo_expira_en)")
      .eq("activo", true)
      .is("tenants.demo_expira_en", null);
    if (error || !data) return [];
    return data.map((c) => ({
      url: `${BASE_URL}/es/catalogo/${c.slug}`,
      lastModified: new Date(c.actualizado_en),
      changeFrequency: "daily" as const,
      priority: 0.4,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languageAlternates = {
    es: `${BASE_URL}/es`,
    en: `${BASE_URL}/en`,
    "x-default": `${BASE_URL}/es`,
  };

  const lastModified = new Date();

  return [
    {
      url: `${BASE_URL}/es`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/en`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/terminos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/en/terminos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/aviso-privacidad`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/en/aviso-privacidad`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/politica-cookies`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/en/politica-cookies`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    // Una por giro, solo en español: son las que traen busquedas como
    // "punto de venta para papeleria".
    ...GIROS.map((giro) => ({
      url: `${BASE_URL}${rutaGiro(giro.slug)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Quienes somos: identidad, mision y valores. Solo en español.
    { url: `${BASE_URL}/es/nosotros`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 },
    // Guias de uso: el indice y una por modulo, solo en español.
    { url: `${BASE_URL}${rutaGuia()}`, lastModified, changeFrequency: "monthly" as const, priority: 0.6 },
    ...GUIAS.map((guia) => ({
      url: `${BASE_URL}${rutaGuia(guia.slug)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...(await catalogosActivos()),
  ];
}