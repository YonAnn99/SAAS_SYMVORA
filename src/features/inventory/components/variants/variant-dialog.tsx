"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { COLOR_ALTA, SONIDO_ALTA, celebrarAlta, precargarSonido } from "@/lib/celebracion";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import { EtiquetasInput } from "@/components/ui/etiquetas-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { ProductoOption, VarianteProducto } from "../../types/inventory.types";
import type { VarianteInput } from "../../services/variant-service";
import {
  COLORES,
  TIPO_COLOR,
  TIPO_PERSONALIZADO,
  TIPOS_ATRIBUTO,
  atributosDeVariante,
  combinaciones,
  hexDeColor,
  normalizarValor,
  resumenCompatible,
  skuDeCombinacion,
  sugerenciasDe,
  tiposSugeridos,
  type Atributo,
} from "../../atributos-variante";

/**
 * Crear / editar variante con atributos (Color, Talla, Sabor, Voltaje...).
 *
 * Al CREAR, cada atributo admite varios valores (etiquetas) y se generan todas
 * las combinaciones: Color {Rojo, Azul} × Talla {M, L} = 4 variantes, con
 * precio y stock por fila. Al EDITAR, un valor por atributo.
 *
 * Los tipos se ofrecen en el orden de `tiposSugeridos`: primero los que ya usa
 * el producto, luego los del giro del negocio.
 */

interface FilaAtributo {
  id: number;
  tipo: string;
  /** Solo con `tipo === "Personalizado"`: el nombre que le pone el usuario. */
  nombre: string;
  valores: string[];
}

interface AjusteFila {
  precio?: string;
  stock?: string;
  quitada?: boolean;
}

const MAX_ATRIBUTOS = 3;
const TIPOS_CONOCIDOS = new Set(TIPOS_ATRIBUTO.map((t) => t.tipo));

let siguienteId = 1;
const nuevaFila = (tipo: string): FilaAtributo => ({ id: siguienteId++, tipo, nombre: "", valores: [] });
const tipoEfectivo = (f: FilaAtributo) => (f.tipo === TIPO_PERSONALIZADO ? normalizarValor(f.nombre) : f.tipo);
const claveCombo = (combo: Atributo[]) => combo.map((a) => `${a.tipo}=${a.valor}`).join("|");

function PuntoColor({ valor }: { valor: string }) {
  const hex = hexDeColor(valor);
  if (!hex) return null;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/15 dark:border-white/20"
      style={{ backgroundColor: hex }}
      aria-hidden="true"
    />
  );
}

interface VariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVariant: VarianteProducto | null;
  products: ProductoOption[];
  /** Variantes existentes: dan los atributos que ya usa cada producto. */
  variantes: VarianteProducto[];
  saving: boolean;
  /** `true` si quedo guardada. Cerrar lo decide el dialogo. */
  onSave: (input: VarianteInput) => Promise<boolean>;
  /** Varias combinaciones a la vez. */
  onSaveMany: (inputs: VarianteInput[]) => Promise<boolean>;
}

