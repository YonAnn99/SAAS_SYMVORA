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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

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
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
};

const ACTION_KEYS: Record<string, string> = {
  CREATE: "common.create",
  UPDATE: "common.update",
  DELETE: "common.delete",
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
  movimientos_caja: "common.movimientoCaja",
  movimiento_caja: "common.movimientoCaja",
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

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      setLoading(true);
      void fetchLogs(0);
    }
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

  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details) return "-";
    const entries = Object.entries(details).filter(([key]) => key !== "operation" && key !== "table");
    if (entries.length === 0) return "-";

    return entries.map(([key, value]) => {
      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const displayValue = typeof value === "boolean" ? (value ? "Sí" : "No") : String(value);
      return (
        <span key={key} className="inline-flex items-center gap-1 mr-2">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{displayValue}</span>
        </span>
      );
    });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("common.activityLog")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("common.activityDescription")}
          </p>
        </div>
        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v || "all")}>
          <SelectTrigger className="w-full sm:w-[160px] h-8">
            <SelectValue placeholder={t("common.filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="producto">{t("common.product")}</SelectItem>
            <SelectItem value="venta">{t("common.sale")}</SelectItem>
            <SelectItem value="compra">{t("common.purchase")}</SelectItem>
            <SelectItem value="cliente">{t("common.customer")}</SelectItem>
            <SelectItem value="proveedor">{t("common.supplier")}</SelectItem>
            <SelectItem value="usuario">{t("common.user")}</SelectItem>
            <SelectItem value="caja">{t("common.cashRegister")}</SelectItem>
            <SelectItem value="orden_compra">{t("common.ordenCompra")}</SelectItem>
            <SelectItem value="movimiento_caja">{t("common.movimientoCaja")}</SelectItem>
          </SelectContent>
        </Select>
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
                    const ActionIcon = ACTION_ICONS[log.action] || Plus;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user_email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 gap-1 ${ACTION_COLORS[log.action] || ""}`}
                          >
                            <ActionIcon className="h-3 w-3" />
                            {t(ACTION_KEYS[log.action] || "common.action")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{t(ENTITY_KEYS[log.entity] || log.entity)}</span>
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
    </div>
  );
}
