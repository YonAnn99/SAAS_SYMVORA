"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  entity: string;
  entity_name: string | null;
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

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Crear",
  UPDATE: "Actualizar",
  DELETE: "Eliminar",
};

const ENTITY_LABELS: Record<string, string> = {
  producto: "Producto",
  venta: "Venta",
  compra: "Compra",
  cliente: "Cliente",
  proveedor: "Proveedor",
  usuario: "Usuario",
  caja: "Caja",
  config: "Configuración",
};

export default function ActivityPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      fetchLogs();
    }
  }, [tenantLoading, tenantId]);

  const fetchLogs = async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    setLogs(data || []);
    setLoading(false);
  };

  const filteredLogs = entityFilter === "all"
    ? logs
    : logs.filter((log) => log.entity === entityFilter);

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

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("common.activityLog")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de todas las acciones realizadas
          </p>
        </div>
        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v || "all")}>
          <SelectTrigger className="w-full sm:w-[160px] h-8">
            <SelectValue placeholder={t("common.filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
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
              {filteredLogs.length} registros
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
                No hay registros de actividad
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider w-[160px]">
                    {t("common.date")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Usuario
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Acción
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Entidad
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Detalles
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
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{ENTITY_LABELS[log.entity] || log.entity}</span>
                          {log.entity_name && (
                            <span className="text-muted-foreground">
                              — {log.entity_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
