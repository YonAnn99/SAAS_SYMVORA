"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Play } from "lucide-react";
import {
  easeOutShort,
  staggerContainer,
  fadeInUpSmall,
  fadeInUp,
} from "./animations";
import { PosMockup } from "./pos-mockup";

export function Hero() {
  const t = useTranslations();
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 pb-16 lg:pb-24 overflow-hidden flex flex-col lg:flex-row items-center gap-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div
        className="w-full lg:w-1/2 flex flex-col gap-6 z-10"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-neutral-50 max-w-2xl leading-[1.1]"
          variants={fadeInUp}
          transition={easeOutShort}
        >
          {t("landing.hero.title")}{" "}
            <span className="text-blue-600 relative sm:whitespace-nowrap">
            {t("landing.hero.highlight")}
            <svg
              className="absolute -bottom-2 left-0 w-full h-3 text-blue-200 dark:text-blue-900"
              preserveAspectRatio="none"
              viewBox="0 0 100 10"
              aria-hidden="true"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
          </span>
        </motion.h1>

        <motion.p
          className="text-lg text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed"
          variants={fadeInUpSmall}
          transition={easeOutShort}
        >
          {t("landing.hero.subtitle")}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-3 mt-2"
          variants={fadeInUpSmall}
          transition={easeOutShort}
        >
          <motion.div
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/signup"
              className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:translate-y-px flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:ring-offset-[#0C0C0C]"
            >
              {t("landing.hero.ctaPrimary")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Link>
          </motion.div>
          <motion.div
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="relative"
          >
            <span
              className="absolute inset-0 rounded-lg bg-neutral-400 animate-ping opacity-25"
              aria-hidden="true"
              style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
            />
            <Link
              href={`/${locale}/demo`}
              className="relative bg-white dark:bg-neutral-900 text-black dark:text-neutral-50 font-medium px-6 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all active:translate-y-px flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:ring-offset-[#0C0C0C]"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              {t("landing.hero.ctaSecondary")}
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className="w-full lg:w-1/2 relative min-h-[280px] sm:min-h-[360px] lg:min-h-[600px] mt-8 lg:mt-0 flex items-center justify-center"
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-blue-50 dark:from-blue-950 via-white dark:via-[#0C0C0C] to-purple-50 dark:to-purple-950 rounded-full blur-3xl opacity-60 z-0 scale-90"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
          aria-hidden="true"
        />
        <motion.div
          className="relative w-full max-w-[560px] aspect-[5/4] z-10"
          initial={{ rotateY: 15, rotateX: -5, scale: 0.95 }}
          animate={{ rotateY: 0, rotateX: 0, scale: 1 }}
          whileHover={{ rotateY: 0, rotateX: 0, scale: 1.01 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ transformOrigin: "center center" }}
        >
          <PosMockup />
          <motion.div
            className="absolute left-2 right-auto sm:-left-6 bottom-4 sm:bottom-10 bg-white dark:bg-neutral-900 p-3 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 max-w-[calc(100%-1rem)]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.9, duration: 0.5, ease: "easeOut" }}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-500 text-lg" aria-hidden="true">📈</span>
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                {t("landing.hero.growthLabel")}
              </span>
              <span className="text-lg font-bold text-black dark:text-neutral-50">+24.5%</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
