"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { COLOR_ALTA, SONIDO_ALTA, celebrarAlta, precargarSonido } from "@/lib/celebracion";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import { FileUpload } from "@/components/ui/file-upload";
import { IMAGEN_PRODUCTO } from "@/lib/imagen-validacion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useModulos } from "@/hooks/use-modulos";
import { unidadesOfrecidas } from "@/lib/modulos";
import { enUnidad, porUnidad, type UnidadMedida } from "@/lib/unidades";
import { crearProductoConVariantes, subirImagenProducto } from "../../services/product-service";
import { SelectorCategoria } from "../products/selector-categoria";
import type { VarianteInput } from "../../services/variant-service";
import type { ProductoOption, VarianteProducto } from "../../types/inventory.types";
import {
  COLORES,
  TIPO_COLOR,
  TIPO_PERSONALIZADO,
  atributosDeVariante,
  hexDeColor,
  sugerenciasDe,
  tiposSugeridos,
} from "../../atributos-variante";
import {
  UNIDAD_DEL_PRODUCTO,
  baseSkuDe,
  duplicarTarjeta,
  inputDeTarjeta,
  nuevaTarjeta,
  problemaDeTarjeta,
  resumenAtributos,
  resumenCodigos,
  resumenInventario,
  resumenPrecio,
  resumenTarjeta,
  tarjetaRepetida,
  type TarjetaVariante,
} from "../../tarjetas-variante";

/**
 * Crear un PRODUCTO CON VARIANTES en una sola ventana: el nombre general
 * ("Coca Cola", del que se despliegan en la tabla) y una tarjeta desplegable
 * por variante (600 ml, 2.5 L...), cada una con TODOS sus datos. "Agregar nueva
 * variante" suma otra y compacta las anteriores en su resumen, como las
 * secciones de "Producto unico". Dentro, cada variante tiene sus propias
 * secciones (Datos, Precio y costo, Inventario, Codigos, Imagen), igual que la
 * ventana de producto unico.
 *
 * Categoria, "Es servicio" y "Maneja lotes" son del PRODUCTO (el cobro y la
 * pestaña Lotes los leen de `productos`): se muestran en cada tarjeta pero son
 * un solo valor, el mismo en todas.
 *
 * Con `productoBase` agrega variantes a un producto que ya existe (desde la
 * tabla: "+ Agregar variante"); entonces no se pide el nombre.
 *
 * Editar UNA variante sigue en `VariantDialog`.
 */

const MAX_ATRIBUTOS = 3;
/** Indice de cada seccion dentro de una tarjeta. */
const SECCION = { datos: 0, precio: 1, inventario: 2, codigos: 3, imagen: 4 } as const;

interface CrearVariantesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Producto al que se agregan variantes; `null` = producto nuevo. */
  productoBase: ProductoOption | null;
  /** Para avisar si el nombre general ya existe. */
  products: ProductoOption[];
  /** Variantes existentes: dan los atributos que ya usa el producto. */
  variantes: VarianteProducto[];
  categorias?: string[];
  saving: boolean;
  /** `true` si se guardaron todas; `onCreada` avisa cada una que si quedo. */
  onSaveMany: (inputs: VarianteInput[], onCreada?: (indice: number) => void) => Promise<boolean>;
}

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

