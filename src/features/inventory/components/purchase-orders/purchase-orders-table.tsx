"use client";

import { Check, FileText, Loader2, Pencil, Send } from "lucide-react";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { WhatsAppLogo } from "@/components/marketing/whatsapp-logo";
import { normalizarTelefonoMx } from "@/lib/whatsapp";
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
import type { OrdenCompra } from "../../types/inventory.types";
import {
  orderEstadoColors,
  orderEstadoLabels,
} from "../../services/purchase-order-service";
import { PurchaseOrderSwipeList } from "./purchase-order-swipe-list";

interface PurchaseOrdersTableProps {
  orders: OrdenCompra[];
  filteredOrders: OrdenCompra[];
  loading: boolean;
  getSupplierName: (supplierId: string) => string;
  onEdit: (order: OrdenCompra) => void;
  /** `false` si no se pudo borrar (la fila deslizable del celular reaparece). */
  onDelete: (order: OrdenCompra) => void | Promise<boolean | void>;
  onAdd: () => void;
  onStatusChange: (order: OrdenCompra, newStatus: OrdenCompra["estado"]) => void;
  /** Abre el diálogo de recepción. */
  onReceive: (order: OrdenCompra) => void;
  /**
   * Envia la orden en PDF por WhatsApp y, si es borrador, la marca como
   * enviada (ver `handleWhatsApp`).
   */
  onWhatsApp: (order: OrdenCompra) => void;
  /** La orden que se esta preparando para WhatsApp, para el spinner. */
  enviandoId?: string | null;
  /** Abre el desglose de la orden (clic en la fila). */
  onOpen: (order: OrdenCompra) => void;
  /** Teléfono del proveedor, para saber si se puede ofrecer WhatsApp. */
  getSupplierPhone: (supplierId: string) => string | null;
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
  onReceive,
  onWhatsApp,
  enviandoId = null,
  onOpen,
  getSupplierPhone,
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
            <SpecularActionButton
              tone="add"
              className="h-8 mt-1"
              onClick={onAdd}
            >

              Nueva orden
            </SpecularActionButton>
          </div>
        ) : (
          <>
          {/* Celular: una pastilla por orden. Izquierda: eliminar/WhatsApp;
              derecha: recibir; lapiz: editar el borrador; tocar: desglose. */}
          <div className="md:hidden">
            <PurchaseOrderSwipeList
              ordenes={filteredOrders}
              getSupplierName={getSupplierName}
              getSupplierPhone={getSupplierPhone}
              enviandoId={enviandoId}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onWhatsApp={onWhatsApp}
              onStatusChange={onStatusChange}
              onReceive={onReceive}
            />
          </div>
          <div className="hidden overflow-x-auto md:block">
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
                {filteredOrders.map((order) => {
                  // Sin telefono valido no hay WhatsApp, y "Enviar" es la
                  // unica forma de avanzar la orden. Con telefono, WhatsApp
                  // ya la envia: dos botones que hacen lo mismo sobran.
                  const tieneWhatsApp = !!normalizarTelefonoMx(
                    getSupplierPhone(order.proveedor_id)
                  );
                  const enviando = enviandoId === order.id;
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => onOpen(order)}
                    >
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
                      {/* Los botones hacen su propia accion: sin esto, cada
                          clic abriria tambien el desglose. */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                              {!tieneWhatsApp && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-blue-600 hover:text-blue-600"
                                  onClick={() => onStatusChange(order, "ENVIADA")}
                                  title="Marcar como enviada (el proveedor no tiene WhatsApp)"
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Enviar
                                </Button>
                              )}
                            </>
                          )}
                          {/* WhatsApp solo mientras tiene sentido mandar el
                              pedido, y solo si el teléfono se puede normalizar:
                              un enlace a un número adivinado abre el chat de un
                              desconocido. */}
                          {(order.estado === "BORRADOR" ||
                            order.estado === "ENVIADA") &&
                            tieneWhatsApp && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-600"
                                onClick={() => onWhatsApp(order)}
                                disabled={enviando}
                                title={
                                  order.estado === "BORRADOR"
                                    ? "Enviar la orden en PDF por WhatsApp"
                                    : "Reenviar la orden en PDF por WhatsApp"
                                }
                              >
                                {enviando ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  // El logo real de WhatsApp (el mismo de la
                                  // landing); el texto del boton ya lo nombra.
                                  <WhatsAppLogo
                                    size={14}
                                    className="mr-1"
                                    aria-hidden="true"
                                  />
                                )}
                                WhatsApp
                              </Button>
                            )}
                          {/* También en RECIBIDA_PARCIAL: la segunda entrega se
                              recibe igual que la primera. */}
                          {(order.estado === "ENVIADA" ||
                            order.estado === "RECIBIDA_PARCIAL") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600 hover:text-green-600"
                              onClick={() => onReceive(order)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Recibir
                            </Button>
                          )}
                          <BotonEliminar
                            nombre={`la orden ${order.numero_orden}`}
                            detalle="No se puede deshacer"
                            onEliminar={async () => {
                              await onDelete(order);
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}