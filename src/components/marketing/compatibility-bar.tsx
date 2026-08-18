"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Smartphone, Tablet, Monitor, Cloud } from "lucide-react";
import { easeOutShort, staggerContainerFast, fadeInUpSmall } from "./animations";

const items = [
  { icon: Smartphone, key: "mobile" },
  { icon: Tablet, key: "tablet" },
  { icon: Monitor, key: "desktop" },
  { icon: Cloud, key: "online" },
] as const;

export function CompatibilityBar() {
  const t = useTranslations();

  return (
    <motion.section
      aria-label={t("landing.compatibility.ariaLabel")}
      className="w-full py-10 sm:py-12 bg-white dark:bg-[#0C0C0C] border-b border-neutral-100 dark:border-neutral-800"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={easeOutShort}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 sm:gap-x-10"
        >
          {items.map(({ icon: Icon, key }) => (
            <motion.div
              key={key}
              variants={fadeInUpSmall}
              transition={easeOutShort}
              className="flex items-center gap-2 text-sm sm:text-base text-neutral-700 dark:text-neutral-300"
            >
              <span
                className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="leading-tight">
                <strong className="text-black dark:text-neutral-50 font-semibold">
                  {t(`landing.compatibility.${key}.title`)}
                </strong>
                <span className="hidden sm:inline text-neutral-500 dark:text-neutral-400">
                  {" — "}
                  {t(`landing.compatibility.${key}.desc`)}
                </span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
