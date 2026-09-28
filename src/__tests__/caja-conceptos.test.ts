import { describe, expect, it } from "vitest";
import {
  cajaParaPago,
  descripcionDeMovimiento,
  esConceptoSalida,
} from "@/features/cash-register/conceptos";

describe("descripcionDeMovimiento", () => {
  it("usa lo que escribió el usuario", () => {
    expect(descripcionDeMovimiento("DEPOSITO_BANCO", "  BBVA  ", "Depósito")).toBe("BBVA");
  });

  it("en depósito y retiro, vacía se guarda el nombre del motivo", () => {
    expect(descripcionDeMovimiento("DEPOSITO_BANCO", "", "Depósito de efectivo")).toBe(
      "Depósito de efectivo"
    );
    expect(descripcionDeMovimiento("RETIRO_EFECTIVO", "  ", "Retiro de efectivo")).toBe(
      "Retiro de efectivo"
    );
  });

  it("en otro gasto y en entradas la descripción es obligatoria", () => {
    // Sin descripción, "Otro gasto" no dice en qué se fue el dinero.
    expect(descripcionDeMovimiento("OTRO_GASTO", "", "Otro gasto")).toBeNull();
    expect(descripcionDeMovimiento(null, "", "")).toBeNull();
  });

  it("reconoce solo los motivos de salida", () => {
    expect(esConceptoSalida("RETIRO_EFECTIVO")).toBe(true);
    // COMPRA lo pone el sistema, no se elige a mano.
    expect(esConceptoSalida("COMPRA")).toBe(false);
  });
});

describe("cajaParaPago", () => {
  const norte = { id: "c-norte", sucursal_id: "s-norte", fecha_apertura: "2026-09-28T15:00:00Z", sucursal: { nombre: "Norte" } };
  const principal = { id: "c-principal", sucursal_id: "s-principal", fecha_apertura: "2026-09-28T13:00:00Z", sucursal: { nombre: "Principal" } };

  it("sin cajas abiertas no hay de dónde pagar", () => {
    expect(cajaParaPago([], "s-norte")).toBeNull();
  });

  it("prefiere la caja del local que recibe la mercancía", () => {
    expect(cajaParaPago([norte, principal], "s-principal")?.id).toBe("c-principal");
  });

  it("si no tiene caja en ese local, usa la más reciente", () => {
    expect(cajaParaPago([principal, norte], "s-sur")?.id).toBe("c-norte");
    expect(cajaParaPago([principal, norte], null)?.id).toBe("c-norte");
  });
});
