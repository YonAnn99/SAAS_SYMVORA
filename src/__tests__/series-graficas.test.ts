import { describe, expect, it } from "vitest";
import {
  agrupacionDe,
  alinearComparacion,
  groupSalesByPeriod,
  ingresosYGananciaPorPeriodo,
  ventasPorCategoria,
  ventasPorDiaSemana,
  ventasPorHora,
} from "@/features/reports/series-graficas";
import { calcularGanancia } from "@/lib/profit";

/** ISO de una fecha en hora LOCAL: las series agrupan con la hora del navegador. */
function local(anio: number, mes: number, dia: number, hora = 12): string {
  return new Date(anio, mes - 1, dia, hora).toISOString();
}

describe("ventasPorHora", () => {
  it("suma total y numero de ventas en su hora, con 24 cubetas", () => {
    const filas = ventasPorHora([
      { fecha_venta: local(2026, 10, 5, 9), total: 100 },
      { fecha_venta: local(2026, 10, 6, 9), total: 50 },
      { fecha_venta: local(2026, 10, 6, 18), total: 30 },
    ]);
    expect(filas).toHaveLength(24);
    expect(filas[9]).toEqual({ hora: "09:00", total: 150, ventas: 2 });
    expect(filas[18]).toEqual({ hora: "18:00", total: 30, ventas: 1 });
    expect(filas[0]).toEqual({ hora: "00:00", total: 0, ventas: 0 });
  });
});

describe("ventasPorDiaSemana", () => {
  it("empieza en lunes y pone el domingo al final", () => {
    const filas = ventasPorDiaSemana([
      { fecha_venta: local(2026, 10, 5), total: 100 }, // lunes
      { fecha_venta: local(2026, 10, 11), total: 40 }, // domingo
      { fecha_venta: local(2026, 10, 12), total: 10 }, // lunes
    ]);
    expect(filas.map((f) => f.dia)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
    expect(filas[0]).toEqual({ dia: "Lun", total: 110, ventas: 2 });
    expect(filas[6]).toEqual({ dia: "Dom", total: 40, ventas: 1 });
  });
});

describe("agrupacionDe", () => {
  it("sigue la regla de Reportes", () => {
    const d = (dia: number) => new Date(2026, 9, dia);
    expect(agrupacionDe(true, d(1), d(1))).toBe("hour");
    expect(agrupacionDe(false, d(1), d(7))).toBe("day");
    expect(agrupacionDe(false, d(1), d(31))).toBe("week");
    expect(agrupacionDe(false, new Date(2025, 9, 1), d(1))).toBe("month");
  });
});

describe("groupSalesByPeriod", () => {
  it("una cubeta por dia, con ceros donde no hubo ventas", () => {
    const serie = groupSalesByPeriod(
      [
        { fecha_venta: local(2026, 10, 5), total: 100 },
        { fecha_venta: local(2026, 10, 5, 18), total: 20 },
        { fecha_venta: local(2026, 10, 7), total: 5 },
      ],
      new Date(2026, 9, 5),
      new Date(2026, 9, 7),
      "day"
    );
    expect(serie.map((c) => c.ventas)).toEqual([120, 0, 5]);
  });
});

describe("ingresosYGananciaPorPeriodo", () => {
  const ventas = [
    { id: "a", fecha_venta: local(2026, 10, 5), total: 116 },
    { id: "b", fecha_venta: local(2026, 10, 6), total: 58 },
  ];
  const detalle = [
    { venta_id: "a", cantidad: 2, subtotal: 100, descuento: 10, costo_unitario: 30, producto_id: "p1" },
    // Sin costo: no entra ni su ingreso ni su costo.
    { venta_id: "a", cantidad: 1, subtotal: 40, descuento: 0, costo_unitario: null, producto_id: "p2" },
    { venta_id: "b", cantidad: 1, subtotal: 50, descuento: 0, costo_unitario: 20, producto_id: "p1" },
    // Linea de una venta que no esta en el periodo: se ignora.
    { venta_id: "zzz", cantidad: 1, subtotal: 999, descuento: 0, costo_unitario: 1 },
  ];

  it("usa subtotal menos descuento y excluye lineas sin costo", () => {
    const serie = ingresosYGananciaPorPeriodo(
      ventas,
      detalle,
      new Date(2026, 9, 5),
      new Date(2026, 9, 6),
      "day"
    );
    expect(serie.map(({ ingresos, ganancia }) => ({ ingresos, ganancia }))).toEqual([
      { ingresos: 90, ganancia: 30 },
      { ingresos: 50, ganancia: 30 },
    ]);
  });

  it("la suma de la serie cuadra con la tarjeta de ganancia", () => {
    const serie = ingresosYGananciaPorPeriodo(
      ventas,
      detalle.filter((l) => l.venta_id !== "zzz"),
      new Date(2026, 9, 5),
      new Date(2026, 9, 6),
      "day"
    );
    const tarjeta = calcularGanancia(detalle.filter((l) => l.venta_id !== "zzz"));
    expect(serie.reduce((s, c) => s + c.ingresos, 0)).toBe(tarjeta.ingresos);
    expect(serie.reduce((s, c) => s + c.ganancia, 0)).toBe(tarjeta.ganancia);
  });
});

describe("alinearComparacion", () => {
  it("rellena con ceros o recorta al largo actual", () => {
    expect(alinearComparacion(4, [1, 2])).toEqual([1, 2, 0, 0]);
    expect(alinearComparacion(2, [1, 2, 3])).toEqual([1, 2]);
    expect(alinearComparacion(0, [1])).toEqual([]);
  });
});

describe("ventasPorCategoria", () => {
  const linea = (producto_id: string, subtotal: number, descuento = 0) => ({
    producto_id,
    subtotal,
    descuento,
  });

  it("agrupa por id de producto, no por nombre, y resta el descuento", () => {
    // Dos productos con el mismo nombre en categorias distintas.
    const productos = [
      { id: "p1", nombre: "Leche", categoria: "Lácteos" },
      { id: "p2", nombre: "Leche", categoria: "Bebidas" },
    ];
    expect(
      ventasPorCategoria([linea("p1", 100, 10), linea("p2", 50), linea("p1", 20)], productos)
    ).toEqual([
      { name: "Lácteos", value: 110 },
      { name: "Bebidas", value: 50 },
    ]);
  });

  it("los productos sin categoria (o desconocidos) van a Sin categoría", () => {
    const productos = [
      { id: "p1", categoria: null },
      { id: "p2", categoria: "  " },
    ];
    expect(
      ventasPorCategoria([linea("p1", 10), linea("p2", 5), linea("borrado", 1)], productos)
    ).toEqual([{ name: "Sin categoría", value: 16 }]);
  });

  it("junta en Otras desde la sexta categoria y la suma no cambia", () => {
    const productos = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, categoria: `C${i}` }));
    const detalle = productos.map((p, i) => linea(p.id, 70 - i * 10)); // 70, 60, ... 10
    const serie = ventasPorCategoria(detalle, productos);
    expect(serie.map((c) => c.name)).toEqual(["C0", "C1", "C2", "C3", "C4", "Otras"]);
    expect(serie[5].value).toBe(20 + 10);
    const total = detalle.reduce((s, l) => s + l.subtotal - l.descuento, 0);
    expect(serie.reduce((s, c) => s + c.value, 0)).toBe(total);
  });

  it("sin ventas, sin categorias", () => {
    expect(ventasPorCategoria([], [{ id: "p1", categoria: "X" }])).toEqual([]);
  });
});
