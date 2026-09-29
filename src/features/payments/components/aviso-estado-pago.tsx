"use client";

/**
 * Aviso fijo arriba del panel cuando la cuenta no tiene acceso completo
 * (migracion 096):
 *
 *   gracia        "No pudimos cobrar / tu mes vencio: te quedan N dias"
 *   solo_lectura  "Tu cuenta esta en solo lectura" + lo que tiene en juego
 *                 (productos y ventas guardados) + oferta de regreso
 *
 * Mostrar lo que tiene guardado es a proposito: la cuenta no se siente
 * perdida, se siente en pausa, y reactivar la devuelve tal cual.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useAccesoCuenta } from "@/hooks/use-acceso-cuenta";
import { PRECIO_PROMO_MXN, precioListaMXN } from "@/features/payments/promocion";

const fechaLarga = (d: Date) =>
  d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
const miles = (n: number) => n.toLocaleString("es-MX");

export function AvisoEstadoPago() {
  const { tenantId } = useCurrentTenant();
  const { can } = usePermissions();
  const pathname = usePathname();
  const { loading, acceso, estado, diasGracia, limiteDatos, ofertaRegresoHasta } =
    useAccesoCuenta();
  const [guardado, setGuardado] = useState<{ productos: number; ventas: number } | null>(null);

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
  if (loading || acceso === "completo" || pathname.startsWith("/billing")) return null;

  const puedePagar = can("subscription.manage");
  const accion = puedePagar ? (
    <Link
      href="/billing"
      className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
    >
      {soloLectura ? "Reactivar mi plan" : "Pagar ahora"}
    </Link>
  ) : (
    <span className="shrink-0 text-xs opacity-80">Avísale al dueño de la cuenta.</span>
  );

  if (!soloLectura) {
    const titulo =
      estado === "past_due" ? "No pudimos cobrar tu mensualidad." : "Tu mensualidad venció.";
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
              {diasGracia > 0
                ? `Tienes ${diasGracia} ${diasGracia === 1 ? "día" : "días"} para pagar sin perder el acceso.`
                : "Paga hoy para no perder el acceso."}
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
              <strong className="font-medium">Tu cuenta está en solo lectura.</strong>{" "}
              Puedes ver y descargar tu información, pero no registrar ventas ni cambios.
            </p>
            <p className="text-xs opacity-90">
              {guardado
                ? `Todo sigue intacto: ${miles(guardado.productos)} productos y ${miles(guardado.ventas)} ventas. `
                : "Todo sigue intacto. "}
              Reactiva tu plan y continúas donde te quedaste
              {limiteDatos ? ` (tus datos se conservan hasta el ${fechaLarga(limiteDatos)})` : ""}.
              {ofertaRegresoHasta && (
                <>
                  {" "}
                  <strong className="font-medium">
                    Regresa con tu primer mes a ${PRECIO_PROMO_MXN} en vez de $
                    {precioListaMXN("monthly")}
                  </strong>{" "}
                  hasta el {fechaLarga(ofertaRegresoHasta)}.
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
