export const CONTACT_EMAIL = "contacto@symvora.com.mx";
export const HELLO_EMAIL = "hola@symvora.com.mx";
export const PRIVACY_EMAIL = "privacidad@symvora.com.mx";
export const LEGAL_EMAIL = "legal@symvora.com.mx";
export const PAYMENTS_EMAIL = "pagos@symvora.com.mx";
export const BILLING_EMAIL = "facturacion@symvora.com.mx";
export const NO_REPLY_EMAIL = "no-reply@symvora.com.mx";
export const SUPPORT_EMAIL = "soporte@symvora.com.mx";

/**
 * Numero de ventas (WhatsApp Business). Fuente unica: el pie de la landing,
 * el boton flotante, el CTA, las FAQ, las paginas de giro y el JSON-LD lo
 * toman de aqui. `NEXT_PUBLIC_WHATSAPP_NUMBER` lo sobrescribe si esta definida.
 *
 * Sin el "1" despues del 52: era el prefijo de movil de las agendas viejas y
 * WhatsApp ya no lo usa (ver `normalizarTelefonoMx` en `lib/whatsapp.ts`).
 */
export const SALES_PHONE_E164 = "525664891567";
export const SALES_PHONE_DISPLAY = "+52 56 6489 1567";
export const SALES_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || SALES_PHONE_E164;
