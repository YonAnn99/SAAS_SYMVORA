import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

import { limiteDescarga, ofreceDescarga } from "@/features/payments/exportacion-datos";

describe("descarga de datos de cuenta vencida", () => {
  it("se ofrece solo a cuentas vencidas, con adeudo o canceladas", () => {
    expect(ofreceDescarga("expired")).toBe(true);
    expect(ofreceDescarga("past_due")).toBe(true);
    expect(ofreceDescarga("canceled")).toBe(true);
    expect(ofreceDescarga("active")).toBe(false);
    expect(ofreceDescarga("trial")).toBe(false);
    expect(ofreceDescarga(null)).toBe(false);
  });

  it("el limite es 30 dias despues del fin del periodo pagado", () => {
    const limite = limiteDescarga({
      current_period_end: "2026-09-01T12:00:00Z",
      trial_end: "2026-08-01T12:00:00Z",
    });
    expect(limite?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("sin periodo pagado cuenta desde el fin de la prueba", () => {
    const limite = limiteDescarga({ current_period_end: null, trial_end: "2026-08-01T12:00:00Z" });
    expect(limite?.toISOString().slice(0, 10)).toBe("2026-08-31");
  });

  it("sin fechas no inventa un limite", () => {
    expect(limiteDescarga({ current_period_end: null, trial_end: null })).toBeNull();
  });
});
