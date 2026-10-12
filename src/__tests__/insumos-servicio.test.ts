import { describe, expect, it } from "vitest";
import {
  insumosDeLinea,
  insumosParaRpc,
  normalizarInsumos,
  textoInsumos,
  type InsumoLinea,
  type RecetasServicio,
} from "@/features/inventory/insumos";
import { useCartStore, cartLineKey } from "@/features/pos/stores/cart";

const vacuna: InsumoLinea = { productId: "vac", varianteId: null, cantidad: 1, nombre: "Vacuna" };
const jeringa: InsumoLinea = { productId: "jer", varianteId: null, cantidad: 2, nombre: "Jeringa" };
const recetas: RecetasServicio = new Map([["serv", [vacuna, jeringa]]]);

describe("insumos de una línea", () => {
  it("sin ajuste: la receta por la cantidad vendida", () => {
    expect(insumosDeLinea({ productId: "serv", cantidad: 3 }, recetas)).toEqual([
      { ...vacuna, cantidad: 3 },
      { ...jeringa, cantidad: 6 },
    ]);
  });

  it("con ajuste: lo ajustado, tal cual", () => {
    const ajuste = [{ ...vacuna, cantidad: 0.4 }];
    expect(insumosDeLinea({ productId: "serv", cantidad: 3, insumos: ajuste }, recetas)).toBe(ajuste);
  });

  it("ajustado a nada es una lista vacía, no la receta", () => {
    expect(insumosDeLinea({ productId: "serv", cantidad: 1, insumos: [] }, recetas)).toEqual([]);
  });

  it("sin receta: null", () => {
    expect(insumosDeLinea({ productId: "otro", cantidad: 1 }, recetas)).toBeNull();
  });
});

describe("normalizar y enviar", () => {
  it("une repetidos y quita ceros y basura", () => {
    expect(
      normalizarInsumos([
        { ...vacuna, cantidad: 0.1 },
        { ...vacuna, cantidad: 0.2 },
        { ...jeringa, cantidad: 0 },
        { ...jeringa, varianteId: "v1", cantidad: Number.NaN },
      ])
    ).toEqual([{ ...vacuna, cantidad: 0.3 }]);
  });

  it("al servidor no viajan los nombres", () => {
    expect(insumosParaRpc([vacuna])).toEqual([{ productId: "vac", varianteId: null, cantidad: 1 }]);
    expect(insumosParaRpc(undefined)).toBeUndefined();
    expect(insumosParaRpc(null)).toBeUndefined();
  });

  it("texto corto para el carrito", () => {
    expect(textoInsumos([vacuna, jeringa])).toBe("1 Vacuna · 2 Jeringa");
    expect(textoInsumos([])).toBe("Sin insumos");
  });
});

describe("carrito", () => {
  it("al cambiar la cantidad, los insumos ajustados se escalan", () => {
    const store = useCartStore.getState();
    store.clearCart();
    store.addItem({
      productId: "serv",
      varianteId: null,
      nombre: "Consulta",
      cantidad: 1,
      precioUnitario: 300,
      unidad_medida: "SERVICIO",
    });
    const clave = cartLineKey("serv", null);
    store.updateInsumos(clave, [{ ...vacuna, cantidad: 0.5 }]);
    useCartStore.getState().updateQuantity(clave, 3);
    expect(useCartStore.getState().items[0].insumos).toEqual([{ ...vacuna, cantidad: 1.5 }]);
    useCartStore.getState().updateInsumos(clave, null);
    expect(useCartStore.getState().items[0].insumos).toBeNull();
    useCartStore.getState().clearCart();
  });
});
