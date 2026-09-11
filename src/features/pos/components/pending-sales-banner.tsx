"use client";

/**
 * Aviso de ventas cobradas que todavía no llegaron al servidor.
 *
 * No es decorativo. En iOS no existe Background Sync y el navegador puede
 * desalojar el almacenamiento local, así que este banner es lo único que le
 * dice a una persona "todavía no cierres el día". Por eso no se puede
 * descartar: desaparece únicamente cuando la cola se vacía de verdad.
 *
 * El tono **escala con la antigüedad** de la venta más vieja (ver
 * `evaluateOfflineRisk`). Un aviso que dice siempre lo mismo se vuelve paisaje
 * en dos días; uno que sube de tono cuando el riesgo real sube, no.
 */

import { CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldWarnAboutIosInstall } from "@/lib/offline/persist";
import {
  evaluateOfflineRisk,
  formatOfflineAge,
  type OfflineUrgency,
} from "@/lib/offline/capabilities";

interface PendingSalesBannerProps {
  pendingCount: number;
  failedCount: number;
  syncing: boolean;
  needsReauth: boolean;
  oldestPendingAt: string | null;
  onSyncNow: () => void;
}

const URGENCY_STYLES: Record<OfflineUrgency, string> = {
  ok: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  atencion:
    "border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  urgente:
    "border-orange-500/70 bg-orange-500/20 text-orange-950 dark:text-orange-100",
  critico:
    "border-red-500/70 bg-red-500/20 text-red-950 dark:text-red-100 ring-1 ring-red-500/30",
};

export function PendingSalesBanner({
  pendingCount,
  failedCount,
  syncing,
  needsReauth,
  oldestPendingAt,
  onSyncNow,
}: PendingSalesBannerProps) {
  const total = pendingCount + failedCount;
  if (total === 0) return null;

  const risk = evaluateOfflineRisk(oldestPendingAt);
  const warnIosInstall = shouldWarnAboutIosInstall();
  const isSevere = risk.urgency === "urgente" || risk.urgency === "critico";

  return (
    <div
      role="status"
      aria-live={isSevere ? "assertive" : "polite"}
      className={`rounded-lg border px-3 py-2 text-sm ${URGENCY_STYLES[risk.urgency]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {syncing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : isSevere ? (
          <TriangleAlert className="h-4 w-4 shrink-0" />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0" />
        )}

        <span className="font-medium">
          {syncing
            ? `Subiendo ${total} ${total === 1 ? "venta" : "ventas"}…`
            : `${total} ${total === 1 ? "venta cobrada" : "ventas cobradas"} sin subir`}
          {!syncing && oldestPendingAt && risk.urgency !== "ok" && (
            <span className="font-normal opacity-90">
              {" "}
              · la más antigua lleva {formatOfflineAge(risk.hoursOffline)}
            </span>
          )}
        </span>

        {!syncing && (
          <Button
            size="sm"
            variant={isSevere ? "default" : "outline"}
            onClick={onSyncNow}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Intentar ahora
          </Button>
        )}
      </div>

      {risk.title && !syncing && (
        <p className="mt-1.5 text-xs">
          <strong>{risk.title}.</strong> {risk.message}
        </p>
      )}

      {needsReauth && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Tu sesión expiró. Las ventas están guardadas — vuelve a iniciar
            sesión para que se suban.
          </span>
        </p>
      )}

      {failedCount > 0 && !needsReauth && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {failedCount} {failedCount === 1 ? "venta no pudo" : "ventas no pudieron"}{" "}
            subirse tras varios intentos. No se han perdido, pero requieren
            revisión.
          </span>
        </p>
      )}

      {warnIosInstall && (
        <p className="mt-1.5 text-xs">
          Estás en Safari. Para vender sin conexión con seguridad, añade SYMVORA
          a la pantalla de inicio: compartir → &quot;Añadir a inicio&quot;.
        </p>
      )}
    </div>
  );
}
