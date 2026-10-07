import type { ImportFieldMapping, ImportTargetField } from "../../../types/import.types";

export const IMPORT_TARGET_FIELDS: {
  field: ImportTargetField;
  required: boolean;
  labelKey: string;
}[] = [
  { field: "nombre", required: true, labelKey: "products.import.fields.nombre" },
  { field: "codigo_barras", required: false, labelKey: "products.import.fields.codigo_barras" },
  { field: "sku", required: false, labelKey: "products.import.fields.sku" },
  { field: "descripcion", required: false, labelKey: "products.import.fields.descripcion" },
  { field: "unidad_medida", required: false, labelKey: "products.import.fields.unidad_medida" },
  { field: "precio_venta", required: false, labelKey: "products.import.fields.precio_venta" },
  { field: "costo_compra", required: false, labelKey: "products.import.fields.costo_compra" },
  { field: "stock_actual", required: false, labelKey: "products.import.fields.stock_actual" },
  { field: "stock_minimo", required: false, labelKey: "products.import.fields.stock_minimo" },
  { field: "categoria", required: false, labelKey: "products.import.fields.categoria" },
  { field: "proveedor", required: false, labelKey: "products.import.fields.proveedor" },
];

// Ya normalizados (ver `normalize`): minusculas, sin acentos ni signos.
const FIELD_ALIASES: Record<ImportTargetField, string[]> = {
  nombre: ["nombre", "name", "producto", "product", "articulo", "nombre del producto", "product name"],
  codigo_barras: ["codigo barras", "codigo de barras", "barcode", "ean", "upc", "gtin", "codigobarras"],
  sku: ["sku", "clave", "codigo interno"],
  descripcion: ["descripcion", "description", "detalle"],
  unidad_medida: ["unidad medida", "unidad de medida", "unidad", "unit", "uom"],
  precio_venta: ["precio venta", "precio de venta", "precio", "price", "sale price", "precio publico"],
  costo_compra: ["costo compra", "costo de compra", "costo", "cost", "purchase cost", "precio de compra", "precio compra", "costo unitario"],
  stock_actual: ["stock actual", "stock", "existencia", "existencias", "cantidad", "quantity", "qty", "inventario"],
  stock_minimo: ["stock minimo", "minimum stock", "min stock", "minimo", "alerta stock minimo"],
  categoria: ["categoria", "categorias", "category", "categories", "departamento"],
  proveedor: ["proveedor", "proveedores", "supplier", "vendor"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Puntaje de que `header` sea la columna de un campo: coincidencia exacta con
 * un alias gana; si no, el alias contenido como palabras completas, y entre
 * esos el mas largo ("Alerta para stock minimo" es stock_minimo por
 * "stock minimo", no stock_actual por "stock"). 0 = no coincide.
 */
function puntaje(header: string, aliases: string[]): number {
  let mejor = 0;
  for (const alias of aliases) {
    if (header === alias) return 1000 + alias.length;
    if (` ${header} `.includes(` ${alias} `)) mejor = Math.max(mejor, alias.length);
  }
  return mejor;
}

export function guessFieldMapping(headers: string[]): ImportFieldMapping {
  const candidatos: { field: ImportTargetField; header: number; score: number }[] = [];
  headers.forEach((original, header) => {
    const normalized = normalize(original);
    if (!normalized) return;
    for (const { field } of IMPORT_TARGET_FIELDS) {
      const score = puntaje(normalized, FIELD_ALIASES[field]);
      if (score > 0) candidatos.push({ field, header, score });
    }
  });
  candidatos.sort((a, b) => b.score - a.score || a.header - b.header);

  // Cada campo y cada columna se usan una sola vez, empezando por lo mas seguro.
  const mapping: ImportFieldMapping = {};
  const columnasUsadas = new Set<number>();
  for (const { field, header } of candidatos) {
    if (mapping[field] || columnasUsadas.has(header)) continue;
    mapping[field] = headers[header];
    columnasUsadas.add(header);
  }
  return mapping;
}
