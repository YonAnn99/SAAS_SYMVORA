import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { tenantFiscalConfigSchema } from "@/lib/validations/schemas";
import { saveFiscalSecret } from "@/lib/cfdi/fiscal-secrets";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";

const PAC_PROVEEDORES = ["finkok", "swsapien", "mascarilla"] as const;

const NON_SECRET_FIELDS: (keyof TenantConfiguracionFiscal)[] = [
  "cfdi_serie",
  "cfdi_metodo_pago",
  "cfdi_forma_pago_default",
  "pac_proveedor",
  "pac_usuario",
  "email_envio_facturas",
];

const SECRET_FIELDS = {
  pac_password: "pac_password_id",
  certificado_cer: "certificado_cer_id",
  certificado_key: "certificado_key_id",
  certificado_password: "certificado_password_id",
} as const;

function validateFiscalConfig(config: Record<string, unknown>) {
  const result = tenantFiscalConfigSchema.safeParse(config);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      ok: false as const,
      error: firstIssue?.message ?? "Configuración fiscal inválida",
    };
  }
  return { ok: true as const, data: result.data };
}

function sanitizeConfig(
  config: TenantConfiguracionFiscal | null | undefined
): TenantConfiguracionFiscal | null {
  if (!config) return null;

  const sanitized: TenantConfiguracionFiscal = {
    cfdi_serie: config.cfdi_serie ?? "A",
    cfdi_metodo_pago: config.cfdi_metodo_pago ?? "PUE",
    cfdi_forma_pago_default: config.cfdi_forma_pago_default ?? "01",
    pac_proveedor: config.pac_proveedor ?? "finkok",
    pac_usuario: config.pac_usuario ?? "",
    pac_password_id: config.pac_password_id ?? "",
    certificado_cer_id: config.certificado_cer_id ?? "",
    certificado_key_id: config.certificado_key_id ?? "",
    certificado_password_id: config.certificado_password_id ?? "",
    email_envio_facturas: config.email_envio_facturas ?? "",
  };

  return sanitized;
}

function secretsSet(config: TenantConfiguracionFiscal | null | undefined) {
  return {
    pac_password: Boolean(config?.pac_password_id),
    certificado_cer: Boolean(config?.certificado_cer_id),
    certificado_key: Boolean(config?.certificado_key_id),
    certificado_password: Boolean(config?.certificado_password_id),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAccess(request);
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServiceRoleClient();

    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", auth.userId)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se encontró un tenant para el usuario" },
        { status: 404 }
      );
    }

    const [{ data: tenant }, { data: settings }] = await Promise.all([
      supabase
        .from("tenants")
        .select("id, rfc, razon_social, regimen_fiscal, codigo_postal")
        .eq("id", membership.tenant_id)
        .single(),
      supabase
        .from("tenant_settings")
        .select("configuracion_fiscal")
        .eq("tenant_id", membership.tenant_id)
        .single(),
    ]);

    const fiscalConfig = settings?.configuracion_fiscal as
      | TenantConfiguracionFiscal
      | null;

    return NextResponse.json({
      success: true,
      tenant_id: membership.tenant_id,
      emisor: {
        rfc: tenant?.rfc ?? "",
        razon_social: tenant?.razon_social ?? "",
        regimen_fiscal: tenant?.regimen_fiscal ?? "",
        codigo_postal: tenant?.codigo_postal ?? "",
      },
      configuracion_fiscal: sanitizeConfig(fiscalConfig),
      secrets_set: secretsSet(fiscalConfig),
    });
  } catch (error) {
    console.error("Get facturas config error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

interface SaveConfigRequest {
  tenant_id: string;
  emisor?: {
    rfc?: string;
    razon_social?: string;
    regimen_fiscal?: string;
    codigo_postal?: string;
  };
  configuracion_fiscal?: {
    cfdi_serie?: string;
    cfdi_metodo_pago?: string;
    cfdi_forma_pago_default?: string;
    pac_proveedor?: string;
    pac_usuario?: string;
    email_envio_facturas?: string;
  };
  secrets?: {
    pac_password?: string;
    certificado_cer?: string;
    certificado_key?: string;
    certificado_password?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveConfigRequest = await request.json();
    const supabase = createSupabaseServiceRoleClient();

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "billing.config",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const emisor = body.emisor ?? {};

    const validation = validateFiscalConfig(emisor);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const pacProveedor = body.configuracion_fiscal?.pac_proveedor;
    if (pacProveedor && !PAC_PROVEEDORES.includes(pacProveedor as (typeof PAC_PROVEEDORES)[number])) {
      return NextResponse.json(
        { error: "Proveedor PAC inválido" },
        { status: 400 }
      );
    }

    // Read current configuracion_fiscal to merge with the update
    const { data: currentSettings } = await supabase
      .from("tenant_settings")
      .select("configuracion_fiscal")
      .eq("tenant_id", body.tenant_id)
      .single();

    const currentConfig = sanitizeConfig(
      currentSettings?.configuracion_fiscal as TenantConfiguracionFiscal | null
    ) ?? {
      cfdi_serie: "A",
      cfdi_metodo_pago: "PUE",
      cfdi_forma_pago_default: "01",
      pac_proveedor: "finkok",
      pac_usuario: "",
      pac_password_id: "",
      certificado_cer_id: "",
      certificado_key_id: "",
      certificado_password_id: "",
      email_envio_facturas: "",
    };

    const incoming = body.configuracion_fiscal ?? {};
    const mergedConfig: TenantConfiguracionFiscal = {
      ...currentConfig,
      ...NON_SECRET_FIELDS.reduce((acc, field) => {
        if (field in incoming) {
          (acc as Record<string, unknown>)[field] = (incoming as Record<string, unknown>)[field];
        }
        return acc;
      }, {} as Partial<TenantConfiguracionFiscal>),
    };

    // Store any provided secret in the vault (cifrado) and keep only its ID
    const secrets = body.secrets ?? {};
    for (const [field, idField] of Object.entries(SECRET_FIELDS)) {
      const valor = (secrets as Record<string, string>)[field];
      if (valor && valor.trim().length > 0) {
        const secretId = await saveFiscalSecret(supabase, body.tenant_id, field, valor);
        (mergedConfig as unknown as Record<string, string>)[idField] = secretId;
      }
    }

    const [tenantResult, settingsResult] = await Promise.all([
      supabase
        .from("tenants")
        .update({
          rfc: validation.data.rfc,
          razon_social: validation.data.razon_social,
          regimen_fiscal: validation.data.regimen_fiscal,
          codigo_postal: validation.data.codigo_postal,
        })
        .eq("id", body.tenant_id),
      supabase
        .from("tenant_settings")
        .update({ configuracion_fiscal: mergedConfig })
        .eq("tenant_id", body.tenant_id),
    ]);

    if (tenantResult.error) {
      console.error("Error updating tenant fiscal data:", tenantResult.error);
      return NextResponse.json(
        { error: "Error al actualizar los datos fiscales" },
        { status: 500 }
      );
    }

    if (settingsResult.error) {
      console.error("Error updating configuracion_fiscal:", settingsResult.error);
      return NextResponse.json(
        { error: "Error al actualizar la configuración PAC" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuración fiscal guardada correctamente",
    });
  } catch (error) {
    console.error("Save facturas config error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}