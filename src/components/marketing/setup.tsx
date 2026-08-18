"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { UserPlus, Package, Truck, ShoppingCart } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  springIcon,
} from "./animations";

const steps = [
  { key: "1", icon: UserPlus },
  { key: "2", icon: Package },
  { key: "3", icon: Truck },
  { key: "4", icon: ShoppingCart },
];

export function Setup() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="w-full py-24 bg-white dark:bg-[#0C0C0C]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
        <motion.div
          className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={easeOutShort}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-500/20"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
              {t("landing.setup.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.setup.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 dark:text-neutral-400"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.setup.subtitle")}
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto w-full relative"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {steps.map(({ key, icon: Icon }, index) => (
            <motion.div
              key={key}
              className="flex flex-col items-center text-center gap-4 relative"
              variants={fadeInUp}
              transition={easeOutLong}
            >
              <motion.div
                className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-500/20 relative z-10"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...springIcon }}
                whileHover={{ scale: 1.1, rotate: 10 }}
              >
                <Icon className="w-6 h-6" aria-hidden="true" />
              </motion.div>
              <motion.span
                className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-500/20"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...easeOutShort }}
              >
                {t("landing.setup.stepLabel")} {key}
              </motion.span>
              <motion.h3
                className="text-base font-bold text-black dark:text-neutral-50"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...easeOutShort }}
              >
                {t(`landing.setup.steps.${key}.title`)}
              </motion.h3>
              <motion.p
                className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ...easeOutShort }}
              >
                {t(`landing.setup.steps.${key}.description`)}
              </motion.p>
              {index < steps.length - 1 && (
                <motion.div
                  className="hidden lg:block absolute top-7 left-[60%] w-[80%] border-t border-dashed border-neutral-300 dark:border-neutral-700"
                  initial={{ width: 0 }}
                  animate={{ width: "80%" }}
                  transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                  style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
                  aria-hidden="true"
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
