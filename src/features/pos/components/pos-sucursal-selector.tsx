"use client";

import { useMemo } from "react";
import { Store } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Sucursal } from "@/features/sucursales/services/sucursales-service";

/**
 * En que local esta cobrando el dueño.
 *
 * A diferencia del `SucursalSelector` del panel, aqui NO hay "Todas": un
 * mostrador cobra en un sitio concreto, y lo que se elige decide con que caja
 * (la del dueño en ese local) y contra que existencias se vende.
 *
 * El mapa `items` es obligatorio por lo mismo que en `SucursalSelector`: sin
 * el, el `Select` de Base UI pinta el UUID en el boton.
 */
export function PosSucursalSelector({
  sucursales,
  value,
  onChange,
  disabled,
}: {
  sucursales: Sucursal[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const items = useMemo(
    () => Object.fromEntries(sucursales.map((s) => [s.id, s.nombre])),
    [sucursales]
  );

  return (
    <Select
      items={items}
      value={value ?? ""}
      onValueChange={(v) => {
        if (typeof v === "string" && v) onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full sm:w-44 h-9" aria-label="Sucursal donde cobras">
        <Store className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden="true" />
        <SelectValue placeholder="Sucursal" />
      </SelectTrigger>
      <SelectContent>
        {sucursales.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
