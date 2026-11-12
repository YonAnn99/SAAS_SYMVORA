"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { ALTO_PANEL_COMPLETO } from "@/components/dashboard/alto-panel";
import { cn } from "@/lib/utils";

/**
 * Lo que ve quien abre el Punto de Venta sin caja abierta.
 *
 * Explica el MOTIVO, no solo que está bloqueado: sin caja, las ventas no
 * generan movimiento y el corte del día no cuadra. Sin esa frase, el cajero
 * lee "no puedo vender" y llama al dueño.
 */
export function RegisterRequiredNotice() {
  const t = useTranslations("finances.required");
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 px-6 text-center", ALTO_PANEL_COMPLETO)}>
      <div className="rounded-full bg-amber-500/10 p-4">
        <Wallet className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("noticeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("noticeDesc")}
        </p>
      </div>

      {/* Sin query string: `Link` de next-intl espera un pathname (ver nota
          en open-register-prompt.tsx). */}
      <Link href="/finances">
        <SpecularActionButton tone="money" className="h-9">
          {t("goOpen")}
        </SpecularActionButton>
      </Link>

      <p className="max-w-md text-xs text-muted-foreground">
        {t("needsConnection")}
      </p>
    </div>
  );
}
