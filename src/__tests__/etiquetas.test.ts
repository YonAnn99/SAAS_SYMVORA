import { describe, expect, it } from "vitest";
import {
  FORMATOS,
  HOJA_CARTA,
  formatoPorId,
  paginarEtiquetas,
  porPagina,
  textoPrecio,
  totalEtiquetas,
  type ItemEtiqueta,
} from "@/features/inventory/etiquetas/formatos-etiqueta";
import { generarPdfEtiquetas } from "@/features/inventory/etiquetas/etiquetas-pdf";

function item(copias: number, extra: Partial<ItemEtiqueta> = {}): ItemEtiqueta {
  return { clave: "producto:1", nombre: "Coca Cola", detalle: null, precio: 18, unidad: "PIEZA", codigo: "7501055300075", sku: null, copias, ...extra };
}

describe("formatos de etiqueta", () => {
  it("las hojas caben en una hoja carta", () => {
    for (const f of FORMATOS.filter((f) => f.tipo === "hoja")) {
      const derecha = f.margenIzquierdo + f.columnas * f.ancho + (f.columnas - 1) * f.separacionH;
      const abajo = f.margenSuperior + f.filas * f.alto + (f.filas - 1) * f.separacionV;
      expect(derecha).toBeLessThanOrEqual(HOJA_CARTA.ancho);
      expect(abajo).toBeLessThanOrEqual(HOJA_CARTA.alto);
    }
  });

  it("3x10 con 35 etiquetas son 2 hojas", () => {
    const f = formatoPorId("carta-3x10");
    const pos = paginarEtiquetas([item(20), item(15)], f);
    expect(pos).toHaveLength(35);
    expect(pos[29].pagina).toBe(0);
    expect(pos[30].pagina).toBe(1);
    expect(pos[30]).toMatchObject({ x: f.margenIzquierdo, y: f.margenSuperior });
    // Tercera columna, primera fila.
    expect(pos[2].x).toBeCloseTo(f.margenIzquierdo + 2 * (f.ancho + f.separacionH));
  });

  it("'empezar en la etiqueta 5' salta las 4 ya usadas", () => {
    const f = formatoPorId("carta-3x10");
    const pos = paginarEtiquetas([item(2)], f, 5);
    // La 5a es la fila 2, columna 2.
    expect(pos[0].x).toBeCloseTo(f.margenIzquierdo + f.ancho + f.separacionH);
    expect(pos[0].y).toBeCloseTo(f.margenSuperior + f.alto);
    // Un inicio fuera de rango se acota a la hoja.
    expect(paginarEtiquetas([item(1)], f, 999)[0].pagina).toBe(0);
  });

  it("rollo: una etiqueta por pagina e ignora el inicio", () => {
    const f = formatoPorId("rollo-50x25");
    expect(porPagina(f)).toBe(1);
    const pos = paginarEtiquetas([item(3)], f, 7);
    expect(pos.map((p) => p.pagina)).toEqual([0, 1, 2]);
    expect(pos.every((p) => p.x === 0 && p.y === 0)).toBe(true);
  });

  it("copias en 0 o negativas no se imprimen", () => {
    expect(totalEtiquetas([item(0), item(-2), item(2.7)])).toBe(2);
  });

  it("el precio a granel lleva la unidad", () => {
    expect(textoPrecio(18, "PIEZA")).toMatch(/^\$18\.00$/);
    expect(textoPrecio(180, "KG")).toMatch(/^\$180\.00 \/kg$/);
  });
});

describe("generarPdfEtiquetas", () => {
  it("genera un PDF con todas las etiquetas (con y sin codigo)", async () => {
    const items = [
      item(4),
      item(2, { clave: "variante:2", nombre: "Playera cuello redondo manga corta algodón premium", detalle: "M · Rojo", codigo: "PROD-01", sku: "PLAY-ROJ-M" }),
      item(1, { codigo: null }),
    ];
    for (const f of FORMATOS) {
      const blob = await generarPdfEtiquetas(items, f, { mostrarPrecio: true, mostrarSku: true, negocio: "Miscelánea" });
      expect(blob.size).toBeGreaterThan(1000);
    }
  });
});
