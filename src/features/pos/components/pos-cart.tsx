"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CartItem, SaleTotals } from "../types/pos.types";
import { cartLineKey } from "@/features/pos/stores/cart";
import { DescuentoTicketControl } from "./descuento-ticket-control";
import { esFraccionable, formatearCantidad, normalizarCantidad } from "@/lib/unidades";
import {
  COLOR_ELIMINAR,
  FilaDeslizable,
  noArrastrar,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { useEsEscritorio } from "@/hooks/use-es-movil";

/**
 * Cantidad de una linea: se toca para escribirla. Sirve para 0.750 kg y
 * tambien para 24 piezas sin pulsar "+" veinticuatro veces. Lo invalido se
 * descarta y vuelve el valor anterior.
 */
function CantidadEditable({
  item,
  onChange,
}: {
  item: CartItem;
  onChange: (cantidad: number) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const fraccionable = esFraccionable(item.unidad_medida);

  const aplicar = () => {
    if (editando === null) return;
    const n = normalizarCantidad(editando, item.unidad_medida);
    if (n !== null && n !== item.cantidad) onChange(n);
    setEditando(null);
  };

  if (editando !== null) {
    return (
      <input
        autoFocus
        inputMode={fraccionable ? "decimal" : "numeric"}
        value={editando}
        onChange={(e) => setEditando(e.target.value)}
        onBlur={aplicar}
        onKeyDown={(e) => {
          if (e.key === "Enter") aplicar();
          if (e.key === "Escape") setEditando(null);
        }}
        aria-label={`Cantidad de ${item.nombre}`}
        className={`${fraccionable ? "w-16" : "w-10"} h-6 max-lg:h-10 rounded border border-input bg-background px-1 text-center text-xs max-lg:text-base font-mono`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(String(item.cantidad))}
      title="Toca para escribir la cantidad"
      className={`${fraccionable ? "min-w-16 px-1" : "w-6 max-lg:w-8"} h-6 max-lg:h-10 rounded text-center text-xs max-lg:text-[15px] max-lg:font-bold font-mono hover:bg-muted`}
    >
      {fraccionable ? formatearCantidad(item.cantidad, item.unidad_medida) : item.cantidad}
    </button>
  );
}

interface PosCartProps {
  items: CartItem[];
  totals: SaleTotals;
  itemCount: number;
  includeIva: boolean;
  // Reciben la CLAVE de línea (producto+variante), no el productId: dos tallas
  // del mismo producto son dos líneas distintas.
  onUpdateQuantity: (key: string, cantidad: number) => void;
  onRemove: (key: string) => void;
  onToggleIva: (checked: boolean) => void;
}

export function PosCart({
  items,
  totals,
  itemCount,
  includeIva,
  onUpdateQuantity,
  onRemove,
  onToggleIva,
}: PosCartProps) {
  const t = useTranslations();
  // Celular y tablet (la hoja del carrito): cada linea es una pastilla que se
  // desliza a la izquierda para quitarla, el mismo gesto de Productos.
  const esEscritorio = useEsEscritorio();
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    // `overflow-visible` (la Card trae `overflow-hidden`): con overflow oculto
    // su alto minimo es 0 y, en pantallas bajas, el panel la aplastaba hasta
    // no ver ningun articulo. Asi su minimo es el de la lista (3 renglones) y
    // lo que se desplaza es el panel.
    <Card className="flex-1 flex flex-col overflow-visible">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{t("pos.cart")}</span>
          <span className="text-xs font-normal text-muted-foreground font-mono">
            {itemCount}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-0">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {t("pos.emptyCart")}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-32 overflow-y-auto space-y-3">
            {items.map((item) => {
              const clave = cartLineKey(item.productId, item.varianteId);
              const fila = (
                <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.nombre}
                    {item.varianteLabel && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {item.varianteLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    ${item.precioUnitario.toFixed(2)} x {formatearCantidad(item.cantidad, item.unidad_medida)}
                  </p>
                </div>
                <div className="flex items-center gap-1 max-lg:gap-0.5 max-lg:rounded-xl max-lg:bg-background max-lg:p-0.5" onPointerDown={noArrastrar}>
                  {/* Por medida (kg, m…) no hay ±1: 0.750 kg + 1 no es lo que
                      se quiere. Se toca la cantidad y se escribe. */}
                  {!esFraccionable(item.unidad_medida) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground max-lg:h-10 max-lg:w-10 max-lg:rounded-lg max-lg:bg-muted max-lg:text-foreground"
                      onClick={() =>
                        onUpdateQuantity(cartLineKey(item.productId, item.varianteId), item.cantidad - 1)
                      }
                    >
                      <Minus className="h-3 w-3 max-lg:h-4 max-lg:w-4" />
                    </Button>
                  )}
                  <CantidadEditable
                    item={item}
                    onChange={(n) => onUpdateQuantity(cartLineKey(item.productId, item.varianteId), n)}
                  />
                  {!esFraccionable(item.unidad_medida) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground max-lg:h-10 max-lg:w-10 max-lg:rounded-lg max-lg:bg-muted max-lg:text-foreground"
                      onClick={() =>
                        onUpdateQuantity(cartLineKey(item.productId, item.varianteId), item.cantidad + 1)
                      }
                    >
                      <Plus className="h-3 w-3 max-lg:h-4 max-lg:w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive max-lg:hidden"
                    onClick={() => onRemove(cartLineKey(item.productId, item.varianteId))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                </>
              );
              if (!esEscritorio) {
                return (
                  <FilaDeslizable
                    key={clave}
                    label={item.nombre}
                    alto={68}
                    onOpenChange={alAbrir}
                    acciones={[
                      {
                        id: "quitar",
                        etiqueta: "Quitar",
                        color: COLOR_ELIMINAR,
                        icono: <Trash2 size={18} strokeWidth={2} />,
                        alElegir: () => onRemove(clave),
                      },
                    ]}
                  >
                    {fila}
                  </FilaDeslizable>
                );
              }
              return (
                <div key={clave} className="flex items-center justify-between gap-2 py-1 animate-fade-in-up">
                  {fila}
                </div>
              );
            })}
            {!esEscritorio && verPista && (
              <p className="text-center text-xs text-muted-foreground">
                Desliza una línea a la izquierda para quitarla
              </p>
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <Separator />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("pos.subtotal")}</span>
              <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
            </div>
            {/* Descuento manual a toda la compra (% o monto fijo). */}
            <DescuentoTicketControl
              subtotal={totals.subtotal}
              monto={totals.descuento}
            />
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={includeIva}
                  onCheckedChange={(checked) => onToggleIva(checked === true)}
                />
                {t("pos.includeIva")}
              </label>
              {includeIva && (
                <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
              )}
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>{t("pos.total")}</span>
              <span className="font-mono">${totals.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}