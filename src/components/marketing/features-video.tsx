"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * «Todo lo que tu negocio necesita» en escritorio: una fila de tarjetas 4:3 que ocupa todo
 * el ancho. La tarjeta activa va al centro y las vecinas se asoman por los lados. La fila
 * gira en bucle infinito, hacia la derecha o la izquierda. Solo el clip activo se reproduce,
 * y solo mientras la sección está en pantalla.
 */

const CLIPS = [
  { key: "scanner", archivo: "escanea-camara" },
  { key: "inventory", archivo: "inventario" },
  { key: "catalogImport", archivo: "migracion" },
  { key: "onlineCatalog", archivo: "catalogo" },
  { key: "loyalty", archivo: "lealtad" },
] as const;

const N = CLIPS.length;

/** Posición de la tarjeta `i` respecto a la activa, en bucle: -2..2 con N = 5. */
function distancia(i: number, activo: number): number {
  let d = (((i - activo) % N) + N) % N;
  if (d > N / 2) d -= N;
  return d;
}

export function FeaturesVideo() {
  const t = useTranslations("landing.features");
  const [activo, setActivo] = useState(0);
  const [visible, setVisible] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // El clip activo empieza desde el principio; los demás se pausan.
  useEffect(() => {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === activo) {
        v.currentTime = 0;
        if (visible && !reducido) v.play().catch(() => {});
        else v.pause();
      } else {
        v.pause();
      }
    });
  }, [activo, visible]);

  const ir = (i: number) => setActivo(((i % N) + N) % N);

  return (
    <div ref={contenedor} className="flex flex-col gap-6">
      {/* Fila a todo el ancho: la sección recorta lo que sale de los lados. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden" style={{ height: "clamp(260px, 36vw, 440px)" }}>
        {CLIPS.map((c, i) => {
          const d = distancia(i, activo);
          const visibleTarjeta = Math.abs(d) <= 2;
          const esActiva = d === 0;
          return (
            <div
              key={c.key}
              className="absolute left-1/2 top-0 aspect-[4/3] w-[40%] -translate-x-1/2 overflow-hidden rounded-[28px] border border-neutral-200 bg-neutral-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(.2,.8,.2,1)] dark:border-neutral-800"
              style={{
                transform: `translateX(${d * 105}%) scale(${esActiva ? 1 : 0.9})`,
                opacity: visibleTarjeta ? (esActiva ? 1 : 0.55) : 0,
                zIndex: esActiva ? 3 : 1,
                pointerEvents: esActiva ? "auto" : "none",
              }}
              aria-hidden={!esActiva}
            >
              <video
                ref={(el) => {
                  videos.current[i] = el;
                }}
                src={`/landing/videos/${c.archivo}.webm`}
                muted
                playsInline
                preload="metadata"
                aria-label={t(`${c.key}.captura`)}
                onEnded={() => {
                  if (esActiva) ir(activo + 1);
                }}
                className="h-full w-full object-cover"
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => ir(activo - 1)}
          aria-label={t("controles.anterior")}
          className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-900 shadow-md backdrop-blur hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => ir(activo + 1)}
          aria-label={t("controles.siguiente")}
          className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-900 shadow-md backdrop-blur hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-50"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
          {String(activo + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-black dark:text-neutral-50">{t(`${CLIPS[activo].key}.title`)}</h3>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{t(`${CLIPS[activo].key}.description`)}</p>
      </div>

      <div className="flex justify-center gap-2" role="tablist">
        {CLIPS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={activo === i}
            aria-label={t(`${c.key}.title`)}
            onClick={() => ir(i)}
            className={`h-2 rounded-full transition-all duration-500 ${activo === i ? "w-8 bg-neutral-900 dark:bg-white" : "w-2 bg-neutral-300 dark:bg-neutral-700"}`}
          />
        ))}
      </div>
    </div>
  );
}