export function CrearVariantesDialog({
  open,
  onOpenChange,
  productoBase,
  products,
  variantes,
  categorias = [],
  saving,
  onSaveMany,
}: CrearVariantesDialogProps) {
  const t = useTranslations();
  const { tenantGiro, tenantId } = useCurrentTenant();
  const { modulos } = useModulos();

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tarjetas, setTarjetas] = useState<TarjetaVariante[]>([]);
  const [abierta, setAbierta] = useState(0);
  // Seccion abierta dentro de cada tarjeta (por id); sin entrada = Datos.
  const [secciones, setSecciones] = useState<Record<number, number>>({});
  const [esServicio, setEsServicio] = useState(false);
  const [manejaLotes, setManejaLotes] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  // Si el producto general ya se creo y fallaron las variantes, el reintento
  // usa este producto en vez de crear otro.
  const [creado, setCreado] = useState<ProductoOption | null>(null);

  const destino = productoBase ?? creado;
  // Un producto existente conserva lo suyo; uno nuevo usa los interruptores.
  const servicio = destino ? Boolean(destino.es_servicio) : esServicio;
  const tipos = tiposSugeridos(
    tenantGiro,
    destino ? tiposDelProducto(destino.id, variantes) : []
  );

  // Al abrir: formulario limpio con la primera variante lista para llenar.
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      setNombre("");
      setCategoria("");
      setCreado(null);
      setAbierta(0);
      setSecciones({});
      setEsServicio(false);
      setManejaLotes(false);
      const usados = productoBase ? tiposDelProducto(productoBase.id, variantes) : [];
      setTarjetas([
        nuevaTarjeta(usados.length ? usados : [tiposSugeridos(tenantGiro, [])[0]], {
          // Producto existente: arranca con su unidad; nuevo: pieza.
          unidad: productoBase?.unidad_medida ?? "PIEZA",
        }),
      ]);
      precargarSonido(SONIDO_ALTA);
    }, 0);
    return () => window.clearTimeout(timeout);
    // Solo al abrir o cambiar de producto base.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productoBase]);

  const unidadesFisicas = (actual?: UnidadMedida | null) =>
    unidadesOfrecidas(modulos, actual).filter((u) => u !== "SERVICIO");

  const cambiarTarjeta = (id: number, cambio: Partial<TarjetaVariante>) =>
    setTarjetas((prev) => prev.map((x) => (x.id === id ? { ...x, ...cambio } : x)));

  const agregarTarjeta = () => {
    const ultima = tarjetas[tarjetas.length - 1];
    const tiposBase = tarjetas[0]?.atributos.map((a) => a.tipo) ?? [tipos[0]];
    const nueva = nuevaTarjeta(tiposBase, {
      precio: ultima?.precio ?? "",
      costo: ultima?.costo ?? "",
      stockMinimo: ultima?.stockMinimo ?? "0",
      unidad: ultima?.unidad ?? destino?.unidad_medida ?? "PIEZA",
    });
    setTarjetas((prev) => [...prev, nueva]);
    setAbierta(tarjetas.length);
  };

  const duplicar = (indice: number) => {
    const copia = duplicarTarjeta(tarjetas[indice]);
    setTarjetas((prev) => [...prev.slice(0, indice + 1), copia, ...prev.slice(indice + 1)]);
    setAbierta(indice + 1);
  };

  const quitar = (indice: number) => {
    setTarjetas((prev) => prev.filter((_, i) => i !== indice));
    setAbierta(Math.max(0, indice - 1));
  };

  /** Valida y guarda todo. `true` si quedo guardado. */
  const guardar = async (): Promise<boolean> => {
    const nombreGeneral = nombre.trim();
    if (!destino) {
      if (!nombreGeneral) {
        toast.error("Escribe el nombre general del producto");
        return false;
      }
      const repetido = products.find(
        (p) => p.nombre.trim().toLowerCase() === nombreGeneral.toLowerCase()
      );
      if (repetido) {
        toast.error(`Ya existe «${repetido.nombre}»: agrégale variantes desde su fila en la tabla`);
        return false;
      }
    }
    for (let i = 0; i < tarjetas.length; i++) {
      const problema = problemaDeTarjeta(tarjetas[i]);
      if (problema) {
        // Abre la tarjeta Y la seccion donde se corrige.
        setAbierta(i);
        setSecciones((prev) => ({ ...prev, [tarjetas[i].id]: SECCION[problema.seccion] }));
        toast.error(`Variante ${i + 1}: ${problema.mensaje}`);
        return false;
      }
    }
    const repetida = tarjetaRepetida(tarjetas);
    if (repetida >= 0) {
      setAbierta(repetida);
      setSecciones((prev) => ({ ...prev, [tarjetas[repetida].id]: SECCION.datos }));
      toast.error(`La variante ${repetida + 1} repite los atributos de otra`);
      return false;
    }
    if (!tenantId) return false;

    // Fotos: una por tarjeta, antes de crear nada.
    const imagenes: (string | null)[] = [];
    setSubiendo(true);
    try {
      for (const tarjeta of tarjetas) {
        imagenes.push(tarjeta.imagenFile ? await subirImagenProducto(tarjeta.imagenFile, tenantId) : null);
      }
    } catch {
      toast.error("No se pudo subir una foto. Revisa tu conexión e intenta de nuevo.");
      return false;
    } finally {
      setSubiendo(false);
    }

    // Producto general nuevo (solo nombre, unidad y categoria). Su unidad es la
    // de la Variante 1: las variantes con esa misma unidad la heredan (NULL).
    // Un servicio va con unidad SERVICIO, como en "Producto unico".
    const unidadProducto: UnidadMedida =
      destino?.unidad_medida ??
      (esServicio
        ? "SERVICIO"
        : tarjetas[0].unidad === UNIDAD_DEL_PRODUCTO
          ? "PIEZA"
          : (tarjetas[0].unidad as UnidadMedida));
    let productoId = destino?.id ?? "";
    const nombreProducto = destino?.nombre ?? nombreGeneral;
    if (!destino) {
      try {
        productoId = await crearProductoConVariantes(tenantId, {
          nombre: nombreGeneral,
          unidad_medida: unidadProducto,
          categoria: categoria.trim() || null,
          es_servicio: esServicio,
          permite_lotes: manejaLotes,
        });
      } catch {
        toast.error("No se pudo crear el producto. Revisa tu conexión e intenta de nuevo.");
        return false;
      }
      setCreado({
        id: productoId,
        nombre: nombreGeneral,
        permite_variantes: true,
        permite_lotes: manejaLotes,
        unidad_medida: unidadProducto,
        es_servicio: esServicio,
      });
    }

    const baseSku = baseSkuDe(nombreProducto);
    const creadas = new Set<number>();
    const ok = await onSaveMany(
      tarjetas.map((tarjeta, i) =>
        inputDeTarjeta(tarjeta, {
          productoId,
          baseSku,
          imagenUrl: imagenes[i],
          unidadProducto,
          esServicio: servicio,
        })
      ),
      (indice) => creadas.add(tarjetas[indice].id)
    );
    // Si fallo a la mitad, quedan solo las que faltan: el reintento no repite
    // las que ya se crearon.
    if (!ok && creadas.size > 0) {
      setTarjetas((prev) => prev.filter((x) => !creadas.has(x.id)));
      setAbierta(0);
    }
    return ok;
  };

  const crearDeslizando = async () => {
    if (!(await guardar())) throw new Error("No se guardó");
  };
  const trasCrear = (origen: DOMRect | null) => {
    celebrarAlta(origen);
    window.setTimeout(() => onOpenChange(false), 900);
  };

  const n = tarjetas.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {destino ? `Agregar variantes a «${destino.nombre}»` : "Producto con variantes"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {destino
              ? "Cada tarjeta es una variante con su precio, stock y código."
              : "Escribe el nombre general (ej. Coca Cola) y agrega sus variantes: cada tarjeta es una variante."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Producto general: solo el nombre, al crear uno nuevo. La unidad y
              la categoria van en las variantes. */}
          {!destino && (
            <div className="space-y-1.5">
              <Label htmlFor="producto-general" className="text-xs">Nombre general *</Label>
              <Input
                id="producto-general"
                placeholder="Ej. Coca Cola"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={120}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
          )}

          {/* Variantes: una tarjeta desplegable por variante */}
          <div className="rounded-xl border border-border px-3">
            <Accordion variante="panel" activeIndex={abierta} onActiveIndexChange={setAbierta}>
              {tarjetas.map((tarjeta, i) => (
                <AccordionItem
                  key={tarjeta.id}
                  index={i}
                  title={`Variante ${i + 1}`}
                  resumen={resumenTarjeta(tarjeta, servicio)}
                  className={i === n - 1 ? "border-b-0" : undefined}
                >
                  <FormularioTarjeta
                    tarjeta={tarjeta}
                    tipos={tipos}
                    onCambio={(cambio) => cambiarTarjeta(tarjeta.id, cambio)}
                    unidades={unidadesFisicas(
                      tarjeta.unidad === UNIDAD_DEL_PRODUCTO ? null : (tarjeta.unidad as UnidadMedida)
                    )}
                    etiquetaUnidad={(u) => t(`products.units.${u}`)}
                    // La categoria es del producto: un solo valor, el mismo en
                    // todas las tarjetas. No se toca la de un producto existente.
                    categoria={destino ? undefined : { valor: categoria, onChange: setCategoria, opciones: categorias }}
                    seccion={secciones[tarjeta.id] ?? SECCION.datos}
                    onSeccion={(indice) => setSecciones((prev) => ({ ...prev, [tarjeta.id]: indice }))}
                    servicio={servicio}
                    // Del producto, compartidos; solo al crear uno nuevo y con
                    // el modulo encendido (como en "Producto unico").
                    interruptores={
                      destino
                        ? undefined
                        : {
                            esServicio,
                            onServicio: setEsServicio,
                            manejaLotes,
                            onLotes: setManejaLotes,
                            mostrarServicio: modulos.permite_servicios || esServicio,
                            mostrarLotes: modulos.permite_lotes_caducidad || manejaLotes,
                          }
                    }
                  />
                  <div className="mt-3 flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => duplicar(i)}>
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </Button>
                    {n > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => quitar(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </Button>
                    )}
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={agregarTarjeta}>
            <Plus className="h-3.5 w-3.5" />
            Agregar nueva variante
          </Button>
        </div>

        <div className="flex flex-col items-stretch gap-2">
          <DeslizarParaConfirmar
            label={n === 1 ? "Desliza para crear la variante" : `Desliza para crear ${n} variantes`}
            doneLabel={n === 1 ? "Variante creada" : "Variantes creadas"}
            errorLabel="No se guardó"
            successColor={COLOR_ALTA}
            disabled={saving || subiendo}
            onConfirm={crearDeslizando}
            onDone={trasCrear}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 self-center text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Los tipos de atributo que ya usan las variantes de un producto. */
function tiposDelProducto(productoId: string, variantes: VarianteProducto[]): string[] {
  const v = variantes.find((x) => x.producto_id === productoId && atributosDeVariante(x).length > 0);
  return v ? atributosDeVariante(v).map((a) => a.tipo) : [];
}

interface Interruptores {
  esServicio: boolean;
  onServicio: (valor: boolean) => void;
  manejaLotes: boolean;
  onLotes: (valor: boolean) => void;
  mostrarServicio: boolean;
  mostrarLotes: boolean;
}

function FormularioTarjeta({
  tarjeta,
  tipos,
  onCambio,
  unidades,
  etiquetaUnidad,
  categoria,
  seccion,
  onSeccion,
  servicio,
  interruptores,
}: {
  tarjeta: TarjetaVariante;
  tipos: string[];
  onCambio: (cambio: Partial<TarjetaVariante>) => void;
  unidades: UnidadMedida[];
  etiquetaUnidad: (u: UnidadMedida) => string;
  categoria?: { valor: string; onChange: (valor: string) => void; opciones: string[] };
  seccion: number;
  onSeccion: (indice: number) => void;
  /** Producto de servicio: sin stock ni unidad. */
  servicio: boolean;
  /** "Es servicio" y "Maneja lotes" (del producto); `undefined` = no se muestran. */
  interruptores?: Interruptores;
}) {
  const cambiarAtributo = (indice: number, cambio: Partial<TarjetaVariante["atributos"][number]>) =>
    onCambio({
      atributos: tarjeta.atributos.map((a, i) => (i === indice ? { ...a, ...cambio } : a)),
    });

  const agregarAtributo = () => {
    const usados = new Set(tarjeta.atributos.map((a) => a.tipo));
    const libre = tipos.find((tipo) => tipo !== TIPO_PERSONALIZADO && !usados.has(tipo)) ?? TIPO_PERSONALIZADO;
    onCambio({ atributos: [...tarjeta.atributos, { tipo: libre, nombre: "", valor: "" }] });
  };

  // Granel: el precio es POR UNIDAD ($180 = el kilo) y el POS cobra la
  // fraccion. Un servicio no tiene unidad (no lleva "por kg").
  const unidadTarjeta = servicio || tarjeta.unidad === UNIDAD_DEL_PRODUCTO ? null : tarjeta.unidad;
  const campoNumero = (campo: "precio" | "costo" | "stock" | "stockMinimo", etiqueta: string, paso: string, ejemplo: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{etiqueta}</Label>
      <Input
        type="number"
        step={paso}
        min="0"
        placeholder={ejemplo}
        value={tarjeta[campo]}
        onChange={(e) => onCambio({ [campo]: e.target.value })}
        className="h-8 text-sm font-mono"
      />
    </div>
  );

  // Las secciones van en su propio recuadro, para distinguirlas de las
  // tarjetas de variante que las contienen.
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3">
      <Accordion variante="panel" activeIndex={seccion} onActiveIndexChange={onSeccion}>
        <AccordionItem
          title="Datos de la variante"
          index={SECCION.datos}
          resumen={resumenAtributos(tarjeta) || "Sin atributo"}
        >
          <div className="space-y-3 pt-1">
            {/* Atributos: un valor por tipo (ej. Capacidad 600 ml, o Talla M + Color Rojo) */}
            {tarjeta.atributos.map((atributo, i) => {
              const usadosPorOtros = new Set(tarjeta.atributos.filter((_, j) => j !== i).map((a) => a.tipo));
              const opciones = tipos.filter(
                (tipo) => tipo === TIPO_PERSONALIZADO || tipo === atributo.tipo || !usadosPorOtros.has(tipo)
              );
              const esColor = atributo.tipo === TIPO_COLOR;
              const sugerencias = (esColor ? COLORES.map((c) => c.nombre) : sugerenciasDe(atributo.tipo)).slice(
                0,
                esColor ? 14 : 8
              );
              return (
                <div key={i} className="space-y-2 rounded-lg border border-border p-2.5">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label className="text-xs">Tipo de atributo</Label>
                      <Select
                        items={Object.fromEntries(opciones.map((tipo) => [tipo, tipo]))}
                        value={atributo.tipo}
                        onValueChange={(v) => typeof v === "string" && cambiarAtributo(i, { tipo: v, valor: "" })}
                      >
                        <SelectTrigger className="h-8 w-full" aria-label="Tipo de atributo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {opciones.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tarjeta.atributos.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() => onCambio({ atributos: tarjeta.atributos.filter((_, j) => j !== i) })}
                        aria-label="Quitar atributo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {atributo.tipo === TIPO_PERSONALIZADO && (
                    <Input
                      placeholder="Nombre del atributo (ej. Material)"
                      value={atributo.nombre}
                      onChange={(e) => cambiarAtributo(i, { nombre: e.target.value })}
                      className="h-8 text-sm"
                    />
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      placeholder="Escribe un valor"
                      value={atributo.valor}
                      onChange={(e) => cambiarAtributo(i, { valor: e.target.value })}
                      className="h-8 text-sm"
                    />
                    {sugerencias.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sugerencias.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => cambiarAtributo(i, { valor: s })}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                              atributo.valor === s
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {esColor && <PuntoColor valor={s} />}
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {tarjeta.atributos.length < MAX_ATRIBUTOS && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={agregarAtributo}>
                <Plus className="h-3.5 w-3.5" />
                Agregar otro atributo
              </Button>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Descripción <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                placeholder="Ej. Botella retornable"
                value={tarjeta.descripcion}
                onChange={(e) => onCambio({ descripcion: e.target.value })}
                maxLength={200}
                className="h-8 text-sm"
              />
            </div>

            {/* Unidad (un servicio no la lleva) y categoria (del producto) */}
            {(!servicio || categoria) && (
              <div className={`grid grid-cols-1 gap-3 ${!servicio && categoria ? "sm:grid-cols-2" : ""}`}>
                {!servicio && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unidad de medida</Label>
                    <Select
                      items={Object.fromEntries(unidades.map((u) => [u, etiquetaUnidad(u)]))}
                      value={tarjeta.unidad}
                      onValueChange={(v) => typeof v === "string" && onCambio({ unidad: v })}
                    >
                      <SelectTrigger className="h-8 w-full text-sm" aria-label="Unidad de medida de la variante">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u} value={u}>
                            {etiquetaUnidad(u)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {categoria && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Categoría <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <SelectorCategoria value={categoria.valor} onChange={categoria.onChange} categorias={categoria.opciones} />
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem title="Precio y costo" index={SECCION.precio} resumen={resumenPrecio(tarjeta)}>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {campoNumero("precio", `Precio de venta${porUnidad(unidadTarjeta)} *`, "0.01", "0.00")}
            {campoNumero("costo", `Costo de compra${porUnidad(unidadTarjeta)}`, "0.01", "0.00")}
          </div>
        </AccordionItem>

        <AccordionItem title="Inventario" index={SECCION.inventario} resumen={resumenInventario(tarjeta, servicio)}>
          <div className="space-y-4 pt-1">
            {/* En un servicio el stock DESAPARECE: su venta no descuenta existencias. */}
            {!servicio && (
              <div className="grid grid-cols-2 gap-3">
                {campoNumero("stock", `Stock actual${enUnidad(unidadTarjeta)}`, "any", "0")}
                {campoNumero("stockMinimo", `Stock mínimo${enUnidad(unidadTarjeta)}`, "any", "0")}
              </div>
            )}
            {servicio && !interruptores && (
              <p className="text-[11px] text-muted-foreground">
                Este producto es un servicio: sus variantes se venden sin descontar existencias.
              </p>
            )}
            {interruptores?.mostrarServicio && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Switch checked={interruptores.esServicio} onCheckedChange={(v) => interruptores.onServicio(v)} />
                  <Label className="text-xs">Es servicio (no maneja stock)</Label>
                </div>
                <p className="ml-11 text-[11px] text-muted-foreground">
                  Se vende sin descontar existencias: asesorías, instalación, envío a domicilio. Aplica a todas las
                  variantes.
                </p>
              </div>
            )}
            {interruptores?.mostrarLotes && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Switch checked={interruptores.manejaLotes} onCheckedChange={(v) => interruptores.onLotes(v)} />
                  <Label className="text-xs">Maneja lotes y fecha de caducidad</Label>
                </div>
                <p className="ml-11 text-[11px] text-muted-foreground">
                  Al guardar, el producto aparece en la pestaña Lotes para registrar sus caducidades. Aplica a todas
                  las variantes.
                </p>
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem title="Códigos" index={SECCION.codigos} resumen={resumenCodigos(tarjeta)}>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input
                placeholder="Automático"
                value={tarjeta.sku}
                onChange={(e) => onCambio({ sku: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código de barras</Label>
              <div className="relative">
                <Input
                  placeholder="EAN-13"
                  value={tarjeta.codigo}
                  onChange={(e) => onCambio({ codigo: e.target.value })}
                  className="h-8 pr-9 text-sm font-mono"
                />
                <BotonEscanear modo="uno" titulo="Escanear código de la variante" onCodigo={(codigo) => onCambio({ codigo })} />
              </div>
            </div>
          </div>
        </AccordionItem>

        <AccordionItem
          title="Imagen"
          index={SECCION.imagen}
          resumen={tarjeta.imagenPreview ? "Con foto" : "Sin foto"}
          className="border-b-0"
        >
          <div className="pt-1">
            <FileUpload
              preview={tarjeta.imagenPreview}
              onFileSelect={(file) => onCambio({ imagenFile: file, imagenPreview: URL.createObjectURL(file) })}
              onFileRemove={() => onCambio({ imagenFile: null, imagenPreview: null })}
              dragDropText="Arrastra una foto de la variante o haz clic para seleccionar"
              maxSizeText="Se recorta a cuadrado y se optimiza automáticamente"
              opciones={IMAGEN_PRODUCTO}
              accept="image/*"
              allowCamera
            />
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
