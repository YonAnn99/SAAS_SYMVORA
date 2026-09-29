import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * Ruta histórica. "Métodos de pago" dejó de ser un módulo del menú: su
 * contenido (Mercado Pago Point) es ahora la pestaña de Configuración, en
 * `MercadoPagoPointSettings`.
 *
 * Se conserva como redirect en vez de borrarla para que los enlaces guardados
 * sigan funcionando, igual que /variants, /lots y /inventory-adjustments.
 */
export default async function PaymentsLegacyPage() {
  const locale = await getLocale();
  redirect({ href: "/settings?tab=payments", locale });
}
