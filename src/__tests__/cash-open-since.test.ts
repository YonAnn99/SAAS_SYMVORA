import { describe, expect, it } from "vitest";
import {
  formatearApertura,
  tiempoAbierta,
} from "@/features/cash-register/open-since";

const AHORA = new Date("2026-09-15T14:00:00");
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe("tiempoAbierta", () => {
  it("recién abierta no dice 'hace 0 minutos'", () => {
    // "Abierta hace 0 min" se lee como un error del sistema.
    expect(tiempoAbierta(hace(5_000), AHORA)).toBe("Abierta hace un momento");
    expect(tiempoAbierta(hace(59_000), AHORA)).toBe("Abierta hace un momento");
  });

  it("minutos por debajo de una hora", () => {
    expect(tiempoAbierta(hace(1 * MIN), AHORA)).toBe("Abierta hace 1 minuto");
    expect(tiempoAbierta(hace(25 * MIN), AHORA)).toBe("Abierta hace 25 minutos");
    expect(tiempoAbierta(hace(59 * MIN), AHORA)).toBe("Abierta hace 59 minutos");
  });

  it("horas y minutos por encima de una hora", () => {
    expect(tiempoAbierta(hace(HORA), AHORA)).toBe("Abierta hace 1 hora");
    expect(tiempoAbierta(hace(5 * HORA + 20 * MIN), AHORA)).toBe(
      "Abierta hace 5 horas 20 min"
    );
  });

  it("una hora exacta no añade '0 min'", () => {
    expect(tiempoAbierta(hace(3 * HORA), AHORA)).toBe("Abierta hace 3 horas");
  });

  it("días cuando lleva más de 24 horas", () => {
    // Caso real: en producción hay cajas abiertas desde hace días.
    expect(tiempoAbierta(hace(DIA), AHORA)).toBe("Abierta hace 1 día");
    expect(tiempoAbierta(hace(3 * DIA), AHORA)).toBe("Abierta hace 3 días");
  });

  it("una fecha futura no produce 'hace -3 minutos'", () => {
    // Pasa con el reloj del equipo adelantado respecto al servidor.
    const futuro = new Date(AHORA.getTime() + 10 * MIN);
    expect(tiempoAbierta(futuro, AHORA)).toBe("Abierta hace un momento");
  });

  it("sin fecha devuelve cadena vacía, no basura", () => {
    expect(tiempoAbierta(null, AHORA)).toBe("");
    expect(tiempoAbierta(undefined, AHORA)).toBe("");
    expect(tiempoAbierta("no es una fecha", AHORA)).toBe("");
  });
});

describe("formatearApertura", () => {
  it("da fecha y hora en local, no ISO", () => {
    const texto = formatearApertura(new Date("2026-09-15T09:30:00"));
    expect(texto).not.toContain("T");
    expect(texto).not.toContain("Z");
    expect(texto).toMatch(/2026|septiembre/i);
  });

  it("acepta cadena ISO igual que Date", () => {
    const d = new Date("2026-09-15T09:30:00");
    expect(formatearApertura(d.toISOString())).toBe(formatearApertura(d));
  });

  it("una fecha inválida no muestra 'Invalid Date'", () => {
    // `new Date("cualquier cosa")` no lanza: devuelve Invalid Date, y sin
    // guarda eso acabaría impreso en el tooltip del usuario.
    for (const v of [null, undefined, "", "no es una fecha"]) {
      const texto = formatearApertura(v);
      expect(texto).toBe("Fecha no disponible");
      expect(texto).not.toContain("Invalid");
    }
  });
});
