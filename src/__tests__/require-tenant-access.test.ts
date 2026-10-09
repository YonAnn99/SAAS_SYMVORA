import { beforeEach, describe, expect, it, vi } from "vitest";

// `requireTenantAccess` con `permission` decide con el permiso EFECTIVO, la
// misma regla que `authorize()` en la base: la excepcion por usuario
// (`user_permission_overrides`) gana en ambos sentidos y, si no hay, manda el
// rol. Antes solo miraba `role_permissions`: el cajero al que el dueño le
// concedio inventario recibia 403 en "Quitar fondo".

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
const getUser = vi.fn();

// Imita lo justo del query builder: acumula los `.eq()` y resuelve contra las
// filas en memoria. Si un filtro falta, la consulta trae de mas y se nota.
function consulta(tabla: string) {
  const filtros: [string, unknown][] = [];
  const filas = () =>
    (tablas[tabla] ?? []).filter((f) => filtros.every(([c, v]) => f[c] === v));
  const unica = async () => {
    const r = filas();
    if (r.length > 1) return { data: null, error: { message: "varias filas" } };
    return { data: r[0] ?? null, error: null };
  };
  const builder = {
    select: () => builder,
    eq: (columna: string, valor: unknown) => {
      filtros.push([columna, valor]);
      return builder;
    },
    single: unica,
    maybeSingle: unica,
  };
  return builder;
}

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
  }),
  createSupabaseServiceRoleClient: () => ({
    from: (tabla: string) => consulta(tabla),
  }),
}));

import { requireTenantAccess, tienePermisoEfectivo } from "@/lib/supabase/auth";

const NEGOCIO = "t-1";
const OTRO_NEGOCIO = "t-2";

const pedir = (permission?: string) =>
  requireTenantAccess(new Request("http://localhost/api/x"), {
    tenantId: NEGOCIO,
    permission,
  });

describe("requireTenantAccess: permiso efectivo", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({
      data: { user: { id: "u-1", email: "cajero@ejemplo.mx", app_metadata: {} } },
      error: null,
    });
    tablas = {
      tenant_memberships: [{ user_id: "u-1", tenant_id: NEGOCIO, role: "CAJERO" }],
      role_permissions: [
        { role: "CAJERO", permission: "sales.create" },
        { role: "ORG_ADMIN", permission: "inventory.manage" },
      ],
      user_permission_overrides: [],
    };
  });

  it("sin excepcion decide el rol", async () => {
    expect((await pedir("sales.create")).ok).toBe(true);
    const sinPermiso = await pedir("inventory.manage");
    expect(sinPermiso.ok).toBe(false);
    if (!sinPermiso.ok) expect(sinPermiso.response.status).toBe(403);
  });

  it("la excepcion concedida da lo que el rol no da", async () => {
    tablas.user_permission_overrides.push({
      user_id: "u-1",
      tenant_id: NEGOCIO,
      permission: "inventory.manage",
      granted: true,
    });
    const r = await pedir("inventory.manage");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.role).toBe("CAJERO");
  });

  it("la excepcion denegada quita lo que el rol si da", async () => {
    tablas.user_permission_overrides.push({
      user_id: "u-1",
      tenant_id: NEGOCIO,
      permission: "sales.create",
      granted: false,
    });
    const r = await pedir("sales.create");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("una excepcion de otro negocio no cuenta", async () => {
    tablas.user_permission_overrides.push({
      user_id: "u-1",
      tenant_id: OTRO_NEGOCIO,
      permission: "inventory.manage",
      granted: true,
    });
    expect((await pedir("inventory.manage")).ok).toBe(false);
  });

  it("sin membresia en el negocio, 403 aunque tenga excepcion", async () => {
    tablas.tenant_memberships = [];
    tablas.user_permission_overrides.push({
      user_id: "u-1",
      tenant_id: NEGOCIO,
      permission: "inventory.manage",
      granted: true,
    });
    const r = await pedir("inventory.manage");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("sin sesion, 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await pedir("sales.create");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
});

describe("tienePermisoEfectivo", () => {
  beforeEach(() => {
    tablas = {
      role_permissions: [{ role: "SUPER_ADMIN", permission: "sales.discount_unlimited" }],
      user_permission_overrides: [
        { user_id: "u-1", tenant_id: NEGOCIO, permission: "sales.discount_unlimited", granted: true },
      ],
    };
  });

  it("con negocio, solo cuenta la excepcion de ese negocio", async () => {
    expect(await tienePermisoEfectivo("u-1", "CAJERO", "sales.discount_unlimited", NEGOCIO)).toBe(true);
    expect(await tienePermisoEfectivo("u-1", "CAJERO", "sales.discount_unlimited", OTRO_NEGOCIO)).toBe(false);
  });

  it("sin rol ni excepcion, false", async () => {
    expect(await tienePermisoEfectivo("u-2", undefined, "sales.discount_unlimited")).toBe(false);
  });
});
