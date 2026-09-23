"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSucursal } from "@/contexts/sucursal-context";
import { CampoSucursal } from "@/features/sucursales/components/campo-sucursal";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Proveedor, PurchaseWithRelations } from "../../types/inventory.types";
import type { PurchaseInput } from "../../services/purchase-service";
import type { VarianteDeCompra } from "../../services/purchase-order-service";
import {
  buscarOpcion,
  construirOpciones,
  descomponerValor,
  type OpcionCompra,
} from "../../purchase-order-items";
import { totalesOrdenCompra } from "../../purchase-order-totals";
import { aRenglonesRpc, type RenglonCompraForm } from "../../compra-directa";

/**
 * Los campos numéricos van SIN las flechitas de incremento del navegador:
 * ocupan ~24px y dejaban el importe cortado. Igual que en el diálogo de
 * órdenes, de donde viene todo el manejo de renglones de esta pantalla.
 */
const SIN_SPINNERS =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const RENGLON_VACIO: RenglonCompraForm = {
  valor: "",
  cantidad: "",
  costo_unitario: "",
};

interface NewPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Proveedor[];
  products: { id: string; nombre: string; costo_compra: number }[];
  variants: VarianteDeCompra[];
  onConfirm: (input: PurchaseInput, renglones: RenglonCompraForm[]) => void;
  editingPurchase?: PurchaseWithRelations | null;
}

