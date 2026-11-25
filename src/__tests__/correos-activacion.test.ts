import { describe, expect, it } from "vitest";
import { construirCorreoActivacion, construirCorreoReactivarPrueba } from "@/lib/email";
import { DIAS_PRUEBA_REGALADOS } from "@/lib/activacion-correos";

describe("correos de activación", () => {
  const p = { nombre: "Ana", negocio: "Tienda <Uno>", diasRestantes: 9 };

  it("«primer producto» nombra lo que existe en la Misión del dashboard", () => {
    const { subject, html } = construirCorreoActivacion("primer_producto", p);
    expect(subject).toMatch(/primer producto/i);
    for (const t of ["Misión de primeros pasos", "Cargar 3 productos muestra (1 clic)", "Crear 1 rápido", "Excel", "/es/dashboard"]) {
      expect(html).toContain(t);
    }
  });

  it("«primera venta» anuncia el bono de días y los días que quedan", () => {
    const { subject, html } = construirCorreoActivacion("primera_venta", p);
    expect(subject).toMatch(/primera venta/i);
    expect(html).toContain(`${DIAS_PRUEBA_REGALADOS} días más de prueba`);
    expect(html).toContain("9 días");
    expect(html).toContain("Abrir caja rápida con $0");
    expect(html).toContain("/es/pos");
  });

  it("«ayuda» ofrece responder el correo o WhatsApp", () => {
    const { html } = construirCorreoActivacion("ayuda", p);
    expect(html).toContain("wa.me/");
    expect(html).toMatch(/responde este correo/i);
  });

  it("todos escapan el negocio y dicen cómo dejar de recibirlos", () => {
    for (const etapa of ["primer_producto", "primera_venta", "ayuda"] as const) {
      const { html } = construirCorreoActivacion(etapa, p);
      expect(html).not.toContain("<Uno>");
      expect(html).toMatch(/respóndenos y te sacamos de la lista/);
    }
  });

  it("la reactivación regala los días, no promete nada que no exista y escapa el negocio", () => {
    const { subject, html } = construirCorreoReactivarPrueba({ nombre: "", negocio: "Mi <b>negocio</b>" });
    expect(subject).toContain(`${DIAS_PRUEBA_REGALADOS} días`);
    expect(html).toContain("Cargar 3 productos muestra (1 clic)");
    expect(html).not.toContain("<b>negocio</b>");
  });
});
