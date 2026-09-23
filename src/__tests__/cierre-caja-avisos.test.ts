import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// El modulo de servidor importa el cliente de Supabase al cargarse; aqui solo
// se prueban sus funciones de fechas, que no lo usan.
vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

import {
  getCdmxMidnight,
  horaCierreAutomatico,
  isRegisterFromPreviousDay,
} from "@/features/cash-register/services/cash-register-server-service";
import {
  debeAvisarCierreManual,
  destinatariosCierreAutomatico,
} from "@/features/cash-register/avisos-cierre";
import { construirCorreoCierreCaja, type DatosCierreCaja } from "@/lib/email";

/**
 * El cierre automatico fallo EN PRODUCCION por la zona horaria: los tests
 * viejos pasaban porque la maquina del desarrollador esta en hora de CDMX, y
 * Vercel corre en UTC. Por eso todo lo de fechas se prueba en LAS DOS zonas.
 */
describe.each(["UTC", "America/Mexico_City"])("cierre automático con el servidor en %s", (zona) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zona;
  });
  afterAll(() => {
    process.env.TZ = original;
    vi.useRealTimers();
  });

  it("la medianoche de CDMX es la misma en cualquier servidor", () => {
    // 23 sep 00:38 CDMX = 06:38 UTC -> empezo el dia a las 06:00 UTC.
    expect(getCdmxMidnight(new Date("2026-09-23T06:38:00Z")).toISOString()).toBe(
      "2026-09-23T06:00:00.000Z"
    );
    // 23 sep 23:59 CDMX = 24 sep 05:59 UTC: sigue siendo el dia 23 en Mexico.
    expect(getCdmxMidnight(new Date("2026-09-24T05:59:00Z")).toISOString()).toBe(
      "2026-09-23T06:00:00.000Z"
    );
  });

  it("ESTE es el que falló: abierta a las 21:21 y el cron pasada la medianoche → se cierra", () => {
    // Caja real de Pruebas SYMVORA: 22 sep 21:21 CDMX. El cron corrio el 23 a
    // las 00:38 CDMX y NO la cerro, porque en UTC el corte caia a las 18:00.
    vi.setSystemTime(new Date("2026-09-23T06:38:00Z"));
    expect(isRegisterFromPreviousDay("2026-09-23T03:21:43Z")).toBe(true);
    vi.useRealTimers();
  });

  it("una caja abierta hoy no se cierra", () => {
    vi.setSystemTime(new Date("2026-09-23T18:00:00Z")); // 12:00 CDMX del 23
    expect(isRegisterFromPreviousDay("2026-09-23T15:00:00Z")).toBe(false); // 09:00 CDMX
    vi.useRealTimers();
  });

  it("la hora de cierre guardada es las 23:59:59 del día que terminó", () => {
    const corte = getCdmxMidnight(new Date("2026-09-24T06:12:00Z"));
    expect(horaCierreAutomatico(corte).toISOString()).toBe("2026-09-24T05:59:59.000Z");
  });
});

describe("a quién se avisa del cierre", () => {
  it("automático de un cajero: a él y al dueño", () => {
    expect(
      destinatariosCierreAutomatico({
        userEmail: "ana@x.com",
        userRole: "CAJERO",
        superAdminEmail: "dueno@x.com",
      })
    ).toEqual({ usuario: "ana@x.com", superAdmin: "dueno@x.com" });
  });

  it("ESTE es el importante: automático de la caja del dueño → un solo correo", () => {
    expect(
      destinatariosCierreAutomatico({
        userEmail: "Dueno@x.com",
        userRole: "SUPER_ADMIN",
        superAdminEmail: "dueno@x.com",
      })
    ).toEqual({ usuario: null, superAdmin: "dueno@x.com" });
  });

  it("manual: se avisa si cierra un cajero o un administrador, no si cierra el dueño", () => {
    expect(debeAvisarCierreManual("CAJERO")).toBe(true);
    expect(debeAvisarCierreManual("ORG_ADMIN")).toBe(true);
    expect(debeAvisarCierreManual("SUPER_ADMIN")).toBe(false);
  });
});

describe("correo del corte al dueño", () => {
  const base: DatosCierreCaja = {
    businessName: "Pruebas SYMVORA",
    sucursalNombre: null,
    userName: "Ana López",
    userRole: "CAJERO",
    userEmail: "ana@x.com",
    fechaApertura: "2026-09-23T15:00:00Z",
    fechaCierre: "2026-09-24T03:00:00Z",
    fondoInicial: 200,
    totalVentas: 1500,
    totalEntradas: 100,
    totalSalidas: 50,
    saldoEsperado: 1750,
    saldoReal: 1700,
    diferencia: -50,
    notasCierre: null,
  };

  it("lleva todas las cifras del corte y quién cerró", () => {
    const { subject, html } = construirCorreoCierreCaja(base);
    expect(subject).toContain("Ana López (Cajero)");
    for (const texto of ["Fondo inicial", "Ventas", "Entradas", "Salidas", "Saldo esperado", "Saldo real", "Diferencia"]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain("Faltan");
  });

  it("sin varias sucursales no menciona ninguna", () => {
    const { subject, html } = construirCorreoCierreCaja(base);
    expect(subject).not.toContain(" en ");
    expect(html).not.toContain("Principal");
  });

  it("con varias sucursales dice cuál", () => {
    const { subject, html } = construirCorreoCierreCaja({ ...base, sucursalNombre: "Norte" });
    expect(subject).toContain("en Norte");
    expect(html).toContain("Norte");
  });

  it("si cuadra lo dice, y lo que escribe el usuario va escapado", () => {
    const { subject, html } = construirCorreoCierreCaja({
      ...base,
      saldoReal: 1750,
      diferencia: 0,
      notasCierre: '<a href="http://malo">clic</a>',
    });
    expect(subject).toContain("Cuadra");
    expect(html).not.toContain('<a href="http://malo">');
    expect(html).toContain("&lt;a href=");
  });
});
