import type { UnidadMedida } from "@/lib/unidades";
import type { TarjetaVariante } from "../tarjetas-variante";

export type ImportTargetField =
  | "nombre"
  | "codigo_barras"
  | "sku"
  | "descripcion"
  | "unidad_medida"
  | "precio_venta"
  | "costo_compra"
  | "stock_actual"
  | "stock_minimo"
  | "categoria"
  | "proveedor"
  // Lo que pide el formulario "Producto unico" (y la plantilla de Excel).
  | "contenido_cantidad"
  | "contenido_unidad"
  | "es_servicio"
  | "permite_lotes";

export type ImportFieldMapping = Partial<Record<ImportTargetField, string | null>>;

export type ImportRowStatus = "new" | "duplicate" | "invalid";

export type DuplicateResolution = "skip" | "update" | "generate";

export interface ProductImportInput {
  nombre: string;
  descripcion: string | null;
  codigo_barras: string | null;
  sku: string | null;
  unidad_medida: UnidadMedida;
  /**
   * Contenido del envase (migracion 114); NULL a granel o en servicios. Solo
   * va si el archivo trae la columna: "Actualizar existente" con un archivo de
   * otro sistema no debe borrar el contenido que ya tenia el producto.
   */
  contenido_cantidad?: number | null;
  contenido_unidad?: UnidadMedida | null;
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  es_servicio: boolean;
  /** Igual que el contenido: solo si el archivo trae la columna. */
  permite_lotes?: boolean;
  categoria: string | null;
  proveedor_id: string | null;
  clave_prod_serv: string | null;
  clave_unidad: string | null;
}

export interface ImportRow {
  /** 1-based row number as it appears in the source file (header = row 1). */
  index: number;
  raw: Record<string, unknown>;
  status: ImportRowStatus;
  errorMessage?: string;
  duplicateOf?: { id: string; nombre: string } | null;
  resolution?: DuplicateResolution;
  supplierWarning?: string | null;
  data: ProductImportInput | null;
}

/**
 * Un producto con variantes de la hoja "Productos con variantes": las filas con
 * el mismo nombre general. Cada variante es una `TarjetaVariante`, la misma
 * estructura de la ventana "Producto con variantes", para guardarla con la
 * misma logica (`inputDeTarjeta`).
 */
export interface VariantGroup {
  nombre: string;
  /** Fila de la hoja de cada variante (alineado con `tarjetas`). */
  filas: number[];
  status: ImportRowStatus;
  errorMessage?: string;
  categoria: string | null;
  esServicio: boolean;
  permiteLotes: boolean;
  /** La del producto general: la de la primera variante, o SERVICIO. */
  unidadProducto: UnidadMedida;
  tarjetas: TarjetaVariante[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
