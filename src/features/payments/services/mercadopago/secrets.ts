import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { getFiscalSecretKey } from "@/lib/fiscal-secrets";
import type {
  MercadoPagoPointConfig,
  ResolvedMercadoPagoSecrets,
} from "@/features/payments/types/payments.types";

export type {
  MercadoPagoPointConfig,
  ResolvedMercadoPagoSecrets,
} from "@/features/payments/types/payments.types";

export const MP_ACCESS_TOKEN_SECRET = "mercado_pago_access_token";
export const MP_WEBHOOK_SECRET = "mercado_pago_webhook_secret";

const DEFAULT_CONFIG: MercadoPagoPointConfig = {
  habilitado: false,
  terminal_id: "",
  access_token_id: "",
  webhook_secret_id: "",
};

export async function getMercadoPagoPointConfig(
  tenantId: string
): Promise<MercadoPagoPointConfig> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("configuracion_json")
    .eq("tenant_id", tenantId)
    .single();

  const mp = (settings?.configuracion_json as Record<string, unknown> | null)
    ?.mercado_pago_point as Partial<MercadoPagoPointConfig> | null;

  if (!mp) return { ...DEFAULT_CONFIG };

  return {
    habilitado: Boolean(mp.habilitado),
    terminal_id: mp.terminal_id ?? "",
    access_token_id: mp.access_token_id ?? "",
    webhook_secret_id: mp.webhook_secret_id ?? "",
  };
}

export async function readMercadoPagoSecrets(
  tenantId: string,
  config: MercadoPagoPointConfig
): Promise<ResolvedMercadoPagoSecrets> {
  const key = getFiscalSecretKey();
  const supabase = createSupabaseServiceRoleClient();

  const read = async (secretId: string): Promise<string> => {
    if (!secretId) return "";
    const { data, error } = await supabase.rpc("leer_secreto_fiscal", {
      p_secret_id: secretId,
      p_tenant_id: tenantId,
      p_clave: key,
    });
    if (error) {
      console.error("Error leyendo secreto Mercado Pago:", error);
      return "";
    }
    return (data as string) ?? "";
  };

  const [accessToken, webhookSecret] = await Promise.all([
    read(config.access_token_id),
    read(config.webhook_secret_id),
  ]);

  return { accessToken, webhookSecret };
}

export function isMercadoPagoReady(config: MercadoPagoPointConfig): boolean {
  return (
    config.habilitado &&
    Boolean(config.terminal_id) &&
    Boolean(config.access_token_id) &&
    Boolean(config.webhook_secret_id)
  );
}