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
}

export function PaymentMethodPicker({
  methods,
  selectedPayment,
  onSelect,
  mpReady,
}: PaymentMethodPickerProps) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {methods.map((method) => {
        const terminalDisabled =
          method.key === "TARJETA_TERMINAL" && mpReady !== true;
        return (
          <Button
            key={method.key}
            variant={selectedPayment === method.key ? "default" : "outline"}
            className="w-full h-8 text-xs"
            size="sm"
            disabled={terminalDisabled}
            title={
              terminalDisabled
                ? "Configura Mercado Pago Point en Métodos de pago"
                : undefined
            }
            onClick={() => onSelect(method.key)}
          >
            <method.icon className="h-3 w-3 mr-1" />
            {method.label}
          </Button>
        );
      })}
    </div>
  );
}