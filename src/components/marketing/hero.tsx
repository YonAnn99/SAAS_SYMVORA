"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Play } from "lucide-react";
import { cubicBezierPremium, springTransition, scrollRevealStagger } from "./animations";
import { PosMockup } from "./pos-mockup";

export function Hero() {
  const t = useTranslations();
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-32 pb-24 lg:pb-32 overflow-hidden flex flex-col lg:flex-row items-center gap-12 lg:gap-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left Column - Editorial Content (60%) */}
      <motion.div
        className="w-full lg:w-3/5 flex flex-col gap-8 lg:gap-10 z-10"
        initial={{ opacity: 0, x: -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Eyebrow */}
        <motion.span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] bg-primary/10 text-primary dark:bg-primary/20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("landing.hero.eyebrow")}
        </motion.span>

        {/* Headline */}
        <motion.h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-black dark:text-neutral-50 max-w-3xl leading-[1.05] tracking-tighter"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("landing.hero.title")}{" "}
          <span className="relative text-primary whitespace-nowrap">
            {t("landing.hero.highlight")}
            <svg
              className="absolute -bottom-1.5 left-0 w-full h-3 text-primary/30"
              preserveAspectRatio="none"
              viewBox="0 0 100 10"
              aria-hidden="true"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg sm:text-xl text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("landing.hero.subtitle")}
        </motion.p>

        {/* Trial notice box */}
        <motion.div
          className="bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-2xl p-4 md:p-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-primary dark:text-primary">
                {t("landing.hero.trialTitle")}
              </p>
              <p className="text-sm text-primary/80 dark:text-primary/70 mt-1">
                {t("landing.hero.trialDesc")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row gap-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Primary CTA - Button-in-button */}
          <motion.div
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/signup"
              className="relative group btn-magnetic inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-4 rounded-full hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:translate-y-px flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:ring-offset-[#0A0A0A]"
            >
              {t("landing.hero.ctaPrimary")}
              <span className="icon-wrapper" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
          </motion.div>

          {/* Secondary CTA - Ghost with pulse */}
          <motion.div
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="relative"
          >
            <span
              className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-25"
              aria-hidden="true"
            />
            <Link
              href={`/${locale}/demo`}
              className="relative bg-white dark:bg-neutral-900 text-black dark:text-neutral-50 font-medium px-8 py-4 rounded-full border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all active:translate-y-px flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:ring-offset-[#0C0C0C]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 01-1.497.89l-3.197-2.132A1 1 0 004 10.073V13.93a1 1 0 001.497.89l3.197 2.132A1 1 0 0011 14.12V18a1 1 0 001 1h2a1 1 0 001-1v-4.263a1 1 0 011.497-.89l3.197-2.132A1 1 0 0020 10.073V6.927a1 1 0 00-1.497-.89l-3.197 2.132A1 1 0 0012 6.927z" />
              </svg>
              {t("landing.hero.ctaSecondary")}
            </Link>
          </motion.div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          className="flex items-center gap-6 pt-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.7, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t("landing.hero.trustedBy")}
          </span>
          <div className="flex items-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
            <svg className="h-5 w-auto" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            <svg className="h-5 w-auto" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            <svg className="h-5 w-auto" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          </div>
        </motion.div>
      </motion.div>

      {/* Right Column - POS Mockup (40%) */}
      <motion.div
        className="w-full lg:w-2/5 relative min-h-[360px] sm:min-h-[420px] lg:min-h-[500px] mt-8 lg:mt-0 flex items-center justify-center"
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Ambient glow orbs */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-primary/10 dark:from-primary/5 via-transparent to-transparent rounded-full blur-3xl opacity-60 z-0 scale-90"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
          aria-hidden="true"
        />
        <motion.div
          className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl opacity-50"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
          aria-hidden="true"
        />
        <motion.div
          className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl opacity-50"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
          aria-hidden="true"
        />

        {/* POS Mockup - Sticky Stack Target */}
        <motion.div
          className="relative w-full max-w-[560px] aspect-[4/3] z-10"
          initial={{ rotateY: 15, rotateX: -5, scale: 0.95 }}
          animate={{ rotateY: 0, rotateX: 0, scale: 1 }}
          whileHover={{ rotateY: 0, rotateX: 0, scale: 1.01 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "center center" }}
        >
          <PosMockup />
          
          {/* Floating stat badge */}
          <motion.div
            className="absolute left-2 right-auto sm:-left-6 bottom-4 sm:bottom-10 bg-white dark:bg-neutral-900 p-3 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 max-w-[calc(100%-1rem)]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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

      {/* Radial gradient orbs - background decoration */}
      <motion.div
        className="hero-orb w-96 h-96 top-1/4 -right-20 bg-primary/10 dark:bg-primary/5"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
        aria-hidden="true"
      />
      <motion.div
        className="hero-orb w-72 h-72 bottom-1/4 -left-20 bg-primary/5 dark:bg-primary/10"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
        aria-hidden="true"
      />
    </motion.section>
  );
}