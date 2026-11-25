import type { EntregaPedido, EstadoPedido } from "@/features/catalogo/pedido-envio";

/**
 * El texto de «Avisar por WhatsApp» (`wa.me`, sin la API de WhatsApp): lo escribe el negocio a su cliente. Es un
 * mensaje al cliente final, así que va siempre en español (como lo impreso y los correos).
 */
export function mensajeAlCliente(
  estado: EstadoPedido,
  datos: { negocio: string; folio: number; nombre: string; entrega: EntregaPedido; urlSeguimiento: string | null }
): string {
  const primer = datos.nombre.trim().split(/\s+/)[0] || "";
  const saludo = primer ? `Hola, ${primer}.` : "Hola.";
  const pedido = `tu pedido #${datos.folio} en ${datos.negocio}`;
  const cuerpo: Record<EstadoPedido, string> = {
    nuevo: `Recibimos ${pedido}. Lo estamos revisando y te confirmamos pronto.`,
    confirmado: `Confirmamos ${pedido}. Ya lo estamos apartando.`,
    pago: `Recibimos el pago de ${pedido}. ¡Gracias!`,
    en_produccion: `Ya estamos preparando ${pedido}.`,
    listo:
      datos.entrega === "recoger"
        ? `${pedido[0].toUpperCase()}${pedido.slice(1)} ya está listo. Puedes pasar por él.`
        : `${pedido[0].toUpperCase()}${pedido.slice(1)} ya está listo. En breve sale a tu domicilio.`,
    en_camino: `${pedido[0].toUpperCase()}${pedido.slice(1)} va en camino a tu domicilio.`,
    entregado: `Entregamos ${pedido}. ¡Gracias por tu compra!`,
    cancelado: `Cancelamos ${pedido}. Si tienes dudas, escríbenos.`,
  };
  return [saludo, cuerpo[estado], ...(datos.urlSeguimiento ? ["", `Sigue tu pedido aquí: ${datos.urlSeguimiento}`] : [])].join(
    "\n"
  );
}

/** Enlace `wa.me` al celular del cliente (E.164 con o sin "+"); null si el número no sirve. */
export function enlaceWhatsAppCliente(telefono: string | null | undefined, mensaje: string): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
