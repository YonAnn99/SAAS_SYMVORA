"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizarDetalles } from "@/features/activity/format-details";
import { SelectSimple } from "@/components/ui/select-simple";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Package,
  ShoppingCart,
  ShoppingCartIcon,
  Users,
  User,
  Wallet,
  Settings,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  Banknote,
  Printer,
  BadgePercent,
  Clock,
  ArrowLeftRight,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { BotonActualizar } from "@/components/ui/boton-actualizar";

interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  entity: string;
  entity_name: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  producto: Package,
  venta: ShoppingCart,
  compra: ShoppingCartIcon,
  cliente: Users,
  proveedor: Package,
  usuario: User,
  caja: Wallet,
  config: Settings,
  orden_compra: ClipboardList,
  movimiento_caja: Banknote,
  traspaso: ArrowLeftRight,
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  REIMPRIMIR: Printer,
  DESCUENTO: BadgePercent,
  AUTO_CLOSE: Clock,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  // Ambar, no verde: no es una alta, es algo que conviene mirar dos veces.
  REIMPRIMIR:
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  // Ambar por lo mismo: un descuento manual es dinero que no entro.
  DESCUENTO:
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  AUTO_CLOSE: "bg-muted text-muted-foreground",
};

const ACTION_KEYS: Record<string, string> = {
  CREATE: "common.create",
  UPDATE: "common.update",
  DELETE: "common.delete",
  REIMPRIMIR: "common.reprint",
  DESCUENTO: "common.discount",
  AUTO_CLOSE: "common.autoClose",
};

const ENTITY_KEYS: Record<string, string> = {
  producto: "common.product",
  productos: "common.product",
  venta: "common.sale",
  ventas: "common.sale",
  compra: "common.purchase",
  compras: "common.purchase",
  cliente: "common.customer",
  clientes: "common.customer",
  proveedor: "common.supplier",
  proveedores: "common.supplier",
  usuario: "common.user",
  usuarios: "common.user",
  caja: "common.cashRegister",
  cajas: "common.cashRegister",
  config: "common.settings",
  orden_compra: "common.ordenCompra",
  ordenes_compra: "common.ordenCompra",
  movimientos_caja: "common.movimientoCaja",
  movimiento_caja: "common.movimientoCaja",
  traspaso: "common.traspaso",
};

const PAGE_SIZE = 50;

