"use client";

/**
 * Las ordenes de compra en celular: una pastilla por orden en lugar de la
 * tabla (ver `components/ui/fila-deslizable.tsx`).
 *
 *   izquierda, a la mitad  -> Eliminar | WhatsApp (o Enviar, sin celular)
 *   izquierda, completo    -> Eliminar
 *   derecha                -> Recibir (solo si ya se envio)
 *   lapiz a un costado     -> Editar (solo en borrador; al enviar desaparece)
 *   tocar                  -> desglose
 *
 * Las reglas de que se puede en cada estado son las de la tabla.
 */

import { useState } from "react";
import { Check, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppLogo } from "@/components/marketing/whatsapp-logo";
import { normalizarTelefonoMx } from "@/lib/whatsapp";
import {
  COLOR_EDITAR,
  COLOR_ELIMINAR,
  FilaDeslizable,
  noArrastrar,
  usePistaDeslizar,
  type AccionFila,
} from "@/components/ui/fila-deslizable";
import type { OrdenCompra } from "../../types/inventory.types";
import {
  orderEstadoColors,
  orderEstadoLabels,
} from "../../services/purchase-order-service";

const COLOR_WHATSAPP = "#25D366";
const COLOR_RECIBIR = "#16a34a";

/** Recibir solo cuando ya se envio (o falta una segunda entrega). */
const puedeRecibir = (order: OrdenCompra) =>
  order.estado === "ENVIADA" || order.estado === "RECIBIDA_PARCIAL";

const firma = (ids: string[]) => ids.slice().sort().join(",");

interface PurchaseOrderSwipeListProps {
  ordenes: OrdenCompra[];
  getSupplierName: (supplierId: string) => string;
  getSupplierPhone: (supplierId: string) => string | null;
  enviandoId: string | null;
  onOpen: (order: OrdenCompra) => void;
  onEdit: (order: OrdenCompra) => void;
  onDelete: (order: OrdenCompra) => void | Promise<boolean | void>;
  onWhatsApp: (order: OrdenCompra) => void;
  onStatusChange: (order: OrdenCompra, newStatus: OrdenCompra["estado"]) => void;
  onReceive: (order: OrdenCompra) => void;
}

export function PurchaseOrderSwipeList({
  ordenes,
  getSupplierName,
  getSupplierPhone,
  enviandoId,
  onOpen,
  onEdit,
  onDelete,
  onWhatsApp,
  onStatusChange,
  onReceive,
}: PurchaseOrderSwipeListProps) {
  const { verPista, alAbrir } = usePistaDeslizar();

  // Aviso de "Recibir" (la pastilla se asoma a la derecha), UNA vez:
  //   - al entrar al modulo, en cada orden que ya se puede recibir (el estado
  //     inicial; la lista se monta de nuevo en cada visita);
  //   - cuando una orden que ya estaba ACABA de habilitarlo (p. ej. al
  //     enviarse por WhatsApp). Se compara con la lista anterior durante el
  //     render (patron de React para "estado previo").
  const idsActuales = firma(ordenes.map((o) => o.id));
  const recibiblesActuales = firma(ordenes.filter(puedeRecibir).map((o) => o.id));
  const [previo, setPrevio] = useState({ ids: idsActuales, recibibles: recibiblesActuales });
  const [avisos, setAvisos] = useState<Record<string, number>>(() =>
    Object.fromEntries(ordenes.filter(puedeRecibir).map((o) => [o.id, 1]))
  );
  if (previo.recibibles !== recibiblesActuales || previo.ids !== idsActuales) {
    const antes = new Set(previo.recibibles.split(",").filter(Boolean));
    const existian = new Set(previo.ids.split(",").filter(Boolean));
    const recienHabilitadas = ordenes.filter(
      (o) => puedeRecibir(o) && !antes.has(o.id) && existian.has(o.id)
    );
    setPrevio({ ids: idsActuales, recibibles: recibiblesActuales });
    if (recienHabilitadas.length > 0) {
      setAvisos((prev) => {
        const siguiente = { ...prev };
        for (const o of recienHabilitadas) siguiente[o.id] = (siguiente[o.id] ?? 0) + 1;
        return siguiente;
      });
    }
  }

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] leading-snug text-muted-foreground">
          Toca para ver la orden · desliza a la izquierda para enviar o eliminar, a la
          derecha para recibir
        </p>
      )}

      {ordenes.map((order) => {
        // Sin telefono valido no hay WhatsApp (un enlace a un numero adivinado
        // abre el chat de un desconocido); "Enviar" solo marca la orden.
        const tieneWhatsApp = !!normalizarTelefonoMx(getSupplierPhone(order.proveedor_id));
        const enviando = enviandoId === order.id;
        const borrador = order.estado === "BORRADOR";

        const acciones: AccionFila[] = [
          {
            id: "eliminar",
            etiqueta: "Eliminar",
            color: COLOR_ELIMINAR,
            icono: <Trash2 size={18} strokeWidth={2} />,
            alElegir: () => onDelete(order),
            confirmar: { titulo: `¿Eliminar la orden ${order.numero_orden}?` },
          },
        ];
        if ((borrador || order.estado === "ENVIADA") && tieneWhatsApp) {
          acciones.push({
            id: "whatsapp",
            etiqueta: borrador ? "WhatsApp" : "Reenviar",
            color: COLOR_WHATSAPP,
            icono: enviando ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <WhatsAppLogo size={18} aria-hidden="true" />
            ),
            alElegir: () => onWhatsApp(order),
          });
        } else if (borrador) {
          acciones.push({
            id: "enviar",
            etiqueta: "Enviar",
            color: COLOR_EDITAR,
            icono: <Send size={18} strokeWidth={2} />,
            alElegir: () => onStatusChange(order, "ENVIADA"),
          });
        }

        return (
          <FilaDeslizable
            key={order.id}
            label={`Orden ${order.numero_orden}`}
            acciones={acciones}
            avisoInicio={avisos[order.id] ?? 0}
            accionInicio={
              puedeRecibir(order)
                ? {
                    id: "recibir",
                    etiqueta: "Recibir",
                    color: COLOR_RECIBIR,
                    icono: <Check size={18} strokeWidth={2.5} />,
                    alElegir: () => onReceive(order),
                  }
                : undefined
            }
            onTap={() => onOpen(order)}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                <span className="font-mono">{order.numero_orden}</span>
                {" · "}
                {getSupplierName(order.proveedor_id)}
              </p>
              <p className="truncate text-xs opacity-60">
                {new Date(order.creado_en).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm tabular-nums">
                ${order.total.toFixed(2)}
              </span>
              <Badge className={`${orderEstadoColors[order.estado]} text-[10px] px-1.5 py-0`}>
                {orderEstadoLabels[order.estado]}
              </Badge>
            </div>

            {/* Editar solo mientras es borrador: una vez enviada al proveedor
                ya no se cambia. */}
            {borrador && (
              <span onPointerDown={noArrastrar} className="-mr-2 flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(order);
                  }}
                  aria-label={`Editar la orden ${order.numero_orden}`}
                  title="Editar orden"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            )}
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
