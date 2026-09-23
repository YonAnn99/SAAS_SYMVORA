"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ordenLlevaIva,
  totalesOrdenCompra,
} from "@/features/inventory/purchase-order-totals";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DetalleOrdenCompra, OrdenCompra } from "../../types/inventory.types";
import {
  defaultOrdenFormData,
  type OrdenFormData,
  type ProductOption,
} from "../../types/inventory.types";
import type { OrdenSaveInput } from "../../hooks/use-purchase-orders";
import { useSucursal } from "@/contexts/sucursal-context";
import { CampoSucursal } from "@/features/sucursales/components/campo-sucursal";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import type {
  OrderDetailItem,
  VarianteDeCompra,
} from "../../services/purchase-order-service";
import {
  buscarOpcion,
  componerValor,
  construirOpciones,
  descomponerValor,
  type OpcionCompra,
} from "../../purchase-order-items";

/**
 * Los campos numéricos van SIN las flechitas de incremento del navegador.
 * Ocupan ~24px del ancho del campo y, en la columna de Costo, dejaban el
 * importe cortado ("15" en vez de "15.00").
 */
const SIN_SPINNERS =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: OrdenCompra | null;
  initialDetails: DetalleOrdenCompra[];
  suppliers: ProductOption[];
  products: { id: string; nombre: string; costo_compra: number }[];
  variants: VarianteDeCompra[];
  existingOrders?: OrdenCompra[];
  saving: boolean;
  onSave: (input: OrdenSaveInput) => void;
}

