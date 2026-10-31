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
    from: () => ({
      // Lectura del pago.
      select: () => ({
        eq: () => ({
          eq: () => ({ single: async () => ({ data: { id: "pago-1", estado: "ESPERANDO_PAGO", venta_id: null } }) }),
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

  it("si Mercado Pago dice que ya se cobró, avisa que está pagada", async () => {
    estadoOrden.mockReturnValue("processed");
    const res = await POST(peticion());
    expect((await res.json()).pagado).toBe(true);
  });

  it("si el cobro ya está en la terminal, pide cancelarlo ahí y no marca nada", async () => {
    cancelar.mockRejectedValue(new Error("409 order at terminal"));
    estadoOrden.mockReturnValue("at_terminal");
    const res = await POST(peticion());
    expect(res.status).toBe(409);
    expect((await res.json()).en_terminal).toBe(true);
    expect(filasActualizadas).not.toHaveBeenCalled();
  });

  it("si el webhook la pagó mientras tanto (0 filas actualizadas), avisa que está pagada", async () => {
    estadoOrden.mockReturnValue("canceled");
    filasActualizadas.mockReturnValue([]);
    const res = await POST(peticion());
    expect((await res.json()).pagado).toBe(true);
  });
});
