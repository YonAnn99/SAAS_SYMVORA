"use client";

import { Label } from "@/components/ui/label";
import { useSucursal } from "@/contexts/sucursal-context";

/**
 * "¿A que local va esto?" dentro de un formulario (compra, orden, ajuste).
 *
 * No se dibuja en un negocio de un solo local: la pregunta solo tiene una
 * respuesta y el servidor ya la conoce. El valor inicial lo decide quien lo
 * usa con `destinoPorDefecto`, para que el formulario y la regla no diverjan.
 *
 * `<select>` nativo y no el `Select` de Base UI a proposito: vive dentro de
 * dialogos, y el nativo no pelea con el foco ni con el portal del dialogo. Es
 * el mismo criterio que el de apertura de caja.
 */
export function CampoSucursal({
  id = "campo-sucursal",
  value,
  onChange,
  etiqueta = "Sucursal",
  ayuda,
}: {
  id?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  etiqueta?: string;
  ayuda?: string;
}) {
  const { activas, hayVarias } = useSucursal();
  if (!hayVarias) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>
        {etiqueta}
      </Label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Selecciona una sucursal…</option>
        {activas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
      {ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
