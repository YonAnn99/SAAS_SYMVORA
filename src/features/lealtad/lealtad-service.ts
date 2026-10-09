import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EstadoTarjeta, ProgramaLealtad, TarjetaLealtad, TipoPremio, PaletaTarjeta } from "./types";

/**
 * Acceso a datos de las tarjetas de lealtad (migracion 115).
 *
 * Lecturas directas con RLS (cada quien ve las de su negocio). Escrituras:
 * el programa por tabla (RLS `loyalty.manage`); tarjetas y sellos SOLO por
 * RPC, que generan el codigo y dejan el movimiento.
 */

export interface TarjetaConCliente extends TarjetaLealtad {
  cliente: { nombre: string; email: string | null; telefono: string | null } | null;
}

export interface ProgramaInput {
  nombre: string;
  sellos_meta: number;
  premio_descripcion: string;
  premio_tipo: TipoPremio;
  premio_producto_id: string | null;
  premio_valor: number | null;
  compra_minima: number;
  paleta: PaletaTarjeta;
  color_acento: string | null;
  activo: boolean;
}

export interface ResumenLealtad {
  tarjetasActivas: number;
  sellosDelMes: number;
  canjesDelMes: number;
}

export async function fetchPrograma(tenantId: string): Promise<ProgramaLealtad | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("programas_lealtad")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProgramaLealtad | null) ?? null;
}

/** Crea o actualiza el programa del negocio (uno por negocio). */
export async function guardarPrograma(tenantId: string, input: ProgramaInput): Promise<ProgramaLealtad> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("programas_lealtad")
    .upsert(
      {
        tenant_id: tenantId,
        ...input,
        // El producto solo va con premio de producto y el valor con $ o %: la
        // base lo exige (CHECK de la migracion 115).
        premio_producto_id: input.premio_tipo === "producto" ? input.premio_producto_id : null,
        premio_variante_id: null,
        premio_valor: input.premio_tipo === "producto" ? null : input.premio_valor,
      },
      { onConflict: "tenant_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ProgramaLealtad;
}

export async function fetchTarjetas(tenantId: string): Promise<TarjetaConCliente[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("tarjetas_lealtad")
    .select("*, cliente:clientes(nombre, email, telefono)")
    .eq("tenant_id", tenantId)
    .order("ultima_visita", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TarjetaConCliente[];
}

/** Tarjetas activas, sellos sumados y premios canjeados en el mes en curso. */
export async function fetchResumen(tenantId: string, ahora = new Date()): Promise<ResumenLealtad> {
  const supabase = createSupabaseBrowserClient();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const [{ count: activas }, { data: movimientos }] = await Promise.all([
    supabase
      .from("tarjetas_lealtad")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("activa", true),
    supabase
      .from("movimientos_lealtad")
      .select("tipo")
      .eq("tenant_id", tenantId)
      .in("tipo", ["sello", "canje"])
      .gte("creado_en", inicioMes)
      .limit(10000),
  ]);
  const filas = (movimientos ?? []) as { tipo: string }[];
  return {
    tarjetasActivas: activas ?? 0,
    sellosDelMes: filas.filter((m) => m.tipo === "sello").length,
    canjesDelMes: filas.filter((m) => m.tipo === "canje").length,
  };
}

export async function emitirTarjeta(clienteId: string): Promise<EstadoTarjeta> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("emitir_tarjeta_lealtad", { p_cliente_id: clienteId });
  if (error) throw error;
  return data as EstadoTarjeta;
}

export async function ajustarSellos(tarjetaId: string, cantidad: number, nota: string): Promise<EstadoTarjeta> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("ajustar_sellos_lealtad", {
    p_tarjeta_id: tarjetaId,
    p_cantidad: cantidad,
    p_nota: nota || null,
  });
  if (error) throw error;
  return data as EstadoTarjeta;
}

/** Tarjeta por el codigo escaneado (POS). RLS: solo las del propio negocio. */
export async function tarjetaPorCodigo(codigo: string): Promise<TarjetaConCliente | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("tarjetas_lealtad")
    .select("*, cliente:clientes(nombre, email, telefono)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw error;
  return (data as TarjetaConCliente | null) ?? null;
}

/** Tarjeta de un cliente (POS, al elegirlo en el selector). */
export async function tarjetaDeCliente(clienteId: string): Promise<TarjetaConCliente | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("tarjetas_lealtad")
    .select("*, cliente:clientes(nombre, email, telefono)")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return (data as TarjetaConCliente | null) ?? null;
}

/** Mensaje legible de un error de Supabase/Postgres (los RPC ya hablan en español). */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  const mensaje = (error as { message?: unknown } | null)?.message;
  return typeof mensaje === "string" && mensaje.trim() ? mensaje : porDefecto;
}
