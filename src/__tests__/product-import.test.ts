import { describe, it, expect } from "vitest";
import { productImportRowSchema } from "@/lib/validations/schemas";
import { chunkRows } from "@/features/inventory/services/product-import-service";
import { guessFieldMapping } from "@/features/inventory/components/products/import/import-field-config";
import { buildImportRows } from "@/features/inventory/components/products/import/import-row-processor";
import { tablaDesdeMatriz } from "@/features/inventory/components/products/import/import-file-parser";
import type { ImportFieldMapping } from "@/features/inventory/types/import.types";

describe("Product Import Row Schema", () => {
  const validRow = {
    nombre: "Coca Cola 600ml",
    unidad_medida: "PIEZA" as const,
    precio_venta: 18.5,
    costo_compra: 12.0,
    stock_actual: 100,
    stock_minimo: 10,
  };

  it("should accept a valid row without SAT codes", () => {
    const result = productImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it("should accept optional clave_prod_serv and clave_unidad", () => {
    const result = productImportRowSchema.safeParse({
      ...validRow,
      clave_prod_serv: "50202306",
      clave_unidad: "H87",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a row without a name", () => {
    const result = productImportRowSchema.safeParse({ ...validRow, nombre: "" });
    expect(result.success).toBe(false);
  });
});

describe("guessFieldMapping", () => {
  it("matches common Spanish header names to target fields", () => {
    const mapping = guessFieldMapping([
      "Nombre",
      "Código de barras",
      "Precio",
      "Stock",
    ]);
    expect(mapping.nombre).toBe("Nombre");
    expect(mapping.codigo_barras).toBe("Código de barras");
    expect(mapping.precio_venta).toBe("Precio");
    expect(mapping.stock_actual).toBe("Stock");
  });

  it("leaves unrecognized columns unmapped", () => {
    const mapping = guessFieldMapping(["Columna rara", "Otra cosa"]);
    expect(mapping.nombre).toBeUndefined();
  });

  it("matches descriptive headers from other systems' templates", () => {
    const mapping = guessFieldMapping(PLANTILLA_ENCABEZADOS);
    expect(mapping).toEqual({
      nombre: "Nombre del producto",
      precio_venta: "Precio de venta",
      unidad_medida: "Unidad de medida",
      costo_compra: "Costo",
      sku: "Código del producto (SKU)",
      stock_actual: "Stock",
      stock_minimo: "Alerta para stock mínimo",
      categoria: "Categorías",
      codigo_barras: "EAN / GTIN",
    });
  });

  it("prefers the longest alias and uses each column once", () => {
    const mapping = guessFieldMapping(["Alerta para stock mínimo", "Stock", "Precio de compra", "Precio"]);
    expect(mapping.stock_minimo).toBe("Alerta para stock mínimo");
    expect(mapping.stock_actual).toBe("Stock");
    expect(mapping.costo_compra).toBe("Precio de compra");
    expect(mapping.precio_venta).toBe("Precio");
  });
});

// Encabezados de la plantilla "Agregar productos" (columna B a K).
const PLANTILLA_ENCABEZADOS = [
  "Nombre del producto",
  "Precio de venta",
  "Unidad de medida",
  "Costo",
  "Código del producto (SKU)",
  "Stock",
  "Alerta para stock mínimo",
  "Categorías",
  "EAN / GTIN",
  "Verificación de errores",
];

describe("tablaDesdeMatriz", () => {
  // Replica esa plantilla: instrucciones arriba, encabezado en la fila 3
  // desde la columna B, una fila de ayuda, una vacia y luego los datos.
  const matriz: unknown[][] = [
    ["", "Instrucciones para completar la planilla:\n- Agrega nuevos productos en las filas en blanco de la planilla."],
    ["", " (Obligatorio)", "", "(Opcional)"],
    ["", ...PLANTILLA_ENCABEZADOS],
    ["", "Máximo de 60 caracteres.", "Sin el símbolo $. ", "Elija la unidad", "Sin el símbolo $. ", "Indique un código SKU único por producto.", "", "Indica que la cantidad de su producto está baja en stock."],
    [],
    ["", "Producto A", 100, "unidad", 60, "SKU001", 50, 10, "Electrónica", 1234567890123],
    ["", "Producto B", 200, "kg", 120, "SKU002", 30, 5, "Alimentos", 9876543210987],
  ];

  it("finds the header row below the instructions", () => {
    const tabla = tablaDesdeMatriz(matriz, 1);
    expect(tabla.headers).toEqual(PLANTILLA_ENCABEZADOS);
    expect(tabla.rowNumbers).toEqual([4, 6, 7]);
    expect(tabla.rows[1]["Nombre del producto"]).toBe("Producto A");
    expect(tabla.rows[1]["Precio de venta"]).toBe(100);
  });

  it("imports the products and rejects the help row", () => {
    const tabla = tablaDesdeMatriz(matriz, 1);
    const rows = buildImportRows({
      rawRows: tabla.rows,
      rowNumbers: tabla.rowNumbers,
      mapping: guessFieldMapping(tabla.headers),
      existingBarcodes: new Map(),
      supplierMap: new Map(),
    });
    expect(rows.map((row) => [row.index, row.status])).toEqual([
      [4, "invalid"],
      [6, "new"],
      [7, "new"],
    ]);
    expect(rows[2].data).toMatchObject({
      nombre: "Producto B",
      unidad_medida: "KG",
      precio_venta: 200,
      costo_compra: 120,
      stock_actual: 30,
      stock_minimo: 5,
      sku: "SKU002",
      categoria: "Alimentos",
      codigo_barras: "9876543210987",
      clave_prod_serv: null,
    });
  });

  it("falls back to the first non-empty row and numbers repeated headers", () => {
    const tabla = tablaDesdeMatriz([[], ["A", "A", ""], ["x", "y", "z"]], 1);
    expect(tabla.headers).toEqual(["A", "A (2)"]);
    expect(tabla.rows).toEqual([{ A: "x", "A (2)": "y" }]);
    expect(tabla.rowNumbers).toEqual([3]);
  });
});

describe("buildImportRows", () => {
  const mapping: ImportFieldMapping = {
    nombre: "nombre",
    codigo_barras: "codigo_barras",
    precio_venta: "precio_venta",
    costo_compra: "costo_compra",
    stock_actual: "stock_actual",
    proveedor: "proveedor",
  };

  it("marks a brand-new row as 'new'", () => {
    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "Producto nuevo",
          codigo_barras: "7501234567890",
          precio_venta: "20",
          costo_compra: "10",
          stock_actual: "5",
        },
      ],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map(),
    });

    expect(rows[0].status).toBe("new");
    expect(rows[0].data?.nombre).toBe("Producto nuevo");
  });

  it("marks a row with a colliding barcode as 'duplicate'", () => {
    const existingBarcodes = new Map([
      ["7501234567890", { id: "existing-id", nombre: "Producto viejo" }],
    ]);

    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "Producto repetido",
          codigo_barras: "7501234567890",
          precio_venta: "20",
          costo_compra: "10",
          stock_actual: "5",
        },
      ],
      mapping,
      existingBarcodes,
      supplierMap: new Map(),
    });

    expect(rows[0].status).toBe("duplicate");
    expect(rows[0].duplicateOf?.id).toBe("existing-id");
    expect(rows[0].resolution).toBe("skip");
  });

  it("marks a row missing the required name as 'invalid'", () => {
    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "",
          precio_venta: "20",
          costo_compra: "10",
          stock_actual: "5",
        },
      ],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map(),
    });

    expect(rows[0].status).toBe("invalid");
    expect(rows[0].data).toBeNull();
  });

  it("warns when the mapped supplier name is not found, without blocking the row", () => {
    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "Producto con proveedor desconocido",
          precio_venta: "20",
          costo_compra: "10",
          stock_actual: "5",
          proveedor: "Proveedor Fantasma",
        },
      ],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map([["proveedor real", "550e8400-e29b-41d4-a716-446655440099"]]),
    });

    expect(rows[0].status).toBe("new");
    expect(rows[0].data?.proveedor_id).toBeNull();
    expect(rows[0].supplierWarning).toContain("Proveedor Fantasma");
  });

  it("marks a repeated new barcode within the same file as 'invalid' instead of double-'new'", () => {
    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "Producto A",
          codigo_barras: "9999999999901",
          precio_venta: "50",
          costo_compra: "30",
          stock_actual: "10",
        },
        {
          nombre: "Producto B",
          codigo_barras: "9999999999901",
          precio_venta: "60",
          costo_compra: "40",
          stock_actual: "5",
        },
        {
          nombre: "Producto C",
          codigo_barras: "9999999999902",
          precio_venta: "70",
          costo_compra: "50",
          stock_actual: "8",
        },
      ],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map(),
    });

    expect(rows[0].status).toBe("new");
    expect(rows[1].status).toBe("invalid");
    expect(rows[1].errorMessage).toContain("repetido");
    expect(rows[2].status).toBe("new");
  });

  it("resolves a known supplier name to its id", () => {
    const rows = buildImportRows({
      rawRows: [
        {
          nombre: "Producto con proveedor conocido",
          precio_venta: "20",
          costo_compra: "10",
          stock_actual: "5",
          proveedor: "Proveedor Real",
        },
      ],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map([["proveedor real", "550e8400-e29b-41d4-a716-446655440099"]]),
    });

    expect(rows[0].data?.proveedor_id).toBe("550e8400-e29b-41d4-a716-446655440099");
    expect(rows[0].supplierWarning).toBeNull();
  });
});