export default function ActivityPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Celular: el registro que se abrió tocando su pastilla.
  const [seleccionado, setSeleccionado] = useState<ActivityLog | null>(null);

  const fetchLogs = useCallback(async (offset = 0) => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (offset === 0) {
      setLogs(data || []);
    } else {
      setLogs((prev) => [...prev, ...(data || [])]);
    }
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [tenantId]);

  // `loading` ya nace en true. La carga va diferida, como en el resto del
  // proyecto: un setState síncrono dentro del efecto encadena renders
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (tenantLoading || !tenantId) return;
    const timeout = window.setTimeout(() => void fetchLogs(0), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, tenantId, fetchLogs]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    void fetchLogs(logs.length);
  }, [logs.length, fetchLogs]);

  const filteredLogs = entityFilter === "all"
    ? logs
    : logs.filter((log) => {
        const filterMap: Record<string, string[]> = {
          producto: ["producto", "productos"],
          venta: ["venta", "ventas"],
          compra: ["compra", "compras"],
          cliente: ["cliente", "clientes"],
          proveedor: ["proveedor", "proveedores"],
          usuario: ["usuario", "usuarios"],
          caja: ["caja", "cajas"],
          orden_compra: ["orden_compra", "ordenes_compra"],
          movimiento_caja: ["movimiento_caja", "movimientos_caja"],
          traspaso: ["traspaso"],
        };
        return filterMap[entityFilter]?.includes(log.entity) || log.entity === entityFilter;
      });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // El parámetro es `unknown` a propósito: `details` es jsonb y puede no ser un
  // objeto. La normalización (y el porqué) vive en `features/activity`.
  const formatDetails = (details: unknown) => {
    const normalizado = normalizarDetalles(details);

    if (normalizado.tipo === "vacio") return "-";

    // Texto suelto: se muestra entero. NUNCA con Object.entries, que sobre una
    // cadena devuelve pares índice/carácter y producía `0: { 1: " 2: f …`.
    if (normalizado.tipo === "texto") {
      return <span className="font-medium break-all">{normalizado.texto}</span>;
    }

    return normalizado.pares.map(({ clave, etiqueta, valor }) => (
      <span key={clave} className="inline-flex items-center gap-1 mr-2">
        <span className="text-muted-foreground">{etiqueta}:</span>
        <span className="font-medium">{valor}</span>
      </span>
    ));
  };

  // Con `items` (vía SelectSimple) el botón muestra «Todos», no el valor crudo
  // «all»: el Select de Base UI pinta el valor si no tiene el mapa.
  const opcionesFiltro = [
    { value: "all", label: t("common.all") },
    { value: "producto", label: t("common.product") },
    { value: "venta", label: t("common.sale") },
    { value: "compra", label: t("common.purchase") },
    { value: "cliente", label: t("common.customer") },
    { value: "proveedor", label: t("common.supplier") },
    { value: "usuario", label: t("common.user") },
    { value: "caja", label: t("common.cashRegister") },
    { value: "orden_compra", label: t("common.ordenCompra") },
    { value: "movimiento_caja", label: t("common.movimientoCaja") },
    { value: "traspaso", label: t("common.traspaso") },
  ];

  // Lo mismo en la tabla, la pastilla y la ventana de detalle.
  const insigniaAccion = (log: ActivityLog) => {
    const ActionIcon = ACTION_ICONS[log.action] || Plus;
    return (
      <Badge
        variant="secondary"
        className={`text-[10px] px-1.5 py-0 gap-1 shrink-0 ${ACTION_COLORS[log.action] || ""}`}
      >
        <ActionIcon className="h-3 w-3" />
        {t(ACTION_KEYS[log.action] || "common.action")}
      </Badge>
    );
  };

  const nombreEntidad = (log: ActivityLog) =>
    ENTITY_KEYS[log.entity] ? t(ENTITY_KEYS[log.entity]) : log.entity;

  const detallesDe = seleccionado ? normalizarDetalles(seleccionado.details) : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <EncabezadoModulo
            titulo={t("common.activityLog")}
            descripcion={t("common.activityDescription")}
          />
        </div>
        <SelectSimple
          value={entityFilter}
          onChange={(v) => setEntityFilter(v || "all")}
          opciones={opcionesFiltro}
          placeholder={t("common.filter")}
          ariaLabel={t("common.filter")}
          className="h-8 sm:w-[160px]"
        />
        <BotonActualizar className="self-start sm:self-auto" onActualizar={() => fetchLogs(0)} />
      </div>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("common.activityLog")}
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredLogs.length} {t("common.records")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {t("common.noActivity")}
              </p>
            </div>
          ) : (
            <>
              {/* Celular: una pastilla por registro (usuario, acción y entidad);
                  al tocarla se abre la ventana con todo. Sin deslizar. */}
              <ul className="space-y-2 md:hidden">
                {filteredLogs.map((log) => {
                  const EntityIcon = ENTITY_ICONS[log.entity] || Package;
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        onClick={() => setSeleccionado(log)}
                        className="w-full rounded-xl border bg-card p-3 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">{log.user_email}</span>
                          {insigniaAccion(log)}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-sm">
                          <EntityIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="shrink-0">{nombreEntidad(log)}</span>
                          {log.entity_name && (
                            <span className="min-w-0 truncate text-muted-foreground">— {log.entity_name}</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider w-[160px]">
                      {t("common.date")}
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      {t("common.user")}
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      {t("common.action")}
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      {t("common.entity")}
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      {t("common.details")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const EntityIcon = ENTITY_ICONS[log.entity] || Package;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user_email}
                        </TableCell>
                        <TableCell>{insigniaAccion(log)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{nombreEntidad(log)}</span>
                            {log.entity_name && (
                              <span className="text-muted-foreground">
                                — {log.entity_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                          <div className="flex flex-wrap">
                            {formatDetails(log.details)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              {hasMore && entityFilter === "all" && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? t("common.loading") : t("common.loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detalle completo de un registro (celular: al tocar su pastilla). */}
      <Dialog open={!!seleccionado} onOpenChange={(abierto) => !abierto && setSeleccionado(null)}>
        <DialogContent className="max-w-md">
          {seleccionado && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t(ACTION_KEYS[seleccionado.action] || "common.action")} · {nombreEntidad(seleccionado)}
                </DialogTitle>
              </DialogHeader>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
                  <dd className="font-medium">{formatDate(seleccionado.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.user")}</dt>
                  <dd className="font-medium break-all">{seleccionado.user_email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.action")}</dt>
                  <dd className="mt-0.5">{insigniaAccion(seleccionado)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.entity")}</dt>
                  <dd className="font-medium">
                    {nombreEntidad(seleccionado)}
                    {seleccionado.entity_name && (
                      <span className="text-muted-foreground"> — {seleccionado.entity_name}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.details")}</dt>
                  <dd className="mt-0.5">
                    {!detallesDe || detallesDe.tipo === "vacio" ? (
                      "-"
                    ) : detallesDe.tipo === "texto" ? (
                      <span className="font-medium break-words">{detallesDe.texto}</span>
                    ) : (
                      <ul className="space-y-1">
                        {detallesDe.pares.map(({ clave, etiqueta, valor }) => (
                          <li key={clave} className="flex flex-wrap gap-x-1">
                            <span className="text-muted-foreground">{etiqueta}:</span>
                            <span className="font-medium break-words">{valor}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
