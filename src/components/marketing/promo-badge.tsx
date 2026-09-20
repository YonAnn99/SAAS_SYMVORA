"use client";

/**
 * Sello giratorio de la promocion de lanzamiento (-50% OFF).
 *
 * Acompana el scroll y se desvanece al llegar a la card de precios, donde el
 * descuento ya se explica con el numero tachado: mantenerlo ahi seria repetir
 * el mismo mensaje encima de su propia explicacion.
 *
 * TRES DECISIONES QUE PARECEN DETALLE Y NO LO SON:
 *
 * 1. Gira el SVG, no el conjunto. Si girase el bloque entero, "-50% OFF"
 *    quedaria del reves la mitad del tiempo.
 * 2. Va `absolute` DENTRO del marco (hermano del `<main>` que scrollea), no
 *    `fixed` dentro del hero. El hero es `overflow-hidden` y es un
 *    `motion.section`: mientras anima lleva un `transform`, que lo convierte en
 *    bloque contenedor de sus descendientes fijos y recortaria el sello. Como
 *    hermano del contenedor de scroll se queda quieto sin ese riesgo y respeta
 *    el marco negro de la pagina.
 * 3. Si no hay `#pricing` en la pagina no se dibuja: un sello que promete un
 *    precio y no lleva a ningun sitio es peor que no tenerlo.
 *
 * POR QUE EN MOVIL BAJA (`top-24` frente a `md:top-16`). Por debajo de `md` la
 * cabecera es el menu burbuja, cuyo boton es `w-12 h-12` anclado en `top-6`: va
 * al mismo borde derecho y llega hasta los 72px. Con el sello a 64px se pisaban,
 * y como el menu lleva `z-[1001]` el sello asomaba por debajo. No es un ajuste
 * estetico: subirlo en movil vuelve a taparlo.
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { PROMO_LANZAMIENTO } from "@/lib/pricing";

// Estrella de 22 puntas, generada sobre un viewBox de 100x100.
const ESTRELLA =
  "M50.00 1.00L55.83 9.42L63.80 2.98L67.03 12.71L76.49 8.78L76.85 19.01L87.03 17.91L84.49 27.83L94.57 29.64L89.34 38.45L98.50 43.03L91.00 50.00L98.50 56.97L89.34 61.55L94.57 70.36L84.49 72.17L87.03 82.09L76.85 80.99L76.49 91.22L67.03 87.29L63.80 97.02L55.83 90.58L50.00 99.00L44.17 90.58L36.20 97.02L32.97 87.29L23.51 91.22L23.15 80.99L12.97 82.09L15.51 72.17L5.43 70.36L10.66 61.55L1.50 56.97L9.00 50.00L1.50 43.03L10.66 38.45L5.43 29.64L15.51 27.83L12.97 17.91L23.15 19.01L23.51 8.78L32.97 12.71L36.20 2.98L44.17 9.42Z";

export function PromoBadge() {
  const t = useTranslations("landing.promo");
  const reduceMotion = useReducedMotion();
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
      onClick={(e) => {
        // El salto por defecto del ancla NO funciona aqui: `motion.a` se traga
        // el click (comprobado en pantalla, el hash ni siquiera cambiaba) y,
        // ademas, quien scrollea no es la ventana sino el `<main>` del marco.
        // Se desplaza a mano con el mismo helper que usa la navegacion de la
        // landing. El `href` se conserva para el clic con rueda y para que un
        // lector de pantalla anuncie un enlace, no un boton disfrazado.
        e.preventDefault();
        document
          .getElementById("pricing")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      aria-label={t("aria")}
      aria-hidden={enPrecios}
      tabIndex={enPrecios ? -1 : undefined}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: enPrecios ? 0 : 1,
        scale: enPrecios ? 0.8 : 1,
      }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className={`absolute right-6 top-24 z-30 grid h-20 w-20 place-items-center md:right-6 md:top-16 md:h-24 md:w-24 lg:right-10 lg:top-20 ${
        enPrecios ? "pointer-events-none" : ""
      }`}
    >
      {/* Solo la estrella gira. */}
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

      {/* El texto se queda quieto por encima. */}
      <span className="relative select-none text-center text-[11px] font-extrabold leading-none tracking-tight text-white md:text-[13px]">
        {t("badge")}
      </span>
    </motion.a>
  );
}
