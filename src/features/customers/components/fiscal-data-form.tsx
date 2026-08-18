"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USOS_CFDI } from "@/features/facturacion/catalogs";
import type { NewCustomerForm } from "../types/customer.types";

interface FiscalDataFormProps {
  value: NewCustomerForm;
  onChange: (next: NewCustomerForm) => void;
}

export function FiscalDataForm({ value, onChange }: FiscalDataFormProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="nc-rfc">RFC</Label>
        <Input
          id="nc-rfc"
          value={value.rfc}
          onChange={(e) =>
            onChange({ ...value, rfc: e.target.value.toUpperCase() })
          }
          placeholder="XAXX010101000"
          className="uppercase"
          maxLength={13}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-razon">Razón social</Label>
        <Input
          id="nc-razon"
          value={value.razon_social}
          onChange={(e) => onChange({ ...value, razon_social: e.target.value })}
          placeholder="Empresa S.A. de C.V."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-regimen">Régimen fiscal</Label>
        <Input
          id="nc-regimen"
          value={value.regimen_fiscal_receptor}
          onChange={(e) =>
            onChange({ ...value, regimen_fiscal_receptor: e.target.value })
          }
          placeholder="612"
          maxLength={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-uso">Uso CFDI</Label>
        <Select
          value={value.uso_cfdi}
          onValueChange={(v) => onChange({ ...value, uso_cfdi: v ?? "" })}
        >
          <SelectTrigger id="nc-uso" className="w-full">
            <SelectValue placeholder="Selecciona un uso" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(USOS_CFDI).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {key} — {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-cp">Código postal</Label>
        <Input
          id="nc-cp"
          value={value.codigo_postal}
          onChange={(e) =>
            onChange({ ...value, codigo_postal: e.target.value })
          }
          placeholder="06600"
          maxLength={5}
          inputMode="numeric"
        />
      </div>
    </>
  );
}