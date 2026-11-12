"use client";

import { abrirConfiguracionCookies } from "@/lib/consentimiento-cookies";

/** Reabre el panel de preferencias de cookies (pie de pagina y Politica de Cookies). */
export function BotonConfigurarCookies({
  className,
  children = "Configurar cookies",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={abrirConfiguracionCookies} className={className}>
      {children}
    </button>
  );
}
