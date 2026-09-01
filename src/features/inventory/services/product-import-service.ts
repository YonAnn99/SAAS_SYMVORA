import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateNextBarcode } from "./product-service";
import type { ProductImportInput } from "../types/import.types";

export const IMPORT_CHUNK_SIZE = 250;
const IMPORT_UPDATE_CONCURRENCY = 20;

export interface ExistingProductInfo {
  id: string;
  nombre: string;
}

export async function fetchExistingBarcodes(
  tenantId: string
): Promise<Map<string, ExistingProductInfo>> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, codigo_barras")
    .eq("tenant_id", tenantId)
    .not("codigo_barras", "is", null);

  const map = new Map<string, ExistingProductInfo>();
  for (const row of data ?? []) {
    const normalized = row.codigo_barras?.trim().toLowerCase();
    if (normalized) {
      map.set(normalized, { id: row.id, nombre: row.nombre });
    }
  }
  return map;
}

export async function fetchSupplierNameMap(
  tenantId: string
): Promise<Map<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("tenant_id", tenantId);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.nombre.trim().toLowerCase(), row.id);
  }
  return map;
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export interface BulkCreateOutcome {
  createdCount: number;
  errors: { rowIndexes: number[]; message: string }[];
}

/**
 * Chunked, sequential batch insert. A failing chunk rolls back only itself
 * (Postgres statement-level rollback) — previously committed chunks stay
 * committed, and the import continues with the next chunk.
 */
export async function bulkCreateProducts(
  tenantId: string,
  rows: { rowIndex: number; input: ProductImportInput }[],
  chunkSize: number = IMPORT_CHUNK_SIZE,
  onProgress?: (done: number, total: number) => void
): Promise<BulkCreateOutcome> {
  const supabase = createSupabaseBrowserClient();
  const chunks = chunkRows(rows, chunkSize);
  let createdCount = 0;
  const errors: { rowIndexes: number[]; message: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { error } = await supabase.from("productos").insert(
      chunk.map(({ input }) => ({
        tenant_id: tenantId,
        ...input,
      }))
    );

    if (error) {
      errors.push({
        rowIndexes: chunk.map((r) => r.rowIndex),
        message: error.message,
      });
    } else {
      createdCount += chunk.length;
    }

    onProgress?.(i + 1, chunks.length);
  }

  return { createdCount, errors };
}

/**
 * Creates a single product using a barcode freshly generated right before
 * the insert — used for "generate new barcode" duplicate resolutions,
 * processed one at a time so each call sees the real, up-to-date DB state
 * (avoids two rows in the same import racing to the same generated code).
 */
export async function createProductWithGeneratedBarcode(
  tenantId: string,
  input: ProductImportInput
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const barcode = await generateNextBarcode(tenantId);
  const { error } = await supabase.from("productos").insert({
    tenant_id: tenantId,
    ...input,
    codigo_barras: barcode,
  });
  if (error) throw error;
  return barcode;
}

export interface BulkUpdateOutcome {
  updatedCount: number;
  errors: { rowIndex: number; message: string }[];
}

export async function bulkUpdateProducts(
  rows: { rowIndex: number; productId: string; input: ProductImportInput }[],
  concurrency: number = IMPORT_UPDATE_CONCURRENCY
): Promise<BulkUpdateOutcome> {
  const supabase = createSupabaseBrowserClient();
  let updatedCount = 0;
  const errors: { rowIndex: number; message: string }[] = [];

  const batches = chunkRows(rows, concurrency);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(({ productId, input }) =>
        supabase.from("productos").update(input).eq("id", productId)
      )
    );

    results.forEach((result, idx) => {
      const row = batch[idx];
      if (result.status === "fulfilled" && !result.value.error) {
        updatedCount += 1;
      } else {
        const message =
          result.status === "fulfilled"
            ? result.value.error?.message || "Error desconocido"
            : String(result.reason);
        errors.push({ rowIndex: row.rowIndex, message });
      }
    });
  }

  return { updatedCount, errors };
}
