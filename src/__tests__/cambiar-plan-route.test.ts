import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta de cambio de plan con Conekta y la base simulados: se prueba el ORDEN (Conekta primero, base despues)
// y que un fallo de Conekta no deje nada a medias. Nunca toca dinero ni la base real.
vi.setConfig({ testTimeout: 30_000 });

const estado = vi.hoisted(() => ({
  sub: {} as Record<string, unknown>,
  sucursales: 1,
  conektaFalla: false,
  llamadas: [] as string[],
  updates: [] as Record<string, unknown>[],
  autorizado: true,
  demo: false,
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireTenantAccess: async () =>
    estado.autorizado
      ? { ok: true }
      : { ok: false, response: new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }) },
}));
vi.mock("@/lib/supabase/demo-guard", () => ({
  assertNotDemo: async () =>
    estado.demo ? { ok: false, response: new Response("{}", { status: 403 }) } : { ok: true },
}));
vi.mock("@/lib/rate-limit", () => ({ consumirRateLimit: async () => ({ permitido: true }) }));
vi.mock("@/features/payments/services/conekta/plans", () => ({
  ensurePlanExists: async (clave: string) => {
    estado.llamadas.push(`plan:${clave}`);
    return `id-${clave}`;
  },
}));
vi.mock("@/features/payments/services/conekta/subscriptions", () => ({
  cambiarPlan: async (_cliente: string, plan: string) => {
    estado.llamadas.push(`cambiarPlan:${plan}`);
    if (estado.conektaFalla) throw new Error("conekta caido");
  },
}));
vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (tabla: string) => ({
      select: () => {
        const q = {
          eq: () => q,
          single: async () => ({ data: estado.sub, error: null }),
          then: (r: (v: unknown) => unknown) => r({ count: estado.sucursales }),
        };
        return q;
      },
      update: (cambios: Record<string, unknown>) => ({
        eq: async () => {
          estado.llamadas.push(`update:${tabla}`);
          estado.updates.push(cambios);
          return { error: null };
        },
      }),
    }),
    rpc: async (nombre: string, args: unknown) => {
      estado.llamadas.push(`rpc:${nombre}:${JSON.stringify(args)}`);
      return { error: null };
    },
  }),
}));

const TENANT = "11111111-1111-4111-8111-111111111111";
const peticion = (nivel: string) =>
  new Request("http://localhost/api/conekta/cambiar-plan", {
    method: "POST",
    body: JSON.stringify({ tenant_id: TENANT, nivel }),
  });

async function llamar(nivel: string) {
  const { POST } = await import("@/app/api/conekta/cambiar-plan/route");
  const r = await POST(peticion(nivel));
  return { status: r.status, body: await r.json() };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NIVELES_ACTIVOS", "1");
  estado.sub = {
    id: "sub-1",
    status: "active",
    billing_period: "monthly",
    last_payment_at: "2026-11-01T00:00:00Z",
    nivel: "pro",
    conekta_customer_id: "cus_1",
    conekta_subscription_id: "sub_1",
  };
  estado.sucursales = 1;
  estado.conektaFalla = false;
  estado.llamadas = [];
  estado.updates = [];
  estado.autorizado = true;
  estado.demo = false;
});

describe("POST /api/conekta/cambiar-plan", () => {
  it("subir con tarjeta: Conekta primero, cierra la promo y asigna el nivel ya", async () => {
    const r = await llamar("premium");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, tipo: "sube", aplicado_ya: true, precio_desde_proximo_cobro: 599 });
    expect(estado.llamadas[0]).toBe("plan:premiumMonthly");
    expect(estado.llamadas[1]).toBe("cambiarPlan:id-premiumMonthly");
    expect(estado.updates[0]).toMatchObject({ promo_cobros_restantes: 0, promo_plan: null, nivel_pendiente: "premium" });
    expect(estado.llamadas.some((l) => l.startsWith("rpc:asignar_nivel"))).toBe(true);
  });

  it("bajar con tarjeta: el nivel queda pendiente para el siguiente cobro (no se asigna ya)", async () => {
    const r = await llamar("basico");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tipo: "baja", aplicado_ya: false, precio_desde_proximo_cobro: 249 });
    expect(estado.updates[0]).toMatchObject({ nivel_pendiente: "basico" });
    expect(estado.llamadas.some((l) => l.startsWith("rpc:asignar_nivel"))).toBe(false);
  });

  it("si Conekta falla, la base NO cambia y responde 502", async () => {
    estado.conektaFalla = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await llamar("premium");
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("conekta_no_pudo_cambiar");
    expect(estado.updates).toHaveLength(0);
    expect(estado.llamadas.some((l) => l.startsWith("rpc:"))).toBe(false);
  });

  it("bajar a Básico con 2 sucursales activas se rechaza antes de tocar Conekta", async () => {
    estado.sucursales = 2;
    const r = await llamar("basico");
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "demasiadas_sucursales", max: 1, usadas: 2 });
    expect(estado.llamadas).toHaveLength(0);
  });

  it("el mismo nivel no cambia nada", async () => {
    const r = await llamar("pro");
    expect(r.body).toMatchObject({ ok: true, sin_cambio: true });
    expect(estado.llamadas).toHaveLength(0);
  });

  it("anual va por soporte (409) sin tocar Conekta ni la base", async () => {
    estado.sub.billing_period = "yearly";
    const r = await llamar("premium");
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("cambio_por_soporte");
    expect(estado.llamadas).toHaveLength(0);
  });

  it("pago único (sin suscripción recurrente): solo deja el nivel pendiente, sin Conekta", async () => {
    estado.sub.conekta_subscription_id = null;
    const r = await llamar("premium");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ modo: "pago_unico", aplicado_ya: false });
    expect(estado.llamadas.some((l) => l.startsWith("plan:") || l.startsWith("cambiarPlan"))).toBe(false);
    expect(estado.updates[0]).toMatchObject({ nivel_pendiente: "premium" });
  });

  it("quien aún no paga no cambia de plan por aquí", async () => {
    estado.sub.last_payment_at = null;
    const r = await llamar("premium");
    expect(r.status).toBe(409);
    expect(estado.llamadas).toHaveLength(0);
  });

  it("sin permiso (no es el dueño) responde 403; demo se rechaza; niveles apagados 409", async () => {
    estado.autorizado = false;
    expect((await llamar("premium")).status).toBe(403);
    estado.autorizado = true;
    estado.demo = true;
    expect((await llamar("premium")).status).toBe(403);
    estado.demo = false;
    vi.stubEnv("NEXT_PUBLIC_NIVELES_ACTIVOS", "0");
    expect((await llamar("premium")).status).toBe(409);
    expect(estado.llamadas).toHaveLength(0);
  });

  it("nivel inventado se rechaza con 400", async () => {
    expect((await llamar("gratis")).status).toBe(400);
  });
});
