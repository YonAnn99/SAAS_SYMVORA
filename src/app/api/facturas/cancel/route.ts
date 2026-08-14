import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { createPACClient } from "@/lib/cfdi/pac-client";
import { readFiscalSecrets, requiresSecrets } from "@/lib/cfdi/fiscal-secrets";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";

interface CancelRequest {
  factura_id: string;
  motivo: string;
  folio_sustitucion?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CancelRequest = await request.json();
    const supabase = createSupabaseServiceRoleClient();

    // Get factura
    const { data: factura, error: facturaError } = await supabase
      .from("facturas")
      .select("*")
      .eq("id", body.factura_id)
      .single();

    if (facturaError || !factura) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: factura.tenant_id,
      permission: "billing.cancel",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    if (factura.estado !== "TIMBRADA") {
      return NextResponse.json(
        { error: "Solo se pueden cancelar facturas timbradas" },
        { status: 400 }
      );
    }

    if (!factura.uuid_cfdi) {
      return NextResponse.json(
        { error: "La factura no tiene UUID de timbrado" },
        { status: 400 }
      );
    }

    // Get PAC config
    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("configuracion_fiscal")
      .eq("tenant_id", factura.tenant_id)
      .single();

    const fiscalConfig = settings?.configuracion_fiscal as TenantConfiguracionFiscal | null;
    if (!fiscalConfig?.pac_usuario) {
      return NextResponse.json(
        { error: "Configuración PAC no encontrada" },
        { status: 400 }
      );
    }

    // Resolve encrypted credentials (FISCAL_SECRET_KEY)
    const secrets = await readFiscalSecrets(supabase, factura.tenant_id, fiscalConfig);
    requiresSecrets(
      secrets,
      ["pac_password", "certificado_cer", "certificado_key"],
      "Configuración PAC incompleta para cancelación"
    );

    // Create PAC client and cancel
    const pacClient = createPACClient(fiscalConfig, secrets);

    try {
      const result = await pacClient.cancel({
        uuid: factura.uuid_cfdi,
        rfcEmisor: factura.emisor_rfc,
        rfcReceptor: factura.receptor_rfc,
        total: factura.total.toFixed(2),
        motivo: body.motivo,
        folioSustitucion: body.folio_sustitucion,
      });

      // Update factura status
      const { error: updateError } = await supabase
        .from("facturas")
        .update({
          estado: "CANCELADA",
          fecha_cancelacion: new Date().toISOString(),
          motivo_cancelacion: body.motivo,
          folio_sustitucion: body.folio_sustitucion || null,
          pac_response: result.rawResponse as Record<string, unknown>,
        })
        .eq("id", body.factura_id);

      if (updateError) {
        console.error("Error updating factura:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la factura" },
          { status: 500 }
        );
      }

      // Log cancellation
      await supabase.from("facturas_cancelaciones").insert({
        factura_id: body.factura_id,
        motivo: body.motivo,
        folio_sustitucion: body.folio_sustitucion || null,
        fecha_respuesta: new Date().toISOString(),
        estado: result.accepted ? "ACEPTADA" : "RECHAZADA",
        pac_response: result.rawResponse as Record<string, unknown>,
      });

      return NextResponse.json({
        success: true,
        accepted: result.accepted,
        message: result.accepted
          ? "Factura cancelada correctamente"
          : "Solicitud de cancelación enviada",
      });
    } catch (pacError) {
      console.error("PAC cancel error:", pacError);
      return NextResponse.json(
        {
          error: `Error al cancelar: ${pacError instanceof Error ? pacError.message : "Error desconocido del PAC"}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Cancel factura error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
