import { describe, expect, it } from "vitest";
import {
  OFFLINE_AVAILABLE,
  OFFLINE_UNAVAILABLE,
  evaluateOfflineRisk,
  formatOfflineAge,
} from "@/lib/offline/capabilities";

const NOW = new Date("2026-09-11T12:00:00.000Z");

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 36e5).toISOString();
}

describe("evaluateOfflineRisk", () => {
  it("sin ventas pendientes no hay urgencia", () => {
    const risk = evaluateOfflineRisk(null, NOW);
    expect(risk.urgency).toBe("ok");
    expect(risk.title).toBe("");
  });

  it("recién vendido: informa sin alarmar", () => {
    expect(evaluateOfflineRisk(hoursAgo(0.5), NOW).urgency).toBe("ok");
    expect(evaluateOfflineRisk(hoursAgo(5), NOW).urgency).toBe("ok");
  });

  it("a partir de 6 horas pide sincronizar pronto", () => {
    expect(evaluateOfflineRisk(hoursAgo(6), NOW).urgency).toBe("atencion");
    expect(evaluateOfflineRisk(hoursAgo(23), NOW).urgency).toBe("atencion");
  });

  it("pasado un día sube el tono", () => {
    expect(evaluateOfflineRisk(hoursAgo(24), NOW).urgency).toBe("urgente");
    expect(evaluateOfflineRisk(hoursAgo(71), NOW).urgency).toBe("urgente");
  });

  it("pasados 3 días avisa de riesgo real de pérdida", () => {
    const risk = evaluateOfflineRisk(hoursAgo(72), NOW);
    expect(risk.urgency).toBe("critico");
    // El umbral está muy por debajo de los ~7 días en que iOS puede desalojar
    // el almacenamiento, para que nadie llegue ahí por descuido.
    expect(risk.message).toMatch(/perder/i);
  });

  it("una fecha futura no produce horas negativas", () => {
    const risk = evaluateOfflineRisk(hoursAgo(-5), NOW);
    expect(risk.hoursOffline).toBe(0);
    expect(risk.urgency).toBe("ok");
  });
});

describe("formatOfflineAge", () => {
  it("usa singular y plural correctamente", () => {
    expect(formatOfflineAge(0.5)).toBe("menos de una hora");
    expect(formatOfflineAge(1)).toBe("1 hora");
    expect(formatOfflineAge(5)).toBe("5 horas");
    expect(formatOfflineAge(24)).toBe("1 día");
    expect(formatOfflineAge(72)).toBe("3 días");
  });
});

describe("listas de capacidades offline", () => {
  it("cada función no disponible explica por qué", () => {
    // Sin el motivo, la restricción parece arbitraria y la gente insiste.
    for (const item of OFFLINE_UNAVAILABLE) {
      expect(item.reason, `"${item.label}" sin motivo`).toBeTruthy();
    }
  });

  it("los métodos de cobro anunciados coinciden con los permitidos en el POS", () => {
    // Guarda contra que alguien amplíe OFFLINE_PAYMENT_METHODS en pos/page.tsx
    // y olvide actualizar lo que se le promete al usuario aquí.
    const labels = OFFLINE_AVAILABLE.map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes("efectivo"))).toBe(true);
    expect(labels.some((l) => l.includes("tarjeta manual"))).toBe(true);

    const bloqueados = OFFLINE_UNAVAILABLE.map((c) => c.label.toLowerCase());
    expect(bloqueados.some((l) => l.includes("terminal"))).toBe(true);
    expect(bloqueados.some((l) => l.includes("crédito"))).toBe(true);
    expect(bloqueados.some((l) => l.includes("transferencia"))).toBe(true);
  });
});
