"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BotonActualizar } from "@/components/ui/boton-actualizar";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { PlanGate } from "@/components/plan/plan-gate";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useMoneda } from "@/hooks/use-moneda";
import { localeIntl } from "@/lib/idioma";
import { obtenerConfigCatalogo } from "@/features/catalogo/catalogo-service";
import { estadoFinal } from "@/features/catalogo/pedido-envio";
import { DetallePedido } from "@/features/pedidos/components/detalle-pedido";
import { usePedidos } from "@/features/pedidos/use-pedidos";

type Filtro = "activos" | "todos";

/**
 * Pedidos del catálogo en línea (migración 141): lo que los clientes mandan desde la página pública. Lista con
 * filtro y detalle para confirmar, avanzar, avisar por WhatsApp o cancelar. Permiso `orders.manage`; el plan Pro o
 * Premium (`PlanGate`). Nada se escribe aquí directo: todo va por funciones de la base (`pedidos-service.ts`).
 */
function PedidosContenido() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { tenantName } = useCurrentTenant();
  const { formatear } = useMoneda();
  const { tenantId, pedidos, cargando, error, refrescar } = usePedidos();
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  // El enlace del catálogo, para que el aviso por WhatsApp lleve el seguimiento.
  useEffect(() => {
    if (!tenantId) return;
    let vigente = true;
    obtenerConfigCatalogo(tenantId)
      .then((c) => vigente && setSlug(c?.slug ?? null))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const visibles = useMemo(
    () => (filtro === "activos" ? pedidos.filter((p) => !estadoFinal(p.estado)) : pedidos),
    [pedidos, filtro]
  );
  const nuevos = pedidos.filter((p) => p.estado === "nuevo").length;
  const seleccionado = pedidos.find((p) => p.id === abierto) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <EncabezadoModulo titulo={t("title")} descripcion={t("subtitle")} />
        </div>
        <BotonActualizar onActualizar={refrescar} />
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label={t("filters.label")}>
        {(["activos", "todos"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filtro === f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filtro === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
        {nuevos > 0 && <Badge variant="secondary">{t("newCount", { count: nuevos })}</Badge>}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{t("loadError")}</CardContent>
        </Card>
      ) : cargando ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{t("loading")}</CardContent>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t("empty")}</p>
            <p className="max-w-md text-xs text-muted-foreground">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setAbierto(p.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    #{p.folio} · {p.cliente_nombre}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(`delivery.${p.entrega}`)} ·{" "}
                    {new Date(p.creado_en).toLocaleString(localeIntl(locale), { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold">{formatear(p.total)}</span>
                  <Badge variant={p.estado === "nuevo" ? "default" : p.estado === "cancelado" ? "destructive" : "secondary"}>
                    {t(`status.${p.estado}`)}
                  </Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {seleccionado && (
        <DetallePedido
          pedido={seleccionado}
          slug={slug}
          negocio={tenantName}
          onCerrar={() => setAbierto(null)}
          onCambio={refrescar}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <PlanGate funcion="pedidos">
      <PedidosContenido />
    </PlanGate>
  );
}
