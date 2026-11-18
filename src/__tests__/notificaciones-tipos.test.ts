import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TIPOS_NOTIFICACION } from "@/lib/notificaciones";

/**
 * Los tipos que conoce la campana tienen que ser exactamente los que acepta el
 * CHECK de `notificaciones.tipo`, en la migración MÁS RECIENTE que lo define
 * (hoy la 137). Un tipo que la base acepta y la campana no conoce saldría con el
 * icono por defecto.
 */
const PATRON_CHECK = /ADD CONSTRAINT notificaciones_tipo_check CHECK \(tipo IN \(([\s\S]*?)\)\)/;

function ultimoCheck(): { archivo: string; sql: string } {
  const carpeta = join(process.cwd(), "supabase/migrations");
  const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const archivo of archivos) {
    const sql = readFileSync(join(carpeta, archivo), "utf8");
    if (PATRON_CHECK.test(sql)) return { archivo, sql };
  }
  throw new Error("Ninguna migración define notificaciones_tipo_check");
}
describe("tipos de notificación", () => {
  it("coinciden con el CHECK de la migración más reciente", () => {
    const { archivo, sql } = ultimoCheck();
    expect(archivo >= "137").toBe(true);
    const check = sql.match(PATRON_CHECK);
    expect(check).not.toBeNull();
    const enBase = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...TIPOS_NOTIFICACION].sort()).toEqual(enBase);
  });

  it("incluye la venta cancelada por un colaborador (137)", () => {
    expect(TIPOS_NOTIFICACION).toContain("venta_cancelada");
  });

  it("incluye el aviso de novedad (126)", () => {
    expect(TIPOS_NOTIFICACION).toContain("novedad");
  });

  it("incluye el alta con el QR del local (121)", () => {
    expect(TIPOS_NOTIFICACION).toContain("lealtad_alta");
  });

  it("incluye los avisos de lotes y caducidades", () => {
    for (const tipo of ["lote_por_caducar", "lote_caducado", "lote", "insumo_faltante"]) {
      expect(TIPOS_NOTIFICACION).toContain(tipo);
    }
  });
});
