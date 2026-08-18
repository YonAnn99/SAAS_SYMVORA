"use client";

import { Check, FileText, Pencil, Plus, Send, Trash2 } from "lucide-react";
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
import type { OrdenCompra } from "../../types/inventory.types";
import {
  orderEstadoColors,
  orderEstadoLabels,
} from "../../services/purchase-order-service";

interface PurchaseOrdersTableProps {
  orders: OrdenCompra[];
  filteredOrders: OrdenCompra[];
  loading: boolean;
  getSupplierName: (supplierId: string) => string;
  onEdit: (order: OrdenCompra) => void;
  onDelete: (order: OrdenCompra) => void;
  onAdd: () => void;
  onStatusChange: (order: OrdenCompra, newStatus: OrdenCompra["estado"]) => void;
}

export function PurchaseOrdersTable({
  orders,
  filteredOrders,
  loading,
  getSupplierName,
  onEdit,
  onDelete,
  onAdd,
  onStatusChange,
}: PurchaseOrdersTableProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            Órdenes de Compra
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {orders.length} órdenes
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <FileText className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {orders.length === 0
                ? "No hay órdenes de compra"
                : "No se encontraron órdenes"}
            </p>
            <Button
              size="sm"
              className="h-8 mt-1 active:scale-[0.98] transition-transform"
              onClick={onAdd}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva orden
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    N° Orden
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Proveedor
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Fecha
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Estado
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.numero_orden}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getSupplierName(order.proveedor_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.creado_en).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${orderEstadoColors[order.estado]} text-[10px] px-1.5 py-0`}
                      >
                        {orderEstadoLabels[order.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${order.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.estado === "BORRADOR" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onEdit(order)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-600"
                              onClick={() => onStatusChange(order, "ENVIADA")}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Enviar
                            </Button>
                          </>
                        )}
                        {order.estado === "ENVIADA" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-600"
                            onClick={() =>
                              onStatusChange(order, "RECIBIDA_TOTAL")
                            }
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Recibir
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => onDelete(order)}
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