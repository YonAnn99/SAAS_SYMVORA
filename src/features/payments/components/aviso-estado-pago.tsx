"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";

/**
 * Aviso fijo arriba del panel cuando la cuenta no tiene acceso completo
 * (migracion 096):
 *
 *   prueba        ultimos dias de la prueba gratis: "termina en N dias"
 *   gracia        "No pudimos cobrar / tu mes vencio: te quedan N dias"
 *   solo_lectura  "Tu cuenta esta en solo lectura" + lo que tiene en juego
 *                 (productos y ventas guardados) + oferta de regreso
 *
 * Mostrar lo que tiene guardado es a proposito: la cuenta no se siente
 * perdida, se siente en pausa, y reactivar la devuelve tal cual.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useAccesoCuenta } from "@/hooks/use-acceso-cuenta";
import { PRECIO_PROMO_MXN, precioListaMXN } from "@/features/payments/promocion";
import { useEsAppAndroid } from "@/features/app-android/use-es-app-android";

const fechaLarga = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, { day: "numeric", month: "long" });
const miles = (n: number, locale: string) => n.toLocaleString(locale);

export function AvisoEstadoPago() {
  const { tenantId } = useCurrentTenant();
  const { can } = usePermissions();
  const pathname = usePathname();
  const enAppAndroid = useEsAppAndroid();
  const { loading, acceso, estado, diasGracia, limiteDatos, ofertaRegresoHasta, prueba } =
    useAccesoCuenta();
  const [guardado, setGuardado] = useState<{ productos: number; ventas: number } | null>(null);
  const t = useTranslations("billing.notice");
  const li = localeIntl(useLocale());

  const soloLectura = !loading && acceso === "solo_lectura";

  useEffect(() => {
    if (!soloLectura || !tenantId) return;
    let cancelado = false;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const [productos, ventas] = await Promise.all([
        supabase.from("productos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("ventas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);
      if (!cancelado) {
        setGuardado({ productos: productos.count ?? 0, ventas: ventas.count ?? 0 });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [soloLectura, tenantId]);

  // En /billing ya esta todo esto con mas detalle.
  if (loading || pathname.startsWith("/billing")) return null;

  // En la app de Android no se invita a pagar ni se mencionan precios (politica
  // de pagos de Google Play, `lib/app-android.ts`): el dueño ve el aviso y un
  // enlace neutro a su suscripcion.
  const esDueno = can("subscription.manage");
  const puedePagar = esDueno && !enAppAndroid;
  const enlaceNeutro = (
    <Link
      href="/billing"
      className="shrink-0 rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:opacity-90"
    >
      {t("viewSubscription")}
    </Link>
  );

  // Prueba gratis en sus ultimos dias: recordatorio para quien entra a diario
  // (los correos solo salen 2 dias antes y al vencer).
  if (acceso === "completo") {
    if (!prueba) return null;
    const cuando = prueba.hoy
      ? t("todayAt", { hora: prueba.fin.toLocaleTimeString(li, { hour: "numeric", minute: "2-digit" }) })
      : t("inDays", { count: prueba.dias, fecha: fechaLarga(prueba.fin, li) });
    return (
      <div
        role="status"
        className="w-full border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-medium">{t("trialEnds", { cuando })}</strong>{" "}
              {puedePagar
                ? t("choosePlanHint")
                : t("readOnlyAfter")}
            </span>
          </p>
          {puedePagar ? (
            <Link
              href="/billing"
              className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              {t("choosePlan")}
            </Link>
          ) : esDueno ? (
            enlaceNeutro
          ) : (
            <span className="shrink-0 text-xs opacity-80">{t("tellOwner")}</span>
          )}
        </div>
      </div>
    );
  }
  const accion = puedePagar ? (
    <Link
      href="/billing"
      className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
    >
      {soloLectura ? t("reactivate") : t("payNow")}
    </Link>
  ) : esDueno ? (
    enlaceNeutro
  ) : (
    <span className="shrink-0 text-xs opacity-80">{t("tellOwner")}</span>
  );

  if (!soloLectura) {
    const titulo =
      estado === "past_due" ? t("chargeFailed") : t("expired");
    return (
      <div
        role="status"
        className="w-full border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-medium">{titulo}</strong>{" "}
              {enAppAndroid
                ? diasGracia > 0
                  ? t("accessContinues", { count: diasGracia })
                  : t("lastDay")
                : diasGracia > 0
                  ? t("daysToPay", { count: diasGracia })
                  : t("payToday")}
            </span>
          </p>
          {accion}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="w-full border-b border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-0.5">
            <p>
              <strong className="font-medium">{t("readOnlyTitle")}</strong>{" "}
              {t("readOnlyDesc")}
            </p>
            <p className="text-xs opacity-90">
              {guardado
                ? `${t("intactCounts", { productos: miles(guardado.productos, li), ventas: miles(guardado.ventas, li) })} `
                : `${t("intact")} `}
              {enAppAndroid ? t("continueAndroid") : t("continue")}
              {limiteDatos ? ` ${t("dataUntil", { fecha: fechaLarga(limiteDatos, li) })}` : ""}.
              {ofertaRegresoHasta && !enAppAndroid && (
                <>
                  {" "}
                  <strong className="font-medium">
                    {t("comeback", { promo: `$${PRECIO_PROMO_MXN}`, normal: `$${precioListaMXN("monthly")}` })}
                  </strong>{" "}
                  {t("comebackUntil", { fecha: fechaLarga(ofertaRegresoHasta, li) })}
                </>
              )}
            </p>
          </div>
        </div>
        {accion}
      </div>
    </div>
  );
}
