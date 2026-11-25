"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  FUNCIONES_POR_NIVEL,
  funcionesQueSeApagan,
  nivelQueCabe,
  nivelSugerido,
  sucursalesPorCerrar,
  type Nivel,
} from "@/lib/niveles";

/**
 * Avisa ANTES de pagar si el plan elegido no le cabe al negocio (sucursales activas de más: la prueba no tiene tope) o
 * si apaga algo que hoy tiene. Es el mismo criterio que aplica el servidor (409 `demasiadas_sucursales`,
 * `asignar_nivel`), adelantado a la pantalla; el servidor sigue siendo la autoridad. Nunca se borra nada.
 */
export function AvisoAjustePlan({
  nivel,
  sucursalesActivas,
  onElegir,
}: {
  nivel: Nivel;
  sucursalesActivas: number;
  /** Cambia la selección al nivel sugerido. */
  onElegir: (n: Nivel) => void;
}) {
  const t = useTranslations("planes");
  const locale = useLocale();
  const nombre = (n: Nivel) => t(`names.${n}`);

  if (!nivelQueCabe(nivel, sucursalesActivas)) {
    const sugerido = nivelSugerido(sucursalesActivas);
    return (
      <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs" role="alert">
        <p>
          {t("fit.tooMany", {
            usadas: sucursalesActivas,
            nivel: nombre(nivel),
            max: FUNCIONES_POR_NIVEL[nivel].sucursalesMax ?? 0,
            sugerido: nombre(sugerido),
            sobran: sucursalesPorCerrar(nivel, sucursalesActivas),
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onElegir(sugerido)}>
            {t("fit.choose", { nivel: nombre(sugerido) })}
          </Button>
          <Link
            href="/branches"
            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted"
          >
            {t("fit.goBranches")}
          </Link>
        </div>
      </div>
    );
  }

  const apagadas = funcionesQueSeApagan(nivel);
  if (apagadas.length === 0) return null;
  const lista = new Intl.ListFormat(locale === "en" ? "en" : "es", { style: "long", type: "conjunction" }).format(
    apagadas.map((f) => t(`fit.off.${f}`))
  );
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="note">
      {t("fit.turnsOff", { nivel: nombre(nivel), funciones: lista })}
    </p>
  );
}
