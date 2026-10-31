import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeTerminalOrderTotal,
  normalizarItemsTerminal,
  validateTerminalItems,
} from "@/features/payments/services/mercadopago/order-amount";
import { estadoTerminal } from "@/features/payments/services/mercadopago/webhook";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: (nombre: string, args: unknown) => rpcMock(nombre, args),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const VARIANTE = "0fdeacd3-66c2-44fa-9426-6acc08471fe3";

describe("validateTerminalItems", () => {
  it("rechaza lista vacia o no array", () => {
    expect(() => validateTerminalItems([])).toThrow(
      "La venta debe incluir al menos un producto"
    );
    expect(() => validateTerminalItems(null as never)).toThrow(
      "La venta debe incluir al menos un producto"
    );
  });

  it("rechaza cantidad o descuento negativos y producto invalido", () => {
    expect(() =>
      validateTerminalItems([{ productId: "", cantidad: 1, descuento: 0 }])
    ).toThrow("Producto inválido");
    expect(() =>
      validateTerminalItems([{ productId: "p1", cantidad: 0, descuento: 0 }])
    ).toThrow("Cantidad inválida");
    expect(() =>
      validateTerminalItems([{ productId: "p1", cantidad: 1, descuento: -1 }])
    ).toThrow("Descuento inválido");
  });

  it("acepta items validos, con o sin variante", () => {
    expect(() =>
      validateTerminalItems([{ productId: "p1", cantidad: 2, descuento: 1.5 }])
    ).not.toThrow();
    expect(() =>
      validateTerminalItems([{ productId: "p1", varianteId: VARIANTE, cantidad: 1, descuento: 0 }])
    ).not.toThrow();
  });

  it("rechaza una variante que no es un id", () => {
    expect(() =>
      validateTerminalItems([{ productId: "p1", varianteId: "talla-m", cantidad: 1, descuento: 0 }])
    ).toThrow("Variante inválida");
  });
});

describe("normalizarItemsTerminal", () => {
  it("guarda la variante y los insumos, y nada de lo que sobre", () => {
    const items = normalizarItemsTerminal([
      { productId: "p1", cantidad: 1, descuento: 0, precio: 1 } as never,
      {
        productId: "p2",
        varianteId: VARIANTE,
        cantidad: 2,
        descuento: 3,
        insumos: [{ productId: "p9", varianteId: null, cantidad: 0.5 }],
      },
    ]);
    expect(items).toEqual([
      { productId: "p1", varianteId: null, cantidad: 1, descuento: 0 },
      {
        productId: "p2",
        varianteId: VARIANTE,
        cantidad: 2,
        descuento: 3,
        insumos: [{ productId: "p9", varianteId: null, cantidad: 0.5 }],
      },
    ]);
  });
});

describe("computeTerminalOrderTotal", () => {
  const base = {
    tenantId: "tenant-1",
    usuarioId: "user-1",
    clienteId: null,
    listaPrecioId: null,
    topeDescuentoPct: 10,
  };

  it("cotiza con la misma funcion que registra la venta, con la variante y el IVA del carrito", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { subtotal: 64, descuento: 0, impuesto: 0, total: 64 },
      error: null,
    });

    const result = await computeTerminalOrderTotal({
      ...base,
      items: [{ productId: "p1", varianteId: VARIANTE, cantidad: 2, descuento: 0 }],
      includeIva: false,
    });

    expect(rpcMock).toHaveBeenCalledWith("cotizar_venta_terminal", {
      p_tenant_id: "tenant-1",
      p_usuario_id: "user-1",
      p_cliente_id: null,
      p_items: [{ productId: "p1", varianteId: VARIANTE, cantidad: 2, descuento: 0 }],
      p_include_iva: false,
      p_lista_precio_id: null,
      p_tope_descuento_pct: 10,
    });
    expect(result.total).toBe(64);
    expect(result.impuesto).toBe(0);
    expect(result.payload[0].varianteId).toBe(VARIANTE);
  });

  it("los numeros que vienen como texto se redondean a centavos", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { subtotal: "64.00", descuento: "0", impuesto: "10.24", total: "74.24" },
      error: null,
    });
    const result = await computeTerminalOrderTotal({
      ...base,
      items: [{ productId: "p1", cantidad: 2, descuento: 0 }],
      includeIva: true,
    });
    expect(result).toMatchObject({ subtotal: 64, impuesto: 10.24, total: 74.24 });
  });

  it("devuelve el mensaje de la base (stock insuficiente) tal cual", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Stock insuficiente para "Coca Cola". Disponible: 3' },
    });
    await expect(
      computeTerminalOrderTotal({
        ...base,
        items: [{ productId: "p1", cantidad: 99, descuento: 0 }],
        includeIva: false,
      })
    ).rejects.toThrow('Stock insuficiente para "Coca Cola". Disponible: 3');
  });

  it("valida los items antes de llamar a la base", async () => {
    await expect(
      computeTerminalOrderTotal({ ...base, items: [], includeIva: false })
    ).rejects.toThrow("La venta debe incluir al menos un producto");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("estadoTerminal", () => {
  it("traduce los estados finales de Mercado Pago a los que consulta el punto de venta", () => {
    expect(estadoTerminal("processed")).toBe("PAGADA");
    expect(estadoTerminal("canceled")).toBe("CANCELADA");
    expect(estadoTerminal("expired")).toBe("CANCELADA");
    expect(estadoTerminal("failed")).toBe("RECHAZADA");
    expect(estadoTerminal("refunded")).toBe("RECHAZADA");
  });

  it("un estado en curso o desconocido no cambia nada", () => {
    for (const s of ["created", "at_terminal", "action_required", "unknown", "", null, undefined]) {
      expect(estadoTerminal(s)).toBeNull();
    }
  });
});
