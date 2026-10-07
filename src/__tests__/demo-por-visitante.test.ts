import { beforeEach, describe, expect, it, vi } from "vitest";

// Demo privada por visitante (migracion 112): `/api/demo/start` crea un usuario
// y SU negocio; `/api/demo/salir` borra solo la demo de quien sale.

const rpc = vi.fn();
const createUser = vi.fn();
const deleteUser = vi.fn();
const generateLink = vi.fn();
const contarActivas = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  consumirRateLimit: async () => ({ permitido: true }),
  cabecerasRateLimit: () => ({}),
  obtenerIpCliente: () => "1.2.3.4",
}));

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({ gt: () => contarActivas() }),
    }),
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUser(...args),
        deleteUser: (...args: unknown[]) => deleteUser(...args),
        generateLink: (...args: unknown[]) => generateLink(...args),
      },
    },
  }),
  createSupabaseServerClient: async () => ({ auth: { getUser: () => getUser() } }),
}));

import { POST as start } from "@/app/api/demo/start/route";
import { POST as salir } from "@/app/api/demo/salir/route";
import { MAX_DEMOS_ACTIVAS, correoDemo } from "@/lib/demo";

const peticion = () => new Request("http://localhost/api/demo/start?locale=es", { method: "POST" });

describe("/api/demo/start", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    rpc.mockReset();
    createUser.mockReset();
    deleteUser.mockReset().mockResolvedValue({});
    generateLink.mockReset();
    contarActivas.mockReset().mockResolvedValue({ count: 0 });
  });

  it("crea un usuario de visitante y SU negocio, y devuelve su token", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "crear_negocio_demo" ? { data: "tenant-1", error: null } : { data: 0, error: null }
    );
    createUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: "tok" } }, error: null });

    const res = await start(peticion());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ token_hash: "tok", tenant_id: "tenant-1", locale: "es" });
    // Usuario propio, marcado como demo, nunca el compartido de antes.
    const datos = createUser.mock.calls[0][0];
    expect(datos.app_metadata).toEqual({ is_demo: true });
    expect(datos.email_confirm).toBe(true);
    expect(datos.email).toMatch(/^demo-.+@demo\.symvora\.com\.mx$/);
    expect(body.email).toBe(datos.email);
    // Primero limpia las vencidas; ya no reinicia la demo de nadie.
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["borrar_demos_vencidas", "crear_negocio_demo"]);
    expect(rpc).not.toHaveBeenCalledWith("reset_demo_tenant");
  });

  it("si no se pudo sembrar el negocio, borra el usuario recién creado", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "crear_negocio_demo"
        ? { data: null, error: { message: "boom" } }
        : { data: 0, error: null }
    );
    createUser.mockResolvedValue({ data: { user: { id: "u-2" } }, error: null });

    const res = await start(peticion());
    expect(res.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith("u-2");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("con el tope de demos activas lleno no crea nada", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    contarActivas.mockResolvedValue({ count: MAX_DEMOS_ACTIVAS });

    const res = await start(peticion());
    expect(res.status).toBe(503);
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe("/api/demo/salir", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });

  it("borra la demo de quien sale", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1", app_metadata: { is_demo: true } } } });
    rpc.mockResolvedValue({ data: true, error: null });

    const res = await salir();
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("borrar_mi_demo", { p_user_id: "u-1" });
  });

  it("una cuenta real nunca se borra por aquí", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "dueno", app_metadata: {} } } });

    const res = await salir();
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin sesión, 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await salir()).status).toBe(401);
  });
});

describe("correoDemo", () => {
  it("usa nuestro dominio y es distinto por visitante", () => {
    expect(correoDemo("a")).toBe("demo-a@demo.symvora.com.mx");
    expect(correoDemo("a")).not.toBe(correoDemo("b"));
  });
});
