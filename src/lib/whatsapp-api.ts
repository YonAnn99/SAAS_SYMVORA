import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { TIMEOUTS, timeoutSignal } from "@/lib/http/timeout";
import {
  IDIOMA_PLANTILLAS,
  parametrosPlantilla,
  type NombrePlantilla,
  type ValoresPlantilla,
} from "@/lib/whatsapp-plantillas";

/**
 * Envio de avisos por WhatsApp (Cloud API de Meta). SOLO SERVIDOR.
 *
 * APAGADO mientras no existan `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`:
 * todo devuelve `{ enviado: false, motivo: "desactivado" }` sin consultar la
 * base ni la red, asi que puede vivir en produccion antes de tener la cuenta
 * de Meta Business. Para encenderlo:
 *   1. Dar de alta la cuenta de Meta Business y el numero de WhatsApp.
 *   2. Crear y aprobar las plantillas de `lib/whatsapp-plantillas.ts`.
 *   3. Poner las dos variables (y opcional `WHATSAPP_API_VERSION`) en Vercel.
 *
 * `lib/whatsapp.ts` es otra cosa: arma enlaces `wa.me` que abre una persona.
 * Esto envia sin que nadie pulse "enviar", por eso solo usa plantillas
 * aprobadas y solo escribe a quien dio su numero y no apago los avisos.
 */

type Supabase = ReturnType<typeof createSupabaseServiceRoleClient>;

export type ResultadoWhatsApp =
  | { enviado: true; id: string | null }
  | { enviado: false; motivo: "desactivado" | "sin_contacto" | "error"; error?: string };

const VERSION_POR_DEFECTO = "v23.0";

export function whatsappActivo(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Envia una plantilla aprobada a un numero E.164 (`+525512345678`). */
export async function enviarPlantillaWhatsApp<N extends NombrePlantilla>(
  telefono: string,
  plantilla: N,
  valores: ValoresPlantilla<N>
): Promise<ResultadoWhatsApp> {
  const token = process.env.WHATSAPP_TOKEN;
  const numeroId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numeroId) return { enviado: false, motivo: "desactivado" };

  const version = process.env.WHATSAPP_API_VERSION || VERSION_POR_DEFECTO;
  try {
    const respuesta = await fetch(`https://graph.facebook.com/${version}/${numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono.replace(/^\+/, ""),
        type: "template",
        template: {
          name: plantilla,
          language: { code: IDIOMA_PLANTILLAS },
          components: [
            {
              type: "body",
              parameters: parametrosPlantilla(plantilla, valores).map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
      signal: timeoutSignal(TIMEOUTS.whatsapp),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    } | null;
    if (!respuesta.ok) {
      return { enviado: false, motivo: "error", error: cuerpo?.error?.message ?? `HTTP ${respuesta.status}` };
    }
    return { enviado: true, id: cuerpo?.messages?.[0]?.id ?? null };
  } catch (err) {
    return { enviado: false, motivo: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Telefono para avisos de un usuario, o `null` si no dio numero o apago los
 * avisos. Cuando exista la verificacion por codigo, tambien exigira
 * `verificado_en`.
 */
export async function contactoParaAvisos(supabase: Supabase, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("contacto_usuarios")
    .select("telefono, avisos_whatsapp")
    .eq("user_id", userId)
    .maybeSingle();
  return data && data.avisos_whatsapp ? (data.telefono as string) : null;
}

/** `user_id` del dueño (SUPER_ADMIN) del negocio, como resuelven los correos. */
export async function duenoDelNegocio(supabase: Supabase, tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "SUPER_ADMIN")
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Nombre de pila para el saludo ("Ana"), con respaldo neutro. */
export async function nombreDePila(supabase: Supabase, userId: string): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  const meta = data?.user?.user_metadata ?? {};
  const completo =
    (meta.nombre as string | undefined) ||
    (meta.nombre_completo as string | undefined) ||
    (meta.full_name as string | undefined) ||
    "";
  return completo.trim().split(/\s+/)[0] || "hola";
}

/**
 * Avisa a un usuario por WhatsApp. NUNCA lanza: quien llama ya envio su
 * correo, y un fallo de WhatsApp no debe romper ese correo ni el cron.
 *
 * `valores` puede ser funcion para no resolver datos extra (nombre, etc.)
 * cuando el envio esta apagado o la persona no tiene numero.
 */
export async function avisarUsuarioPorWhatsApp<N extends NombrePlantilla>(
  supabase: Supabase,
  userId: string,
  plantilla: N,
  valores: ValoresPlantilla<N> | (() => Promise<ValoresPlantilla<N>>)
): Promise<ResultadoWhatsApp> {
  if (!whatsappActivo()) return { enviado: false, motivo: "desactivado" };
  try {
    const telefono = await contactoParaAvisos(supabase, userId);
    if (!telefono) return { enviado: false, motivo: "sin_contacto" };
    const resueltos = typeof valores === "function" ? await valores() : valores;
    const resultado = await enviarPlantillaWhatsApp(telefono, plantilla, resueltos);
    if (!resultado.enviado && resultado.motivo === "error") {
      console.error(`[whatsapp] ${plantilla} a ${userId} fallo: ${resultado.error}`);
    }
    return resultado;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] ${plantilla} a ${userId} fallo: ${error}`);
    return { enviado: false, motivo: "error", error };
  }
}

/** Igual que `avisarUsuarioPorWhatsApp`, al dueño del negocio. */
export async function avisarDuenoPorWhatsApp<N extends NombrePlantilla>(
  supabase: Supabase,
  tenantId: string,
  plantilla: N,
  valores: (ownerId: string) => ValoresPlantilla<N> | Promise<ValoresPlantilla<N>>
): Promise<ResultadoWhatsApp> {
  if (!whatsappActivo()) return { enviado: false, motivo: "desactivado" };
  try {
    const ownerId = await duenoDelNegocio(supabase, tenantId);
    if (!ownerId) return { enviado: false, motivo: "sin_contacto" };
    return avisarUsuarioPorWhatsApp(supabase, ownerId, plantilla, async () => valores(ownerId));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] ${plantilla} al dueño de ${tenantId} fallo: ${error}`);
    return { enviado: false, motivo: "error", error };
  }
}
