"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Zap, Clock, Heart } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  springIcon,
} from "./animations";

export function Benefits() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="benefits"
      className="w-full bg-white dark:bg-[#0C0C0C] py-24 border-t border-neutral-100 dark:border-neutral-800"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        <motion.div
          className="lg:w-1/2 flex flex-col gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInLeft}
          transition={easeOutShort}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full w-max border border-blue-100 dark:border-blue-500/20"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
              {t("landing.benefits.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50 leading-tight"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.benefits.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.benefits.subtitle")}
          </motion.p>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              { Icon: Zap, titleKey: "landing.benefits.innovation", descKey: "landing.benefits.innovationDesc" },
              { Icon: Clock, titleKey: "landing.benefits.reliability", descKey: "landing.benefits.reliabilityDesc" },
              { Icon: Heart, titleKey: "landing.benefits.commitment", descKey: "landing.benefits.commitmentDesc" },
            ].map(({ Icon, titleKey, descKey }) => (
              <motion.div
                key={titleKey}
                className="flex flex-col gap-3"
                variants={fadeInUp}
                transition={easeOutLong}
              >
                <motion.div
                  className="flex items-center gap-2 text-blue-600"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, ...easeOutShort }}
                >
                  <motion.span
                    className="w-5 h-5 inline-block"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, ...springIcon }}
                    aria-hidden="true"
                  >
                    <Icon className="w-5 h-5" />
                  </motion.span>
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {t(titleKey)}
                  </h4>
                </motion.div>
                <motion.p
                  className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ...easeOutShort }}
                >
                  {t(descKey)}
                </motion.p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="lg:w-1/2 relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInRight}
          transition={{ ...easeOutShort, delay: 0.2 }}
        >
          <motion.div
            className="relative rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center min-h-[260px] sm:aspect-video"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-950 to-transparent" aria-hidden="true" />
            <motion.div
              className="z-10 flex flex-col items-center gap-4 p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ...easeOutShort }}
            >
              <motion.div
                className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center border border-blue-100 dark:border-blue-500/20"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, ...springIcon }}
              >
                <Heart className="w-8 h-8 text-blue-600" aria-hidden="true" />
              </motion.div>
              <h3 className="text-xl font-bold text-black dark:text-neutral-50">
                {t("landing.benefits.commitment")}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-xs">
                {t("landing.benefits.commitmentDesc")}
              </p>
            </motion.div>
            <motion.div
              className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-50 dark:bg-blue-950 rounded-full blur-2xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
              style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
              aria-hidden="true"
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
