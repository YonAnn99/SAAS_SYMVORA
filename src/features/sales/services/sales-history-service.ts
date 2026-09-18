/**
 * Acceso al historial de ventas.
 *
 * Todo pasa por los dos RPC de la migracion 070 y NO por consultas directas a
 * `ventas`. No es capricho: la politica de lectura de esa tabla es solo por
 * negocio (`tenant_id IN (user_tenant_ids())`), asi que cualquier miembro puede
 * leer las ventas de todos sus companeros. La regla "un cajero solo ve las
 * suyas" vive DENTRO de los RPC, donde no se puede esquivar; filtrarla aqui
 * seria un adorno que se salta con una peticion a mano.
 *
 * Los RPC tambien resuelven el correo del cajero desde `auth.users`, que no es
 * accesible desde el cliente.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { VentaGuardada } from "../sale-receipt-builder";

/** Una fila del listado. */
export interface VentaEnHistorial {
  id: string;
  fecha_venta: string;
  usuario_id: string | null;
  cajero_email: string | null;
  cliente_nombre: string | null;
  metodo_pago: string;
  estado: string;
  total: number;
  origen: string | null;
  requiere_revision: boolean | null;
}

export interface PaginaDeVentas {
  ventas: VentaEnHistorial[];
  /** Cuantas hay en total con esos filtros, para pintar el paginador. */
  total: number;
}

export interface FiltrosHistorial {
  tenantId: string;
  desde: Date;
  hasta: Date;
  /** Solo lo honra el servidor si quien pregunta tiene `sales.view_all`. */
  cajeroId?: string | null;
  limite?: number;
  desplazamiento?: number;
}

/** Cuantas ventas por pagina. El RPC pagina en servidor, no el navegador. */
export const VENTAS_POR_PAGINA = 25;

export async function fetchHistorialVentas(
  filtros: FiltrosHistorial
): Promise<PaginaDeVentas> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.rpc("listar_ventas", {
    p_tenant_id: filtros.tenantId,
    p_desde: filtros.desde.toISOString(),
    p_hasta: filtros.hasta.toISOString(),
    p_cajero_id: filtros.cajeroId ?? null,
    p_limite: filtros.limite ?? VENTAS_POR_PAGINA,
    p_desplazamiento: filtros.desplazamiento ?? 0,
  });

  if (error) throw error;

  const filas = (data ?? []) as (VentaEnHistorial & {
    total_filas: number | string;
  })[];

  return {
    ventas: filas.map((f) => ({ ...f, total: Number(f.total) })),
    // `total_filas` viene repetido en cada renglon (ventana sobre el conjunto
    // completo). Sin filas no hay de donde sacarlo, y entonces el total es 0.
    total: filas.length > 0 ? Number(filas[0].total_filas) : 0,
  };
}

/** La venta con su desglose, para el detalle y la reimpresion. */
export async function fetchDetalleVenta(
  ventaId: string
): Promise<VentaGuardada> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.rpc("detalle_venta", {
    p_venta_id: ventaId,
  });

  if (error) throw error;
  if (!data) throw new Error("No se encontró la venta");

  return data as VentaGuardada;
}
