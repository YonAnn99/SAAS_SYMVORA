import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SYNC_ATTEMPTS,
  countPendingSales,
  enqueueSale,
  listPendingSales,
  markSaleFailed,
  markSaleSynced,
  type PendingSale,
} from "@/lib/offline/queue";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";

function buildSale(
  overrides: Partial<Omit<PendingSale, "attempts" | "lastError" | "status">> = {}
) {
  return {
    idempotencyKey: crypto.randomUUID(),
    tenantId: TENANT_A,
    userId: "00000000-0000-0000-0000-000000000002",
    cajaId: "00000000-0000-0000-0000-0000000000ca",
    clienteId: null,
    metodoPago: "EFECTIVO" as const,
    items: [
      {
        productId: "00000000-0000-0000-0000-000000000003",
        nombre: "Coca Cola",
        cantidad: 2,
        precioUnitario: 25,
        descuento: 0,
        unidad_medida: "PIEZA",
      },
    ],
    includeIva: false,
    notas: null,
    montoRecibido: 50,
    totalCobrado: 50,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Base limpia por test: fake-indexeddb persiste entre tests del mismo archivo.
beforeEach(async () => {
  for (const tenant of [TENANT_A, TENANT_B]) {
    const existing = await listPendingSales(tenant);
    await Promise.all(existing.map((s) => markSaleSynced(s.idempotencyKey)));
  }
});

describe("cola de ventas offline", () => {
  it("encola una venta y la reporta como pendiente", async () => {
    await enqueueSale(buildSale());

    const pending = await listPendingSales(TENANT_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(0);
    expect(pending[0].totalCobrado).toBe(50);
  });

  it("aísla las ventas por tenant", async () => {
    await enqueueSale(buildSale());
    await enqueueSale(buildSale({ tenantId: TENANT_B }));

    expect(await countPendingSales(TENANT_A)).toBe(1);
    expect(await countPendingSales(TENANT_B)).toBe(1);
  });

  it("devuelve las ventas en orden cronológico de venta, no de encolado", async () => {
    // Se encolan a propósito en orden inverso: el orden de subida debe salir
    // de `createdAt`, porque cada venta descuenta stock y el histórico tiene
    // que corresponder con lo que pasó en el mostrador.
    await enqueueSale(buildSale({ createdAt: "2026-09-10T12:00:00.000Z" }));
    await enqueueSale(buildSale({ createdAt: "2026-09-10T09:00:00.000Z" }));
    await enqueueSale(buildSale({ createdAt: "2026-09-10T10:30:00.000Z" }));

    const pending = await listPendingSales(TENANT_A);
    expect(pending.map((s) => s.createdAt)).toEqual([
      "2026-09-10T09:00:00.000Z",
      "2026-09-10T10:30:00.000Z",
      "2026-09-10T12:00:00.000Z",
    ]);
  });

  it("reencolar la misma clave no duplica la venta", async () => {
    const sale = buildSale();
    await enqueueSale(sale);
    await enqueueSale(sale);

    expect(await countPendingSales(TENANT_A)).toBe(1);
  });

  it("solo borra la venta cuando el servidor la confirma", async () => {
    const sale = buildSale();
    await enqueueSale(sale);

    await markSaleSynced(sale.idempotencyKey);

    expect(await countPendingSales(TENANT_A)).toBe(0);
  });

  it("un fallo NO borra la venta: la conserva y cuenta el intento", async () => {
    const sale = buildSale();
    await enqueueSale(sale);

    await markSaleFailed(sale.idempotencyKey, "network error");

    const pending = await listPendingSales(TENANT_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBe("network error");
    expect(pending[0].status).toBe("pending");
  });

  it("al agotar los reintentos pasa a 'failed' pero sigue guardada", async () => {
    const sale = buildSale();
    await enqueueSale(sale);

    for (let i = 0; i < MAX_SYNC_ATTEMPTS; i++) {
      await markSaleFailed(sale.idempotencyKey, `intento ${i + 1}`);
    }

    const pending = await listPendingSales(TENANT_A);
    // Lo importante: dinero cobrado nunca desaparece solo.
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("failed");
    expect(pending[0].attempts).toBe(MAX_SYNC_ATTEMPTS);
  });

  it("marcar como fallida una venta inexistente no revienta", async () => {
    await expect(
      markSaleFailed("00000000-0000-0000-0000-0000000000ff", "boom")
    ).resolves.toBeUndefined();
  });
});
