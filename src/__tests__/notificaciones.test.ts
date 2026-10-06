import { describe, expect, it } from "vitest";
import {
  contarNoLeidas,
  etiquetaGlobo,
  fusionarNotificacion,
  haceCuanto,
  hayCorreoDeStockPendiente,
  type Notificacion,
} from "@/lib/notificaciones";
import { construirCorreoAvisoStock } from "@/lib/email";

const AHORA = new Date("2026-10-05T18:00:00Z").getTime();
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

function noti(parcial: Partial<Notificacion>): Notificacion {
  return {
    id: parcial.id ?? Math.random().toString(36).slice(2),
    tipo: parcial.tipo ?? "producto",
    titulo: parcial.titulo ?? "Algo",
    mensaje: parcial.mensaje ?? null,
    enlace: parcial.enlace ?? "/products",
    creado_en: parcial.creado_en ?? hace(0),
    correo_enviado_en: parcial.correo_enviado_en ?? null,
  };
}

describe("contarNoLeidas", () => {
  const lista = [noti({ creado_en: hace(60_000) }), noti({ creado_en: hace(3_600_000) })];

  it("sin haber abierto nunca la campana, todas cuentan", () => {
    expect(contarNoLeidas(lista, null)).toBe(2);
  });

  it("solo las posteriores al último vistazo", () => {
    expect(contarNoLeidas(lista, hace(120_000))).toBe(1);
    expect(contarNoLeidas(lista, hace(0))).toBe(0);
  });
});

describe("etiquetaGlobo", () => {
  it("vacío sin pendientes, número hasta 9 y luego 9+", () => {
    expect(etiquetaGlobo(0)).toBe("");
    expect(etiquetaGlobo(3)).toBe("3");
    expect(etiquetaGlobo(9)).toBe("9");
    expect(etiquetaGlobo(10)).toBe("9+");
  });
});

describe("haceCuanto", () => {
  it("redondea hacia abajo por minutos, horas y días", () => {
    expect(haceCuanto(hace(30_000), AHORA)).toBe("hace un momento");
    expect(haceCuanto(hace(5 * 60_000), AHORA)).toBe("hace 5 min");
    expect(haceCuanto(hace(3 * 3_600_000), AHORA)).toBe("hace 3 h");
    expect(haceCuanto(hace(26 * 3_600_000), AHORA)).toBe("ayer");
    expect(haceCuanto(hace(4 * 86_400_000), AHORA)).toBe("hace 4 días");
  });

  it("una fecha futura (relojes desfasados) no da tiempos negativos", () => {
    expect(haceCuanto(new Date(AHORA + 60_000).toISOString(), AHORA)).toBe("hace un momento");
  });
});

describe("hayCorreoDeStockPendiente", () => {
  it("solo avisos de stock recientes sin correo", () => {
    expect(hayCorreoDeStockPendiente([noti({ tipo: "producto" })], AHORA)).toBe(false);
    expect(hayCorreoDeStockPendiente([noti({ tipo: "stock_bajo", creado_en: hace(60_000) })], AHORA)).toBe(true);
    expect(
      hayCorreoDeStockPendiente(
        [noti({ tipo: "stock_agotado", creado_en: hace(60_000), correo_enviado_en: hace(0) })],
        AHORA
      )
    ).toBe(false);
  });

  it("uno de hace más de 24 h ya no se pide (la base tampoco lo mandaría)", () => {
    expect(
      hayCorreoDeStockPendiente([noti({ tipo: "stock_agotado", creado_en: hace(25 * 3_600_000) })], AHORA)
    ).toBe(false);
  });
});

describe("fusionarNotificacion", () => {
  it("una agrupada (mismo id) reemplaza a la anterior y sube arriba", () => {
    const a = noti({ id: "a", creado_en: hace(5_000), titulo: "Ana creó el producto X" });
    const b = noti({ id: "b", creado_en: hace(1_000) });
    const actualizada = noti({ id: "a", creado_en: hace(0), titulo: "Ana creó 2 productos" });
    const lista = fusionarNotificacion([b, a], actualizada);
    expect(lista.map((n) => n.id)).toEqual(["a", "b"]);
    expect(lista[0].titulo).toBe("Ana creó 2 productos");
  });

  it("respeta el tope", () => {
    const lista = Array.from({ length: 30 }, (_, i) => noti({ id: String(i), creado_en: hace(10_000 + i) }));
    expect(fusionarNotificacion(lista, noti({ id: "nueva" }), 30)).toHaveLength(30);
  });
});

describe("construirCorreoAvisoStock", () => {
  it("un solo producto: el asunto lo nombra", () => {
    const { subject } = construirCorreoAvisoStock({
      businessName: "Abarrotes Lupita",
      avisos: [{ tipo: "stock_agotado", nombre: "Coca-Cola 600 ml", stock: 0, minimo: 5, unidad: "PIEZA" }],
    });
    expect(subject).toBe("Se agotó: Coca-Cola 600 ml — Abarrotes Lupita");
  });

  it("varios: agotados primero, cantidades con unidad y texto escapado", () => {
    const { subject, html } = construirCorreoAvisoStock({
      businessName: "Abarrotes Lupita",
      avisos: [
        { tipo: "stock_bajo", nombre: "Queso <b>Oaxaca</b>", stock: 0.75, minimo: 2, unidad: "KG" },
        { tipo: "stock_agotado", nombre: "Sabritas", stock: 0, minimo: 0, unidad: "PIEZA" },
      ],
    });
    expect(subject).toBe("2 productos se están acabando en Abarrotes Lupita");
    expect(html.indexOf("Sabritas")).toBeLessThan(html.indexOf("Queso"));
    expect(html).toContain("0.75 kg");
    expect(html).toContain("Queso &lt;b&gt;Oaxaca&lt;/b&gt;");
    expect(html).not.toContain("<b>Oaxaca</b>");
  });
});
