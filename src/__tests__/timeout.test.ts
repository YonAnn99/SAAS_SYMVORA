import { describe, expect, it, vi } from "vitest";
import {
  TIMEOUTS,
  TimeoutError,
  timeoutSignal,
  withTimeout,
} from "@/lib/http/timeout";

/**
 * Lo que fija este archivo es la propiedad que motivo el helper: una llamada a
 * un tercero que no responde tiene que RECHAZAR dentro de su presupuesto, no
 * quedarse esperando. Sin eso, la funcion serverless se ocupa hasta el tope de
 * la plataforma y un proveedor lento se convierte en una caida propia.
 */
describe("withTimeout", () => {
  it("rechaza con TimeoutError cuando el proveedor no responde a tiempo", async () => {
    vi.useFakeTimers();
    try {
      // Promesa que nunca se resuelve: es el caso real de un socket colgado.
      const colgada = new Promise<string>(() => {});
      const resultado = withTimeout(colgada, 5_000, "ProveedorLento");

      const expectativa = expect(resultado).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(5_000);
      await expectativa;
    } finally {
      vi.useRealTimers();
    }
  });

  it("el error dice quien fallo y con que presupuesto", async () => {
    vi.useFakeTimers();
    try {
      const resultado = withTimeout(new Promise<string>(() => {}), 1_500, "Resend");
      const expectativa = expect(resultado).rejects.toThrow(
        "Resend no respondio en 1500ms"
      );
      await vi.advanceTimersByTimeAsync(1_500);
      await expectativa;
    } finally {
      vi.useRealTimers();
    }
  });

  it("deja pasar el valor cuando responde dentro del presupuesto", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1_000, "X")).resolves.toBe("ok");
  });

  it("propaga el error original del proveedor sin convertirlo en timeout", async () => {
    const fallo = new Error("tarjeta rechazada");
    await expect(withTimeout(Promise.reject(fallo), 1_000, "Conekta")).rejects.toBe(
      fallo
    );
  });

  it("no deja el temporizador vivo tras resolverse", async () => {
    vi.useFakeTimers();
    try {
      await withTimeout(Promise.resolve("ok"), 10_000, "X");
      // Si el clearTimeout faltara, quedaria un temporizador pendiente y la
      // funcion serverless no podria terminar limpiamente.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("timeoutSignal", () => {
  it("se aborta al agotarse el presupuesto", async () => {
    const signal = timeoutSignal(20);
    expect(signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(signal.aborted).toBe(true);
  });

  it("respeta una señal previa: si el cliente cancela, la peticion se aborta ya", () => {
    const controlador = new AbortController();
    const signal = timeoutSignal(10_000, controlador.signal);
    expect(signal.aborted).toBe(false);
    controlador.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe("TIMEOUTS", () => {
  it("todo proveedor tiene un presupuesto finito y positivo", () => {
    for (const [proveedor, ms] of Object.entries(TIMEOUTS)) {
      expect(ms, proveedor).toBeGreaterThan(0);
      expect(Number.isFinite(ms), proveedor).toBe(true);
    }
  });

  it("el PAC tiene mas margen que el resto: el timbrado es legitimamente lento", () => {
    // Si alguien baja este valor al de los demas, se cortarian timbrados
    // validos — que es peor que esperar.
    expect(TIMEOUTS.pac).toBeGreaterThan(TIMEOUTS.conekta);
    expect(TIMEOUTS.pac).toBeGreaterThan(TIMEOUTS.resend);
  });
});
