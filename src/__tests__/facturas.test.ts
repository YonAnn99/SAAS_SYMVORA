import { describe, it, expect } from "vitest";
import {
  facturaCreateSchema,
  facturaLineaSchema,
  facturaCancelSchema,
  facturaStampSchema,
  tenantFiscalConfigSchema,
  clienteFiscalSchema,
} from "@/lib/validations/schemas";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("facturaLineaSchema", () => {
  it("should accept a valid line", () => {
    const result = facturaLineaSchema.safeParse({
      descripcion: "Producto de prueba",
      clave_prod_serv: "84111506",
      clave_unidad: "H87",
      unidad: "Pieza",
      cantidad: 2,
      precio_unitario: 100,
      descuento: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should reject a line with quantity of zero", () => {
    const result = facturaLineaSchema.safeParse({
      descripcion: "Test",
      clave_prod_serv: "84111506",
      clave_unidad: "H87",
      unidad: "Pieza",
      cantidad: 0,
      precio_unitario: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("facturaCreateSchema", () => {
  const validLine = {
    descripcion: "Producto",
    clave_prod_serv: "84111506",
    clave_unidad: "H87",
    unidad: "Pieza",
    cantidad: 1,
    precio_unitario: 100,
  };

  it("should accept a valid payload", () => {
    const result = facturaCreateSchema.safeParse({
      tenant_id: VALID_UUID,
      cliente_id: VALID_UUID,
      forma_pago: "01",
      metodo_pago: "PUE",
      lineas: [validLine],
    });
    expect(result.success).toBe(true);
  });

  it("should reject without lines", () => {
    const result = facturaCreateSchema.safeParse({
      tenant_id: VALID_UUID,
      cliente_id: VALID_UUID,
      forma_pago: "01",
      metodo_pago: "PUE",
      lineas: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid payment method", () => {
    const result = facturaCreateSchema.safeParse({
      tenant_id: VALID_UUID,
      cliente_id: VALID_UUID,
      forma_pago: "01",
      metodo_pago: "INVALIDO",
      lineas: [validLine],
    });
    expect(result.success).toBe(false);
  });
});

describe("facturaStampSchema", () => {
  it("should accept a valid UUID", () => {
    expect(facturaStampSchema.safeParse({ factura_id: VALID_UUID }).success).toBe(true);
  });

  it("should reject a non-UUID", () => {
    expect(facturaStampSchema.safeParse({ factura_id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("facturaCancelSchema", () => {
  it("should require a reason of at least 10 characters", () => {
    const short = facturaCancelSchema.safeParse({ factura_id: VALID_UUID, motivo: "corto" });
    expect(short.success).toBe(false);

    const valid = facturaCancelSchema.safeParse({
      factura_id: VALID_UUID,
      motivo: "Este es un motivo de cancelación válido",
    });
    expect(valid.success).toBe(true);
  });
});

describe("tenantFiscalConfigSchema", () => {
  it("should accept a valid fiscal config", () => {
    const result = tenantFiscalConfigSchema.safeParse({
      rfc: "XAXX010101000",
      razon_social: "Mi Empresa S.A. de C.V.",
      regimen_fiscal: "601",
      codigo_postal: "06600",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a malformed RFC", () => {
    const result = tenantFiscalConfigSchema.safeParse({
      rfc: "invalid",
      razon_social: "Mi Empresa",
      regimen_fiscal: "601",
      codigo_postal: "06600",
    });
    expect(result.success).toBe(false);
  });

  it("should reject a 4-digit postal code", () => {
    const result = tenantFiscalConfigSchema.safeParse({
      rfc: "XAXX010101000",
      razon_social: "Mi Empresa",
      regimen_fiscal: "601",
      codigo_postal: "1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("clienteFiscalSchema", () => {
  it("should accept empty optional fields", () => {
    const result = clienteFiscalSchema.safeParse({ rfc: "" });
    expect(result.success).toBe(true);
  });

  it("should accept a full valid payload", () => {
    const result = clienteFiscalSchema.safeParse({
      rfc: "XAXX010101001",
      razon_social: "Cliente Final",
      regimen_fiscal_receptor: "612",
      uso_cfdi: "G03",
      codigo_postal: "06600",
    });
    expect(result.success).toBe(true);
  });
});