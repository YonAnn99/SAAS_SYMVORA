import { describe, it, expect } from "vitest";
import { productImportRowSchema } from "@/lib/validations/schemas";
import { chunkRows } from "@/features/inventory/services/product-import-service";
import { guessFieldMapping } from "@/features/inventory/components/products/import/import-field-config";
import { buildImportRows } from "@/features/inventory/components/products/import/import-row-processor";
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
