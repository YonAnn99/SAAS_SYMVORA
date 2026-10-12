"use client";

import { Calendar, History, Pencil } from "lucide-react";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { Button } from "@/components/ui/button";
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
import type { LoteConExistencias } from "../../services/lot-service";
import { diasParaCaducar, estadoCaducidad, existenciaEn } from "../../lotes";

interface LotsTableProps {
  lots: LoteConExistencias[];
  filteredLots: LoteConExistencias[];
  loading: boolean;
  getProductName: (lot: LoteConExistencias) => string;
  nombreSucursal: (id: string) => string;
  /** Con una sucursal elegida arriba, la cantidad que se muestra es la de ella. */
  sucursalSeleccionada: string | null;
  onEdit: (lot: LoteConExistencias) => void;
  onDelete: (lot: LoteConExistencias) => void;
  onVer: (lot: LoteConExistencias) => void;
  onAdd: () => void;
}

export function BadgeCaducidad({ fecha }: { fecha: string | null }) {
  const estado = estadoCaducidad(fecha);
  const dias = diasParaCaducar(fecha);
  if (!estado || dias === null) return null;

  if (estado === "vencido") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        Caducado
      </Badge>
    );
  }
  const clase =
    estado === "critico"
      ? "bg-orange-500 text-white"
      : estado === "pronto"
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
        : "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300";
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${clase}`}>
      {dias === 0 ? "Hoy" : `${dias} días`}
    </Badge>
  );
}

function fechaCorta(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX");
}

export function LotsTable({
  lots,
  filteredLots,
  loading,
  getProductName,
  nombreSucursal,
  sucursalSeleccionada,
  onEdit,
  onDelete,
  onVer,
  onAdd,
}: LotsTableProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Lotes</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {filteredLots.length} de {lots.length} lotes
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
              {lots.length === 0 ? "No hay lotes registrados" : "No se encontraron lotes"}
            </p>
            <SpecularActionButton tone="add" className="h-8 mt-1" onClick={onAdd}>
              Registrar lote
            </SpecularActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">N° Lote</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Existencia</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Caducidad</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Costo</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => {
                  const enSucursales = (lot.existencias_lote ?? []).filter((e) => Number(e.cantidad) > 0);
                  const cantidad = existenciaEn(lot.existencias_lote, sucursalSeleccionada);
                  return (
                    <TableRow key={lot.id} className="cursor-pointer" onClick={() => onVer(lot)}>
                      <TableCell className="font-medium text-sm">{getProductName(lot)}</TableCell>
                      <TableCell className="text-sm font-mono">{lot.numero_lote}</TableCell>
                      <TableCell className="text-right text-sm">
                        {cantidad > 0 ? (
                          <span className="font-mono">{cantidad}</span>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Agotado
                          </Badge>
                        )}
                        {!sucursalSeleccionada && enSucursales.length > 1 && (
                          <span className="block text-[10px] text-muted-foreground">
                            {enSucursales
                              .map((e) => `${nombreSucursal(e.sucursal_id)} ${Number(e.cantidad)}`)
                              .join(" · ")}
                          </span>
                        )}
                        {!sucursalSeleccionada && enSucursales.length === 1 && (
                          <span className="block text-[10px] text-muted-foreground">
                            {nombreSucursal(enSucursales[0].sucursal_id)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lot.fecha_caducidad ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {fechaCorta(lot.fecha_caducidad)}
                            <BadgeCaducidad fecha={lot.fecha_caducidad} />
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        ${Number(lot.costo_unitario).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onVer(lot)}
                            aria-label={`Movimientos del lote ${lot.numero_lote}`}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onEdit(lot)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <BotonEliminar
                            nombre={`el lote ${lot.numero_lote}`}
                            detalle="Las piezas no se borran del inventario: quedan sin lote. Un lote con ventas o traspasos no se puede eliminar."
                            onEliminar={() => onDelete(lot)}
                          />
                        </div>
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
