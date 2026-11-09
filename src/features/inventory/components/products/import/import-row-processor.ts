import {
  contenidoCapturado,
  esFraccionable,
  esUnidad,
  type UnidadMedida,
} from "@/lib/unidades";
import { productImportRowSchema } from "@/lib/validations/schemas";
import { getDefaultClaveUnidad } from "@/features/facturacion/catalogs";
import type {
  ImportFieldMapping,
  ImportRow,
  ImportTargetField,
  ProductImportInput,
} from "../../../types/import.types";
import type { ExistingProductInfo } from "../../../services/product-import-service";

// Alias habituales en los Excel de los clientes. Lo que no se reconoce queda
// como PIEZA (igual que antes), para no rechazar el renglon entero por la unidad.
const ALIAS_UNIDAD: Record<string, UnidadMedida> = {
  PZ: "PIEZA", PZA: "PIEZA", PZAS: "PIEZA", PIEZAS: "PIEZA", UNIDAD: "PIEZA", U: "PIEZA",
  KILO: "KG", KILOS: "KG", KILOGRAMO: "KG", KILOGRAMOS: "KG", KGS: "KG",
  G: "GRAMO", GR: "GRAMO", GRS: "GRAMO", GRAMOS: "GRAMO",
  L: "LITRO", LT: "LITRO", LTS: "LITRO", LITROS: "LITRO",
  ML: "MILILITRO", MILILITROS: "MILILITRO",
  M: "METRO", MT: "METRO", MTS: "METRO", METROS: "METRO",
  CAJAS: "CAJA", CJ: "CAJA",
  PAQ: "PAQUETE", PAQUETES: "PAQUETE", PQ: "PAQUETE",
  PARES: "PAR",
  DOC: "DOCENA", DOCENAS: "DOCENA",
  SERV: "SERVICIO", SERVICIOS: "SERVICIO",
};

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

/** Vacio = 0; `null` si no es un numero (p. ej. una fila de ayuda: "Sin el símbolo $."). */
export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/mxn/gi, "").replace(/[\s$,]/g, "");
  if (!cleaned) return 0;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return Number(cleaned);
}

const CAMPOS_NUMERICOS = [
  ["precio_venta", "Precio de venta"],
  ["costo_compra", "Costo de compra"],
  ["stock_actual", "Stock actual"],
  ["stock_minimo", "Stock mínimo"],
] as const satisfies readonly (readonly [ImportTargetField, string])[];

export function parseUnidadMedida(value: string): UnidadMedida {
  const upper = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.$/, "");
  if (esUnidad(upper)) return upper;
  return ALIAS_UNIDAD[upper] ?? "PIEZA";
}

const SI = new Set(["SI", "S", "X", "1", "TRUE", "YES", "Y", "VERDADERO"]);

/** "Sí", "si", "x", "1"… = verdadero; vacio o cualquier otra cosa = falso. */
export function parseSiNo(value: unknown): boolean {
  if (value === true) return true;
  const texto = String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.$/, "");
  return SI.has(texto);
}

/**
 * Contenido del envase de una fila: cantidad y unidad escritas ("600" y
 * "Mililitro" o "ml"). Vacio = sin contenido. Igual que el formulario: a granel
 * o en un servicio no aplica y queda en NULL.
 */
export function contenidoDeFila(
  cantidadTexto: string,
  unidadTexto: string,
  unidadVenta: UnidadMedida
): { ok: true; cantidad: number | null; unidad: UnidadMedida | null } | { ok: false; error: string } {
  if (!cantidadTexto.trim() || unidadVenta === "SERVICIO" || esFraccionable(unidadVenta)) {
    return { ok: true, cantidad: null, unidad: null };
  }
  const unidad = unidadTexto.trim() ? parseUnidadMedida(unidadTexto) : null;
  const contenido = contenidoCapturado(cantidadTexto, unidad);
  if (!contenido.ok) return { ok: false, error: `Contenido: ${contenido.error}` };
  return { ok: true, cantidad: contenido.contenido_cantidad, unidad: contenido.contenido_unidad };
}

