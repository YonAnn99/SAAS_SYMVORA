"use client";

import { useState } from "react";
import { CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCerrarSesion } from "@/components/layout/cerrar-sesion";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { DescargaDatosCuenta } from "@/features/payments/components/descarga-datos-cuenta";
import { diasRestantes, fechaLegible } from "./baja";
import { avisarCambioDeBaja, useSolicitudBaja } from "./use-solicitud-baja";

/**
 * Pantalla que tapa el panel mientras corre el plazo de una baja (migracion
 * 128): «la cuenta se bloquea al momento». Quien la pidio puede cancelarla;
 * el equipo de un negocio que se cierra solo ve el aviso.
 *
 * Es el aviso, no la proteccion: los datos siguen ahi hasta que el cron
 * ejecute la baja, y la suscripcion ya se cancelo al pedirla.
 */
export function BajaPendiente() {
  const { baja } = useSolicitudBaja();
  const { tenantName, tenantId } = useCurrentTenant();
  const { salir } = useCerrarSesion();
  const [cancelando, setCancelando] = useState(false);

  if (!baja) return null;
  const { solicitud, propia } = baja;
  const fecha = fechaLegible(solicitud.ejecutar_en);
  const dias = diasRestantes(solicitud.ejecutar_en);

  async function cancelar() {
    setCancelando(true);
    try {
      const res = await fetch("/api/cuenta/eliminar", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(
        solicitud.es_dueno
          ? "Cancelaste la eliminación. Reactiva tu plan en Suscripción para seguir vendiendo."
          : "Cancelaste la eliminación de tu cuenta."
      );
      avisarCambioDeBaja();
    } catch {
      toast.error("No se pudo cancelar. Escríbenos a hola@symvora.com.mx");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="baja-titulo"
      className="fixed inset-0 z-[60] overflow-y-auto bg-background/95 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto my-8 w-full max-w-md space-y-4">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
          <CalendarX2 className="h-6 w-6" aria-hidden />
        </span>
        <h2 id="baja-titulo" className="text-lg font-semibold">
          {propia
            ? "Tu cuenta se eliminará"
            : `${tenantName || "Este negocio"} se va a cerrar`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {propia
            ? `Pediste eliminar tu cuenta${solicitud.es_dueno ? " y tu negocio" : ""}. Se borrará el ${fecha}`
            : `El dueño pidió cerrar el negocio. Se borrará el ${fecha}`}
          {dias > 0 ? ` (faltan ${dias} ${dias === 1 ? "día" : "días"}).` : "."}
          {propia ? " Si cambias de opinión, cancela la solicitud." : ""}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {propia && (
            <Button onClick={() => void cancelar()} disabled={cancelando}>
              {cancelando ? "Cancelando…" : "Cancelar la eliminación"}
            </Button>
          )}
          <Button variant="outline" onClick={() => void salir()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
      {/* Durante el plazo el dueño todavia puede llevarse su informacion. */}
      {propia && solicitud.es_dueno && tenantId && (
        <DescargaDatosCuenta tenantId={tenantId} limite={new Date(solicitud.ejecutar_en)} />
      )}
      </div>
    </div>
  );
}
