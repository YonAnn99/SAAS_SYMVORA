import { describe, expect, it } from "vitest";
import {
  tocaOnboardingAtascado,
  tocaPagoAbandonado,
  tocaRegistroAbandonado,
} from "@/lib/seguimiento-whatsapp";
import { detalleAvisoCobro, parametrosPlantilla, textoPlantilla } from "@/lib/whatsapp-plantillas";

const AHORA = new Date("2026-10-01T18:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000).toISOString();

describe("registro abandonado", () => {
  const base = { estado: "borrador", whatsapp_enviado_en: null, actualizado_en: hace(3) };

  it("toca a las 2 horas de dejarlo", () => {
    expect(tocaRegistroAbandonado(base, AHORA)).toBe(true);
    expect(tocaRegistroAbandonado({ ...base, actualizado_en: hace(1) }, AHORA)).toBe(false);
  });

  it("no escribe a un borrador viejo ni dos veces", () => {
    expect(tocaRegistroAbandonado({ ...base, actualizado_en: hace(24 * 4) }, AHORA)).toBe(false);
    expect(tocaRegistroAbandonado({ ...base, whatsapp_enviado_en: hace(1) }, AHORA)).toBe(false);
  });

  it("no escribe a quien ya terminó su registro", () => {
    expect(tocaRegistroAbandonado({ ...base, estado: "completado" }, AHORA)).toBe(false);
  });
});

describe("onboarding atascado", () => {
  const base = { status: "trial", aviso_onboarding_en: null, creado_en: hace(50), productos: 0, ventas: 0 };

  it("toca a las 48 horas sin productos o sin ventas", () => {
    expect(tocaOnboardingAtascado(base, AHORA)).toBe(true);
    expect(tocaOnboardingAtascado({ ...base, productos: 12 }, AHORA)).toBe(true);
    expect(tocaOnboardingAtascado({ ...base, creado_en: hace(30) }, AHORA)).toBe(false);
  });

  it("no toca si ya vende, si ya se avisó o si dejó la prueba", () => {
    expect(tocaOnboardingAtascado({ ...base, productos: 3, ventas: 1 }, AHORA)).toBe(false);
    expect(tocaOnboardingAtascado({ ...base, aviso_onboarding_en: hace(1) }, AHORA)).toBe(false);
    expect(tocaOnboardingAtascado({ ...base, status: "active" }, AHORA)).toBe(false);
  });
});

describe("pago abandonado", () => {
  const base = {
    status: "trial",
    checkout_iniciado_en: hace(13),
    aviso_pago_abandonado_en: null,
    last_payment_at: null,
  };

  it("toca entre 12 y 48 horas después de abrir el pago", () => {
    expect(tocaPagoAbandonado(base, AHORA)).toBe(true);
    expect(tocaPagoAbandonado({ ...base, checkout_iniciado_en: hace(6) }, AHORA)).toBe(false);
    expect(tocaPagoAbandonado({ ...base, checkout_iniciado_en: hace(60) }, AHORA)).toBe(false);
  });

  it("no toca si pagó después del intento o ya está activo", () => {
    expect(tocaPagoAbandonado({ ...base, last_payment_at: hace(2) }, AHORA)).toBe(false);
    expect(tocaPagoAbandonado({ ...base, status: "active" }, AHORA)).toBe(false);
  });

  it("un aviso por intento y no más de uno por semana", () => {
    expect(tocaPagoAbandonado({ ...base, aviso_pago_abandonado_en: hace(1) }, AHORA)).toBe(false);
    expect(tocaPagoAbandonado({ ...base, aviso_pago_abandonado_en: hace(24 * 3) }, AHORA)).toBe(false);
    expect(tocaPagoAbandonado({ ...base, aviso_pago_abandonado_en: hace(24 * 8) }, AHORA)).toBe(true);
  });
});

describe("plantillas de WhatsApp", () => {
  it("ordena y limpia los parámetros como los pide Meta", () => {
    expect(parametrosPlantilla("registro_incompleto", { nombre: "Ana\nMaría", negocio: "  " })).toEqual([
      "Ana María",
      "-",
    ]);
  });

  it("arma el texto final", () => {
    expect(textoPlantilla("cambio_contrasena", { negocio: "Abarrotes Ana", correo: "ana@x.mx" })).toContain(
      "Abarrotes Ana en SYMVORA: se cambió la contraseña de la cuenta ana@x.mx"
    );
  });

  it("explica cada aviso de cobro en una frase", () => {
    expect(detalleAvisoCobro("gracia", { cobroFallido: true })).toContain("no pudimos cobrar");
    expect(detalleAvisoCobro("solo_lectura", {})).toContain("solo lectura");
  });
});