describe("buildImportRows numbers", () => {
  const mapping: ImportFieldMapping = { nombre: "nombre", precio_venta: "precio" };
  const construir = (precio: unknown) =>
    buildImportRows({
      rawRows: [{ nombre: "Producto", precio }],
      mapping,
      existingBarcodes: new Map(),
      supplierMap: new Map(),
    })[0];

  it("accepts currency symbols, thousands separators and MXN", () => {
    expect(construir("$1,234.50").data?.precio_venta).toBe(1234.5);
    expect(construir("18 MXN").data?.precio_venta).toBe(18);
    expect(construir("").data?.precio_venta).toBe(0);
  });

  it("marks a non-numeric price as invalid instead of importing it as 0", () => {
    const row = construir("Sin el símbolo $.");
    expect(row.status).toBe("invalid");
    expect(row.errorMessage).toContain("Precio de venta");
  });
});

describe("chunkRows", () => {
  it("splits rows into equally sized chunks with a smaller final chunk", () => {
    const rows = Array.from({ length: 10 }, (_, i) => i);
    const chunks = chunkRows(rows, 3);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual([0, 1, 2]);
    expect(chunks[3]).toEqual([9]);
  });

  it("returns a single chunk when size exceeds row count", () => {
    const rows = [1, 2, 3];
    const chunks = chunkRows(rows, 250);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(rows);
  });

  it("returns no chunks for an empty input", () => {
    expect(chunkRows([], 250)).toEqual([]);
  });
});
