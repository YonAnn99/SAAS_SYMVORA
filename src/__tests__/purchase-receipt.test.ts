import { describe, expect, it } from "vitest";
import {
  construirItems,
  parsearCantidadRecibida,
  pendientePorLinea,
  quedaPendiente,
  tasaIvaDeOrden,
  totalesRecepcion,
} from "@/features/inventory/purchase-receipt";

const linea = (o: Partial<{
  id: string;
  producto_id: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  costo_unitario: number;
}> = {}) => ({
  id: "d1",
  producto_id: "p1",
  cantidad_solicitada: 10,
  cantidad_recibida: 0,
  costo_unitario: 25,
  ...o,
});

describe("pendientePorLinea", () => {
  it("lo pedido menos lo ya recibido", () => {
    expect(pendientePorLinea(linea({ cantidad_recibida: 4 }))).toBe(6);
  });

  it("recibido de más no produce un pendiente negativo", () => {
    // Pasa si se corrigió la orden a la baja después de una entrega. Un
    // pendiente negativo restaría del total de la siguiente recepción.
    expect(pendientePorLinea(linea({ cantidad_recibida: 12 }))).toBe(0);
  });
});

describe("parsearCantidadRecibida", () => {
  it("rechaza recibir más de lo pendiente", () => {
    // EL DEFECTO QUE EVITA: el RPC no lo comprueba. Aceptaría recibir 100 de
    // una orden de 10 y sumaría 100 al stock.
    const r = parsearCantidadRecibida("11", 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("10");
  });

  it("acepta exactamente lo pendiente", () => {
    expect(parsearCantidadRecibida("10", 10)).toEqual({ ok: true, valor: 10 });
  });

  it("el campo vacío es cero, no un error", () => {
    // Es el caso de "este producto no llegó en esta entrega".
    expect(parsearCantidadRecibida("", 10)).toEqual({ ok: true, valor: 0 });
  });

  it("rechaza negativos y texto", () => {
    expect(parsearCantidadRecibida("-3", 10).ok).toBe(false);
    expect(parsearCantidadRecibida("dos cajas", 10).ok).toBe(false);
  });

  it("acepta decimales: hay productos por kilo", () => {
    expect(parsearCantidadRecibida("2.5", 10)).toEqual({ ok: true, valor: 2.5 });
  });
});

describe("construirItems", () => {
  it("omite las líneas en cero", () => {
    // Mandarlas haría un UPDATE que suma 0 y, peor, el RPC las contaría al
    // decidir si la orden queda parcial o total.
    const items = construirItems([
      { detalle_id: "a", cantidad_recibida: 3, costo_unitario: 10 },
      { detalle_id: "b", cantidad_recibida: 0, costo_unitario: 10 },
    ]);
    expect(items).toEqual([{ detalle_id: "a", cantidad_recibida: 3 }]);
  });

  it("no manda el costo: el RPC lo lee de la orden", () => {
    // Si el costo viajara desde el cliente, se podría alterar lo que se paga.
    const items = construirItems([
      { detalle_id: "a", cantidad_recibida: 1, costo_unitario: 99 },
    ]);
    expect(items[0]).not.toHaveProperty("costo_unitario");
  });
});

describe("tasaIvaDeOrden y totalesRecepcion", () => {
  it("usa la tasa de la orden, no un 16% fijo", () => {
    // Una orden guardada con otra tasa debe generar una compra que cuadre con
    // ella, no con el 16% que usa el diálogo de creación.
    const tasa = tasaIvaDeOrden({ subtotal: 100, impuesto: 8 });
    expect(tasa).toBeCloseTo(0.08);
    const t = totalesRecepcion(
      [{ detalle_id: "a", cantidad_recibida: 2, costo_unitario: 50 }],
      tasa
    );
    expect(t).toEqual({ subtotal: 100, impuesto: 8, total: 108 });
  });

  it("subtotal 0 no produce NaN", () => {
    // `impuesto / 0` sería NaN y acabaría escrito como importe en la compra.
    expect(tasaIvaDeOrden({ subtotal: 0, impuesto: 0 })).toBe(0);
  });

  it("solo cuenta lo recibido en esta entrega", () => {
    const t = totalesRecepcion(
      [
        { detalle_id: "a", cantidad_recibida: 1, costo_unitario: 100 },
        { detalle_id: "b", cantidad_recibida: 0, costo_unitario: 500 },
      ],
      0.16
    );
    expect(t.subtotal).toBe(100);
  });

  it("redondea a dos decimales, como la columna", () => {
    const t = totalesRecepcion(
      [{ detalle_id: "a", cantidad_recibida: 3, costo_unitario: 33.33 }],
      0.16
    );
    expect(t.subtotal).toBe(99.99);
    expect(t.impuesto).toBe(16);
  });
});

describe("quedaPendiente", () => {
  it("recibir todo lo pendiente cierra la orden", () => {
    expect(
      quedaPendiente([{ ...linea(), recibirAhora: 10 }])
    ).toBe(false);
  });

  it("recibir de menos la deja abierta", () => {
    expect(quedaPendiente([{ ...linea(), recibirAhora: 4 }])).toBe(true);
  });

  it("recibir en dos tandas acumula y cierra al final", () => {
    // Primera entrega: 4 de 10 → sigue pendiente.
    expect(quedaPendiente([{ ...linea(), recibirAhora: 4 }])).toBe(true);
    // Segunda: ya hay 4 recibidos, llegan 6 → completa.
    expect(
      quedaPendiente([
        { ...linea({ cantidad_recibida: 4 }), recibirAhora: 6 },
      ])
    ).toBe(false);
  });

  it("una línea intacta mantiene la orden abierta aunque otra se complete", () => {
    expect(
      quedaPendiente([
        { ...linea({ id: "a" }), recibirAhora: 10 },
        { ...linea({ id: "b" }), recibirAhora: 0 },
      ])
    ).toBe(true);
  });
});
