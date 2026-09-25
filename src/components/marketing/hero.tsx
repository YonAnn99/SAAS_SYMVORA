"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { ArrowRight, Play } from "lucide-react";
import { cubicBezierPremium, springTransition, scrollRevealStagger } from "./animations";
import { PosMockup } from "./pos-mockup";
import { SinLimites } from "./sin-limites";
import { PromoBadgeEnLinea } from "./promo-badge";
import { CAPSULA, CAPSULA_GRANDE, FLECHA_CAPSULA, PRINCIPAL, SECUNDARIA } from "./boton-capsula";

export function Hero() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <section
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12 pb-24 lg:pb-32 overflow-hidden flex flex-col lg:flex-row items-center gap-12 lg:gap-16"
    >
      {/* Columna izquierda. NADA de lo que se ve sin desplazar parte de
          `opacity: 0`: antes el H1 (el elemento del LCP) llegaba en el HTML con
          `style="opacity:0"` y no se veia hasta descargar el JS, hidratar y
          animar (varios segundos en un Android de gama media). La entrada
          ahora es CSS (`.entrada-suave`, solo desplazamiento): el texto se ve
          desde el primer pintado. */}
      <div className="w-full lg:w-3/5 flex flex-col gap-8 lg:gap-10 z-10">
        {/* El sello de la promocion en movil. En escritorio no se dibuja: alli
            vive flotando en el marco (ver `promo-badge.tsx`). */}
        <PromoBadgeEnLinea />

        {/* Headline */}
        <h1
          className="entrada-suave text-4xl sm:text-6xl lg:text-7xl font-bold text-black dark:text-neutral-50 max-w-3xl leading-[1.05] tracking-tighter"
        >
          {t("landing.hero.title")}{" "}
          <span className="relative text-primary">
            {t("landing.hero.highlight")}
            <svg
              className="absolute -bottom-1.5 left-0 w-full h-3 text-primary/30"
              preserveAspectRatio="none"
              viewBox="0 0 100 10"
              aria-hidden="true"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="entrada-suave [animation-delay:80ms] text-lg sm:text-xl text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed"
        >
          {t("landing.hero.subtitle")}
        </p>

        {/* CTAs */}
        <div className="entrada-suave [animation-delay:160ms] flex flex-col sm:flex-row gap-3">
          {/* CTA principal. `rounded-full` en el envoltorio: la sombra del
              hover es suya y sin eso salia rectangular bajo la capsula. */}
          <m.div
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="rounded-full"
          >
            <Link
              href="/signup"
              className={`${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL}`}
            >
              {t("landing.hero.ctaPrimary")}
              <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
            </Link>
          </m.div>

          {/* Secondary CTA - Ghost with pulse */}
          <m.div
            whileHover={{ y: -2, boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-full"
          >
            <span
              className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-25"
              aria-hidden="true"
            />
            <Link
              href={
                process.env.NODE_ENV === "production"
                  ? `https://demo.symvora.com.mx/${locale}/demo`
                  : `/${locale}/demo`
              }
              className={`${CAPSULA} ${CAPSULA_GRANDE} ${SECUNDARIA}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 01-1.497.89l-3.197-2.132A1 1 0 004 10.073V13.93a1 1 0 001.497.89l3.197 2.132A1 1 0 0011 14.12V18a1 1 0 001 1h2a1 1 0 001-1v-4.263a1 1 0 011.497-.89l3.197-2.132A1 1 0 0020 10.073V6.927a1 1 0 00-1.497-.89l-3.197 2.132A1 1 0 0012 6.927z" />
              </svg>
              {t("landing.hero.ctaSecondary")}
            </Link>
          </m.div>
        </div>

        {/* Lo que no tiene tope: usuarios, productos y comisiones. */}
        <SinLimites visibleDesdeInicio />
      </div>

      {/* Right Column - POS Mockup (40%) */}
      <m.div
        className="w-full lg:w-2/5 relative min-h-[360px] sm:min-h-[420px] lg:min-h-[500px] mt-8 lg:mt-0 flex items-center justify-center"
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Resplandor de fondo. ESTATICO a proposito: eran capas `blur-3xl`
            con `scale` en bucle infinito, y el navegador las repintaba sin
            parar (GPU y bateria en celulares modestos, tirones al desplazar). */}
        <div
          className="absolute inset-0 bg-gradient-to-tr from-primary/10 dark:from-primary/5 via-transparent to-transparent rounded-full blur-3xl opacity-60 z-0 scale-90"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl opacity-50"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl opacity-50"
          aria-hidden="true"
        />

        {/* POS Mockup - Sticky Stack Target */}
        <m.div
          className="relative w-full max-w-[560px] aspect-[4/3] z-10"
          initial={{ rotateY: 15, rotateX: -5, scale: 0.95 }}
          animate={{ rotateY: 0, rotateX: 0, scale: 1 }}
          whileHover={{ rotateY: 0, rotateX: 0, scale: 1.01 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "center center" }}
        >
          <PosMockup />
          
          {/* Floating stat badge */}
          <m.div
            className="absolute left-2 right-auto sm:-left-6 bottom-4 sm:bottom-10 bg-white dark:bg-neutral-900 p-3 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 max-w-[calc(100%-1rem)]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-500 text-lg" aria-hidden="true">📈</span>
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                {t("landing.hero.growthLabel")}
              </span>
              <span className="text-lg font-bold text-black dark:text-neutral-50">+24.5%</span>
            </div>
          </m.div>
        </m.div>
      </m.div>

      {/* Orbitas de fondo, tambien estaticas (ver arriba). */}
      <div
        className="hero-orb w-96 h-96 top-1/4 -right-20 bg-primary/10 dark:bg-primary/5"
        aria-hidden="true"
      />
      <div
        className="hero-orb w-72 h-72 bottom-1/4 -left-20 bg-primary/5 dark:bg-primary/10"
        aria-hidden="true"
      />
    </section>
  );
}