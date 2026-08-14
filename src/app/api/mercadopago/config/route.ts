import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import {
  getMercadoPagoPointConfig,
  MP_ACCESS_TOKEN_SECRET,
  MP_WEBHOOK_SECRET,
  type MercadoPagoPointConfig,
} from "@/lib/mercadopago/secrets";
import { saveFiscalSecret } from "@/lib/cfdi/fiscal-secrets";

export const dynamic = "force-dynamic";

interface SaveMercadoPagoConfigRequest {
  tenant_id: string;
  habilitado?: boolean;
  terminal_id?: string;
  access_token?: string;
  webhook_secret?: string;
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

    const config = await getMercadoPagoPointConfig(membership.tenant_id);

    return NextResponse.json({
      success: true,
      tenant_id: membership.tenant_id,
      config: {
        habilitado: config.habilitado,
        terminal_id: config.terminal_id,
        access_token_set: Boolean(config.access_token_id),
        webhook_secret_set: Boolean(config.webhook_secret_id),
      },
    });
  } catch (error) {
    console.error("Get Mercado Pago config error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveMercadoPagoConfigRequest;

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

    const supabase = createSupabaseServiceRoleClient();

    const current = await getMercadoPagoPointConfig(body.tenant_id);

    const next: MercadoPagoPointConfig = {
      ...current,
      habilitado: body.habilitado ?? current.habilitado,
      terminal_id: (body.terminal_id ?? current.terminal_id).trim(),
    };

    if (body.access_token && body.access_token.trim().length > 0) {
      const secretId = await saveFiscalSecret(
        supabase,
        body.tenant_id,
        MP_ACCESS_TOKEN_SECRET,
        body.access_token.trim()
      );
      next.access_token_id = secretId;
    }

    if (body.webhook_secret && body.webhook_secret.trim().length > 0) {
      const secretId = await saveFiscalSecret(
        supabase,
        body.tenant_id,
        MP_WEBHOOK_SECRET,
        body.webhook_secret.trim()
      );
      next.webhook_secret_id = secretId;
    }

    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("configuracion_json")
      .eq("tenant_id", body.tenant_id)
      .single();

    const configJson = (settings?.configuracion_json as Record<string, unknown>) ?? {};
    const merged = { ...configJson, mercado_pago_point: next };

    const { error } = await supabase
      .from("tenant_settings")
      .update({ configuracion_json: merged })
      .eq("tenant_id", body.tenant_id);

    if (error) {
      console.error("Error guardando config Mercado Pago:", error);
      return NextResponse.json(
        { error: "Error al guardar la configuración" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuración guardada correctamente",
    });
  } catch (error) {
    console.error("Save Mercado Pago config error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}