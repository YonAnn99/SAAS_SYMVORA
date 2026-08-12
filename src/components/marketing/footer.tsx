"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Share, Globe, Mail } from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
} from "./animations";

export function Footer() {
  const t = useTranslations();

  return (
    <motion.footer
      className="w-full bg-neutral-50 border-t border-neutral-200 pt-16 pb-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div
            className="flex flex-col gap-4"
            variants={fadeInUp}
            transition={easeOutShort}
          >
            <motion.div
              className="flex items-center gap-3 mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, ...easeOutShort }}
            >
              <Image
                alt="SYMVORA Logo"
                className="h-6 w-auto object-contain"
                src="/symvora-logo.webp"
                width={24}
                height={24}
              />
              <span className="text-xl font-bold tracking-tight text-black">
                SYMVORA
              </span>
            </motion.div>
            <motion.p
              className="text-sm text-neutral-500 leading-relaxed"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...easeOutShort }}
            >
              {t("landing.footer.description")}
            </motion.p>
            <motion.div
              className="flex gap-3 mt-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ...easeOutShort }}
            >
              <motion.span
                className="w-5 h-5 text-neutral-400 cursor-pointer hover:text-blue-600 transition-colors inline-block"
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Compartir"
              >
                <Share className="w-5 h-5" />
              </motion.span>
              <motion.span
                className="w-5 h-5 text-neutral-400 cursor-pointer hover:text-blue-600 transition-colors inline-block"
                whileHover={{ scale: 1.1, rotate: -15 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Sitio web"
              >
                <Globe className="w-5 h-5" />
              </motion.span>
              <motion.span
                className="w-5 h-5 text-neutral-400 cursor-pointer hover:text-blue-600 transition-colors inline-block"
                whileHover={{ scale: 1.1, x: 4 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </motion.span>
            </motion.div>
          </motion.div>

          {[
            { titleKey: "landing.footer.product", items: ["landing.footer.features", "landing.footer.pricing", "landing.footer.integrations"] },
            { titleKey: "landing.footer.company", items: ["landing.footer.about", "landing.footer.blog", "landing.footer.support"] },
            { titleKey: "landing.footer.legal", items: ["landing.footer.privacy", "landing.footer.terms"] },
          ].map((column) => (
            <motion.div
              key={column.titleKey}
              variants={fadeInUp}
              transition={easeOutShort}
            >
              <motion.h4
                className="text-xs font-bold uppercase tracking-wider text-black mb-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, ...easeOutShort }}
              >
                {t(column.titleKey)}
              </motion.h4>
              <ul className="flex flex-col gap-2">
                {column.items.map((itemKey, idx) => (
                  <motion.li
                    key={itemKey}
                    className="text-sm text-neutral-500 hover:text-black cursor-pointer transition-colors"
                    whileHover={{ x: 4 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 + 0.1, ...easeOutShort }}
                  >
                    {t(itemKey)}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="border-t border-neutral-200 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.4 }}
        >
          <span className="text-xs text-neutral-400">
            {t("landing.footer.copyright")}
          </span>
          <div className="flex gap-6">
            <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/login"
                className="text-xs text-neutral-400 hover:text-black transition-colors"
              >
                {t("landing.nav.login")}
              </Link>
            </motion.div>
            <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/signup"
                className="text-xs text-neutral-400 hover:text-black transition-colors"
              >
                {t("landing.nav.cta")}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
}
