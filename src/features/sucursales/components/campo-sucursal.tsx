"use client";

import { Label } from "@/components/ui/label";
import { useSucursal } from "@/contexts/sucursal-context";
import { SelectSimple } from "@/components/ui/select-simple";

/**
 * "¿A que local va esto?" dentro de un formulario (compra, orden, ajuste).
 *
 * No se dibuja en un negocio de un solo local: la pregunta solo tiene una
 * respuesta y el servidor ya la conoce. El valor inicial lo decide quien lo
 * usa con `destinoPorDefecto`, para que el formulario y la regla no diverjan.
 *
 * Usa `SelectSimple` (el Select del sistema): antes era un `<select>` nativo
 * por miedo al foco y al portal dentro de dialogos, pero Base UI los maneja y
 * asi se ve igual que el resto de los desplegables.
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
      <SelectSimple
        id={id}
        value={value}
        onChange={onChange}
        placeholder="Selecciona una sucursal…"
        opciones={activas.map((s) => ({ value: s.id, label: s.nombre }))}
      />
      {ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
