"use client";

import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { easeOutLong, easeOutShort } from "./animations";
import { FeaturesVideo } from "@/components/marketing/features-video";
import { FeaturesMovil } from "@/components/marketing/features-movil";
import { useEsEscritorio } from "@/hooks/use-es-movil";



/** Brillo tenue del color del modulo en la esquina superior. */

/** Un modulo de la pila: acento (brillo + icono), texto y captura. */

export function Features() {
  const esEscritorio = useEsEscritorio();

  const t = useTranslations();

  return (
    <m.section
      id="features"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-24 flex flex-col gap-8 sm:gap-12"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={easeOutLong}
    >
      <m.div
        className="flex flex-col lg:flex-row justify-between items-end gap-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={easeOutShort}
      >
        <div className="max-w-2xl">
          <m.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            {t("landing.features.title")}
          </m.h2>
          <m.p
            className="text-lg text-neutral-500 dark:text-neutral-400"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.features.subtitle")}
          </m.p>
        </div>
      </m.div>

      {esEscritorio ? <FeaturesVideo /> : <FeaturesMovil />}
    </m.section>
  );
}