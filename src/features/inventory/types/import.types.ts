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
  | "clave_prod_serv"
  | "clave_unidad";

export type ImportFieldMapping = Partial<Record<ImportTargetField, string | null>>;

export type ImportRowStatus = "new" | "duplicate" | "invalid";

export type DuplicateResolution = "skip" | "update" | "generate";

export interface ProductImportInput {
  nombre: string;
  descripcion: string | null;
  codigo_barras: string | null;
  sku: string | null;
  unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  es_servicio: boolean;
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

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
