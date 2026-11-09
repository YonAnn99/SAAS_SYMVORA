import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * "Cancelar cobro" de la terminal. El bug: el UPDATE no pedia `.select()`,
 * supabase-js devolvia `data = null` y la ruta contestaba `pagado: true` en
 * CADA cancelacion: el punto de venta celebraba una venta que no existia.
 */

const filasActualizadas = vi.fn();
const estadoOrden = vi.fn();
const cancelar = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/auth", () => ({
  requireTenantAccess: async () => ({ ok: true, userId: "user-1", role: "SUPER_ADMIN" }),
}));
vi.mock("@/lib/supabase/demo-guard", () => ({ assertNotDemo: async () => ({ ok: true }) }));
vi.mock("@/features/payments/services/mercadopago/secrets", () => ({
  getMercadoPagoPointConfig: async () => ({}),
  readMercadoPagoSecrets: async () => ({ accessToken: "APP_USR-x", webhookSecret: "s" }),
}));
vi.mock("@/features/payments/services/mercadopago/orders", () => ({
  cancelOrder: (...a: unknown[]) => cancelar(...a),
  getOrder: async () => ({ id: "ORD1", status: estadoOrden() }),
}));
vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      // Lectura del pago (y relectura de su venta tras 0 filas actualizadas).
      select: () => ({
        eq: () => ({
          eq: () => ({ single: async () => ({ data: { id: "pago-1", estado: "ESPERANDO_PAGO", venta_id: null } }) }),
          maybeSingle: async () => ({ data: { venta_id: "venta-webhook" } }),
        }),
      }),
      // UPDATE condicional: solo responde filas si se pidio `.select()`.
      update: () => ({
        eq: () => ({
          is: () => {
            const sinSelect = { data: null, error: null };
            return Object.assign(Promise.resolve(sinSelect), {
              select: async () => ({ data: filasActualizadas(), error: null }),
            });
          },
        }),
      }),
    }),
  }),
}));

const { POST } = await import("@/app/api/mercadopago/cancel-order/route");

function peticion() {
  return new NextRequest("http://localhost/api/mercadopago/cancel-order", {
    method: "POST",
    body: JSON.stringify({ tenant_id: "tenant-1", mp_order_id: "ORD1" }),
  });
}

afterEach(() => vi.clearAllMocks());

describe("cancelar cobro con terminal", () => {
  it("una orden cancelada en Mercado Pago queda cancelada, NO pagada", async () => {
    estadoOrden.mockReturnValue("canceled");
    filasActualizadas.mockReturnValue([{ id: "pago-1" }]);
    const res = await POST(peticion());
    expect(await res.json()).toEqual({ success: true, pagado: false });
  });

  it("si Mercado Pago dice que ya se cobró, REGISTRA la venta y avisa que está pagada", async () => {
    // El bug: respondia `pagado` sin crear la venta. Si el webhook no llegaba,
    // el POS celebraba y no habia venta, ni stock descontado, ni caja.
    estadoOrden.mockReturnValue("processed");
    rpc.mockResolvedValue({ data: { id: "venta-1" }, error: null });
    const res = await POST(peticion());
    const json = await res.json();
    expect(rpc).toHaveBeenCalledWith("confirm_terminal_payment", {
      p_mp_order_id: "ORD1",
      p_pagado: true,
      p_estado: "PAGADA",
    });
    expect(json).toMatchObject({ pagado: true, venta_id: "venta-1" });
  });

  it("si se cobró pero la venta no se pudo registrar, NO dice pagada", async () => {
    estadoOrden.mockReturnValue("processed");
    rpc.mockResolvedValue({ data: null, error: { message: "fallo" } });
    const res = await POST(peticion());
    expect(res.status).toBe(500);
    expect((await res.json()).pagado).toBeUndefined();
  });

  it("si el cobro ya está en la terminal, pide cancelarlo ahí y no marca nada", async () => {
    cancelar.mockRejectedValue(new Error("409 order at terminal"));
    estadoOrden.mockReturnValue("at_terminal");
    const res = await POST(peticion());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.en_terminal).toBe(true);
    expect(json.error).toMatch(/Cancélalo en la terminal/);
    expect(filasActualizadas).not.toHaveBeenCalled();
  });

  it("si Mercado Pago aceptó cancelar en la terminal, espera la confirmación sin marcar nada", async () => {
    cancelar.mockResolvedValue({ id: "ORD1", status: "at_terminal" });
    estadoOrden.mockReturnValue("at_terminal");
    const res = await POST(peticion());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Cancelación enviada/);
    expect(filasActualizadas).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("si el webhook la pagó mientras tanto (0 filas actualizadas), avisa que está pagada", async () => {
    estadoOrden.mockReturnValue("canceled");
    filasActualizadas.mockReturnValue([]);
    const res = await POST(peticion());
    expect(await res.json()).toMatchObject({ pagado: true, venta_id: "venta-webhook" });
  });
});
