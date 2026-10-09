"use client";

/**
 * Piezas del formulario para "¿como se vende?" y "contenido del envase"
 * (migracion 114), compartidas por Producto unico y las variantes.
 *
 * La unidad decide el cobro: de conteo suma piezas, de medida (granel) hace
 * que el POS pregunte "¿Cuanto?". El contenido (600 ml, 2.5 L) solo describe
 * lo que trae un producto empaquetado. Antes se usaba la unidad para eso y el
 * POS ofrecia "1/4 l" de un refresco.
 */

import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UNIDADES_CONTENIDO,
  esFraccionable,
  formatearContenido,
  type Contenido,
  type UnidadMedida,
} from "@/lib/unidades";

const NOMBRE_MEDIDA: Record<string, string> = {
  MILILITRO: "ml",
  LITRO: "L",
  GRAMO: "g",
  KG: "kg",
  METRO: "m",
};

/**
 * Opciones del selector de unidad, en dos grupos con su explicacion. `extra`
 * va arriba sin grupo (p. ej. "Igual que el producto" en una variante).
 */
export function OpcionesUnidad({
  unidades,
  etiqueta,
  extra,
}: {
  unidades: readonly UnidadMedida[];
  etiqueta: (u: UnidadMedida) => string;
  extra?: { valor: string; texto: string };
}) {
  const conteo = unidades.filter((u) => !esFraccionable(u) && u !== "SERVICIO");
  const granel = unidades.filter((u) => esFraccionable(u));
  const servicio = unidades.filter((u) => u === "SERVICIO");

  return (
    <>
      {extra && <SelectItem value={extra.valor}>{extra.texto}</SelectItem>}
      {conteo.length > 0 && (
        <SelectGroup>
          <SelectLabel>Por pieza / empaquetado</SelectLabel>
          {conteo.map((u) => (
            <SelectItem key={u} value={u}>
              {etiqueta(u)}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {granel.length > 0 && (
        <SelectGroup>
          <SelectLabel>Suelto, a granel (el POS pregunta cuánto)</SelectLabel>
          {granel.map((u) => (
            <SelectItem key={u} value={u}>
              {etiqueta(u)}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {servicio.map((u) => (
        <SelectItem key={u} value={u}>
          {etiqueta(u)}
        </SelectItem>
      ))}
    </>
  );
}

/**
 * "Contenido (opcional)": cantidad + medida. `heredado` es el texto del
 * contenido del producto cuando una variante deja el suyo vacio.
 */
export function CampoContenido({
  cantidad,
  unidad,
  onCambio,
  heredado,
  sugerencia,
}: {
  cantidad: string;
  unidad: string;
  onCambio: (cambio: { cantidad?: string; unidad?: string }) => void;
  heredado?: string;
  /** Medida leida del nombre o de un atributo ("2.5 L"), para llenarla con un clic. */
  sugerencia?: Contenido | null;
}) {
  const textoSugerencia = sugerencia ? formatearContenido(sugerencia.cantidad, sugerencia.unidad) : "";
  const mostrarSugerencia = Boolean(textoSugerencia) && cantidad.trim() === "";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Contenido (opcional)</Label>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder={heredado ? `${heredado} (del producto)` : "Ej. 600"}
          value={cantidad}
          onChange={(e) => onCambio({ cantidad: e.target.value })}
          className="h-8 min-w-0 flex-1 text-sm"
          aria-label="Cantidad del contenido"
        />
        <Select
          items={Object.fromEntries(UNIDADES_CONTENIDO.map((u) => [u, NOMBRE_MEDIDA[u]]))}
          value={unidad || null}
          onValueChange={(v) => onCambio({ unidad: v ?? "" })}
        >
          <SelectTrigger className="h-8 w-20 text-sm" aria-label="Medida del contenido">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {UNIDADES_CONTENIDO.map((u) => (
              <SelectItem key={u} value={u}>
                {NOMBRE_MEDIDA[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mostrarSugerencia && sugerencia ? (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={() => onCambio({ cantidad: String(sugerencia.cantidad), unidad: sugerencia.unidad })}
        >
          Usar {textoSugerencia}
        </button>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Lo que trae el envase: 600 ml, 2.5 L, 45 g. Solo se muestra; no cambia cómo se cobra.
        </p>
      )}
    </div>
  );
}

/**
 * Se eligio una unidad a granel pero el nombre o un atributo trae una medida
 * ("Coca Cola 2.5 L"): casi seguro es un producto empaquetado.
 */
export function AvisoEmpaquetado({
  sugerencia,
  onVenderPorPieza,
}: {
  sugerencia: Contenido | null;
  onVenderPorPieza: () => void;
}) {
  const texto = sugerencia ? formatearContenido(sugerencia.cantidad, sugerencia.unidad) : "";
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="space-y-1.5">
        <p>
          ¿Viene embotellado o empaquetado? Con esta unidad el punto de venta preguntará
          «¿Cuánto?» al venderlo. Si se vende por pieza, elige «Pieza» y pon
          {texto ? ` ${texto}` : " la medida"} en Contenido.
        </p>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onVenderPorPieza}>
          Vender por pieza{texto ? ` · contenido ${texto}` : ""}
        </Button>
      </div>
    </div>
  );
}
