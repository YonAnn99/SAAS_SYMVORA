import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeTerminalOrderTotal,
  validateTerminalItems,
} from "@/lib/mercadopago/order-amount";

const productsMock = vi.fn();

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        in: (ids: string[]) => productsMock(ids),
      }),
    }),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const PRODUCTS = [
  { id: "p1", tenant_id: "tenant-1", nombre: "Coca Cola", precio_venta: 18.5, stock_actual: 10 },
  { id: "p2", tenant_id: "tenant-1", nombre: "Sabritas", precio_venta: 22, stock_actual: 5 },
];

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

  it("acepta items validos", () => {
    expect(() =>
      validateTerminalItems([{ productId: "p1", cantidad: 2, descuento: 1.5 }])
    ).not.toThrow();
  });
});

describe("computeTerminalOrderTotal", () => {
  it("calcula subtotal, IVA y total desde la BD e ignora precios del cliente", async () => {
    productsMock.mockResolvedValueOnce({ data: PRODUCTS, error: null });

    const result = await computeTerminalOrderTotal("tenant-1", [
      { productId: "p1", cantidad: 2, descuento: 1.5 },
      { productId: "p2", cantidad: 1, descuento: 0 },
    ]);

    expect(result.subtotal).toBe(59); // 18.5*2 + 22
    expect(result.descuento).toBe(1.5);
    expect(result.impuesto).toBe(9.2); // 57.5 * 0.16
    expect(result.total).toBe(66.7);
    expect(result.payload).toEqual([
      { productId: "p1", cantidad: 2, descuento: 1.5 },
      { productId: "p2", cantidad: 1, descuento: 0 },
    ]);
  });

  it("clampa descuentos que superan el subtotal de la linea", async () => {
    productsMock.mockResolvedValueOnce({ data: PRODUCTS, error: null });

    const result = await computeTerminalOrderTotal("tenant-1", [
      { productId: "p1", cantidad: 1, descuento: 100 },
    ]);

    expect(result.descuento).toBe(18.5);
    expect(result.total).toBe(0);
    expect(result.payload[0].descuento).toBe(18.5);
  });

  it("rechaza stock insuficiente", async () => {
    productsMock.mockResolvedValueOnce({ data: PRODUCTS, error: null });

    await expect(
      computeTerminalOrderTotal("tenant-1", [
        { productId: "p2", cantidad: 99, descuento: 0 },
      ])
    ).rejects.toThrow("Stock insuficiente");
  });

  it("rechaza productos de otro tenant", async () => {
    productsMock.mockResolvedValueOnce({ data: PRODUCTS, error: null });

    await expect(
      computeTerminalOrderTotal("tenant-otro", [
        { productId: "p1", cantidad: 1, descuento: 0 },
      ])
    ).rejects.toThrow("Producto inválido para este negocio");
  });

  it("rechaza producto inexistente", async () => {
    productsMock.mockResolvedValueOnce({ data: PRODUCTS, error: null });

    await expect(
      computeTerminalOrderTotal("tenant-1", [
        { productId: "no-existe", cantidad: 1, descuento: 0 },
      ])
    ).rejects.toThrow("Producto inválido para este negocio");
  });
});