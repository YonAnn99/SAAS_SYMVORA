"use client";

import { User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPortal,
  ComboboxPopup,
  ComboboxPositioner,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import type { Cliente } from "@/lib/types/database";

interface CustomerSelectorProps {
  customers: Cliente[];
  selectedCustomer: string;
  onSelectCustomer: (id: string) => void;
  onNewCustomer: () => void;
  label?: string;
  showLabel?: boolean;
  allowGeneral?: boolean;
  placeholder?: string;
  emptyText?: string;
}

interface CustomerOption {
  value: string;
  label: string;
  keywords: string;
}

export function CustomerSelector({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onNewCustomer,
  label = "Cliente (opcional)",
  showLabel = true,
  allowGeneral = true,
  placeholder = allowGeneral ? "Cliente general" : "Selecciona cliente",
  emptyText = "No se encontraron clientes",
}: CustomerSelectorProps) {
  const options: CustomerOption[] = [
    ...(allowGeneral
      ? [{ value: "none", label: "Cliente general", keywords: "" }]
      : []),
    ...customers.map((customer) => ({
      value: customer.id,
      label: customer.nombre,
      keywords: customer.rfc ?? "",
    })),
  ];

  return (
    <div className={showLabel ? "mb-3" : ""}>
      {showLabel && (
        <Label className="text-xs text-muted-foreground mb-1 block">
          <User className="inline h-3 w-3 mr-1" />
          {label}
        </Label>
      )}
      <div className="flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Combobox
            items={options}
            value={selectedCustomer}
            onValueChange={(value) => onSelectCustomer(value ?? "")}
            filter={(item, query) => {
              const option = item as unknown as CustomerOption;
              const haystack = `${option.label} ${option.keywords}`
                .toLowerCase();
              return haystack.includes(query.toLowerCase());
            }}
          >
            <ComboboxInputGroup className="h-8">
              <ComboboxInput placeholder={placeholder} />
              <ComboboxTrigger />
            </ComboboxInputGroup>
            <ComboboxPortal>
              <ComboboxPositioner>
                <ComboboxPopup>
                  <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                  <ComboboxList>
                    {(option: CustomerOption) => (
                      <ComboboxItem key={option.value} value={option.value}>
                        <ComboboxItemIndicator />
                        <span>{option.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </ComboboxPositioner>
            </ComboboxPortal>
          </Combobox>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onNewCustomer}
          title="Nuevo cliente"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}