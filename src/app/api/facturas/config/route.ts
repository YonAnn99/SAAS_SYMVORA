import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { tenantFiscalConfigSchema } from "@/lib/validations/schemas";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";

const PAC_PROVEEDORES = ["finkok", "swsapien", "mascarilla"] as const;

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

    return NextResponse.json({
      success: true,
      tenant_id: membership.tenant_id,
      emisor: {
        rfc: tenant?.rfc ?? "",
        razon_social: tenant?.razon_social ?? "",
        regimen_fiscal: tenant?.regimen_fiscal ?? "",
        codigo_postal: tenant?.codigo_postal ?? "",
      },
      configuracion_fiscal:
        (settings?.configuracion_fiscal as TenantConfiguracionFiscal | null) ?? null,
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
  configuracion_fiscal?: Partial<TenantConfiguracionFiscal>;
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

    const emisor = body.emisor ?? {};

    const validation = validateFiscalConfig(emisor);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (
      body.configuracion_fiscal?.pac_proveedor &&
      !PAC_PROVEEDORES.includes(
        body.configuracion_fiscal.pac_proveedor as (typeof PAC_PROVEEDORES)[number]
      )
    ) {
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

    const currentConfig =
      (currentSettings?.configuracion_fiscal as TenantConfiguracionFiscal | null) ?? {
        cfdi_serie: "A",
        cfdi_metodo_pago: "PUE",
        cfdi_forma_pago_default: "01",
        pac_proveedor: "finkok",
        pac_usuario: "",
        pac_password: "",
        certificado_cer: "",
        certificado_key: "",
        certificado_password: "",
        email_envio_facturas: "",
      };

    const mergedConfig: TenantConfiguracionFiscal = {
      ...currentConfig,
      ...(body.configuracion_fiscal ?? {}),
    };

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