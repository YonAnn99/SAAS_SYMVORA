import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RUTA_SONIDO,
  SONIDO_POR_TIPO,
  elegirSonido,
  type ClaveSonido,
} from "@/features/notificaciones/sonidos";
import { TIPOS_NOTIFICACION } from "@/lib/notificaciones";

describe("sonidos por tipo de notificación", () => {
  it("cada tipo tiene una decisión explícita (sonido o silencio)", () => {
    for (const tipo of TIPOS_NOTIFICACION) {
      expect(SONIDO_POR_TIPO).toHaveProperty(tipo);
    }
  });

  it("los tipos pedidos suenan con su tono y los demás callan", () => {
    expect(SONIDO_POR_TIPO.pedido_nuevo).toBe("pedido-nuevo");
    expect(SONIDO_POR_TIPO.stock_agotado).toBe("stock-agotado");
    expect(SONIDO_POR_TIPO.stock_bajo).toBe("stock-bajo");
    expect(SONIDO_POR_TIPO.novedad).toBe("novedad");
    for (const tipo of ["caja_cerrada", "venta_cancelada", "lote_caducado", "insumo_faltante"] as const) {
      expect(SONIDO_POR_TIPO[tipo]).toBe("atencion");
    }
    for (const tipo of ["producto", "compra", "ajuste", "traspaso", "lealtad_alta"] as const) {
      expect(SONIDO_POR_TIPO[tipo]).toBeNull();
    }
  });

  it("cada tono apunta a un archivo que existe en public/", () => {
    for (const ruta of Object.values(RUTA_SONIDO)) {
      expect(existsSync(join(process.cwd(), "public", ruta))).toBe(true);
    }
  });

  it("si llegan varios avisos juntos gana el de mayor prioridad", () => {
    const claves: ClaveSonido[] = ["novedad", "atencion", "stock-bajo"];
    expect(elegirSonido(claves)).toBe("stock-bajo");
    expect(elegirSonido(["atencion", "pedido-nuevo"])).toBe("pedido-nuevo");
    expect(elegirSonido([])).toBeNull();
  });
});