function getNextOrderNumber(existingOrders: OrdenCompra[]): string {
  const prefix = "OC-";
  const numbers = existingOrders
    .map((o) => o.numero_orden)
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function PurchaseOrderDialog({
  open,
  onOpenChange,
  editingOrder,
  initialDetails,
  suppliers,
  products,
  variants,
  existingOrders = [],
  saving,
  onSave,
}: PurchaseOrderDialogProps) {
  const [formData, setFormData] = useState<OrdenFormData>(
    defaultOrdenFormData
  );
  // A que local ira la mercancia. Se decide al pedirla porque es cuando se
  // sabe; la recepcion la sumara ahi.
  const { seleccionada, activas, hayVarias } = useSucursal();
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      setSucursalId(
        editingOrder?.sucursal_id ?? destinoPorDefecto(seleccionada, activas)
      );
      if (editingOrder) {
        setFormData({
          proveedor_id: editingOrder.proveedor_id,
          numero_orden: editingOrder.numero_orden,
          notas: editingOrder.notas || "",
          // Se deduce de lo guardado, no del valor por defecto: si no, abrir
          // una orden emitida sin IVA y guardarla le volveria a poner el 16 %.
          // Y una orden anterior a este cambio sigue saliendo con su IVA.
          incluye_iva: ordenLlevaIva(editingOrder),
          items: initialDetails.map((d) => ({
            producto_id: d.producto_id,
            variante_id: d.variante_id ?? null,
            cantidad_solicitada: d.cantidad_solicitada.toString(),
            costo_unitario: d.costo_unitario.toString(),
          })),
        });
      } else {
        setFormData({
          ...defaultOrdenFormData,
          numero_orden: getNextOrderNumber(existingOrders),
        });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingOrder, initialDetails, existingOrders, seleccionada, activas]);

  // Genérico por campo: `incluye_iva` es booleano y el resto texto, así que
  // fijar `value: string` obligaría a un cast en el único campo que no lo es.
  const updateField = <K extends keyof OrdenFormData>(
    field: K,
    value: OrdenFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (
    index: number,
    field: keyof (typeof formData.items)[number],
    value: string | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          producto_id: "",
          variante_id: null,
          cantidad_solicitada: "",
          costo_unitario: "",
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const selectedProveedorName = useMemo(
    () => suppliers.find((s) => s.id === formData.proveedor_id)?.nombre ?? formData.proveedor_id,
    [suppliers, formData.proveedor_id]
  );

  // Productos y, debajo de cada uno, sus variantes. Se recalcula solo cuando
  // cambian los datos, no en cada tecleo del buscador.
  const opciones = useMemo(
    () => construirOpciones(products, variants),
    [products, variants]
  );

  const handleProductChange = (index: number, value: string) => {
    const { productoId, varianteId } = descomponerValor(value);
    const opcion = buscarOpcion(opciones, productoId, varianteId);
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? {
              ...item,
              producto_id: productoId,
              variante_id: varianteId,
              // El costo se precarga del que corresponda: el de la variante si
              // se eligió una, el del producto si no. En un solo `setFormData`
              // para que no se pisen dos actualizaciones seguidas.
              costo_unitario: String(opcion?.costo ?? 0),
            }
          : item
      ),
    }));
  };

  // La MISMA funcion que usa el hook al guardar. Antes eran dos cuentas
  // distintas y solo contaba la del hook, asi que la pantalla podia mentir.
  const { subtotal, impuesto, total } = totalesOrdenCompra(
    formData.items,
    formData.incluye_iva
  );

  const handleSave = () => {
    if (!formData.proveedor_id) {
      toast.error("Selecciona un proveedor");
      return;
    }

    if (!formData.numero_orden) {
      toast.error("Ingresa el número de orden");
      return;
    }

    const details: OrderDetailItem[] = formData.items
      .filter((item) => item.producto_id)
      .map((item) => ({
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
        costo_unitario: parseFloat(item.costo_unitario) || 0,
        subtotal:
          (parseFloat(item.cantidad_solicitada) || 0) *
          (parseFloat(item.costo_unitario) || 0),
      }));

    if (details.length === 0) {
      toast.error("Agrega al menos un producto a la orden");
      return;
    }

    if (hayVarias && !sucursalId) {
      toast.error("Elige a qué sucursal va la mercancía");
      return;
    }

    onSave({
      proveedor_id: formData.proveedor_id,
      numero_orden: formData.numero_orden,
      notas: formData.notas || "",
      incluye_iva: formData.incluye_iva,
      sucursal_id: sucursalId,
      items: details.map((d) => ({
        producto_id: d.producto_id,
        variante_id: d.variante_id,
        cantidad_solicitada: d.cantidad_solicitada.toString(),
        costo_unitario: d.costo_unitario.toString(),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingOrder ? "Editar orden de compra" : "Nueva orden de compra"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingOrder
              ? "Actualiza los datos de la orden"
              : "Crea una nueva orden de compra a proveedor"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Proveedor *</Label>
              <Select
                value={formData.proveedor_id}
                onValueChange={(v) => updateField("proveedor_id", v ?? "")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar proveedor">
                    {selectedProveedorName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número de orden *</Label>
              <Input
                placeholder="OC-001"
                value={formData.numero_orden}
                onChange={(e) => updateField("numero_orden", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <CampoSucursal
            id="orden-sucursal"
            value={sucursalId}
            onChange={setSucursalId}
            etiqueta="Sucursal que recibe"
            ayuda="Al recibir la orden, las unidades entran en este local."
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Productos</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar producto
              </Button>
            </div>
            {formData.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg">
                Agrega productos a la orden
              </p>
            ) : (
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end"
                  >
                    {/* El producto cede una columna al costo: con 6 el importe
                        no cabía. El buscador lo compensa — ya no hace falta
                        leer la lista entera para encontrar algo. */}
                    <div className="col-span-5 space-y-1 min-w-0">
                      <Label className="text-[10px] text-muted-foreground">
                        Producto
                      </Label>
                      <Combobox
                        items={opciones}
                        value={
                          item.producto_id
                            ? componerValor(item.producto_id, item.variante_id)
                            : null
                        }
                        onValueChange={(value) =>
                          handleProductChange(index, (value as string) ?? "")
                        }
                        itemToStringLabel={(value) =>
                          opciones.find((o) => o.value === value)?.label ?? ""
                        }
                        filter={(candidato, query) => {
                          const o = candidato as unknown as OpcionCompra;
                          return o.keywords
                            .toLowerCase()
                            .includes(query.toLowerCase());
                        }}
                      >
                        <ComboboxInputGroup className="h-8">
                          <ComboboxInput placeholder="Buscar producto..." />
                          <ComboboxTrigger />
                        </ComboboxInputGroup>
                        <ComboboxPortal>
                          <ComboboxPositioner>
                            <ComboboxPopup>
                              <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                              <ComboboxList>
                                {(o: OpcionCompra) => (
                                  <ComboboxItem key={o.value} value={o.value}>
                                    <ComboboxItemIndicator />
                                    <span>{o.label}</span>
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxPopup>
                          </ComboboxPositioner>
                        </ComboboxPortal>
                      </Combobox>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Cantidad
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.cantidad_solicitada}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "cantidad_solicitada",
                            e.target.value
                          )
                        }
                        className={`h-8 text-sm font-mono ${SIN_SPINNERS}`}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Costo
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costo_unitario}
                        onChange={(e) =>
                          updateItem(index, "costo_unitario", e.target.value)
                        }
                        className={`h-8 text-sm font-mono ${SIN_SPINNERS}`}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              placeholder="Notas adicionales..."
              value={formData.notas}
              onChange={(e) => updateField("notas", e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </div>

          <div className="flex flex-col gap-1 border-t pt-3 text-sm font-mono">
            <span className="self-end text-muted-foreground text-xs">
              Subtotal: ${subtotal.toFixed(2)}
            </span>

            {/* Mismo patrón que el carrito del Punto de Venta: la casilla a la
                izquierda y el importe a la derecha, que solo aparece cuando el
                IVA está activo. */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex cursor-pointer select-none items-center gap-1.5 font-sans text-muted-foreground">
                <Checkbox
                  checked={formData.incluye_iva}
                  onCheckedChange={(checked) =>
                    updateField("incluye_iva", checked === true)
                  }
                />
                Incluir IVA (16%)
              </label>
              {formData.incluye_iva && (
                <span className="text-muted-foreground">
                  ${impuesto.toFixed(2)}
                </span>
              )}
            </div>

            <span className="self-end font-semibold">
              Total: ${total.toFixed(2)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Guardando..."
              : editingOrder
                ? "Guardar cambios"
                : "Crear orden"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}