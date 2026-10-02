import { TIMEOUTS, timeoutSignal } from "@/lib/http/timeout";

/**
 * Envio de avisos por SMS (Twilio). SOLO SERVIDOR.
 *
 * Respaldo de WhatsApp mientras no esten las llaves de Meta: hoy solo lo usa
 * el aviso de corte de caja (`lib/avisos-celular.ts`).
 *
 * APAGADO mientras no existan `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y un
 * remitente (`TWILIO_FROM`, el numero comprado en Twilio en E.164, o
 * `TWILIO_MESSAGING_SERVICE_SID`). En la cuenta de prueba de Twilio solo llega
 * a numeros verificados y hay que activar Mexico en Messaging -> Geo
 * permissions.
 */

export type ResultadoSMS =
  | { enviado: true; id: string | null }
  | { enviado: false; motivo: "desactivado" | "sin_contacto" | "error"; error?: string };

export function smsActivo(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

/** Envia un SMS a un numero E.164 (`+525512345678`). Nunca lanza. */
export async function enviarSMS(telefono: string, texto: string): Promise<ResultadoSMS> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const desde = process.env.TWILIO_FROM;
  const servicio = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!desde && !servicio)) return { enviado: false, motivo: "desactivado" };

  const cuerpo = new URLSearchParams({ To: telefono, Body: texto });
  if (servicio) cuerpo.set("MessagingServiceSid", servicio);
  else cuerpo.set("From", desde!);

  try {
    const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: cuerpo.toString(),
      signal: timeoutSignal(TIMEOUTS.sms),
    });
    const datos = (await respuesta.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!respuesta.ok) {
      return { enviado: false, motivo: "error", error: datos?.message ?? `HTTP ${respuesta.status}` };
    }
    return { enviado: true, id: datos?.sid ?? null };
  } catch (err) {
    return { enviado: false, motivo: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
