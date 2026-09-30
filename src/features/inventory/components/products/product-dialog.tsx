"use client";

import { useTranslations } from "next-intl";
import { UNIDADES } from "@/lib/unidades";
import { unidadesOfrecidas } from "@/lib/modulos";
import { useModulos } from "@/hooks/use-modulos";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { COLOR_ALTA, SONIDO_ALTA, celebrarAlta, precargarSonido } from "@/lib/celebracion";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { calcularMargenProducto } from "@/lib/profit";
import { FileUpload } from "@/components/ui/file-upload";
import { IMAGEN_PRODUCTO } from "@/lib/imagen-validacion";
import { Sparkles, Undo2 } from "lucide-react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
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
import { productSchema } from "@/lib/validations/schemas";
import { useSucursal } from "@/contexts/sucursal-context";
import { toast } from "sonner";
import type { Producto } from "../../types/inventory.types";
import {
  defaultProductFormData,
  type ProductFormData,
} from "../../types/inventory.types";
import {
  subirImagenProducto,
  type ProductInput,
} from "../../services/product-service";
import { generateNextBarcode, generateNextSku } from "../../services/product-service";

/** En que seccion del formulario vive cada campo (para abrirla si falta). */
const SECCION_DE_CAMPO: Record<string, number> = {
  nombre: 0,
  descripcion: 0,
  unidad_medida: 0,
  categoria: 0,
  precio_venta: 1,
  costo_compra: 1,
  stock_actual: 2,
  stock_minimo: 2,
  codigo_barras: 3,
  sku: 3,
};

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Producto | null;
  saving: boolean;
  /** `true` si quedo guardado. Cerrar lo decide el dialogo. */
  onSave: (input: ProductInput) => Promise<boolean>;
  tenantId: string;
}

