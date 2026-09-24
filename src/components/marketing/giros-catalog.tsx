import Link from "next/link";
import { GIROS, rutaGiro } from "@/features/marketing/giros";

/**
 * Catalogo completo de giros (`#giros`): destino del boton "Otros" de la
 * franja y bloque "Explora otros giros" al pie de cada pagina de giro.
 *
 * Server component a proposito: son enlaces estaticos, y que el HTML llegue
 * ya con todos ellos es lo que permite a los buscadores descubrir cada pagina.
 */
export function GirosCatalog({
  locale = "es",
  titulo,
  subtitulo,
  excluir,
  id = "giros",
}: {
  locale?: string;
  titulo?: string;
  subtitulo?: string;
  /** El giro de la pagina actual, para no enlazarse a si misma. */
  excluir?: string;
  id?: string;
}) {
  const en = locale === "en";
  const giros = GIROS.filter((g) => g.slug !== excluir);

  return (
    <section id={id} className="w-full py-16 sm:py-20 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-neutral-50">
            {titulo ?? (en ? "A point of sale built for:" : "Punto de venta adaptado para:")}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
            {subtitulo ??
              (en
                ? "Configurations for retail and wholesale businesses. Pick yours to see how SYMVORA works for it."
                : "Soluciones para negocios minoristas y de mayoreo. Elige el tuyo y conoce cómo te ayuda SYMVORA.")}
          </p>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {giros.map((giro) => {
            const Icono = giro.icono;
            return (
              <li key={giro.slug}>
                <Link
                  href={rutaGiro(giro.slug)}
                  className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-6 text-center transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
                >
                  <span
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <Icono className="w-6 h-6 sm:w-7 sm:h-7" />
                  </span>
                  <span className="text-sm font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                    {giro.nombre[en ? "en" : "es"]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
