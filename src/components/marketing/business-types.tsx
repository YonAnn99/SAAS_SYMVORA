"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  Store,
  Leaf,
  PawPrint,
  Shirt,
  Wrench,
  Pill,
  Building2,
} from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  springIcon,
} from "./animations";

const icons = [Store, Leaf, PawPrint, Shirt, Wrench, Pill, Building2];
const keys = [
  "ABARROTES",
  "VERDULERIA",
  "MASCOTAS",
  "ROPA",
  "FERRETERIA",
  "FARMACIA",
  "GENERAL",
] as const;

export function BusinessTypes() {
  const t = useTranslations();

  return (
    <motion.section
      id="industries"
      className="w-full py-24 bg-neutral-50 border-t border-neutral-100"
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
            className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
              {t("landing.businessTypes.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.businessTypes.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.businessTypes.subtitle")}
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={key}
                className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-lg hover:border-blue-200 transition-all group cursor-default"
                variants={fadeInUp}
                transition={easeOutLong}
                whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)" }}
              >
                <motion.div
                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"
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
                  {t(`landing.businessTypes.types.${key}.name`)}
                </motion.h3>
                <motion.p
                  className="text-xs text-neutral-500 leading-relaxed"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, ...easeOutShort }}
                >
                  {t(`landing.businessTypes.types.${key}.desc`)}
                </motion.p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.section>
  );
}
