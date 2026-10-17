/** Tablas y respuestas de las tarjetas de lealtad (migracion 115). */

export type TipoPremio = "producto" | "monto" | "porcentaje";
export type PaletaTarjeta = "clara" | "oscura";
export type OrigenTarjeta = "equipo" | "qr";
/** Dibujo del sello lleno (migracion 120). Misma lista que el CHECK de la base. */
export type IconoSello =
  | "check"
  | "cafe"
  | "estrella"
  | "corazon"
  | "huella"
  | "hueso"
  | "pizza"
  | "tijeras"
  | "flor"
  | "pan"
  | "helado"
  | "bolsa"
  | "pesa"
  | "cerveza";

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
  icono_sello: IconoSello;
  /** NULL = el fondo de la paleta. */
  color_fondo: string | null;
  /** Migracion 121: el cliente se registra solo con el QR del local. */
  alta_publica: boolean;
  /** Codigo del cartel; lo genera la base al activar el registro (nadie lo escribe a mano). */
  codigo_alta: string | null;
  aviso_privacidad_url: string | null;
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
  /** Migracion 121: 'qr' = el cliente se registro solo con el cartel. */
  origen: OrigenTarjeta;
  acepto_aviso_en: string | null;
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
  /** Desde la migracion 120; una respuesta vieja no las trae. */
  icono_sello?: IconoSello | null;
  color_fondo?: string | null;
  programa: string;
  sellos_meta: number;
  premio_descripcion: string;
  sellos: number;
  premios_canjeados: number;
  cliente: string;
  activa: boolean;
}

/** `programa_alta_publica` (migracion 121): lo que pinta la pagina del cartel. Nada de clientes ni montos. */
export interface ProgramaAltaPublica {
  codigo_alta: string;
  negocio: string;
  logo_url: string | null;
  paleta: PaletaTarjeta;
  color_acento: string | null;
  icono_sello: IconoSello | null;
  color_fondo: string | null;
  programa: string;
  sellos_meta: number;
  premio_descripcion: string;
  aviso_privacidad_url: string | null;
}

/** Respuesta de POST /api/lealtad/unirse. */
export type ResultadoAlta = { estado: "creada"; codigo: string } | { estado: "ya_registrado" };
