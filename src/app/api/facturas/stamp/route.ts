import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { createPACClient } from "@/lib/cfdi/pac-client";
import { generateSealedCFDIXML } from "@/lib/cfdi/xml-generator";
import { readFiscalSecrets, requiresSecrets } from "@/lib/cfdi/fiscal-secrets";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";

interface StampRequest {
  factura_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: StampRequest = await request.json();
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
      permission: "billing.stamp",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    if (factura.estado !== "BORRADOR") {
      return NextResponse.json(
        { error: "Solo se pueden timbrar facturas en estado BORRADOR" },
        { status: 400 }
      );
    }

    // Get detail lines
    const { data: detalle, error: detalleError } = await supabase
      .from("factura_detalle")
      .select("*")
      .eq("factura_id", body.factura_id)
      .order("orden");

    if (detalleError || !detalle || detalle.length === 0) {
      return NextResponse.json(
        { error: "La factura no tiene conceptos" },
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
      ["pac_password", "certificado_cer", "certificado_key", "certificado_password"],
      "Configuración PAC incompleta"
    );

    // Generate sealed XML (sello digital real con el CSD)
    const sealed = await generateSealedCFDIXML(factura, detalle, {
      certificadoCer: secrets.certificado_cer,
      certificadoKey: secrets.certificado_key,
      certificadoPassword: secrets.certificado_password,
    });

    // Create PAC client and stamp
    const pacClient = createPACClient(fiscalConfig, secrets);

    try {
      const result = await pacClient.stamp(sealed.xml);

      // Update factura with CFDI data
      const { error: updateError } = await supabase
        .from("facturas")
        .update({
          estado: "TIMBRADA",
          uuid_cfdi: result.uuid,
          fecha_timbrado: new Date().toISOString(),
          pac_nombre: fiscalConfig.pac_proveedor,
          pac_response: result.rawResponse as Record<string, unknown>,
          xml_timbrado: result.xml || sealed.xml,
          xml_url: `/api/facturas/${body.factura_id}/xml`,
          pdf_url: `/api/facturas/${body.factura_id}/pdf`,
        })
        .eq("id", body.factura_id);

      if (updateError) {
        console.error("Error updating factura:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la factura" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        uuid: result.uuid,
        message: "Factura timbrada correctamente",
      });
    } catch (pacError) {
      console.error("PAC stamp error:", pacError);
      return NextResponse.json(
        {
          error: `Error al timbrar: ${pacError instanceof Error ? pacError.message : "Error desconocido del PAC"}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Stamp factura error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
