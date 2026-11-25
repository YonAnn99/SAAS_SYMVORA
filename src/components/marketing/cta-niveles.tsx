"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { formatMXN } from "@/lib/money";
import {
  FUNCIONES_POR_NIVEL,
  NIVELES_ORDEN,
  precioMensualEquivalenteMXN,
  precioNivelMXN,
  type Nivel,
} from "@/lib/niveles";
import type { BillingPeriod } from "@/lib/pricing";
import { CAPSULA, CAPSULA_GRANDE, FLECHA_CAPSULA, PRINCIPAL } from "./boton-capsula";

/** El nivel que se destaca. */
const NIVEL_POPULAR: Nivel = "pro";

/**
 * Precios con tres niveles (Basico / Pro / Premium, migracion 140). Solo se pinta con
 * `NEXT_PUBLIC_NIVELES_ACTIVOS=1` (ver `CTA` en `cta.tsx`); sin el, la landing vende el plan unico.
 *
 * Los numeros salen de `lib/niveles.ts`, la misma tabla que cobra Conekta: la landing no puede anunciar
 * un precio distinto del que se cobra. Sin cifras de «ahorro» inventadas: cada tarjeta dice lo que
 * incluye. Las promociones de lanzamiento del plan unico NO aplican a los niveles (decision pendiente).
 */
export function CtaNiveles() {
  const t = useTranslations();
  const [periodo, setPeriodo] = useState<BillingPeriod>("monthly");
  const anual = periodo === "yearly";

  return (
    <section id="pricing" className="relative w-full overflow-hidden py-12 sm:py-24">
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-black dark:text-neutral-50 sm:text-4xl lg:text-5xl">
          {t("landing.cta.title")}
        </h2>
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
          {t("landing.cta.subtitle")}
        </p>

        <div
          role="radiogroup"
          aria-label={t("billing.page.period")}
          className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800"
        >
          {(["monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={periodo === p}
              onClick={() => setPeriodo(p)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                periodo === p
                  ? "bg-primary text-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              }`}
            >
              {t(p === "monthly" ? "landing.cta.monthly" : "landing.cta.yearly")}
            </button>
          ))}
        </div>

        <div className="grid w-full gap-4 text-left md:grid-cols-3">
          {NIVELES_ORDEN.map((n) => {
            const f = FUNCIONES_POR_NIVEL[n];
            const popular = n === NIVEL_POPULAR;
            return (
              <div
                key={n}
                className={`relative flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm dark:bg-neutral-900 ${
                  popular ? "border-primary ring-1 ring-primary" : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white dark:text-neutral-900">
                    {t("planes.selector.popular")}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {t(`planes.names.${n}`)}
                </h3>
                <div>
                  <span className="text-4xl font-bold text-black dark:text-neutral-50">
                    {formatMXN(precioMensualEquivalenteMXN(n, periodo))}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t("planes.selector.perMonth")}
                  </span>
                  {anual && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {t("planes.selector.billedYearly", { total: formatMXN(precioNivelMXN(n, "yearly")) })}
                    </p>
                  )}
                </div>
                <ul className="flex-1 space-y-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                  {[
                    f.sucursalesMax === null
                      ? t("planes.selector.branchesUnlimited")
                      : t("planes.selector.branches", { n: f.sucursalesMax }),
                    t("planes.selector.unlimited"),
                    t("landing.cta.features.pos"),
                    t("landing.cta.features.inventory"),
                    t("landing.cta.features.reports"),
                    ...(f.lealtad ? [t("planes.selector.loyalty")] : []),
                    ...(f.catalogo ? [t("planes.selector.catalog")] : []),
                  ].map((texto) => (
                    <li key={texto} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {texto}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`${CAPSULA} ${CAPSULA_GRANDE} ${popular ? PRINCIPAL : ""} w-full justify-center`}
                >
                  {t("landing.cta.primary")}
                  <ArrowRight className={`h-5 w-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>

        <span className="text-xs text-neutral-400 dark:text-neutral-500">{t("landing.cta.trialNote")}</span>
      </div>
    </section>
  );
}
