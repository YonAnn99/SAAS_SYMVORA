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
        className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, black 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center gap-6 bg-white border border-neutral-200 p-8 lg:p-20 rounded-2xl shadow-xl"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={scaleIn}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <motion.div
          className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 transform -rotate-6 shadow-sm border border-blue-100"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ delay: 0.3, ...springIcon }}
          whileHover={{ rotate: 0, scale: 1.1 }}
        >
          <Rocket className="w-8 h-8 text-blue-600" aria-hidden="true" />
        </motion.div>
        <motion.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.2 }}
        >
          {t("landing.cta.title")}
        </motion.h2>
        <motion.p
          className="text-lg text-neutral-500 max-w-2xl mb-2 leading-relaxed"
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
          className="inline-flex items-center bg-neutral-100 rounded-full p-1 border border-neutral-200"
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
              !isYearly ? "text-white" : "text-neutral-600 hover:text-black"
            }`}
          >
            {!isYearly && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 bg-black rounded-full"
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
              isYearly ? "text-white" : "text-neutral-600 hover:text-black"
            }`}
          >
            {isYearly && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 bg-black rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative">{t("landing.cta.yearly")}</span>
            <span
              className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isYearly ? "bg-emerald-400 text-black" : "bg-emerald-100 text-emerald-700"
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
          <span className="text-5xl font-bold text-black">{price}</span>
          <span className="text-sm text-neutral-500 max-w-[200px] text-left">{period}</span>
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
                className="w-4 h-4 text-blue-600 shrink-0 inline-block"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
                aria-hidden="true"
              >
                <Check className="w-4 h-4" />
              </motion.span>
              <span className="text-sm text-neutral-600">
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
          <motion.div
            className="w-full sm:w-auto"
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/signup"
              className="bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:translate-y-px w-full sm:w-auto whitespace-nowrap text-center block"
            >
              {t("landing.cta.primary")}
            </Link>
          </motion.div>
          <motion.a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-black font-medium px-8 py-4 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-all active:translate-y-px w-full sm:w-auto whitespace-nowrap text-center"
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
          >
            {t("landing.cta.secondary")}
          </motion.a>
        </motion.div>
        <motion.span
          className="text-xs text-neutral-500 mt-2"
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
