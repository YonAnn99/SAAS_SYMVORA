import type { Metadata } from "next";
import { SALES_WHATSAPP } from "@/lib/contact";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, ToggleRight } from "lucide-react";
import {
  CAPSULA,
  CAPSULA_GRANDE,
  CLARA,
  FLECHA_CAPSULA,
  PRINCIPAL,
  WHATSAPP_CONTORNO,
} from "@/components/marketing/boton-capsula";
import { WhatsAppLogo } from "@/components/marketing/whatsapp-logo";
import { AppFrame } from "@/components/ui/app-frame";
import Footer from "@/components/ui/footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { GirosCatalog } from "@/components/marketing/giros-catalog";
import {
  FUNCIONES,
  GIROS,
  MODULOS,
  giroPorSlug,
  rutaGiro,
  rutaRegistroGiro,
  type Giro,
} from "@/features/marketing/giros";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site";
import { DIAS_PRUEBA } from "@/lib/trial";
import { PROMO_LANZAMIENTO, SUBSCRIPTION_PRICE_MXN } from "@/lib/pricing";
import { urlWhatsApp } from "@/lib/whatsapp";

/**
 * Una pagina por giro: /es/punto-de-venta/papelerias, /es/punto-de-venta/farmacias…
 *
 * Existe para quien busca "punto de venta para papeleria": cae en una pagina
 * hecha para el, con los problemas de su giro y como los resuelve SYMVORA. El
 * contenido sale de `src/features/marketing/giros.ts`, que solo promete lo que
 * el sistema hace hoy.
 *
 * Solo en español (el mercado es Mexico). Se generan todas en build; cualquier
 * otra combinacion —otro idioma, un giro que no existe— responde 404.
 */

export const dynamicParams = false;

/** Mismo numero de ventas que el boton flotante, el CTA y las FAQ de la landing. */
const WHATSAPP_VENTAS = SALES_WHATSAPP;

export function generateStaticParams() {
  return GIROS.map((g) => ({ locale: "es", giro: g.slug }));
}

type Params = Promise<{ locale: string; giro: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { giro: slug } = await params;
  const giro = giroPorSlug(slug);
  if (!giro) return {};
  const titulo = `Punto de venta para ${giro.plural} | SYMVORA`;
  return {
    title: titulo,
    description: giro.resumen,
    alternates: { canonical: rutaGiro(giro.slug) },
    openGraph: {
      title: titulo,
      description: giro.resumen,
      url: `https://www.symvora.com.mx${rutaGiro(giro.slug)}`,
      locale: "es_MX",
      type: "website",
      siteName: "SYMVORA",
      images: [{ url: "/og-symvora.jpeg", width: 1200, height: 630, alt: titulo }],
    },
  };
}

/** Preguntas que valen para cualquier giro: precio y prueba. */
function faqsGenerales(giro: Giro) {
  const promo = PROMO_LANZAMIENTO.activa
    ? ` Por lanzamiento, los primeros ${PROMO_LANZAMIENTO.cobros} meses cuestan $${PROMO_LANZAMIENTO.precioCents / 100}.`
    : "";
  return [
    {
      pregunta: `¿Cuánto cuesta SYMVORA para ${giro.tu}?`,
      respuesta: `$${SUBSCRIPTION_PRICE_MXN.monthly} MXN al mes, o $${SUBSCRIPTION_PRICE_MXN.yearly.toLocaleString("es-MX")} MXN al año, sin comisiones por venta.${promo}`,
    },
    {
      pregunta: "¿Puedo probarlo antes de pagar?",
      respuesta: `Sí. Tienes ${DIAS_PRUEBA} días de prueba con todas las funciones, sin tarjeta. Funciona en computadora, tablet y celular desde el navegador.`,
    },
  ];
}

const SECCIONES = [
  { id: "que-es", titulo: (g: Giro) => `¿Qué es un punto de venta para ${g.plural.toLowerCase()}?` },
  { id: "beneficios", titulo: (g: Giro) => `Beneficios para ${g.tu}` },
  { id: "funciones", titulo: () => "Funciones del sistema" },
  { id: "modulos", titulo: () => "Módulos recomendados" },
  { id: "preguntas", titulo: () => "Preguntas frecuentes" },
  { id: "otros-giros", titulo: () => "Otros giros comerciales" },
];

