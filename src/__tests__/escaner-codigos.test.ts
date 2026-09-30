import { describe, expect, it } from "vitest";
import { resolverCodigo } from "@/features/pos/hooks/use-barcode-scanner";
import { crearFiltroRepetidos } from "@/lib/escaner/repetidos";
import type { Producto } from "@/lib/types/database";
import type { VarianteProducto } from "@/features/pos/types/pos.types";

const producto = (id: string, codigo: string | null) =>
  ({ id, nombre: `Producto ${id}`, codigo_barras: codigo }) as unknown as Producto;

const variante = (id: string, productoId: string, codigo: string | null): VarianteProducto => ({
  id,
  producto_id: productoId,
  talla: "M",
  color: null,
  precio_venta: 0,
  stock_actual: 5,
  codigo_barras: codigo,
});

describe("resolverCodigo", () => {
  const productos = [producto("coca", "7501055300075"), producto("playera", "PLAY-01")];
  const variantes = { playera: [variante("playera-m", "playera", "PLAY-01-M")] };

  it("encuentra el producto por su código", () => {
    expect(resolverCodigo("7501055300075", productos, variantes)).toEqual({
      product: productos[0],
      variant: null,
    });
  });

  it("sin distinguir mayúsculas ni espacios de los extremos", () => {
    expect(resolverCodigo("  play-01 ", productos, variantes)?.product.id).toBe("playera");
  });

  it("una variante con código propio entra directo", () => {
    const r = resolverCodigo("PLAY-01-M", productos, variantes);
    expect(r?.product.id).toBe("playera");
    expect(r?.variant?.id).toBe("playera-m");
  });

  it("sin coincidencia (o vacío) da null", () => {
    expect(resolverCodigo("000", productos, variantes)).toBeNull();
    expect(resolverCodigo("   ", productos, variantes)).toBeNull();
  });
});

describe("crearFiltroRepetidos", () => {
  it("deja pasar un código nuevo y frena el mismo mientras sigue a la vista", () => {
    const pasa = crearFiltroRepetidos(1500);
    expect(pasa("A", 0)).toBe(true);
    expect(pasa("A", 500)).toBe(false);
    expect(pasa("A", 1900)).toBe(false); // seguía frente a la cámara
    expect(pasa("A", 3500)).toBe(true); // se retiró y volvió
  });

  it("otro código pasa de inmediato", () => {
    const pasa = crearFiltroRepetidos(1500);
    expect(pasa("A", 0)).toBe(true);
    expect(pasa("B", 100)).toBe(true);
    expect(pasa("A", 200)).toBe(true);
  });
});
