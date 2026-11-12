"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Wrench } from "lucide-react";
import { localeIntl } from "@/lib/idioma";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AjusteInventario } from "../../types/inventory.types";
import { motivoLabels } from "../../services/inventory-adjustment-service";

interface AdjustmentsTableProps {
  adjustments: AjusteInventario[];
  filteredAdjustments: AjusteInventario[];
  loading: boolean;
  getProductName: (productId: string) => string;
  onAdd: () => void;
}

function getAdjustmentType(cantidad: number) {
  if (cantidad > 0) {
    return <ArrowUp className="h-4 w-4 text-green-500" />;
  }
  return <ArrowDown className="h-4 w-4 text-red-500" />;
}

export function AdjustmentsTable({
  adjustments,
  filteredAdjustments,
  loading,
  getProductName,
  onAdd,
}: AdjustmentsTableProps) {
  const t = useTranslations("products.adjustments");
  const locale = useLocale();
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            {t("historyTitle")}
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {t("count", { count: adjustments.length })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Wrench className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {adjustments.length === 0
                ? t("none")
                : t("noneFound")}
            </p>
            <SpecularActionButton
              tone="add"
              className="h-8 mt-1"
              onClick={onAdd}
            >

              {t("new")}
            </SpecularActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("colDate")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("colProduct")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("colReason")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("colBefore")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("colAdjustment")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("colAfter")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("colNotes")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="text-sm">
                      {new Date(adj.creado_en).toLocaleDateString(localeIntl(locale))}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {getProductName(adj.producto_id)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {adj.motivo in motivoLabels ? t(`reasons.${adj.motivo}`) : adj.motivo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {adj.cantidad_anterior}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <div className="flex items-center justify-end gap-1">
                        {getAdjustmentType(adj.cantidad_ajuste)}
                        <span
                          className={
                            adj.cantidad_ajuste > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {adj.cantidad_ajuste > 0 ? "+" : ""}
                          {adj.cantidad_ajuste}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-medium">
                      {adj.cantidad_nueva}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {adj.notas || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}