import type { TenantConfiguracionFiscal } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedFiscalSecrets {
  pac_password: string;
  certificado_cer: string;
  certificado_key: string;
  certificado_password: string;
}

type DbClient = Pick<SupabaseClient, "rpc">;

const SECRET_FIELDS = [
  "pac_password",
  "certificado_cer",
  "certificado_key",
  "certificado_password",
] as const;

export function getFiscalSecretKey(): string {
  const key = process.env.FISCAL_SECRET_KEY;
  if (!key) {
    throw new Error("FISCAL_SECRET_KEY no configurada");
  }
  return key;
}

export async function saveFiscalSecret(
  supabase: DbClient,
  tenantId: string,
  nombre: string,
  valor: string
): Promise<string> {
  const { data, error } = await supabase.rpc("guardar_secreto_fiscal", {
    p_tenant_id: tenantId,
    p_nombre: nombre,
    p_valor: valor,
    p_clave: getFiscalSecretKey(),
  });

  if (error) {
    console.error("Error guardando secreto fiscal:", error);
    throw new Error("No se pudo guardar la credencial fiscal");
  }

  return data as string;
}

export async function readFiscalSecrets(
  supabase: DbClient,
  tenantId: string,
  config: TenantConfiguracionFiscal
): Promise<ResolvedFiscalSecrets> {
  const key = getFiscalSecretKey();
  const ids: Record<(typeof SECRET_FIELDS)[number], string> = {
    pac_password: config.pac_password_id,
    certificado_cer: config.certificado_cer_id,
    certificado_key: config.certificado_key_id,
    certificado_password: config.certificado_password_id,
  };

  const resolved = {} as ResolvedFiscalSecrets;

  for (const field of SECRET_FIELDS) {
    const secretId = ids[field];
    if (!secretId) {
      resolved[field] = "";
      continue;
    }

    const { data, error } = await supabase.rpc("leer_secreto_fiscal", {
      p_secret_id: secretId,
      p_tenant_id: tenantId,
      p_clave: key,
    });

    if (error) {
      console.error(`Error leyendo secreto fiscal "${field}":`, error);
      throw new Error("No se pudo leer la credencial fiscal");
    }

    resolved[field] = (data as string) ?? "";
  }

  return resolved;
}

export function requiresSecrets(
  resolved: ResolvedFiscalSecrets,
  required: (keyof ResolvedFiscalSecrets)[],
  label = "Credenciales fiscales incompletas"
): void {
  const missing = required.filter((field) => !resolved[field]);
  if (missing.length > 0) {
    throw new Error(`${label}: ${missing.join(", ")}`);
  }
}