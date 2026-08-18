"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  easeOutLong,
  staggerContainerFast,
  fadeInUpSmall,
} from "./animations";

const logos = [
  { name: "ACME Corp", className: "font-bold tracking-tighter" },
  { name: "GlobalTech", className: "italic" },
  { name: "NEXUS", className: "uppercase tracking-widest" },
  { name: "Stark Ind.", className: "font-serif" },
  { name: "Osoba Dynamics", className: "font-light tracking-tight" },
];

export function TrustedBy() {
  const t = useTranslations();

  return (
    <motion.section
      className="w-full bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800 py-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        <motion.p
          className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-6 text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={fadeInUpSmall}
        >
          {t("landing.trustedBy.label")}
        </motion.p>
        <motion.div
          className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500"
          variants={staggerContainerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {logos.map((logo) => (
            <motion.span
              key={logo.name}
              className={`text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 ${logo.className}`}
              variants={fadeInUpSmall}
              transition={easeOutLong}
              whileHover={{ opacity: 1, scale: 1.05 }}
            >
              {logo.name}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
