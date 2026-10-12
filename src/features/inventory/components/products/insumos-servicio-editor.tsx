"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { normalizarInsumos, type InsumoLinea } from "../../insumos";
import { descomponerValor, type OpcionCompra } from "../../purchase-order-items";
import {
  fetchOpcionesInsumo,
  fetchRecetaServicio,
  guardarRecetaServicio,
} from "../../services/insumos-service";

/**
 * "Insumos que usa": la receta de un servicio (migracion 117). Al cobrarlo en
 * el POS se descuentan de la sucursal con sus lotes; en cada venta se pueden
 * ajustar (dosis por peso, un extra).
 *
 * Se guarda con su propio boton: la receta vive en otra tabla y no depende de
 * los demas campos del producto.
 */
export function InsumosServicioEditor({
  tenantId,
  servicioId,
}: {
  tenantId: string;
  servicioId: string;
}) {
  const [insumos, setInsumos] = useState<InsumoLinea[]>([]);
  const [opciones, setOpciones] = useState<OpcionCompra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  useEffect(() => {
    let vigente = true;
    const t0 = window.setTimeout(() => {
      Promise.all([fetchRecetaServicio(servicioId), fetchOpcionesInsumo(tenantId)])
        .then(([receta, ops]) => {
          if (!vigente) return;
          setInsumos(receta);
          setOpciones(ops);
          setCambios(false);
        })
        .catch(() => vigente && toast.error("No se pudieron cargar los insumos"))
        .finally(() => vigente && setCargando(false));
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [servicioId, tenantId]);

  const yaElegidos = useMemo(
    () => new Set(insumos.map((i) => `${i.productId}::${i.varianteId ?? ""}`)),
    [insumos]
  );
  const disponibles = useMemo(
    () => opciones.filter((o) => !yaElegidos.has(`${o.productoId}::${o.varianteId ?? ""}`)),
    [opciones, yaElegidos]
  );

  const agregar = (valor: string) => {
    const { productoId, varianteId } = descomponerValor(valor);
    const op = opciones.find((o) => o.value === valor);
    if (!op) return;
    setInsumos((prev) => [...prev, { productId: productoId, varianteId, cantidad: 1, nombre: op.label }]);
    setCambios(true);
  };

  const cambiarCantidad = (i: number, texto: string) => {
    setInsumos((prev) => prev.map((x, j) => (j === i ? { ...x, cantidad: Number(texto) } : x)));
    setCambios(true);
  };

  const quitar = (i: number) => {
    setInsumos((prev) => prev.filter((_, j) => j !== i));
    setCambios(true);
  };

  const guardar = async () => {
    if (insumos.some((i) => !(Number(i.cantidad) > 0))) {
      toast.error("Cada insumo necesita una cantidad mayor que cero");
      return;
    }
    setGuardando(true);
    try {
      const limpios = normalizarInsumos(insumos);
      await guardarRecetaServicio(servicioId, limpios);
      setInsumos(limpios);
      setCambios(false);
      toast.success(limpios.length > 0 ? "Insumos guardados" : "El servicio ya no usa insumos");
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message;
      toast.error(msg || "No se pudieron guardar los insumos");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div>
        <Label className="text-xs">Insumos que usa</Label>
        <p className="text-[11px] text-muted-foreground">
          Por cada servicio vendido. Al cobrarlo se descuentan del inventario de la sucursal (primero el
          lote que caduca antes); en el punto de venta se pueden ajustar para cada venta.
        </p>
      </div>

      {cargando ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {insumos.length > 0 && (
            <ul className="space-y-1.5">
              {insumos.map((ins, i) => (
                <li key={`${ins.productId}-${ins.varianteId ?? ""}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{ins.nombre}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    aria-label={`Cantidad de ${ins.nombre}`}
                    value={Number.isFinite(ins.cantidad) ? String(ins.cantidad) : ""}
                    onChange={(e) => cambiarCantidad(i, e.target.value)}
                    className="h-8 w-20 text-right font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Quitar ${ins.nombre}`}
                    onClick={() => quitar(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Combobox
            items={disponibles}
            value={null}
            onValueChange={(v) => v && agregar(v as string)}
            itemToStringLabel={(v) => opciones.find((o) => o.value === v)?.label ?? ""}
            filter={(candidato, query) =>
              (candidato as unknown as OpcionCompra).keywords.toLowerCase().includes(query.toLowerCase())
            }
          >
            <ComboboxInputGroup className="h-8 w-full">
              <ComboboxInput placeholder="Agregar insumo…" />
              <ComboboxTrigger />
            </ComboboxInputGroup>
            <ComboboxPortal>
              <ComboboxPositioner>
                <ComboboxPopup className="min-w-64">
                  <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                  <ComboboxList>
                    {(o: OpcionCompra) => (
                      <ComboboxItem key={o.value} value={o.value}>
                        <ComboboxItemIndicator />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </ComboboxPositioner>
            </ComboboxPortal>
          </Combobox>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!cambios || guardando}
              onClick={() => void guardar()}
            >
              {guardando ? "Guardando…" : "Guardar insumos"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
