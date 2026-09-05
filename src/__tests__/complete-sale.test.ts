import { afterEach, describe, expect, it, vi } from "vitest";
import { completeSale } from "@/features/pos/services/pos-service";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ rpc: rpcMock }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("completeSale", () => {
  const params = {
    tenantId: "00000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000002",
    clienteId: null,
    metodoPago: "EFECTIVO" as const,
    notas: "venta de prueba",
    includeIva: true,
    items: [
      {
        productId: "00000000-0000-0000-0000-000000000003",
        nombre: "Coca Cola",
        cantidad: 2,
        precioUnitario: 18.5,
        descuento: 1.5,
        unidad_medida: "PIEZA",
      },
      {
        productId: "00000000-0000-0000-0000-000000000004",
        nombre: "Sabritas",
        cantidad: 1,
        precioUnitario: 22,
        descuento: 0,
        unidad_medida: "PIEZA",
      },
    ],
  };

  it("delega la venta al RPC complete_sale con items mapeados", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-1" }, error: null });

    const venta = await completeSale(params);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("complete_sale", {
      p_tenant_id: params.tenantId,
      p_usuario_id: params.userId,
      p_cliente_id: null,
      p_metodo_pago: "EFECTIVO",
      p_include_iva: true,
      p_notas: "venta de prueba",
      p_monto_recibido: null,
      p_items: [
        {
          productId: "00000000-0000-0000-0000-000000000003",
          cantidad: 2,
          descuento: 1.5,
        },
        {
          productId: "00000000-0000-0000-0000-000000000004",
          cantidad: 1,
          descuento: 0,
        },
      ],
    });
    expect(venta).toEqual({ id: "venta-1" });
  });

  it("envia notas null cuando no se provee notas", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-1" }, error: null });

    await completeSale({ ...params, notas: undefined });

    expect(rpcMock).toHaveBeenCalledWith(
      "complete_sale",
      expect.objectContaining({ p_notas: null })
    );
  });

  it("envia monto_recibido cuando se provee", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-1" }, error: null });

    await completeSale({ ...params, montoRecibido: 50 });

    expect(rpcMock).toHaveBeenCalledWith(
      "complete_sale",
      expect.objectContaining({ p_monto_recibido: 50 })
    );
  });

  it("lanza el error del RPC cuando falla", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: new Error("Stock insuficiente"),
    });

    await expect(completeSale(params)).rejects.toThrow("Stock insuficiente");
  });

  it("lanza error cuando el RPC devuelve venta vacia", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(completeSale(params)).rejects.toThrow(
      "Error al procesar la venta"
    );
  });
});