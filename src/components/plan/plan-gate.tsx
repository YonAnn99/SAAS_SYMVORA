"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { NIVEL_MINIMO, type FuncionDePlan } from "@/lib/niveles";

/**
 * «Disponible en Pro»: lo que ve quien entra por URL directa a una pantalla que su nivel de suscripción
 * no incluye (Básico: Sucursales y Catálogo en línea). El menú ya no se la ofrece (`filterNavigation`).
 *
 * No borra nada: los datos del negocio siguen ahí y vuelven en cuanto sube de nivel. La regla de verdad
 * la aplican los triggers de la migración 140; esto solo evita enseñar una pantalla que iba a fallar.
 */
export function AvisoDePlan({ funcion }: { funcion: FuncionDePlan }) {
  const t = useTranslations("planes");
  const nivel = t(`names.${NIVEL_MINIMO[funcion]}`);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground" aria-hidden="true">
            <Lock className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("upgrade.title", { nivel })}</p>
            <p className="max-w-xl text-sm text-muted-foreground">{t(`upgrade.body.${funcion}`, { nivel })}</p>
          </div>
        </div>
        <Link href="/billing" className={cn(buttonVariants(), "shrink-0")}>
          {t("upgrade.cta")}
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Muestra `children` si el nivel incluye la función; si no, el aviso. Mientras no se sabe el nivel no
 * dibuja nada: enseñar la pantalla y quitarla un instante después es peor que esperar un poco.
 */
export function PlanGate({ funcion, children }: { funcion: FuncionDePlan; children: ReactNode }) {
  const { permite, listo } = usePlan();
  if (!listo) return null;
  if (!permite(funcion)) return <AvisoDePlan funcion={funcion} />;
  return <>{children}</>;
}
