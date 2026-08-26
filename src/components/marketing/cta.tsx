"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Check, Rocket } from "lucide-react";
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
  "cfdi",
  "reports",
  "users",
  "support",
] as const;

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5215512345678";
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
  const price = isYearly ? t("landing.cta.priceYearly") : t("landing.cta.priceMonthly");
  const period = isYearly ? t("landing.cta.periodYearly") : t("landing.cta.periodMonthly");

  return (
    <motion.section
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
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center gap-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 lg:p-20 rounded-2xl shadow-xl"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={scaleIn}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <motion.div
          className="w-16 h-16 bg-primary/10 dark:bg-primary/10 rounded-2xl flex items-center justify-center mb-4 transform -rotate-6 shadow-sm border border-primary/10 dark:border-primary/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ delay: 0.3, ...springIcon }}
          whileHover={{ rotate: 0, scale: 1.1 }}
        >
          <Rocket className="w-8 h-8 text-primary" aria-hidden="true" />
        </motion.div>
        <motion.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-neutral-50"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.2 }}
        >
          {t("landing.cta.title")}
        </motion.h2>
        <motion.p
          className="text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mb-2 leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.3 }}
        >
          {t("landing.cta.subtitle")}
        </motion.p>

        <motion.div
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
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !isYearly ? "text-white dark:text-neutral-900" : "text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            {!isYearly && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 bg-primary dark:bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative">{t("landing.cta.monthly")}</span>
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
            {isYearly && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 bg-primary dark:bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative">{t("landing.cta.yearly")}</span>
            <span
              className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isYearly ? "bg-emerald-400 text-black" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {t("landing.cta.saveBadge")}
            </span>
          </button>
        </motion.div>

        <motion.div
          key={billing}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOutShort}
          className="flex items-baseline gap-2 mt-2"
        >
          <span className="text-5xl font-bold text-black dark:text-neutral-50">{price}</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 max-w-[200px] text-left">{period}</span>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mt-4 text-left"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {featureKeys.map((key) => (
            <motion.div
              key={key}
              className="flex items-center gap-2"
              variants={fadeInUp}
              transition={easeOutLong}
            >
              <motion.span
                className="w-4 h-4 text-primary shrink-0 inline-block"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
                aria-hidden="true"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.span>
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {t(`landing.cta.features.${key}`)}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.5 }}
        >
          {/* Primary CTA - Button-in-button magnetic */}
          <motion.div
            className="w-full sm:w-auto"
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.4)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/signup"
              className="relative group btn-magnetic inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-4 rounded-full hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:translate-y-px w-full sm:w-auto whitespace-nowrap text-center block"
            >
              {t("landing.cta.primary")}
              <span className="icon-wrapper" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
          </motion.div>

          <motion.a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white dark:bg-transparent text-black dark:text-neutral-100 font-medium px-8 py-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all active:translate-y-px w-full sm:w-auto whitespace-nowrap text-center"
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.864-5.502-1.86-1.77-.466-3.6-.935-5.449-1.436-1.101-.286-2.5-.602-3.704-1.107-3.533-1.501-4.346-1.843-5.302-1.843-.957 0-1.801.339-2.566.995-.765.66-1.294 1.527-1.601 2.567-.307 1.042-.562 2.247-.694 3.313-.133 1.067-.345 2.267-.418 3.394-.073 1.127-.144 2.334-.125 3.518.02 1.185.16 2.333.385 3.435.224 1.102.48 2.292.726 3.487.244 1.187.518 2.363.81 3.529a34.986 34.986 0 01-1.239 4.345 32.72 32.72 0 01-2.86 5.172c-1.126 1.294-2.506 2.803-4.01 4.343-1.514 1.545-3.126 3.148-4.74 4.79-1.614 1.639-3.278 3.318-4.86 4.937-1.582 1.618-3.108 3.208-4.572 4.747a1 1 0 000 1.298c1.464 1.54 2.984 3.113 4.57 4.67 1.585 1.557 3.255 3.158 4.91 4.778a1 1 0 001.298 0c.494-.507.964-1.005 1.41-1.523.447-.517.874-1.054 1.278-1.607a22.617 22.617 0 002.512-5.38c.829-1.594 1.487-3.257 1.868-4.877.346-1.48.518-2.946.445-4.344-.072-1.4-.371-2.771-1.008-4.046-.635-1.275-1.51-2.546-2.617-3.668-.816-.829-1.695-1.6-2.526-2.303-.832-.705-1.628-1.389-2.37-2.016-.74-.626-1.437-1.227-2.074-1.806-.638-.579-1.246-1.135-1.82-1.668-.575-.535-1.11-1.047-1.614-1.541-.503-.494-.975-.975-1.414-1.354-.438-.378-.846-.735-1.224-1.069-.38-.333-.729-.65-.1-.955z" />
            </svg>
            {t("landing.cta.secondary")}
          </motion.a>
        </motion.div>
        <motion.span
          className="text-xs text-neutral-500 dark:text-neutral-400 mt-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.6 }}
        >
          {t("landing.cta.trialNote")}
        </motion.span>
      </motion.div>
    </motion.section>
  );
}