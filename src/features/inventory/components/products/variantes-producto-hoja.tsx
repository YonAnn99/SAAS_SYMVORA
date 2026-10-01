"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getInitials } from "@/lib/utils";
import type { Producto, VarianteProducto } from "../../types/inventory.types";
import { VariantSwipeList } from "../variants/variant-swipe-list";

/**
 * Celular: las variantes de UN producto en la hoja que sube desde abajo (el
 * `Dialog` ya es hoja en pantallas chicas). Arriba, anclado mientras se
 * desplaza la lista, el producto al que pertenecen; abajo, cada variante
 * deslizable para editarla o eliminarla, igual que en la pestaña que existia.
 */
interface VariantesProductoHojaProps {
  producto: Producto | null;
  variantes: VarianteProducto[];
  onOpenChange: (abierta: boolean) => void;
  onEdit: (variante: VarianteProducto) => void;
  onDelete: (variante: VarianteProducto) => Promise<boolean>;
}

export function VariantesProductoHoja({
  producto,
  variantes,
  onOpenChange,
  onEdit,
  onDelete,
}: VariantesProductoHojaProps) {
  const t = useTranslations();
  const abierta = producto !== null;

  return (
    <Dialog open={abierta} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3">
        {producto && (
          <>
            {/* El producto, anclado: queda fijo al desplazar las variantes. */}
            <DialogHeader className="sticky top-0 z-10 -mx-4 -mt-2 bg-popover px-4 pt-2 pb-3 border-b border-border">
              <div className="flex items-center gap-3 pr-8">
                {producto.imagen_url ? (
                  <Image
                    src={producto.imagen_url}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">
                    {getInitials(producto.nombre)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-base">{producto.nombre}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    {t(`products.units.${producto.unidad_medida}`)} · ${producto.precio_venta.toFixed(2)} ·{" "}
                    {producto.stock_actual} en stock
                  </DialogDescription>
                </div>
                <span className="shrink-0 rounded-full bg-[#1e3a8a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1e3a8a] dark:bg-blue-500/15 dark:text-blue-300">
                  {variantes.length === 1 ? "1 variante" : `${variantes.length} variantes`}
                </span>
              </div>
            </DialogHeader>

            <VariantSwipeList
              variantes={variantes}
              getProductName={() => producto.nombre}
              conProducto={false}
              onEdit={onEdit}
              onDelete={async (v) => {
                const ok = await onDelete(v);
                // Era la ultima: ya no hay nada que mostrar.
                if (ok && variantes.length <= 1) onOpenChange(false);
                return ok;
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
