/**
 * Si los avisos al celular (WhatsApp o SMS) ya estan dados de alta.
 *
 * Mientras este apagado, la interfaz pide el celular pero NO promete avisos:
 * se ocultan las leyendas de Suscripcion y Mi perfil y el interruptor "Recibir
 * avisos". Encenderlo cuando WhatsApp (`WHATSAPP_TOKEN`) o Twilio
 * (`TWILIO_*`) esten configurados: `NEXT_PUBLIC_AVISOS_CELULAR=1` en Vercel y
 * en `.env.local`. Como toda variable `NEXT_PUBLIC_`, requiere redeploy.
 *
 * Archivo aparte de `feature-flags.ts` a proposito: ese importa `next/server`
 * y esto lo leen componentes de cliente.
 */
export const AVISOS_CELULAR_ACTIVOS = process.env.NEXT_PUBLIC_AVISOS_CELULAR === "1";
