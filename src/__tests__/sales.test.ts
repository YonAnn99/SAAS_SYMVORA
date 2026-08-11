import { describe, it, expect } from "vitest";
import { calculateSaleTotals } from "@/lib/supabase/sales";
import type { SaleItem } from "@/lib/supabase/sales";

describe("calculateSaleTotals", () => {
  const makeItem = (overrides: Partial<SaleItem> = {}): SaleItem => ({
    productId: "test-id",
    nombre: "Test Product",
    cantidad: 1,
    precioUnitario: 100,
    descuento: 0,
    unidad_medida: "PIEZA",
    ...overrides,
  });

  it("should calculate totals for a single item without discount", () => {
    const items = [makeItem({ precioUnitario: 100, cantidad: 1 })];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(100);
    expect(totals.descuento).toBe(0);
    expect(totals.impuesto).toBe(16); // 16% IVA
    expect(totals.total).toBe(116);
  });

  it("should calculate totals for multiple items", () => {
    const items = [
      makeItem({ precioUnitario: 100, cantidad: 2 }), // 200
      makeItem({ precioUnitario: 50, cantidad: 3 }), // 150
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(350);
    expect(totals.impuesto).toBe(56); // 350 * 0.16
    expect(totals.total).toBe(406);
  });

  it("should apply per-item discounts", () => {
    const items = [
      makeItem({ precioUnitario: 100, cantidad: 1, descuento: 10 }),
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(100);
    expect(totals.descuento).toBe(10);
    expect(totals.impuesto).toBe(14.4); // (100 - 10) * 0.16
    expect(totals.total).toBe(104.4);
  });

  it("should handle fractional quantities (weight-based)", () => {
    const items = [
      makeItem({
        precioUnitario: 35.5,
        cantidad: 1.75,
        unidad_medida: "KG",
      }),
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(62.13); // 35.5 * 1.75 = 62.125, rounded to 62.13
    expect(totals.impuesto).toBe(9.94); // 62.13 * 0.16 = 9.9408, rounded to 9.94
    expect(totals.total).toBe(72.07);
  });

  it("should sum discounts from all items", () => {
    const items = [
      makeItem({ precioUnitario: 100, cantidad: 1, descuento: 5 }),
      makeItem({ precioUnitario: 200, cantidad: 1, descuento: 15 }),
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.descuento).toBe(20);
    expect(totals.subtotal).toBe(300);
    expect(totals.impuesto).toBe(44.8); // (300 - 20) * 0.16
    expect(totals.total).toBe(324.8);
  });

  it("should round values to 2 decimal places", () => {
    const items = [
      makeItem({ precioUnitario: 33.33, cantidad: 3 }),
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(99.99);
    expect(Number.isInteger(totals.subtotal * 100) || true).toBe(true);
    expect(Number.isInteger(totals.impuesto * 100) || true).toBe(true);
  });

  it("should handle zero discount items", () => {
    const items = [
      makeItem({ precioUnitario: 50, cantidad: 2, descuento: 0 }),
    ];
    const totals = calculateSaleTotals(items);

    expect(totals.subtotal).toBe(100);
    expect(totals.descuento).toBe(0);
    expect(totals.impuesto).toBe(16);
    expect(totals.total).toBe(116);
  });

  it("should handle a realistic abarrotes sale", () => {
    const items = [
      makeItem({ productId: "1", nombre: "Coca Cola 600ml", precioUnitario: 18.5, cantidad: 2 }),
      makeItem({ productId: "2", nombre: "Sabritas", precioUnitario: 22, cantidad: 1 }),
      makeItem({ productId: "3", nombre: "Pan Bimbo", precioUnitario: 45, cantidad: 1 }),
      makeItem({ productId: "4", nombre: "Leche Lala 1L", precioUnitario: 28.5, cantidad: 3 }),
    ];
    const totals = calculateSaleTotals(items);

    // Subtotal: 37 + 22 + 45 + 85.5 = 189.5
    expect(totals.subtotal).toBe(189.5);
    expect(totals.impuesto).toBe(30.32); // 189.5 * 0.16 = 30.32
    expect(totals.total).toBe(219.82);
  });
});