export interface BuildImportRowsParams {
  rawRows: Record<string, unknown>[];
  mapping: ImportFieldMapping;
  existingBarcodes: Map<string, ExistingProductInfo>;
  supplierMap: Map<string, string>;
  /** Fila real de la hoja de cada `rawRows[i]` (el encabezado no siempre es la fila 1). */
  rowNumbers?: number[];
}

/** Sin `rowNumbers`: la fila 1 es el encabezado, asi que el primer dato es la fila 2. */
const HEADER_ROW_OFFSET = 2;

export function buildImportRows({
  rawRows,
  mapping,
  existingBarcodes,
  supplierMap,
  rowNumbers,
}: BuildImportRowsParams): ImportRow[] {
  const seenInFile = new Map<string, number>();

  return rawRows.map((raw, idx) => {
    const rowIndex = rowNumbers?.[idx] ?? idx + HEADER_ROW_OFFSET;

    const nombre = readField(raw, mapping, "nombre");
    const codigoBarras = readField(raw, mapping, "codigo_barras");
    const sku = readField(raw, mapping, "sku");
    const descripcion = readField(raw, mapping, "descripcion");
    // Un servicio se vende como SERVICIO y sin existencias, como en el formulario.
    const esServicio = parseSiNo(readField(raw, mapping, "es_servicio"));
    const permiteLotes = !esServicio && parseSiNo(readField(raw, mapping, "permite_lotes"));
    const unidadMedida: UnidadMedida = esServicio
      ? "SERVICIO"
      : parseUnidadMedida(readField(raw, mapping, "unidad_medida"));
    const categoria = readField(raw, mapping, "categoria");
    const proveedorNombre = readField(raw, mapping, "proveedor");

    const numeros: Partial<Record<(typeof CAMPOS_NUMERICOS)[number][0], number>> = {};
    for (const [field, etiqueta] of CAMPOS_NUMERICOS) {
      const texto = readField(raw, mapping, field);
      const numero = parseNumber(texto);
      if (numero === null) {
        return {
          index: rowIndex,
          raw,
          status: "invalid",
          errorMessage: `${etiqueta} no es un número ("${texto}")`,
          data: null,
        } satisfies ImportRow;
      }
      numeros[field] = numero;
    }

    const contenido = contenidoDeFila(
      readField(raw, mapping, "contenido_cantidad"),
      readField(raw, mapping, "contenido_unidad"),
      unidadMedida
    );
    if (!contenido.ok) {
      return {
        index: rowIndex,
        raw,
        status: "invalid",
        errorMessage: contenido.error,
        data: null,
      } satisfies ImportRow;
    }

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
      precio_venta: numeros.precio_venta,
      costo_compra: numeros.costo_compra,
      stock_actual: esServicio ? 0 : numeros.stock_actual,
      stock_minimo: esServicio ? 0 : numeros.stock_minimo,
      es_servicio: esServicio,
      categoria: categoria || undefined,
      proveedor_id: proveedorId || undefined,
      // Las claves SAT no se importan (CFDI oculto); la de unidad se deriva
      // para que el producto quede listo si se reactiva la facturacion.
      clave_unidad: getDefaultClaveUnidad(unidadMedida),
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
      ...(mapping.contenido_cantidad || mapping.contenido_unidad
        ? { contenido_cantidad: contenido.cantidad, contenido_unidad: contenido.unidad }
        : {}),
      precio_venta: parsed.data.precio_venta,
      costo_compra: parsed.data.costo_compra,
      stock_actual: parsed.data.stock_actual,
      stock_minimo: parsed.data.stock_minimo,
      es_servicio: parsed.data.es_servicio ?? false,
      ...(mapping.permite_lotes ? { permite_lotes: permiteLotes } : {}),
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
