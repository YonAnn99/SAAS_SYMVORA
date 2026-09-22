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
import { useSucursal } from "@/contexts/sucursal-context";

/**
 * Elige que sucursal se esta mirando.
 *
 * NO SE DIBUJA SI SOLO HAY UNA. Un negocio de un solo local no debe pagar en
 * ruido de interfaz por una funcion que no usa: sin este corte, cada pantalla
 * del panel ganaria un desplegable con una unica opcion.
 *
 * VALOR CENTINELA `__todas` en vez de cadena vacia: `""` esta reservado para
 * "sin valor". Dentro del contexto ese estado se guarda como `null`, que es lo
 * que las consultas interpretan como "no filtres".
 *
 * ⚠️ EL MAPA `items` NO ES OPCIONAL, AUNQUE LO PAREZCA. El `Select` de Base UI
 * —que es el que usa este repo, no el de Radix— **no propaga el texto del
 * `SelectItem` al boton**: sin `items`, `Select.Value` pinta el valor EN CRUDO,
 * o sea el UUID de la sucursal. Se vio en pantalla: el desplegable listaba
 * "Principal" y "Norte" mientras el boton decia `a0f83b15-a250-4c…`.
 */

const TODAS = "__todas";

export function SucursalSelector({ className }: { className?: string }) {
  const { activas, sucursales, seleccionada, setSeleccionada, hayVarias } =
    useSucursal();

  // Se ofrecen las activas, pero si la elegida es una que ya cerró se mantiene
  // en la lista: quien está consultando el histórico de un local cerrado no
  // debería ver cómo su selección desaparece sola al recargar.
  const opciones = useMemo(
    () =>
      activas.some((s) => s.id === seleccionada)
        ? activas
        : [...activas, ...sucursales.filter((s) => s.id === seleccionada)],
    [activas, sucursales, seleccionada]
  );

  const items = useMemo(() => {
    const mapa: Record<string, string> = { [TODAS]: "Todas las sucursales" };
    for (const s of opciones) {
      mapa[s.id] = s.activa ? s.nombre : `${s.nombre} (cerrada)`;
    }
    return mapa;
  }, [opciones]);

  // Después de los hooks: llamarlos condicionalmente rompería su orden.
  if (!hayVarias) return null;

  return (
    <Select
      items={items}
      value={seleccionada ?? TODAS}
      onValueChange={(v) => setSeleccionada(v === TODAS ? null : v)}
    >
      <SelectTrigger className={className ?? "w-[190px] h-9"}>
        <Store className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas las sucursales</SelectItem>
        {opciones.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.nombre}
            {!s.activa && " (cerrada)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
