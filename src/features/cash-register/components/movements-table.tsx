"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { MovimientoCaja } from "../types/cash-register.types";

interface MovementsTableProps {
  movements: MovimientoCaja[];
  canAdd: boolean;
  onAdd: () => void;
}

export function MovementsTable({
  movements,
  canAdd,
  onAdd,
}: MovementsTableProps) {
  const t = useTranslations();

  return (
    <Card className="animate-fade-in-up stagger-6">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-medium">
          {t("finances.movements")}
        </CardTitle>
        {canAdd && (
          <Button
            onClick={onAdd}
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("finances.addMovement")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No hay movimientos registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.date")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.description")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.status")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  // VENTA es una entrada de dinero igual que ENTRADA (solo
                  // se contabiliza aparte para no duplicar la tarjeta "Ventas"),
                  // así que visualmente se trata como positiva, no como salida.
                  const esPositivo = movement.tipo !== "SALIDA";
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {new Date(movement.fecha).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.descripcion}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={esPositivo ? "default" : "destructive"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {t(`finances.movementTypes.${movement.tipo}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        <span
                          className={
                            esPositivo
                              ? "text-[#346538] dark:text-[#7BC67E]"
                              : "text-[#9F2F2D] dark:text-[#F2A5A4]"
                          }
                        >
                          {esPositivo ? "+" : "-"}$
                          {movement.monto.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}