import { describe, it, expect } from "vitest";
import {
  productSchema,
  saleSchema,
  customerSchema,
  supplierSchema,
  loginSchema,
  cashRegisterOpenSchema,
  cashMovementSchema,
} from "@/lib/validations/schemas";

describe("Product Schema", () => {
  const validProduct = {
    nombre: "Coca Cola 600ml",
    unidad_medida: "PIEZA" as const,
    precio_venta: 18.5,
    costo_compra: 12.0,
    stock_actual: 100,
    stock_minimo: 10,
  };

  it("should accept valid product", () => {
    const result = productSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("should reject product without name", () => {
    const result = productSchema.safeParse({ ...validProduct, nombre: "" });
    expect(result.success).toBe(false);
  });

  it("should reject negative price", () => {
    const result = productSchema.safeParse({ ...validProduct, precio_venta: -5 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid unit", () => {
    const result = productSchema.safeParse({ ...validProduct, unidad_medida: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("should accept product with optional fields", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      codigo_barras: "7501020519043",
      sku: "CC-600",
      descripcion: "Refresco de cola",
      categoria: "Bebidas",
      es_servicio: false,
    });
    expect(result.success).toBe(true);
  });

  it("should default es_servicio to false", () => {
    const result = productSchema.safeParse(validProduct);
    if (result.success) {
      expect(result.data.es_servicio).toBe(false);
    }
  });
});

describe("Sale Schema", () => {
  const validSale = {
    metodo_pago: "EFECTIVO" as const,
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        nombre: "Coca Cola",
        cantidad: 2,
        precioUnitario: 18.5,
        descuento: 0,
        unidad_medida: "PIEZA" as const,
      },
    ],
  };

  it("should accept valid sale", () => {
    const result = saleSchema.safeParse(validSale);
    expect(result.success).toBe(true);
  });

  it("should reject sale without items", () => {
    const result = saleSchema.safeParse({ ...validSale, items: [] });
    expect(result.success).toBe(false);
  });

  it("should reject invalid payment method", () => {
    const result = saleSchema.safeParse({ ...validSale, metodo_pago: "CRYPTO" });
    expect(result.success).toBe(false);
  });

  it("should accept all valid payment methods", () => {
    const methods = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CREDITO"] as const;
    methods.forEach((method) => {
      const result = saleSchema.safeParse({ ...validSale, metodo_pago: method });
      expect(result.success).toBe(true);
    });
  });

  it("should accept sale with optional cliente_id", () => {
    const result = saleSchema.safeParse({
      ...validSale,
      cliente_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

describe("Customer Schema", () => {
  it("should accept valid customer", () => {
    const result = customerSchema.safeParse({ nombre: "Juan Pérez" });
    expect(result.success).toBe(true);
  });

  it("should reject customer without name", () => {
    const result = customerSchema.safeParse({ nombre: "" });
    expect(result.success).toBe(false);
  });

  it("should accept customer with all fields", () => {
    const result = customerSchema.safeParse({
      nombre: "Juan Pérez",
      email: "juan@example.com",
      telefono: "5551234567",
      direccion: "Calle Principal 123",
      limite_credito: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("should default limite_credito to 0", () => {
    const result = customerSchema.safeParse({ nombre: "Juan Pérez" });
    if (result.success) {
      expect(result.data.limite_credito).toBe(0);
    }
  });
});

describe("Supplier Schema", () => {
  it("should accept valid supplier", () => {
    const result = supplierSchema.safeParse({ nombre: "Coca Cola FEMSA" });
    expect(result.success).toBe(true);
  });

  it("should reject supplier without name", () => {
    const result = supplierSchema.safeParse({ nombre: "" });
    expect(result.success).toBe(false);
  });
});

describe("Login Schema", () => {
  it("should accept valid login", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Cash Register Open Schema", () => {
  it("should accept valid initial fund", () => {
    const result = cashRegisterOpenSchema.safeParse({ fondo_inicial: 1000 });
    expect(result.success).toBe(true);
  });

  it("should accept zero initial fund", () => {
    const result = cashRegisterOpenSchema.safeParse({ fondo_inicial: 0 });
    expect(result.success).toBe(true);
  });

  it("should reject negative initial fund", () => {
    const result = cashRegisterOpenSchema.safeParse({ fondo_inicial: -100 });
    expect(result.success).toBe(false);
  });
});

describe("Cash Movement Schema", () => {
  it("should accept valid entry movement", () => {
    const result = cashMovementSchema.safeParse({
      tipo: "ENTRADA",
      monto: 500,
      descripcion: "Venta en efectivo",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid exit movement", () => {
    const result = cashMovementSchema.safeParse({
      tipo: "SALIDA",
      monto: 100,
      descripcion: "Compra de suministros",
    });
    expect(result.success).toBe(true);
  });

  it("should reject zero amount", () => {
    const result = cashMovementSchema.safeParse({
      tipo: "ENTRADA",
      monto: 0,
      descripcion: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty description", () => {
    const result = cashMovementSchema.safeParse({
      tipo: "ENTRADA",
      monto: 100,
      descripcion: "",
    });
    expect(result.success).toBe(false);
  });
});
