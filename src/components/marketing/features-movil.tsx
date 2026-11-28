"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ScanBarcode, Package, Upload, Store, Gift, ChevronDown } from "lucide-react";

/**
 * «Todo lo que tu negocio necesita» en celular, como una billetera: las tarjetas van
 * apiladas mostrando su título. Al tocar una, se expande en su sitio con la captura y
 * sus datos completos; al tocar otra, la anterior se cierra y se abre la nueva.
 */

type Modulo = {
  key: string;
  icono: typeof ScanBarcode;
  imgs: { src: string; ancho: number; alto: number }[];
};

/** Degradado de #1e3a8a (arriba) a #000000 (abajo) en 5 pasos. */
const PALETA = ["#1e3a8a", "#172c68", "#0f1d45", "#080f23", "#000000"];

const MODULOS: Modulo[] = [
  { key: "scanner", icono: ScanBarcode, imgs: [{ src: "/landing/funciones/escaner.webp", ancho: 760, alto: 730 }] },
  { key: "inventory", icono: Package, imgs: [{ src: "/landing/funciones/inventario.webp", ancho: 373, alto: 330 }] },
  { key: "catalogImport", icono: Upload, imgs: [{ src: "/landing/funciones/migracion.webp", ancho: 373, alto: 310 }] },
  { key: "onlineCatalog", icono: Store, imgs: [{ src: "/landing/funciones/catalogo.webp", ancho: 760, alto: 724 }] },
  { key: "loyalty", icono: Gift, imgs: [{ src: "/landing/funciones/lealtad.webp", ancho: 760, alto: 507 }] },
];

const ESTILOS = `
@keyframes fm-entrar { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
.fm-entrar { animation: fm-entrar .6s cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .fm-entrar { animation: none; } .fm-expansion { transition: none !important; } }
`;

export function FeaturesMovil() {
  const t = useTranslations("landing.features");
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="flex flex-col pt-2">
      <style>{ESTILOS}</style>
      {MODULOS.map((m, i) => {
        const Icono = m.icono;
        const activa = abierto === m.key;
        return (
          <div
            key={m.key}
            className={`fm-entrar fm-expansion relative transition-[margin] duration-500 ease-out ${i === 0 ? "" : activa ? "mt-4" : "-mt-5"}`}
            style={{
              animationDelay: `${i * 0.08}s`,
              zIndex: activa ? 50 : i + 1,
              // Claro: de azul (arriba) a negro (abajo). Oscuro: invertido, para que se vea sobre el fondo negro.
              ["--fm-claro" as string]: PALETA[i],
              ["--fm-oscuro" as string]: PALETA[PALETA.length - 1 - i],
            }}
          >
            <div className="overflow-hidden rounded-3xl bg-[var(--fm-claro)] text-white shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)] dark:bg-[var(--fm-oscuro)]">
              <button
                type="button"
                aria-expanded={activa}
                onClick={() => setAbierto(activa ? null : m.key)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 font-semibold leading-tight">{t(`${m.key}.title`)}</span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-500 ${activa ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {/* El contenido se abre con la altura: 0fr → 1fr anima el alto real. */}
              <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${activa ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-3 bg-white px-4 pb-5 pt-1 text-neutral-900">
                    {m.imgs.map((img) => (
                      <div key={img.src} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                        <Image src={img.src} alt={t(`${m.key}.captura`)} width={img.ancho} height={img.alto} sizes="(max-width: 640px) 90vw, 360px" className="h-auto w-full select-none" draggable={false} />
                      </div>
                    ))}
                    <p className="text-sm leading-relaxed text-neutral-600">{t(`${m.key}.description`)}</p>
                    {t.has(`${m.key}.stats`) && (
                      <p className="text-xs font-semibold text-neutral-500">{t(`${m.key}.stats`)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