export function NewPurchaseDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  variants,
  onConfirm,
  editingPurchase = null,
}: NewPurchaseDialogProps) {
  const t = useTranslations();
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notas, setNotas] = useState("");
  const [incluyeIva, setIncluyeIva] = useState(true);
  const [renglones, setRenglones] = useState<RenglonCompraForm[]>([
    RENGLON_VACIO,
  ]);
  // A que local entra la mercancia. Arranca en la sucursal que el usuario esta
  // mirando; con varias y "Todas", vacia, para que se elija a proposito.
  const { seleccionada, activas, hayVarias } = useSucursal();
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Diferido, convención del repo: llamar a setState de forma síncrona
    // dentro del efecto encadena renders.
    const timeout = window.setTimeout(() => {
      if (editingPurchase) {
        setSelectedSupplier(editingPurchase.proveedor_id);
        setInvoiceNumber(editingPurchase.numero_factura || "");
      } else {
        setSelectedSupplier("");
        setInvoiceNumber("");
        setNotas("");
        setIncluyeIva(true);
        setRenglones([RENGLON_VACIO]);
        setSucursalId(destinoPorDefecto(seleccionada, activas));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingPurchase, seleccionada, activas]);

  const selectedSupplierName = useMemo(() => {
    const supplier = suppliers.find((s) => s.id === selectedSupplier);
    return supplier?.nombre ?? "";
  }, [selectedSupplier, suppliers]);

  // Productos y, debajo de cada uno, sus variantes. La misma función que usa
  // el diálogo de órdenes: comprar "sueter · M / ROJO" es el mismo problema.
  const opciones = useMemo(
    () => construirOpciones(products, variants),
    [products, variants]
  );

  const actualizarRenglon = (
    index: number,
    campo: keyof RenglonCompraForm,
    valor: string
  ) => {
    setRenglones((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [campo]: valor } : r))
    );
  };

  const elegirProducto = (index: number, valor: string) => {
    const { productoId, varianteId } = descomponerValor(valor);
    const opcion = buscarOpcion(opciones, productoId, varianteId);
    // El costo se precarga del último conocido, en un solo `setRenglones` para
    // que no se pisen dos actualizaciones seguidas. Es una sugerencia: lo que
    // manda es lo que diga la factura, y por eso queda editable.
    setRenglones((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, valor, costo_unitario: String(opcion?.costo ?? 0) }
          : r
      )
    );
  };

  // La MISMA función que calcula los importes de una orden. El servidor
  // recalcula todo por su cuenta; esto es solo lo que se le enseña al usuario,
  // y usar la función compartida es lo que garantiza que coincidan.
  const { subtotal, impuesto, total } = totalesOrdenCompra(
    renglones.map((r) => ({
      cantidad_solicitada: r.cantidad,
      costo_unitario: r.costo_unitario,
    })),
    incluyeIva
  );

  const handleConfirm = () => {
    // Con varios locales, una compra sin destino entraria en el local por
    // defecto sin que nadie lo decidiera. Mejor preguntar que adivinar.
    if (!editingPurchase && hayVarias && !sucursalId) {
      toast.error("Elige a qué sucursal llegó la mercancía");
      return;
    }
    onConfirm(
      {
        proveedorId: selectedSupplier,
        numeroFactura: invoiceNumber,
        items: aRenglonesRpc(renglones),
        incluyeIva,
        notas: notas.trim() || null,
        sucursalId,
      },
      renglones
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingPurchase
              ? t("purchases.editPurchase")
              : t("purchases.addPurchase")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingPurchase
              ? "Corrige el proveedor o el número de factura. Los importes salen del desglose y no se editan aquí."
              : "Mercancía que ya llegó y se pagó, sin orden previa. Al guardar se suma al inventario."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("purchases.supplier")}</Label>
              <Select
                value={selectedSupplier}
                onValueChange={(v) => setSelectedSupplier(v || "")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar proveedor">
                    {selectedSupplierName}
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
              <Label className="text-xs">{t("purchases.invoiceNumber")}</Label>
              <Input
                placeholder="Número de factura"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {!editingPurchase && (
            <CampoSucursal
              id="compra-sucursal"
              value={sucursalId}
              onChange={setSucursalId}
              etiqueta="Sucursal que recibe"
              ayuda="Las unidades se suman al inventario de este local."
            />
          )}

          {/* Editar solo toca la cabecera: cambiar renglones de una compra ya
              recibida obligaría a rehacer el movimiento de inventario, y para
              eso está cancelar y volver a registrarla. */}
          {!editingPurchase && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Productos</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setRenglones((prev) => [...prev, RENGLON_VACIO])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Agregar producto
                  </Button>
                </div>

                <div className="space-y-2">
                  {renglones.map((renglon, index) => (
                    <div key={index} className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-5 min-w-0 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Producto
                        </Label>
                        <Combobox
                          items={opciones}
                          value={
                            opciones.find((o) => o.value === renglon.valor) ??
                            null
                          }
                          onValueChange={(candidato) => {
                            const o = candidato as unknown as OpcionCompra;
                            if (o?.value) elegirProducto(index, o.value);
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
                          value={renglon.cantidad}
                          onChange={(e) =>
                            actualizarRenglon(index, "cantidad", e.target.value)
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
                          value={renglon.costo_unitario}
                          onChange={(e) =>
                            actualizarRenglon(
                              index,
                              "costo_unitario",
                              e.target.value
                            )
                          }
                          className={`h-8 text-sm font-mono ${SIN_SPINNERS}`}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={renglones.length === 1}
                          onClick={() =>
                            setRenglones((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notas</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1 border-t pt-3 font-mono text-sm">
                <span className="self-end text-xs text-muted-foreground">
                  Subtotal: ${subtotal.toFixed(2)}
                </span>

                {/* Mismo patrón que el carrito del Punto de Venta y que la
                    orden de compra: la casilla a la izquierda y el importe a la
                    derecha, que solo aparece cuando el IVA está activo. */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex cursor-pointer select-none items-center gap-1.5 font-sans text-muted-foreground">
                    <Checkbox
                      checked={incluyeIva}
                      onCheckedChange={(checked) =>
                        setIncluyeIva(checked === true)
                      }
                    />
                    Incluir IVA (16%)
                  </label>
                  {incluyeIva && (
                    <span className="text-muted-foreground">
                      ${impuesto.toFixed(2)}
                    </span>
                  )}
                </div>

                <span className="self-end font-semibold">
                  Total: ${total.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <SpecularActionButton tone="add" className="h-8" onClick={handleConfirm}>
            {editingPurchase ? t("purchases.saveChanges") : t("common.confirm")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
