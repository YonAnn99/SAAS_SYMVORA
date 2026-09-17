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
import type { MotivoBloqueo } from "../venta-bloqueada";

interface CheckoutPanelProps {
  customers: Cliente[];
  selectedCustomer: string;
  onSelectCustomer: (id: string) => void;
  onNewCustomer: () => void;

  items: CartItem[];
  totals: SaleTotals;
  itemCount: number;
  includeIva: boolean;
  onUpdateQuantity: (key: string, cantidad: number) => void;
  onRemove: (key: string) => void;
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
  /** Por que no se puede cobrar ahora mismo, o `null` si si se puede. */
  motivoBloqueo?: MotivoBloqueo | null;
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
  motivoBloqueo = null,
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
        isOnline={isOnline}
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

      {/* El mensaje anterior decia que sin conexion no se podia cobrar. Era
          falso desde que existe la cola de ventas offline: se cobra, se guarda
          en el dispositivo y se sube sola al volver la red. */}
      {!isOnline && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {motivoBloqueo === "metodo-no-disponible-sin-conexion"
            ? "Sin conexión solo puedes cobrar en efectivo o con tarjeta manual."
            : "Sin conexión: la venta se guarda en este dispositivo y se sube sola al volver el internet."}
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
