import { productImportRowSchema } from "@/lib/validations/schemas";
import { getDefaultClaveUnidad } from "@/features/facturacion/catalogs";
import type {
  ImportFieldMapping,
  ImportRow,
  ImportTargetField,
  ProductImportInput,
} from "../../../types/import.types";
import type { ExistingProductInfo } from "../../../services/product-import-service";

const VALID_UNITS = ["PIEZA", "KG", "GRAMO", "LITRO", "SERVICIO"] as const;
type UnidadMedida = (typeof VALID_UNITS)[number];

function readField(
  raw: Record<string, unknown>,
  mapping: ImportFieldMapping,
  field: ImportTargetField
): string {
  const column = mapping[field];
  if (!column) return "";
  const value = raw[column];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseUnidadMedida(value: string): UnidadMedida {
  const upper = value.toUpperCase();
  return (VALID_UNITS as readonly string[]).includes(upper)
    ? (upper as UnidadMedida)
    : "PIEZA";
}

export interface BuildImportRowsParams {
  rawRows: Record<string, unknown>[];
  mapping: ImportFieldMapping;
  existingBarcodes: Map<string, ExistingProductInfo>;
  supplierMap: Map<string, string>;
}

/** Row 1 is the header, so the first data row is row 2. */
const HEADER_ROW_OFFSET = 2;

export function buildImportRows({
  rawRows,
  mapping,
  existingBarcodes,
  supplierMap,
}: BuildImportRowsParams): ImportRow[] {
  const seenInFile = new Map<string, number>();

  return rawRows.map((raw, idx) => {
    const rowIndex = idx + HEADER_ROW_OFFSET;

    const nombre = readField(raw, mapping, "nombre");
    const codigoBarras = readField(raw, mapping, "codigo_barras");
    const sku = readField(raw, mapping, "sku");
    const descripcion = readField(raw, mapping, "descripcion");
    const unidadMedida = parseUnidadMedida(readField(raw, mapping, "unidad_medida"));
    const precioVenta = parseNumber(readField(raw, mapping, "precio_venta"));
    const costoCompra = parseNumber(readField(raw, mapping, "costo_compra"));
    const stockActual = parseNumber(readField(raw, mapping, "stock_actual"));
    const stockMinimo = parseNumber(readField(raw, mapping, "stock_minimo"));
    const categoria = readField(raw, mapping, "categoria");
    const proveedorNombre = readField(raw, mapping, "proveedor");
    const claveProdServ = readField(raw, mapping, "clave_prod_serv");
    const claveUnidad = readField(raw, mapping, "clave_unidad");

    let supplierWarning: string | null = null;
    let proveedorId: string | null = null;
    if (proveedorNombre) {
      const found = supplierMap.get(proveedorNombre.toLowerCase());
      if (found) {
        proveedorId = found;
      } else {
        supplierWarning = `Proveedor "${proveedorNombre}" no encontrado, se importará sin proveedor`;
      }
    }

    const parsed = productImportRowSchema.safeParse({
      nombre,
      codigo_barras: codigoBarras || undefined,
      sku: sku || undefined,
      descripcion: descripcion || undefined,
      unidad_medida: unidadMedida,
      precio_venta: precioVenta,
      costo_compra: costoCompra,
      stock_actual: stockActual,
      stock_minimo: stockMinimo,
      es_servicio: false,
      categoria: categoria || undefined,
      proveedor_id: proveedorId || undefined,
      clave_prod_serv: claveProdServ || undefined,
      clave_unidad: claveUnidad || getDefaultClaveUnidad(unidadMedida),
    });

    if (!parsed.success) {
      return {
        index: rowIndex,
        raw,
        status: "invalid",
        errorMessage: parsed.error.issues[0]?.message || "Fila inválida",
        data: null,
      } satisfies ImportRow;
    }

    const data: ProductImportInput = {
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion || null,
      codigo_barras: parsed.data.codigo_barras || null,
      sku: parsed.data.sku || null,
      unidad_medida: parsed.data.unidad_medida,
      precio_venta: parsed.data.precio_venta,
      costo_compra: parsed.data.costo_compra,
      stock_actual: parsed.data.stock_actual,
      stock_minimo: parsed.data.stock_minimo,
      es_servicio: parsed.data.es_servicio ?? false,
      categoria: parsed.data.categoria || null,
      proveedor_id: parsed.data.proveedor_id || null,
      clave_prod_serv: parsed.data.clave_prod_serv || null,
      clave_unidad: parsed.data.clave_unidad || null,
    };

    const normalizedBarcode = data.codigo_barras?.trim().toLowerCase();
    if (normalizedBarcode && existingBarcodes.has(normalizedBarcode)) {
      return {
        index: rowIndex,
        raw,
        status: "duplicate",
        duplicateOf: existingBarcodes.get(normalizedBarcode) ?? null,
        resolution: "skip",
        supplierWarning,
        data,
      } satisfies ImportRow;
    }

    if (normalizedBarcode) {
      const firstRowIndex = seenInFile.get(normalizedBarcode);
      if (firstRowIndex !== undefined) {
        return {
          index: rowIndex,
          raw,
          status: "invalid",
          errorMessage: `Código de barras repetido en el archivo (ya aparece en la fila ${firstRowIndex})`,
          data: null,
        } satisfies ImportRow;
      }
      seenInFile.set(normalizedBarcode, rowIndex);
    }

    return {
      index: rowIndex,
      raw,
      status: "new",
      supplierWarning,
      data,
    } satisfies ImportRow;
  });
}
