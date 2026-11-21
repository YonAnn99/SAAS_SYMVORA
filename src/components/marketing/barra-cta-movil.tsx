"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { CAPSULA, FLECHA_CAPSULA, PRINCIPAL } from "./boton-capsula";

/**
 * Barra de registro fija, solo en celular (tablet vertical incluida: `lg:hidden`).
 *
 * Aparece cuando el hero ya quedo arriba (su boton salio de la pantalla) y se
 * esconde al llegar a los precios o al pie, donde ya hay un boton propio. Solo
 * existe en la landing: si la pagina no tiene `#hero-landing` (Aprende, giros,
 * Nosotros) nunca se muestra.
 *
 * Deja libre la izquierda: ahi esta el boton flotante del tema.
 * Vive dentro del marco redondeado (`absolute`, igual que los botones flotantes):
 * el scroll de la landing es el de `<main>`, no el de la ventana, asi que
 * `fixed` quedaria sobre el borde negro.
 */
const IDS_FINALES = ["pricing", "footer-contacto"];

export function BarraCtaMovil() {
  const t = useTranslations();
  const [heroPasado, setHeroPasado] = useState(false);
  const [enFinal, setEnFinal] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-landing");
    if (!hero) return;

    // El hero "paso" cuando ya no se ve Y quedo por ARRIBA (no por abajo).
    const ioHero = new IntersectionObserver(([e]) => {
      setHeroPasado(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    ioHero.observe(hero);

    const visibles = new Set<string>();
    const ioFinal = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) visibles.add(e.target.id);
        else visibles.delete(e.target.id);
      }
      setEnFinal(visibles.size > 0);
    });
    for (const id of IDS_FINALES) {
      const el = document.getElementById(id);
      if (el) ioFinal.observe(el);
    }

    return () => {
      ioHero.disconnect();
      ioFinal.disconnect();
    };
  }, []);

  const visible = heroPasado && !enFinal;

  return (
    <div
      className={`lg:hidden absolute inset-x-0 bottom-0 z-[100] pl-[4.75rem] pr-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white/95 to-white/0 dark:from-zinc-900 dark:via-zinc-900/95 dark:to-zinc-900/0 transition-[transform,opacity] duration-300 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
      // Escondida: fuera del orden de tabulacion y de lectores de pantalla.
      inert={!visible}
    >
      <Link
        href="/signup"
        tabIndex={visible ? 0 : -1}
        className={`${CAPSULA} ${PRINCIPAL} h-12 w-full text-base shadow-lg`}
      >
        {t("landing.hero.ctaBarra")}
        <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
      </Link>
    </div>
  );
}
