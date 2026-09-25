"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface OpcionSelect {
  value: string;
  label: string;
}

/**
 * Reemplazo directo de un `<select>` nativo con el Select del sistema (aspecto
 * del Select de beUI, abre debajo y con altura limitada).
 *
 * Arma solo el mapa `items` que exige el Select de Base UI de este repo (sin
 * el, el boton mostraria el valor crudo, p. ej. un uuid). El valor vacio es
 * `null`: se muestra el `placeholder`, como la primera `<option value="">`.
 *
 * Sirve dentro de dialogos: el panel va por portal y Base UI maneja el foco y
 * la capa del dialogo (el mismo Select ya se usa en el dialogo de productos).
 */
export function SelectSimple({
  id,
  value,
  onChange,
  opciones,
  placeholder,
  ariaLabel,
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const items = useMemo(
    () => Object.fromEntries(opciones.map((o) => [o.value, o.label])),
    [opciones]
  );

  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange((v as string | null) || null)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
