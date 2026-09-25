import Link from "next/link";
import { GIROS, rutaGiro } from "@/features/marketing/giros";
import { ETIQUETA_GIRO, RECUADRO_GIRO, TRAZO_GIRO } from "./giro-estilos";

/**
 * Catalogo completo de giros (`#giros`): destino del boton "Ver los 20" de
 * la franja y bloque "Explora otros giros" al pie de cada pagina de giro.
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
    <section id={id} className="w-full py-16 sm:py-20 scroll-mt-24 md:scroll-mt-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#787774] dark:text-[#9A9791]">
            {en ? `Business types · ${giros.length}` : `Giros comerciales · ${giros.length}`}
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#111111] dark:text-[#F5F4F0]">
            {titulo ?? (en ? "A point of sale built for:" : "Punto de venta adaptado para:")}
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#787774] dark:text-[#9A9791]">
            {subtitulo ??
              (en
                ? "Configurations for retail and wholesale businesses. Pick yours to see how SYMVORA works for it."
                : "Soluciones para negocios minoristas y de mayoreo. Elige el tuyo y conoce cómo te ayuda SYMVORA.")}
          </p>
        </div>

        {/* Mismo lenguaje que la franja del hero (`giro-estilos.ts`): tarjeta
            con borde fino, recuadro neutro e icono de linea; al pasar el raton
            el icono se pinta del azul SYMVORA. */}
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {giros.map((giro) => {
            const Icono = giro.icono;
            return (
              <li key={giro.slug}>
                <Link
                  href={rutaGiro(giro.slug)}
                  className="group flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-[#EAEAEA] dark:border-white/[0.08] bg-white dark:bg-[#1A1A1A] px-3 py-6 text-center transition-colors duration-200 hover:border-[#1e3a8a]/40 dark:hover:border-[#1e3a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  <span className={`w-12 h-12 ${RECUADRO_GIRO}`} aria-hidden="true">
                    <Icono className="w-[22px] h-[22px]" strokeWidth={TRAZO_GIRO} />
                  </span>
                  <span className={`text-sm font-medium ${ETIQUETA_GIRO}`}>
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
