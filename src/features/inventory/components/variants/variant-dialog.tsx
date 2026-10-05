"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import { EtiquetasInput } from "@/components/ui/etiquetas-input";
import { FileUpload } from "@/components/ui/file-upload";
import { IMAGEN_PRODUCTO } from "@/lib/imagen-validacion";
import { subirImagenProducto } from "../../services/product-service";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useModulos } from "@/hooks/use-modulos";
import { unidadesOfrecidas } from "@/lib/modulos";
import { enUnidad, esFraccionable, porUnidad, type UnidadMedida } from "@/lib/unidades";
import type { ProductoOption, VarianteProducto } from "../../types/inventory.types";
import type { VarianteInput } from "../../services/variant-service";
import {
  COLORES,
  TIPO_COLOR,
  TIPO_PERSONALIZADO,
  TIPOS_ATRIBUTO,
  atributosDeVariante,
  hexDeColor,
  normalizarValor,
  resumenCompatible,
  sugerenciasDe,
  tiposSugeridos,
} from "../../atributos-variante";
import { UNIDAD_DEL_PRODUCTO } from "../../tarjetas-variante";

/**
 * EDITAR una variante: un valor por atributo, foto, descripcion, unidad, SKU,
 * codigo, precio, costo, stock y minimo.
 *
 * Crear variantes (una o varias, con el producto general nuevo o uno que ya
 * existe) es `CrearVariantesDialog`.
 */

interface FilaAtributo {
  id: number;
  tipo: string;
  /** Solo con `tipo === "Personalizado"`: el nombre que le pone el usuario. */
  nombre: string;
  valores: string[];
}

const TIPOS_CONOCIDOS = new Set(TIPOS_ATRIBUTO.map((t) => t.tipo));

let siguienteId = 1;
const tipoEfectivo = (f: FilaAtributo) => (f.tipo === TIPO_PERSONALIZADO ? normalizarValor(f.nombre) : f.tipo);

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
}

