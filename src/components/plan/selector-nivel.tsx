"use client";

import { useTranslations } from "next-intl";
import {
  formatPrecioNivel,
  NIVELES_ORDEN,
  precioMensualEquivalenteMXN,
  precioNivelMXN,
  nivelQueCabe,
  precioPromoNivelMXN,
  promoAplicaANivel,
  type Nivel,
} from "@/lib/niveles";
import type { BillingPeriod } from "@/lib/pricing";

/** Nivel que se destaca como «Más popular» (el que se quiere vender). */
const NIVEL_POPULAR: Nivel = "pro";

/**
 * Elegir Básico, Pro o Premium al contratar (`/billing`). Solo se pinta con los niveles encendidos
 * (`nivelesActivos`) y para quien aun no paga.
 *
 * Compacto a proposito (decision del dueño): solo nombre, precio y las etiquetas «Más popular» y «−50 %»; el
 * detalle de cada plan vive en la landing. El −50 % se muestra solo en Pro y Premium mensual (`promoAplicaANivel`).
 */
export function SelectorNivel({
  nivel,
  periodo,
  onChange,
  disabled,
  sinPromo = false,
  sucursalesActivas,
}: {
  nivel: Nivel;
  periodo: BillingPeriod;
  onChange: (n: Nivel) => void;
  disabled?: boolean;
  /** Al CAMBIAR de plan no hay promocion (es solo para suscripciones nuevas): precio de lista. */
  sinPromo?: boolean;
  /** Sucursales activas hoy: los planes a los que no les caben llevan la etiqueta «No alcanza». */
  sucursalesActivas?: number;
}) {
  const t = useTranslations("planes");
  return (
    <div role="radiogroup" aria-label={t("selector.title")} className="grid gap-2 sm:grid-cols-3">
      {NIVELES_ORDEN.map((n) => {
        const activo = n === nivel;
        const conPromo = !sinPromo && promoAplicaANivel(n, periodo);
        const mensual = conPromo ? precioPromoNivelMXN(n) : precioMensualEquivalenteMXN(n, periodo);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
              activo ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
            }`}
          >
            {n === NIVEL_POPULAR && (
              <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {t("selector.popular")}
              </span>
            )}
            <span className="text-sm font-semibold">{t(`names.${n}`)}</span>
            {sucursalesActivas !== undefined && !nivelQueCabe(n, sucursalesActivas) && (
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                {t("fit.tag", { n: sucursalesActivas })}
              </span>
            )}
            {conPromo && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s>{formatPrecioNivel(precioNivelMXN(n, "monthly"))}</s>
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t("selector.promoBadge")}
                </span>
              </span>
            )}
            <span className="text-lg font-bold leading-none">
              {formatPrecioNivel(mensual)}
              <span className="text-xs font-normal text-muted-foreground">{t("selector.perMonth")}</span>
            </span>
            {periodo === "yearly" && (
              <span className="text-[11px] text-muted-foreground">
                {t("selector.billedYearly", { total: formatPrecioNivel(precioNivelMXN(n, "yearly")) })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
