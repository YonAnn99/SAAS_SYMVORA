import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  avisarDuenoPorWhatsApp,
  avisarUsuarioPorWhatsApp,
  contactoParaAvisos,
  duenoDelNegocio,
} from "@/lib/whatsapp-api";
import { enviarSMS, smsActivo, type ResultadoSMS } from "@/lib/sms-api";
import { textoCorteCajaSMS } from "@/lib/sms-texto";
import type { ValoresPlantilla } from "@/lib/whatsapp-plantillas";

/**
 * Aviso de corte de caja al celular. SOLO SERVIDOR.
 *
 * WhatsApp primero; si esta apagado (sin llaves de Meta) o fallo, SMS por
 * Twilio. Con ninguno configurado no hace nada. NUNCA lanza: quien llama ya
 * envio su correo y un fallo aqui no debe romperlo.
 */

type Supabase = ReturnType<typeof createSupabaseServiceRoleClient>;

export type DestinoAviso = { userId: string } | { tenantId: string };

export async function avisarCorteDeCaja(
  supabase: Supabase,
  destino: DestinoAviso,
  valores: ValoresPlantilla<"corte_caja">
): Promise<{ canal: "whatsapp" | "sms" | null }> {
  const whatsapp =
    "userId" in destino
      ? await avisarUsuarioPorWhatsApp(supabase, destino.userId, "corte_caja", valores)
      : await avisarDuenoPorWhatsApp(supabase, destino.tenantId, "corte_caja", () => valores);
  if (whatsapp.enviado) return { canal: "whatsapp" };
  if (whatsapp.motivo === "sin_contacto" || !smsActivo()) return { canal: null };

  const sms = await corteDeCajaPorSMS(supabase, destino, valores);
  return { canal: sms.enviado ? "sms" : null };
}

async function corteDeCajaPorSMS(
  supabase: Supabase,
  destino: DestinoAviso,
  valores: ValoresPlantilla<"corte_caja">
): Promise<ResultadoSMS> {
  try {
    const userId = "userId" in destino ? destino.userId : await duenoDelNegocio(supabase, destino.tenantId);
    if (!userId) return { enviado: false, motivo: "sin_contacto" };
    const telefono = await contactoParaAvisos(supabase, userId);
    if (!telefono) return { enviado: false, motivo: "sin_contacto" };
    const resultado = await enviarSMS(telefono, textoCorteCajaSMS(valores));
    if (!resultado.enviado && resultado.motivo === "error") {
      console.error(`[sms] corte_caja a ${userId} fallo: ${resultado.error}`);
    }
    return resultado;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[sms] corte_caja fallo: ${error}`);
    return { enviado: false, motivo: "error", error };
  }
}
