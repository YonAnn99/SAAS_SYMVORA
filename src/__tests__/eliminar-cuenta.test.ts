import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAS_PLAZO_BAJA, diasRestantes, solicitudQueBloquea, type SolicitudBaja } from "@/features/cuenta/baja";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";
import { isMarketingPath } from "@/lib/rutas-marketing";

const base: SolicitudBaja = {
  id: "s1",
  user_id: "u1",
  tenant_id: "t1",
  es_dueno: false,
  ejecutar_en: "2026-11-30T12:00:00Z",
  cancelada_en: null,
  ejecutada_en: null,
};

describe("eliminación de cuenta", () => {
  it("el plazo es el mismo que el de la migración 128", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/128_eliminar_cuenta.sql"), "utf8");
    expect(sql).toContain(`INTERVAL '${DIAS_PLAZO_BAJA} days'`);
  });

  it("los contactos se conservan con la versión vigente del aviso de privacidad", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/128_eliminar_cuenta.sql"), "utf8");
    expect(sql).toContain(`'${LEGAL_DOCUMENT_VERSIONS.privacy}'`);
  });

  it("cuenta los días que faltan, nunca negativos", () => {
    expect(diasRestantes("2026-11-30T12:00:00Z", new Date("2026-11-20T12:00:00Z"))).toBe(10);
    expect(diasRestantes("2026-11-30T12:00:00Z", new Date("2026-12-01T00:00:00Z"))).toBe(0);
  });

  it("bloquea a quien la pidió", () => {
    expect(solicitudQueBloquea([base], "u1", "t1")).toEqual({ solicitud: base, propia: true });
  });

  it("si el dueño cierra el negocio, bloquea a todo el equipo; la de un colaborador no", () => {
    const delDueno = { ...base, user_id: "dueno", es_dueno: true };
    expect(solicitudQueBloquea([delDueno], "u2", "t1")).toEqual({ solicitud: delDueno, propia: false });
    expect(solicitudQueBloquea([base], "u2", "t1")).toBeNull();
    expect(solicitudQueBloquea([delDueno], "u2", "otro-negocio")).toBeNull();
  });

  it("una cancelada o ya ejecutada no bloquea", () => {
    expect(solicitudQueBloquea([{ ...base, cancelada_en: "2026-11-01T00:00:00Z" }], "u1", "t1")).toBeNull();
    expect(solicitudQueBloquea([{ ...base, ejecutada_en: "2026-11-30T13:00:00Z" }], "u1", "t1")).toBeNull();
  });

  it("la página para pedirla es pública (Google Play la exige sin sesión)", () => {
    expect(isMarketingPath("/es/eliminar-cuenta")).toBe(true);
  });
});