export default async function GiroPage({ params }: { params: Params }) {
  const { locale, giro: slug } = await params;
  const giro = giroPorSlug(slug);
  if (locale !== "es" || !giro) notFound();

  const Icono = giro.icono;
  const siteUrl = getSiteUrl();
  const faqs = [...giro.faqs, ...faqsGenerales(giro)];
  const registro = rutaRegistroGiro(giro);
  const whatsapp = urlWhatsApp(
    WHATSAPP_VENTAS,
    `Hola, me interesa SYMVORA para ${giro.tu.replace(/^tu /, "mi ")}. ¿Me dan más información?`
  );

  return (
    <AppFrame inicio="/es">
      {/* ── Encabezado ── */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-14 sm:pb-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              <Link href="/es" className="hover:text-black dark:hover:text-white">Inicio</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <Link href="/es#giros" className="hover:text-black dark:hover:text-white">Giros</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-medium text-black dark:text-neutral-100">{giro.plural}</span>
            </nav>

            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-hidden="true" />
              Software para {giro.tu}
            </span>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-black dark:text-neutral-50 leading-[1.05]">
              Punto de venta para <span className="text-blue-600">{giro.plural}</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed">
              {giro.resumen}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href={registro}
                className={`${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL}`}
              >
                Prueba gratis {DIAS_PRUEBA} días
                <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
              </Link>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CAPSULA} ${CAPSULA_GRANDE} ${WHATSAPP_CONTORNO}`}
              >
                <WhatsAppLogo size={20} className="shrink-0" aria-hidden="true" />
                Escríbenos por WhatsApp
              </a>
            </div>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Sin tarjeta · Sin comisiones por venta · Usuarios ilimitados
            </p>
          </div>

          {/* Tarjeta de resumen: lo que el giro activa y usa */}
          <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center" aria-hidden="true">
                <Icono className="w-7 h-7" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-500">SYMVORA para</p>
                <p className="text-lg font-bold text-black dark:text-neutral-50">{giro.nombre.es}</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {giro.funciones.slice(0, 5).map((f) => {
                const F = FUNCIONES[f.clave];
                const I = F.icono;
                return (
                  <li key={f.clave} className="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 text-blue-600 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700" aria-hidden="true">
                      <I className="w-4 h-4" />
                    </span>
                    {F.titulo}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Índice ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 border-t border-neutral-100 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-500">En esta página</p>
          <h2 className="mt-2 text-center text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">Índice de contenido</h2>
          <ol className="mt-8 grid sm:grid-cols-2 gap-3">
            {SECCIONES.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-4 transition-colors hover:border-blue-400"
                >
                  <span className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-blue-600 flex items-center justify-center shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm sm:text-base font-semibold text-black dark:text-neutral-100">{s.titulo(giro)}</span>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-16 sm:space-y-20 py-10">
          {/* ── ¿Qué es? ── */}
          <section id="que-es" className="scroll-mt-28">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">{SECCIONES[0].titulo(giro)}</h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">{giro.queEs}</p>
          </section>

          {/* ── Beneficios ── */}
          <section id="beneficios" className="scroll-mt-28">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">{SECCIONES[1].titulo(giro)}</h2>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {giro.beneficios.map((b) => (
                <div key={b.titulo} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-black dark:text-neutral-50">{b.titulo}</h3>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{b.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Funciones ── */}
          <section id="funciones" className="scroll-mt-28">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">Funciones del sistema</h2>
            <ul className="mt-6 space-y-3">
              {giro.funciones.map((f) => {
                const F = FUNCIONES[f.clave];
                const I = F.icono;
                return (
                  <li key={f.clave} className="flex gap-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5">
                    <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0" aria-hidden="true">
                      <I className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-black dark:text-neutral-50">{F.titulo}</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{f.texto}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ── Módulos recomendados ── */}
          <section id="modulos" className="scroll-mt-28">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">Módulos recomendados</h2>
            <p className="mt-3 text-neutral-600 dark:text-neutral-300">
              Punto de venta, inventario, compras, caja y reportes vienen incluidos. Para {giro.tu} te
              recomendamos encender también estos módulos en <strong>Configuración → Módulos</strong>; se
              activan con un clic y puedes cambiarlos cuando quieras:
            </p>
            <ul className="mt-5 grid sm:grid-cols-2 gap-3">
              {giro.modulos.map((m) => (
                <li key={m} className="flex items-center gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 px-4 py-3 text-sm font-medium text-black dark:text-neutral-100">
                  <ToggleRight className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                  {MODULOS[m]}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Preguntas frecuentes ── */}
          <section id="preguntas" className="scroll-mt-28">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">Preguntas frecuentes</h2>
            <div className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
              {faqs.map((f) => (
                <details key={f.pregunta} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-black dark:text-neutral-50">
                    {f.pregunta}
                    <ChevronRight className="w-4 h-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">{f.respuesta}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Otros giros ── */}
      <div className="border-t border-neutral-100 dark:border-neutral-800">
        <GirosCatalog
          id="otros-giros"
          excluir={giro.slug}
          titulo="Explora otros giros comerciales"
          subtitulo="Descubre cómo SYMVORA se adapta a cada tipo de negocio."
        />
      </div>

      {/* ── Cierre ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto rounded-3xl bg-zinc-950 text-white px-6 py-12 sm:px-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Empieza hoy con {giro.tu}</h2>
          <p className="mt-3 text-zinc-400">
            {DIAS_PRUEBA} días gratis, sin tarjeta. Configura tu catálogo y haz tu primera venta en minutos.
          </p>
          <Link
            href={registro}
            className={`mt-7 ${CAPSULA} ${CAPSULA_GRANDE} ${CLARA}`}
          >
            Crear mi cuenta gratis
            <ArrowRight className={`w-5 h-5 ${FLECHA_CAPSULA}`} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Footer />

      <JsonLd
        id="ld-faq-giro"
        data={faqPageSchema(
          siteUrl,
          faqs.map((f) => ({ question: f.pregunta, answer: f.respuesta })),
          rutaGiro(giro.slug)
        )}
      />
      <JsonLd
        id="ld-breadcrumb-giro"
        data={breadcrumbSchema(siteUrl, [
          { nombre: "Inicio", ruta: "/es" },
          { nombre: "Giros", ruta: "/es#giros" },
          { nombre: giro.plural, ruta: rutaGiro(giro.slug) },
        ])}
      />
    </AppFrame>
  );
}
