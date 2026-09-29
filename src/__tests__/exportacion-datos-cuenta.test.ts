import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

import { CONJUNTOS } from "@/features/payments/exportacion-datos";
import { ofertaRegresoVigente } from "@/features/payments/promocion";

describe("descarga de datos de cuenta vencida", () => {
  it("cada conjunto tiene archivo y columnas, sin claves repetidas", () => {
    const claves = CONJUNTOS.map((c) => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const c of CONJUNTOS) {
      expect(c.columnas.length).toBeGreaterThan(0);
      expect(c.archivo).not.toBe("");
    }
  });

  it("el detalle de ventas se filtra por el negocio de su venta", () => {
    const detalle = CONJUNTOS.find((c) => c.clave === "detalle_ventas");
    expect(detalle?.select).toContain("ventas!inner");
    expect(detalle?.filtroTenant).toBe("ventas.tenant_id");
  });

  it("las columnas toleran relaciones vacias", () => {
    const ventas = CONJUNTOS.find((c) => c.clave === "ventas")!;
    const cliente = ventas.columnas.find((c) => c.header === "Cliente")!;
    expect(cliente.accessor({ clientes: null })).toBe("");
    expect(cliente.accessor({ clientes: { nombre: "Ana" } })).toBe("Ana");
  });
});

describe("oferta de regreso", () => {
  const ahora = new Date("2026-10-10T12:00:00Z");

  it("aplica solo al plan mensual y dentro de su vigencia", () => {
    expect(ofertaRegresoVigente("2026-10-20T00:00:00Z", "monthly", ahora)).toBe(true);
    expect(ofertaRegresoVigente("2026-10-20T00:00:00Z", "yearly", ahora)).toBe(false);
    expect(ofertaRegresoVigente("2026-10-01T00:00:00Z", "monthly", ahora)).toBe(false);
    expect(ofertaRegresoVigente(null, "monthly", ahora)).toBe(false);
    expect(ofertaRegresoVigente("no-es-fecha", "monthly", ahora)).toBe(false);
  });
});
