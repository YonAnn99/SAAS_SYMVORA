"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { CustomerSelector } from "@/features/customers/components/customer-selector";
import { PaymentMethodPicker, type PaymentMethodOption } from "./payment-method-picker";
import { PosCart } from "./pos-cart";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types/database";
import type { CartItem, SaleTotals } from "../types/pos.types";
import { montosRapidos } from "../montos-rapidos";
import type { MotivoBloqueo } from "../venta-bloqueada";
import { precargarSonidoVenta } from "../celebracion-venta";

/** Lo que dice el deslizador mientras no se puede cobrar. */
const ETIQUETA_BLOQUEO: Record<MotivoBloqueo, string> = {
  "sin-productos": "Agrega productos",
  "sin-metodo": "Elige un método de pago",
  "monto-insuficiente": "Captura el monto recibido",
  "sin-terminal": "Tarjeta sin terminal",
  // Solo cuando NO es el propio cobro: mientras se registra la venta el
  // deslizador muestra su giro, y bloquearlo a mitad cortaria la animacion.
  procesando: "Actualizando precios…",
};

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
  tarjetaLista: boolean | null;

  isEfectivo: boolean;
  montoRecibido: string;
  onMontoRecibidoChange: (value: string) => void;
  cambio: number | null;

  processingSale: boolean;
  /** Por que no se puede cobrar ahora mismo, o `null` si si se puede. */
  motivoBloqueo: MotivoBloqueo | null;
  /**
   * Registra la venta: se resuelve si quedo y se rechaza si no (el deslizador
   * muestra "Venta completada" o la sacudida de error segun eso).
   */
  onCobrar: () => Promise<void>;
  /** Tras la animacion de exito, con la posicion del control (origen del destello). */
  onVentaConfirmada: (origen: DOMRect | null) => void;
  /** Sube con cada venta cobrada: reinicia el deslizador para la siguiente. */
  ventasCobradas: number;
  onClearCart: () => void;

  /** Debajo del selector de cliente: la tarjeta de lealtad de la venta. */
  bajoCliente?: ReactNode;
  /** Premio de lealtad aplicado, para separarlo del descuento manual. */
  premioLealtad?: { etiqueta: string; monto: number } | null;

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
  tarjetaLista,
  isEfectivo,
  montoRecibido,
  onMontoRecibidoChange,
  cambio,
  processingSale,
  motivoBloqueo,
  onCobrar,
  onVentaConfirmada,
  ventasCobradas,
  onClearCart,
  bajoCliente,
  premioLealtad = null,
  className,
}: CheckoutPanelProps) {
  const t = useTranslations();
  const hayArticulos = items.length > 0;
  // El sonido de venta se precarga en cuanto hay algo que cobrar: antes lo
  // hacia la ventana de "Confirmar venta", que ya no existe.
  useEffect(() => {
    if (hayArticulos) precargarSonidoVenta();
  }, [hayArticulos]);
  const total = `$${totals.total.toFixed(2)}`;
  const bloqueoDeslizador =
    motivoBloqueo === "procesando" && processingSale ? null : motivoBloqueo;

  return (
    <div className={cn("min-h-0 flex flex-col", className)}>
      <CustomerSelector
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={onSelectCustomer}
        onNewCustomer={onNewCustomer}
      />
      {bajoCliente}

      <PosCart
        items={items}
        totals={totals}
        itemCount={itemCount}
        includeIva={includeIva}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
        onToggleIva={onToggleIva}
        premioLealtad={premioLealtad}
      />

      <PaymentMethodPicker
        methods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelect={onSelectPayment}
        mpReady={mpReady}
        tarjetaLista={tarjetaLista}
      />

      {isEfectivo && (
        <div className="mt-2 space-y-1.5">
          <label className="text-xs text-muted-foreground">
            {t("pos.amountReceived")}
          </label>
          {/* Montos rapidos: un toque en vez de teclear el billete. */}
          {totals.total > 0 && (
            <div className="flex gap-1.5">
              {[
                { etiqueta: "Exacto", monto: totals.total },
                ...montosRapidos(totals.total).map((m) => ({ etiqueta: `$${m}`, monto: m })),
              ].map(({ etiqueta, monto }) => {
                const elegido = Number(montoRecibido) === Number(monto.toFixed(2));
                return (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => onMontoRecibidoChange(monto.toFixed(2))}
                    aria-pressed={elegido}
                    className={cn(
                      "h-8 flex-1 rounded-md border font-mono text-xs font-semibold transition-colors max-lg:h-11 max-lg:rounded-xl max-lg:text-sm",
                      elegido
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input bg-transparent text-foreground hover:bg-muted"
                    )}
                  >
                    {etiqueta}
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="$0.00"
            value={montoRecibido}
            onChange={(e) => onMontoRecibidoChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm max-lg:h-11 max-lg:rounded-xl max-lg:text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

      {/* Pegado abajo: en escritorio el panel se desplaza cuando la pantalla es
          baja, y en la hoja del celular queda a la mano del pulgar. */}
      <div className="sticky bottom-0 z-10 bg-popover pb-1 lg:bg-background">
        {/* Se cobra deslizando aqui mismo: el resumen que mostraba la ventana de
            "Confirmar venta" ya esta a la vista en el carrito, y deslizar hasta
            el final es la confirmacion. Con la terminal de Mercado Pago, en
            cambio, un boton: iniciar el cobro no es la venta terminada (la
            confirma la terminal en su propia ventana). */}
        <div className="mt-3">
          {selectedPayment === "TARJETA_TERMINAL" ? (
            <SpecularActionButton
              tone="money"
              className="w-full h-11 active:scale-[0.98] transition-transform max-lg:h-14 max-lg:rounded-2xl max-lg:text-base"
              disabled={motivoBloqueo !== null}
              onClick={() => void onCobrar().catch(() => {})}
            >
              {processingSale ? t("common.loading") : `Cobrar en terminal ${total}`}
            </SpecularActionButton>
          ) : (
            <DeslizarParaConfirmar
              key={ventasCobradas}
              label={
                bloqueoDeslizador ? ETIQUETA_BLOQUEO[bloqueoDeslizador] : `Desliza para cobrar ${total}`
              }
              doneLabel="Venta completada"
              successColor="#22c55e"
              disabled={bloqueoDeslizador !== null}
              onConfirm={onCobrar}
              onDone={onVentaConfirmada}
            />
          )}
        </div>

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
    </div>
  );
}
