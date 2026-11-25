import { describe, expect, it } from "vitest";
import {
  DIAS_MAX_REACTIVAR,
  claveActivacion,
  etapaPendiente,
  leerClaveActivacion,
  sePuedeReactivar,
  type CuentaParaActivacion,
  type CuentaParaReactivar,
} from "@/lib/activacion-correos";

const H = 3_600_000;
const D = 24 * H;
const ahora = new Date("2026-11-25T16:00:00Z");
const hace = (ms: number) => new Date(ahora.getTime() - ms);

const base: CuentaParaActivacion = {
  status: "trial",
  esDemo: false,
  pago: false,
  creadaEn: hace(26 * H),
  trialEnd: new Date(ahora.getTime() + 12 * D),
  productos: 0,
  ventas: 0,
  enviados: [],
};

describe("correos de activación: a quién le toca", () => {
  it("sin productos y a las 20 h o más: «primer producto»; antes de 20 h, nada", () => {
    expect(etapaPendiente(base, ahora)).toBe("primer_producto");
    expect(etapaPendiente({ ...base, creadaEn: hace(10 * H) }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, creadaEn: hace(20 * H) }, ahora)).toBe("primer_producto");
  });

  it("con productos y sin ventas, desde los 2 días: «primera venta»", () => {
    expect(etapaPendiente({ ...base, productos: 5, creadaEn: hace(30 * H) }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, productos: 5, creadaEn: hace(3 * D) }, ahora)).toBe("primera_venta");
  });

  it("«ayuda» a partir de los 4 días si sigue sin vender, tras haber recibido el primero", () => {
    const enviados = [{ etapa: "primer_producto" as const, en: hace(3 * D) }];
    expect(etapaPendiente({ ...base, creadaEn: hace(4.5 * D), enviados }, ahora)).toBe("ayuda");
  });

  it("nunca escribe a cuentas viejas: pasada la ventana no sale nada", () => {
    expect(etapaPendiente({ ...base, creadaEn: hace(6 * D) }, ahora)).toBe("ayuda"); // 0 productos, 6 días: ya pasó «primer producto»
    expect(etapaPendiente({ ...base, creadaEn: hace(11 * D) }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, productos: 3, creadaEn: hace(12 * D) }, ahora)).toBeNull();
  });

  it("cada etapa sale una sola vez, con 36 h entre correos y máximo 3", () => {
    const uno = [{ etapa: "primer_producto" as const, en: hace(10 * H) }];
    expect(etapaPendiente({ ...base, creadaEn: hace(4.5 * D), enviados: uno }, ahora)).toBeNull(); // muy pronto
    const viejo = [{ etapa: "primer_producto" as const, en: hace(2 * D) }];
    expect(etapaPendiente({ ...base, creadaEn: hace(26 * H), enviados: viejo }, ahora)).toBeNull(); // ya salió
    const tres = [
      { etapa: "primer_producto" as const, en: hace(8 * D) },
      { etapa: "primera_venta" as const, en: hace(6 * D) },
      { etapa: "ayuda" as const, en: hace(4 * D) },
    ];
    expect(etapaPendiente({ ...base, creadaEn: hace(5 * D), enviados: tres }, ahora)).toBeNull();
  });

  it("no escribe a quien ya vendió, pagó, es demo, no está en prueba o ya venció", () => {
    expect(etapaPendiente({ ...base, ventas: 1 }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, pago: true }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, esDemo: true }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, status: "active" }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, status: "canceled" }, ahora)).toBeNull();
    expect(etapaPendiente({ ...base, trialEnd: hace(1 * H) }, ahora)).toBeNull();
  });

  it("la clave de marca se arma y se lee de vuelta", () => {
    const id = "ab77a437-4493-4312-a8f1-8504d93f76d9";
    expect(leerClaveActivacion(claveActivacion("ayuda", id))).toEqual({ etapa: "ayuda", tenantId: id });
    expect(leerClaveActivacion("novedad-correo:x:y")).toBeNull();
    expect(leerClaveActivacion("activacion:otra:" + id)).toBeNull();
  });
});

describe("reactivar pruebas vencidas", () => {
  const c: CuentaParaReactivar = {
    status: "trial",
    esDemo: false,
    pago: false,
    creadaEn: hace(30 * D),
    trialEnd: hace(16 * D),
    productos: 0,
    ventas: 0,
    yaReactivada: false,
  };
  it("solo prueba vencida, sin pagar, sin productos ni ventas, no demo y no reactivada antes", () => {
    expect(sePuedeReactivar(c, ahora)).toBe(true);
    expect(sePuedeReactivar({ ...c, productos: 1 }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, ventas: 1 }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, pago: true }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, esDemo: true }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, yaReactivada: true }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, status: "canceled" }, ahora)).toBe(false);
  });
  it("una prueba aún vigente no se toca y una muy antigua tampoco", () => {
    expect(sePuedeReactivar({ ...c, trialEnd: new Date(ahora.getTime() + D) }, ahora)).toBe(false);
    expect(sePuedeReactivar({ ...c, creadaEn: hace((DIAS_MAX_REACTIVAR + 1) * D) }, ahora)).toBe(false);
  });
});
