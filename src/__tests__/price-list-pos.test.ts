import { describe, expect, it } from "vitest";
import {
  construirMapaLista,
  estaEnLista,
  filtrarCatalogoPorLista,
  precioConLista,
} from "@/features/pos/price-list-pos";

/**
 * Estos test fijan la regla de precio del punto de venta contra la del
 * servidor (`_crear_venta_desde_items`, migracion 068). Si alguien cambia una
 * sola de las dos, el cajero veria un precio y el cliente pagaria otro.
 */

const SUETER = "p-sueter";
const CAFE = "p-cafe";
const M_ROJO = "v-m-rojo";
const M_AZUL = "v-m-azul";

describe("precioConLista", () => {
  it("sin lista seleccionada devuelve el precio base", () => {
    expect(precioConLista(500, null, SUETER, null)).toBe(500);
  });

  it("un producto de la lista se cobra al precio de la lista", () => {
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: null, precio: 400 },
    ]);
    expect(precioConLista(500, mapa, SUETER, null)).toBe(400);
  });

  it("un producto que NO esta en la lista conserva su precio base", () => {
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: null, precio: 400 },
    ]);
    expect(precioConLista(60, mapa, CAFE, null)).toBe(60);
  });

  it("un renglon sin precio definido deja el precio base, no lo regala", () => {
    const mapa = construirMapaLista([
      { producto_id: CAFE, variante_id: null, precio: null },
    ]);
    expect(precioConLista(60, mapa, CAFE, null)).toBe(60);
  });

  it("un precio de 0 en la lista SI se respeta: cortesia no es 'sin definir'", () => {
    // Con `||` en vez de `??` esto devolveria 60 y se le cobraria al cliente
    // un producto que el dueno marco como regalo.
    const mapa = construirMapaLista([
      { producto_id: CAFE, variante_id: null, precio: 0 },
    ]);
    expect(precioConLista(60, mapa, CAFE, null)).toBe(0);
  });

  it("la variante usa SU precio de lista, no el del producto padre", () => {
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: null, precio: 400 },
      { producto_id: SUETER, variante_id: M_ROJO, precio: 64 },
    ]);
    expect(precioConLista(80, mapa, SUETER, M_ROJO)).toBe(64);
  });

  it("una variante fuera de la lista no hereda el precio de lista del padre", () => {
    // El padre esta rebajado a 400, pero la talla AZUL no se metio en la
    // liquidacion: tiene que seguir costando sus 80.
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: null, precio: 400 },
    ]);
    expect(precioConLista(80, mapa, SUETER, M_AZUL)).toBe(80);
  });

  it("el producto suelto y su variante son filas distintas", () => {
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: M_ROJO, precio: 64 },
    ]);
    expect(precioConLista(500, mapa, SUETER, null)).toBe(500);
    expect(precioConLista(80, mapa, SUETER, M_ROJO)).toBe(64);
  });
});

describe("estaEnLista", () => {
  it("un renglon sin precio definido SIGUE perteneciendo a la lista", () => {
    // Importa para el filtrado del catalogo: el producto debe verse aunque
    // todavia no le hayan puesto precio propio.
    const mapa = construirMapaLista([
      { producto_id: CAFE, variante_id: null, precio: null },
    ]);
    expect(estaEnLista(mapa, CAFE, null)).toBe(true);
  });

  it("sin lista no pertenece nada", () => {
    expect(estaEnLista(null, CAFE, null)).toBe(false);
  });
});

describe("filtrarCatalogoPorLista", () => {
  const productos = [{ id: SUETER }, { id: CAFE }];
  const variantes = {
    [SUETER]: [
      { id: M_ROJO, producto_id: SUETER },
      { id: M_AZUL, producto_id: SUETER },
    ],
  };

  it("sin lista seleccionada devuelve el catalogo entero", () => {
    expect(filtrarCatalogoPorLista(productos, variantes, null)).toHaveLength(2);
  });

  it("deja fuera los productos que no estan en la lista", () => {
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: null, precio: 400 },
    ]);
    expect(
      filtrarCatalogoPorLista(productos, variantes, mapa).map((p) => p.id)
    ).toEqual([SUETER]);
  });

  it("conserva el producto si SOLO una de sus variantes esta en la lista", () => {
    // Sin esto, meter la talla M en la liquidacion la volveria inalcanzable:
    // el sueter desapareceria de la cuadricula y no habria por donde abrir el
    // dialogo de tallas.
    const mapa = construirMapaLista([
      { producto_id: SUETER, variante_id: M_ROJO, precio: 64 },
    ]);
    expect(
      filtrarCatalogoPorLista(productos, variantes, mapa).map((p) => p.id)
    ).toEqual([SUETER]);
  });

  it("una lista vacia deja la cuadricula vacia, no el catalogo entero", () => {
    // `new Map()` es distinto de `null`: hay lista elegida, pero sin nada
    // dentro. Devolver todo el catalogo aqui cobraria precios base creyendo
    // que son de lista.
    const mapa = construirMapaLista([]);
    expect(filtrarCatalogoPorLista(productos, variantes, mapa)).toHaveLength(0);
  });
});
