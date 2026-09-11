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
      // Campos de sincronización offline (migración 051): una venta online
      // normal los manda en null/'online', o sea que el RPC se comporta
      // exactamente igual que antes de existir la cola.
      p_idempotency_key: null,
      p_fecha_venta: null,
      p_caja_id: null,
      p_total_cobrado: null,
      p_origen: "online",
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

  it("manda los campos de sincronización cuando la venta viene de la cola offline", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-2" }, error: null });

    await completeSale({
      ...params,
      idempotencyKey: "11111111-1111-1111-1111-111111111111",
      fechaVenta: "2026-09-10T15:00:00.000Z",
      cajaId: "22222222-2222-2222-2222-222222222222",
      totalCobrado: 55.5,
      origen: "offline",
    });

    const payload = rpcMock.mock.calls[0][1];
    expect(payload.p_idempotency_key).toBe("11111111-1111-1111-1111-111111111111");
    // La fecha real de la venta, no la de sincronización: si se mandara null,
    // los reportes ubicarían la venta el día que se recuperó la conexión.
    expect(payload.p_fecha_venta).toBe("2026-09-10T15:00:00.000Z");
    // La caja que estaba abierta al vender; el servidor ya no puede deducirla.
    expect(payload.p_caja_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.p_total_cobrado).toBe(55.5);
    expect(payload.p_origen).toBe("offline");
  });

  it("nunca manda el precio unitario al servidor, ni siquiera offline", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-3" }, error: null });

    await completeSale({ ...params, origen: "offline", totalCobrado: 99 });

    // Protección del bug #5: el precio lo recalcula el servidor desde
    // `productos.precio_venta`. Que la venta sea offline no lo relaja — el
    // total cobrado viaja aparte, solo para detectar cambios de precio.
    const payload = rpcMock.mock.calls[0][1];
    for (const item of payload.p_items) {
      expect(item).not.toHaveProperty("precioUnitario");
      expect(Object.keys(item).sort()).toEqual(["cantidad", "descuento", "productId"]);
    }
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