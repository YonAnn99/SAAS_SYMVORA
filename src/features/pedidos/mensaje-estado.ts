import type { EntregaPedido } from "@/features/catalogo/pedido-envio";
import type { EstadoBase } from "./types";

/**
 * El texto de «Avisar por WhatsApp» (`wa.me`, sin la API de WhatsApp): lo escribe el negocio a su cliente. Es un
 * mensaje al cliente final, así que va siempre en español (como lo impreso y los correos). El estado que se nombra es
 * el PROPIO del negocio (`estadoNombre`); el texto fijo solo cambia según el estado base.
 */
export function mensajeAlCliente(
  base: EstadoBase,
  datos: {
    negocio: string;
    folio: number;
    nombre: string;
    entrega: EntregaPedido;
    estadoNombre: string;
    urlSeguimiento: string | null;
    /** Envío ya formateado («$30.00»); solo pedidos a domicilio con costo definido. */
    envio?: string | null;
    /** Mensaje que el negocio dejó para el cliente. */
    mensajeCliente?: string | null;
  }
): string {
  const primer = datos.nombre.trim().split(/\s+/)[0] || "";
  const saludo = primer ? `Hola, ${primer}.` : "Hola.";
  const pedido = `tu pedido #${datos.folio} en ${datos.negocio}`;
  const cuerpo: Record<EstadoBase, string> = {
    nuevo: `Recibimos ${pedido}. Lo estamos revisando y te confirmamos pronto.`,
    confirmado: `Confirmamos ${pedido}. Ya lo estamos apartando.`,
    en_curso: `Tu pedido #${datos.folio} en ${datos.negocio} está: ${datos.estadoNombre}.`,
    entregado: `Entregamos ${pedido}. ¡Gracias por tu compra!`,
    cancelado: `Cancelamos ${pedido}. Si tienes dudas, escríbenos.`,
  };
  const abierto = base !== "entregado" && base !== "cancelado";
  const lineaEnvio =
    datos.entrega === "domicilio" && datos.envio && abierto ? [`Envío a domicilio: ${datos.envio}.`] : [];
  const lineaMensaje = datos.mensajeCliente ? [`Nota: ${datos.mensajeCliente}`] : [];
  const lineaSeguimiento = datos.urlSeguimiento ? [`Sigue tu pedido aquí: ${datos.urlSeguimiento}`] : [];
  return [saludo, cuerpo[base], ...lineaEnvio, ...lineaMensaje, ...(lineaSeguimiento.length ? ["", ...lineaSeguimiento] : [])].join(
    "\n"
  );
}

/** Enlace `wa.me` al celular del cliente (E.164 con o sin "+"); null si el número no sirve. */
export function enlaceWhatsAppCliente(telefono: string | null | undefined, mensaje: string): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
