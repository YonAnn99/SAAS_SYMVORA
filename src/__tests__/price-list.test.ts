import { describe, expect, it } from "vitest";
import {
  aplicarPorcentaje,
  claveFila,
  contarSinPrecio,
  parsearPrecio,
  precioEfectivo,
} from "@/features/inventory/price-list";
import { formatMXN } from "@/lib/money";

describe("aplicarPorcentaje", () => {
  it("aumenta y disminuye sobre el precio base", () => {
    expect(aplicarPorcentaje(70, 20, "aumentar")).toEqual({ ok: true, precio: 84 });
    expect(aplicarPorcentaje(70, 20, "disminuir")).toEqual({ ok: true, precio: 56 });
  });

  it("NO compone al aplicarlo dos veces", () => {
    // EL DEFECTO QUE EVITA: si el porcentaje partiera del precio que ya tiene la
    // lista, corregir un descuento del 20% dos veces dejaría 320 en vez de 400.
    // Quien rectifica espera volver al mismo sitio, no acumular.
    const primera = aplicarPorcentaje(500, 20, "disminuir");
    const segunda = aplicarPorcentaje(500, 20, "disminuir");
    expect(primera).toEqual(segunda);
    expect(primera).toEqual({ ok: true, precio: 400 });
  });

  it("redondea a dos decimales, como la columna de la base", () => {
    expect(aplicarPorcentaje(33.33, 15, "aumentar")).toEqual({
      ok: true,
      precio: 38.33,
    });
  });

  it("con 'redondear a enteros' no deja decimales", () => {
    const r = aplicarPorcentaje(33.33, 15, "aumentar", true);
    expect(r).toEqual({ ok: true, precio: 38 });
    if (r.ok) expect(Number.isInteger(r.precio)).toBe(true);
  });

  it("un descuento de más del 100% se rechaza", () => {
    // Dejaría el precio en negativo y el punto de venta cobraría al revés.
    expect(aplicarPorcentaje(100, 120, "disminuir").ok).toBe(false);
    // Aumentar más del 100% sí es legítimo: duplicar un precio.
    expect(aplicarPorcentaje(100, 120, "aumentar")).toEqual({
      ok: true,
      precio: 220,
    });
  });

  it("el 100% de descuento deja el producto en cero, no falla", () => {
    expect(aplicarPorcentaje(80, 100, "disminuir")).toEqual({ ok: true, precio: 0 });
  });

  it("rechaza porcentajes negativos y texto", () => {
    expect(aplicarPorcentaje(100, -5, "aumentar").ok).toBe(false);
    expect(aplicarPorcentaje(100, Number("abc"), "aumentar").ok).toBe(false);
  });

  it("la variante lleva su propio precio base", () => {
    // Caso real del catálogo: sueter $500 con su variante M/ROJO a $80. Un -20%
    // debe dar 400 y 64, no 400 en las dos.
    expect(aplicarPorcentaje(500, 20, "disminuir")).toEqual({ ok: true, precio: 400 });
    expect(aplicarPorcentaje(80, 20, "disminuir")).toEqual({ ok: true, precio: 64 });
  });
});

describe("precioEfectivo", () => {
  it("sin precio en la lista se vende al precio normal", () => {
    expect(precioEfectivo(250, null)).toBe(250);
  });

  it("un precio de CERO no cae al precio base", () => {
    // EL DEFECTO QUE EVITA: con `||` en vez de `??`, un producto de cortesía a
    // $0 se cobraría a precio completo. `null` es "no definido"; 0 es cero pesos.
    expect(precioEfectivo(250, 0)).toBe(0);
  });

  it("el precio de la lista pisa al base", () => {
    expect(precioEfectivo(250, 199.9)).toBe(199.9);
  });
});

describe("contarSinPrecio", () => {
  it("cuenta solo las filas sin precio definido", () => {
    expect(
      contarSinPrecio([{ precio: null }, { precio: 0 }, { precio: 10 }, { precio: null }])
    ).toBe(2);
  });
});

describe("claveFila", () => {
  it("el producto suelto y su variante son filas distintas", () => {
    expect(claveFila("p1", null)).not.toBe(claveFila("p1", "v1"));
  });

  it("la misma pareja da siempre la misma clave", () => {
    expect(claveFila("p1", "v1")).toBe(claveFila("p1", "v1"));
  });
});

describe("parsearPrecio", () => {
  it("acepta un precio con decimales", () => {
    expect(parsearPrecio("199.90")).toEqual({ ok: true, precio: 199.9 });
  });

  it("acepta cero: hay productos de cortesía", () => {
    expect(parsearPrecio("0")).toEqual({ ok: true, precio: 0 });
  });

  it("rechaza vacío, negativo y texto", () => {
    expect(parsearPrecio("").ok).toBe(false);
    expect(parsearPrecio("-5").ok).toBe(false);
    expect(parsearPrecio("barato").ok).toBe(false);
  });
});

describe("formatMXN", () => {
  it("agrupa los millares, que es para lo que existe", () => {
    // El patrón dominante del repo (`$${n.toFixed(2)}`) daría "$1234.50".
    expect(formatMXN(1234.5)).toContain("1,234.50");
  });
});
