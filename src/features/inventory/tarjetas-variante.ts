/**
 * Las "tarjetas" de la ventana Producto con variantes: cada tarjeta es UNA
 * variante completa (atributos, foto, descripcion, unidad, SKU, codigo,
 * precio, costo, stock y minimo). Aqui vive la logica pura (resumen, armado del
 * insert y deteccion de repetidas), separada del componente para probarla.
 */
import { contenidoCapturado, esFraccionable, type UnidadMedida } from "@/lib/unidades";
import type { VarianteInput } from "./services/variant-service";
import {
  TIPO_PERSONALIZADO,
  normalizarValor,
  resumenCompatible,
  skuDeCombinacion,
  type Atributo,
} from "./atributos-variante";

/** Valor del selector de unidad para "usa la del producto" (columna en NULL). */
export const UNIDAD_DEL_PRODUCTO = "__del_producto__";

export interface AtributoTarjeta {
  tipo: string;
  /** Solo con `tipo === "Personalizado"`: el nombre que le pone el usuario. */
  nombre: string;
  valor: string;
}

export interface TarjetaVariante {
  id: number;
  atributos: AtributoTarjeta[];
  imagenFile: File | null;
  imagenPreview: string | null;
  descripcion: string;
  unidad: string;
  /** Contenido del envase (migracion 114). "" = el del producto. */
  contenidoCantidad: string;
  contenidoUnidad: string;
  sku: string;
  codigo: string;
  precio: string;
  costo: string;
  stock: string;
  stockMinimo: string;
}

let siguienteId = 1;

export function nuevaTarjeta(
  tipos: string[],
  base?: Partial<Omit<TarjetaVariante, "id">>
): TarjetaVariante {
  return {
    id: siguienteId++,
    atributos: tipos.map((tipo) => ({ tipo, nombre: "", valor: "" })),
    imagenFile: null,
    imagenPreview: null,
    descripcion: "",
    unidad: UNIDAD_DEL_PRODUCTO,
    contenidoCantidad: "",
    contenidoUnidad: "",
    sku: "",
    codigo: "",
    precio: "",
    costo: "",
    stock: "0",
    stockMinimo: "0",
    ...base,
  };
}

/**
 * Copia para "Duplicar": todo igual salvo el valor de los atributos, el SKU,
 * el codigo de barras y el contenido, que identifican a cada variante (la
 * copia de la de 600 ml no es de 600 ml).
 */
export function duplicarTarjeta(t: TarjetaVariante): TarjetaVariante {
  return {
    ...t,
    id: siguienteId++,
    atributos: t.atributos.map((a) => ({ ...a, valor: "" })),
    sku: "",
    codigo: "",
    contenidoCantidad: "",
    contenidoUnidad: "",
  };
}

/** Atributos validos (con tipo y valor), ya normalizados. */
export function atributosDeTarjeta(t: TarjetaVariante): Atributo[] {
  return t.atributos
    .map((a) => ({
      tipo: a.tipo === TIPO_PERSONALIZADO ? normalizarValor(a.nombre) : a.tipo,
      valor: normalizarValor(a.valor),
    }))
    .filter((a) => a.tipo && a.valor);
}

/** "Capacidad 600 ml · Sabor Light", o "" si aun no tiene atributos. */
export function resumenAtributos(t: TarjetaVariante): string {
  return atributosDeTarjeta(t)
    .map((a) => `${a.tipo} ${a.valor}`)
    .join(" · ");
}

/** Resumen de la seccion Precio y costo. */
export function resumenPrecio(t: TarjetaVariante): string {
  return parseFloat(t.precio) > 0 ? `$${parseFloat(t.precio).toFixed(2)}` : "Sin precio";
}

/** Resumen de la seccion Inventario. */
export function resumenInventario(t: TarjetaVariante, esServicio = false): string {
  return esServicio ? "Servicio" : `${parseFloat(t.stock) || 0} en stock`;
}

/** Resumen de la seccion Codigos. */
export function resumenCodigos(t: TarjetaVariante): string {
  const partes = [t.codigo.trim(), t.sku.trim()].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Automático";
}

/**
 * "Capacidad 600 ml · $18.00 · 20 en stock", para la tarjeta compacta.
 * Un servicio dice "Servicio" en vez del stock.
 */
