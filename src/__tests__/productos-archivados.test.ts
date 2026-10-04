import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock("@/lib/image", () => ({ cropToSquareWebP: vi.fn() }));

import { esErrorDeHistorial } from "@/features/inventory/services/product-service";

describe("esErrorDeHistorial", () => {
  it("reconoce la llave foranea que impide borrar un producto con historial", () => {
    expect(esErrorDeHistorial({ code: "23503", message: "violates foreign key constraint" })).toBe(true);
  });

  it("no confunde otros errores", () => {
    expect(esErrorDeHistorial({ code: "42501" })).toBe(false);
    expect(esErrorDeHistorial(new Error("red"))).toBe(false);
    expect(esErrorDeHistorial(null)).toBe(false);
  });
});
