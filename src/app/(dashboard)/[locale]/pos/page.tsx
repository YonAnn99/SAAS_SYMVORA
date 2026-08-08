"use client";

import { useTranslations } from "next-intl";
import { useCartStore } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ShoppingCart } from "lucide-react";

export default function POSPage() {
  const t = useTranslations();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getDiscount,
    getTotal,
    getItemCount,
  } = useCartStore();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-5">
      {/* Left: Products grid / search */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-3 animate-fade-in-up stagger-1">
          <Input
            placeholder={t("pos.barcodePlaceholder")}
            className="max-w-md h-9"
          />
          <Button className="h-9" size="sm">{t("pos.addItem")}</Button>
        </div>

        {/* Product grid placeholder */}
        <div className="flex-1 rounded-lg border border-border bg-card p-6 animate-fade-in-up stagger-2">
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Escanea un código de barras o busca un producto
            </p>
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col animate-fade-in-up stagger-2">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>{t("pos.cart")}</span>
              <span className="text-xs font-normal text-muted-foreground font-mono">
                {getItemCount()}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("pos.emptyCart")}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2 py-1"
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
                          updateQuantity(item.productId, item.cantidad - 1)
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
                          updateQuantity(item.productId, item.cantidad + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("pos.subtotal")}</span>
                  <span className="font-mono">${getSubtotal().toFixed(2)}</span>
                </div>
                {getDiscount() > 0 && (
                  <div className="flex justify-between text-xs text-destructive">
                    <span>{t("common.discount")}</span>
                    <span className="font-mono">-${getDiscount().toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t("pos.total")}</span>
                  <span className="font-mono">${getTotal().toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment buttons */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {[
            t("pos.paymentMethods.CASH"),
            t("pos.paymentMethods.CARD"),
            t("pos.paymentMethods.TRANSFER"),
            t("pos.paymentMethods.CREDIT"),
          ].map((method) => (
            <Button key={method} variant="outline" className="w-full h-8 text-xs" size="sm">
              {method}
            </Button>
          ))}
        </div>

        <Button
          className="mt-3 w-full h-9 active:scale-[0.98] transition-transform"
          size="sm"
          disabled={items.length === 0}
        >
          {t("pos.completeSale")}
        </Button>

        <Button
          variant="ghost"
          className="mt-1.5 w-full h-8 text-xs text-muted-foreground"
          size="sm"
          onClick={clearCart}
          disabled={items.length === 0}
        >
          {t("pos.clearCart")}
        </Button>
      </div>
    </div>
  );
}
