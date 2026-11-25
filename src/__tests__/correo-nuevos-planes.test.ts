import { describe, expect, it } from "vitest";
import { construirCorreoNovedadPedidos, construirCorreoNovedadPlanes } from "@/lib/email";
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

describe("correo de pedidos del catálogo", () => {
  const { subject, html } = construirCorreoNovedadPedidos({ nombre: "Ana", negocio: "Tienda <Uno>" });

  it("explica el flujo completo y que está apagado hasta activarlo", () => {
    expect(subject).toMatch(/pedidos/i);
    for (const t of ["Pedidos", "WhatsApp", "venta real", "apagado", "Recibir pedidos en la página", "Pro y Premium"]) {
      expect(html).toContain(t);
    }
  });

  it("avisa que la venta entra a la caja abierta de quien confirma", () => {
    expect(html).toContain("caja que tengas abierta");
  });

  it("escapa el negocio y lleva al catálogo en línea", () => {
    expect(html).not.toContain("<Uno>");
    expect(html).toContain("/es/online-catalog");
  });
});
