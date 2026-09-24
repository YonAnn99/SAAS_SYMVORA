import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, Lightbulb } from "lucide-react";
import { AppFrame } from "@/components/ui/app-frame";
import Footer from "@/components/ui/footer";
import { JsonLd } from "@/components/marketing/json-ld";
import {
  GUIAS,
  guiaPorSlug,
  idYoutube,
  rutaGuia,
} from "@/features/marketing/aprende";
import { breadcrumbSchema, howToSchema } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site";
import { DIAS_PRUEBA } from "@/lib/trial";

/**
 * Una guia por modulo: /es/aprende/punto-de-venta, /es/aprende/caja-y-finanzas…
 * El contenido sale de `src/features/marketing/aprende.ts`. Solo en español; se
 * generan todas en build y cualquier otra combinacion responde 404.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIAS.map((g) => ({ locale: "es", guia: g.slug }));
}

type Params = Promise<{ locale: string; guia: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { guia: slug } = await params;
  const guia = guiaPorSlug(slug);
  if (!guia) return {};
  const titulo = `${guia.titulo}: guía paso a paso | Aprende SYMVORA`;
  return {
    title: titulo,
    description: guia.resumen,
    alternates: { canonical: rutaGuia(guia.slug) },
    openGraph: {
      title: titulo,
      description: guia.resumen,
      url: `https://www.symvora.com.mx${rutaGuia(guia.slug)}`,
      locale: "es_MX",
      type: "article",
      siteName: "SYMVORA",
      images: [{ url: "/og-symvora.jpeg", width: 1200, height: 630, alt: titulo }],
    },
  };
}

export default async function GuiaPage({ params }: { params: Params }) {
  const { locale, guia: slug } = await params;
  const guia = guiaPorSlug(slug);
  if (locale !== "es" || !guia) notFound();

  const Icono = guia.icono;
  const siteUrl = getSiteUrl();
  const video = idYoutube(guia.videoYoutube);
  const relacionadas = guia.relacionadas
    .map((s) => guiaPorSlug(s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  // Numeracion continua de los pasos en toda la guia: "Paso 4" se entiende
  // aunque este en la segunda seccion. `inicio[i]` = pasos antes de la seccion i.
  const inicio = guia.secciones.map((_, i) =>
    guia.secciones.slice(0, i).reduce((n, s) => n + s.pasos.length, 0)
  );

  return (
    <AppFrame inicio="/es">
      <article className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16">
        <div className="max-w-6xl mx-auto">
          <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            <Link href="/es" className="hover:text-black dark:hover:text-white">Inicio</Link>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <Link href={rutaGuia()} className="hover:text-black dark:hover:text-white">Aprende</Link>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-medium text-black dark:text-neutral-100">{guia.titulo}</span>
          </nav>

          <header className="mt-6 flex items-start gap-4">
            <span className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0" aria-hidden="true">
              <Icono className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-black dark:text-neutral-50">
                {guia.titulo}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 max-w-2xl">{guia.resumen}</p>
            </div>
          </header>

          <div className="mt-10 grid lg:grid-cols-[220px_1fr] gap-10">
            {/* Índice de la guía: fijo en escritorio */}
            <aside className="hidden lg:block">
              <nav aria-label="Contenido de la guía" className="sticky top-6 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">En esta guía</p>
                {guia.secciones.map((s, i) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white"
                  >
                    {s.titulo}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="min-w-0 space-y-14">
              {video && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video}`}
                    title={`Video: ${guia.titulo}`}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              )}

              {guia.secciones.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-28">
                  <h2 className="text-2xl font-bold text-black dark:text-neutral-50">{s.titulo}</h2>
                  <ol className="mt-5 space-y-5">
                    {s.pasos.map((p, j) => {
                      const numero = inicio[i] + j + 1;
                      return (
                        <li key={p.titulo} className="flex gap-4">
                          <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                            {numero}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-black dark:text-neutral-50">
                              <span className="sr-only">Paso {numero}: </span>
                              {p.titulo}
                            </h3>
                            <p className="mt-1.5 text-neutral-600 dark:text-neutral-300 leading-relaxed">{p.texto}</p>
                            {p.captura && (
                              <Image
                                src={p.captura}
                                alt={`${guia.titulo}: ${p.titulo}`}
                                width={1280}
                                height={800}
                                className="mt-4 w-full h-auto rounded-xl border border-neutral-200 dark:border-neutral-800"
                              />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}

              {guia.consejos && guia.consejos.length > 0 && (
                <section className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                    <Lightbulb className="w-5 h-5" aria-hidden="true" />
                    Consejos
                  </h2>
                  <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-amber-900/90 dark:text-amber-100/90">
                    {guia.consejos.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </section>
              )}

              {relacionadas.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-black dark:text-neutral-50">Guías relacionadas</h2>
                  <ul className="mt-4 grid sm:grid-cols-2 gap-3">
                    {relacionadas.map((r) => {
                      const I = r.icono;
                      return (
                        <li key={r.slug}>
                          <Link
                            href={rutaGuia(r.slug)}
                            className="group flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:border-blue-400 transition-colors"
                          >
                            <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0" aria-hidden="true">
                              <I className="w-4 h-4" />
                            </span>
                            <span className="flex-1 text-sm font-semibold text-black dark:text-neutral-100">{r.titulo}</span>
                            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="rounded-3xl bg-zinc-950 text-white px-6 py-10 sm:px-10 text-center">
                <h2 className="text-2xl font-bold">¿Aún no tienes cuenta?</h2>
                <p className="mt-2 text-zinc-400">Pruébalo {DIAS_PRUEBA} días gratis, sin tarjeta.</p>
                <Link
                  href="/es/auth?mode=signup"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Crear mi cuenta gratis
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
        </div>
      </article>

      <Footer />

      <JsonLd
        id="ld-howto"
        data={howToSchema(siteUrl, {
          nombre: guia.titulo,
          descripcion: guia.resumen,
          ruta: rutaGuia(guia.slug),
          pasos: guia.secciones.flatMap((s) => s.pasos.map((p) => ({ nombre: p.titulo, texto: p.texto }))),
        })}
      />
      <JsonLd
        id="ld-breadcrumb-guia"
        data={breadcrumbSchema(siteUrl, [
          { nombre: "Inicio", ruta: "/es" },
          { nombre: "Aprende", ruta: rutaGuia() },
          { nombre: guia.titulo, ruta: rutaGuia(guia.slug) },
        ])}
      />
    </AppFrame>
  );
}
