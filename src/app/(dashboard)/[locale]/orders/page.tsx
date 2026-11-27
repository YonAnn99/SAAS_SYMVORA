"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BotonActualizar } from "@/components/ui/boton-actualizar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdministrarEstados } from "@/features/pedidos/components/administrar-estados";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { PlanGate } from "@/components/plan/plan-gate";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useMoneda } from "@/hooks/use-moneda";
import { localeIntl } from "@/lib/idioma";
import { obtenerConfigCatalogo } from "@/features/catalogo/catalogo-service";
import { estaCerrado } from "@/features/pedidos/transiciones";
import { fetchEstadosPedido } from "@/features/pedidos/pedidos-service";
import type { EstadoPropio } from "@/features/pedidos/types";
import { DetallePedido } from "@/features/pedidos/components/detalle-pedido";
import { usePedidos } from "@/features/pedidos/use-pedidos";

type Filtro = "activos" | "porCobrar" | "todos";

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
  const [estados, setEstados] = useState<EstadoPropio[]>([]);
  const [administrando, setAdministrando] = useState(false);

  // Los estados propios del negocio: se crean la primera vez y se recargan al cambiarlos.
  const cargarEstados = useCallback(async () => {
    if (!tenantId) return;
    try {
      setEstados(await fetchEstadosPedido(tenantId));
    } catch {
      toast.error(t("loadError"));
    }
  }, [tenantId, t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarEstados();
  }, [cargarEstados]);

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
    () =>
      filtro === "activos"
        ? pedidos.filter((p) => !estaCerrado(p.estado))
        : filtro === "porCobrar"
          ? pedidos.filter((p) => !p.pagado && p.estado !== "cancelado" && p.estado !== "nuevo")
          : pedidos,
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAdministrando(true)}>
            {t("v2.manageStates")}
          </Button>
          <BotonActualizar onActualizar={refrescar} />
        </div>
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label={t("filters.label")}>
        {(["activos", "porCobrar", "todos"] as const).map((f) => (
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
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: p.estado_color ?? "#64748B" }}
                  >
                    {p.estado_nombre ?? t(`status.${p.estado}`)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{p.pagado ? t("v2.paid") : t("v2.unpaid")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={administrando} onOpenChange={setAdministrando}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("v2.manage.title")}</DialogTitle>
          </DialogHeader>
          {tenantId && (
            <AdministrarEstados
              tenantId={tenantId}
              estados={estados}
              onCambio={cargarEstados}
              onVolver={() => setAdministrando(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {seleccionado && (
        <DetallePedido
          pedido={seleccionado}
          slug={slug}
          negocio={tenantName}
          tenantId={tenantId ?? ""}
          estados={estados}
          onCerrar={() => setAbierto(null)}
          onCambio={refrescar}
          onEstados={cargarEstados}
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
