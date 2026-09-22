import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCdmxDate,
  getCdmxMidnight,
  isRegisterFromPreviousDay,
} from "@/features/cash-register/services/cash-register-server-service";

describe("Auto-close caja - CDMX timezone logic", () => {
  // Helper to create a date in CDMX timezone
  const cdmx = (iso: string) => new Date(iso);

  describe("getCdmxDate", () => {
    it("returns correct CDMX date for UTC midnight", () => {
      // 2026-01-15T06:00:00.000Z = 2026-01-15T00:00:00-06:00 (CDMX)
      const utc = new Date("2026-01-15T06:00:00.000Z");
      const result = getCdmxDate(utc);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January = 0
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("handles date rollover at midnight UTC", () => {
      // 2026-01-15T05:59:59.000Z = 2026-01-14T23:59:59-06:00 (still 14th in CDMX)
      const utc = new Date("2026-01-15T05:59:59.000Z");
      const result = getCdmxDate(utc);
      expect(result.getDate()).toBe(14);
    });
  });

  describe("getCdmxMidnight", () => {
    it("returns midnight CDMX for given date", () => {
      const utc = new Date("2026-01-15T12:30:00.000Z"); // 06:30 CDMX same day
      const midnight = getCdmxMidnight(utc);
      // Should be 2026-01-15T00:00:00-06:00 = 2026-01-15T06:00:00.000Z
      expect(midnight.getUTCHours()).toBe(6);
      expect(midnight.getUTCMinutes()).toBe(0);
      expect(midnight.getUTCSeconds()).toBe(0);
    });

    it("uses current time when no date provided", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const midnight = getCdmxMidnight();
      expect(midnight.getUTCHours()).toBe(6);
      expect(midnight.getUTCMinutes()).toBe(0);
      expect(midnight.getUTCSeconds()).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("isRegisterFromPreviousDay", () => {
    it("returns true for register opened yesterday in CDMX", () => {
      // Register opened 2026-01-14T10:00:00-06:00 (CDMX)
      // Today is 2026-01-15 in CDMX
      const fechaApertura = "2026-01-14T16:00:00.000Z"; // 10:00 CDMX
      vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z")); // 06:00 CDMX 15th
      expect(isRegisterFromPreviousDay(fechaApertura)).toBe(true);
      vi.useRealTimers();
    });

    it("returns false for register opened today in CDMX", () => {
      // Register opened 2026-01-15T10:00:00-06:00 (CDMX)
      // Today is 2026-01-15 in CDMX
      const fechaApertura = "2026-01-15T16:00:00.000Z"; // 10:00 CDMX
      vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z")); // 06:00 CDMX 15th
      expect(isRegisterFromPreviousDay(fechaApertura)).toBe(false);
      vi.useRealTimers();
    });

    it("returns true for register opened at 23:59 yesterday", () => {
      // Register opened 2026-01-14T23:59:00-06:00 (CDMX) = 2026-01-15T05:59:00Z
      // Today is 2026-01-15 in CDMX
      const fechaApertura = "2026-01-15T05:59:00.000Z";
      vi.setSystemTime(new Date("2026-01-15T06:00:00.000Z")); // 00:00 CDMX 15th
      expect(isRegisterFromPreviousDay(fechaApertura)).toBe(true);
      vi.useRealTimers();
    });

    it("returns false for register opened at 00:01 today", () => {
      // Register opened 2026-01-15T00:01:00-06:00 (CDMX) = 2026-01-15T06:01:00Z
      // Today is 2026-01-15 in CDMX
      const fechaApertura = "2026-01-15T06:01:00.000Z";
      vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z")); // 06:00 CDMX 15th
      expect(isRegisterFromPreviousDay(fechaApertura)).toBe(false);
      vi.useRealTimers();
    });

    it("handles year boundary correctly", () => {
      // Register opened 2025-12-31T23:00:00-06:00 (CDMX)
      // Today is 2026-01-01 in CDMX
      const fechaApertura = "2026-01-01T05:00:00.000Z";
      vi.setSystemTime(new Date("2026-01-01T06:00:00.000Z")); // 00:00 CDMX 2026-01-01
      expect(isRegisterFromPreviousDay(fechaApertura)).toBe(true);
      vi.useRealTimers();
    });
  });
});

describe("Auto-close caja - calculateRegisterTotals", () => {
  it("calculates totals correctly excluding VENTA type", () => {
    const movements: MovimientoCaja[] = [
      { tipo: "ENTRADA", monto: 100, descripcion: "Test", fecha: "", caja_id: "", id: "" },
      { tipo: "SALIDA", monto: 50, descripcion: "Test", fecha: "", caja_id: "", id: "" },
      { tipo: "VENTA", monto: 500, descripcion: "Test", fecha: "", caja_id: "", id: "" },
      { tipo: "ENTRADA", monto: 200, descripcion: "Test", fecha: "", caja_id: "", id: "" },
    ];

    const { totalEntradas, totalSalidas } = calculateRegisterTotals(movements);
    expect(totalEntradas).toBe(300);
    expect(totalSalidas).toBe(50);
  });

  it("handles empty array", () => {
    const { totalEntradas, totalSalidas } = calculateRegisterTotals([]);
    expect(totalEntradas).toBe(0);
    expect(totalSalidas).toBe(0);
  });

  it("handles only VENTA movements", () => {
    const movements: MovimientoCaja[] = [
      { tipo: "VENTA", monto: 500, descripcion: "Test", fecha: "", caja_id: "", id: "" },
      { tipo: "VENTA", monto: 300, descripcion: "Test", fecha: "", caja_id: "", id: "" },
    ];

    const { totalEntradas, totalSalidas } = calculateRegisterTotals(movements);
    expect(totalEntradas).toBe(0);
    expect(totalSalidas).toBe(0);
  });
});

// Re-export calculateRegisterTotals for testing
import { calculateRegisterTotals } from "@/features/cash-register/services/cash-register-service";
import type { MovimientoCaja } from "@/features/cash-register/types/cash-register.types";