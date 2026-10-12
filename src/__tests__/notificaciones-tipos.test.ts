import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TIPOS_NOTIFICACION } from "@/lib/notificaciones";

/**
 * Los tipos que conoce la campana tienen que ser exactamente los que acepta el
 * CHECK de `notificaciones.tipo` (última versión: migración 118). Un tipo que
 * la base acepta y la campana no conoce saldría con el icono por defecto.
 */
describe("tipos de notificación", () => {
  it("coinciden con el CHECK de la migración 118", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/118_notificaciones_lotes.sql"),
      "utf8"
    );
    const check = sql.match(/ADD CONSTRAINT notificaciones_tipo_check CHECK \(tipo IN \(([\s\S]*?)\)\)/);
    expect(check).not.toBeNull();
    const enBase = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...TIPOS_NOTIFICACION].sort()).toEqual(enBase);
  });

  it("incluye los avisos de lotes y caducidades", () => {
    for (const tipo of ["lote_por_caducar", "lote_caducado", "lote", "insumo_faltante"]) {
      expect(TIPOS_NOTIFICACION).toContain(tipo);
    }
  });
});
