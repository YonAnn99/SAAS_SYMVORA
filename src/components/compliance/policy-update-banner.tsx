"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

const DISMISS_KEY = "symvora_policy_banner_dismissed_until";

type VersionsResponse = {
  accepted: {
    terms_version: string | null;
    privacy_version: string | null;
    cookies_version: string | null;
    accepted_at: string | null;
  } | null;
  needsUpdate: boolean;
};

export function PolicyUpdateBanner() {
  const t = useTranslations();
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() < dismissedUntil) return;

    void (async () => {
      try {
        const res = await fetch("/api/legal/current-versions", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as VersionsResponse;
        if (cancelled) return;
        if (data.needsUpdate) setVisible(true);
      } catch {
        // Silenciar errores de red: el banner es informativo, no debe romper la app.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    // No mostrar de nuevo en 24h.
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + 24 * 60 * 60 * 1000)
    );
    setVisible(false);
  };

  const acceptCurrent = async () => {
    try {
      await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
          privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
          cookiesVersion: LEGAL_DOCUMENT_VERSIONS.cookies,
        }),
      });
    } catch {
      // No bloquear: el click ya es evidencia local.
    }
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          aria-live="polite"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 inset-x-0 z-[60] bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-sm"
        >
          <div className="max-w-5xl mx-auto flex items-start gap-3">
            <div className="flex-1 text-sm text-amber-900">
              <p className="font-medium">
                Hemos actualizado nuestros documentos legales.
              </p>
              <p className="mt-1 text-amber-800">
                Por favor revisa los{" "}
                <Link
                  href={`/${locale}/terminos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Términos y Condiciones
                </Link>{" "}
                y el{" "}
                <Link
                  href={`/${locale}/aviso-privacidad`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Aviso de Privacidad
                </Link>{" "}
                actualizados antes de continuar.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={acceptCurrent}
                className="text-xs font-medium bg-amber-900 text-white px-3 py-1.5 rounded-md hover:bg-amber-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {t("notFound.home") === "Ir al inicio" ? "Aceptar" : "Accept"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Cerrar"
                className="p-1.5 rounded-md text-amber-900 hover:bg-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