export function VariantDialog({
  open,
  onOpenChange,
  editingVariant,
  products,
  variantes,
  saving,
  onSave,
}: VariantDialogProps) {
  const { tenantGiro, tenantId } = useCurrentTenant();
  const t = useTranslations();
  const { modulos } = useModulos();
  const [filas, setFilas] = useState<FilaAtributo[]>([]);
  const [sku, setSku] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("0");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [descripcion, setDescripcion] = useState("");
  // Unidad propia de la variante (migracion 104) o la del producto.
  const [unidad, setUnidad] = useState<string>(UNIDAD_DEL_PRODUCTO);
  // Foto (opcional): la que se eligio o tomo y si se quito la que tenia.
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenQuitada, setImagenQuitada] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const sincronizar = (variant: VarianteProducto) => {
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
    setStockMinimo(String(variant.stock_minimo ?? 0));
    setDescripcion(variant.descripcion ?? "");
    setUnidad(variant.unidad_medida ?? UNIDAD_DEL_PRODUCTO);
    setImagenFile(null);
    setImagenPreview(variant.imagen_url ?? null);
    setImagenQuitada(false);
  };

  useEffect(() => {
    if (!open || !editingVariant) return;
    const timeout = window.setTimeout(() => sincronizar(editingVariant), 0);
    return () => window.clearTimeout(timeout);
    // Solo al abrir o cambiar la variante que se edita.
  }, [open, editingVariant]);

  const productoId = editingVariant?.producto_id ?? "";
  const producto = useMemo(() => products.find((p) => p.id === productoId) ?? null, [products, productoId]);
  // Unidades que puede elegir la variante: las fisicas que permiten los
  // modulos (sin "Servicio"); la que ya tenia entra siempre.
  const unidadesVariante = unidadesOfrecidas(
    modulos,
    unidad === UNIDAD_DEL_PRODUCTO ? null : (unidad as UnidadMedida)
  ).filter((u) => u !== "SERVICIO");
  const etiquetaDelProducto = producto?.unidad_medida
    ? `Igual que el producto (${t(`products.units.${producto.unidad_medida}`)})`
    : "Igual que el producto";
  // La unidad con la que se vende: la suya o la del producto (para "por kg").
  const unidadEfectiva = unidad === UNIDAD_DEL_PRODUCTO ? producto?.unidad_medida : unidad;
  const tipos = useMemo(() => {
    const v = variantes.find((x) => x.producto_id === productoId && atributosDeVariante(x).length > 0);
    return tiposSugeridos(tenantGiro, v ? atributosDeVariante(v).map((a) => a.tipo) : []);
  }, [tenantGiro, productoId, variantes]);

  const cambiarFila = (id: number, cambio: Partial<FilaAtributo>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambio } : f)));

  /** Valida y guarda. `true` si quedo guardada. */
  const handleSave = async (): Promise<boolean> => {
    if (!editingVariant) return false;
    if (filas.some((f) => f.tipo === TIPO_PERSONALIZADO && !normalizarValor(f.nombre))) {
      toast.error("Ponle nombre al atributo personalizado");
      return false;
    }
    const atributos = filas
      .map((f) => ({ tipo: tipoEfectivo(f), valor: normalizarValor(f.valores[0] ?? "") }))
      .filter((a) => a.tipo && a.valor);
    if (atributos.length === 0) {
      toast.error("Agrega al menos un valor de atributo");
      return false;
    }
    if (!(parseFloat(precio) > 0)) {
      toast.error("El precio de venta debe ser mayor a 0");
      return false;
    }

    let imagen_url: string | null = editingVariant.imagen_url ?? null;
    if (imagenFile) {
      if (!tenantId) return false;
      setSubiendo(true);
      try {
        imagen_url = await subirImagenProducto(imagenFile, tenantId);
      } catch {
        toast.error("No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.");
        return false;
      } finally {
        setSubiendo(false);
      }
    } else if (imagenQuitada) {
      imagen_url = null;
    }

    return onSave({
      producto_id: productoId,
      sku: sku || null,
      codigo_barras: codigo || null,
      ...resumenCompatible(atributos),
      atributos,
      precio_venta: parseFloat(precio) || 0,
      costo_compra: parseFloat(costo) || 0,
      stock_actual: parseFloat(stock) || 0,
      stock_minimo: Math.max(0, parseFloat(stockMinimo) || 0),
      descripcion: descripcion.trim() || null,
      unidad_medida: unidad === UNIDAD_DEL_PRODUCTO ? null : (unidad as UnidadMedida),
      imagen_url,
    });
  };

  const guardarEdicion = async () => {
    if (await handleSave()) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Editar variante</DialogTitle>
          <DialogDescription className="text-xs">
            {producto ? `Variante de «${producto.nombre}»` : "Actualiza los datos de la variante"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Atributos: un valor por tipo */}
          <div className="space-y-3">
            {filas.map((fila) => {
              const usadosPorOtras = new Set(filas.filter((f) => f.id !== fila.id).map((f) => f.tipo));
              const opciones = tipos.filter((t) => t === TIPO_PERSONALIZADO || t === fila.tipo || !usadosPorOtras.has(t));
              const esColor = fila.tipo === TIPO_COLOR;
              const sugerencias = (esColor ? COLORES.map((c) => c.nombre) : sugerenciasDe(fila.tipo)).filter(
                (s) => !fila.valores.some((v) => v.toLowerCase() === s.toLowerCase())
              );
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
                    <Label className="text-xs">Valor</Label>
                    <EtiquetasInput
                      valores={fila.valores}
                      onChange={(valores) => cambiarFila(fila.id, { valores })}
                      normalizar={normalizarValor}
                      prefijo={esColor ? (v) => <PuntoColor valor={v} /> : undefined}
                      max={1}
                      placeholder={esColor ? "Ej: Rojo" : "Escribe un valor"}
                      ayuda=""
                      ariaLabel={`Valor de ${tipoEfectivo(fila) || "atributo"}`}
                    />
                  </div>

                  {fila.valores.length === 0 && sugerencias.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sugerencias.slice(0, esColor ? 14 : 8).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => cambiarFila(fila.id, { valores: [s] })}
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
          </div>

          {/* Foto de la variante: subir o (en celular) tomarla con la camara. */}
          <div className="space-y-1.5">
            <Label className="text-xs">Foto (opcional)</Label>
            <FileUpload
              preview={imagenPreview}
              onFileSelect={(file) => {
                setImagenFile(file);
                setImagenQuitada(false);
                setImagenPreview(URL.createObjectURL(file));
              }}
              onFileRemove={() => {
                setImagenFile(null);
                setImagenPreview(null);
                setImagenQuitada(true);
              }}
              dragDropText="Arrastra una foto de la variante o haz clic para seleccionar"
              maxSizeText="Se recorta a cuadrado y se optimiza automáticamente"
              opciones={IMAGEN_PRODUCTO}
              accept="image/*"
              allowCamera
            />
          </div>

          {/* Descripcion y unidad */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="variante-descripcion" className="text-xs">
                Descripción <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="variante-descripcion"
                placeholder="Ej. Botella retornable"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={200}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unidad de medida</Label>
              <Select
                items={{
                  [UNIDAD_DEL_PRODUCTO]: etiquetaDelProducto,
                  ...Object.fromEntries(unidadesVariante.map((u) => [u, t(`products.units.${u}`)])),
                }}
                value={unidad}
                onValueChange={(v) => typeof v === "string" && setUnidad(v)}
              >
                <SelectTrigger className="h-8 w-full text-sm" aria-label="Unidad de medida">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNIDAD_DEL_PRODUCTO}>{etiquetaDelProducto}</SelectItem>
                  {unidadesVariante.map((u) => (
                    <SelectItem key={u} value={u}>
                      {t(`products.units.${u}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SKU y codigo de barras */}
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

          {/* Precio, costo, stock y minimo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Precio de venta{porUnidad(unidadEfectiva)} *</Label>
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
              <Label className="text-xs">Costo de compra{porUnidad(unidadEfectiva)}</Label>
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
              <Label className="text-xs">Stock actual{enUnidad(unidadEfectiva)}</Label>
              <Input
                type="number"
                step={esFraccionable(unidadEfectiva) ? "any" : undefined}
                min="0"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock mínimo{enUnidad(unidadEfectiva)}</Label>
              <Input
                type="number"
                step={esFraccionable(unidadEfectiva) ? "any" : undefined}
                min="0"
                placeholder="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <SpecularActionButton tone="add" className="h-8" onClick={() => void guardarEdicion()} disabled={saving || subiendo}>
            {subiendo ? "Subiendo foto..." : saving ? "Guardando..." : "Guardar cambios"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
