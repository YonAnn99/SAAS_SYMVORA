"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { formatMXN } from "@/lib/money";
import {
  FUNCIONES_POR_NIVEL,
  NIVELES_ORDEN,
  precioMensualEquivalenteMXN,
  precioNivelMXN,
  type Nivel,
} from "@/lib/niveles";
import type { BillingPeriod } from "@/lib/pricing";

/** Nivel que se destaca como «Más popular» (el que se quiere vender). */
const NIVEL_POPULAR: Nivel = "pro";

/**
 * Elegir Básico, Pro o Premium al contratar (`/billing`). Solo se pinta con los niveles encendidos
 * (`nivelesActivos`) y para quien aun no paga.
 *
 * Honesto a proposito: cada tarjeta dice lo que SI incluye y el precio real; no inventa un «ahorro».
 */
export function SelectorNivel({
  nivel,
  periodo,
  onChange,
  disabled,
}: {
  nivel: Nivel;
  periodo: BillingPeriod;
  onChange: (n: Nivel) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("planes");
  return (
    <div role="radiogroup" aria-label={t("selector.title")} className="grid gap-2 sm:grid-cols-3">
      {NIVELES_ORDEN.map((n) => {
        const f = FUNCIONES_POR_NIVEL[n];
        const activo = n === nivel;
        const mensual = precioMensualEquivalenteMXN(n, periodo);
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
            <span className="text-lg font-bold leading-none">
              {formatMXN(mensual)}
              <span className="text-xs font-normal text-muted-foreground">{t("selector.perMonth")}</span>
            </span>
            {periodo === "yearly" && (
              <span className="text-[11px] text-muted-foreground">
                {t("selector.billedYearly", { total: formatMXN(precioNivelMXN(n, "yearly")) })}
              </span>
            )}
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                {f.sucursalesMax === null
                  ? t("selector.branchesUnlimited")
                  : t("selector.branches", { n: f.sucursalesMax })}
              </li>
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                {t("selector.unlimited")}
              </li>
              {f.lealtad && (
                <li className="flex gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t("selector.loyalty")}
                </li>
              )}
              {f.catalogo && (
                <li className="flex gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t("selector.catalog")}
                </li>
              )}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
