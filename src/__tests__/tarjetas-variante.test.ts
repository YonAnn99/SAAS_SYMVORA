import { describe, expect, it } from "vitest";
import {
  UNIDAD_DEL_PRODUCTO,
  duplicarTarjeta,
  inputDeTarjeta,
  nuevaTarjeta,
  problemaDeTarjeta,
  resumenAtributos,
  resumenCodigos,
  resumenInventario,
  resumenPrecio,
  resumenTarjeta,
  tarjetaRepetida,
} from "@/features/inventory/tarjetas-variante";

const tarjeta = (valor: string, extra: Record<string, string> = {}) => {
  const t = nuevaTarjeta(["Capacidad"], { precio: "18", stock: "20", ...extra });
  t.atributos[0].valor = valor;
  return t;
};

describe("tarjetas de variante", () => {
  it("resume la tarjeta compacta", () => {
    expect(resumenTarjeta(tarjeta("600 ml"))).toBe("Capacidad 600 ml · $18.00 · 20 en stock");
    expect(resumenTarjeta(nuevaTarjeta(["Capacidad"]))).toBe("Sin datos");
  });

  it("detecta dos tarjetas con los mismos atributos (sin importar mayusculas)", () => {
    expect(tarjetaRepetida([tarjeta("600 ml"), tarjeta("2 L"), tarjeta("600 ML")])).toBe(2);
    expect(tarjetaRepetida([tarjeta("600 ml"), tarjeta("2 L")])).toBe(-1);
  });

  it("pide valor de atributo y precio", () => {
    expect(problemaDeTarjeta(nuevaTarjeta(["Capacidad"], { precio: "10" }))).toMatchObject({
      mensaje: expect.stringMatching(/valor del atributo/),
      seccion: "datos",
    });
    expect(problemaDeTarjeta(tarjeta("600 ml", { precio: "0" }))).toMatchObject({
      mensaje: expect.stringMatching(/precio/),
      seccion: "precio",
    });
    expect(problemaDeTarjeta(tarjeta("600 ml"))).toBeNull();
  });

  it("arma el insert con SKU automatico y unidad heredada", () => {
    const input = inputDeTarjeta(tarjeta("600 ml", { costo: "12", stockMinimo: "5" }), {
      productoId: "p1",
      baseSku: "PEPS",
      imagenUrl: null,
    });
    expect(input).toMatchObject({
      producto_id: "p1",
      atributos: [{ tipo: "Capacidad", valor: "600 ml" }],
      precio_venta: 18,
      costo_compra: 12,
      stock_actual: 20,
      stock_minimo: 5,
      unidad_medida: null,
      codigo_barras: null,
    });
    expect(input.sku).toMatch(/^PEPS-/);
  });

  it("guarda la unidad propia solo si es distinta a la del producto", () => {
    const opciones = { productoId: "p1", baseSku: "PEPS", imagenUrl: null, unidadProducto: "PIEZA" as const };
    expect(inputDeTarjeta(tarjeta("600 ml", { unidad: "PIEZA" }), opciones).unidad_medida).toBeNull();
    expect(inputDeTarjeta(tarjeta("2 L", { unidad: "LITRO" }), opciones).unidad_medida).toBe("LITRO");
  });

  it("un servicio se guarda sin stock ni unidad y se resume como Servicio", () => {
    const t = tarjeta("Chico", { precio: "80", stock: "5", stockMinimo: "2", unidad: "LITRO" });
    const input = inputDeTarjeta(t, { productoId: "p1", baseSku: "CORT", imagenUrl: null, esServicio: true });
    expect(input).toMatchObject({ stock_actual: 0, stock_minimo: 0, unidad_medida: null });
    expect(resumenTarjeta(t, true)).toBe("Capacidad Chico · $80.00 · Servicio");
  });

  it("resume cada seccion de la tarjeta", () => {
    const t = tarjeta("600 ml", { codigo: "7501", sku: "" });
    expect(resumenAtributos(t)).toBe("Capacidad 600 ml");
    expect(resumenPrecio(t)).toBe("$18.00");
    expect(resumenPrecio(nuevaTarjeta([]))).toBe("Sin precio");
    expect(resumenInventario(t)).toBe("20 en stock");
    expect(resumenCodigos(t)).toBe("7501");
    expect(resumenCodigos(nuevaTarjeta([]))).toBe("Automático");
  });

  it("duplicar copia todo menos el valor, el SKU y el codigo", () => {
    const original = tarjeta("600 ml", { sku: "X-1", codigo: "750123", unidad: "LITRO" });
    const copia = duplicarTarjeta(original);
    expect(copia.id).not.toBe(original.id);
    expect(copia.atributos[0]).toMatchObject({ tipo: "Capacidad", valor: "" });
    expect(copia).toMatchObject({ precio: "18", sku: "", codigo: "", unidad: "LITRO" });
    expect(nuevaTarjeta([]).unidad).toBe(UNIDAD_DEL_PRODUCTO);
  });
});
