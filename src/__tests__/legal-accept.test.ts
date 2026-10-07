import { beforeEach, describe, expect, it, vi } from "vitest";

// Evidencia de aceptación legal (migración 010, aplicada el 2026-10-07: antes
// la tabla no existía y nada se guardaba).

const insert = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
    from: () => ({ insert: (...args: unknown[]) => insert(...args) }),
  }),
}));

import { POST } from "@/app/api/legal/accept/route";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify(cuerpo),
    })
  );

const vigentes = {
  termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
  privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
  cookiesVersion: LEGAL_DOCUMENT_VERSIONS.cookies,
};

describe("/api/legal/accept", () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "u-1" } } });
  });

  it("guarda la aceptación de las versiones vigentes con IP y usuario", async () => {
    const res = await pedir(vigentes);
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-1",
        terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
        ip_address: "1.2.3.4",
      })
    );
  });

  it("no registra versiones que no son las vigentes", async () => {
    const res = await pedir({ ...vigentes, termsVersion: "v0-inventada" });
    expect(res.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it("aceptar dos veces la misma versión no es error", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const res = await pedir(vigentes);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
  });

  it("sin sesión, 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await pedir(vigentes)).status).toBe(401);
  });
});
