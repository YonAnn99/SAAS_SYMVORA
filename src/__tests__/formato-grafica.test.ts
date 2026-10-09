import { describe, expect, it } from "vitest";
import {
  montoCompleto,
  montoEje,
  porcentaje,
  recortarEtiqueta,
} from "@/components/charts/formato-grafica";

describe("formato de graficas", () => {
  it("monto completo con separador de miles", () => {
    expect(montoCompleto(1234.5)).toBe("$1,234.50");
  });

  it("monto de eje compacto", () => {
    expect(montoEje(850)).toBe("$850");
    expect(montoEje(0)).toBe("$0");
    // El separador y el sufijo dependen de ICU; basta con que sea corto y en pesos.
    const mil = montoEje(1200);
    expect(mil.startsWith("$")).toBe(true);
    expect(mil.length).toBeLessThan("$1,200.00".length);
  });

  it("recorta etiquetas largas con puntos suspensivos", () => {
    expect(recortarEtiqueta("Coca Cola", 20)).toBe("Coca Cola");
    expect(recortarEtiqueta("Refresco de cola 600 ml retornable", 12)).toBe("Refresco de…");
    expect(recortarEtiqueta("Refresco de cola", 12).length).toBeLessThanOrEqual(12);
  });

  it("porcentaje entero y 0 sin total", () => {
    expect(porcentaje(45, 100)).toBe(45);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(5, 0)).toBe(0);
  });
});
