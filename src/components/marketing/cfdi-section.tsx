"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Stamp, BookOpen, Ban, CreditCard, ArrowRight } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  fadeInLeft,
  springIcon,
} from "./animations";

const features = [
  { key: "stamp", icon: Stamp },
  { key: "catalogs", icon: BookOpen },
  { key: "cancel", icon: Ban },
  { key: "payment", icon: CreditCard },
];

export function CFDISection() {
  const t = useTranslations();

  return (
    <motion.section
      className="w-full py-24 bg-white"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-16 items-center">
        <motion.div
          className="lg:w-1/2 flex flex-col gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInLeft}
          transition={easeOutShort}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full w-max border border-blue-100"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
              {t("landing.cfdi.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black leading-tight"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.cfdi.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.cfdi.subtitle")}
          </motion.p>
          <motion.button
            className="text-blue-600 font-semibold flex items-center gap-2 hover:gap-3 transition-all mt-2 w-fit"
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.3 }}
          >
            {t("landing.cfdi.cta")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </motion.button>
        </motion.div>

        <motion.div
          className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {features.map(({ key, icon: Icon }) => (
            <motion.div
              key={key}
              className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              variants={fadeInUp}
              transition={easeOutLong}
              whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
            >
              <motion.div
                className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </motion.div>
              <motion.h3
                className="text-sm font-bold text-black"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...easeOutShort }}
              >
                {t(`landing.cfdi.features.${key}.title`)}
              </motion.h3>
              <motion.p
                className="text-xs text-neutral-500 leading-relaxed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...easeOutShort }}
              >
                {t(`landing.cfdi.features.${key}.description`)}
              </motion.p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
