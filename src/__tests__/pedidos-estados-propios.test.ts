import { describe, expect, it, beforeEach } from "vitest";
import { construirCorreoPedidoNuevo } from "@/lib/email";
import { CLAVE_SONIDO_PEDIDO, cambiarSonidoPedido, sonidoPedidoActivo } from "@/features/notificaciones/pedido-aviso";

describe("correo de pedido nuevo del catálogo", () => {
  const { subject, html } = construirCorreoPedidoNuevo({
    folio: 12, negocio: "Tienda <Uno>", cliente: "<img src=x> Ana", entrega: "domicilio", total: 250, moneda: "MXN",
  });
  it("dice el folio, el monto y el tipo de entrega", () => {
    expect(subject).toContain("#12");
    expect(html).toContain("A domicilio");
    expect(subject).toMatch(/\$250/);
  });
  it("escapa el nombre del cliente y del negocio (vienen de un formulario público)", () => {
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<Uno>");
  });
  it("lleva a la lista de pedidos", () => {
    expect(html).toContain("/es/orders");
  });
});

describe("sonido del aviso de pedido", () => {
  beforeEach(() => {
    const datos: Record<string, string> = {};
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (k: string) => (k in datos ? datos[k] : null),
          setItem: (k: string, v: string) => {
            datos[k] = v;
          },
        },
      },
      configurable: true,
    });
  });
  it("viene encendido y se puede apagar y volver a encender", () => {
    expect(sonidoPedidoActivo()).toBe(true);
    cambiarSonidoPedido(false);
    expect(sonidoPedidoActivo()).toBe(false);
    cambiarSonidoPedido(true);
    expect(sonidoPedidoActivo()).toBe(true);
    expect(CLAVE_SONIDO_PEDIDO).toBe("symvora-pedido-sonido");
  });
});
