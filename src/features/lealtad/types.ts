/** Tablas y respuestas de las tarjetas de lealtad (migracion 115). */

export type TipoPremio = "producto" | "monto" | "porcentaje";
export type PaletaTarjeta = "clara" | "oscura";

export interface ProgramaLealtad {
  id: string;
  tenant_id: string;
  nombre: string;
  sellos_meta: number;
  premio_descripcion: string;
  premio_tipo: TipoPremio;
  premio_producto_id: string | null;
  premio_variante_id: string | null;
  premio_valor: number | null;
  compra_minima: number;
  paleta: PaletaTarjeta;
  color_acento: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface TarjetaLealtad {
  id: string;
  tenant_id: string;
  programa_id: string;
  cliente_id: string;
  codigo: string;
  sellos: number;
  premios_canjeados: number;
  ultima_visita: string | null;
  activa: boolean;
  creado_en: string;
}

/** Lo que devuelven `emitir_tarjeta_lealtad`, `ajustar_sellos_lealtad` y la venta. */
export interface EstadoTarjeta {
  tarjeta_id: string;
  codigo: string;
  cliente_id: string;
  sellos: number;
  sellos_meta: number;
  premios_canjeados: number;
  premio_descripcion: string;
  tiene_premio: boolean;
  /** Solo en la respuesta de la venta. */
  sello_sumado?: boolean;
  premio_canjeado?: boolean;
  premio_monto?: number;
  reintento?: boolean;
}

/** `tarjeta_publica`: solo lo que se pinta en la tarjeta del cliente. */
export interface TarjetaPublica {
  codigo: string;
  negocio: string;
  logo_url: string | null;
  paleta: PaletaTarjeta;
  color_acento: string | null;
  programa: string;
  sellos_meta: number;
  premio_descripcion: string;
  sellos: number;
  premios_canjeados: number;
  cliente: string;
  activa: boolean;
}
