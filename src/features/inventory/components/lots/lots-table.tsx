"use client";

import { Calendar, Pencil, Trash2 } from "lucide-react";
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
import type { Lote } from "../../types/inventory.types";
import { getDaysUntilExpiry } from "../../services/lot-service";

interface LotsTableProps {
  lots: Lote[];
  filteredLots: Lote[];
  loading: boolean;
  getProductName: (productId: string) => string;
  onEdit: (lot: Lote) => void;
  onDelete: (lot: Lote) => void;
  onAdd: () => void;
}

function getExpiryBadge(fechaCaducidad: string | null) {
  const days = getDaysUntilExpiry(fechaCaducidad);
  if (days === null) return null;

  if (days < 0) {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        Vencido
      </Badge>
    );
  }
  if (days <= 7) {
    return (
      <Badge
        variant="destructive"
        className="text-[10px] px-1.5 py-0 bg-orange-500"
      >
        {days} días
      </Badge>
    );
  }
  if (days <= 30) {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800"
      >
        {days} días
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800"
    >
      {days} días
    </Badge>
  );
}

export function LotsTable({
  lots,
  filteredLots,
  loading,
  getProductName,
  onEdit,
  onDelete,
  onAdd,
}: LotsTableProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Lotes</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {lots.length} lotes
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Calendar className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {lots.length === 0
                ? "No hay lotes creados"
                : "No se encontraron lotes"}
            </p>
            <Button
              size="sm"
              className="h-8 mt-1 active:scale-[0.98] transition-transform"
              onClick={onAdd}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Agregar lote
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Producto
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    N° Lote
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Cantidad
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Fecha Caducidad
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Costo Unitario
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Estado
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium text-sm">
                      {getProductName(lot.producto_id)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {lot.numero_lote}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {lot.cantidad}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.fecha_caducidad ? (
                        <div className="flex items-center gap-2">
                          {new Date(lot.fecha_caducidad).toLocaleDateString(
                            "es-MX"
                          )}
                          {getExpiryBadge(lot.fecha_caducidad)}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${lot.costo_unitario.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          lot.estado === "ACTIVO" ? "secondary" : "destructive"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {lot.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onEdit(lot)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => onDelete(lot)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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