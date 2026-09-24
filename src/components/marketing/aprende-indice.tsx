"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { GUIAS, rutaGuia } from "@/features/marketing/aprende";

/** Quita acentos y mayusculas: "configuracion" encuentra "Configuración". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Indice de guias con buscador. Filtra en el navegador (son 12 guias) por
 * titulo, resumen y titulos de sus pasos, asi "corte" encuentra la guia de caja.
 */
export function AprendeIndice() {
  const [consulta, setConsulta] = useState("");

  const visibles = useMemo(() => {
    const q = normalizar(consulta.trim());
    if (!q) return GUIAS;
    return GUIAS.filter((g) =>
      normalizar(
        [g.titulo, g.resumen, ...g.secciones.flatMap((s) => [s.titulo, ...s.pasos.map((p) => p.titulo)])].join(" ")
      ).includes(q)
    );
  }, [consulta]);

  return (
    <div>
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Busca: corte de caja, variantes, traspasos…"
          aria-label="Buscar en las guías"
          className="w-full rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-11 pr-4 py-3 text-sm text-black dark:text-neutral-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-12 text-center text-sm text-neutral-500">
          No encontramos guías con «{consulta}». Prueba con otra palabra.
        </p>
      ) : (
        <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((g) => {
            const Icono = g.icono;
            return (
              <li key={g.slug}>
                <Link
                  href={rutaGuia(g.slug)}
                  className="group flex h-full flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
                >
                  <span className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center" aria-hidden="true">
                    <Icono className="w-5 h-5" />
                  </span>
                  <h2 className="mt-4 font-semibold text-black dark:text-neutral-50">{g.titulo}</h2>
                  <p className="mt-1.5 flex-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{g.resumen}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                    Ver guía
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
