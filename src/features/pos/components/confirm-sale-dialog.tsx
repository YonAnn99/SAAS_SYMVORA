"use client";

import { formatearCantidad } from "@/lib/unidades";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import SlideCommit from "@/components/ui/slide-commit";
import { precargarSonidoVenta } from "../celebracion-venta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { CartItem, SaleTotals } from "../types/pos.types";

interface ConfirmSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  totals: SaleTotals;
  selectedPayment: string;
  customerName: string | null;
  processing: boolean;
  includeIva: boolean;
  montoRecibido?: number | null;
  cambio?: number | null;
  /**
   * Registra la venta. Se resuelve si quedo registrada y se rechaza si no:
   * de eso depende que el slider muestre "Venta completada" o el error.
   */
  onConfirm: () => Promise<void>;
  /** Tras la animacion de exito, con la posicion del slider (origen del destello). */
  onVentaConfirmada?: (origen: DOMRect | null) => void;
}

export function ConfirmSaleDialog({
  open,
  onOpenChange,
  items,
  totals,
  selectedPayment,
  customerName,
  processing,
  includeIva,
  montoRecibido,
  cambio,
  onConfirm,
  onVentaConfirmada,
}: ConfirmSaleDialogProps) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme === "dark";

  // El slider hace sus cuentas con un ancho en pixeles: se mide el pie para
  // que ocupe todo el ancho del dialogo, tambien en celular.
  // Con un ref de callback: el contenido del dialogo se monta cuando abre, y
  // asi se mide en cuanto existe el elemento (no antes).
  const [pie, setPie] = useState<HTMLDivElement | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!pie) return;
    const medir = () => setAncho(Math.round(pie.getBoundingClientRect().width));
    const observador = new ResizeObserver(medir);
    observador.observe(pie);
    return () => observador.disconnect();
  }, [pie]);
  useEffect(() => {
    if (open) precargarSonidoVenta();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Confirmar venta</DialogTitle>
          <DialogDescription className="text-xs">
            Revisa los detalles antes de completar la venta
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3 space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span>
                  {item.nombre} x{formatearCantidad(item.cantidad, item.unidad_medida)}
                </span>
                <span className="font-mono">
                  ${(item.precioUnitario * item.cantidad).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.descuento > 0 && (
            <div className="flex justify-between text-xs text-destructive">
              <span>{t("common.discount")}</span>
              <span className="font-mono">-${totals.descuento.toFixed(2)}</span>
            </div>
          )}
          {includeIva && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">IVA (16%)</span>
              <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">${totals.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Método de pago</span>
            <span>{selectedPayment}</span>
          </div>
          {montoRecibido != null && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("pos.amountReceived")}</span>
              <span className="font-mono">${montoRecibido.toFixed(2)}</span>
            </div>
          )}
          {cambio != null && (
            <div className="flex justify-between text-xs font-medium">
              <span>{t("pos.change")}</span>
              <span className="font-mono">${cambio.toFixed(2)}</span>
            </div>
          )}
          {customerName && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cliente</span>
              <span>{customerName}</span>
            </div>
          )}
        </div>
        {/* Slide Commit de React Bits: se desliza para cobrar. Mientras se
            registra la venta la manija gira; al quedar, se vuelve la pastilla
            verde "Venta completada" (y la pagina suena y destella). */}
        <div className="flex flex-col items-stretch gap-2">
          <div ref={setPie} className="w-full">
            {ancho > 0 && (
              <SlideCommit
                width={ancho}
                height={52}
                radius={26}
                label={`Desliza para cobrar $${totals.total.toFixed(2)}`}
                doneLabel="Venta completada"
                errorLabel="No se completó"
                // Oscuro como la referencia; claro, invertido (igual que las
                // pestañas). Van en hex: el componente calcula el color del
                // texto a partir de ellos.
                trackColor={oscuro ? "#262626" : "#f4f4f5"}
                handleColor={oscuro ? "#f5f5f5" : "#18181b"}
                successColor="#22c55e"
                dangerColor="#e5484d"
                // La pastilla verde se queda: el dialogo se cierra solo.
                holdMs={0}
                disabled={items.length === 0}
                onConfirm={onConfirm}
                onDone={() =>
                  onVentaConfirmada?.(pie?.getBoundingClientRect() ?? null)
                }
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 self-center text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}