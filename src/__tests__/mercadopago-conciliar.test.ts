import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El POS ya no depende solo del webhook: si la orden sigue en curso en la base,
 * se le pregunta a Mercado Pago y un estado final se registra. Antes, sin
 * webhook, el POS esperaba para siempre aunque el cliente ya hubiera pagado (o
 * se hubiera cancelado en la terminal).
 */

const pagoEnBase = vi.fn();
const estadoOrden = vi.fn();
const getOrder = vi.fn();
const rpc = vi.fn();

vi.mock("@/features/payments/services/mercadopago/secrets", () => ({
  getMercadoPagoPointConfig: async () => ({}),
  readMercadoPagoSecrets: async () => ({ accessToken: "APP_USR-x", webhookSecret: "s" }),
}));
vi.mock("@/features/payments/services/mercadopago/orders", () => ({
  getOrder: (...a: unknown[]) => getOrder(...a),
}));
vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single: async () => ({ data: pagoEnBase() }) }),
        }),
      }),
    }),
  }),
}));

const { conciliarPagoTerminal } = await import(
  "@/features/payments/services/mercadopago/conciliar"
);

afterEach(() => vi.clearAllMocks());

function enCurso() {
  pagoEnBase.mockReturnValue({ estado: "ESPERANDO_PAGO", venta_id: null });
  getOrder.mockImplementation(async () => ({ id: "ORD1", status: estadoOrden() }));
}

describe("conciliarPagoTerminal", () => {
  it("pagada en Mercado Pago: registra la venta y devuelve su id", async () => {
    enCurso();
    estadoOrden.mockReturnValue("processed");
    rpc.mockResolvedValue({ data: { id: "venta-1" }, error: null });

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(rpc).toHaveBeenCalledWith("confirm_terminal_payment", {
      p_mp_order_id: "ORD1",
      p_pagado: true,
      p_estado: "PAGADA",
    });
    expect(r).toEqual({ estado: "PAGADA", venta_id: "venta-1" });
  });

  it("cancelada en la terminal: la marca CANCELADA, sin venta", async () => {
    enCurso();
    estadoOrden.mockReturnValue("canceled");
    rpc.mockResolvedValue({ data: null, error: null });

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(rpc).toHaveBeenCalledWith("confirm_terminal_payment", {
      p_mp_order_id: "ORD1",
      p_pagado: false,
      p_estado: "CANCELADA",
    });
    expect(r).toEqual({ estado: "CANCELADA", venta_id: null });
  });

  it("sigue en la terminal: no toca nada", async () => {
    enCurso();
    estadoOrden.mockReturnValue("at_terminal");

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(rpc).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: "ESPERANDO_PAGO", venta_id: null });
  });

  it("si el webhook ya la pagó (había venta), devuelve PAGADA aunque llegue otro estado", async () => {
    enCurso();
    estadoOrden.mockReturnValue("canceled");
    // confirm_terminal_payment devuelve la venta que ya existia.
    rpc.mockResolvedValue({ data: { id: "venta-webhook" }, error: null });

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(r).toEqual({ estado: "PAGADA", venta_id: "venta-webhook" });
  });

  it("con la venta ya registrada no le pregunta a Mercado Pago", async () => {
    pagoEnBase.mockReturnValue({ estado: "PAGADA", venta_id: "venta-1" });

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(getOrder).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: "PAGADA", venta_id: "venta-1" });
  });

  it("si Mercado Pago no responde, devuelve lo de la base sin tocar nada", async () => {
    pagoEnBase.mockReturnValue({ estado: "ESPERANDO_PAGO", venta_id: null });
    getOrder.mockRejectedValue(new Error("504"));
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await conciliarPagoTerminal("tenant-1", "ORD1");

    expect(rpc).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: "ESPERANDO_PAGO", venta_id: null });
    aviso.mockRestore();
  });

  it("si el registro falla, lanza (el POS reintenta en la siguiente vuelta)", async () => {
    enCurso();
    estadoOrden.mockReturnValue("processed");
    rpc.mockResolvedValue({ data: null, error: { message: "fallo" } });

    await expect(conciliarPagoTerminal("tenant-1", "ORD1")).rejects.toBeTruthy();
  });

  it("orden de otro negocio o inexistente: null", async () => {
    pagoEnBase.mockReturnValue(null);
    expect(await conciliarPagoTerminal("tenant-1", "ORD1")).toBeNull();
  });
});
