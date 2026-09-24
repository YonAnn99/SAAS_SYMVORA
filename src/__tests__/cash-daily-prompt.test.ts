import { beforeEach, describe, expect, it } from "vitest";
import {
  claveAviso,
  debeEmpujarAFinanzas,
  marcarAvisado,
  yaAvisadoHoy,
} from "@/features/cash-register/daily-prompt";

const ANA = "11111111-1111-1111-1111-111111111111";
const LUIS = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  window.localStorage.clear();
});

describe("clave del aviso", () => {
  it("incluye el id de usuario", () => {
    // LO QUE MÁS IMPORTA AQUÍ: en un mostrador compartido dos cajeros usan el
    // mismo navegador. Con una clave global, el segundo del turno no recibiría
    // el aviso porque el primero ya lo consumió — y es justo quien más lo
    // necesita, porque llega con la caja del anterior ya cerrada.
    const hoy = new Date("2026-09-15T10:00:00");
    expect(claveAviso(ANA, hoy)).not.toBe(claveAviso(LUIS, hoy));
    expect(claveAviso(ANA, hoy)).toContain(ANA);
  });

  it("incluye la fecha, así que cambia cada día", () => {
    expect(claveAviso(ANA, new Date("2026-09-15T10:00:00"))).not.toBe(
      claveAviso(ANA, new Date("2026-09-16T10:00:00"))
    );
  });

  it("usa la fecha LOCAL, no UTC", () => {
    // Con UTC, en México (UTC-6) el día cambiaría a las 18:00 hora local y el
    // turno de noche recibiría el aviso a media jornada.
    const nocheDel15 = new Date(2026, 8, 15, 23, 30); // 23:30 local
    expect(claveAviso(ANA, nocheDel15)).toContain("2026-09-15");
  });
});

describe("ciclo del aviso", () => {
  it("la primera vez del día avisa; la segunda ya no", () => {
    const hoy = new Date("2026-09-15T10:00:00");
    expect(yaAvisadoHoy(ANA, hoy)).toBe(false);
    marcarAvisado(ANA, hoy);
    expect(yaAvisadoHoy(ANA, hoy)).toBe(true);
  });

  it("avisar a un cajero NO consume el aviso del otro", () => {
    const hoy = new Date("2026-09-15T10:00:00");
    marcarAvisado(ANA, hoy);
    expect(yaAvisadoHoy(ANA, hoy)).toBe(true);
    expect(yaAvisadoHoy(LUIS, hoy), "Luis debe recibir el suyo").toBe(false);
  });

  it("al día siguiente vuelve a avisar", () => {
    marcarAvisado(ANA, new Date("2026-09-15T10:00:00"));
    expect(yaAvisadoHoy(ANA, new Date("2026-09-16T09:00:00"))).toBe(false);
  });

  it("no acumula basura: limpia las marcas de días anteriores", () => {
    // Una terminal que nunca se vacía acumularía una entrada por usuario y día
    // para siempre.
    marcarAvisado(ANA, new Date("2026-09-13T10:00:00"));
    marcarAvisado(ANA, new Date("2026-09-14T10:00:00"));
    marcarAvisado(ANA, new Date("2026-09-15T10:00:00"));

    const propias = Object.keys(window.localStorage).filter((k) =>
      k.startsWith("symvora_caja_aviso:")
    );
    expect(propias).toHaveLength(1);
    expect(propias[0]).toContain("2026-09-15");
  });

  it("no toca claves ajenas al limpiar", () => {
    window.localStorage.setItem("symvora_tutorial_step", "3");
    marcarAvisado(ANA, new Date("2026-09-15T10:00:00"));
    expect(window.localStorage.getItem("symvora_tutorial_step")).toBe("3");
  });
});

describe("cuándo empujar a Finanzas", () => {
  // EL CHOQUE (2026-09-24): con una cuenta nueva se abrian a la vez el
  // tutorial, el empujon a Finanzas y el dialogo de abrir caja.
  const base = { hayCaja: false as boolean | null, ruta: "/es/dashboard", tutorialEnCurso: false };

  it("sin caja y sin tutorial: sí", () => {
    expect(debeEmpujarAFinanzas(base)).toBe(true);
  });

  it("ESTE es el importante: con el tutorial en curso, no (él guía)", () => {
    expect(debeEmpujarAFinanzas({ ...base, tutorialEnCurso: true })).toBe(false);
  });

  it("ya en Finanzas, no (sería un bucle)", () => {
    expect(debeEmpujarAFinanzas({ ...base, ruta: "/es/finances" })).toBe(false);
    expect(debeEmpujarAFinanzas({ ...base, ruta: "/finances" })).toBe(false);
  });

  it("con caja abierta o sin poder saberlo, no", () => {
    expect(debeEmpujarAFinanzas({ ...base, hayCaja: true })).toBe(false);
    expect(debeEmpujarAFinanzas({ ...base, hayCaja: null })).toBe(false);
  });
});
