"use client";

import { useTranslations } from "next-intl";
import { promoAplica } from "@/features/payments/promocion";

/**
 * La etiqueta «−50%» de la promocion de lanzamiento junto a «Precios» en el
 * encabezado (escritorio) y en el menu del celular. Es la MISMA pastilla roja
 * del selector Mensual/Anual de la seccion de precios (`cta.tsx`) y sale con la
 * MISMA condicion (`promoAplica("monthly")`): al apagar la promocion
 * (`PROMO_LANZAMIENTO.activa`) desaparecen las dos.
 *
 * Reemplaza al sello giratorio «−50% OFF» que flotaba sobre la landing.
 */

/** Texto de la etiqueta («−50%»), o `undefined` si la promocion no esta activa. */
export function useTextoPromo(): string | undefined {
  const t = useTranslations("landing");
  return promoAplica("monthly") ? t("cta.promoBadge") : undefined;
}

export function EtiquetaPromo({ className = "" }: { className?: string }) {
  const texto = useTextoPromo();
  if (!texto) return null;

  return (
    <span
      className={`rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className}`}
    >
      {texto}
    </span>
  );
}
