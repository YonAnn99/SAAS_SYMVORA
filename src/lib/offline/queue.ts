"use client";

/**
 * Cola de ventas pendientes de sincronizar (IndexedDB).
 *
 * Por qué IndexedDB y no `localStorage`: lo que se guarda aquí es **dinero ya
 * cobrado**. `localStorage` es síncrono (bloquea el hilo del POS al escribir),
 * tiene ~5 MB y guarda solo strings. IndexedDB es asíncrono, aguanta mucho más
 * y es lo que el navegador considera almacenamiento "de aplicación" a la hora
 * de decidir qué conservar.
 *
 * Regla que atraviesa todo este módulo: **una venta solo se borra de la cola
 * cuando el servidor confirma que la registró**. Ante cualquier duda se
 * conserva. Perder una venta es peor que reintentarla de más, porque el
 * reintento es inofensivo (`idempotency_key` lo resuelve del lado del
 * servidor) mientras que una venta perdida es dinero cobrado que nadie
 * registró.
 */

import type { MetodoPago } from "@/features/pos/types/pos.types";
import type { SaleItem } from "@/features/pos/services/pos-service";

const DB_NAME = "symvora-offline";
const DB_VERSION = 1;
const STORE = "pending-sales";

/** Tope de reintentos antes de mandar la venta a la bandeja de fallidas. */
export const MAX_SYNC_ATTEMPTS = 8;

export type PendingSaleStatus = "pending" | "failed";

export interface PendingSale {
  /** UUID generado en el cliente. Es la clave primaria y el ancla anti-duplicados. */
  idempotencyKey: string;
  tenantId: string;
  userId: string;
  /** Caja abierta EN EL MOMENTO de vender, no al sincronizar. */
  cajaId: string | null;
  clienteId: string | null;
  metodoPago: MetodoPago;
  items: SaleItem[];
  includeIva: boolean;
  notas: string | null;
  montoRecibido: number | null;
  /** Total del ticket que se le entregó al cliente. */
  totalCobrado: number;
  /** Fecha real de la venta (ISO), no la de sincronización. */
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: PendingSaleStatus;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible en este navegador"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "idempotencyKey" });
        store.createIndex("tenantId", "tenantId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Encola una venta recién hecha sin conexión. */
export async function enqueueSale(
  sale: Omit<PendingSale, "attempts" | "lastError" | "status">
): Promise<void> {
  const record: PendingSale = {
    ...sale,
    attempts: 0,
    lastError: null,
    status: "pending",
  };
  await runTransaction("readwrite", (store) => store.put(record));
}

/**
 * Devuelve las ventas de un tenant **en orden cronológico de venta**.
 *
 * El orden importa: cada venta descuenta stock, así que subirlas desordenadas
 * produciría un histórico de inventario que no corresponde con lo que pasó en
 * el mostrador.
 */
export async function listPendingSales(tenantId: string): Promise<PendingSale[]> {
  const all = await runTransaction<PendingSale[]>("readonly", (store) =>
    store.getAll() as IDBRequest<PendingSale[]>
  );
  return all
    .filter((sale) => sale.tenantId === tenantId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Cuenta las pendientes de un tenant (para el banner). */
export async function countPendingSales(tenantId: string): Promise<number> {
  const pending = await listPendingSales(tenantId);
  return pending.length;
}

/** El servidor confirmó la venta: es el ÚNICO caso en que se borra de la cola. */
export async function markSaleSynced(idempotencyKey: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(idempotencyKey));
}

/**
 * Registra un intento fallido. La venta **nunca** se borra aquí: al agotar los
 * reintentos pasa a `failed` y queda visible para resolverla a mano.
 */
export async function markSaleFailed(
  idempotencyKey: string,
  error: string
): Promise<void> {
  const existing = await runTransaction<PendingSale | undefined>(
    "readonly",
    (store) => store.get(idempotencyKey) as IDBRequest<PendingSale | undefined>
  );
  if (!existing) return;

  const attempts = existing.attempts + 1;
  const updated: PendingSale = {
    ...existing,
    attempts,
    lastError: error,
    status: attempts >= MAX_SYNC_ATTEMPTS ? "failed" : "pending",
  };
  await runTransaction("readwrite", (store) => store.put(updated));
}
