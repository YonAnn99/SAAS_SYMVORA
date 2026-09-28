import { describe, expect, it } from "vitest";
import {
  buscarOpcion,
  categoriasDeProductos,
  componerValor,
  construirOpciones,
  descomponerValor,
  etiquetaVariante,
  filtrarPorCategoria,
  TODAS_CATEGORIAS,
} from "@/features/inventory/purchase-order-items";

const productos = [
  { id: "p-sueter", nombre: "sueter", costo_compra: 100, categoria: "Ropa" },
  { id: "p-cafe", nombre: "Café molido", costo_compra: 45, categoria: "Abarrotes" },
];

const variantes = [
  {
    id: "v-m-rojo",
    producto_id: "p-sueter",
    talla: "M",
    color: "ROJO",
    costo_compra: 60,
  },
];

describe("construirOpciones", () => {
  it("ofrece el producto y, debajo, cada variante", () => {
    const o = construirOpciones(productos, variantes);
    expect(o.map((x) => x.label)).toEqual([
      "sueter",
      "sueter · M / ROJO",
      "Café molido",
    ]);
  });

  it("el padre sigue disponible aunque tenga variantes", () => {
    // Hay compras que entran al stock general sin desglosar. Quitarlo
    // obligaría a inventarse una variante solo para poder pedir.
    const o = construirOpciones(productos, variantes);
    expect(o.some((x) => x.varianteId === null && x.productoId === "p-sueter"))
      .toBe(true);
  });

  it("un producto marcado con variantes pero SIN ninguna creada no añade filas", () => {
    // "Café molido" tiene `permite_variantes` en la base pero cero variantes.
    // Es el mismo caso que ya contempla el distintivo del punto de venta.
    const o = construirOpciones(productos, variantes);
    expect(o.filter((x) => x.productoId === "p-cafe")).toHaveLength(1);
  });

  it("la variante lleva SU costo, no el del padre", () => {
    // Usar el del padre valoraría mal la orden y, al recibir, escribiría el
    // costo equivocado en la variante.
    const o = construirOpciones(productos, variantes);
    expect(o.find((x) => x.varianteId === "v-m-rojo")?.costo).toBe(60);
    expect(o.find((x) => x.productoId === "p-sueter" && !x.varianteId)?.costo)
      .toBe(100);
  });

  it("se puede buscar por el nombre del padre y por la talla", () => {
    const o = construirOpciones(productos, variantes);
    const variante = o.find((x) => x.varianteId === "v-m-rojo")!;
    expect(variante.keywords.toLowerCase()).toContain("sueter");
    expect(variante.keywords.toLowerCase()).toContain("m");
    expect(variante.keywords.toLowerCase()).toContain("rojo");
  });

  it("sin variantes se comporta como la lista de siempre", () => {
    expect(construirOpciones(productos, [])).toHaveLength(2);
  });
});

describe("etiquetaVariante", () => {
  it("junta talla y color", () => {
    expect(etiquetaVariante({ talla: "M", color: "ROJO" })).toBe("M / ROJO");
  });

  it("con uno solo no deja la barra suelta", () => {
    expect(etiquetaVariante({ talla: "M", color: null })).toBe("M");
    expect(etiquetaVariante({ talla: null, color: "ROJO" })).toBe("ROJO");
  });

  it("sin talla ni color da algo legible, no una cadena vacía", () => {
    // Saldría como "sueter · " y parecería un fallo de la pantalla.
    expect(etiquetaVariante({ talla: null, color: null })).toBe("Variante");
  });
});

describe("componerValor / descomponerValor", () => {
  it("van y vuelven sin perder nada", () => {
    expect(descomponerValor(componerValor("p1", "v1"))).toEqual({
      productoId: "p1",
      varianteId: "v1",
    });
    expect(descomponerValor(componerValor("p1", null))).toEqual({
      productoId: "p1",
      varianteId: null,
    });
  });

  it("el producto suelto NO arrastra un id de variante vacío", () => {
    // Un `""` en vez de `null` acabaría insertándose como variante inexistente.
    expect(descomponerValor("p1").varianteId).toBeNull();
  });
});

describe("buscarOpcion", () => {
  it("distingue el padre de su variante", () => {
    const o = construirOpciones(productos, variantes);
    expect(buscarOpcion(o, "p-sueter", null)?.label).toBe("sueter");
    expect(buscarOpcion(o, "p-sueter", "v-m-rojo")?.label).toBe(
      "sueter · M / ROJO"
    );
  });

  it("devuelve undefined si la variante ya no existe", () => {
    // Pasa al editar una orden cuya variante se borró del catálogo.
    const o = construirOpciones(productos, variantes);
    expect(buscarOpcion(o, "p-sueter", "v-borrada")).toBeUndefined();
  });
});

describe("filtro por categoría", () => {
  it("lista las categorías sin repetir, sin vacías y en orden", () => {
    expect(
      categoriasDeProductos([
        ...productos,
        { id: "p-gorra", nombre: "gorra", costo_compra: 20, categoria: " Ropa " },
        { id: "p-x", nombre: "x", costo_compra: 1, categoria: null },
        { id: "p-y", nombre: "y", costo_compra: 1, categoria: "  " },
      ])
    ).toEqual(["Abarrotes", "Ropa"]);
  });

  it("las variantes heredan la categoría de su padre", () => {
    const o = construirOpciones(productos, variantes);
    const ropa = filtrarPorCategoria(o, "Ropa");
    expect(ropa.map((x) => x.label)).toEqual(["sueter", "sueter · M / ROJO"]);
  });

  it("con 'Todas' no filtra", () => {
    const o = construirOpciones(productos, variantes);
    expect(filtrarPorCategoria(o, TODAS_CATEGORIAS)).toBe(o);
  });
});
