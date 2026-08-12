"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Shield, Users, ScrollText, Lock } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  fadeInRight,
  springIcon,
} from "./animations";

const features = [
  { key: "rls", icon: Shield },
  { key: "roles", icon: Users },
  { key: "audit", icon: ScrollText },
  { key: "passwords", icon: Lock },
];

export function SecuritySection() {
  const t = useTranslations();

  return (
    <motion.section
      className="w-full py-24 bg-[#1A1A1A] text-white"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-16 items-center">
        <motion.div
          className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4 order-2 lg:order-1"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {features.map(({ key, icon: Icon }) => (
            <motion.div
              key={key}
              className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3 hover:bg-white/10 transition-colors"
              variants={fadeInUp}
              transition={easeOutLong}
              whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(255, 255, 255, 0.05)" }}
            >
              <motion.div
                className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </motion.div>
              <motion.h3
                className="text-sm font-bold"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...easeOutShort }}
              >
                {t(`landing.security.features.${key}.title`)}
              </motion.h3>
              <motion.p
                className="text-xs text-neutral-400 leading-relaxed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...easeOutShort }}
              >
                {t(`landing.security.features.${key}.description`)}
              </motion.p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="lg:w-1/2 flex flex-col gap-6 order-1 lg:order-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInRight}
          transition={easeOutShort}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full w-max border border-white/20"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-400 uppercase tracking-widest">
              {t("landing.security.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold leading-tight"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.security.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-400 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.security.subtitle")}
          </motion.p>
        </motion.div>
      </div>
    </motion.section>
  );
}
