import { describe, expect, it } from "vitest";
import {
  deltaStock,
  hayCambio,
  parsearCampo,
  unidadesPermitidas,
  valorParaEditar,
} from "@/features/inventory/inline-edit";
import type { Producto } from "@/features/inventory/types/inventory.types";

/** Producto mínimo; cada test sobrescribe lo que le importa. */
const p = (o: Partial<Producto> = {}): Producto =>
  ({
    id: "p1",
    tenant_id: "t1",
    nombre: "Café",
    descripcion: null,
    codigo_barras: "7500000000004",
    sku: null,
    unidad_medida: "PIEZA",
    precio_venta: 60,
    costo_compra: 30,
    stock_actual: 9,
    stock_minimo: 5,
    es_servicio: false,
    permite_variantes: false,
    permite_lotes: false,
    categoria: null,
    proveedor_id: null,
    imagen_url: null,
    creado_en: "2026-01-01T00:00:00Z",
    actualizado_en: "2026-01-01T00:00:00Z",
    ...o,
  }) as Producto;

describe("unidadesPermitidas", () => {
  it("un servicio no se mide en kilos", () => {
    expect(unidadesPermitidas(p({ es_servicio: true, unidad_medida: "SERVICIO" })))
      .toEqual(["SERVICIO"]);
  });

  it("un producto físico no se mide en 'servicio'", () => {
    const unidades = unidadesPermitidas(p({ unidad_medida: "KG" }));
    expect(unidades).toEqual(["PIEZA", "KG", "GRAMO", "LITRO"]);
    expect(unidades).not.toContain("SERVICIO");
  });

  it("la unidad actual entra aunque contradiga es_servicio", () => {
    // EL DEFECTO QUE EVITA: con datos inconsistentes (marcado servicio pero
    // guardado en PIEZA, que pasa al activar el switch del diálogo) la lista
    // no contendría el valor actual, el desplegable abriría en blanco y el
    // primer clic le cambiaría la unidad al producto sin pedirlo.
    const unidades = unidadesPermitidas(
      p({ es_servicio: true, unidad_medida: "PIEZA" })
    );
    expect(unidades).toContain("PIEZA");
    expect(unidades).toContain("SERVICIO");
  });

  it("no duplica la unidad actual cuando ya encaja", () => {
    const unidades = unidadesPermitidas(p({ unidad_medida: "GRAMO" }));
    expect(unidades.filter((u) => u === "GRAMO")).toHaveLength(1);
  });
});

describe("parsearCampo", () => {
  it("un precio de 0 se acepta: hay productos de regalo y de cortesía", () => {
    // El esquema es min(0), no min(1), pese a que su mensaje diga "mayor a 0".
    expect(parsearCampo("precio_venta", "0")).toEqual({ ok: true, valor: 0 });
  });

  it("rechaza precio negativo y nombre vacío", () => {
    expect(parsearCampo("precio_venta", "-5").ok).toBe(false);
    expect(parsearCampo("nombre", "   ").ok).toBe(false);
  });

  it("acepta stock con decimales", () => {
    // `stock_actual` es DECIMAL(10,3), no entero: un producto en kilos se
    // vende a 1.5. Validarlo como entero rompería media tienda.
    expect(parsearCampo("stock_actual", "1.5")).toEqual({ ok: true, valor: 1.5 });
  });

  it("texto no numérico no se cuela como NaN", () => {
    // `Number("abc")` es NaN y `NaN >= 0` es false, pero el mensaje de zod
    // para ese caso no dice nada útil. Se corta antes, con un mensaje claro.
    const r = parsearCampo("precio_venta", "abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/número/i);
  });

  it("un campo numérico vacío no vale 0", () => {
    // `Number("")` es 0: borrar la celda y salir habría puesto el precio a
    // cero sin avisar.
    expect(parsearCampo("stock_actual", "").ok).toBe(false);
  });

  it("recorta los espacios del nombre", () => {
    expect(parsearCampo("nombre", "  Café  ")).toEqual({
      ok: true,
      valor: "Café",
    });
  });

  it("rechaza una unidad que no existe en el enum", () => {
    expect(parsearCampo("unidad_medida", "BARRIL").ok).toBe(false);
  });
});

describe("hayCambio", () => {
  it("escribir el mismo valor no manda nada al servidor", () => {
    // Pasa constantemente: se entra en la celda y se sale sin tocar nada, y
    // el guardado por blur se dispara igual.
    expect(hayCambio(p({ precio_venta: 60 }), "precio_venta", 60)).toBe(false);
  });

  it('"60.00" y 60 son el mismo precio', () => {
    const parseo = parsearCampo("precio_venta", "60.00");
    expect(parseo.ok).toBe(true);
    if (parseo.ok) {
      expect(hayCambio(p({ precio_venta: 60 }), "precio_venta", parseo.valor))
        .toBe(false);
    }
  });

  it("detecta el cambio real", () => {
    expect(hayCambio(p({ precio_venta: 60 }), "precio_venta", 95)).toBe(true);
  });
});

describe("deltaStock", () => {
  it("manda la diferencia, no el total", () => {
    // `ajustar_inventario` SUMA lo que recibe. Mandarle 42 sobre un stock de
    // 50 lo dejaría en 92.
    expect(deltaStock(50, 42)).toBe(-8);
    expect(deltaStock(42, 50)).toBe(8);
  });

  it("sin cambio, ajuste cero", () => {
    expect(deltaStock(50, 50)).toBe(0);
  });

  it("no arrastra la cola del punto flotante", () => {
    // 50.1 - 50 da 0.09999999999999432 en coma flotante, y eso acabaría
    // escrito en el libro de ajustes como la cantidad ajustada.
    expect(deltaStock(50, 50.1)).toBe(0.1);
    expect(deltaStock(0.3, 0.1)).toBe(-0.2);
  });
});

describe("valorParaEditar", () => {
  it("abre el campo con el valor crudo, sin formato", () => {
    // La celda enseña "$80.00"; el campo debe abrir en "80", no en "$80.00",
    // o el primer guardado fallaría por no ser un número.
    expect(valorParaEditar(p({ precio_venta: 80 }), "precio_venta")).toBe("80");
    expect(valorParaEditar(p({ stock_actual: 9 }), "stock_actual")).toBe("9");
  });
});
