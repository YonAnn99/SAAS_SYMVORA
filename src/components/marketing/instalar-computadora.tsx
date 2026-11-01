"use client";

import { useEffect, useState } from "react";
import { Download, Monitor } from "lucide-react";
import { urlInstalar } from "@/features/instalar-app/plataforma";

/**
 * «SYMVORA en tu computadora»: lleva a la pagina de instalacion (PWA) en el
 * host de la APP. No instala aqui: la landing vive en `www`, otro origen, y la
 * app instalada desde aqui abriria el panel fuera de su alcance.
 */
export function InstalarComputadora() {
  const [href, setHref] = useState("https://app.symvora.com.mx/es/instalar");

  useEffect(() => {
    // En localhost y previews, la pagina del mismo servidor.
    const t = window.setTimeout(() => setHref(urlInstalar(window.location.hostname)), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-12 md:flex-row md:text-left">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Monitor className="h-8 w-8" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-black dark:text-white sm:text-3xl">
            SYMVORA en tu computadora
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Instálala en Windows o Mac: ícono en tu escritorio, su propia ventana y se actualiza sola. Gratis, sin
            descargas pesadas.
          </p>
        </div>
        <a
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          <Download className="h-4 w-4" aria-hidden />
          Instalar en mi computadora
        </a>
      </div>
    </section>
  );
}
