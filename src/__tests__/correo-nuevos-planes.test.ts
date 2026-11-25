import { describe, expect, it } from "vitest";
import { construirCorreoNovedadPlanes } from "@/lib/email";
import { precioNivelMXN, precioPromoNivelMXN } from "@/lib/niveles";

describe("correo de los nuevos planes", () => {
  const { subject, html } = construirCorreoNovedadPlanes({ nombre: "Ana", negocio: "Tienda <Uno>" });

  it("lleva los precios de la tabla de niveles y los de la promo", () => {
    for (const n of ["basico", "pro", "premium"] as const) expect(html).toContain(`$${precioNivelMXN(n, "monthly")}`);
    expect(html).toContain(`$${precioPromoNivelMXN("pro")}`);
    expect(html).toContain(`$${precioPromoNivelMXN("premium")}`);
    expect(subject).toMatch(/planes/i);
  });

  it("dice a los clientes actuales que pasan a Pro con su precio y a los de prueba que conservan todo", () => {
    expect(html).toContain("plan Pro");
    expect(html).toContain("conservas el precio que pagas hoy");
    expect(html).toContain("prueba gratis");
  });

  it("escapa el nombre del negocio y menciona el soporte", () => {
    expect(html).not.toContain("<Uno>");
    expect(html).toContain("soporte@symvora.com.mx");
  });
});
