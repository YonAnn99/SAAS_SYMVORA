"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Un video ya resuelto: `id` sale de `idYoutube` en el servidor. */
export interface VideoYoutube {
  titulo: string;
  id: string;
}

/**
 * Video de una guia de Aprende. Mientras nadie le da play es solo una portada
 * (la miniatura de YouTube y un boton): el reproductor de YouTube pesa cerca
 * de 1 MB y la mayoria de quien lee la guia no lo abre. Al darle play se
 * cambia por el `iframe` de youtube-nocookie, ya reproduciendo.
 *
 * Con dos o mas videos (Compras y Ordenes de compra) van en pestañas; cambiar
 * de pestaña vuelve a la portada.
 *
 * CSP (`next.config.ts`): la miniatura viene de `i.ytimg.com` (img-src) y el
 * reproductor de `www.youtube-nocookie.com` (frame-src).
 *
 * Recibe los ids ya resueltos para no mandar al navegador todo `aprende.ts`.
 */
export function VideoGuia({ videos: validos, guia }: { videos: VideoYoutube[]; guia: string }) {
  const [actual, setActual] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);

  if (validos.length === 0) return null;
  const video = validos[Math.min(actual, validos.length - 1)];
  const nombre = validos.length > 1 ? video.titulo : guia;

  return (
    <div>
      {validos.length > 1 && (
        <div role="tablist" aria-label="Videos de la guía" className="mb-3 flex flex-wrap gap-2">
          {validos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === actual}
              onClick={() => {
                setActual(i);
                setReproduciendo(false);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                i === actual
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              )}
            >
              {v.titulo}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-neutral-200 bg-black dark:border-neutral-800">
        {reproduciendo ? (
          <iframe
            key={video.id}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={`Video: ${nombre}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setReproduciendo(true)}
            aria-label={`Reproducir video: ${nombre}`}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube, ya optimizada */}
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" aria-hidden />
            <span
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-transform duration-200 group-hover:scale-110 group-active:scale-95 sm:h-20 sm:w-20"
              aria-hidden
            >
              <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
            </span>
            <span className="absolute bottom-3 left-4 right-4 truncate text-left text-sm font-semibold text-white drop-shadow sm:bottom-4 sm:left-5 sm:text-base">
              {nombre}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
