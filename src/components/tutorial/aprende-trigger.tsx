"use client";

import { GraduationCap } from "lucide-react";
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
  const pathname = usePathname();
  const guia = guiaParaRuta(pathname);

  return (
    <a
      href={rutaGuia(guia?.slug)}
      target="_blank"
      rel="noopener"
      title={guia ? `Guía: ${guia.titulo}` : "Guías de uso de SYMVORA"}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-muted-foreground hover:text-foreground")}
    >
      <GraduationCap className="h-4 w-4" aria-hidden="true" />
      <span className="hidden md:inline">Aprende</span>
    </a>
  );
}