export function VariantDialog({
  open,
  onOpenChange,
  editingVariant,
  products,
  variantes,
  saving,
  onSave,
  onSaveMany,
}: VariantDialogProps) {
  const { tenantGiro } = useCurrentTenant();
  const [productoId, setProductoId] = useState("");
  const [filas, setFilas] = useState<FilaAtributo[]>([]);
  const [sku, setSku] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("0");
  const [ajustes, setAjustes] = useState<Record<string, AjusteFila>>({});

  const tiposDelProducto = (id: string): string[] => {
    const v = variantes.find((x) => x.producto_id === id && atributosDeVariante(x).length > 0);
    return v ? atributosDeVariante(v).map((a) => a.tipo) : [];
  };

  const reiniciar = () => {
    setProductoId("");
    setFilas([]);
    setSku("");
    setCodigo("");
    setPrecio("");
    setCosto("");
    setStock("0");
    setAjustes({});
  };

  const sincronizar = (variant: VarianteProducto | null) => {
    if (!variant) {
      reiniciar();
      return;
    }
    setProductoId(variant.producto_id);
    setFilas(
      atributosDeVariante(variant).map((a) => ({
        id: siguienteId++,
        tipo: TIPOS_CONOCIDOS.has(a.tipo) ? a.tipo : TIPO_PERSONALIZADO,
        nombre: TIPOS_CONOCIDOS.has(a.tipo) ? "" : a.tipo,
        valores: [a.valor],
      }))
    );
    setSku(variant.sku || "");
    setCodigo(variant.codigo_barras || "");
    setPrecio(variant.precio_venta.toString());
    setCosto(variant.costo_compra.toString());
    setStock(variant.stock_actual.toString());
    setAjustes({});
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reiniciar();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => sincronizar(editingVariant), 0);
    return () => window.clearTimeout(timeout);
    // Solo al abrir o cambiar la variante que se edita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingVariant]);

  // Al crear se confirma deslizando, con sonido: se deja descargado al abrir.
  useEffect(() => {
    if (open && !editingVariant) precargarSonido(SONIDO_ALTA);
  }, [open, editingVariant]);

  const productoElegido = useMemo(
    () => products.find((p) => p.id === productoId) ?? null,
    [products, productoId]
  );
  const sinProductos = products.length === 0;
  const editando = Boolean(editingVariant);
  const tipos = useMemo(
    () => tiposSugeridos(tenantGiro, productoId ? tiposDelProducto(productoId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantGiro, productoId, variantes]
  );

  // Elegir producto (al crear): prellena los atributos que ya usa, o el primero
  // que recomienda el giro.
  const elegirProducto = (id: string) => {
    setProductoId(id);
    if (editando) return;
    const usados = id ? tiposDelProducto(id) : [];
    const sugeridos = tiposSugeridos(tenantGiro, usados);
    setFilas(
      usados.length
        ? usados.map((t) =>
            TIPOS_CONOCIDOS.has(t) ? nuevaFila(t) : { ...nuevaFila(TIPO_PERSONALIZADO), nombre: t }
          )
        : [nuevaFila(sugeridos[0])]
    );
    setAjustes({});
  };

  const cambiarFila = (id: number, cambio: Partial<FilaAtributo>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambio } : f)));

  const agregarFila = () => {
    const usados = new Set(filas.map((f) => f.tipo));
    const libre = tipos.find((t) => t !== TIPO_PERSONALIZADO && !usados.has(t)) ?? TIPO_PERSONALIZADO;
    setFilas((prev) => [...prev, nuevaFila(libre)]);
  };

  const combos = useMemo(
    () => combinaciones(filas.map((f) => ({ tipo: tipoEfectivo(f), valores: f.valores }))),
    [filas]
  );
  const combosActivos = combos.filter((c) => !ajustes[claveCombo(c)]?.quitada);
  const enLote = !editando && combosActivos.length > 1;

  const ajustar = (clave: string, cambio: AjusteFila) =>
    setAjustes((prev) => ({ ...prev, [clave]: { ...prev[clave], ...cambio } }));

  const baseSku = (productoElegido?.nombre ?? "VAR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4);

  const armar = (combo: Atributo[], extra: Partial<VarianteInput>): VarianteInput => ({
    producto_id: productoId,
    sku: null,
    codigo_barras: null,
    ...resumenCompatible(combo),
    atributos: combo,
    precio_venta: parseFloat(precio) || 0,
    costo_compra: parseFloat(costo) || 0,
    stock_actual: parseFloat(stock) || 0,
    ...extra,
  });

  /** Valida y guarda. `true` si quedo guardada. */
  const handleSave = async (): Promise<boolean> => {
    if (!productoId) {
      toast.error("Selecciona un producto");
      return false;
    }
    if (filas.some((f) => f.tipo === TIPO_PERSONALIZADO && !normalizarValor(f.nombre))) {
      toast.error("Ponle nombre al atributo personalizado");
      return false;
    }
    if (combosActivos.length === 0) {
      toast.error("Agrega al menos un valor de atributo");
      return false;
    }
    const precioGeneral = parseFloat(precio);

    if (enLote) {
      const inputs = combosActivos.map((combo) => {
        const a = ajustes[claveCombo(combo)] ?? {};
        return armar(combo, {
          sku: skuDeCombinacion(baseSku, combo.map((x) => x.valor)),
          precio_venta: parseFloat(a.precio ?? "") || precioGeneral || 0,
          stock_actual: parseFloat(a.stock ?? "") || parseFloat(stock) || 0,
        });
      });
      if (inputs.some((i) => !(i.precio_venta > 0))) {
        toast.error("Cada variante necesita un precio de venta mayor a 0");
        return false;
      }
      return onSaveMany(inputs);
    }

    if (!(precioGeneral > 0)) {
      toast.error("El precio de venta debe ser mayor a 0");
      return false;
    }
    const combo = combosActivos[0];
    return onSave(
      armar(combo, {
        sku: sku || (editando ? null : skuDeCombinacion(baseSku, combo.map((x) => x.valor))),
        codigo_barras: codigo || null,
      })
    );
  };

  const guardarEdicion = async () => {
    if (await handleSave()) handleOpenChange(false);
  };
  const crearDeslizando = async () => {
    if (!(await handleSave())) throw new Error("No se guardó");
  };
  const trasCrear = (origen: DOMRect | null) => {
    celebrarAlta(origen);
    window.setTimeout(() => handleOpenChange(false), 900);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{editando ? "Editar variante" : "Crear variante"}</DialogTitle>
          <DialogDescription className="text-xs">
            {editando
              ? "Actualiza los datos de la variante"
              : "Elige los atributos y sus valores; se crea una variante por combinación"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Producto */}
          <div className="space-y-1.5">
            <Label className="text-xs">Producto *</Label>
            {sinProductos ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                Primero agrega productos en la pestaña Catálogo.
              </p>
            ) : (
              <Combobox
                items={products}
                value={productoId || null}
                onValueChange={(v) => elegirProducto((v as string) ?? "")}
                itemToStringLabel={(v) => products.find((p) => p.id === v)?.nombre ?? ""}
                filter={(candidato, query) =>
                  (candidato as unknown as ProductoOption).nombre.toLowerCase().includes(query.toLowerCase())
                }
                disabled={editando}
              >
                <ComboboxInputGroup className="h-8 w-full">
                  <ComboboxInput placeholder="Buscar producto..." />
                  <ComboboxTrigger />
                </ComboboxInputGroup>
                <ComboboxPortal>
                  <ComboboxPositioner>
                    <ComboboxPopup>
                      <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                      <ComboboxList>
                        {(p: ProductoOption) => (
                          <ComboboxItem key={p.id} value={p.id}>
                            <ComboboxItemIndicator />
                            <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                            {p.permite_variantes && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/70">Con variantes</span>
                            )}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxPopup>
                  </ComboboxPositioner>
                </ComboboxPortal>
              </Combobox>
            )}
            {!editando && productoElegido && !productoElegido.permite_variantes && (
              <p className="text-[11px] text-muted-foreground">
                Al guardar se activará &quot;Maneja variantes&quot; en este producto.
              </p>
            )}
          </div>

          {/* Atributos */}
          {productoId && (
            <div className="space-y-3">
              {filas.map((fila) => {
                const usadosPorOtras = new Set(filas.filter((f) => f.id !== fila.id).map((f) => f.tipo));
                const opciones = tipos.filter((t) => t === TIPO_PERSONALIZADO || t === fila.tipo || !usadosPorOtras.has(t));
                const esColor = fila.tipo === TIPO_COLOR;
                const sugerencias = (esColor ? COLORES.map((c) => c.nombre) : sugerenciasDe(fila.tipo)).filter(
                  (s) => !fila.valores.some((v) => v.toLowerCase() === s.toLowerCase())
                );
                const lleno = editando && fila.valores.length >= 1;
                return (
                  <div key={fila.id} className="rounded-xl border border-border p-3 space-y-2.5">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label className="text-xs">Tipo de atributo</Label>
                        <Select
                          items={Object.fromEntries(opciones.map((t) => [t, t]))}
                          value={fila.tipo}
                          onValueChange={(v) => typeof v === "string" && cambiarFila(fila.id, { tipo: v, valores: [] })}
                        >
                          <SelectTrigger className="h-8 w-full" aria-label="Tipo de atributo">
                            <SelectValue placeholder="Selecciona un atributo" />
                          </SelectTrigger>
                          <SelectContent>
                            {opciones.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {filas.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          onClick={() => setFilas((prev) => prev.filter((f) => f.id !== fila.id))}
                          aria-label="Quitar atributo"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {fila.tipo === TIPO_PERSONALIZADO && (
                      <Input
                        placeholder="Nombre del atributo (ej: Aroma)"
                        value={fila.nombre}
                        onChange={(e) => cambiarFila(fila.id, { nombre: e.target.value })}
                        maxLength={30}
                        className="h-8 text-sm"
                      />
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">{editando ? "Valor" : "Valores del atributo"}</Label>
                      <EtiquetasInput
                        valores={fila.valores}
                        onChange={(valores) => cambiarFila(fila.id, { valores })}
                        normalizar={normalizarValor}
                        prefijo={esColor ? (v) => <PuntoColor valor={v} /> : undefined}
                        max={editando ? 1 : undefined}
                        placeholder={esColor ? "Ej: Rojo" : "Escribe un valor"}
                        ayuda={editando ? "" : "Ingresa cada valor y presiona Enter."}
                        ariaLabel={`Valores de ${tipoEfectivo(fila) || "atributo"}`}
                      />
                    </div>

                    {!lleno && sugerencias.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sugerencias.slice(0, esColor ? 14 : 8).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => cambiarFila(fila.id, { valores: editando ? [s] : [...fila.valores, s] })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[#1e3a8a] hover:text-foreground dark:hover:border-blue-500"
                          >
                            {esColor && <PuntoColor valor={s} />}
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {!editando && filas.length < MAX_ATRIBUTOS && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={agregarFila}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar otro atributo
                </Button>
              )}
            </div>
          )}

          {/* Una sola variante: SKU y codigo de barras */}
          {productoId && !enLote && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input
                  placeholder="Automático"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código de barras</Label>
                <div className="relative">
                  <Input
                    placeholder="EAN-13"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="h-8 pr-9 text-sm font-mono"
                  />
                  <BotonEscanear modo="uno" titulo="Escanear código de la variante" onCodigo={setCodigo} />
                </div>
              </div>
            </div>
          )}

          {/* Precio, costo y stock (en lote: valores para todas) */}
          {productoId && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{enLote ? "Precio (todas) *" : "Precio de venta *"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Costo de compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{enLote ? "Stock (cada una)" : "Stock actual"}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {/* Varias combinaciones: una fila por variante */}
          {enLote && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                Se crearán {combosActivos.length} variantes
                <span className="font-normal text-muted-foreground"> · ajusta precio o stock por fila si cambia</span>
              </p>
              <div className="divide-y divide-border rounded-xl border border-border">
                {combos.map((combo) => {
                  const clave = claveCombo(combo);
                  const a = ajustes[clave] ?? {};
                  if (a.quitada) return null;
                  const color = combo.find((x) => x.tipo === TIPO_COLOR)?.valor;
                  return (
                    <div key={clave} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        {color && <PuntoColor valor={color} />}
                        <span className="truncate">{combo.map((x) => x.valor).join(" · ")}</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={precio || "Precio"}
                        value={a.precio ?? ""}
                        onChange={(e) => ajustar(clave, { precio: e.target.value })}
                        aria-label={`Precio de ${combo.map((x) => x.valor).join(" ")}`}
                        className="h-7 w-20 text-xs font-mono"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder={stock || "0"}
                        value={a.stock ?? ""}
                        onChange={(e) => ajustar(clave, { stock: e.target.value })}
                        aria-label={`Stock de ${combo.map((x) => x.valor).join(" ")}`}
                        className="h-7 w-14 text-xs font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        onClick={() => ajustar(clave, { quitada: true })}
                        aria-label="No crear esta combinación"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                El SKU se genera solo. El código de barras se agrega después editando cada variante.
              </p>
            </div>
          )}
        </div>

        {editando ? (
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <SpecularActionButton tone="add" className="h-8" onClick={() => void guardarEdicion()} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </SpecularActionButton>
          </DialogFooter>
        ) : (
          <div className="flex flex-col items-stretch gap-2">
            <DeslizarParaConfirmar
              label={enLote ? `Desliza para crear ${combosActivos.length} variantes` : "Desliza para crear variante"}
              doneLabel={enLote ? "Variantes creadas" : "Variante creada"}
              errorLabel="No se guardó"
              successColor={COLOR_ALTA}
              disabled={sinProductos}
              onConfirm={crearDeslizando}
              onDone={trasCrear}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-center text-muted-foreground"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
