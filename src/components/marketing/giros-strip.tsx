"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import { GIROS_FRANJA, giroPorSlug, rutaGiro, type Giro } from "@/features/marketing/giros";
import { easeOutShort, staggerContainerFast, fadeInUpSmall } from "./animations";

/**
 * Franja de giros, lo primero de la landing (encima del hero): el visitante se
 * reconoce ("esto es para mi papeleria") antes de leer una sola funcion.
 *
 * Cada icono lleva a la pagina de su giro; "Otros" baja al catalogo completo
 * (`#giros`, en `GirosCatalog`). Las paginas por giro existen solo en español
 * (el mercado es Mexico), asi que el enlace va a /es aunque se vea en ingles.
 *
 * EN CELULAR SE VEN 5 DE 12, y el ultimo visible queda completo: parecia que
 * la lista terminaba ahi. Por eso, SOLO cuando la lista desborda:
 *   - se "asoma" una vez al aparecer (se desliza un poco y regresa),
 *   - un degradado en el borde marca que hay mas contenido,
 *   - una flecha con vaiven invita a deslizar (y desliza al tocarla).
 * En escritorio caben todos y nada de esto se dibuja.
 */

const CLAVE_ASOMO = "symvora_giros_asomo";

export function GirosStrip() {
  const locale = useLocale();
  const reducirMovimiento = useReducedMotion();
  const giros = GIROS_FRANJA.map((slug) => giroPorSlug(slug)).filter(
    (g): g is Giro => Boolean(g)
  );

  const listaRef = useRef<HTMLUListElement>(null);
  const interactuo = useRef(false);
  const [hayIzquierda, setHayIzquierda] = useState(false);
  const [hayDerecha, setHayDerecha] = useState(false);
  const [usuarioDeslizo, setUsuarioDeslizo] = useState(false);

  // Que queda por ver a cada lado. Se recalcula al desplazar y al cambiar el
  // tamaño; el ResizeObserver dispara tambien al observar, asi que da la
  // medida inicial sin un setState dentro del cuerpo del efecto.
  const medir = useCallback(() => {
    const el = listaRef.current;
    if (!el) return;
    const margen = 4; // redondeos de subpixel
    setHayIzquierda(el.scrollLeft > margen);
    setHayDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - margen);
  }, []);

  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir]);

  // El asomo: una vez por visita, solo si hay desborde, sin movimiento
  // reducido y sin que el usuario haya tocado ya la franja.
  useEffect(() => {
    const el = listaRef.current;
    if (!el || reducirMovimiento) return;

    let yaSeAsomo = false;
    try {
      yaSeAsomo = window.sessionStorage.getItem(CLAVE_ASOMO) === "1";
    } catch {
      // Almacenamiento bloqueado: se asoma igual, no pasa nada por repetirlo.
    }
    if (yaSeAsomo) return;

    const temporizadores: number[] = [];
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        io.disconnect();
        temporizadores.push(
          window.setTimeout(() => {
            if (interactuo.current || el.scrollWidth <= el.clientWidth) return;
            el.scrollBy({ left: 64, behavior: "smooth" });
            try {
              window.sessionStorage.setItem(CLAVE_ASOMO, "1");
            } catch {
              // Sin almacenamiento solo se pierde el "una vez por visita".
            }
            temporizadores.push(
              window.setTimeout(() => {
                if (!interactuo.current) el.scrollTo({ left: 0, behavior: "smooth" });
              }, 650)
            );
          }, 700)
        );
      },
      { threshold: 0.6 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      temporizadores.forEach((t) => window.clearTimeout(t));
    };
  }, [reducirMovimiento]);

  const alInteractuar = () => {
    interactuo.current = true;
    setUsuarioDeslizo(true);
  };

  const deslizar = () => {
    const el = listaRef.current;
    if (!el) return;
    interactuo.current = true;
    el.scrollBy({ left: Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section
      aria-label={locale === "en" ? "Business types" : "Giros comerciales"}
      className="w-full pt-2 pb-4 sm:pb-5 border-b border-neutral-100 dark:border-neutral-800"
    >
      <div className="relative max-w-7xl mx-auto">
        <motion.ul
          ref={listaRef}
          variants={staggerContainerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          onScroll={medir}
          onPointerDown={alInteractuar}
          onTouchStart={alInteractuar}
          onWheel={alInteractuar}
          // Celular: desplazamiento horizontal. Escritorio: UNA fila centrada; con
          // 92 px por elemento los 12 no cabian y "Otros" se bajaba de linea.
          className="px-4 sm:px-6 flex gap-1 sm:gap-2 lg:gap-1 overflow-x-auto scrollbar-hide lg:justify-center snap-x"
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

        {/* Degradados: hay mas contenido de ese lado. Del color del fondo del
            marco de la landing (blanco / zinc-900). */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white dark:from-zinc-900 to-transparent transition-opacity duration-300 ${
            hayIzquierda ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent transition-opacity duration-300 ${
            hayDerecha ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Flecha con vaiven: invita a deslizar y desliza al tocarla. Se va al
            llegar al final o en cuanto el usuario desliza por su cuenta. */}
        {hayDerecha && !usuarioDeslizo && (
          <motion.button
            type="button"
            onClick={deslizar}
            aria-label={locale === "en" ? "See more business types" : "Ver más giros"}
            className="absolute right-1.5 top-[30px] sm:top-[32px] w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-neutral-700 shadow-md text-blue-600 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={reducirMovimiento ? { opacity: 1 } : { opacity: 1, x: [0, 5, 0] }}
            transition={
              reducirMovimiento
                ? { duration: 0.2 }
                : { opacity: { duration: 0.2 }, x: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }
            }
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </motion.button>
        )}
      </div>
    </section>
  );
}
