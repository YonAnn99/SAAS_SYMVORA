"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Aviso bajo cada carga de logo: al subirlo, el usuario confirma que tiene
 * derecho a usarlo (Terminos, seccion 7.2). Recordarlo en el punto de carga
 * refuerza la declaracion de los Terminos. Abre en otra pestaña para no sacar
 * al usuario de donde esta subiendo el logo.
 */
export function AvisoDerechosLogo() {
  const t = useTranslations("auth");
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {t("logoRights")}{" "}
      <Link href="/terminos" target="_blank" rel="noopener" className="underline">
        {t("logoRightsLink")}
      </Link>
    </p>
  );
}
