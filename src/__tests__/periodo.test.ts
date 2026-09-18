import { describe, expect, it } from "vitest";
import {
  endOfDay,
  esPeriodo,
  getDaysInMonth,
  getFirstDayOfMonth,
  isDateAfterOrEqual,
  isSameDay,
  PERIODOS,
  rangoDePeriodo,
  startOfDay,
  type Periodo,
} from "@/lib/periodo";

/**
 * Este cálculo vivía dentro de un `useCallback` de la página de Reportes y no
 * tenía ni un test. Al compartirlo con el historial de ventas, un error aquí
 * ya no descuadra una gráfica: descuadra la gráfica Y el listado, cada uno a
 * su manera, y sin que nada avise.
 *
 * `ahora` se fija a un miércoles al mediodía para que los resultados no
 * dependan de cuándo se ejecute la batería.
 */
const AHORA = new Date(2026, 8, 16, 12, 30, 45, 123); // mié 16 sep 2026, 12:30

/** `YYYY-MM-DD HH:mm:ss.SSS` en hora local, para comparar sin ambigüedad. */
function sello(d: Date): string {
  const p = (n: number, ancho = 2) => String(n).padStart(ancho, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
  );
}

describe("rangoDePeriodo", () => {
  it("«este mes» va del día 1 a hoy completo", () => {
    const r = rangoDePeriodo("mes", null, AHORA)!;
    expect(sello(r.desde)).toBe("2026-09-01 00:00:00.000");
    expect(sello(r.hasta)).toBe("2026-09-16 23:59:59.999");
  });

  it("«última semana» cuenta siete días INCLUYENDO hoy", () => {
    // Del 10 al 16 son siete días. Restar 7 en vez de 6 metería un día de más
    // y el total de la semana no cuadraría con la suma de sus días.
    const r = rangoDePeriodo("semana", null, AHORA)!;
    expect(sello(r.desde)).toBe("2026-09-10 00:00:00.000");
    expect(sello(r.hasta)).toBe("2026-09-16 23:59:59.999");
  });

  it("«último trimestre» retrocede tres meses", () => {
    const r = rangoDePeriodo("trimestre", null, AHORA)!;
    expect(sello(r.desde)).toBe("2026-06-16 00:00:00.000");
    expect(sello(r.hasta)).toBe("2026-09-16 23:59:59.999");
  });

  it("«último año» retrocede un año", () => {
    const r = rangoDePeriodo("ano", null, AHORA)!;
    expect(sello(r.desde)).toBe("2025-09-16 00:00:00.000");
    expect(sello(r.hasta)).toBe("2026-09-16 23:59:59.999");
  });

  it("«día específico» cubre ese día entero, no el de hoy", () => {
    const elegido = new Date(2026, 2, 5, 17, 45);
    const r = rangoDePeriodo("dia", elegido, AHORA)!;
    expect(sello(r.desde)).toBe("2026-03-05 00:00:00.000");
    expect(sello(r.hasta)).toBe("2026-03-05 23:59:59.999");
  });

  it("«día específico» sin fecha elegida devuelve null, no revienta", () => {
    // No es un error: el usuario todavía no ha escogido día en el calendario.
    // Antes esta rama hacía `setLoading(false); return;` desde dentro del
    // cálculo, y por eso no se podía probar.
    expect(rangoDePeriodo("dia", null, AHORA)).toBeNull();
  });

  it("todo rango empieza a las 00:00 y termina a las 23:59:59.999", () => {
    // Si `hasta` se quedara a las 00:00, las ventas del propio día quedarían
    // fuera del reporte y del historial.
    for (const { valor } of PERIODOS) {
      const r = rangoDePeriodo(valor, AHORA, AHORA)!;
      expect(r.desde.getHours()).toBe(0);
      expect(r.desde.getMinutes()).toBe(0);
      expect(r.hasta.getHours()).toBe(23);
      expect(r.hasta.getMinutes()).toBe(59);
      expect(r.hasta.getMilliseconds()).toBe(999);
    }
  });

  it("en todos los periodos el inicio es anterior al fin", () => {
    for (const { valor } of PERIODOS) {
      const r = rangoDePeriodo(valor, AHORA, AHORA)!;
      expect(r.desde.getTime()).toBeLessThan(r.hasta.getTime());
    }
  });

  it("no altera la fecha que recibe", () => {
    // `setDate`/`setMonth` mutan; si operaran sobre el original, la página
    // acabaría con un `new Date()` movido tres meses atrás.
    const original = new Date(AHORA);
    rangoDePeriodo("trimestre", null, AHORA);
    rangoDePeriodo("ano", null, AHORA);
    expect(AHORA.getTime()).toBe(original.getTime());
  });

  it("el cambio de año se resuelve solo", () => {
    const enero = new Date(2026, 0, 10, 9, 0);
    const r = rangoDePeriodo("trimestre", null, enero)!;
    expect(sello(r.desde)).toBe("2025-10-10 00:00:00.000");
  });
});

describe("esPeriodo", () => {
  it("acepta los cinco periodos del desplegable", () => {
    for (const { valor } of PERIODOS) expect(esPeriodo(valor)).toBe(true);
  });

  it("rechaza cualquier otra cosa", () => {
    for (const v of ["", "día", "week", "MES", "trimestral"]) {
      expect(esPeriodo(v)).toBe(false);
    }
  });

  it("la lista del desplegable cubre exactamente el tipo", () => {
    // Si alguien añade un periodo al tipo sin añadirlo aquí, queda una opción
    // inalcanzable; al revés, una opción que revienta al elegirla.
    const delTipo: Periodo[] = ["dia", "semana", "mes", "trimestre", "ano"];
    expect(PERIODOS.map((p) => p.valor).sort()).toEqual(delTipo.sort());
  });
});

describe("ayudantes de fecha", () => {
  it("startOfDay y endOfDay no mutan el original", () => {
    const d = new Date(2026, 5, 15, 13, 20);
    const copia = new Date(d);
    startOfDay(d);
    endOfDay(d);
    expect(d.getTime()).toBe(copia.getTime());
  });

  it("getDaysInMonth resuelve febrero y los años bisiestos", () => {
    expect(getDaysInMonth(2026, 1)).toBe(28);
    expect(getDaysInMonth(2028, 1)).toBe(29);
    expect(getDaysInMonth(2026, 0)).toBe(31);
    expect(getDaysInMonth(2026, 3)).toBe(30);
  });

  it("getFirstDayOfMonth empieza la semana en lunes", () => {
    // 1 de marzo de 2026 es domingo: con lunes primero, le toca la casilla 6.
    expect(getFirstDayOfMonth(2026, 2)).toBe(6);
    // 1 de junio de 2026 es lunes: casilla 0.
    expect(getFirstDayOfMonth(2026, 5)).toBe(0);
  });

  it("isSameDay ignora la hora", () => {
    expect(isSameDay(new Date(2026, 8, 16, 1), new Date(2026, 8, 16, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 16), new Date(2026, 8, 17))).toBe(false);
  });

  it("isDateAfterOrEqual compara por día, no por instante", () => {
    const manana = new Date(2026, 8, 16, 8, 0);
    const tarde = new Date(2026, 8, 16, 20, 0);
    expect(isDateAfterOrEqual(manana, tarde)).toBe(true);
    expect(isDateAfterOrEqual(new Date(2026, 8, 15), tarde)).toBe(false);
  });
});
