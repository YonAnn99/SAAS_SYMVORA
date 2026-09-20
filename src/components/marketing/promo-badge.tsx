"use client";

/**
 * Sello giratorio de la promocion de lanzamiento (-50% OFF).
 *
 * VIVE EN DOS SITIOS SEGUN EL ANCHO, y no es un capricho de maquetacion.
 *
 *   - Escritorio (`md` y arriba): `PromoBadge`, flotante en la esquina superior
 *     derecha del marco. Acompana el scroll y se desvanece al llegar a la card
 *     de precios, donde el descuento ya se explica con el numero tachado.
 *   - Movil (por debajo de `md`): `PromoBadgeEnLinea`, dentro del hero, encima
 *     del titular y en el flujo normal.
 *
 * POR QUE NO VALE EL MISMO EN MOVIL. El flotante es `absolute` y hermano del
 * `<main>` que scrollea, asi que se queda clavado en la pantalla mientras el
 * contenido pasa por debajo. En un monitor eso es una ventaja: vive en el margen
 * muerto de la derecha. En un telefono NO HAY margen muerto, asi que se ponga
 * donde se ponga acabara encima de algo — y encima del titular del hero es donde
 * estaba, tapandolo. Moverlo unos pixeles no lo arregla; sacarlo del aire, si.
 *
 * El corte es por CSS (`hidden md:grid` / `md:hidden`) y NO por JavaScript:
 * decidir el ancho en JS obliga a esperar al montaje, lo que provoca un salto
 * visible y riesgo de desajuste de hidratacion.
 *
 * DOS DETALLES COMUNES QUE PARECEN MENORES Y NO LO SON:
 *
 * 1. Gira el SVG, no el conjunto. Si girase el bloque entero, "-50% OFF"
 *    quedaria del reves la mitad del tiempo.
 * 2. El salto del ancla se hace a mano. El comportamiento por defecto de
 *    `href="#pricing"` no funciona en esta landing: quien scrollea es el
 *    `<main>` del marco, no la ventana (y ademas `motion.a` se traga el click,
 *    comprobado en pantalla: el hash ni siquiera cambiaba).
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { PROMO_LANZAMIENTO } from "@/lib/pricing";

// Estrella de 22 puntas, generada sobre un viewBox de 100x100.
const ESTRELLA =
  "M50.00 1.00L55.83 9.42L63.80 2.98L67.03 12.71L76.49 8.78L76.85 19.01L87.03 17.91L84.49 27.83L94.57 29.64L89.34 38.45L98.50 43.03L91.00 50.00L98.50 56.97L89.34 61.55L94.57 70.36L84.49 72.17L87.03 82.09L76.85 80.99L76.49 91.22L67.03 87.29L63.80 97.02L55.83 90.58L50.00 99.00L44.17 90.58L36.20 97.02L32.97 87.29L23.51 91.22L23.15 80.99L12.97 82.09L15.51 72.17L5.43 70.36L10.66 61.55L1.50 56.97L9.00 50.00L1.50 43.03L10.66 38.45L5.43 29.64L15.51 27.83L12.97 17.91L23.15 19.01L23.51 8.78L32.97 12.71L36.20 2.98L44.17 9.42Z";

/** Baja hasta la card de precios. Ver la nota 2 de la cabecera. */
function irAPrecios(e: React.MouseEvent) {
  e.preventDefault();
  document
    .getElementById("pricing")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * El dibujo: la estrella que gira y el texto quieto encima.
 *
 * No lleva posicionamiento ni tamano — los pone quien lo usa, que es lo unico
 * en lo que se diferencian las dos variantes.
 */
function Estrella({ textoClassName }: { textoClassName: string }) {
  const t = useTranslations("landing.promo");
  const reduceMotion = useReducedMotion();

  return (
    <>
      <motion.svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full drop-shadow-lg"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={
          reduceMotion
            ? undefined
            : { repeat: Infinity, duration: 14, ease: "linear" }
        }
      >
        <path d={ESTRELLA} fill="#dc2626" stroke="#ffffff" strokeWidth="3" />
      </motion.svg>

      <span
        className={`relative select-none text-center font-extrabold leading-none tracking-tight text-white ${textoClassName}`}
      >
        {t("badge")}
      </span>
    </>
  );
}

