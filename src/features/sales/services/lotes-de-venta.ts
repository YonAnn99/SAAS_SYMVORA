import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** De que lote salio cada pieza de una venta (migracion 116). */
export interface LoteDeVenta {
  producto_id: string;
  variante_id: string | null;
  numero_lote: string;
  fecha_caducidad: string | null;
  cantidad: number;
  /** VENTA = lo vendido; INSUMO = lo que uso un servicio (migracion 117). */
  tipo: "VENTA" | "INSUMO";
}

export async function fetchLotesDeVenta(ventaId: string): Promise<LoteDeVenta[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("movimientos_lote")
    .select("tipo, cantidad, lotes(producto_id, variante_id, numero_lote, fecha_caducidad)")
    .eq("venta_id", ventaId)
    .in("tipo", ["VENTA", "INSUMO"]);
  if (error) throw error;

  type Fila = {
    tipo: "VENTA" | "INSUMO";
    cantidad: number;
    lotes: Omit<LoteDeVenta, "cantidad" | "tipo"> | null;
  };
  return ((data ?? []) as unknown as Fila[])
    .filter((f) => f.lotes)
    .map((f) => ({
      ...(f.lotes as Omit<LoteDeVenta, "cantidad" | "tipo">),
      tipo: f.tipo,
      cantidad: Math.abs(Number(f.cantidad)),
    }));
}

/** "Lote A12 ×2 · B07 ×1" para un renglon. */
export function textoLotes(lotes: LoteDeVenta[]): string {
  return lotes.map((l) => `${l.numero_lote} ×${l.cantidad}`).join(" · ");
}
