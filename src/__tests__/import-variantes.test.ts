import { describe, expect, it } from "vitest";
import { buildVariantGroups, normalizarTexto } from "@/features/inventory/components/products/import/import-variantes";
import { inputDeTarjeta } from "@/features/inventory/tarjetas-variante";

/** Una fila de la hoja "Productos con variantes" con solo lo que se indique. */
function fila(datos: Record<string, unknown>): Record<string, unknown> {
  return { "Nombre general": "", "Atributo 1": "", "Valor 1": "", "Precio de venta": "", ...datos };
}

function grupos(filas: Record<string, unknown>[], extra: Partial<Parameters<typeof buildVariantGroups>[0]> = {}) {
  return buildVariantGroups({
    rawRows: filas,
    rowNumbers: filas.map((_, i) => i + 2),
    existingBarcodes: new Map(),
    existingNames: new Set(),
    ...extra,
  });
}

const COCA_600 = fila({ "Nombre general": "Coca Cola", Categoría: "Bebidas", "Atributo 1": "Capacidad", "Valor 1": "600 ml", "Precio de venta": 18, "Stock actual": 20 });
const COCA_25 = fila({ "Nombre general": "coca cola ", "Atributo 1": "capacidad", "Valor 1": "2.5 L", "Precio de venta": "48", "Stock actual": 10, Categoría: "Otra" });

describe("buildVariantGroups", () => {
  it("agrupa por nombre general (sin importar mayúsculas) y toma el producto de la primera fila", () => {
    const [grupo] = grupos([COCA_600, COCA_25]);
    expect(grupo.status).toBe("new");
    expect(grupo.nombre).toBe("Coca Cola");
    expect(grupo.filas).toEqual([2, 3]);
    expect(grupo.categoria).toBe("Bebidas");
    expect(grupo.unidadProducto).toBe("PIEZA");
    // "capacidad" se reconoce como el tipo de la lista.
    expect(grupo.tarjetas[1].atributos).toEqual([{ tipo: "Capacidad", nombre: "", valor: "2.5 L" }]);
  });

  it("cada variante se guarda igual que en la ventana (inputDeTarjeta)", () => {
    const [grupo] = grupos([COCA_600]);
    const input = inputDeTarjeta(grupo.tarjetas[0], {
      productoId: "p1",
      baseSku: "Coca",
      imagenUrl: null,
      unidadProducto: grupo.unidadProducto,
    });
    expect(input).toMatchObject({
      producto_id: "p1",
      atributos: [{ tipo: "Capacidad", valor: "600 ml" }],
      precio_venta: 18,
      stock_actual: 20,
      unidad_medida: null,
    });
  });

  it("un atributo que no está en la lista va como personalizado", () => {
    const [grupo] = grupos([fila({ "Nombre general": "Vela", "Atributo 1": "Aroma", "Valor 1": "Vainilla", "Precio de venta": 50 })]);
    expect(grupo.status).toBe("new");
    expect(grupo.tarjetas[0].atributos[0]).toEqual({ tipo: "Personalizado", nombre: "Aroma", valor: "Vainilla" });
  });

  it("una variante sin atributo o con precio 0 invalida el producto y dice la fila", () => {
    const sinAtributo = grupos([COCA_600, fila({ "Nombre general": "Coca Cola", "Precio de venta": 20 })]);
    expect(sinAtributo[0].status).toBe("invalid");
    expect(sinAtributo[0].errorMessage).toMatch(/^Fila 3:/);

    const sinPrecio = grupos([fila({ "Nombre general": "Coca Cola", "Atributo 1": "Capacidad", "Valor 1": "1 L" })]);
    expect(sinPrecio[0].status).toBe("invalid");
    expect(sinPrecio[0].errorMessage).toMatch(/Fila 2: El precio de venta debe ser mayor a 0/);
  });

  it("un atributo con valor pero sin nombre (o al revés) es un error", () => {
    const [grupo] = grupos([fila({ "Nombre general": "Playera", "Valor 1": "M", "Precio de venta": 150 })]);
    expect(grupo.status).toBe("invalid");
    expect(grupo.errorMessage).toMatch(/Falta el nombre del Atributo 1/);
  });

  it("un número mal escrito es un error", () => {
    const [grupo] = grupos([fila({ ...COCA_600, "Stock actual": "veinte" })]);
    expect(grupo.status).toBe("invalid");
    expect(grupo.errorMessage).toMatch(/Stock actual no es un número/);
  });

  it("dos variantes con los mismos atributos son un error", () => {
    const [grupo] = grupos([COCA_600, fila({ ...COCA_600 })]);
    expect(grupo.status).toBe("invalid");
    expect(grupo.errorMessage).toMatch(/Fila 3: repite los atributos/);
  });

  it("un producto que ya existe se omite (sus variantes se agregan desde el catálogo)", () => {
    const [grupo] = grupos([COCA_600], { existingNames: new Set([normalizarTexto("COCA-COLA")]) });
    expect(normalizarTexto("COCA-COLA")).toBe(normalizarTexto("Coca Cola"));
    expect(grupo.status).toBe("duplicate");
  });

  it("un código de barras repetido entre las dos hojas o ya en el catálogo es un error", () => {
    const conCodigo = fila({ ...COCA_600, "Código de barras": "750123" });
    const entreHojas = grupos([conCodigo], { barcodesEnArchivo: new Map([["750123", 4]]) });
    expect(entreHojas[0].errorMessage).toMatch(/ya aparece en la fila 4/);

    const enCatalogo = grupos([conCodigo], {
      existingBarcodes: new Map([["750123", { id: "x", nombre: "Otro" }]]),
    });
    expect(enCatalogo[0].errorMessage).toMatch(/ya existe en tu catálogo/);
  });

  it("un servicio: el producto va como SERVICIO y sin lotes", () => {
    const [grupo] = grupos([
      fila({ "Nombre general": "Corte", "¿Es servicio? (Sí/No)": "Sí", "¿Maneja lotes? (Sí/No)": "Sí", "Atributo 1": "Tipo", "Valor 1": "Niño", "Precio de venta": 80 }),
    ]);
    expect(grupo.status).toBe("new");
    expect(grupo.esServicio).toBe(true);
    expect(grupo.permiteLotes).toBe(false);
    expect(grupo.unidadProducto).toBe("SERVICIO");
  });

  it("la unidad del producto es la de la primera variante", () => {
    const [grupo] = grupos([
      fila({ "Nombre general": "Queso", "Atributo 1": "Tipo", "Valor 1": "Oaxaca", "¿Cómo se vende?": "Kilogramo", "Precio de venta": 180 }),
    ]);
    expect(grupo.unidadProducto).toBe("KG");
  });

  it("una fila sin nombre general es un error propio", () => {
    const resultado = grupos([fila({ "Atributo 1": "Talla", "Valor 1": "M", "Precio de venta": 10 })]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].status).toBe("invalid");
    expect(resultado[0].errorMessage).toMatch(/falta el Nombre general/);
  });
});
