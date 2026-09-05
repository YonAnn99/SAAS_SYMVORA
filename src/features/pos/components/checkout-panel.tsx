"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { CustomerSelector } from "@/features/customers/components/customer-selector";
import { PaymentMethodPicker, type PaymentMethodOption } from "./payment-method-picker";
import { PosCart } from "./pos-cart";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types/database";
import type { CartItem, SaleTotals } from "../types/pos.types";

interface CheckoutPanelProps {
  customers: Cliente[];
  selectedCustomer: string;
  onSelectCustomer: (id: string) => void;
  onNewCustomer: () => void;

  items: CartItem[];
  totals: SaleTotals;
  itemCount: number;
  includeIva: boolean;
  onUpdateQuantity: (productId: string, cantidad: number) => void;
  onRemove: (productId: string) => void;
  onToggleIva: (checked: boolean) => void;

  paymentMethods: PaymentMethodOption[];
  selectedPayment: string;
  onSelectPayment: (key: string) => void;
  mpReady: boolean | null;

  isEfectivo: boolean;
  montoRecibido: string;
  onMontoRecibidoChange: (value: string) => void;
  cambio: number | null;

  isOnline: boolean;
  processingSale: boolean;
  disabledComplete: boolean;
  onCompleteSale: () => void;
  onClearCart: () => void;

  className?: string;
}

export function CheckoutPanel({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onNewCustomer,
  items,
  totals,
  itemCount,
  includeIva,
  onUpdateQuantity,
  onRemove,
  onToggleIva,
  paymentMethods,
  selectedPayment,
  onSelectPayment,
  mpReady,
  isEfectivo,
  montoRecibido,
  onMontoRecibidoChange,
  cambio,
  isOnline,
  processingSale,
  disabledComplete,
  onCompleteSale,
  onClearCart,
  className,
}: CheckoutPanelProps) {
  const t = useTranslations();

  return (
    <div className={cn("min-h-0 flex flex-col", className)}>
      <CustomerSelector
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={onSelectCustomer}
        onNewCustomer={onNewCustomer}
      />

      <PosCart
        items={items}
        totals={totals}
        itemCount={itemCount}
        includeIva={includeIva}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
        onToggleIva={onToggleIva}
      />

      <PaymentMethodPicker
        methods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelect={onSelectPayment}
        mpReady={mpReady}
      />

      {isEfectivo && (
        <div className="mt-2 space-y-1.5">
          <label className="text-xs text-muted-foreground">
            {t("pos.amountReceived")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="$0.00"
            value={montoRecibido}
            onChange={(e) => onMontoRecibidoChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {cambio != null && (
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">{t("pos.change")}</span>
              <span className="font-mono">
                ${Math.max(0, cambio).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {!isOnline && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Sin conexión: no se pueden completar ventas hasta reconectarte.
        </p>
      )}

      <SpecularActionButton
        tone="money"
        className="mt-3 w-full h-9 active:scale-[0.98] transition-transform"
        disabled={disabledComplete}
        onClick={onCompleteSale}
      >
        {processingSale ? t("common.loading") : t("pos.completeSale")}
      </SpecularActionButton>

      <Button
        variant="ghost"
        className="mt-1.5 w-full h-8 text-xs text-muted-foreground"
        size="sm"
        onClick={onClearCart}
        disabled={items.length === 0}
      >
        {t("pos.clearCart")}
      </Button>
    </div>
  );
}
