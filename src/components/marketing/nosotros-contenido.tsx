import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  Check,
  Compass,
  Eye,
  Handshake,
  Lightbulb,
  Quote,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AboutUs } from "@/components/marketing/about-us";
import { Carrusel } from "@/components/ui/carrusel";
import {
  CAPSULA,
  CAPSULA_GRANDE,
  FLECHA_CAPSULA,
  PRINCIPAL,
  SECUNDARIA,
} from "@/components/marketing/boton-capsula";
import {
  ESENCIA,
  ESLOGAN,
  FILOSOFIA,
  IDEA_CENTRAL,
  LINEAS,
  NOMBRE,
  PILARES,
  PROPUESTA,
  VALORES,
  type LineaSolucion,
  type Pilar,
  type Valor,
} from "@/features/marketing/nosotros";

/**
 * /es/nosotros: quienes somos. El texto vive en `features/marketing/nosotros.ts`;
 * aqui solo la maquetacion, con el lenguaje visual de la landing (insignia azul
 * en capsula, tarjetas con borde neutro, claro y oscuro).
 */

const ICONO_PILAR: Record<Pilar["id"], LucideIcon> = {
  proposito: Compass,
  mision: Target,
  vision: Eye,
};

const ICONO_VALOR: Record<Valor["id"], LucideIcon> = {
  innovacion: Lightbulb,
  evolucion: TrendingUp,
  compromiso: Handshake,
  colaboracion: Users,
  calidad: BadgeCheck,
  adaptabilidad: RefreshCw,
  "vision-empresarial": Building2,
};

const ICONO_LINEA: Record<LineaSolucion["id"], LucideIcon> = {
  pos: ShoppingCart,
  empresarial: Blocks,
  automatizacion: Workflow,
  personalizado: Wrench,
};

const TARJETA =
  "rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-6 sm:p-7";
const ICONO_CAJA =
  "flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400";

function Encabezado({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-black dark:text-neutral-50">
        {titulo}
      </h2>
      {texto && (
        <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {texto}
        </p>
      )}
    </div>
  );
}

