import { describe, expect, it } from "vitest";
import {
  avisoCobroPendiente,
  columnaAvisoCobro,
  type SuscripcionParaCobro,
} from "@/lib/avisos-cobro";

const AHORA = new Date("2026-10-10T12:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
const en = (dias: number) => hace(-dias);

const base: SuscripcionParaCobro = {
  estado: "active",
  trial_end: hace(60),
  current_period_end: en(20),
  past_due_desde: null,
  updated_at: null,
  last_payment_at: hace(10),
  conekta_subscription_id: null,
  aviso_renovacion_en: null,
  aviso_gracia_en: null,
  aviso_solo_lectura_en: null,
  aviso_regreso_en: null,
  aviso_ultimo_en: null,
};

describe("avisoCobroPendiente", () => {
  it("una prueba que nunca pago no recibe correos de cobro", () => {
    expect(
      avisoCobroPendiente({ ...base, estado: "trial", trial_end: hace(10), last_payment_at: null }, AHORA)
    ).toBeNull();
  });

  it("renovacion: 3 dias antes, solo a quien paga a mano, una vez", () => {
    expect(avisoCobroPendiente({ ...base, current_period_end: en(2) }, AHORA)).toBe("renovacion");
    expect(avisoCobroPendiente({ ...base, current_period_end: en(5) }, AHORA)).toBeNull();
    expect(
      avisoCobroPendiente({ ...base, current_period_end: en(2), conekta_subscription_id: "sub_1" }, AHORA)
    ).toBeNull();
    expect(
      avisoCobroPendiente({ ...base, current_period_end: en(2), aviso_renovacion_en: hace(1) }, AHORA)
    ).toBeNull();
  });

  it("gracia: al fallar el cobro o vencer el mes", () => {
    expect(avisoCobroPendiente({ ...base, estado: "past_due", past_due_desde: hace(1) }, AHORA)).toBe("gracia");
    expect(avisoCobroPendiente({ ...base, current_period_end: hace(1) }, AHORA)).toBe("gracia");
    expect(
      avisoCobroPendiente({ ...base, estado: "past_due", past_due_desde: hace(1), aviso_gracia_en: hace(1) }, AHORA)
    ).toBeNull();
  });

  it("solo lectura, oferta al dia 7 y ultimo aviso al 25", () => {
    // Gracia empezo hace 3+N dias -> N dias en solo lectura.
    const enSoloLectura = (n: number) => ({ ...base, estado: "past_due", past_due_desde: hace(3 + n) });
    expect(avisoCobroPendiente(enSoloLectura(0.5), AHORA)).toBe("solo_lectura");
    expect(avisoCobroPendiente(enSoloLectura(8), AHORA)).toBe("regreso");
    expect(avisoCobroPendiente({ ...enSoloLectura(8), aviso_regreso_en: hace(1) }, AHORA)).toBeNull();
    expect(avisoCobroPendiente(enSoloLectura(26), AHORA)).toBe("ultimo");
    expect(avisoCobroPendiente(enSoloLectura(31), AHORA)).toBeNull();
  });

  it("no manda el aviso de solo lectura con una semana de retraso", () => {
    const tarde = { ...base, estado: "past_due", past_due_desde: hace(12), aviso_regreso_en: hace(1) };
    expect(avisoCobroPendiente(tarde, AHORA)).toBeNull();
  });

  it("cancelada: sin aviso mientras dura lo pagado, luego el ciclo de regreso", () => {
    expect(avisoCobroPendiente({ ...base, estado: "canceled", current_period_end: en(3) }, AHORA)).toBeNull();
    expect(avisoCobroPendiente({ ...base, estado: "canceled", current_period_end: hace(1) }, AHORA)).toBe(
      "solo_lectura"
    );
  });

  it("cada aviso tiene su columna de marca", () => {
    expect(columnaAvisoCobro("regreso")).toBe("aviso_regreso_en");
    expect(columnaAvisoCobro("solo_lectura")).toBe("aviso_solo_lectura_en");
  });
});
