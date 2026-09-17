import { describe, expect, it } from "vitest";
import {
  metodoDisponible,
  motivoBloqueoCobro,
  type EstadoCobro,
} from "@/features/pos/venta-bloqueada";

/**
 * El fallo que previenen estos test: el boton de cobrar estaba deshabilitado
 * con `!isOnline`, asi que sin conexion no se podia vender. La cola de ventas
 * offline existia entera (IndexedDB, clave de idempotencia, sincronizacion
 * automatica) pero era inalcanzable desde la pantalla.
 */

const BASE: EstadoCobro = {
  items: 2,
  metodoPago: "EFECTIVO",
  procesando: false,
  montoInsuficiente: false,
  isOnline: true,
};

describe("motivoBloqueoCobro", () => {
  it("con todo en orden y conexion, deja cobrar", () => {
    expect(motivoBloqueoCobro(BASE)).toBeNull();
  });

  it("sin conexion deja cobrar en efectivo", () => {
    expect(
      motivoBloqueoCobro({ ...BASE, isOnline: false, metodoPago: "EFECTIVO" })
    ).toBeNull();
  });

  it("sin conexion deja cobrar con tarjeta manual", () => {
    expect(
      motivoBloqueoCobro({ ...BASE, isOnline: false, metodoPago: "TARJETA" })
    ).toBeNull();
  });

  it.each(["TRANSFERENCIA", "CREDITO", "TARJETA_TERMINAL"])(
    "sin conexion bloquea %s, que necesita servidor",
    (metodo) => {
      expect(
        motivoBloqueoCobro({ ...BASE, isOnline: false, metodoPago: metodo })
      ).toBe("metodo-no-disponible-sin-conexion");
    }
  );

  it.each(["TRANSFERENCIA", "CREDITO", "TARJETA_TERMINAL"])(
    "con conexion NO bloquea %s",
    (metodo) => {
      expect(
        motivoBloqueoCobro({ ...BASE, isOnline: true, metodoPago: metodo })
      ).toBeNull();
    }
  );

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
      motivoBloqueoCobro({
        ...BASE,
        items: 0,
        metodoPago: "",
        isOnline: false,
      })
    ).toBe("sin-productos");
  });
});

describe("metodoDisponible", () => {
  it("con conexion todos los metodos estan disponibles", () => {
    for (const metodo of [
      "EFECTIVO",
      "TARJETA",
      "TRANSFERENCIA",
      "CREDITO",
      "TARJETA_TERMINAL",
    ]) {
      expect(metodoDisponible(metodo, true)).toBe(true);
    }
  });

  it("sin conexion solo efectivo y tarjeta manual", () => {
    expect(metodoDisponible("EFECTIVO", false)).toBe(true);
    expect(metodoDisponible("TARJETA", false)).toBe(true);
    expect(metodoDisponible("TRANSFERENCIA", false)).toBe(false);
    expect(metodoDisponible("CREDITO", false)).toBe(false);
    expect(metodoDisponible("TARJETA_TERMINAL", false)).toBe(false);
  });
});
