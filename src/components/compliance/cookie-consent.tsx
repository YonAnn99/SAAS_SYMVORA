"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { useConsentimiento } from "@/hooks/use-consentimiento";
import { EVENTO_CONFIGURAR, guardarConsentimiento } from "@/lib/consentimiento-cookies";

/**
 * Aviso de cookies de la landing: Aceptar, Rechazar o Configurar (esenciales
 * siempre activas + medicion anonima opcional). La logica y la cookie viven en
 * `lib/consentimiento-cookies.ts`; "Configurar cookies" del pie lo reabre.
 */
export function CookieConsent() {
  const t = useTranslations("cookies");
  const locale = useLocale();
  const { decidido, medicion } = useConsentimiento();
  // Panel de preferencias: abierto desde el aviso o desde el pie de pagina.
  const [panel, setPanel] = useState(false);
  const [medicionElegida, setMedicionElegida] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abrir = () => {
      // Desde el pie: con la eleccion vigente (sin decidir: apagada).
      setMedicionElegida(decidido ? medicion : false);
      setPanel(true);
    };
    window.addEventListener(EVENTO_CONFIGURAR, abrir);
    return () => window.removeEventListener(EVENTO_CONFIGURAR, abrir);
  }, [decidido, medicion]);

  useEffect(() => {
    if (panel) panelRef.current?.focus();
  }, [panel]);

  const elegir = (permitirMedicion: boolean) => {
    guardarConsentimiento(permitirMedicion);
    setPanel(false);
  };

  if (decidido && !panel) return null;

  const botonContorno =
    "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2";
  const botonNegro =
    "rounded-lg bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("title")}
      className="fixed bottom-0 inset-x-0 z-[999] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {panel ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-5 shadow-lg ring-1 ring-black/5 outline-none"
        >
          <p className="text-sm font-semibold text-neutral-900">{t("settingsTitle")}</p>
          <div className="mt-4 space-y-3">
            <Categoria
              titulo={t("essentialTitle")}
              descripcion={t("essentialDesc")}
              control={
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500">{t("alwaysOn")}</span>
                  <Switch checked disabled aria-label={t("essentialTitle")} />
                </div>
              }
            />
            <Categoria
              titulo={t("analyticsTitle")}
              descripcion={t("analyticsDesc")}
              control={
                <Switch
                  checked={medicionElegida}
                  onCheckedChange={(v) => setMedicionElegida(Boolean(v))}
                  aria-label={t("analyticsTitle")}
                />
              }
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/${locale}/politica-cookies`}
              className="mr-auto text-sm text-neutral-600 underline underline-offset-2 hover:text-black"
            >
              {t("learnMore")}
            </Link>
            <button type="button" onClick={() => elegir(medicionElegida)} className={botonContorno}>
              {t("save")}
            </button>
            <button type="button" onClick={() => elegir(true)} className={botonNegro}>
              {t("acceptAll")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-lg ring-1 ring-black/5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm leading-relaxed text-neutral-600">
            {t("message")}{" "}
            <Link
              href={`/${locale}/politica-cookies`}
              className="text-neutral-900 underline underline-offset-2 hover:text-black"
            >
              {t("learnMore")}
            </Link>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMedicionElegida(false);
                setPanel(true);
              }}
              className="px-2 py-2 text-sm font-medium text-neutral-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            >
              {t("configure")}
            </button>
            {/* Rechazar y Aceptar con el mismo tamano: rechazar no se esconde. */}
            <button type="button" onClick={() => elegir(false)} className={`${botonContorno} flex-1 sm:flex-none`}>
              {t("reject")}
            </button>
            <button type="button" onClick={() => elegir(true)} className={`${botonNegro} flex-1 sm:flex-none`}>
              {t("accept")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Categoria({
  titulo,
  descripcion,
  control,
}: {
  titulo: string;
  descripcion: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{descripcion}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
