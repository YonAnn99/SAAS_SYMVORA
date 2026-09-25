"use client";

import { SALES_WHATSAPP } from "@/lib/contact";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { PRECIO_PROMO_MXN, precioListaMXN, promoAplica } from "@/features/payments/promocion";
import { PROMO_LANZAMIENTO } from "@/lib/pricing";
import { SinLimites } from "./sin-limites";
import { WhatsAppLogo } from "./whatsapp-logo";
import { CAPSULA, CAPSULA_GRANDE, FLECHA_CAPSULA, PRINCIPAL, WHATSAPP_CONTORNO } from "./boton-capsula";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  scaleIn,
  springIcon,
} from "./animations";

const featureKeys = [
  "pos",
  "inventory",
  "reports",
  "users",
  "support",
  "catalogImport",
] as const;

const WHATSAPP_NUMBER = SALES_WHATSAPP;
const WHATSAPP_MESSAGE =
  "Hola, me interesa SYMVORA para mi negocio. ¿Pueden darme más información?";

function buildWhatsAppUrl() {
  const text = encodeURIComponent(WHATSAPP_MESSAGE);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

export function CTA() {
  const t = useTranslations();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const isYearly = billing === "yearly";
  const period = isYearly ? t("landing.cta.periodYearly") : t("landing.cta.periodMonthly");

  // La promocion solo toca el mensual. El precio sale de la constante y no de
  // una cadena de i18n para que no pueda desincronizarse de lo que cobra
  // Conekta: ese desajuste ya costo dos cambios de precio silenciosos.
  // Dos usos distintos: `hayPromo` decide el PRECIO que se muestra (depende de
  // la pestana elegida), y `hayPromoMensual` decide la pildora del boton
  // "Mensual", que tiene que verse tambien desde la pestana Anual — igual que
  // el "Ahorra 25%" del boton Anual se ve desde Mensual. Si dependiera de la
  // pestana activa, quien abriera Anual no sabria que el mensual esta a mitad
  // de precio.
  const hayPromo = promoAplica(billing);
  const hayPromoMensual = promoAplica("monthly");
  const precioLista = `$${precioListaMXN("monthly")}`;
  const price = hayPromo
    ? `$${PRECIO_PROMO_MXN}`
    : isYearly
      ? t("landing.cta.priceYearly")
      : t("landing.cta.priceMonthly");

  return (
    <m.section
      id="pricing"
      className="w-full relative py-24 overflow-hidden"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, black 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-0 dark:opacity-[0.04] z-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />
      <m.div
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center gap-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 lg:p-20 rounded-2xl shadow-xl"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={scaleIn}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <m.div
          className="w-16 h-16 bg-primary/10 dark:bg-primary/10 rounded-2xl flex items-center justify-center mb-4 transform -rotate-6 shadow-sm border border-primary/10 dark:border-primary/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ delay: 0.3, ...springIcon }}
          whileHover={{ rotate: 0, scale: 1.1 }}
        >
          <Rocket className="w-8 h-8 text-primary" aria-hidden="true" />
        </m.div>
        <m.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-neutral-50"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.2 }}
        >
          {t("landing.cta.title")}
        </m.h2>
        <m.p
          className="text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mb-2 leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.3 }}
        >
          {t("landing.cta.subtitle")}
        </m.p>

        <m.div
          role="radiogroup"
          aria-label="Periodo de facturación"
          className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-full p-1 border border-neutral-200 dark:border-neutral-700"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.35 }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isYearly}
            onClick={() => setBilling("monthly")}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              !isYearly ? "text-white dark:text-neutral-900" : "text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            {/* Pildora del activo con CSS (antes `layoutId` de motion, que
                obligaba a cargar las animaciones de layout en toda la landing). */}
            <span
              aria-hidden="true"
              className={`absolute inset-0 bg-primary dark:bg-primary rounded-full transition-all duration-300 ${
                !isYearly ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            />
            <span className="relative">{t("landing.cta.monthly")}</span>
            {hayPromoMensual && (
              <span
                className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  !isYearly
                    ? "bg-red-500 text-white"
                    : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                }`}
              >
                {t("landing.cta.promoBadge")}
              </span>
            )}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isYearly}
            onClick={() => setBilling("yearly")}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              isYearly ? "text-white dark:text-neutral-900" : "text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-0 bg-primary dark:bg-primary rounded-full transition-all duration-300 ${
                isYearly ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            />
            <span className="relative">{t("landing.cta.yearly")}</span>
            <span
              className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isYearly ? "bg-emerald-400 text-black" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {t("landing.cta.saveBadge")}
            </span>
          </button>
        </m.div>

        <m.div
          key={billing}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOutShort}
          className="flex items-baseline gap-2 mt-2"
        >
          {hayPromo && (
            <span className="text-2xl font-semibold text-neutral-400 line-through dark:text-neutral-500">
              {precioLista}
            </span>
          )}
          <span className="text-5xl font-bold text-black dark:text-neutral-50">{price}</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 max-w-[200px] text-left">{period}</span>
        </m.div>

        {/* Decir desde el principio cuando sube el precio. Un cliente que se
            entera por el cuarto recibo se da de baja, y con razon. */}
        {hayPromo && (
          <m.p
            key={`promo-${billing}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={easeOutShort}
            className="-mt-3 text-xs font-medium text-red-600 dark:text-red-400"
          >
            {t("landing.cta.promoNota", {
              meses: PROMO_LANZAMIENTO.cobros,
              normal: `$${precioListaMXN("monthly")}`,
            })}
          </m.p>
        )}

        {/* Destacado antes de la lista: lo que el precio NO limita. */}
        <div className="mt-2">
          <SinLimites alineacion="centro" retraso={0.2} />
        </div>

        <m.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mt-4 text-left"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {featureKeys.map((key) => (
            <m.div
              key={key}
              className="flex items-center gap-2"
              variants={fadeInUp}
              transition={easeOutLong}
            >
              <m.span
                className="w-4 h-4 text-primary shrink-0 inline-block"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
                aria-hidden="true"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </m.span>
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {t(`landing.cta.features.${key}`)}
              </span>
            </m.div>
          ))}
        </m.div>

        <m.div
          className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.5 }}
        >
          {/* CTA principal (`rounded-full`: la sombra del hover es del envoltorio). */}
          <m.div
            className="w-full sm:w-auto rounded-full"
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.4)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/signup"
              className={`${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL} w-full sm:w-auto`}
            >
              {t("landing.cta.primary")}
              <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
            </Link>
          </m.div>

          <m.a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CAPSULA} ${CAPSULA_GRANDE} ${WHATSAPP_CONTORNO} w-full sm:w-auto`}
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
          >
            <WhatsAppLogo size={20} className="shrink-0" aria-hidden="true" />
            {t("landing.cta.secondary")}
          </m.a>
        </m.div>
        <m.span
          className="text-xs text-neutral-500 dark:text-neutral-400 mt-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.6 }}
        >
          {t("landing.cta.trialNote")}
        </m.span>
      </m.div>
    </m.section>
  );
}