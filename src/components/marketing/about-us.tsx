"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { GraduationCap, Target, Heart, Users, Shield } from "lucide-react";
import {
  easeOutLong,
  staggerContainer,
  fadeInUpSmall,
  scaleIn,
} from "./animations";

export function AboutUs() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="about"
      className="w-full py-24 lg:py-32 bg-white dark:bg-[#0C0C0C]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div className="flex flex-col gap-8">
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-500/20 w-fit">
              <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
                {t("landing.about.badge")}
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-neutral-50 leading-[1.1] max-w-xl">
              {t("landing.about.title")}
            </h2>

            <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xl">
              {t("landing.about.subtitle")}
            </p>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="grid grid-cols-2 gap-6"
            >
              {[
                { icon: Target, labelKey: "landing.about.values.mission", descKey: "landing.about.values.missionDesc" },
                { icon: Heart, labelKey: "landing.about.values.empathy", descKey: "landing.about.values.empathyDesc" },
                { icon: Users, labelKey: "landing.about.values.community", descKey: "landing.about.values.communityDesc" },
                { icon: Shield, labelKey: "landing.about.values.trust", descKey: "landing.about.values.trustDesc" },
              ].map((item) => (
                <motion.div
                  key={item.labelKey}
                  variants={fadeInUpSmall}
                  className="flex flex-col gap-3"
                >
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center">
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black dark:text-neutral-50">{t(item.labelKey)}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{t(item.descKey)}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="relative">
            <motion.div
              className="w-full max-w-md mx-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-950 dark:via-neutral-900 dark:to-purple-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 relative overflow-hidden"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={scaleIn}
              transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            >
              <div
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-100/50 via-transparent to-purple-100/50"
                aria-hidden="true"
              />
              <div className="relative z-10 flex flex-col items-center gap-5 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-xl">
                  <GraduationCap className="w-9 h-9 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium">
                    {t("landing.about.foundedBy")}
                  </p>
                  <p className="text-xl font-bold text-black dark:text-neutral-50 mt-1">
                    {t("landing.about.founders")}
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed text-center">
                    {t("landing.about.story")}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 w-full">
                  <div className="flex flex-col items-center">
                    <p className="text-xl font-bold text-black dark:text-neutral-50">7+</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                      {t("landing.about.stats.industries")}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
                  <div className="flex flex-col items-center">
                    <p className="text-xl font-bold text-black dark:text-neutral-50">100%</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                      {t("landing.about.stats.mexican")}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
                  <div className="flex flex-col items-center">
                    <p className="text-xl font-bold text-black dark:text-neutral-50">$0</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                      {t("landing.about.stats.commission")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-100 dark:bg-blue-900 rounded-full blur-3xl opacity-50 dark:opacity-40"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
              aria-hidden="true"
            />
            <motion.div
              className="absolute -top-4 -right-4 w-24 h-24 bg-purple-100 dark:bg-purple-900 rounded-full blur-3xl opacity-50 dark:opacity-40"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, duration: 1, ease: "easeOut" }}
              style={{ animationPlayState: reduceMotion ? "paused" : "running" }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
