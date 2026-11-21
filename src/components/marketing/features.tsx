"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import {
  ShoppingCart,
  ScanBarcode,
  Package,
  FileText,
  BarChart3,
  ArrowRight,
  Upload,
  Store,
  Gift,
} from "lucide-react";
import { easeOutLong, easeOutShort } from "./animations";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";
import { useEsMovil } from "@/hooks/use-es-movil";

// Tarjeta de la pila: opaca, dos columnas desde `md` (texto | visual).
const TARJETA =
  "overflow-hidden rounded-3xl md:rounded-[32px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 " +
  "shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] " +
  "p-5 sm:p-8 md:p-10 md:min-h-[22rem] flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-10";
const TEXTO = "relative z-10 flex flex-col md:flex-1 md:justify-center";
const ICONO = "w-12 h-12 rounded-xl flex items-center justify-center mb-5";
const TITULO = "text-xl sm:text-2xl font-bold text-black dark:text-neutral-50 mb-3";
const DESCRIPCION = "text-neutral-500 dark:text-neutral-400 leading-relaxed";
const VISUAL = "relative z-10 flex md:flex-1 w-full";

/**
 * Captura REAL del producto, recortada a lo que importa (`public/landing/funciones`).
 * Sin degradado ni recorte en vivo: el recorte ya viene hecho. Se revisaron sin
 * correos, celulares, nombres ni codigos QR de tarjetas.
 */
function Captura({ src, alt, ancho, alto }: { src: string; alt: string; ancho: number; alto: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[290px] sm:max-w-[340px] md:max-w-[420px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-950 shadow-lg">
      <Image src={src} alt={alt} width={ancho} height={alto} sizes="(min-width: 768px) 420px, 340px" className="w-full h-auto select-none" draggable={false} />
    </div>
  );
}

/** Brillo tenue del color del modulo en la esquina superior. */
function Brillo({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl ${className}`}
      aria-hidden="true"
    />
  );
}

/** Un modulo de la pila: acento (brillo + icono), texto y captura. */
const MODULOS = [
  { key: "pos", icono: ShoppingCart, brillo: "bg-[#1e3a8a]/15 dark:bg-blue-500/10", chip: "bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-blue-500/10 dark:text-blue-400", img: "pos", ancho: 367, alto: 435 },
  { key: "scanner", icono: ScanBarcode, brillo: "bg-orange-500/15 dark:bg-orange-500/10", chip: "bg-orange-50 text-orange-600 dark:bg-orange-500/10", img: "escaner", ancho: 760, alto: 730 },
  { key: "inventory", icono: Package, brillo: "bg-amber-500/15 dark:bg-amber-500/10", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10", img: "inventario", ancho: 373, alto: 330 },
  { key: "purchases", icono: FileText, brillo: "bg-emerald-500/15 dark:bg-emerald-500/10", chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10", img: "ordenes", ancho: 760, alto: 681 },
  { key: "catalogImport", icono: Upload, brillo: "bg-sky-500/15 dark:bg-sky-500/10", chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/10", img: "migracion", ancho: 373, alto: 310 },
  { key: "onlineCatalog", icono: Store, brillo: "bg-teal-500/15 dark:bg-teal-500/10", chip: "bg-teal-50 text-teal-600 dark:bg-teal-500/10", img: "catalogo", ancho: 760, alto: 724 },
  { key: "loyalty", icono: Gift, brillo: "bg-rose-500/15 dark:bg-rose-500/10", chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10", img: "lealtad", ancho: 760, alto: 507 },
  { key: "finances", icono: BarChart3, brillo: "bg-purple-500/15 dark:bg-purple-500/10", chip: "bg-purple-50 text-purple-600 dark:bg-purple-500/10", img: "caja", ancho: 720, alto: 415 },
] as const;

export function Features() {
  const t = useTranslations();
  const esMovil = useEsMovil();

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
          cada una con el acento de su modulo y una captura real. */}
      <ScrollStack
        className="mx-auto max-w-5xl"
        itemDistance={esMovil ? 40 : 90}
        itemStackDistance={esMovil ? 8 : 28}
        stackPosition={esMovil ? "11%" : "18%"}
        colaSvh={esMovil ? 35 : 15}
        baseScale={0.88}
        itemScale={0.03}
      >
        {MODULOS.map(({ key, icono: Icono, brillo, chip, img, ancho, alto }) => (
          <ScrollStackItem key={key} className={TARJETA}>
            <Brillo className={brillo} />
            <div className={TEXTO}>
              <span className={`${ICONO} ${chip}`}>
                <Icono className="w-6 h-6" aria-hidden="true" />
              </span>
              <h3 className={TITULO}>{t(`landing.features.${key}.title`)}</h3>
              <p className={DESCRIPCION}>{t(`landing.features.${key}.description`)}</p>
            </div>
            <div className={`${VISUAL} items-center justify-center`}>
              <Captura src={`/landing/funciones/${img}.webp`} ancho={ancho} alto={alto} alt={t(`landing.features.${key}.captura`)} />
            </div>
          </ScrollStackItem>
        ))}
      </ScrollStack>
    </m.section>
  );
}