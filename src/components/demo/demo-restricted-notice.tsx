"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

interface DemoRestrictedNoticeProps {
  /**
   * Texto corto que aparece como título de la restricción. Si no se
   * pasa, se usa el string por defecto "Funcionalidad no disponible
   * en el modo demo".
   */
  title?: string;
  /**
   * Descripción detallada. Si no se pasa, usa el mensaje genérico.
   */
  description?: string;
  /**
   * Si es true, oculta el botón "Crear cuenta gratis".
   */
  hideCta?: boolean;
  /**
   * Variante visual:
   *   - "banner": bloque grande que reemplaza la sección.
   *   - "inline": bloque pequeño para mostrar dentro de un card.
   */
  variant?: "banner" | "inline";
}

/**
 * Banner/notice que se muestra en secciones de la app que están
 * deshabilitadas en el modo demo (pagos, facturación CFDI, invitaciones,
 * configuración de métodos de pago).
 *
 * El backend ya rechaza cualquier acción del usuario demo en estos
 * endpoints con 403; este componente es la contraparte de UI para que
 * el usuario no vea controles que sabe que no van a funcionar.
 */
export function DemoRestrictedNotice({
  title,
  description,
  hideCta = false,
  variant = "banner",
}: DemoRestrictedNoticeProps) {
  const t = useTranslations();
  const locale = useLocale();

  const heading = title ?? t("landing.demo.restricted.title");
  const body = description ?? t("landing.demo.restricted.description");

  if (variant === "inline") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium">{heading}</p>
          <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">{body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-8 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-zinc-950 dark:to-amber-950/20">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-100/60 blur-2xl dark:bg-amber-900/30" />
      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t("landing.demo.restricted.eyebrow")}
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {heading}
        </h2>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{body}</p>
        {!hideCta && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/signup`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("landing.demo.restricted.cta")}
            </Link>
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("landing.demo.restricted.back")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
