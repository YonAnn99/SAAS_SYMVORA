/**
 * Cancelar y corregir ventas ya cobradas (migración 137). Lógica pura: qué se
 * permite, qué motivo se guarda y qué hay que avisar después. Devuelve CÓDIGOS;
 * la pantalla los traduce.
 *
 * La regla que manda vive en el servidor (`cancelar_venta`, `corregir_venta`):
 * esto solo decide qué botones ofrecer y qué explicar, para no proponer algo
 * que la base va a rechazar.
 */

/** Motivos de la lista. «otro» exige escribirlo. */
export const MOTIVOS_CANCELACION = ["captura", "devolucion", "duplicado", "otro"] as const;
export type MotivoCancelacion = (typeof MOTIVOS_CANCELACION)[number];

/**
 * Cómo se GUARDA el motivo: en español, como el resto de los datos del negocio
 * (la Bitácora y los avisos se leen igual en cualquier idioma de la interfaz).
 */
const MOTIVO_GUARDADO: Record<Exclude<MotivoCancelacion, "otro">, string> = {
  captura: "Error de captura",
  devolucion: "Devolución del cliente",
  duplicado: "Cobro duplicado",
};

/** Mismo tope que la base (`_cancelar_venta`). */
export const MOTIVO_MAXIMO = 300;

/**
 * El texto que se manda al servidor, o `null` si falta algo: con «otro» el
 * detalle es obligatorio; con los demás es un añadido opcional.
 */
export function motivoParaGuardar(motivo: MotivoCancelacion | null, detalle: string): string | null {
  if (!motivo) return null;
  const extra = detalle.trim().replace(/\s+/g, " ");
  const texto = motivo === "otro" ? extra : extra ? `${MOTIVO_GUARDADO[motivo]}: ${extra}` : MOTIVO_GUARDADO[motivo];
  if (!texto) return null;
  return texto.slice(0, MOTIVO_MAXIMO);
}

/** Lo que importa de la venta para decidir. */
export interface VentaCancelable {
  estado: string;
  facturada?: boolean;
  pagada_con_terminal?: boolean;
  metodo_pago: string;
}

export type BloqueoCancelacion = "sin-permiso" | "cancelada" | "no-completada" | "facturada";
export type BloqueoCorreccion = BloqueoCancelacion | "terminal";

/** `null` = se puede cancelar. */
export function bloqueoCancelar(venta: VentaCancelable, tienePermiso: boolean): BloqueoCancelacion | null {
  if (!tienePermiso) return "sin-permiso";
  if (venta.estado === "CANCELADA") return "cancelada";
  if (venta.estado !== "COMPLETADA") return "no-completada";
  if (venta.facturada) return "facturada";
  return null;
}

/**
 * `null` = se puede corregir. Una venta cobrada con la terminal no: el dinero
 * vive en Mercado Pago y se devuelve allá; corregirla aquí cobraría dos veces.
 */
export function bloqueoCorregir(venta: VentaCancelable, tienePermiso: boolean): BloqueoCorreccion | null {
  const b = bloqueoCancelar(venta, tienePermiso);
  if (b) return b;
  if (venta.pagada_con_terminal || venta.metodo_pago === "TARJETA_TERMINAL") return "terminal";
  return null;
}

/** Qué se explica ANTES de confirmar, según cómo se pagó. */
export type AvisoPrevio = "stock" | "credito" | "efectivo" | "otro-medio" | "terminal" | "lealtad-y-caja";

export function avisosPrevios(venta: VentaCancelable): AvisoPrevio[] {
  const avisos: AvisoPrevio[] = ["stock"];
  if (venta.pagada_con_terminal || venta.metodo_pago === "TARJETA_TERMINAL") avisos.push("terminal");
  else if (venta.metodo_pago === "CREDITO") avisos.push("credito");
  else if (venta.metodo_pago === "EFECTIVO") avisos.push("efectivo");
  else avisos.push("otro-medio");
  avisos.push("lealtad-y-caja");
  return avisos;
}

/** Lo que devuelve `cancelar_venta` (y `corregir_venta` en `cancelacion`). */
export interface RespuestaCancelacion {
  total?: number | string;
  caja_abierta?: boolean;
  devuelto_a_caja?: number | string;
  sin_caja_para_devolucion?: boolean;
  devolucion_fuera_de_caja?: boolean;
  reembolso_en_terminal?: boolean;
  credito_rebajado?: number | string;
  credito_excedente?: number | string;
  lealtad_revertida?: boolean;
}

/** Un aviso posterior, con el monto si lo lleva. */
export interface AvisoCancelacion {
  codigo:
    | "caja-abierta"
    | "devuelto-caja"
    | "sin-caja"
    | "fuera-de-caja"
    | "terminal"
    | "credito"
    | "credito-excedente"
    | "lealtad";
  monto?: number;
  /** `aviso` = algo que la persona tiene que hacer a mano. */
  tono: "info" | "aviso";
}

const num = (v: number | string | undefined | null) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Qué pasó con el dinero, el crédito y la tarjeta de lealtad. */
export function avisosCancelacion(r: RespuestaCancelacion): AvisoCancelacion[] {
  const avisos: AvisoCancelacion[] = [];
  if (r.reembolso_en_terminal) avisos.push({ codigo: "terminal", monto: num(r.total), tono: "aviso" });
  if (r.caja_abierta) avisos.push({ codigo: "caja-abierta", tono: "info" });
  if (num(r.devuelto_a_caja) > 0) avisos.push({ codigo: "devuelto-caja", monto: num(r.devuelto_a_caja), tono: "info" });
  if (r.sin_caja_para_devolucion) avisos.push({ codigo: "sin-caja", monto: num(r.total), tono: "aviso" });
  if (r.devolucion_fuera_de_caja && !r.reembolso_en_terminal) {
    avisos.push({ codigo: "fuera-de-caja", monto: num(r.total), tono: "aviso" });
  }
  if (num(r.credito_rebajado) > 0) avisos.push({ codigo: "credito", monto: num(r.credito_rebajado), tono: "info" });
  if (num(r.credito_excedente) > 0) {
    avisos.push({ codigo: "credito-excedente", monto: num(r.credito_excedente), tono: "aviso" });
  }
  if (r.lealtad_revertida) avisos.push({ codigo: "lealtad", tono: "info" });
  return avisos;
}
