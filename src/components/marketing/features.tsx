"use client";

import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import {
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { easeOutLong, easeOutShort } from "./animations";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";
import { useEsMovil } from "@/hooks/use-es-movil";

// Tarjeta de la pila: opaca, dos columnas desde `md` (texto | visual).
const TARJETA =
  "overflow-hidden rounded-3xl md:rounded-[32px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 " +
  "shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] " +
  "p-6 sm:p-8 md:p-10 md:min-h-[22rem] flex flex-col md:flex-row gap-6 md:gap-10";
const TEXTO = "relative z-10 flex flex-col md:flex-1 md:justify-center";
const ICONO = "w-12 h-12 rounded-xl flex items-center justify-center mb-5";
const TITULO = "text-xl sm:text-2xl font-bold text-black dark:text-neutral-50 mb-3";
const DESCRIPCION = "text-neutral-500 dark:text-neutral-400 leading-relaxed";
const VISUAL = "relative z-10 flex md:flex-1 w-full";

/** Brillo tenue del color del modulo en la esquina superior. */
function Brillo({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function Features() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();
  const esMovil = useEsMovil();

  return (
    <m.section
      id="features"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col gap-12"
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
        <m.a
          href="#"
          className="text-primary text-sm font-medium flex items-center gap-1 hover:text-primary/80 transition-colors pb-1 border-b border-transparent hover:border-primary"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ ...easeOutShort, delay: 0.2 }}
          whileHover={{ x: 4 }}
        >
          {t("landing.features.viewAll")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </m.a>
      </m.div>

      {/* Scroll Stack (React Bits): al bajar, cada modulo se apila sobre el
          anterior. Tarjetas OPACAS (al apilarse no debe verse la de abajo) y
          cada una con el acento de su modulo. */}
      <ScrollStack
        className="mx-auto max-w-5xl"
        itemDistance={esMovil ? 60 : 90}
        itemStackDistance={esMovil ? 16 : 28}
        stackPosition={esMovil ? "14%" : "18%"}
        scaleEndPosition={esMovil ? "8%" : "10%"}
        baseScale={0.88}
        itemScale={0.03}
      >
        {/* 1. Punto de venta: azul de la marca */}
        <ScrollStackItem className={TARJETA}>
          <Brillo className="bg-[#1e3a8a]/15 dark:bg-blue-500/10" />
          <div className={TEXTO}>
            <span className={`${ICONO} bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-blue-500/10 dark:text-blue-400`}>
              <ShoppingCart className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className={TITULO}>{t("landing.features.pos.title")}</h3>
            <p className={DESCRIPCION}>{t("landing.features.pos.description")}</p>
          </div>
          <div className={`${VISUAL} items-end gap-2 h-40 border-t md:border-t-0 md:border-l border-neutral-100 dark:border-neutral-800 pt-6 md:pt-0 md:pl-8`}>
            {[30, 45, 25, 60, 80, 100].map((h, i) => (
              <m.div
                key={i}
                className={`w-1/6 rounded-t-md ${
                  i === 5 ? "bg-[#1e3a8a] dark:bg-blue-500" : "bg-[#1e3a8a]/10 dark:bg-blue-500/15"
                }`}
                style={{ height: `${h}%` }}
                initial={reduceMotion ? false : { height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 20 }}
              />
            ))}
          </div>
        </ScrollStackItem>

        {/* 2. Inventario: ambar */}
        <ScrollStackItem className={TARJETA}>
          <Brillo className="bg-amber-500/15 dark:bg-amber-500/10" />
          <div className={TEXTO}>
            <span className={`${ICONO} bg-amber-50 text-amber-600 dark:bg-amber-500/10`}>
              <Package className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className={TITULO}>{t("landing.features.inventory.title")}</h3>
            <p className={DESCRIPCION}>{t("landing.features.inventory.description")}</p>
          </div>
          <div className={`${VISUAL} items-center`}>
            <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span className="truncate text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-medium">
                  {t("landing.features.inventory.stockAlert")}
                </span>
              </div>
              <span className="text-sm font-bold text-black dark:text-neutral-50">SKU-892</span>
            </div>
          </div>
        </ScrollStackItem>

        {/* 3. Ordenes de compra: esmeralda */}
        <ScrollStackItem className={TARJETA}>
          <Brillo className="bg-emerald-500/15 dark:bg-emerald-500/10" />
          <div className={TEXTO}>
            <span className={`${ICONO} bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10`}>
              <FileText className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className={TITULO}>{t("landing.features.purchases.title")}</h3>
            <p className={DESCRIPCION}>{t("landing.features.purchases.description")}</p>
          </div>
          <div className={`${VISUAL} items-center justify-center`}>
            <svg
              className="w-36 h-36 md:w-44 md:h-44 text-emerald-500/60 dark:text-emerald-400/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle cx="20" cy="80" r="5" />
              <circle cx="80" cy="20" r="5" />
              <circle cx="50" cy="50" r="7" />
              <path d="M24 76 L45 55 M55 45 L76 24" />
            </svg>
          </div>
        </ScrollStackItem>

        {/* 4. Migra tu catalogo: celeste */}
        <ScrollStackItem className={TARJETA}>
          <Brillo className="bg-sky-500/15 dark:bg-sky-500/10" />
          <div className={TEXTO}>
            <span className={`${ICONO} bg-sky-50 text-sky-600 dark:bg-sky-500/10`}>
              <Upload className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className={TITULO}>{t("landing.features.catalogImport.title")}</h3>
            <p className={DESCRIPCION}>{t("landing.features.catalogImport.description")}</p>
          </div>
          <div className={`${VISUAL} items-center justify-center gap-3`}>
            <span className="text-sm font-mono px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              CSV
            </span>
            <ArrowRight className="w-4 h-4 text-neutral-400" aria-hidden="true" />
            <span className="text-sm font-mono px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600">
              SYMVORA
            </span>
          </div>
        </ScrollStackItem>

        {/* 5. Finanzas: morado con el azul de la marca */}
        <ScrollStackItem className={TARJETA}>
          <Brillo className="bg-purple-500/15 dark:bg-purple-500/10" />
          <div className={TEXTO}>
            <span className={`${ICONO} bg-purple-50 text-purple-600 dark:bg-purple-500/10`}>
              <BarChart3 className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className={TITULO}>{t("landing.features.finances.title")}</h3>
            <p className={DESCRIPCION}>{t("landing.features.finances.description")}</p>
          </div>
          <div className={`${VISUAL} items-center justify-center`}>
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-[14px] md:border-[16px] border-neutral-100 dark:border-neutral-800 relative">
              <m.div
                className="absolute inset-[-14px] md:inset-[-16px] rounded-full border-[14px] md:border-[16px] border-transparent border-t-[#1e3a8a] border-r-[#1e3a8a] dark:border-t-blue-500 dark:border-r-blue-500 rotate-45"
                animate={reduceMotion ? undefined : { rotate: 405 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <m.div
                className="absolute inset-[-14px] md:inset-[-16px] rounded-full border-[14px] md:border-[16px] border-transparent border-l-purple-500 rotate-[15deg]"
                animate={reduceMotion ? undefined : { rotate: -345 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl md:text-4xl font-bold text-black dark:text-neutral-50">
                  87<span className="text-lg">%</span>
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  {t("landing.features.finances.efficiency")}
                </span>
              </div>
            </div>
          </div>
        </ScrollStackItem>
      </ScrollStack>
    </m.section>
  );
}