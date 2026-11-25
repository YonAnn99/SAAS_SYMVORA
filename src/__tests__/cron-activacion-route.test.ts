import { beforeEach, describe, expect, it, vi } from "vitest";

// Los crons de activación con Supabase, Resend y el rate limit simulados: nunca tocan la base ni mandan correos.
vi.setConfig({ testTimeout: 30_000 });

const H = 3_600_000;
const D = 24 * H;

const estado = vi.hoisted(() => ({
  subs: [] as Record<string, unknown>[],
  tenants: [] as Record<string, unknown>[],
  marcas: [] as Record<string, unknown>[],
  productos: 0,
  ventas: 0,
  correos: [] as string[],
  actualizaciones: [] as Record<string, unknown>[],
  consumidas: [] as string[],
  permitido: true,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumirRateLimit: async (clave: string) => {
    estado.consumidas.push(clave);
    return { permitido: estado.permitido };
  },
}));
vi.mock("@/lib/email", async (original) => ({
  ...(await original<typeof import("@/lib/email")>()),
  sendCorreoNovedad: async (p: { to: string }) => {
    estado.correos.push(p.to);
    return { ok: true };
  },
}));
vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (tabla: string) => {
      const q: Record<string, unknown> = {};
      const resultado = () => {
        if (tabla === "subscriptions") return { data: estado.subs, error: null };
        if (tabla === "tenants") return { data: estado.tenants, error: null };
        if (tabla === "rate_limits") return { data: estado.marcas, error: null };
        return { data: null, error: null };
      };
      for (const m of ["select", "eq", "gt", "lt", "gte", "in", "is", "like", "limit", "order"]) {
        q[m] = (...args: unknown[]) => {
          if (m === "select" && (args[1] as { head?: boolean } | undefined)?.head) {
            return { eq: () => ({ is: async () => ({ count: tabla === "productos" ? estado.productos : estado.ventas }), then: undefined, count: undefined }) , is: async () => ({ count: estado.productos }) };
          }
          return q;
        };
      }
      q.maybeSingle = async () => ({ data: tabla === "tenant_memberships" ? { user_id: "u1" } : null });
      q.update = (cambios: Record<string, unknown>) => ({
        eq: async () => {
          estado.actualizaciones.push(cambios);
          return { error: null };
        },
      });
      q.then = (r: (v: unknown) => unknown) => r(resultado());
      return q;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "dueno@ejemplo.com", user_metadata: { nombre: "Ana" }, app_metadata: {} } } }) } },
  }),
}));

const autorizado = (url: string) =>
  new Request(url, { headers: { authorization: "Bearer secreto" } });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "secreto");
  estado.subs = [];
  estado.tenants = [];
  estado.marcas = [];
  estado.productos = 0;
  estado.ventas = 0;
  estado.correos = [];
  estado.actualizaciones = [];
  estado.consumidas = [];
  estado.permitido = true;
});

describe("seguridad de los crons de activación", () => {
  it("sin el secreto correcto responden 401 y sin CRON_SECRET todo se rechaza", async () => {
    const { GET: activacion } = await import("@/app/api/cron/activacion/route");
    const { GET: reactivar } = await import("@/app/api/cron/reactivar-pruebas/route");
    expect((await activacion(new Request("http://x/api/cron/activacion"))).status).toBe(401);
    expect((await reactivar(new Request("http://x/api/cron/reactivar-pruebas", { headers: { authorization: "Bearer otro" } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await activacion(autorizado("http://x/api/cron/activacion"))).status).toBe(401);
  });
});

describe("reactivar pruebas vencidas", () => {
  const vencida = () => {
    const ahora = Date.now();
    estado.subs = [{ id: "s1", tenant_id: "t1", status: "trial", trial_end: new Date(ahora - 5 * D).toISOString(), last_payment_at: null }];
    estado.tenants = [{ id: "t1", nombre_comercial: "Tienda", creado_en: new Date(ahora - 20 * D).toISOString(), demo_expira_en: null }];
  };

  it("el simulacro lista la cuenta y no cambia ni manda nada", async () => {
    vencida();
    const { GET } = await import("@/app/api/cron/reactivar-pruebas/route");
    const r = await (await GET(autorizado("http://x/api/cron/reactivar-pruebas"))).json();
    expect(r.dry).toBe(true);
    expect(r.total).toBe(1);
    expect(estado.correos).toHaveLength(0);
    expect(estado.actualizaciones).toHaveLength(0);
    expect(estado.consumidas).toHaveLength(0);
  });
});