export function NosotrosContenido() {
  return (
    <>
      {/* Portada: eslogan y esencia de la marca. */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center entrada-suave">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-black dark:text-neutral-50 leading-[1.05]">
            {ESLOGAN}
          </h1>
          <div className="mt-6 space-y-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {ESENCIA.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Significado del nombre: SYM · VOR · A. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <Encabezado
            titulo="¿Qué significa SYMVORA?"
            texto="Un nombre creado que representa la filosofía de la empresa."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {NOMBRE.partes.map((parte) => (
              <article key={parte.silaba} className={TARJETA}>
                <p className="text-5xl font-bold tracking-tight text-[#1e3a8a] dark:text-blue-400">
                  {parte.silaba}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {parte.inspiracion}
                </p>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {parte.texto}
                </p>
              </article>
            ))}
          </div>
          <blockquote className="mt-6 rounded-3xl bg-zinc-950 dark:bg-white/[0.04] dark:border dark:border-neutral-800 px-6 py-8 sm:px-10 text-center">
            <p className="text-lg sm:text-2xl font-semibold tracking-tight text-white leading-snug">
              {NOMBRE.concepto}
            </p>
          </blockquote>
        </div>
      </section>

      {/* Proposito, mision y vision. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto grid gap-4 lg:grid-cols-3">
          {PILARES.map((pilar) => {
            const Icono = ICONO_PILAR[pilar.id];
            return (
              <article key={pilar.id} className={`${TARJETA} flex flex-col`}>
                <span className={ICONO_CAJA}>
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-bold text-black dark:text-neutral-50">{pilar.titulo}</h2>
                <p className="mt-3 text-base text-neutral-800 dark:text-neutral-200 leading-relaxed">
                  {pilar.destacado}
                </p>
                {pilar.detalle && (
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {pilar.detalle}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Valores: carrusel de React Bits (se arrastra, avanza solo y gira en 3D). */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Encabezado
              titulo="Lo que nos guía"
              texto="Siete valores que están detrás de cada decisión y de cada línea de código."
            />
            <ul className="mt-6 hidden flex-wrap gap-2 lg:flex" aria-hidden="true">
              {VALORES.map((valor) => (
                <li
                  key={valor.id}
                  className="text-sm text-neutral-500 dark:text-neutral-400 after:ml-2 after:text-neutral-300 after:content-['·'] last:after:content-none dark:after:text-neutral-700"
                >
                  {valor.titulo}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <Carrusel
              className="w-full"
              anchoMaximo={460}
              items={VALORES.map((valor) => {
                const Icono = ICONO_VALOR[valor.id];
                return {
                  id: valor.id,
                  titulo: valor.titulo,
                  texto: valor.texto,
                  icono: <Icono className="h-5 w-5" aria-hidden="true" />,
                };
              })}
            />
          </div>
        </div>
      </section>

      {/* Propuesta de valor. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto rounded-[32px] border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 px-6 py-10 sm:px-12 sm:py-14">
          <p className="max-w-3xl text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-neutral-50 leading-snug">
            {PROPUESTA.frase}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {PROPUESTA.formula.map((pieza, i) => (
              <span key={pieza} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-lg font-bold text-neutral-400" aria-hidden="true">
                    +
                  </span>
                )}
                <span className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-black dark:text-neutral-100">
                  {pieza}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {PROPUESTA.cierre}
          </p>
        </div>
      </section>

      {/* Lineas de solucion (sin Desarrollo web ni IA, a proposito). */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <Encabezado
            titulo="Hacia dónde evoluciona SYMVORA"
            texto="El punto de venta es nuestro primer producto. Nuestra oferta crece progresivamente hacia más áreas del negocio."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {LINEAS.map((linea) => {
              const Icono = ICONO_LINEA[linea.id];
              return (
                <article
                  key={linea.id}
                  className={`${TARJETA} ${linea.disponible ? "ring-2 ring-[#1e3a8a]/60 dark:ring-blue-500/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={ICONO_CAJA}>
                      <Icono className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-black dark:text-neutral-50">{linea.titulo}</h3>
                  {linea.texto && (
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {linea.texto}
                    </p>
                  )}
                  {linea.puntos.length > 0 && (
                    <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {linea.puntos.map((punto) => (
                        <li key={punto} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          {punto}
                        </li>
                      ))}
                    </ul>
                  )}
                  {linea.disponible && (
                    <Link
                      href="/es#features"
                      className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a] dark:text-blue-400 hover:underline"
                    >
                      Conoce el punto de venta
                      <ArrowRight className={`h-4 w-4 ${FLECHA_CAPSULA}`} aria-hidden="true" />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filosofia. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <Quote className="mx-auto h-8 w-8 text-blue-600/70 dark:text-blue-400/70" aria-hidden="true" />
          <p className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight text-black dark:text-neutral-50 leading-tight">
            {FILOSOFIA.cita}
          </p>
          <div className="mt-6 space-y-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {FILOSOFIA.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Orgullosamente mexicanos (antes al final de la landing). */}
      <AboutUs />

      {/* Cierre: la idea central. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto rounded-[32px] bg-zinc-950 dark:bg-white/[0.04] dark:border dark:border-neutral-800 px-6 py-12 sm:px-12 sm:py-16 text-center">
          <div className="mx-auto max-w-3xl space-y-3 text-base sm:text-lg text-zinc-300 leading-relaxed">
            {IDEA_CENTRAL.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <p className="mt-8 text-3xl sm:text-5xl font-bold tracking-tight text-white">
            “{IDEA_CENTRAL.cita}”
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className={`${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL} w-full sm:w-auto`}>
              Prueba gratis
              <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
            </Link>
            <Link href="/es#footer-contacto" className={`${CAPSULA} ${CAPSULA_GRANDE} ${SECUNDARIA} w-full sm:w-auto`}>
              Contáctanos
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
