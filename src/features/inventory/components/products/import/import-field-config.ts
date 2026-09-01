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
  { field: "clave_prod_serv", required: false, labelKey: "products.import.fields.clave_prod_serv" },
  { field: "clave_unidad", required: false, labelKey: "products.import.fields.clave_unidad" },
];

const FIELD_ALIASES: Record<ImportTargetField, string[]> = {
  nombre: ["nombre", "name", "producto", "product", "articulo"],
  codigo_barras: ["codigo_barras", "codigo de barras", "barcode", "ean", "upc", "codigobarras"],
  sku: ["sku", "clave"],
  descripcion: ["descripcion", "description", "detalle"],
  unidad_medida: ["unidad_medida", "unidad", "unit", "uom"],
  precio_venta: ["precio_venta", "precio", "price", "precio de venta", "sale price"],
  costo_compra: ["costo_compra", "costo", "cost", "purchase cost"],
  stock_actual: ["stock_actual", "stock", "existencia", "cantidad", "quantity", "qty"],
  stock_minimo: ["stock_minimo", "stock minimo", "minimum stock", "min stock"],
  categoria: ["categoria", "category"],
  proveedor: ["proveedor", "supplier", "vendor"],
  clave_prod_serv: ["clave_prod_serv", "clave prod serv", "clave sat", "sat product code"],
  clave_unidad: ["clave_unidad", "clave unidad", "clave unidad sat", "sat unit code"],
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function guessFieldMapping(headers: string[]): ImportFieldMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalize(header),
  }));
  const mapping: ImportFieldMapping = {};

  for (const { field } of IMPORT_TARGET_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    const match = normalizedHeaders.find((header) => aliases.includes(header.normalized));
    if (match) {
      mapping[field] = match.original;
    }
  }

  return mapping;
}
