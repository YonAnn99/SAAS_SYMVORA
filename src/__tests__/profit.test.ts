import { describe, expect, it } from "vitest";
import {
  calcularGanancia,
  calcularMargenProducto,
  gananciaPorProducto,
  type SaleLineForProfit,
} from "@/lib/profit";

describe("calcularMargenProducto", () => {
  it("distingue margen de markup, que no son lo mismo", () => {
    // El caso que más se confunde: $15 con costo $10 NO es "50% de ganancia"
    // en el sentido que la gente suele entender.
    const r = calcularMargenProducto(15, 10)!;
    expect(r.gananciaUnitaria).toBe(5);
    expect(r.margenPct).toBe(33.33); // de cada $100 que entran, $33 son míos
    expect(r.markupPct).toBe(50); // le gano 50% sobre lo que me costó
    expect(r.esPerdida).toBe(false);
  });

  it("marca pérdida cuando el costo iguala o supera al precio", () => {
    expect(calcularMargenProducto(10, 10)!.esPerdida).toBe(true);
    const perdida = calcularMargenProducto(10, 12)!;
    expect(perdida.esPerdida).toBe(true);
    expect(perdida.gananciaUnitaria).toBe(-2);
    expect(perdida.margenPct).toBe(-20);
  });

  it("sin costo capturado devuelve null en vez de fingir 100%", () => {
    expect(calcularMargenProducto(15, null)).toBeNull();
    expect(calcularMargenProducto(15, undefined)).toBeNull();
  });

  it("con precio cero no inventa un margen", () => {
    expect(calcularMargenProducto(0, 10)).toBeNull();
  });

  it("con costo cero da 100% de margen sin propagar Infinity al markup", () => {
    const r = calcularMargenProducto(15, 0)!;
    expect(r.margenPct).toBe(100);
    expect(Number.isFinite(r.markupPct)).toBe(true);
  });
});

describe("calcularGanancia", () => {
  const linea = (o: Partial<SaleLineForProfit> = {}): SaleLineForProfit => ({
    cantidad: 2,
    subtotal: 30, // 2 x $15, pre-IVA
    descuento: 0,
    costo_unitario: 10,
    producto_id: "p1",
    ...o,
  });

  it("resta el costo de lo vendido al ingreso", () => {
    const r = calcularGanancia([linea()]);
    expect(r.ingresos).toBe(30);
    expect(r.costoVendido).toBe(20);
    expect(r.ganancia).toBe(10);
    expect(r.margenPct).toBe(33.33);
  });

  it("el descuento reduce el ingreso, no el costo", () => {
    // Un descuento sale del bolsillo del negocio: el proveedor cobra igual.
    const r = calcularGanancia([linea({ descuento: 6 })]);
    expect(r.ingresos).toBe(24);
    expect(r.costoVendido).toBe(20);
    expect(r.ganancia).toBe(4);
  });

  it("NUNCA toma el IVA como ingreso", () => {
    // La línea es pre-IVA (30). Si alguien pasara el total con IVA (34.80),
    // la ganancia saldría inflada. Este test fija la expectativa.
    const conIva = 30 * 1.16;
    const r = calcularGanancia([linea()]);
    expect(r.ingresos).toBe(30);
    expect(r.ingresos).not.toBeCloseTo(conIva);
    expect(r.ganancia).toBe(10);
  });

  it("excluye por completo las líneas sin costo, no las cuenta como ganancia pura", () => {
    const r = calcularGanancia([
      linea(),
      linea({ costo_unitario: null, producto_id: "p2" }),
    ]);

    // Lo crítico: el ingreso de la línea sin costo TAMPOCO entra. Incluirlo
    // sin su costo daría un margen artificialmente alto.
    expect(r.ingresos).toBe(30);
    expect(r.ganancia).toBe(10);
    expect(r.lineasComputadas).toBe(1);
    expect(r.lineasSinCosto).toBe(1);
    expect(r.productosSinCosto).toEqual(["p2"]);
  });

  it("un costo de cero SÍ se computa (es distinto de no tener costo)", () => {
    const r = calcularGanancia([linea({ costo_unitario: 0 })]);
    expect(r.lineasComputadas).toBe(1);
    expect(r.lineasSinCosto).toBe(0);
    expect(r.ganancia).toBe(30);
  });

  it("refleja ganancia negativa cuando se vendió por debajo del costo", () => {
    const r = calcularGanancia([linea({ costo_unitario: 20 })]);
    expect(r.ganancia).toBe(-10);
    expect(r.margenPct).toBe(-33.33);
  });

  it("sin líneas devuelve ceros sin dividir entre cero", () => {
    const r = calcularGanancia([]);
    expect(r.ganancia).toBe(0);
    expect(r.margenPct).toBe(0);
  });
});

describe("gananciaPorProducto", () => {
  it("ordena por lo que más deja, no por lo que más factura", () => {
    const lineas: SaleLineForProfit[] = [
      // Factura mucho pero deja poco (margen 5%)
      { cantidad: 1, subtotal: 1000, descuento: 0, costo_unitario: 950, producto_id: "caro" },
      // Factura menos pero deja más (margen 50%)
      { cantidad: 1, subtotal: 200, descuento: 0, costo_unitario: 100, producto_id: "rentable" },
    ];

    const ranking = gananciaPorProducto(lineas);
    expect(ranking[0].productoId).toBe("rentable");
    expect(ranking[0].ganancia).toBe(100);
    expect(ranking[1].productoId).toBe("caro");
    expect(ranking[1].ganancia).toBe(50);
  });

  it("acumula varias líneas del mismo producto", () => {
    const l: SaleLineForProfit = {
      cantidad: 2,
      subtotal: 30,
      descuento: 0,
      costo_unitario: 10,
      producto_id: "p1",
    };
    const ranking = gananciaPorProducto([l, l]);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].ganancia).toBe(20);
    expect(ranking[0].cantidad).toBe(4);
  });

  it("omite los productos sin costo del ranking", () => {
    const ranking = gananciaPorProducto([
      { cantidad: 1, subtotal: 50, descuento: 0, costo_unitario: null, producto_id: "sin" },
    ]);
    expect(ranking).toHaveLength(0);
  });
});
