"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { GIROS, GIROS_FRANJA, giroPorSlug, rutaGiro, type Giro } from "@/features/marketing/giros";
import { ETIQUETA_GIRO, RECUADRO_GIRO, TRAZO_GIRO } from "./giro-estilos";
import { easeOutShort, staggerContainerFast, fadeInUpSmall } from "./animations";

/**
 * Franja de giros, lo primero de la landing (encima del hero): el visitante se
 * reconoce ("esto es para mi papeleria") antes de leer una sola funcion.
 *
 * Cada icono lleva a la pagina de su giro; "Ver los 20" baja al catalogo
 * completo (`#giros`, en `GirosCatalog`). Estilo minimalista (skill
 * `minimalist-ui`): monocromo calido, iconos de linea 1.8 y sin color de marca. Las paginas por giro existen solo en español
 * (el mercado es Mexico), asi que el enlace va a /es aunque se vea en ingles.
 *
 * EN CELULAR SE VEN 5 DE 11, y el ultimo visible queda completo: parecia que
 * la lista terminaba ahi. Por eso, SOLO cuando la lista desborda:
 *   - se "asoma" una vez al aparecer (se desliza un poco y regresa),
 *   - un degradado en el borde marca que hay mas contenido,
 *   - una flecha con vaiven invita a deslizar (y desliza al tocarla).
 * En escritorio caben todos y nada de esto se dibuja.
 */

const CLAVE_ASOMO = "symvora_giros_asomo";

/** Nombres cortos solo para la franja: con etiquetas parejas la fila respira. */
const ETIQUETA_CORTA: Record<string, { es: string; en: string }> = {
  "tiendas-de-ropa": { es: "Ropa", en: "Clothing" },
};

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

  const verTodos = locale === "en" ? `See all ${GIROS.length}` : `Ver los ${GIROS.length}`;

  return (
    <section
      aria-label={locale === "en" ? "Business types" : "Giros comerciales"}
      className="w-full pt-2 border-b border-[#EAEAEA] dark:border-white/[0.08] lg:border-b-0"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Celular: la etiqueta y "Ver los 20" van arriba de la franja. */}
        <div className="flex items-baseline justify-between pb-2.5 lg:hidden">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#787774] dark:text-[#9A9791]">
            {locale === "en" ? "For your business" : "Para tu giro"}
          </span>
          <a
            href="#giros"
            className="text-[13px] font-semibold text-[#111111] dark:text-[#F5F4F0] hover:text-[#333333] dark:hover:text-white"
          >
            {verTodos} →
          </a>
        </div>

        <div className="flex items-center gap-7 pb-4 lg:pb-[22px] lg:border-b border-[#EAEAEA] dark:border-white/[0.08]">
          {/* Escritorio: etiqueta a la izquierda de la fila. */}
          <div className="hidden lg:flex w-[104px] shrink-0 flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#787774] dark:text-[#9A9791]">
              {locale === "en" ? "For your business" : "Para tu giro"}
            </span>
            <span className="text-[13px] leading-snug text-[#2F3437] dark:text-[#CFCCC6]">
              {locale === "en" ? "Set up for what you sell" : "Configurado para lo que vendes"}
            </span>
          </div>

          <div className="relative flex-1 min-w-0 -mx-4 sm:-mx-6 lg:mx-0">
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
              // Celular: desplazamiento horizontal de borde a borde. Escritorio:
              // UNA fila repartida entre la etiqueta y "Ver los 20".
              // `pt-1.5` (compensado con `-mt-1.5`): `overflow-x-auto` obliga a
              // recortar tambien en vertical, y sin ese margen el icono se
              // cortaba por arriba al subir con el hover.
              className="-mt-1.5 pt-1.5 px-4 sm:px-6 lg:px-0 flex gap-1 lg:gap-1.5 overflow-x-auto scrollbar-hide lg:justify-between snap-x"
            >
              {giros.map((giro) => {
                const Icono = giro.icono;
                const idioma = locale === "en" ? "en" : "es";
                return (
                  <motion.li key={giro.slug} variants={fadeInUpSmall} transition={easeOutShort} className="snap-start shrink-0">
                    <Link
                      href={rutaGiro(giro.slug)}
                      className="group flex w-[70px] lg:w-[72px] flex-col items-center gap-2 lg:gap-[9px] rounded-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    >
                      <span
                        className={`w-12 h-12 lg:w-[46px] lg:h-[46px] ${RECUADRO_GIRO}`}
                        aria-hidden="true"
                      >
                        <Icono className="w-[22px] h-[22px]" strokeWidth={TRAZO_GIRO} />
                      </span>
                      <span className={`text-xs font-medium ${ETIQUETA_GIRO}`}>
                        {ETIQUETA_CORTA[giro.slug]?.[idioma] ?? giro.nombre[idioma]}
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
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
              className={`pointer-events-none absolute inset-y-0 right-0 w-[72px] bg-gradient-to-l from-white from-30% dark:from-zinc-900 to-transparent transition-opacity duration-300 ${
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
                className="absolute right-2.5 top-1.5 w-9 h-9 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#EAEAEA] dark:border-white/[0.08] text-[#111111] dark:text-[#F5F4F0] flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={reducirMovimiento ? { opacity: 1 } : { opacity: 1, x: [0, 5, 0] }}
                transition={
                  reducirMovimiento
                    ? { duration: 0.2 }
                    : { opacity: { duration: 0.2 }, x: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }
                }
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              </motion.button>
            )}
          </div>

          {/* Escritorio: el catalogo completo, en lugar del antiguo circulo "+ Otros". */}
          <a
            href="#giros"
            className="hidden lg:flex shrink-0 items-center gap-1.5 rounded-md border border-[#EAEAEA] dark:border-white/[0.08] bg-white dark:bg-[#1E1E1E] px-3.5 py-2.5 text-[13px] font-semibold text-[#111111] dark:text-[#F5F4F0] transition-colors hover:border-[#CFCDC8] dark:hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            {verTodos}
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
