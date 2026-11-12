"use client";

import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { guiaParaRuta, rutaGuia } from "@/features/marketing/aprende";

/**
 * "Aprende" en la barra superior del sistema: abre, en otra pestaña, la guia
 * del modulo donde esta el usuario (/pos -> guia del punto de venta). Sin
 * guia para esa pantalla, el indice.
 *
 * Enlace relativo a proposito: en produccion el middleware lo manda del host
 * de la app (app.symvora.com.mx) al de marketing (www), donde viven las guias.
 * Un <a> y no `Link`: es otra pestaña y otro host, no navegacion interna.
 */
export function AprendeTrigger() {
  const t = useTranslations("layout.learn");
  const pathname = usePathname();
  const guia = guiaParaRuta(pathname);

  return (
    <a
      href={rutaGuia(guia?.slug)}
      target="_blank"
      rel="noopener"
      // Las guias estan en espanol: su titulo se muestra tal cual.
      title={guia ? t("guide", { titulo: guia.titulo }) : t("allGuides")}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-muted-foreground hover:text-foreground")}
    >
      <GraduationCap className="h-4 w-4" aria-hidden="true" />
      <span className="hidden md:inline">{t("label")}</span>
    </a>
  );
}
