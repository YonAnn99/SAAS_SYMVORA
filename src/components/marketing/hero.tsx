"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { ArrowRight, Play } from "lucide-react";
import { cubicBezierPremium, springTransition, scrollRevealStagger } from "./animations";
import Image from "next/image";
import { HeroMockups, MOCKUPS_HERO, rutaMockup } from "./hero-mockups";
import { PalabraGiratoria } from "./palabra-giratoria";
import { SinLimites } from "./sin-limites";
import { GirosStrip } from "./giros-strip";
import { CAPSULA, CAPSULA_GRANDE, FLECHA_CAPSULA, PRINCIPAL, SECUNDARIA } from "./boton-capsula";

/** Orden en que rota la palabra del titulo (las claves viven en `landing.hero.dispositivos`). */
const DISPOSITIVOS = ["celular", "tablet", "computadora", "dispositivo"] as const;

export function Hero() {
  const t = useTranslations();
  const locale = useLocale();
  // Estable entre pintados: el giratorio no reinicia su ciclo por un arreglo nuevo.
  const palabras = useMemo(
    () => DISPOSITIVOS.map((d) => t(`landing.hero.dispositivos.${d}`)),
    [t]
  );

  return (
    <section
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 pb-10 sm:pb-24 lg:pb-32 overflow-hidden flex flex-col lg:flex-row items-center gap-6 lg:gap-16"
    >
      {/* Columna izquierda. NADA de lo que se ve sin desplazar parte de
          `opacity: 0`: antes el H1 (el elemento del LCP) llegaba en el HTML con
          `style="opacity:0"` y no se veia hasta descargar el JS, hidratar y
          animar (varios segundos en un Android de gama media). La entrada
          ahora es CSS (`.entrada-suave`, solo desplazamiento): el texto se ve
          desde el primer pintado. */}
      <div className="w-full lg:w-3/5 flex flex-col gap-5 sm:gap-8 lg:gap-10 z-10">
        {/* Headline */}
        <h1
          className="entrada-suave text-[1.95rem] sm:text-5xl xl:text-6xl font-bold text-black dark:text-white max-w-3xl leading-[1.08] tracking-tighter"
        >
          {/* El eslogan fijo ("...desde cualquier") y, SIEMPRE en su propio
              renglon, la palabra que rota. Si unas veces cupiera junto al texto
              y otras no, el titulo cambiaria de alto y todo lo de abajo
              brincaria cada 2 segundos. */}
          {/* Celular: titular corto de beneficio (el largo ocupaba 5 renglones
              y empujaba el boton fuera de la primera pantalla). */}
          <span className="sm:hidden">{t("landing.hero.titleMovil")}</span>
          <span className="hidden sm:inline">
            {t("landing.hero.title")}
            {/* Rota en bucle: celular, tablet, computadora, dispositivo. */}
            <PalabraGiratoria palabras={palabras} />
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="entrada-suave [animation-delay:80ms] text-base sm:text-xl text-neutral-600 dark:text-white max-w-xl leading-relaxed"
        >
          <span className="sm:hidden">{t("landing.hero.subtitleMovil")}</span>
          <span className="hidden sm:inline">{t("landing.hero.subtitle")}</span>
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
              className={`${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL} w-full sm:w-auto`}
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
              className="hidden sm:block absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-25"
              aria-hidden="true"
            />
            <Link
              href={
                process.env.NODE_ENV === "production"
                  ? `https://demo.symvora.com.mx/${locale}/demo`
                  : `/${locale}/demo`
              }
              className={`${CAPSULA} h-11 px-6 text-sm sm:h-14 sm:px-8 sm:text-base w-full sm:w-auto ${SECUNDARIA}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 01-1.497.89l-3.197-2.132A1 1 0 004 10.073V13.93a1 1 0 001.497.89l3.197 2.132A1 1 0 0011 14.12V18a1 1 0 001 1h2a1 1 0 001-1v-4.263a1 1 0 011.497-.89l3.197-2.132A1 1 0 0020 10.073V6.927a1 1 0 00-1.497-.89l-3.197 2.132A1 1 0 0012 6.927z" />
              </svg>
              {t("landing.hero.ctaSecondary")}
            </Link>
          </m.div>
        </div>

        {/* Quita la ultima duda de quien llega por un anuncio: no hay riesgo. */}
        <p className="entrada-suave [animation-delay:200ms] -mt-2 sm:hidden text-center text-xs text-neutral-500 dark:text-neutral-400">
          {t("landing.hero.sinTarjeta")}
        </p>

        {/* Lo que no tiene tope: usuarios, productos y comisiones. */}
        {/* Celular: la franja de giros va aqui (a sangre, como en su seccion);
            escritorio: usuarios, productos y comisiones sin tope. */}
        <div className="lg:hidden -mx-4 sm:-mx-6">
          <GirosStrip clase="max-lg:border-b-0" />
        </div>
        <div className="hidden lg:block">
          <SinLimites visibleDesdeInicio />
        </div>

        {/* Celular: el producto a la vista sin desplazar. Solo se asoma la
            parte de arriba (recorte con degradado) para invitar a seguir. */}
        <div
          className="lg:hidden relative mx-auto -mb-2 h-[230px] w-[210px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
          aria-hidden="true"
        >
          {(["claro", "oscuro"] as const).map((modo) => (
            <Image
              key={modo}
              src={rutaMockup(modo, "movil")}
              alt=""
              width={MOCKUPS_HERO[2].ancho}
              height={MOCKUPS_HERO[2].alto}
              loading="eager"
              unoptimized
              draggable={false}
              className={`w-full h-auto select-none ${modo === "claro" ? "dark:hidden" : "hidden dark:block"}`}
            />
          ))}
        </div>
      </div>

      {/* Right Column - Mockups de dispositivos (40%) */}
      {/* En escritorio, arriba y a la altura del titulo ("Tu sistema todo en
          uno"), no centrada contra toda la columna izquierda. `lg:pt-3` baja el
          borde del mockup a la linea de las mayusculas del H1. */}
      <m.div
        // Solo con las columnas lado a lado: en celular y tablet vertical se
        // apilaba bajo todo el texto y estorbaba mas de lo que aportaba.
        className="hidden lg:flex w-full lg:w-2/5 relative lg:pt-3 lg:self-start lg:items-start justify-center"
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

        {/* Mockups del panel en laptop, tablet y celular, uno a la vez (claro u oscuro
            segun el modo). Ver `hero-mockups.tsx`. */}
        <m.div
          className="relative w-full max-w-[560px] z-10"
          initial={{ rotateY: 15, rotateX: -5, scale: 0.95 }}
          animate={{ rotateY: 0, rotateX: 0, scale: 1 }}
          whileHover={{ rotateY: 0, rotateX: 0, scale: 1.01 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "center center" }}
        >
          <HeroMockups />
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