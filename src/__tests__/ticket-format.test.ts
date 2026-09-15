import { describe, expect, it } from "vitest";
import {
  formatearImporte,
  muestraEfectivo,
  numeroOperacion,
  subtotalLinea,
  totalArticulos,
} from "@/features/pos/ticket-format";
import type { CartItem } from "@/features/pos/types/pos.types";

const item = (
  nombre: string,
  cantidad: number,
  precioUnitario: number,
  descuento = 0
): CartItem => ({
  productId: `p-${nombre}`,
  varianteId: null,
  nombre,
  cantidad,
  precioUnitario,
  descuento,
  unidad_medida: "PIEZA",
});

describe("numeroOperacion", () => {
  it("son los 8 primeros caracteres del UUID, en mayúsculas", () => {
    expect(numeroOperacion("a3f19c4b-1234-5678-9abc-def012345678")).toBe(
      "A3F19C4B"
    );
  });

  it("coincide con lo que la base escribe en el movimiento de caja", () => {
    // `_crear_venta_desde_items` usa LEFT(id::text, 8) para describir el
    // movimiento. Si esto divergiera, el número del papel no serviría para
    // localizar la venta en Finanzas, que es justo para lo que está.
    const id = "d565d0a7-3ce7-4f41-a3e6-48c7ab1161aa";
    const comoLoHaceLaBase = id.slice(0, 8);
    expect(numeroOperacion(id)).toBe(comoLoHaceLaBase.toUpperCase());
  });

  it("sirve igual para la clave de idempotencia de una venta offline", () => {
    // Sin conexión no hay id de servidor; se usa la clave con la que luego
    // deduplica el servidor, así que sigue apuntando a la misma venta.
    expect(numeroOperacion("9f8e7d6c-0000-1111-2222-333344445555")).toBe(
      "9F8E7D6C"
    );
  });

  it("sin referencia no inventa número", () => {
    expect(numeroOperacion(null)).toBeNull();
    expect(numeroOperacion(undefined)).toBeNull();
    expect(numeroOperacion("")).toBeNull();
  });
});

describe("totalArticulos", () => {
  it("cuenta UNIDADES, no líneas del ticket", () => {
    // Es la diferencia que importa: el cliente cuenta lo que lleva en la bolsa.
    const items = [item("Café", 3, 70), item("Pan", 3, 50)];
    expect(totalArticulos(items)).toBe(6);
    expect(totalArticulos(items)).not.toBe(items.length);
  });

  it("un carrito vacío son cero artículos", () => {
    expect(totalArticulos([])).toBe(0);
  });

  it("soporta cantidades fraccionarias (venta por peso)", () => {
    // `unidad_medida` admite KG: 1.5 kg de jitomate es una cantidad válida.
    expect(totalArticulos([item("Jitomate", 1.5, 40)])).toBe(1.5);
  });
});

describe("subtotalLinea", () => {
  it("es precio por cantidad", () => {
    expect(subtotalLinea(item("Café", 2, 70))).toBe(140);
  });

  it("descuenta el descuento de la línea", () => {
    expect(subtotalLinea(item("Café", 2, 70, 15))).toBe(125);
  });
});

describe("formatearImporte", () => {
  it("siempre dos decimales: el ticket se lee en columna", () => {
    expect(formatearImporte(70)).toBe("70.00");
    expect(formatearImporte(180.5)).toBe("180.50");
    expect(formatearImporte(0)).toBe("0.00");
  });
});

describe("muestraEfectivo", () => {
  it("con efectivo y monto recibido, sí", () => {
    expect(muestraEfectivo("EFECTIVO", 200)).toBe(true);
  });

  it("con tarjeta NO, aunque llegara un monto", () => {
    // Sacar "Cambio $0.00" en un pago con tarjeta solo confunde a quien lee.
    expect(muestraEfectivo("TARJETA", 200)).toBe(false);
    expect(muestraEfectivo("TARJETA_TERMINAL", 200)).toBe(false);
    expect(muestraEfectivo("TRANSFERENCIA", 200)).toBe(false);
    expect(muestraEfectivo("CREDITO", 200)).toBe(false);
  });

  it("efectivo sin monto capturado tampoco imprime esas líneas", () => {
    expect(muestraEfectivo("EFECTIVO", null)).toBe(false);
    expect(muestraEfectivo("EFECTIVO", undefined)).toBe(false);
  });

  it("un monto recibido de 0 sí es un dato, no una ausencia", () => {
    expect(muestraEfectivo("EFECTIVO", 0)).toBe(true);
  });
});
