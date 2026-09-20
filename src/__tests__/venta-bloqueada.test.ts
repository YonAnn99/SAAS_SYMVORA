import { describe, expect, it } from "vitest";
import {
  motivoBloqueoCobro,
  type EstadoCobro,
} from "@/features/pos/venta-bloqueada";

/**
 * Estos test cubren la unica fuente de verdad sobre cuando el boton de cobrar
 * debe estar apagado. Existe porque la condicion vivia duplicada en linea (una
 * vez para escritorio y otra para la hoja movil), y esa duplicacion dejo
 * sobrevivir durante semanas un bloqueo obsoleto sin que nadie lo notara.
 *
 * Los casos de "sin conexion" se retiraron con el modo sin conexion
 * (2026-09-20): cobrar exige internet, asi que no hay nada que decidir.
 */

const BASE: EstadoCobro = {
  items: 2,
  metodoPago: "EFECTIVO",
  procesando: false,
  montoInsuficiente: false,
};

describe("motivoBloqueoCobro", () => {
  it("deja cobrar cuando no hay ningun impedimento", () => {
    expect(motivoBloqueoCobro(BASE)).toBeNull();
  });

  it("deja cobrar con cualquier metodo de pago", () => {
    // Ya no hay metodos vetados: el veto existia solo sin conexion, porque el
    // cajero no podia confirmar terminal, credito ni transferencia.
    for (const metodo of [
      "EFECTIVO",
      "TARJETA",
      "TRANSFERENCIA",
      "CREDITO",
      "TARJETA_TERMINAL",
    ]) {
      expect(motivoBloqueoCobro({ ...BASE, metodoPago: metodo })).toBeNull();
    }
  });

  it("bloquea con el carrito vacio", () => {
    expect(motivoBloqueoCobro({ ...BASE, items: 0 })).toBe("sin-productos");
  });

  it("bloquea si todavia no se eligio metodo de pago", () => {
    expect(motivoBloqueoCobro({ ...BASE, metodoPago: "" })).toBe("sin-metodo");
  });

  it("bloquea mientras la venta se esta procesando", () => {
    expect(motivoBloqueoCobro({ ...BASE, procesando: true })).toBe("procesando");
  });

  it("bloquea si lo recibido no cubre el total", () => {
    expect(motivoBloqueoCobro({ ...BASE, montoInsuficiente: true })).toBe(
      "monto-insuficiente"
    );
  });

  it("el carrito vacio manda sobre el resto de motivos", () => {
    // El orden importa para el mensaje: decirle al cajero "elige un metodo de
    // pago" con el carrito vacio seria confuso.
    expect(
      motivoBloqueoCobro({ ...BASE, items: 0, metodoPago: "" })
    ).toBe("sin-productos");
  });
});
