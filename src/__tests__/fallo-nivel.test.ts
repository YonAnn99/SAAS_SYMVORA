import { describe, expect, it } from "vitest";
import { describirFalloNivel } from "@/features/payments/fallo-nivel";

describe("alerta de pago sin nivel asignado", () => {
  const base = { negocio: "Tienda <Uno>", tenantId: "ab77a437-4493-4312-a8f1-8504d93f76d9", nivel: "basico" };

  it("reconoce el choque de sucursales y lo dice claro", () => {
    const r = describirFalloNivel({ ...base, mensaje: "limite_sucursales" });
    expect(r.motivo).toBe("limite_sucursales");
    expect(r.subject).toContain("no se asignó el nivel");
    expect(r.text).toContain("más sucursales activas");
    expect(r.text).toContain(base.tenantId);
  });

  it("cualquier otro error cae en «otro» y no esconde el detalle", () => {
    const r = describirFalloNivel({ ...base, mensaje: "sin_suscripcion" });
    expect(r.motivo).toBe("otro");
    expect(r.text).toContain("sin_suscripcion");
  });

  it("escapa el nombre del negocio en el HTML", () => {
    const r = describirFalloNivel({ ...base, mensaje: "x" });
    expect(r.html).not.toContain("<Uno>");
    expect(r.html).toContain("&lt;Uno&gt;");
  });
});
