"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Puzzle, FileText, Database, Search, Zap, Server } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainerSlow,
  fadeInUp,
} from "./animations";

export function WhyChooseUs() {
  const t = useTranslations();

  const benefits = [
    {
      key: "modular",
      number: "01",
      icon: Puzzle,
      titleKey: "landing.whyChooseUs.modular.title",
      descKey: "landing.whyChooseUs.modular.description",
      visual: "modular" as const,
    },
    {
      key: "cfdi",
      number: "02",
      icon: FileText,
      titleKey: "landing.whyChooseUs.cfdi.title",
      descKey: "landing.whyChooseUs.cfdi.description",
      tags: ["CFDI 4.0", "PAC Integrado"],
    },
    {
      key: "atomic",
      number: "03",
      icon: Database,
      titleKey: "landing.whyChooseUs.atomic.title",
      descKey: "landing.whyChooseUs.atomic.description",
      visual: "search" as const,
    },
    {
      key: "uptime",
      number: "04",
      icon: Server,
      titleKey: "landing.whyChooseUs.uptime.title",
      descKey: "landing.whyChooseUs.uptime.description",
      visual: "uptime" as const,
    },
  ];

  return (
    <motion.section
      className="w-full bg-[#1A1A1A] text-white py-24"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-12 lg:gap-32">
        <motion.div
          className="lg:w-1/3 flex flex-col gap-6 lg:sticky lg:top-32 self-start"
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={easeOutShort}
        >
          <motion.h2
            className="text-3xl sm:text-4xl font-bold leading-tight"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            {t("landing.whyChooseUs.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-400 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.whyChooseUs.subtitle")}
          </motion.p>
          <motion.div
            className="h-1 w-16 bg-blue-500 mt-4"
            initial={{ width: 0 }}
            animate={{ width: "4rem" }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          />
        </motion.div>

        <motion.div
          className="lg:w-2/3 flex flex-col gap-12"
          variants={staggerContainerSlow}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {benefits.map((benefit) => (
            <motion.div
              key={benefit.key}
              className={`flex flex-col sm:flex-row gap-4 items-start group ${
                benefit.key !== "modular" ? "pt-8 border-t border-neutral-800" : ""
              }`}
              variants={fadeInUp}
              transition={easeOutLong}
            >
              <motion.div
                className="text-sm font-bold text-blue-400 border border-blue-500/30 rounded px-2 py-1 bg-blue-500/10 shrink-0"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
              >
                {benefit.number}
              </motion.div>
              <motion.div
                className="flex flex-col gap-3 w-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, ...easeOutShort }}
              >
                <h4 className="text-xl font-bold">
                  {t(benefit.titleKey)}
                </h4>
                <p className="text-neutral-400 max-w-2xl leading-relaxed">
                  {t(benefit.descKey)}
                </p>

                {benefit.visual === "modular" && (
                  <motion.div
                    className="flex flex-wrap gap-2 mt-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, ...easeOutShort }}
                  >
                    {["POS", "Inventario", "CFDI", "Finanzas", "Reportes", "Usuarios"].map((mod) => (
                      <motion.div
                        key={mod}
                        className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-xs font-medium"
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.2)", scale: 1.02 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {mod}
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {benefit.tags && (
                  <motion.div
                    className="flex gap-4 mt-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, ...easeOutShort }}
                  >
                    {benefit.tags.map((tag) => (
                      <motion.div
                        key={tag}
                        className="flex items-center gap-2 bg-neutral-800 px-3 py-2 rounded border border-neutral-700"
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.1)", x: 4 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <FileText className="w-4 h-4 text-blue-400" aria-hidden="true" />
                        <span className="text-xs text-white font-medium">
                          {tag}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {benefit.visual === "search" && (
                  <motion.div
                    className="mt-4 flex flex-col gap-2 max-w-md w-full"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, ...easeOutShort }}
                  >
                    <div className="bg-neutral-800 rounded-lg p-2 border border-neutral-700 flex items-center gap-2 w-full shadow-inner">
                      <Search className="w-4 h-4 text-neutral-500 ml-2" aria-hidden="true" />
                      <span className="text-sm text-neutral-500">
                        {t("landing.whyChooseUs.searchPlaceholder")}
                      </span>
                      <Zap className="w-3.5 h-3.5 ml-auto text-amber-400" aria-hidden="true" />
                    </div>
                    <p className="text-xs text-neutral-500 italic">
                      {t("landing.whyChooseUs.searchHint")}
                    </p>
                  </motion.div>
                )}

                {benefit.visual === "uptime" && (
                  <motion.div
                    className="mt-4 flex flex-wrap gap-3"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, ...easeOutShort }}
                  >
                    <motion.div
                      className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2"
                      whileHover={{ scale: 1.02 }}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                      <span className="text-xs font-medium text-emerald-300">99.9% uptime</span>
                    </motion.div>
                    <motion.div
                      className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded px-3 py-2"
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                    >
                      <Server className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                      <span className="text-xs text-white font-medium">Edge global</span>
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
