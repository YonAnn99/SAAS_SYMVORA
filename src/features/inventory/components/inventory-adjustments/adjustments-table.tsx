"use client";

import { ArrowDown, ArrowUp, Wrench } from "lucide-react";
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
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            Historial de Ajustes
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {adjustments.length} ajustes
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Wrench className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {adjustments.length === 0
                ? "No hay ajustes registrados"
                : "No se encontraron ajustes"}
            </p>
            <SpecularActionButton
              tone="add"
              className="h-8 mt-1"
              onClick={onAdd}
            >

              Nuevo ajuste
            </SpecularActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Fecha
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Producto
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Motivo
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Anterior
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Ajuste
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Nuevo
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Notas
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="text-sm">
                      {new Date(adj.creado_en).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {getProductName(adj.producto_id)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {motivoLabels[adj.motivo]}
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