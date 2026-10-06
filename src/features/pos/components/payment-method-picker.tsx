"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaymentMethodOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface PaymentMethodPickerProps {
  methods: PaymentMethodOption[];
  selectedPayment: string;
  onSelect: (key: string) => void;
  mpReady: boolean | null;
  /** «Tarjeta» manual: hay terminal con que cobrar (`tarjetaManualDisponible`). */
  tarjetaLista: boolean | null;
}

export function PaymentMethodPicker({
  methods,
  selectedPayment,
  onSelect,
  mpReady,
  tarjetaLista,
}: PaymentMethodPickerProps) {
  return (
    // En la hoja del celular (debajo de `lg`) los botones crecen a 48 px: es lo
    // que el cajero toca con el pulgar en cada venta.
    <div className="mt-3 grid grid-cols-2 gap-1.5 max-lg:gap-2">
      {methods.map((method) => {
        const terminalDisabled =
          method.key === "TARJETA_TERMINAL" && mpReady !== true;
        const tarjetaDisabled = method.key === "TARJETA" && tarjetaLista !== true;
        return (
          <Button
            key={method.key}
            variant={selectedPayment === method.key ? "default" : "outline"}
            className="w-full h-8 text-xs max-lg:h-12 max-lg:rounded-xl max-lg:text-sm"
            size="sm"
            disabled={terminalDisabled || tarjetaDisabled}
            title={
              terminalDisabled
                ? "Configura Mercado Pago Point en Métodos de pago"
                : tarjetaDisabled
                  ? "Activa tu terminal en Configuración → Métodos de pago"
                  : undefined
            }
            onClick={() => onSelect(method.key)}
          >
            <method.icon className="h-3 w-3 mr-1 max-lg:h-4 max-lg:w-4 max-lg:mr-1.5" />
            {method.label}
            {tarjetaDisabled && (
              <span className="ml-1 text-[11px] font-normal lg:hidden">· Sin terminal</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}