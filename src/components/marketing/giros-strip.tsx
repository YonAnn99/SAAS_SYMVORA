"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { GIROS_FRANJA, giroPorSlug, rutaGiro, type Giro } from "@/features/marketing/giros";
import { easeOutShort, staggerContainerFast, fadeInUpSmall } from "./animations";

/**
 * Franja de giros, lo primero de la landing (encima del hero): el visitante se
 * reconoce ("esto es para mi papeleria") antes de leer una sola funcion.
 *
 * Cada icono lleva a la pagina de su giro; "Otros" baja al catalogo completo
 * (`#giros`, en `GirosCatalog`). Las paginas por giro existen solo en español
 * (el mercado es Mexico), asi que el enlace va a /es aunque se vea en ingles.
 */
export function GirosStrip() {
  const locale = useLocale();
  const giros = GIROS_FRANJA.map((slug) => giroPorSlug(slug)).filter(
    (g): g is Giro => Boolean(g)
  );

  return (
    <section
      aria-label={locale === "en" ? "Business types" : "Giros comerciales"}
      className="w-full pt-2 pb-4 sm:pb-5 border-b border-neutral-100 dark:border-neutral-800"
    >
      <motion.ul
        variants={staggerContainerFast}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        // Celular: desplazamiento horizontal. Escritorio: UNA fila centrada; con
        // 92 px por elemento los 12 no cabian y "Otros" se bajaba de linea.
        className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 sm:gap-2 lg:gap-1 overflow-x-auto scrollbar-hide lg:justify-center snap-x"
      >
        {giros.map((giro) => {
          const Icono = giro.icono;
          return (
            <motion.li key={giro.slug} variants={fadeInUpSmall} transition={easeOutShort} className="snap-start shrink-0">
              <Link
                href={rutaGiro(giro.slug)}
                className="group flex w-[80px] sm:w-[84px] flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
              >
                <span
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center transition-transform group-hover:-translate-y-0.5"
                  aria-hidden="true"
                >
                  <Icono className="w-5 h-5 sm:w-6 sm:h-6" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold leading-tight text-neutral-800 dark:text-neutral-200">
                  {giro.nombre[locale === "en" ? "en" : "es"]}
                </span>
              </Link>
            </motion.li>
          );
        })}
        <motion.li variants={fadeInUpSmall} transition={easeOutShort} className="snap-start shrink-0">
          <a
            href="#giros"
            className="group flex w-[80px] sm:w-[84px] flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
          >
            <span
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-blue-600/30 text-blue-600 flex items-center justify-center transition-transform group-hover:-translate-y-0.5"
              aria-hidden="true"
            >
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-[11px] sm:text-xs font-semibold leading-tight text-blue-600">
              {locale === "en" ? "More" : "Otros"}
            </span>
          </a>
        </motion.li>
      </motion.ul>
    </section>
  );
}