export function ProductDialog({
  open,
  onOpenChange,
  editingProduct,
  saving,
  onSave,
  tenantId,
}: ProductDialogProps) {
  const t = useTranslations();
  // Modulos del negocio (Configuracion -> Modulos): deciden que unidades y que
  // opciones se ofrecen. Lo que el producto YA usa se muestra siempre.
  const { modulos } = useModulos();
  const [formData, setFormData] = useState<ProductFormData>(
    defaultProductFormData
  );
  const [generating, setGenerating] = useState(false);
  const [autoBarcode, setAutoBarcode] = useState(true);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenRemoved, setImagenRemoved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  /**
   * La foto tal y como la eligió el cliente, antes de quitarle el fondo.
   *
   * Guardarla es lo que permite el "Restaurar original", y de paso es la dedupe:
   * mientras exista, el botón ya no dice "Quitar fondo", así que sobre la misma
   * imagen no se puede pagar dos veces.
   */
  const [imagenOriginal, setImagenOriginal] = useState<File | null>(null);
  const [quitandoFondo, setQuitandoFondo] = useState(false);
  /**
   * Si la imagen se proceso con la llave de SANDBOX, que marca todas las
   * imagenes con marca de agua. Lo dice el servidor en una cabecera, deducido de
   * la propia llave. Sin este aviso el comerciante guardaria en su catalogo una
   * foto marcada sin que nada se lo dijera.
   */
  const [conMarcaDeAgua, setConMarcaDeAgua] = useState(false);

  const syncFromEditing = (product: Producto | null) => {
    setImagenFile(null);
    setImagenRemoved(false);
    setImagenPreview(product?.imagen_url ?? null);
    if (product) {
      setFormData({
        nombre: product.nombre,
        descripcion: product.descripcion || "",
        codigo_barras: product.codigo_barras || "",
        sku: product.sku || "",
        unidad_medida: product.unidad_medida,
        precio_venta: product.precio_venta.toString(),
        costo_compra: product.costo_compra.toString(),
        stock_actual: product.stock_actual.toString(),
        stock_minimo: product.stock_minimo.toString(),
        es_servicio: product.es_servicio,
        categoria: product.categoria || "",
        permite_lotes: product.permite_lotes,
        permite_variantes: product.permite_variantes,
      });
    } else {
      setFormData(defaultProductFormData);
    }
  };

  const generateCodes = async () => {
    if (editingProduct) return;
    setGenerating(true);
    try {
      const [barcode, sku] = await Promise.all([
        generateNextBarcode(tenantId),
        generateNextSku(tenantId),
      ]);
      setFormData((prev) => ({ ...prev, codigo_barras: barcode, sku }));
    } catch (error) {
      console.error("Error generating codes:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoBarcodeToggle = async (enabled: boolean) => {
    setAutoBarcode(enabled);
    if (!enabled) {
      updateField("codigo_barras", "");
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } else {
      setGenerating(true);
      try {
        const barcode = await generateNextBarcode(tenantId);
        updateField("codigo_barras", barcode);
      } catch (error) {
        console.error("Error generating barcode:", error);
      } finally {
        setGenerating(false);
      }
    }
  };

  // Seccion abierta (0 = Datos del producto). Siempre se empieza por ahi.
  const [seccion, setSeccion] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSeccion(0);
      setFormData(defaultProductFormData);
      setImagenFile(null);
      setImagenPreview(null);
      setImagenRemoved(false);
      setAutoBarcode(true);
    }
    onOpenChange(next);
  };

  // Al crear se confirma deslizando, con sonido: se deja descargado al abrir.
  useEffect(() => {
    if (open && !editingProduct) precargarSonido(SONIDO_ALTA);
  }, [open, editingProduct]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      syncFromEditing(editingProduct);
      if (!editingProduct) {
        setAutoBarcode(true);
        generateCodes();
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingProduct, tenantId]);

  const updateField = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Marcar un producto como servicio arrastra dos cosas más.
   *
   * La unidad pasa a SERVICIO porque la edición en línea YA lo exige
   * (`unidadesPermitidas` en `inline-edit.ts`), y su propio comentario admitía
   * la incoherencia: quedaban servicios en PIEZA por haber usado el diálogo.
   *
   * El stock se pone a 0 porque los campos desaparecen de la pantalla: dejar
   * ahí el 5 del valor por defecto guardaría un número que nadie puede ver ni
   * corregir.
   */
  const alternarServicio = (esServicio: boolean) => {
    setFormData((prev) => ({
      ...prev,
      es_servicio: esServicio,
      ...(esServicio
        ? { unidad_medida: "SERVICIO" as const, stock_actual: "0", stock_minimo: "0" }
        : {}),
    }));
  };

  const handleImagenSelect = (file: File) => {
    setImagenFile(file);
    setImagenOriginal(null);
    setConMarcaDeAgua(false);
    setImagenRemoved(false);
    setImagenPreview(URL.createObjectURL(file));
  };

  const handleImagenRemove = () => {
    setImagenFile(null);
    setImagenOriginal(null);
    setConMarcaDeAgua(false);
    setImagenPreview(null);
    setImagenRemoved(true);
  };

  const handleQuitarFondo = async () => {
    if (!imagenFile || !tenantId) return;
    setQuitandoFondo(true);
    try {
      const envio = new FormData();
      // Se manda la foto SIN recortar: recortarla a cuadrado antes de quitar el
      // fondo podría cortar parte del producto. El recorte ocurre al subir.
      envio.append("imagen", imagenFile);
      envio.append("tenant_id", tenantId);

      const res = await fetch("/api/productos/quitar-fondo", {
        method: "POST",
        body: envio,
      });

      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        toast.error(cuerpo?.error ?? "No se pudo mejorar la imagen.");
        return;
      }

      setConMarcaDeAgua(res.headers.get("X-Photoroom-Modo") === "sandbox");

      const recorte = await res.blob();
      const recortada = new File([recorte], "producto-sin-fondo.webp", {
        type: "image/webp",
      });
      setImagenOriginal(imagenFile);
      setImagenFile(recortada);
      setImagenPreview(URL.createObjectURL(recortada));
      toast.success("Fondo eliminado");
    } catch {
      toast.error("No se pudo mejorar la imagen. Revisa tu conexión.");
    } finally {
      setQuitandoFondo(false);
    }
  };

  const handleRestaurarOriginal = () => {
    if (!imagenOriginal) return;
    setConMarcaDeAgua(false);
    setImagenFile(imagenOriginal);
    setImagenPreview(URL.createObjectURL(imagenOriginal));
    setImagenOriginal(null);
  };

  /** Valida, sube la imagen y guarda. `true` si quedo guardado. */
  const handleSave = async (): Promise<boolean> => {
    // Precio VACIO no es precio 0: antes se guardaba en 0 sin avisar, y con el
    // precio dentro de una seccion cerrada es facil pasarlo por alto. Un 0
    // escrito a proposito (regalo, promocion) sigue valiendo.
    if (formData.nombre.trim() && formData.precio_venta.trim() === "") {
      toast.error("Captura el precio de venta");
      setSeccion(SECCION_DE_CAMPO.precio_venta);
      return false;
    }
    const parsed = productSchema.safeParse({
      ...formData,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(issue.message);
      // El dato que falta puede estar en una seccion cerrada: se abre esa.
      const campo = String(issue.path[0] ?? "");
      if (campo in SECCION_DE_CAMPO) setSeccion(SECCION_DE_CAMPO[campo]);
      return false;
    }

    let imagen_url = editingProduct?.imagen_url ?? null;

    if (imagenFile) {
      setUploadingImage(true);
      try {
        imagen_url = await subirImagenProducto(imagenFile, tenantId);
      } catch (error) {
        toast.error(
          "Error al subir la imagen: " +
            (error instanceof Error ? error.message : "inténtalo de nuevo")
        );
        return false;
      } finally {
        setUploadingImage(false);
      }
    } else if (imagenRemoved) {
      imagen_url = null;
    }

    return onSave({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      codigo_barras: formData.codigo_barras || null,
      sku: formData.sku || null,
      unidad_medida: formData.unidad_medida,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
      es_servicio: formData.es_servicio,
      categoria: formData.categoria || null,
      permite_lotes: formData.permite_lotes,
      permite_variantes: formData.permite_variantes,
      imagen_url,
    });
  };

  // Editar: boton de siempre, y se cierra al guardar.
  const guardarEdicion = async () => {
    if (await handleSave()) handleOpenChange(false);
  };

  // Crear: se desliza. Si algo no pasa (validacion, imagen, base) se rechaza
  // para que la pastilla muestre el error y regrese; el aviso ya salio.
  const crearDeslizando = async () => {
    if (!(await handleSave())) throw new Error("No se guardó");
  };

  // Tras la pastilla azul: sonido y destello desde el control, y se cierra
  // cuando el destello ya cubrio la pantalla (mismo ritmo que el POS).
  const trasCrear = (origen: DOMRect | null) => {
    celebrarAlta(origen);
    window.setTimeout(() => handleOpenChange(false), 900);
  };

  // Margen en vivo mientras se escribe. Sale del mismo módulo que usan
  // Reportes y Dashboard, para que el número que ves al fijar el precio sea
  // exactamente el que verás después en los reportes.
  const margenEnVivo = useMemo(
    () =>
      calcularMargenProducto(
        parseFloat(formData.precio_venta),
        formData.costo_compra === "" ? null : parseFloat(formData.costo_compra)
      ),
    [formData.precio_venta, formData.costo_compra]
  );

  // DE QUE LOCAL HABLA EL CAMPO DE EXISTENCIAS. Con varias sucursales un
  // "Stock actual" a secas es ambiguo: ¿el de este local o el de todo el
  // negocio? Se dice explicitamente, y con "Todas" se bloquea la edicion
  // (el total no tiene un local donde aplicar el cambio).
  const { hayVarias, seleccionada, sucursales } = useSucursal();
  const nombreSucursal = sucursales.find((x) => x.id === seleccionada)?.nombre;
  const stockBloqueado = hayVarias && !seleccionada && Boolean(editingProduct);
  const notaStock = !hayVarias
    ? null
    : nombreSucursal
      ? `Existencias en ${nombreSucursal}.`
      : editingProduct
        ? "Total del negocio. Elige una sucursal en el selector para editarlas."
        : "Elige una sucursal en el selector para cargar existencias iniciales, o déjalas en 0.";

  // Lo que se ve de cada seccion cerrada.
  const resumenDatos = [
    formData.unidad_medida ? t(`products.units.${formData.unidad_medida}`) : null,
    formData.categoria || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const resumenPrecio = formData.precio_venta
    ? `$${parseFloat(formData.precio_venta || "0").toFixed(2)}${
        margenEnVivo && !margenEnVivo.esPerdida
          ? ` · margen ${margenEnVivo.margenPct.toFixed(1)}%`
          : margenEnVivo?.esPerdida
            ? " · con pérdida"
            : ""
      }`
    : "Sin precio";
  const resumenInventario = formData.es_servicio
    ? "Servicio"
    : `${formData.stock_actual || 0} en stock`;
  const resumenCodigos = [formData.codigo_barras, formData.sku].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingProduct ? "Editar producto" : "Crear producto"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingProduct
              ? "Actualiza los datos del producto"
              : "Agrega un nuevo producto a tu catálogo"}
          </DialogDescription>
        </DialogHeader>
        {/* En secciones desplegables (una abierta a la vez), como la creacion
            de cuenta: la ventana con todos los campos seguidos era muy larga.
            Cerrada, cada seccion resume lo capturado. */}
        <Accordion variante="panel" activeIndex={seccion} onActiveIndexChange={setSeccion}>
          <AccordionItem title="Datos del producto" index={0} resumen={resumenDatos}>
            <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              placeholder="Nombre del producto"
              value={formData.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              placeholder="Descripción del producto"
              value={formData.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidad de medida *</Label>
              <Select
                items={Object.fromEntries(UNIDADES.map((u) => [u, t(`products.units.${u}`)]))}
                value={formData.unidad_medida}
                onValueChange={(v) => v && updateField("unidad_medida", v)}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* De `@/lib/unidades`: agregar una unidad alli la trae aqui. */}
                  {unidadesOfrecidas(modulos, formData.unidad_medida).map((u) => (
                    <SelectItem key={u} value={u}>
                      {t(`products.units.${u}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Input
                placeholder="Ej: Bebidas"
                value={formData.categoria}
                onChange={(e) => updateField("categoria", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
            </div>
          </AccordionItem>
          <AccordionItem title="Precio y costo" index={1} resumen={resumenPrecio}>
            <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Precio de venta *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.precio_venta}
                onChange={(e) => updateField("precio_venta", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Costo de compra *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.costo_compra}
                onChange={(e) => updateField("costo_compra", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          {/* Margen en vivo. Se muestran margen Y markup por su nombre porque
              se confunden constantemente: $15 con costo $10 es 33.3% de margen
              pero 50% de markup, y poner precios creyendo que se gana 50%
              cuando se gana 33% es un error caro. */}
          {margenEnVivo && (
            <div
              className={`rounded-md border px-3 py-2 text-xs ${
                margenEnVivo.esPerdida
                  ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {margenEnVivo.esPerdida ? (
                <span className="font-medium">
                  El costo es mayor o igual al precio: venderías con pérdida de $
                  {Math.abs(margenEnVivo.gananciaUnitaria).toFixed(2)} por unidad.
                </span>
              ) : (
                <span>
                  <strong>Ganas ${margenEnVivo.gananciaUnitaria.toFixed(2)}</strong>{" "}
                  por unidad · Margen {margenEnVivo.margenPct.toFixed(1)}% · Markup{" "}
                  {margenEnVivo.markupPct.toFixed(1)}%
                </span>
              )}
            </div>
          )}
            </div>
          </AccordionItem>
          <AccordionItem title="Inventario" index={2} resumen={resumenInventario}>
            <div className="space-y-4 pt-1">
          {/* En un servicio los campos de stock DESAPARECEN, no se deshabilitan:
              dejarlos en gris seguiría sugiriendo que importan, y no importan —
              la venta de un servicio ya no descuenta existencias. */}
          {!formData.es_servicio && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Stock actual</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stock_actual}
                  onChange={(e) => updateField("stock_actual", e.target.value)}
                  disabled={stockBloqueado}
                  className="h-8 text-sm font-mono"
                />
                {notaStock && (
                  <p className="text-[11px] text-muted-foreground">{notaStock}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stock mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stock_minimo}
                  onChange={(e) => updateField("stock_minimo", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          )}
          {/* Los tres llevan una línea que dice QUÉ cambia al activarlos. Sin
              ella el usuario movía el interruptor, no veía nada distinto y
              concluía —con razón— que no servían para nada. */}
          {(modulos.permite_servicios || formData.es_servicio) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.es_servicio}
                onCheckedChange={(v) => alternarServicio(v)}
              />
              <Label className="text-xs">Es servicio (no maneja stock)</Label>
            </div>
            <p className="ml-11 text-[11px] text-muted-foreground">
              Se vende sin descontar existencias: asesorías, instalación, envío
              a domicilio.
            </p>
          </div>
          )}
          {(modulos.permite_lotes_caducidad || formData.permite_lotes) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.permite_lotes}
                onCheckedChange={(v) => updateField("permite_lotes", v)}
              />
              <Label className="text-xs">Maneja lotes y fecha de caducidad</Label>
            </div>
            <p className="ml-11 text-[11px] text-muted-foreground">
              Al guardar, el producto aparece en la pestaña Lotes para
              registrar sus caducidades.
            </p>
          </div>
          )}
          {(modulos.permite_variantes || formData.permite_variantes) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.permite_variantes}
                onCheckedChange={(v) => updateField("permite_variantes", v)}
              />
              <Label className="text-xs">Maneja variantes (talla/color)</Label>
            </div>
            <p className="ml-11 text-[11px] text-muted-foreground">
              Al guardar, el producto aparece en la pestaña Variantes para dar
              de alta tallas y colores con su propio stock.
            </p>
          </div>
          )}
            </div>
          </AccordionItem>
          <AccordionItem title="Códigos" index={3} resumen={resumenCodigos}>
            <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Código de barras
                  {!editingProduct && autoBarcode && formData.codigo_barras && (
                    <span className="text-emerald-500 ml-1 text-[10px] font-normal">(auto)</span>
                  )}
                </Label>
                {!editingProduct && (
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="auto-barcode"
                      checked={autoBarcode}
                      onCheckedChange={(checked) => handleAutoBarcodeToggle(Boolean(checked))}
                    />
                    <label
                      htmlFor="auto-barcode"
                      className="text-[11px] text-muted-foreground cursor-pointer select-none"
                    >
                      Automático
                    </label>
                  </div>
                )}
              </div>
              <div className="relative">
                <Input
                  ref={barcodeInputRef}
                  placeholder={!editingProduct && !autoBarcode ? "Escribe o escanea..." : "EAN-13"}
                  value={formData.codigo_barras}
                  onChange={(e) => updateField("codigo_barras", e.target.value)}
                  className="h-8 pr-9 text-sm font-mono"
                  readOnly={!editingProduct && autoBarcode}
                />
                <BotonEscanear
                  modo="uno"
                  titulo="Escanear código del producto"
                  onCodigo={(codigo) => {
                    // Se leyo el codigo real del empaque: manda sobre el automatico.
                    if (autoBarcode) setAutoBarcode(false);
                    updateField("codigo_barras", codigo);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  SKU
                  {!editingProduct && formData.sku && (
                    <span className="text-emerald-500 ml-1 text-[10px] font-normal">(auto)</span>
                  )}
                </Label>
              </div>
              <Input
                placeholder="SKU-001"
                value={formData.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
            </div>
          </AccordionItem>
          <AccordionItem title="Imagen" index={4} resumen={imagenPreview ? "Con foto" : "Sin foto"}>
            <div className="space-y-4 pt-1">
          {/* `allowCamera` dibuja "Tomar foto" solo en móvil. El texto de ayuda
              ya no habla de 2MB ni de formatos: entra cualquier foto de celular
              y sale un webp cuadrado, y decía "JPG, PNG" mientras aceptaba SVG. */}
          <FileUpload
            preview={imagenPreview}
            onFileSelect={handleImagenSelect}
            onFileRemove={handleImagenRemove}
            dragDropText="Arrastra una foto del producto o haz clic para seleccionar"
            maxSizeText="Se recorta a cuadrado y se optimiza automáticamente"
            opciones={IMAGEN_PRODUCTO}
            accept="image/*"
            allowCamera
          />

          {/* Quitar el fondo es OPCIONAL y cuesta dinero por imagen, así que
              solo aparece cuando hay una foto recién elegida y solo actúa si el
              cliente lo pide. Sobre la imagen ya guardada de un producto que se
              está editando no se ofrece: ya está en Storage y reprocesarla sería
              pagar por algo que nadie pidió. */}
          {imagenFile && (
            <div className="flex items-center gap-2">
              {imagenOriginal ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleRestaurarOriginal}
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Restaurar original
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={quitandoFondo}
                  onClick={() => void handleQuitarFondo()}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {quitandoFondo ? "Quitando fondo..." : "Quitar fondo"}
                </Button>
              )}
              {imagenOriginal && !conMarcaDeAgua && (
                <span className="text-xs text-muted-foreground">
                  Fondo eliminado
                </span>
              )}
            </div>
          )}

          {/* La llave de sandbox marca TODAS las imágenes. Se avisa en el
              momento y con "Restaurar original" a un clic, en vez de dejar que
              el comerciante guarde una foto marcada sin enterarse. Desaparece
              solo el día que se use la llave live. */}
          {conMarcaDeAgua && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Imagen de prueba: lleva marca de agua. No la guardes en tu
              catálogo — usa &quot;Restaurar original&quot;.
            </p>
          )}
            </div>
          </AccordionItem>
        </Accordion>
        {editingProduct ? (
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <SpecularActionButton
              tone="add"
              className="h-8"
              onClick={() => void guardarEdicion()}
              disabled={saving || uploadingImage}
            >
              {uploadingImage
                ? "Subiendo imagen..."
                : saving
                  ? t("common.loading")
                  : "Guardar cambios"}
            </SpecularActionButton>
          </DialogFooter>
        ) : (
          // Mismo "desliza para confirmar" que cobrar en el POS, en azul.
          <div className="flex flex-col items-stretch gap-2">
            <DeslizarParaConfirmar
              label="Desliza para crear producto"
              doneLabel="Producto creado"
              errorLabel="No se guardó"
              successColor={COLOR_ALTA}
              onConfirm={crearDeslizando}
              onDone={trasCrear}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-center text-muted-foreground"
              onClick={() => handleOpenChange(false)}
              disabled={saving || uploadingImage}
            >
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}