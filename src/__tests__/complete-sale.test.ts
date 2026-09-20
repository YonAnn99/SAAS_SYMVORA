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
      // Parametros opcionales de la firma del RPC (migración 051): una venta
      // normal los manda en null y el servidor se comporta como si no
      // existieran.
      p_idempotency_key: null,
      p_fecha_venta: null,
      p_caja_id: null,
      p_total_cobrado: null,
      p_origen: "online",
      p_lista_precio_id: null,
      p_items: [
        {
          productId: "00000000-0000-0000-0000-000000000003",
          varianteId: null,
          cantidad: 2,
          descuento: 1.5,
        },
        {
          productId: "00000000-0000-0000-0000-000000000004",
          varianteId: null,
          cantidad: 1,
          descuento: 0,
        },
      ],
    });
    expect(venta).toEqual({ id: "venta-1" });
  });

  it("manda los parámetros opcionales del RPC cuando se le pasan", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-2" }, error: null });

    await completeSale({
      ...params,
      idempotencyKey: "11111111-1111-1111-1111-111111111111",
      fechaVenta: "2026-09-10T15:00:00.000Z",
      cajaId: "22222222-2222-2222-2222-222222222222",
      totalCobrado: 55.5,
    });

    const payload = rpcMock.mock.calls[0][1];
    expect(payload.p_idempotency_key).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.p_fecha_venta).toBe("2026-09-10T15:00:00.000Z");
    expect(payload.p_caja_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.p_total_cobrado).toBe(55.5);
  });

  it("siempre marca la venta como online", async () => {
    // El modo sin conexión se retiró (2026-09-20) y el cliente ya no puede
    // pedir otro origen. Las filas con `origen = 'offline'` que pudiera haber
    // en la base son historicas y se respetan; nuevas no se crean.
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-4" }, error: null });

    await completeSale(params);

    expect(rpcMock.mock.calls[0][1].p_origen).toBe("online");
  });

  it("nunca manda el precio unitario al servidor", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-3" }, error: null });

    await completeSale({ ...params, totalCobrado: 99 });

    // Protección del bug #5: el precio lo recalcula el servidor desde
    // `productos.precio_venta`. El total cobrado viaja aparte, solo para
    // detectar cambios de precio.
    const payload = rpcMock.mock.calls[0][1];
    for (const item of payload.p_items) {
      expect(item).not.toHaveProperty("precioUnitario");
      expect(Object.keys(item).sort()).toEqual([
        "cantidad",
        "descuento",
        "productId",
        "varianteId",
      ]);
    }
  });

  it("manda el ID de la lista de precios, nunca sus precios", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-4" }, error: null });

    await completeSale({
      ...params,
      listaPrecioId: "44444444-4444-4444-4444-444444444444",
    });

    // El servidor relee el precio de `precios_lista`. Si alguna vez se
    // colara el precio de la lista desde el navegador, seria otra vez el
    // bug #5 con un disfraz nuevo: un cliente manipulado se pondria el
    // precio que quisiera diciendo que "viene de la lista".
    const payload = rpcMock.mock.calls[0][1];
    expect(payload.p_lista_precio_id).toBe(
      "44444444-4444-4444-4444-444444444444"
    );
    for (const item of payload.p_items) {
      expect(item).not.toHaveProperty("precioUnitario");
      expect(item).not.toHaveProperty("precio");
    }
  });

  it("sin lista elegida manda null, no undefined", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "venta-5" }, error: null });

    await completeSale(params);

    // `undefined` desaparece al serializar a JSON y PostgREST tomaria el
    // DEFAULT del parametro. Funciona por casualidad; null lo hace explicito.
    const payload = rpcMock.mock.calls[0][1];
    expect(payload.p_lista_precio_id).toBeNull();
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