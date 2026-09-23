"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSucursal } from "@/contexts/sucursal-context";

/**
 * En que sucursales trabaja un usuario. Se usa al invitar y al editar.
 *
 * NINGUNA MARCADA = TODAS. Es la regla de la base (migracion 085: sin filas en
 * `usuario_sucursales`, sin restriccion), y se dice en pantalla para que nadie
 * crea que desmarcarlo todo deja al usuario sin acceso.
 */
export function SucursalesCheckboxes({
  value,
  onChange,
  idPrefix = "suc",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  idPrefix?: string;
}) {
  const { activas } = useSucursal();

  const alternar = (id: string, marcada: boolean) =>
    onChange(marcada ? [...new Set([...value, id])] : value.filter((x) => x !== id));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Sucursales</Label>
      <div className="grid gap-2 rounded-md border border-border p-2.5 sm:grid-cols-2">
        {activas.map((s) => {
          const id = `${idPrefix}-${s.id}`;
          return (
            <label key={s.id} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id={id}
                checked={value.includes(s.id)}
                onCheckedChange={(v) => alternar(s.id, v === true)}
              />
              {s.nombre}
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {value.length === 0
          ? "Sin marcar ninguna, podrá trabajar en todas las sucursales."
          : "Solo podrá abrir caja, mover inventario y ver cifras de las marcadas."}
      </p>
    </div>
  );
}
