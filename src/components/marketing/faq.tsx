"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, MessageCircle } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
} from "./animations";
import { WhatsAppLogo } from "./whatsapp-logo";

// FAQ_KEYS se mantiene local (no export) porque este archivo es "use client".
// El Server Component src/app/[locale]/page.tsx declara su propia copia
// para evitar el bug "FAQ_KEYS.map is not a function" al cruzar el
// boundary server→client (Next.js serializa referencias, no valores).
const FAQ_KEYS = ["1", "2", "3", "4", "5", "7", "8"] as const;

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5215512345678";
const WHATSAPP_MESSAGE =
  "Hola, tengo una duda sobre SYMVORA que no encontré en las preguntas frecuentes.";

function buildWhatsAppUrl() {
  const text = encodeURIComponent(WHATSAPP_MESSAGE);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

interface AccordionRowProps {
  index: number;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionRow({ index, question, answer, isOpen, onToggle }: AccordionRowProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${index}`}
        id={`faq-trigger-${index}`}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:ring-offset-[#0C0C0C]"
      >
        <span className="flex items-center gap-3">
          <span
            className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              isOpen ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
            }`}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
            {question}
          </span>
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-panel-${index}`}
            role="region"
            aria-labelledby={`faq-trigger-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[60px] text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const t = useTranslations();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.section
      id="faq"
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
              {t("landing.faq.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.faq.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 dark:text-neutral-400"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.faq.subtitle")}
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl mx-auto w-full"
        >
          {FAQ_KEYS.map((key, i) => (
            <motion.div key={key} variants={fadeInUp} transition={easeOutShort}>
              <AccordionRow
                index={i}
                question={t(`landing.faq.items.${key}.question`)}
                answer={t(`landing.faq.items.${key}.answer`)}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={easeOutShort}
        >
          <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
            <MessageCircle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
            {t("landing.faq.cta.noAnswer")}
          </span>
          <motion.a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-emerald-600 transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:ring-offset-[#0C0C0C]"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <WhatsAppLogo size={18} className="text-white" aria-hidden="true" />
            {t("landing.faq.cta.contactUs")}
          </motion.a>
        </motion.div>
      </div>
    </motion.section>
  );
}
