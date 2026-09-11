import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * Ruta histórica. Variantes, Lotes y Ajustes se movieron a /products el
 * 2026-09-11 — son información de productos, no de configuración (antes
 * vivían en /settings, y antes de eso como sección propia del sidebar).
 *
 * Se conserva como redirect en vez de borrarla para que los enlaces guardados
 * sigan funcionando, y para que exista UNA sola interfaz que mantener.
 */
export default async function VariantsLegacyPage() {
  const locale = await getLocale();
  redirect({ href: "/products?tab=variants", locale });
}
