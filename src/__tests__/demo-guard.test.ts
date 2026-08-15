import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: () => getUserMock(),
    },
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: () => ({}),
}));

import {
  DEMO_USER_EMAIL,
  assertNotDemo,
  isDemoUser,
  isDemoUserSync,
} from "@/lib/supabase/demo-guard";

describe("demo-guard helpers", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  describe("isDemoUser", () => {
    it("devuelve true cuando el email del usuario coincide con el email demo", async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: { id: "u-1", email: DEMO_USER_EMAIL } },
        error: null,
      });
      await expect(isDemoUser()).resolves.toBe(true);
    });

    it("devuelve true cuando app_metadata.is_demo esta fijado", async () => {
      getUserMock.mockResolvedValueOnce({
        data: {
          user: {
            id: "u-1",
            email: "alguien@otro.com",
            app_metadata: { is_demo: true },
          },
        },
        error: null,
      });
      await expect(isDemoUser()).resolves.toBe(true);
    });

    it("devuelve false cuando el email no es demo y app_metadata no esta fijado", async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: { id: "u-1", email: "owner@symvora.com" } },
        error: null,
      });
      await expect(isDemoUser()).resolves.toBe(false);
    });

    it("devuelve false cuando no hay sesion", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      await expect(isDemoUser()).resolves.toBe(false);
    });

    it("devuelve false cuando getUser lanza un error", async () => {
      getUserMock.mockRejectedValueOnce(new Error("network"));
      await expect(isDemoUser()).resolves.toBe(false);
    });
  });

  describe("isDemoUserSync", () => {
    it("true para email demo", () => {
      expect(isDemoUserSync(DEMO_USER_EMAIL)).toBe(true);
    });
    it("false para emails distintos", () => {
      expect(isDemoUserSync("owner@symvora.com")).toBe(false);
    });
    it("false para null/undefined", () => {
      expect(isDemoUserSync(null)).toBe(false);
      expect(isDemoUserSync(undefined)).toBe(false);
    });
  });

  describe("assertNotDemo", () => {
    it("devuelve ok:true cuando no es demo", async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: { id: "u-1", email: "owner@symvora.com" } },
        error: null,
      });
      const result = await assertNotDemo();
      expect(result.ok).toBe(true);
    });

    it("devuelve 403 cuando el usuario es demo", async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: { id: "u-demo", email: DEMO_USER_EMAIL } },
        error: null,
      });
      const result = await assertNotDemo();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        const body = await result.response.json();
        expect(body.code).toBe("DEMO_MODE_RESTRICTED");
      }
    });
  });
});
