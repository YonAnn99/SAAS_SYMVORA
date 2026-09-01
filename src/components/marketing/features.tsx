"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import {
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  Upload,
  Smartphone,
  WifiOff,
} from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  springIcon,
} from "./animations";

export function Features() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="features"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col gap-12"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={easeOutLong}
    >
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-end gap-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={easeOutShort}
      >
        <div className="max-w-2xl">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            {t("landing.features.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 dark:text-neutral-400"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.features.subtitle")}
          </motion.p>
        </div>
        <motion.a
          href="#"
          className="text-primary text-sm font-medium flex items-center gap-1 hover:text-primary/80 transition-colors pb-1 border-b border-transparent hover:border-primary"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.2 }}
          whileHover={{ x: 4 }}
        >
          {t("landing.features.viewAll")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </motion.a>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 auto-rows-min"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >
        {/* Feature 1 - POS (Large - 8 cols) */}
        <motion.div
          className="lg:col-span-8 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 lg:p-8 flex flex-col gap-6 group hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-shadow relative overflow-hidden"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          {/* Ambient glow */}
          <motion.div
            className="absolute top-0 right-0 w-64 h-64 bg-primary/5 dark:bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 group-hover:scale-110 transition-transform duration-700"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
            aria-hidden="true"
          />
          {/* Icon */}
          <motion.div
            className="w-12 h-12 bg-primary/10 dark:bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-2 z-10"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...springIcon }}
          >
            <ShoppingCart className="w-6 h-6" aria-hidden="true" />
          </motion.div>
          {/* Content */}
          <motion.div
            className="z-10 max-w-md"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            <h3 className="text-xl font-bold text-black dark:text-neutral-50 mb-2">
              {t("landing.features.pos.title")}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              {t("landing.features.pos.description")}
            </p>
            <span className="text-xs font-medium text-primary bg-primary/10 dark:bg-primary/10 px-3 py-1 rounded-full">
              {t("landing.features.pos.stats")}
            </span>
          </motion.div>
          {/* Bar chart visual */}
          <motion.div
            className="mt-auto pt-6 border-t border-neutral-100 dark:border-neutral-800 flex items-end gap-2 h-32 w-full max-w-sm z-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...easeOutShort }}
          >
            {[30, 45, 25, 60, 80, 100].map((h, i) => (
              <motion.div
                key={i}
                className={`w-1/6 rounded-t-sm transition-colors ${
                  i === 5
                    ? "bg-primary group-hover:shadow-[0_0_15px_rgba(15,23,42,0.5)]"
                    : "bg-primary/10 dark:bg-primary/5 hover:bg-primary/20 dark:hover:bg-primary/10"
                }`}
                style={{ height: `${h}%` }}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.08 + 0.5, type: "spring", stiffness: 200, damping: 20 }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Feature 2 - Inventory (Small - 4 cols) */}
        <motion.div
          className="lg:col-span-4 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          <motion.div
            className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center mb-2"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...springIcon }}
          >
            <Package className="w-6 h-6" aria-hidden="true" />
          </motion.div>
          <motion.h3
            className="text-xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            {t("landing.features.inventory.title")}
          </motion.h3>
          <motion.p
            className="text-neutral-500 dark:text-neutral-400 flex-grow leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, ...easeOutShort }}
          >
            {t("landing.features.inventory.description")}
          </motion.p>
          <motion.span
            className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full self-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...easeOutShort }}
          >
            {t("landing.features.inventory.stats")}
          </motion.span>
          <motion.div
            className="mt-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ...easeOutShort }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-medium">
                {t("landing.features.inventory.stockAlert")}
              </span>
            </div>
            <span className="text-sm font-bold text-black dark:text-neutral-50">SKU-892</span>
          </motion.div>
        </motion.div>

        {/* Feature 3 - Purchases (Small - 4 cols) */}
        <motion.div
          className="lg:col-span-4 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow relative overflow-hidden group"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          <motion.div
            className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center mb-2"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...springIcon }}
          >
            <FileText className="w-6 h-6" aria-hidden="true" />
          </motion.div>
          <motion.h3
            className="text-xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            {t("landing.features.purchases.title")}
          </motion.h3>
          <motion.p
            className="text-neutral-500 dark:text-neutral-400 flex-grow leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, ...easeOutShort }}
          >
            {t("landing.features.purchases.description")}
          </motion.p>
          <motion.span
            className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full self-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...easeOutShort }}
          >
            {t("landing.features.purchases.stats")}
          </motion.span>
          <motion.svg
            className="absolute -right-4 -bottom-4 w-32 h-32 text-neutral-200 dark:text-neutral-800 group-hover:text-neutral-300 dark:group-hover:text-neutral-700 transition-colors"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            viewBox="0 0 100 100"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
            style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
            aria-hidden="true"
          >
            <circle cx="20" cy="80" r="4" />
            <circle cx="80" cy="20" r="4" />
            <circle cx="50" cy="50" r="6" />
            <path d="M22 78 L46 54 M54 46 L78 22" />
          </motion.svg>
        </motion.div>

        {/* Feature 4 - Catalog Import (Small - 4 cols) */}
        <motion.div
          className="lg:col-span-4 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          <motion.div
            className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 text-sky-600 rounded-lg flex items-center justify-center mb-2"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...springIcon }}
          >
            <Upload className="w-6 h-6" aria-hidden="true" />
          </motion.div>
          <motion.h3
            className="text-xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            {t("landing.features.catalogImport.title")}
          </motion.h3>
          <motion.p
            className="text-neutral-500 dark:text-neutral-400 flex-grow leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, ...easeOutShort }}
          >
            {t("landing.features.catalogImport.description")}
          </motion.p>
          <motion.span
            className="text-xs font-medium text-sky-600 bg-sky-50 dark:bg-sky-500/10 px-3 py-1 rounded-full self-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...easeOutShort }}
          >
            {t("landing.features.catalogImport.stats")}
          </motion.span>
          <motion.div
            className="mt-2 flex items-center gap-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ...easeOutShort }}
          >
            <span className="text-xs font-mono px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              CSV
            </span>
            <ArrowRight className="w-3 h-3 text-neutral-400" aria-hidden="true" />
            <span className="text-xs font-mono px-2 py-1 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-600">
              SYMVORA
            </span>
          </motion.div>
        </motion.div>

        {/* Feature 5 - PWA (Small - 4 cols) */}
        <motion.div
          className="lg:col-span-4 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          <motion.div
            className="w-12 h-12 bg-teal-50 dark:bg-teal-500/10 text-teal-600 rounded-lg flex items-center justify-center mb-2"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...springIcon }}
          >
            <Smartphone className="w-6 h-6" aria-hidden="true" />
          </motion.div>
          <motion.h3
            className="text-xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            {t("landing.features.pwa.title")}
          </motion.h3>
          <motion.p
            className="text-neutral-500 dark:text-neutral-400 flex-grow leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, ...easeOutShort }}
          >
            {t("landing.features.pwa.description")}
          </motion.p>
          <motion.span
            className="text-xs font-medium text-teal-600 bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-full self-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...easeOutShort }}
          >
            {t("landing.features.pwa.stats")}
          </motion.span>
          <motion.div
            className="mt-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ...easeOutShort }}
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-teal-500" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-medium">
                {t("landing.features.pwa.offlineLabel")}
              </span>
            </div>
            <span className="text-sm font-bold text-black dark:text-neutral-50">✓</span>
          </motion.div>
        </motion.div>

        {/* Feature 6 - Finances (Large - full width) */}
        <motion.div
          className="lg:col-span-12 double-bezel bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 lg:p-8 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow"
          variants={fadeInUp}
          transition={easeOutLong}
          whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
        >
          <motion.div
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...easeOutShort }}
          >
            <motion.div
              className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-lg flex items-center justify-center mb-6"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, ...springIcon }}
            >
              <BarChart3 className="w-6 h-6" aria-hidden="true" />
            </motion.div>
            <h3 className="text-xl font-bold text-black dark:text-neutral-50 mb-2">
              {t("landing.features.finances.title")}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              {t("landing.features.finances.description")}
            </p>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-3 py-1 rounded-full self-start mb-4">
              {t("landing.features.finances.stats")}
            </span>
            <motion.button
              className="mt-auto self-start text-sm font-medium text-black border border-black px-4 py-2 rounded hover:bg-black hover:text-white dark:text-neutral-50 dark:border-neutral-300 dark:hover:bg-neutral-50 dark:hover:text-black transition-colors"
              whileHover={{ backgroundColor: "black", color: "white", scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {t("landing.features.finances.viewDashboards")}
            </motion.button>
          </motion.div>
          <motion.div
            className="flex-1 flex items-center justify-center min-h-[200px] relative"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, ...easeOutShort }}
          >
            <div className="w-48 h-48 rounded-full border-[16px] border-neutral-100 dark:border-neutral-800 relative">
              <motion.div
                className="absolute inset-[-16px] rounded-full border-[16px] border-transparent border-t-primary border-r-primary rotate-45 transition-transform duration-1000 hover:scale-105 cursor-pointer"
                animate={{ rotate: 405 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
              />
              <motion.div
                className="absolute inset-[-16px] rounded-full border-[16px] border-transparent border-l-purple-500 rotate-[15deg] transition-transform duration-1000 hover:scale-105 cursor-pointer"
                animate={{ rotate: -345 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-black dark:text-neutral-50">
                  87<span className="text-lg">%</span>
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  {t("landing.features.finances.efficiency")}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}