export function resumenTarjeta(t: TarjetaVariante, esServicio = false): string {
  const atributos = resumenAtributos(t);
  const partes = [
    atributos,
    parseFloat(t.precio) > 0 ? `$${parseFloat(t.precio).toFixed(2)}` : "",
    resumenInventario(t, esServicio),
  ].filter(Boolean);
  return atributos ? partes.join(" · ") : "Sin datos";
}

const claveDe = (t: TarjetaVariante) =>
  atributosDeTarjeta(t)
    .map((a) => `${a.tipo.toLowerCase()}=${a.valor.toLowerCase()}`)
    .sort()
    .join("|");

/** Indice de la primera tarjeta que repite los atributos de otra, o -1. */
export function tarjetaRepetida(tarjetas: TarjetaVariante[]): number {
  const vistas = new Set<string>();
  for (let i = 0; i < tarjetas.length; i++) {
    const clave = claveDe(tarjetas[i]);
    if (!clave) continue;
    if (vistas.has(clave)) return i;
    vistas.add(clave);
  }
  return -1;
}

/** Seccion de la tarjeta donde se corrige un problema. */
export type SeccionTarjeta = "datos" | "precio";

/**
 * Primer problema de una tarjeta y la seccion donde se corrige (para abrirla),
 * o `null` si esta lista para guardarse.
 */
export function problemaDeTarjeta(
  t: TarjetaVariante
): { mensaje: string; seccion: SeccionTarjeta } | null {
  if (t.atributos.some((a) => a.tipo === TIPO_PERSONALIZADO && !normalizarValor(a.nombre))) {
    return { mensaje: "Ponle nombre al atributo personalizado", seccion: "datos" };
  }
  if (atributosDeTarjeta(t).length === 0) {
    return { mensaje: "Escribe el valor del atributo (ej. 600 ml)", seccion: "datos" };
  }
  const contenido = contenidoCapturado(t.contenidoCantidad, t.contenidoUnidad);
  if (!contenido.ok) return { mensaje: contenido.error, seccion: "datos" };
  if (!(parseFloat(t.precio) > 0)) {
    return { mensaje: "El precio de venta debe ser mayor a 0", seccion: "precio" };
  }
  return null;
}

/**
 * Lo que se inserta en `variantes_producto` para una tarjeta. La unidad queda
 * en NULL (hereda) si es la misma del producto: asi, si despues cambia la del
 * producto, cambian con ella las variantes que no eligieron otra.
 */
export function inputDeTarjeta(
  t: TarjetaVariante,
  opciones: {
    productoId: string;
    baseSku: string;
    imagenUrl: string | null;
    unidadProducto?: UnidadMedida | null;
    /** Producto de servicio: sin stock ni unidad propia. */
    esServicio?: boolean;
  }
): VarianteInput {
  const servicio = Boolean(opciones.esServicio);
  const atributos = atributosDeTarjeta(t);
  const unidadEfectiva = t.unidad === UNIDAD_DEL_PRODUCTO ? opciones.unidadProducto : t.unidad;
  // El contenido es de lo que se vende por pieza: a granel o servicio, NULL.
  const contenido =
    servicio || esFraccionable(unidadEfectiva)
      ? null
      : contenidoCapturado(t.contenidoCantidad, t.contenidoUnidad);
  return {
    producto_id: opciones.productoId,
    sku: t.sku.trim() || skuDeCombinacion(opciones.baseSku, atributos.map((a) => a.valor)),
    codigo_barras: t.codigo.trim() || null,
    ...resumenCompatible(atributos),
    atributos,
    precio_venta: parseFloat(t.precio) || 0,
    costo_compra: parseFloat(t.costo) || 0,
    stock_actual: servicio ? 0 : parseFloat(t.stock) || 0,
    stock_minimo: servicio ? 0 : Math.max(0, parseFloat(t.stockMinimo) || 0),
    descripcion: t.descripcion.trim() || null,
    unidad_medida:
      servicio || t.unidad === UNIDAD_DEL_PRODUCTO || t.unidad === opciones.unidadProducto
        ? null
        : (t.unidad as UnidadMedida),
    contenido_cantidad: contenido?.ok ? contenido.contenido_cantidad : null,
    contenido_unidad: contenido?.ok ? contenido.contenido_unidad : null,
    imagen_url: opciones.imagenUrl,
  };
}

/** Base del SKU automatico: 4 letras del nombre del producto. */
export function baseSkuDe(nombre: string | null | undefined): string {
  return ((nombre ?? "").trim() || "VAR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4);
}
