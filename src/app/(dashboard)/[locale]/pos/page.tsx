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
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Left: Products grid / search */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder={t("pos.barcodePlaceholder")}
            className="max-w-md"
          />
          <Button>{t("pos.addItem")}</Button>
        </div>

        {/* Product grid placeholder */}
        <div className="flex-1 rounded-lg border bg-muted/50 p-6">
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Escanea un código de barras o busca un producto
            </p>
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("pos.cart")}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {getItemCount()} artículos
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">{t("pos.emptyCart")}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.precioUnitario.toFixed(2)} x {item.cantidad}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          updateQuantity(item.productId, item.cantidad - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">
                        {item.cantidad}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          updateQuantity(item.productId, item.cantidad + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
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
            <div className="mt-4 space-y-2">
              <Separator />
              <div className="flex justify-between text-sm">
                <span>{t("pos.subtotal")}</span>
                <span>${getSubtotal().toFixed(2)}</span>
              </div>
              {getDiscount() > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>{t("common.discount")}</span>
                  <span>-${getDiscount().toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t("pos.total")}</span>
                <span>${getTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" className="w-full">
            {t("pos.paymentMethods.CASH")}
          </Button>
          <Button variant="outline" className="w-full">
            {t("pos.paymentMethods.CARD")}
          </Button>
          <Button variant="outline" className="w-full">
            {t("pos.paymentMethods.TRANSFER")}
          </Button>
          <Button variant="outline" className="w-full">
            {t("pos.paymentMethods.CREDIT")}
          </Button>
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={items.length === 0}
        >
          {t("pos.completeSale")}
        </Button>

        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={clearCart}
          disabled={items.length === 0}
        >
          {t("pos.clearCart")}
        </Button>
      </div>
    </div>
  );
}
