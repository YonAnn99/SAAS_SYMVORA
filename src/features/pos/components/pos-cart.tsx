"use client";

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

interface PosCartProps {
  items: CartItem[];
  totals: SaleTotals;
  itemCount: number;
  includeIva: boolean;
  onUpdateQuantity: (productId: string, cantidad: number) => void;
  onRemove: (productId: string) => void;
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

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{t("pos.cart")}</span>
          <span className="text-xs font-normal text-muted-foreground font-mono">
            {itemCount}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {t("pos.emptyCart")}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between gap-2 py-1 animate-fade-in-up"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    ${item.precioUnitario.toFixed(2)} x {item.cantidad}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      onUpdateQuantity(item.productId, item.cantidad - 1)
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-mono">
                    {item.cantidad}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      onUpdateQuantity(item.productId, item.cantidad + 1)
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(item.productId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <Separator />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("pos.subtotal")}</span>
              <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.descuento > 0 && (
              <div className="flex justify-between text-xs text-destructive">
                <span>{t("common.discount")}</span>
                <span className="font-mono">
                  -${totals.descuento.toFixed(2)}
                </span>
              </div>
            )}
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