/**
 * Variante flotante, solo de `md` hacia arriba.
 *
 * Se monta en `AppFrame` como hermano del `<main>`, no dentro del hero: el hero
 * es `overflow-hidden` y es un `motion.section`, asi que mientras anima lleva un
 * `transform` que lo convierte en bloque contenedor de sus descendientes fijos
 * y recortaria el sello.
 *
 * Si no hay `#pricing` en la pagina no se dibuja: un sello que promete un precio
 * y no lleva a ningun sitio es peor que no tenerlo.
 */
export function PromoBadge() {
  const t = useTranslations("landing.promo");
  const [visible, setVisible] = useState(false);
  const [enPrecios, setEnPrecios] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;

    // Diferido con setTimeout, convencion del repo: llamar a setState de forma
    // sincrona dentro del efecto encadena renders y lo marca
    // `react-hooks/set-state-in-effect`.
    const t0 = window.setTimeout(() => {
      const precios = document.getElementById("pricing");
      if (!precios) return;

      setVisible(true);

      // Sobre el viewport (`root: null`) y no sobre el contenedor de scroll: el
      // `<main>` ocupa la ventana entera menos el marco, asi que es el mismo
      // recorte, y evita tener que pasar su ref por media landing.
      observer = new IntersectionObserver(
        ([entrada]) => setEnPrecios(entrada.isIntersecting),
        { threshold: 0.15 }
      );
      observer.observe(precios);
    }, 0);

    return () => {
      window.clearTimeout(t0);
      observer?.disconnect();
    };
  }, []);

  if (!PROMO_LANZAMIENTO.activa || !visible) return null;

  return (
    <motion.a
      href="#pricing"
      onClick={irAPrecios}
      aria-label={t("aria")}
      aria-hidden={enPrecios}
      tabIndex={enPrecios ? -1 : undefined}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: enPrecios ? 0 : 1, scale: enPrecios ? 0.8 : 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className={`absolute right-6 top-16 z-30 hidden h-24 w-24 place-items-center md:grid lg:right-10 lg:top-20 ${
        enPrecios ? "pointer-events-none" : ""
      }`}
    >
      <Estrella textoClassName="text-[13px]" />
    </motion.a>
  );
}

/**
 * Variante en linea, solo por debajo de `md`. Se monta dentro del hero.
 *
 * TRES DIFERENCIAS DELIBERADAS CON LA FLOTANTE, que no son descuidos:
 *
 *   - Sin `IntersectionObserver` ni desvanecido: se desplaza con la pagina, asi
 *     que desaparece solo al subir el hero. Observar `#pricing` aqui seria
 *     codigo que no hace nada.
 *   - Sin esperar a que exista `#pricing`. La flotante arranca invisible y se
 *     muestra desde un efecto; hacer eso aqui empujaria el titular casi cien
 *     pixeles hacia abajo DESPUES de pintar, con el salto de maquetacion a la
 *     vista. Esta se renderiza directa desde el servidor.
 *   - Mas pequena (64px): compite por el ancho con el titular, no con un margen
 *     vacio.
 */
export function PromoBadgeEnLinea() {
  const t = useTranslations("landing.promo");

  if (!PROMO_LANZAMIENTO.activa) return null;

  return (
    <motion.a
      href="#pricing"
      onClick={irAPrecios}
      aria-label={t("aria")}
      whileTap={{ scale: 0.95 }}
      className="relative grid h-16 w-16 shrink-0 place-items-center self-start md:hidden"
    >
      <Estrella textoClassName="text-[10px]" />
    </motion.a>
  );
}
