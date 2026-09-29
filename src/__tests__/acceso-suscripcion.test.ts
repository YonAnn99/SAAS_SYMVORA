import { describe, expect, it } from "vitest";
import {
  calcularAcceso,
  diasDeGracia,
  inicioSoloLectura,
  limiteConservacion,
  type DatosAcceso,
} from "@/lib/acceso-suscripcion";

const AHORA = new Date("2026-10-10T12:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
const en = (dias: number) => hace(-dias);

const base: DatosAcceso = {
  estado: null,
  trial_end: null,
  current_period_end: null,
  past_due_desde: null,
  updated_at: null,
};

describe("calcularAcceso (espejo de acceso_tenant)", () => {
  it("sin estado: completo", () => {
    expect(calcularAcceso(base, AHORA)).toBe("completo");
  });

  it("prueba vigente completa; vencida pasa directo a solo lectura (sin gracia)", () => {
    expect(calcularAcceso({ ...base, estado: "trial", trial_end: en(2) }, AHORA)).toBe("completo");
    expect(calcularAcceso({ ...base, estado: "trial", trial_end: hace(1) }, AHORA)).toBe("solo_lectura");
  });

  it("activa: completa en su periodo, gracia 3 dias despues, luego solo lectura", () => {
    const activa = { ...base, estado: "active" };
    expect(calcularAcceso(activa, AHORA)).toBe("completo"); // sin fecha (tarjeta antigua)
    expect(calcularAcceso({ ...activa, current_period_end: en(5) }, AHORA)).toBe("completo");
    expect(calcularAcceso({ ...activa, current_period_end: hace(2) }, AHORA)).toBe("gracia");
    expect(calcularAcceso({ ...activa, current_period_end: hace(4) }, AHORA)).toBe("solo_lectura");
  });

  it("cobro fallido: 3 dias de gracia desde el primer fallo", () => {
    const vencida = { ...base, estado: "past_due" };
    expect(calcularAcceso({ ...vencida, past_due_desde: hace(1) }, AHORA)).toBe("gracia");
    expect(calcularAcceso({ ...vencida, past_due_desde: hace(3.5) }, AHORA)).toBe("solo_lectura");
    // Sin past_due_desde cae a updated_at.
    expect(calcularAcceso({ ...vencida, updated_at: hace(5) }, AHORA)).toBe("solo_lectura");
  });

  it("cancelada: conserva lo pagado hasta el fin del periodo", () => {
    const cancelada = { ...base, estado: "canceled" };
    expect(calcularAcceso({ ...cancelada, current_period_end: en(20) }, AHORA)).toBe("completo");
    expect(calcularAcceso({ ...cancelada, current_period_end: hace(1) }, AHORA)).toBe("solo_lectura");
    expect(calcularAcceso(cancelada, AHORA)).toBe("solo_lectura");
  });

  it("expirada: solo lectura", () => {
    expect(calcularAcceso({ ...base, estado: "expired" }, AHORA)).toBe("solo_lectura");
  });
});

describe("dias de gracia y plazos", () => {
  it("cuenta los dias que quedan de gracia", () => {
    expect(diasDeGracia({ ...base, estado: "past_due", past_due_desde: hace(1) }, AHORA)).toBe(2);
    expect(diasDeGracia({ ...base, estado: "active", current_period_end: en(3) }, AHORA)).toBe(0);
  });

  it("la solo lectura empieza al terminar la gracia y los datos se conservan 30 dias", () => {
    const d = { ...base, estado: "past_due", past_due_desde: hace(10) };
    expect(inicioSoloLectura(d, AHORA)?.toISOString()).toBe(hace(7));
    expect(limiteConservacion(d, AHORA)?.toISOString()).toBe(en(23));
  });

  it("en una prueba vencida el plazo corre desde el fin de la prueba", () => {
    const d = { ...base, estado: "trial", trial_end: hace(5) };
    expect(inicioSoloLectura(d, AHORA)?.toISOString()).toBe(hace(5));
  });

  it("con acceso completo no hay plazo", () => {
    expect(limiteConservacion({ ...base, estado: "active", current_period_end: en(9) }, AHORA)).toBeNull();
  });
});
