import { describe, expect, it } from "vitest";
import {
  ESTADOS_PEDIDO,
  ETIQUETA_ESTADO_PUBLICO,
  direccionValida,
  esEstadoPedido,
  esquemaPedidoPublico,
  estadoFinal,
  lineasAItems,
  limpiarTexto,
  mensajeConFolio,
  mensajeDeErrorPedido,
  pasosSeguimiento,
} from "@/features/catalogo/pedido-envio";
import type { LineaPedido } from "@/features/catalogo/pedido";

const UUID = "11111111-1111-4111-8111-111111111111";
const valido = {
  nombre: "Ana López",
  pais: "MX",
  numero: "5512345678",
  entrega: "recoger" as const,
  items: [{ productoId: UUID, cantidad: 2 }],
  acepto: true as const,
};

const linea = (extra: Partial<LineaPedido> = {}): LineaPedido => ({
  clave: UUID,
  productoId: UUID,
  varianteId: null,
  nombre: "Leche",
  variante: null,
  unidad: "PIEZA",
  precio: 25,
  cantidad: 2,
  ...extra,
});

describe("esquema del pedido público", () => {
  it("acepta un pedido válido y rellena lo opcional", () => {
    const r = esquemaPedidoPublico.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.direccion).toBe("");
  });

  it("exige aceptar el aviso", () => {
    expect(esquemaPedidoPublico.safeParse({ ...valido, acepto: false }).success).toBe(false);
  });

  it("rechaza pedidos vacíos, de más de 50 renglones o con cantidades fuera de rango", () => {
    expect(esquemaPedidoPublico.safeParse({ ...valido, items: [] }).success).toBe(false);
    const muchos = Array.from({ length: 51 }, () => ({ productoId: UUID, cantidad: 1 }));
    expect(esquemaPedidoPublico.safeParse({ ...valido, items: muchos }).success).toBe(false);
    for (const cantidad of [0, -1, 10000]) {
      expect(esquemaPedidoPublico.safeParse({ ...valido, items: [{ productoId: UUID, cantidad }] }).success).toBe(false);
    }
  });

  it("solo acepta ids que sean uuid y una entrega conocida", () => {
    expect(esquemaPedidoPublico.safeParse({ ...valido, items: [{ productoId: "x", cantidad: 1 }] }).success).toBe(false);
    expect(esquemaPedidoPublico.safeParse({ ...valido, entrega: "drone" }).success).toBe(false);
  });

  it("no acepta un precio del cliente: el esquema ni lo conoce", () => {
    const r = esquemaPedidoPublico.safeParse({ ...valido, items: [{ productoId: UUID, cantidad: 1, precio: 0.01 }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items[0]).not.toHaveProperty("precio");
  });
});

describe("dirección y textos", () => {
  it("la dirección vale de 5 a 200 caracteres ya limpios", () => {
    expect(direccionValida("Calle 1")).toBe(true);
    expect(direccionValida("  abc  ")).toBe(false);
    expect(direccionValida("x".repeat(201))).toBe(false);
  });
  it("limpiarTexto quita saltos de línea, controles y espacios repetidos", () => {
    expect(limpiarTexto("  Calle\n 1 \t #2\u0000 ")).toBe("Calle 1 #2");
  });
  it("lineasAItems manda solo ids y cantidad", () => {
    expect(lineasAItems([linea({ varianteId: "v1" })])).toEqual([{ productoId: UUID, varianteId: "v1", cantidad: 2 }]);
  });
});

describe("estados", () => {
  it("todos tienen etiqueta y se reconocen", () => {
    for (const e of ESTADOS_PEDIDO) {
      expect(ETIQUETA_ESTADO_PUBLICO[e]).toBeTruthy();
      expect(esEstadoPedido(e)).toBe(true);
    }
    expect(esEstadoPedido("raro")).toBe(false);
  });
  it("entregado y cancelado son finales", () => {
    expect(estadoFinal("entregado")).toBe(true);
    expect(estadoFinal("cancelado")).toBe(true);
    expect(estadoFinal("listo")).toBe(false);
  });
  it("recoger no pasa por «en camino»", () => {
    expect(pasosSeguimiento("recoger")).not.toContain("en_camino");
    expect(pasosSeguimiento("domicilio")).toContain("en_camino");
  });
});

describe("errores de la base", () => {
  it("traduce los mensajes conocidos y no deja salir uno desconocido", () => {
    expect(mensajeDeErrorPedido("Hay productos de tu pedido que ya no estan disponibles")?.status).toBe(409);
    expect(mensajeDeErrorPedido("Este catalogo no recibe pedidos")?.status).toBe(409);
    expect(mensajeDeErrorPedido("Los pedidos no estan disponibles por ahora")?.status).toBe(409);
    expect(mensajeDeErrorPedido("Hoy ya no se pueden recibir mas pedidos aqui")?.status).toBe(429);
    expect(mensajeDeErrorPedido("Escribe tu direccion de entrega")?.status).toBe(400);
    expect(mensajeDeErrorPedido("duplicate key value violates unique constraint")).toBeNull();
    expect(mensajeDeErrorPedido(null)).toBeNull();
  });
});

describe("mensaje con folio", () => {
  it("lleva el folio, los renglones, el total y el enlace de seguimiento", () => {
    const m = mensajeConFolio("Tienda", 7, [linea()], "https://x.test/seg");
    expect(m).toContain("pedido #7");
    expect(m).toContain("Leche");
    expect(m).toContain("Total estimado");
    expect(m).toContain("https://x.test/seg");
  });
  it("sin precios no inventa un total", () => {
    expect(mensajeConFolio("Tienda", 1, [linea({ precio: null })], "https://x.test/s")).not.toContain("Total estimado");
  });
});
