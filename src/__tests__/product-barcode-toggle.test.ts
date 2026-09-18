import { describe, expect, it } from "vitest";
import { productSchema } from "@/lib/validations/schemas";

describe("Product Schema con códigos de barras manuales y automáticos", () => {
  it("acepta un producto con código de barras generado automáticamente (EAN-13)", () => {
    const data = {
      nombre: "Producto Automático",
      precio_venta: 100,
      costo_compra: 60,
      stock_actual: 10,
      stock_minimo: 2,
      unidad_medida: "PIEZA",
      codigo_barras: "7501234567890",
      sku: "SKU-001",
    };

    const parsed = productSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.codigo_barras).toBe("7501234567890");
      expect(parsed.data.sku).toBe("SKU-001");
    }
  });

  it("acepta un producto con código de barras manual escaneado (alfanumérico o formato propio)", () => {
    const data = {
      nombre: "Producto con Escaneo Manual",
      precio_venta: 250,
      costo_compra: 180,
      stock_actual: 5,
      stock_minimo: 1,
      unidad_medida: "PIEZA",
      codigo_barras: "PROD-MANUAL-9988",
      sku: "MY-CUSTOM-SKU",
    };

    const parsed = productSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.codigo_barras).toBe("PROD-MANUAL-9988");
      expect(parsed.data.sku).toBe("MY-CUSTOM-SKU");
    }
  });

  it("acepta un producto sin código de barras cuando el cliente no maneja códigos", () => {
    const data = {
      nombre: "Producto sin Código",
      precio_venta: 50,
      costo_compra: 20,
      stock_actual: 0,
      stock_minimo: 0,
      unidad_medida: "PIEZA",
      codigo_barras: "",
      sku: "SKU-003",
    };

    const parsed = productSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });
});
